import { addFetchLog, fetchNative, globalFetch, textifyReadableStream } from "src/ts/globalApi.svelte"
import { registerClaudeObserver } from "src/ts/observer.svelte"
import { isNodeServer } from "src/ts/platform"
import { getDatabase } from "src/ts/storage/database.svelte"
import { replaceAsync, simplifySchema, sleep } from "src/ts/util"
import type { MultiModal } from "../index.svelte"
import { extractJSON } from "../templates/jsonSchema"
import { applyParameters, type RequestDataArgumentExtended, type requestDataResponse, type StreamResponseChunk } from "./request"
import { callTool, decodeToolCall, encodeToolCall } from "../mcp/mcp"
import { buildCharacterRagPayload, buildGlobalRagPayload } from "./ragPayload"
const anthropicLog = (..._args: unknown[]) => {};

interface Claude3TextBlock {
    type: 'text',
    text: string,
    cache_control?: {
        "type": "ephemeral",
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ImageBlock {
    type: 'image',
    source: {
        type: 'base64'
        media_type: string,
        data: string
    }
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ToolUseBlock {
    "type": "tool_use",
    "id": string,
    "name": string,
    "input": unknown,
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ToolResponseBlock {
    type: "tool_result",
    tool_use_id: string
    content: Claude3ContentBlock[]
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

type Claude3ContentBlock = Claude3TextBlock|Claude3ImageBlock|Claude3ToolUseBlock|Claude3ToolResponseBlock

interface Claude3Chat {
    role: 'user'|'assistant'
    content: Claude3ContentBlock[]
}

interface Claude3ExtendedChat {
    role: 'user'|'assistant'
    content: Claude3ContentBlock[]|string
}

type AnthropicServerErrorPayload = {
    details?: {
        status?: number
        body?: {
            error?: { message?: string }
            message?: string
        }
    }
    status?: number
    message?: string
    error?: string
}

type AnthropicThinkingConfig = {
    budget_tokens?: number | null
    type?: string
}

type AnthropicRequestBody = {
    messages?: Claude3ExtendedChat[]
    stream?: boolean
    thinking?: AnthropicThinkingConfig
    model?: string
    system?: string
    max_tokens?: number
    [key: string]: unknown
}

async function requestAnthropicServerExecution(arg: RequestDataArgumentExtended, body: Record<string, unknown>): Promise<requestDataResponse> {
    const hasServerAssemblyContext = !!(arg.currentChar?.chaId) && !!arg.chatId;
    const serverExecEndpoint = hasServerAssemblyContext ? '/data/llm/generate' : '/data/llm/execute';
    const parseErrorPayload = (parsed: AnthropicServerErrorPayload | undefined, statusFallback: number) => {
        const status = Number(parsed?.details?.status ?? parsed?.status ?? statusFallback);
        const upstreamBody = parsed?.details?.body;
        const upstreamMessage =
            upstreamBody?.error?.message ||
            upstreamBody?.message ||
            parsed?.message ||
            parsed?.error ||
            '';
        return {
            status,
            code: String(parsed?.error || ''),
            message: String(upstreamMessage || 'Request failed'),
        };
    };

    const charRagSettings = arg.currentChar?.ragSettings
    const globalRagSettings = getDatabase().globalRagSettings
    const requestBodyForServer = (typeof structuredClone === 'function')
        ? structuredClone(body)
        : JSON.parse(JSON.stringify(body));
    requestBodyForServer.stream = !!arg.useStreaming;
    const latestUserMessage = [...(arg.formated || [])]
        .reverse()
        .find((m) => m?.role === 'user' && typeof m?.content === 'string' && m.content.trim().length > 0)
        ?.content?.trim() || '';
    const hasMultimodal = (arg.formated || []).some((m) => Array.isArray(m?.multimodals) && m.multimodals.length > 0);
    const canUseRawGeneratePayload =
        !arg.previewBody
        && !!(arg.currentChar?.chaId)
        && !!arg.chatId
        && !!latestUserMessage
        && !hasMultimodal;

    const payload = canUseRawGeneratePayload
        ? {
            mode: arg.mode ?? 'model',
            provider: 'anthropic',
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            userMessage: latestUserMessage,
            model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
            maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens))
                ? Number(requestBodyForServer.max_tokens)
                : undefined,
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
        }
        : {
            mode: arg.mode ?? 'model',
            provider: 'anthropic',
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            useClientAssembledRequest: serverExecEndpoint === '/data/llm/generate',
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
            request: {
                requestBody: requestBodyForServer,
                messages: Array.isArray(requestBodyForServer.messages) ? requestBodyForServer.messages : undefined,
                model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens))
                    ? Number(requestBodyForServer.max_tokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
            },
        };

    if (arg.previewBody) {
        const previewRes = await globalFetch('/data/llm/preview', {
            method: 'POST',
            body: payload,
            abortSignal: arg.abortSignal,
            chatId: arg.chatId,
        });
        const parsed = previewRes.data as unknown;
        addFetchLog({
            body: payload,
            response: parsed,
            success: previewRes.ok,
            url: '/data/llm/preview',
            status: previewRes.status,
            chatId: arg.chatId,
        });
        if (!previewRes.ok) {
            return {
                type: 'fail',
                result: `${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`
            };
        }
        return {
            type: 'success',
            result: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
        };
    }

    if (arg.useStreaming) {
        const res = await fetchNative(serverExecEndpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            signal: arg.abortSignal,
        });
        if (res.status !== 200) {
            return {
                type: 'fail',
                result: await textifyReadableStream(res.body)
            };
        }

        addFetchLog({
            body: payload,
            response: 'Streaming (Server)',
            success: true,
            url: serverExecEndpoint,
            status: res.status,
            chatId: arg.chatId,
        });

        const stream = new ReadableStream<StreamResponseChunk>({
            async start(controller) {
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let parserData = '';
                let acc = '';
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    parserData += decoder.decode(value, { stream: true });
                    const parts = parserData.split('\n');
                    parserData = parts.pop() ?? '';
                    for (const line of parts) {
                        const trimmed = line.trim();
                        if (!trimmed.startsWith('data: ')) continue;
                        const raw = trimmed.slice(6).trim();
                        if (!raw) continue;
                        try {
                            const parsed = JSON.parse(raw);
                            if (parsed.type === 'chunk') {
                                acc += (parsed.text || '');
                                controller.enqueue({ "0": acc });
                            } else if (parsed.type === 'done') {
                                if (parsed.newCharEtag) {
                                    controller.enqueue({ "__newCharEtag": parsed.newCharEtag });
                                }
                                controller.close();
                                return;
                            } else if (parsed.type === 'error' || parsed.type === 'fail') {
                                controller.enqueue({ "0": `Error: ${parsed.message || parsed.error || 'Server stream failed'}` });
                                controller.close();
                                return;
                            }
                        } catch {}
                    }
                }
                controller.close();
            },
        });

        return {
            type: 'streaming',
            result: stream,
        };
    }

    const serverRes = await globalFetch(serverExecEndpoint, {
        method: 'POST',
        body: payload,
        abortSignal: arg.abortSignal,
        chatId: arg.chatId,
    });
    const parsed = serverRes.data as unknown;

    addFetchLog({
        body: payload,
        response: parsed,
        success: serverRes.ok,
        url: serverExecEndpoint,
        status: serverRes.status,
        chatId: arg.chatId,
    });

    if (!serverRes.ok) {
        if (typeof parsed === 'string') {
            return { type: 'fail', result: parsed };
        }
        const err = parseErrorPayload(
            (typeof parsed === 'object' && parsed !== null) ? parsed as AnthropicServerErrorPayload : undefined,
            serverRes.status
        );
        if (err.code === 'ANTHROPIC_KEY_MISSING') {
            return { type: 'fail', noRetry: true, result: `Anthropic key is missing in server settings.` };
        }
        return {
            type: 'fail',
            failByServerError: err.status >= 500,
            result: err.message,
        };
    }

    const parsedObj = (typeof parsed === 'object' && parsed !== null)
        ? (parsed as { type?: string; result?: string; newCharEtag?: string })
        : undefined;

    if (parsedObj?.type === 'success' && typeof parsedObj?.result === 'string') {
        return {
            type: 'success',
            result: parsedObj.result,
            newCharEtag: parsedObj.newCharEtag,
        };
    }

    return {
        type: 'fail',
        result: typeof parsed === 'string' ? parsed : JSON.stringify(parsed),
    };
}

export async function requestClaude(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const useStreaming = arg.useStreaming
    const replacerURL = arg.customURL ?? ('https://api.anthropic.com/v1/messages')
    const apiKey = arg.key || db.claudeAPIKey
    const maxTokens = arg.maxTokens

    const claudeChat: Claude3Chat[] = []
    let systemPrompt:string = ''

    const addClaudeChat = (chat:{
        role: 'user'|'assistant'
        content: string,
        cache: boolean
    }, multimodals?:MultiModal[]) => {
        if(claudeChat.length > 0 && claudeChat[claudeChat.length-1].role === chat.role){
            let content = claudeChat[claudeChat.length-1].content
            if(multimodals && multimodals.length > 0 && !Array.isArray(content)){
                content = [{    
                    type: 'text',
                    text: content
                }]
            }

            if(Array.isArray(content)){
                const lastContent = content[content.length-1]
                if( lastContent?.type === 'text'){
                    lastContent.text += "\n\n" + chat.content
                    content[content.length-1] = lastContent
                }
                else{
                    content.push({
                        type: 'text',
                        text: chat.content
                    })
                }

                if(multimodals && multimodals.length > 0){
                    for(const modal of multimodals){
                        if(modal.type === 'image'){
                            const dataurl = modal.base64
                            const base64 = dataurl.split(',')[1]
                            const mediaType = dataurl.split(';')[0].split(':')[1]

                            content.unshift({
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: mediaType,
                                    data: base64
                                }
                            })
                        }
                    }
                }
            }
            if(chat.cache){
                content[content.length-1].cache_control = {
                    type: 'ephemeral'
                }
            }
            claudeChat[claudeChat.length-1].content = content
        }
        else{
            const formatedChat:Claude3Chat = {
                role: chat.role,
                content: [{
                    type: 'text',
                    text: chat.content
                }]
            }
            if(multimodals && multimodals.length > 0){
                formatedChat.content = [{
                    type: 'text',
                    text: chat.content
                }]
                for(const modal of multimodals){
                    if(modal.type === 'image'){
                        const dataurl = modal.base64
                        const base64 = dataurl.split(',')[1]
                        const mediaType = dataurl.split(';')[0].split(':')[1]

                        formatedChat.content.unshift({
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mediaType,
                                data: base64
                            }
                        })
                    }
                }

            }
            if(chat.cache){
                formatedChat.content[0].cache_control = {
                    type: 'ephemeral'
                }
            }
            claudeChat.push(formatedChat)
        }
    }
    for(const chat of formated){
        switch(chat.role){
            case 'user':{
                addClaudeChat({
                    role: 'user',
                    content: chat.content,
                    cache: chat.cachePoint
                }, chat.multimodals)
                break
            }
            case 'assistant':{
                addClaudeChat({
                    role: 'assistant',
                    content: chat.content,
                    cache: chat.cachePoint
                }, chat.multimodals)
                break
            }
            case 'system':{
                if(claudeChat.length === 0){
                    systemPrompt += '\n\n' + chat.content
                }
                else{
                    addClaudeChat({
                        role: 'user',
                        content: "System: " + chat.content,
                        cache: chat.cachePoint
                    })
                }
                break
            }
            case 'function':{
                //ignore function for now
                break
            }
        }
    }
    if(claudeChat.length === 0 && systemPrompt === ''){
        return {
            type: 'fail',
            result: 'No input'
        }
    }
    if(claudeChat.length === 0 && systemPrompt !== ''){
        claudeChat.push({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        })
        systemPrompt = ''
    }
    if(claudeChat[0].role !== 'user'){
        claudeChat.unshift({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        })
    }

    //check for tool calls
    for(let j=0;j<claudeChat.length;j++){
        let chat = claudeChat[j]
        for(let i=0;i<chat.content.length;i++){
            const content = chat.content[i]
            if(content.type === 'text'){
                content.text = await replaceAsync(content.text,/<tool_call>(.*?)<\/tool_call>/g, async (match:string, p1:string) => {
                    try {
                        const parsed = await decodeToolCall(p1)
                        if(parsed?.call && parsed?.response){
                            const toolUse:Claude3ToolUseBlock = {
                                type: 'tool_use',
                                id: parsed.call.id,
                                name: parsed.call.name,
                                input: parsed.call.arg
                            }
                            const toolResponse:Claude3ToolResponseBlock = {
                                type: 'tool_result',
                                tool_use_id: parsed.call.id,
                                content: parsed.response.map((v) => {
                                    if(v.type === 'text'){
                                        return {
                                            type: 'text',
                                            text: v.text
                                        }
                                    }
                                    if(v.type === 'image'){
                                        return {
                                            type: 'image',
                                            source: {
                                                type: 'base64',
                                                media_type: v.mimeType,
                                                data: v.data
                                            }
                                        }
                                    }
                                    return {
                                        type: 'text',
                                        text: `Unsupported tool response type: ${v.type}`
                                    }
                                })
                            }
                            claudeChat.splice(j, 0, {
                                role: 'assistant',
                                content: [toolUse]
                            })

                            claudeChat.splice(j+1, 0, {
                                role: 'user',
                                content: [toolResponse]
                            })
                            j+=2
                            chat = claudeChat[j]
                            return ''
                        }
                    } catch {
                        
                    }

                    return ''
                })
            }
        }
    }

    const finalChat:Claude3ExtendedChat[] = claudeChat

    anthropicLog(arg.modelInfo.parameters)
    const body = applyParameters({
        model: arg.modelInfo.internalID,
        messages: finalChat,
        system: systemPrompt.trim(),
        max_tokens: maxTokens,
        stream: useStreaming ?? false
    }, arg.modelInfo.parameters, {
        'thinking_tokens': 'thinking.budget_tokens'
    }, arg.mode) as AnthropicRequestBody

    if(body?.thinking?.budget_tokens === 0){
        delete body.thinking
    }
    else if(body?.thinking?.budget_tokens && body?.thinking?.budget_tokens > 0){
        body.thinking.type = 'enabled'
    }
    else if(body?.thinking?.budget_tokens === null){
        delete body.thinking
    }

    if(systemPrompt === ''){
        delete body.system
    }

    const headers:{
        [key:string]:string
    } = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "accept": "application/json",
    }

    const betas:string[] = []

    if(typeof body.max_tokens === 'number' && body.max_tokens > 8192){
        betas.push('output-128k-2025-02-19')
    }


    if(betas.length > 0){
        headers['anthropic-beta'] = betas.join(',')
    }

    if(db.usePlainFetch){
        headers['anthropic-dangerous-direct-browser-access'] = 'true'
    }

    if(arg.tools && arg.tools.length > 0){
        body.tools = arg.tools.map((v) => {
            return {
                name: v.name,
                description: v.description,
                input_schema: simplifySchema(v.inputSchema)
            }
        })

    }

    const useServerAnthropic =
        isNodeServer &&
        !(arg.tools && arg.tools.length > 0);

    if (useServerAnthropic) {
        return await requestAnthropicServerExecution(arg, body);
    }

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: replacerURL,
                body: body,
                headers: headers
            })
        }
    }

    if(db.claudeRetrivalCaching){
        registerClaudeObserver({
            url: replacerURL,
            body: body,
            headers: headers
        })
    }

    return requestClaudeHTTP(replacerURL, headers, body, arg)
}

async function requestClaudeHTTP(replacerURL:string, headers:{[key:string]:string}, body:AnthropicRequestBody, arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    
    if(arg.useStreaming){
        
        const res = await fetchNative(replacerURL, {
            body: JSON.stringify(body),
            headers: headers,
            method: "POST",
            chatId: arg.chatId
        })

        if(res.status !== 200){
            return {
                type: 'fail',
                result: await textifyReadableStream(res.body)
            }
        }
        let thinking = false

        const stream = new ReadableStream<StreamResponseChunk>({
            async start(controller){
                let text = ''
                let reader = res.body.getReader()
                let parserData = ''
                const decoder = new TextDecoder()
                const parseEvent = ((e:string) => {
                    try {               
                        const parsedData = JSON.parse(e)

                        if(parsedData?.type === 'content_block_delta'){
                            if(parsedData?.delta?.type === 'text' || parsedData.delta?.type === 'text_delta'){
                                if(thinking){
                                    text += "</Thoughts>\n\n"
                                    thinking = false
                                }
                                text += parsedData.delta?.text ?? ''
                            }
    
                            if(parsedData?.delta?.type === 'thinking' || parsedData.delta?.type === 'thinking_delta'){
                                if(!thinking){
                                    text += "<Thoughts>\n"
                                    thinking = true
                                }
                                text += parsedData.delta?.thinking ?? ''
                            }
    
                            if(parsedData?.delta?.type === 'redacted_thinking'){
                                if(!thinking){
                                    text += "<Thoughts>\n"
                                    thinking = true
                                }
                                text += '\n{{redacted_thinking}}\n'
                            }
                        }

                        if(parsedData?.type === 'error'){
                            const errormsg:string = parsedData?.error?.message
                            if(errormsg && errormsg.toLocaleLowerCase().includes('overload') && db.antiServerOverloads){
                                // anthropicLog('Overload detected, retrying...')
                                controller.enqueue({
                                    "0": "Overload detected, retrying..."
                                })

                                return 'overload'
                            }
                            text += "Error:" + parsedData?.error?.message

                        }
                        
                    }
                    catch {
                    }

                        
                        
                })
                let breakWhile = false
                let i = 0;
                let prevText = ''
                while(true){
                    try {
                        if(arg?.abortSignal?.aborted || breakWhile){
                            break
                        }
                        const {done, value} = await reader.read() 
                        if(done){
                            break
                        }
                        parserData += (decoder.decode(value))
                        const parts = parserData.split('\n')
                        for(;i<parts.length-1;i++){
                            prevText = text
                            if(parts?.[i]?.startsWith('data: ')){
                                const d = await parseEvent(parts[i].slice(6))
                                if(d === 'overload'){
                                    parserData = ''
                                    prevText = ''
                                    text = ''
                                    reader.cancel()
                                    const res = await fetchNative(replacerURL, {
                                        body: JSON.stringify(body),
                                        headers: headers,
                                        method: "POST",
                                        chatId: arg.chatId
                                    })
                            
                                    if(res.status !== 200){
                                        controller.enqueue({
                                            "0": await textifyReadableStream(res.body)
                                        })
                                        breakWhile = true
                                        break
                                    }

                                    reader = res.body.getReader()
                                    break
                                }
                            }
                        }
                        i--;
                        text = prevText

                        controller.enqueue({
                            "0": text
                        })

                    } catch {
                        await sleep(1)
                    }
                }
                controller.close()
            },
            cancel(){
            }
        })

        return {
            type: 'streaming',
            result: stream
        }

    }

    const db = getDatabase()
    const res = await globalFetch(replacerURL, {
        body: body,
        headers: headers,
        method: "POST",
        chatId: arg.chatId
    })

    if(!res.ok){
        const stringlified = JSON.stringify(res.data)
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLocaleLowerCase()?.includes('overload')
        }
    }
    if(res.data.error){
        const stringlified = JSON.stringify(res.data.error)
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLocaleLowerCase()?.includes('overload')
        }
    }
    const contents = res?.data?.content
    if(!contents || contents.length === 0){
        return {
            type: 'fail',
            result: JSON.stringify(res.data)
        }
    }
    let resText = ''
    let thinking = false

    const hasToolUse = (contents as Claude3ContentBlock[]).some((v) => v.type === 'tool_use')

    if(hasToolUse){

        const messages:Claude3ExtendedChat[] = Array.isArray(body.messages) ? body.messages : []
        const response:Claude3Chat = {
            role: 'user',
            content: []
        }
        
        for(const content of (contents as Claude3ContentBlock[])){
            if(messages[messages.length-1].role !== 'assistant'){
                messages.push({
                    role: 'assistant',
                    content: []
                })
            }
            if(typeof messages[messages.length-1].content === 'string'){
                messages[messages.length-1].content = [{
                    type: 'text',
                    text: messages[messages.length-1].content as string
                }]
            }

            if(content.type === 'tool_use'){
                const used = await callTool(content.name, content.input)
                const r:Claude3ToolResponseBlock = {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: used.map((v) => {
                        switch(v.type){
                            case 'text':{
                                return {
                                    type: 'text',
                                    text: v.text,
                                }
                            }
                            case 'image':{
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: v.mimeType,
                                        data: v.data
                                    }
                                }
                            }
                            default:{
                                return {
                                    type: 'text',
                                    text: `Unsupported tool response type: ${v.type}`
                                }
                            }
                        }
                    })
                }
                response.content.push(r)
                arg.additionalOutput ??= ''
                arg.additionalOutput += await encodeToolCall({
                    call: {
                        id: content.id,
                        name: content.name,
                        arg: content.input
                    },
                    response: used
                })
            }

            (messages[messages.length-1] as Claude3Chat).content.push(content)
        }

        messages.push(response)

        body.messages = messages
        body.stream = false

        return requestClaudeHTTP(replacerURL, headers, body, arg)
    }
    for(const content of contents){
        if(content.type === 'text'){
            if(thinking){
                resText += "</Thoughts>\n\n"
                thinking = false
            }
            resText += content.text
        }
        if(content.type === 'thinking'){
            if(!thinking){
                resText += "<Thoughts>\n"
                thinking = true
            }
            resText += content.thinking ?? ''
        }
        if(content.type === 'redacted_thinking'){
            if(!thinking){
                resText += "<Thoughts>\n"
                thinking = true
            }
            resText += '\n{{redacted_thinking}}\n'
        }
        if(content.type === 'tool_use'){
            // tool_use metadata is intentionally excluded from plain text aggregation
        }
    }


    arg.additionalOutput ??= ""
    if(arg.extractJson && db.jsonSchemaEnabled){
        return {
            type: 'success',
            result: arg.additionalOutput + extractJSON(resText, db.jsonSchema)
        }
    }
    return {
        type: 'success',
        result: arg.additionalOutput + resText
    }
}
