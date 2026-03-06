/* eslint-disable @typescript-eslint/no-explicit-any */

import { language } from "src/lang"
import { applyParameters, type OpenAIChatExtra, type OpenAIContents, type OpenAIToolCall, type RequestDataArgumentExtended, type requestDataResponse, type StreamResponseChunk } from "./request"
import { getDatabase } from "src/ts/storage/database.svelte"
import { LLMFlags, LLMFormat } from "src/ts/model/modellist"
import { strongBan, tokenizeNum } from "src/ts/tokenizer"
import { getFreeOpenRouterModel } from "src/ts/model/openrouter"
import { addFetchLog, fetchNative, globalFetch, textifyReadableStream } from "src/ts/globalApi.svelte"
import { isNodeServer, isTauri } from "src/ts/platform"
import type { OpenAIChatFull } from "../index.svelte"
import { extractJSON, getOpenAIJSONSchema } from "../templates/jsonSchema"
import { applyChatTemplate } from "../templates/chatTemplate"
import { supportsInlayImage } from "../files/inlays"
import { simplifySchema } from "src/ts/util"
import { callTool, decodeToolCall, encodeToolCall } from "../mcp/mcp"
import { alertError } from "src/ts/alert";
const openAiRequestLog = (..._args: unknown[]) => {};


interface OAIResponseInputItem {
    content:({
        type: 'input_text',
        text: string
    }|{
        detail: 'high'|'low'|'auto'
        type: 'input_image',
        image_url: string
    }|{
        type: 'input_file',
        file_data: string
        filename?: string
    })[]
    role:'user'|'system'|'developer'
}

interface OAIResponseOutputItem {
    content:({
        type: 'output_text',
        text: string,
        annotations: []
    })[]
    type: 'message',
    status: 'in_progress'|'complete'|'incomplete'
    role:'assistant'
}

interface _OAIResponseOutputToolCall {
    arguments: string
    call_id: string
    name: string
    type: 'function_call'
    id: string
    status: 'in_progress'|'complete'|'error'
}

type OpenAIHttpResponse = {
    type?: string
    result?: string | {
        type?: string
        result?: string
        message?: string
        error?: string
        newCharEtag?: string
        [key: string]: unknown
    }
    newCharEtag?: string
    message?: string
    error?: {
        message?: string
        [key: string]: unknown
    }
    details?: {
        status?: number
        body?: {
            error?: {
                message?: string
            }
            message?: string
            [key: string]: unknown
        }
        [key: string]: unknown
    }
    status?: number
    choices?: Array<{
        text?: string
        message: OpenAIChatFull & {
            reasoning_content?: string
            reasoning?: string
            tool_calls?: OpenAIToolCall[]
        }
        reasoning_content?: string
        [key: string]: unknown
    }>
    [key: string]: unknown
}

async function requestServerExecution(
    arg: RequestDataArgumentExtended,
    body: Record<string, any>,
    opts: {
        provider: 'openrouter' | 'openai' | 'deepseek'
        providerLabel: string
        keyMissingCode: string
    }
): Promise<requestDataResponse> {
    const generateProviders = new Set(['openrouter', 'openai', 'deepseek']);
    const rawGenerateProviders = new Set(['openrouter', 'openai', 'deepseek']);
    const requestMode = String(arg.mode ?? 'model');
    const hasServerAssemblyContext = !!(arg.currentChar?.chaId) && !!arg.chatId;
    const canUseGenerateEndpoint = requestMode === 'model';
    const serverExecEndpoint = (canUseGenerateEndpoint && generateProviders.has(opts.provider) && hasServerAssemblyContext)
        ? '/data/llm/generate'
        : '/data/llm/execute';
    const parseErrorPayload = (parsed: any, statusFallback: number) => {
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

    const db = getDatabase();
    const charRagSettings = arg.currentChar?.ragSettings;
    const globalRagSettings = db.globalRagSettings;
    const requestBodyForServer = (typeof structuredClone === 'function')
        ? structuredClone(body)
        : JSON.parse(JSON.stringify(body));
    requestBodyForServer.stream = !!arg.useStreaming;
    const latestUserMessage = [...(arg.formated || [])]
        .reverse()
        .find((m: any) => m?.role === 'user' && typeof m?.content === 'string' && m.content.trim().length > 0)
        ?.content?.trim() || '';
    const hasMultimodal = (arg.formated || []).some((m: any) => Array.isArray(m?.multimodals) && m.multimodals.length > 0);
    const hasNonStringMessage = Array.isArray(requestBodyForServer.messages)
        && requestBodyForServer.messages.some((m: any) => typeof m?.content !== 'string');
    const hasPromptOnly = typeof requestBodyForServer.prompt === 'string'
        && (!Array.isArray(requestBodyForServer.messages) || requestBodyForServer.messages.length === 0);
    const compactRequestBodyForGenerate = (() => {
        const compact = (typeof structuredClone === 'function')
            ? structuredClone(requestBodyForServer)
            : JSON.parse(JSON.stringify(requestBodyForServer));
        delete compact.messages;
        delete compact.prompt;
        delete compact.stream;
        return compact;
    })();
    const canUseRawGeneratePayload =
        serverExecEndpoint === '/data/llm/generate'
        && rawGenerateProviders.has(opts.provider)
        && !arg.previewBody
        && !!(arg.currentChar?.chaId)
        && !!arg.chatId
        && !!latestUserMessage
        && !hasMultimodal
        && !hasNonStringMessage
        && !hasPromptOnly;
    const requestModelId = typeof requestBodyForServer.model === 'string'
        ? requestBodyForServer.model.trim().toLowerCase()
        : '';
    const allowReasoningOnlyForDeepSeekV32Speciale =
        opts.provider === 'openrouter'
        && requestModelId === 'deepseek/deepseek-v3.2-speciale'
        && db.openrouterAllowReasoningOnlyForDeepSeekV32Speciale === true;

    const payload = canUseRawGeneratePayload
        ? {
            mode: arg.mode ?? 'model',
            provider: opts.provider,
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            allowReasoningOnlyForDeepSeekV32Speciale,
            userMessage: latestUserMessage,
            model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
            maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                : undefined,
            request: {
                requestBody: compactRequestBodyForGenerate,
                model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                    ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
            },
            ragSettings: charRagSettings ? {
                enabled: charRagSettings.enabled === true,
                enabledRulebooks: Array.isArray(charRagSettings.enabledRulebooks) ? charRagSettings.enabledRulebooks : [],
            } : undefined,
            globalRagSettings: globalRagSettings ? {
                topK: globalRagSettings.topK,
                minScore: globalRagSettings.minScore,
                budget: globalRagSettings.budget,
                model: globalRagSettings.model,
            } : undefined,
        }
        : {
            mode: arg.mode ?? 'model',
            provider: opts.provider,
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            allowReasoningOnlyForDeepSeekV32Speciale,
            ragSettings: charRagSettings ? {
                enabled: charRagSettings.enabled === true,
                enabledRulebooks: Array.isArray(charRagSettings.enabledRulebooks) ? charRagSettings.enabledRulebooks : [],
            } : undefined,
            globalRagSettings: globalRagSettings ? {
                topK: globalRagSettings.topK,
                minScore: globalRagSettings.minScore,
                budget: globalRagSettings.budget,
                model: globalRagSettings.model,
            } : undefined,
            request: {
                requestBody: requestBodyForServer,
                messages: Array.isArray(requestBodyForServer.messages) ? requestBodyForServer.messages : undefined,
                prompt: typeof requestBodyForServer.prompt === 'string' ? requestBodyForServer.prompt : undefined,
                model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                    ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
            },
        };

    const requestModel = typeof body?.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : '(unset)';
    const requestContext = `mode=${requestMode}, model=${requestModel}`;

    if (arg.previewBody) {
        try {
            const previewRes = await globalFetch('/data/llm/preview', {
                method: 'POST',
                body: payload,
                abortSignal: arg.abortSignal,
                chatId: arg.chatId,
            });
            const parsedRaw = previewRes.data;
            const parsed = (parsedRaw && typeof parsedRaw === 'object'
                ? parsedRaw
                : { result: parsedRaw }) as OpenAIHttpResponse;
            addFetchLog({
                body: payload,
                response: parsedRaw,
                success: previewRes.ok,
                url: '/data/llm/preview',
                status: previewRes.status,
                chatId: arg.chatId,
            });
            if (!previewRes.ok) {
                return {
                    type: 'fail',
                    result: language.errors.httpError + `${JSON.stringify(parsed)}`
                };
            }
            return {
                type: 'success',
                result: JSON.stringify(parsed, null, 2),
            };
        } catch (error) {
            return {
                type: 'fail',
                result: language.errors.httpError + `${error}`,
            };
        }
    }

    if (arg.useStreaming) {
        try {
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
                response: "Streaming (Server)",
                success: true,
                url: serverExecEndpoint,
                status: res.status,
                chatId: arg.chatId,
            });

            const transtream = getTranStream(arg);
            res.body.pipeTo(transtream.writable);

            return {
                type: 'streaming',
                result: wrapToolStream(transtream.readable, body, { 'content-type': 'application/json' }, serverExecEndpoint, arg)
            };
        } catch (error) {
            return {
                type: 'fail',
                result: language.errors.httpError + `${error}`,
            };
        }
    }

    try {
        const serverRes = await globalFetch(serverExecEndpoint, {
            method: 'POST',
            body: payload,
            abortSignal: arg.abortSignal,
            chatId: arg.chatId,
        });
        const parsedRaw = serverRes.data;
        const parsed = (parsedRaw && typeof parsedRaw === 'object'
            ? parsedRaw
            : { result: parsedRaw }) as OpenAIHttpResponse;

        addFetchLog({
            body: payload,
            response: parsedRaw,
            success: serverRes.ok,
            url: serverExecEndpoint,
            status: serverRes.status,
            chatId: arg.chatId,
        });

        if (!serverRes.ok) {
            const err = parseErrorPayload(parsed, serverRes.status);
            if (err.code === opts.keyMissingCode) {
                return {
                    type: 'fail',
                    noRetry: true,
                    result: `${language.errors.httpError}${opts.providerLabel} key is missing in server settings. [${requestContext}]`,
                };
            }
            if (err.status === 429) {
                return {
                    type: 'fail',
                    // Avoid hammering upstream with automatic retries on rate limit.
                    noRetry: true,
                    result: `${language.errors.httpError}${opts.providerLabel} rate limit (429): ${err.message} [${requestContext}]`,
                };
            }
            return {
                type: 'fail',
                failByServerError: err.status >= 500,
                result: `${language.errors.httpError}${err.message} [${requestContext}]`,
            };
        }

        if (parsed?.type === 'success') {
            if (typeof parsed?.result === 'string') {
                return {
                    type: 'success',
                    result: parsed.result,
                    newCharEtag: parsed.newCharEtag,
                };
            }
            const nestedResult = (parsed?.result && typeof parsed.result === 'object')
                ? parsed.result
                : null;
            if (nestedResult?.type === 'success' && typeof nestedResult?.result === 'string') {
                return {
                    type: 'success',
                    result: nestedResult.result,
                    newCharEtag: parsed.newCharEtag || nestedResult.newCharEtag,
                };
            }
        }

        if (parsed?.type === 'fail') {
            return {
                type: 'fail',
                result: `${parsed?.message || parsed?.result || parsed?.error || 'Server execution failed'} [${requestContext}]`,
            };
        }

        const failNestedResult = (parsed?.result && typeof parsed.result === 'object')
            ? parsed.result
            : null;
        if (failNestedResult?.type === 'fail') {
            return {
                type: 'fail',
                result: `${failNestedResult?.message || failNestedResult?.result || failNestedResult?.error || 'Server execution failed'} [${requestContext}]`,
            };
        }

        return {
            type: 'fail',
            result: language.errors.httpError + `${JSON.stringify(parsed)}`,
        };
    } catch (error) {
        return {
            type: 'fail',
            result: language.errors.httpError + `${error}`,
        };
    }
}

async function requestOpenRouterServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    return await requestServerExecution(arg, body, {
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        keyMissingCode: 'OPENROUTER_KEY_MISSING',
    });
}

async function requestOpenAIServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    return await requestServerExecution(arg, body, {
        provider: 'openai',
        providerLabel: 'OpenAI',
        keyMissingCode: 'OPENAI_KEY_MISSING',
    });
}

async function requestDeepSeekServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    return await requestServerExecution(arg, body, {
        provider: 'deepseek',
        providerLabel: 'DeepSeek',
        keyMissingCode: 'DEEPSEEK_KEY_MISSING',
    });
}

export async function requestOpenAI(arg:RequestDataArgumentExtended):Promise<requestDataResponse>{
    let formatedChat:OpenAIChatExtra[] = []
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel

    if (
        aiModel?.startsWith('mistral') ||
        aiModel === 'open-mistral-nemo' ||
        aiModel === 'reverse_proxy' ||
        aiModel?.startsWith('xcustom:::')
    ) {
        return {
            type: 'fail',
            noRetry: true,
            result: `${language.errors.httpError}Provider has been removed: ${aiModel}.`,
        }
    }

    const processToolCalls = async (text:string, originalMessage:any) => {
        // Split text by tool_call tags and process each segment
        const segments = text.split(/(<tool_call>.*?<\/tool_call>)/gms)
        const processedMessages = []
        
        let currentContent = ''
        
        for(let i = 0; i < segments.length; i++) {
            const segment = segments[i]
            
            if(segment.match(/<tool_call>(.*?)<\/tool_call>/gms)) {
                // This is a tool call segment
                const toolCallMatch = segment.match(/<tool_call>(.*?)<\/tool_call>/s)
                if(toolCallMatch) {
                    const call = await decodeToolCall(toolCallMatch[1])
                    if(call) {
                        // Create assistant message with accumulated content and this tool call
                        processedMessages.push({
                            ...originalMessage,
                            role: 'assistant',
                            content: currentContent,
                            tool_calls: [{
                                id: call.call.id,
                                type: 'function',
                                function: {
                                    name: call.call.name,
                                    arguments: call.call.arg
                                }
                            }]
                        })

                        // Add tool response
                        processedMessages.push({
                            role: 'tool',
                            content: call.response.filter(m => m.type === 'text').map(m => m.text).join('\n'),
                            tool_call_id: call.call.id,
                            cachePoint: true
                        })

                        // Reset content for next segment
                        currentContent = ''
                    }
                }
            } else {
                // This is regular text content - accumulate it
                currentContent += segment
            }
        }
        
        // If there's remaining content without tool calls, add it as a regular message
        if(currentContent.trim()) {
            processedMessages.push({
                ...originalMessage,
                role: 'assistant',
                content: currentContent
            })
        }
        
        return processedMessages
    }
      for(let i=0;i<formated.length;i++){
        const m = formated[i]
        
        // Check if message contains tool calls
        if(m.content && m.content.includes('<tool_call>')) {
            const processedMessages = await processToolCalls(m.content, m)
            formatedChat.push(...processedMessages)
        }
        else if(m.multimodals && m.multimodals.length > 0 && m.role === 'user'){
            const v:OpenAIChatExtra = safeStructuredClone(m)
            const contents:OpenAIContents[] = []
            for(let j=0;j<m.multimodals.length;j++){
                contents.push({
                    "type": "image_url",
                    "image_url": {
                        "url": m.multimodals[j].base64,
                        "detail": db.gptVisionQuality
                    }
                })
            }
            contents.push({
                "type": "text",
                "text": m.content
            })
            v.content = contents
            formatedChat.push(v)
        }
        else{
            formatedChat.push(m)
        }
    }
    
    for(let i=0;i<formatedChat.length;i++){
        if(formatedChat[i].role !== 'function'){
            if(!(formatedChat[i].name && formatedChat[i].name.startsWith('example_') && db.newOAIHandle)){
                formatedChat[i].name = undefined
            }
            if(db.newOAIHandle && formatedChat[i].memo && formatedChat[i].memo.startsWith('NewChat')){
                formatedChat[i].content = ''
            }
            if(arg.modelInfo.flags.includes(LLMFlags.deepSeekPrefix) && i === formatedChat.length-1 && formatedChat[i].role === 'assistant'){
                formatedChat[i].prefix = true
            }
            if(arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingInput) && i === formatedChat.length-1 && formatedChat[i].thoughts && formatedChat[i].thoughts.length > 0 && formatedChat[i].role === 'assistant'){
                formatedChat[i].reasoning_content = formatedChat[i].thoughts.join('\n')
            }
            delete formatedChat[i].memo
            delete formatedChat[i].removable
            delete formatedChat[i].attr
            delete formatedChat[i].multimodals
            delete formatedChat[i].thoughts
            delete formatedChat[i].cachePoint
        }
    }


    if(db.newOAIHandle){
        formatedChat = formatedChat.filter(m => {
            return m.content !== '' || (m.multimodals && m.multimodals.length > 0) || m.tool_calls || m.role === 'tool'
        })
    }

    for(let i=0;i<arg.biasString.length;i++){
        const bia = arg.biasString[i]
        if(bia[0].startsWith('[[') && bia[0].endsWith(']]')){
            const num = parseInt(bia[0].replace('[[', '').replace(']]', ''))
            arg.bias[num] = bia[1]
            continue
        }

        if(bia[1] === -101){
            arg.bias = await strongBan(bia[0], arg.bias)
            continue
        }
        const tokens = await tokenizeNum(bia[0])

        for(const token of tokens){
            arg.bias[token] = bia[1]

        }
    }


    const requestModel = aiModel === 'openrouter' ? db.proxyRequestModel : aiModel
    const useSubmodelOpenrouter = arg.mode && arg.mode !== 'model'
    let openrouterRequestModel = useSubmodelOpenrouter
        ? (db.openrouterSubRequestModel || db.openrouterRequestModel)
        : db.openrouterRequestModel

    if(aiModel === 'openrouter' && openrouterRequestModel === 'risu/free'){
        openrouterRequestModel = await getFreeOpenRouterModel()
    }

    if(arg.modelInfo.flags.includes(LLMFlags.DeveloperRole)){
        formatedChat = formatedChat.map((v) => {
            if(v.role === 'system'){
                v.role = 'developer'
            }
            return v
        })
    }

    openAiRequestLog(formatedChat)

    db.cipherChat = false
    let body:{
        [key:string]:any
    } = ({
        model: aiModel === 'openrouter' ? openrouterRequestModel :
            requestModel ===  'gpt35' ? 'gpt-3.5-turbo'
            : requestModel ===  'gpt35_0613' ? 'gpt-3.5-turbo-0613'
            : requestModel ===  'gpt35_16k' ? 'gpt-3.5-turbo-16k'
            : requestModel ===  'gpt35_16k_0613' ? 'gpt-3.5-turbo-16k-0613'
            : requestModel === 'gpt4' ? 'gpt-4'
            : requestModel === 'gpt45' ? 'gpt-4.5-preview'
            : requestModel === 'gpt4_32k' ? 'gpt-4-32k'
            : requestModel === "gpt4_0613" ? 'gpt-4-0613'
            : requestModel === "gpt4_32k_0613" ? 'gpt-4-32k-0613'
            : requestModel === "gpt4_1106" ? 'gpt-4-1106-preview'
            : requestModel === 'gpt4_0125' ? 'gpt-4-0125-preview'
            : requestModel === "gptvi4_1106" ? 'gpt-4-vision-preview'
            : requestModel === "gpt35_0125" ? 'gpt-3.5-turbo-0125'
            : requestModel === "gpt35_1106" ? 'gpt-3.5-turbo-1106'
            : requestModel === 'gpt35_0301' ? 'gpt-3.5-turbo-0301'
            : requestModel === 'gpt4_0314' ? 'gpt-4-0314'
            : requestModel === 'gpt4_turbo_20240409' ? 'gpt-4-turbo-2024-04-09'
            : requestModel === 'gpt4_turbo' ? 'gpt-4-turbo'
            : requestModel === 'gpt4o' ? 'gpt-4o'
            : requestModel === 'gpt4o-2024-05-13' ? 'gpt-4o-2024-05-13'
            : requestModel === 'gpt4om' ? 'gpt-4o-mini'
            : requestModel === 'gpt4om-2024-07-18' ? 'gpt-4o-mini-2024-07-18'
            : requestModel === 'gpt4o-2024-08-06' ? 'gpt-4o-2024-08-06'
            : requestModel === 'gpt4o-2024-11-20' ? 'gpt-4o-2024-11-20'
            : requestModel === 'gpt4o-chatgpt' ? 'chatgpt-4o-latest'
            : requestModel === 'gpt4o1-preview' ? 'o1-preview'
            : requestModel === 'gpt4o1-mini' ? 'o1-mini'
            : arg.modelInfo.internalID ? arg.modelInfo.internalID
            : (!requestModel) ? 'gpt-3.5-turbo'
            : requestModel,
        messages: formatedChat,
        max_tokens: arg.maxTokens,
        logit_bias: arg.bias,
        stream: false,

    })


    if(Object.keys(body.logit_bias).length === 0){
        delete body.logit_bias
    }

    if(arg.modelInfo.flags.includes(LLMFlags.OAICompletionTokens)){
        body.max_completion_tokens = body.max_tokens
        delete body.max_tokens
    }

    if(db.generationSeed > 0){
        body.seed = db.generationSeed
    }

    if(db.jsonSchemaEnabled || arg.schema){
        body.response_format = {
            "type": "json_schema",
            "json_schema": getOpenAIJSONSchema(arg.schema)
        }
    }

    if(db.OAIPrediction){
        body.prediction = {
            type: "content",
            content: db.OAIPrediction
        }
    }

    if(aiModel === 'openrouter'){
        if(db.openrouterFallback){
            body.route = "fallback"
        }
        body.transforms = db.openrouterMiddleOut ? ['middle-out'] : []

        if(db.openrouterProvider){
            const provider: typeof db.openrouterProvider = {} as typeof db.openrouterProvider;
            if (db.openrouterProvider.order?.length) {
                provider.order = db.openrouterProvider.order;
            }
            if (db.openrouterProvider.only?.length) {
                provider.only = db.openrouterProvider.only;
            }
            if (db.openrouterProvider.ignore?.length) {
                provider.ignore = db.openrouterProvider.ignore;
            }
            if (Object.keys(provider).length) {
                body.provider = provider;
            }
        }

        if(db.useInstructPrompt){
            delete body.messages
            const prompt = applyChatTemplate(formated)
            body.prompt = prompt
        }
    }

    body = applyParameters(
        body,
        arg.modelInfo.parameters,
        {},
        arg.mode
    )

    if(arg.tools && arg.tools.length > 0){
        body.tools = arg.tools.map(tool => {
            return {
                type: 'function',
                function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: simplifySchema(tool.inputSchema),
                }
            }
        })
    }

    if(supportsInlayImage()){
        // inlay models doesn't support logit_bias
        // OpenAI's gpt based llm model supports both logit_bias and inlay image
        if(!aiModel.startsWith('gpt')){
            delete body.logit_bias
        }
    }

    let replacerURL = aiModel === 'openrouter' ? "https://openrouter.ai/api/v1/chat/completions" :
        (arg.customURL) ?? ('https://api.openai.com/v1/chat/completions')

    if(arg.modelInfo?.endpoint){
        replacerURL = arg.modelInfo.endpoint
    }

    let risuIdentify = false
    if(replacerURL.startsWith("risu::")){
        risuIdentify = true
        replacerURL = replacerURL.replace("risu::", '')
    }

    const headers = {
        "Authorization": "Bearer " + (arg.key ?? (aiModel === 'openrouter' ? db.openrouterKey : db.openAIKey)),
        "Content-Type": "application/json"
    }

    if(arg.modelInfo?.keyIdentifier){
        headers["Authorization"] = "Bearer " + db.OaiCompAPIKeys[arg.modelInfo.keyIdentifier]
    }
    if(aiModel === 'openrouter'){
        headers["X-Title"] = 'RisuAI'
        headers["HTTP-Referer"] = 'https://risuai.xyz'
    }
    if(risuIdentify){
        headers["X-Proxy-Risu"] = 'RisuAI'
    }
    if(arg.multiGen){
        // Check if tools are enabled - multiGen with tools is not supported
        if(arg.tools && arg.tools.length > 0){
            return {
                type: 'fail',
                result: 'MultiGen mode cannot be used with tool calls. Please disable one of them.'
            }
        }
        body.n = db.genTime
    }

    const isNodeServerOpenAIPath =
        isNodeServer &&
        arg.modelInfo.format === LLMFormat.OpenAICompatible &&
        aiModel !== 'openrouter' &&
        !aiModel.startsWith('deepseek');

    if (isNodeServer && aiModel === 'openrouter') {
        return await requestOpenRouterServerExecution(arg, body)
    }
    if (isNodeServerOpenAIPath) {
        return await requestOpenAIServerExecution(arg, body)
    }
    if (isNodeServer && aiModel.startsWith('deepseek')) {
        return await requestDeepSeekServerExecution(arg, body)
    }
    if (isNodeServer && (aiModel === 'reverse_proxy' || aiModel.startsWith('xcustom:::'))) {
        return {
            type: 'fail',
            noRetry: true,
            result: `${language.errors.httpError}Provider has been removed: ${aiModel}.`,
        }
    }

    if(arg.useStreaming){
        body.stream = true
        const urlHost = new URL(replacerURL).host
        if(urlHost.includes("localhost") || urlHost.includes("172.0.0.1") || urlHost.includes("0.0.0.0")){
            if(!isTauri){
                return {
                    type: 'fail',
                    result: 'You are trying local request on streaming. this is not allowed dude to browser/os security policy. turn off streaming.',
                }
            }
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
        const da = await fetchNative(replacerURL, {
            body: JSON.stringify(body),
            method: "POST",
            headers: headers,
            signal: arg.abortSignal,
            chatId: arg.chatId
        })

        if(da.status !== 200){
            return {
                type: "fail",
                result: await textifyReadableStream(da.body)
            }
        }

        if (!da.headers.get('Content-Type').includes('text/event-stream')){
            return {
                type: "fail",
                result: await textifyReadableStream(da.body)
            }
        }

        addFetchLog({
            body: body,
            response: "Streaming",
            success: true,
            url: replacerURL,
            status: da.status,
        })

        const transtream = getTranStream(arg)

        da.body.pipeTo(transtream.writable)

        return {
            type: 'streaming',
            result: wrapToolStream(transtream.readable, body, headers, replacerURL, arg)
        }
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

    return requestHTTPOpenAI(replacerURL, body, headers, arg)

}

export async function requestHTTPOpenAI(replacerURL:string, body:any, headers:Record<string,string>, arg:RequestDataArgumentExtended):Promise<requestDataResponse>{
    
    const db = getDatabase()
    const res = await globalFetch(replacerURL, {
        body: body,
        headers: headers,
        abortSignal: arg.abortSignal,
        chatId: arg.chatId
    })

    function processTextResponse(dat: any):string{
        if(dat?.choices[0]?.text){
            const text = dat.choices[0].text as string
            if(arg.extractJson && (db.jsonSchemaEnabled || arg.schema)){
                try {
                    const parsed = JSON.parse(text)
                    const extracted = extractJSON(parsed, arg.extractJson)
                    return extracted
                } catch (error) {
                    openAiRequestLog(error)
                    return text
                }
            }
            return text
        }
        if(arg.extractJson && (db.jsonSchemaEnabled || arg.schema)){
            return extractJSON(dat.choices[0].message.content, arg.extractJson)
        }
        const msg:OpenAIChatFull = (dat.choices[0].message)
        let result = msg.content
        if(arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingOutput)){
            openAiRequestLog("Checking for reasoning content")
            let reasoningContent = ""
            result = result.replace(/(.*)<\/think>/gms, (m, p1) => {
                reasoningContent = p1
                return ""
            })
            openAiRequestLog(`Reasoning Content: ${reasoningContent}`)
            if(reasoningContent){
                reasoningContent = reasoningContent.replace(/<think>/gms, '')
                result = `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${result}`
            }
        }
        // For deepseek Official Reasoning Model: https://api-docs.deepseek.com/guides/thinking_mode#api-example
        const reasoningContentField = dat?.choices[0]?.reasoning_content ?? dat?.choices[0]?.message?.reasoning_content
        if(reasoningContentField){
            result = `<Thoughts>\n${reasoningContentField}\n</Thoughts>\n${result}`
        }
        // For openrouter, https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request#response.body.choices.message.reasoning
        if(dat?.choices?.[0]?.message?.reasoning){
            result = `<Thoughts>\n${dat.choices[0].message.reasoning}\n</Thoughts>\n${result}`
        }

        return result
    }

    const dat = (res.data && typeof res.data === 'object')
        ? (res.data as OpenAIHttpResponse)
        : ({} as OpenAIHttpResponse)

    if(res.ok){
        try {
            // Collect all tool_calls from all choices
            let allToolCalls: OpenAIToolCall[] = []
            if(dat.choices) {
                for(const choice of dat.choices) {
                    if(choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
                        allToolCalls = allToolCalls.concat(choice.message.tool_calls)
                    }
                }
            }
            
            // Replace choices[0].message.tool_calls with all collected tool calls
            if(dat.choices?.[0]?.message && allToolCalls.length > 0) {
                dat.choices[0].message.tool_calls = allToolCalls
            }

            if(dat.choices?.[0]?.message?.tool_calls && dat.choices[0].message.tool_calls.length > 0){
                const toolCalls = dat.choices[0].message.tool_calls as OpenAIToolCall[]

                const messages = body.messages as OpenAIChatExtra[]
                
                messages.push(dat.choices[0].message)
                
                const callCodes: string[] = []

                for(const toolCall of toolCalls){
                    if(!toolCall.function || !toolCall.function.name || toolCall.function.arguments === undefined || toolCall.function.arguments === null){
                        continue
                    }
                    try {
                        const functionArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {}
                        if(arg.tools && arg.tools.length > 0){
                            const tool = arg.tools.find(t => t.name === toolCall.function.name)
                            if(!tool){
                                messages.push({
                                    role:'tool',
                                    content: 'No tool found with name: ' + toolCall.function.name,
                                    tool_call_id: toolCall.id
                                })
                            }
                            else{
                                const parsed = functionArgs
                                const x = (await callTool(tool.name, parsed)).filter(m => m.type === 'text')
                                if(x.length > 0){
                                    messages.push({
                                        role: 'tool',
                                        content: x[0].text,
                                        tool_call_id: toolCall.id
                                    })
                                    callCodes.push(await encodeToolCall({
                                        call: {
                                            id: toolCall.id,
                                            name: toolCall.function.name,
                                            arg: toolCall.function.arguments
                                        },
                                        response: x
                                    }))
                                }
                                else{
                                    messages.push({
                                        role: 'tool',
                                        content: 'Tool call failed with no text response',
                                        tool_call_id: toolCall.id
                                    })
                                }
                            }
                        }
                    } catch (error) {
                        messages.push({
                            role: 'tool',
                            content: 'Tool call failed with error: ' + error,
                            tool_call_id: toolCall.id
                        })
                    }
                }                
                
                body.messages = messages

                // Send the next request recursively
                let resRec
                let attempt = 0
                
                do {
                    attempt++
                    resRec = await requestHTTPOpenAI(replacerURL, body, headers, arg)
                    
                    if (resRec.type != 'fail') {
                        break
                    }
                } while (attempt <= db.requestRetrys) // Retry up to db.requestRetrys times

                const callCode = callCodes.join('\n\n')

                const result = (processTextResponse(dat) ?? '') + '\n\n' + callCode
                        
                if(resRec.type === 'fail') {
                    alertError(`Failed to fetch model response after tool execution`)
                    return {
                        type: 'success',
                        result: result
                    }
                } else if(resRec.type === 'success') {
                    return {
                        type: 'success',
                        result: result + '\n\n' + resRec.result
                    }
                }
                        
                return resRec
            }
                    
            if(arg.multiGen && dat.choices){
                if(arg.extractJson && (db.jsonSchemaEnabled || arg.schema)){
                    
                    const c = dat.choices.map((v:{message:{content:string}}) => {
                        const extracted = String(extractJSON(v.message.content, arg.extractJson))
                        return ["char", extracted] as ["char", string]
                    }) as Array<["char", string]>
                    
                    return {
                        type: 'multiline',
                        result: c
                    }
                }
                return {
                    type: 'multiline',
                    result: dat.choices.map((v) => {
                        return ["char", v.message.content]
                    })
                }
            }            
                    
            const result = processTextResponse(dat) ?? ''
            
            return {
                type: 'success',
                result: result
            }
            
        } catch {                    
            return {
                type: 'fail',
                result: (language.errors.httpError + `${JSON.stringify(dat)}`)
            }
        }
    }
    
    if(dat.error && dat.error.message){                    
        return {
            type: 'fail',
            result: (language.errors.httpError + `${dat.error.message}`)
        }
    }

    return {
        type: 'fail',
        result: (language.errors.httpError + `${JSON.stringify(res.data)}`)
    }
}

export async function requestOpenAILegacyInstruct(arg:RequestDataArgumentExtended):Promise<requestDataResponse>{
    const formated = arg.formated
    const db = getDatabase()
    const maxTokens = arg.maxTokens
    const temperature = arg.temperature
    const prompt = formated.filter(m => m.content?.trim()).map(m => {
        let author = '';

        if(m.role == 'system'){
            m.content = m.content.trim();
        }

        openAiRequestLog(m.role +":"+m.content);
        switch (m.role) {
            case 'user': author = 'User'; break;
            case 'assistant': author = 'Assistant'; break;
            case 'system': author = 'Instruction'; break;
            default: author = m.role; break;
        }

        return `\n## ${author}\n${m.content.trim()}`;
        //return `\n\n${author}: ${m.content.trim()}`;
    }).join("") + `\n## Response\n`;

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                error: "This model is not supported in preview mode"
            })
        }
    }

    const response = await globalFetch(arg.customURL ?? "https://api.openai.com/v1/completions", {
        body: {
            model: "gpt-3.5-turbo-instruct",
            prompt: prompt,
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: 1,
            stop:["User:"," User:", "user:", " user:"],
            presence_penalty: arg.PresensePenalty || (db.PresensePenalty / 100),
            frequency_penalty: arg.frequencyPenalty || (db.frequencyPenalty / 100),
        },
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + (arg.key ?? db.openAIKey)
        },
        chatId: arg.chatId,
        abortSignal: arg.abortSignal
    });

    if(!response.ok){
        return {
            type: 'fail',
            result: (language.errors.httpError + `${JSON.stringify(response.data)}`)
        }
    }
    const text:string = response.data.choices[0].text
    return {
        type: 'success',
        result: text.replace(/##\n/g, '')
    }
    
}


type OAIResponseItem = OAIResponseInputItem|OAIResponseOutputItem


export async function requestOpenAIResponseAPI(arg:RequestDataArgumentExtended):Promise<requestDataResponse>{

    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const maxTokens = arg.maxTokens

    const items:OAIResponseItem[] = []

    for(let i=0;i<formated.length;i++){
        const content = formated[i]
        switch(content.role){
            case 'function':
                break
            case 'assistant':{
                const item:OAIResponseOutputItem = {
                    content: [],
                    role: content.role,
                    status: 'complete',
                    type: 'message',
                }

                item.content.push({
                    type: 'output_text',
                    text: content.content,
                    annotations: []
                })

                items.push(item)
                break
            }
            case 'user':
            case 'system':{
                const item:OAIResponseInputItem = {
                    content: [],
                    role: content.role
                }

                item.content.push({
                    type: 'input_text',
                    text: content.content
                })

                content.multimodals ??= []
                for(const multimodal of content.multimodals){
                    if(multimodal.type === 'image'){
                        item.content.push({
                            type: 'input_image',
                            detail: 'auto',
                            image_url: multimodal.base64
                        })
                    }
                    else{
                        item.content.push({
                            type: 'input_file',
                            file_data: multimodal.base64,
                        })
                    }
                }

                items.push(item)
                break
            }
        }
    }

    if(items[items.length-1].role === 'assistant'){
        (items[items.length-1] as OAIResponseOutputItem).status = 'incomplete'
    }
    
    const body = applyParameters({
        model: arg.modelInfo.internalID ?? aiModel,
        input: items,
        max_output_tokens: maxTokens,
        tools: [],
        store: false
    }, ['temperature', 'top_p'], {}, arg.mode)

    let requestURL = arg.customURL ?? "https://api.openai.com/v1/responses"
    if(arg.modelInfo?.endpoint){
        requestURL = arg.modelInfo.endpoint
    }

    let risuIdentify = false
    if(requestURL.startsWith("risu::")){
        risuIdentify = true
        requestURL = requestURL.replace("risu::", '')
    }

    const headers = {
        "Authorization": "Bearer " + (arg.key ?? db.openAIKey),
        "Content-Type": "application/json"
    }

    if(risuIdentify){
        headers["X-Proxy-Risu"] = 'RisuAI'
    }

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: requestURL,
                body: body,
                headers: headers
            })
        }
    }

    if(db.modelTools.includes('search')){
        const tools = (body as { tools?: unknown }).tools
        if (Array.isArray(tools)) {
            tools.push('web_search_preview')
        }
    }

    const response = await globalFetch(requestURL, {
        body: body,
        headers: headers,
        chatId: arg.chatId,
        abortSignal: arg.abortSignal
    });

    if(!response.ok){
        return {
            type: 'fail',
            result: (language.errors.httpError + `${JSON.stringify(response.data)}`)
        }
    }

    const result: string = (response.data.output?.find((m:OAIResponseOutputItem) => m.type === 'message') as OAIResponseOutputItem)?.content?.find(m => m.type === 'output_text')?.text

    if(!result){
        return {
            type: 'fail',
            result: JSON.stringify(response.data)
        }
    }
    return {
        type: 'success',
        result: result
    }
}

function getTranStream(arg:RequestDataArgumentExtended):TransformStream<Uint8Array, StreamResponseChunk> {
    let dataUint:Uint8Array|Buffer = new Uint8Array([])
    let reasoningContent = ""
    const db = getDatabase()

    return new TransformStream<Uint8Array, StreamResponseChunk>({
        transform(chunk, control) {
            dataUint = Buffer.from(new Uint8Array([...dataUint, ...chunk]))
            const JSONreaded:{[key:string]:string} = {}
            try {
                const datas = dataUint.toString().split('\n')
                const readed:{[key:string]:string} = {}
                for(const data of datas){
                    if(data.startsWith("data: ")){
                        try {
                            const rawChunk = data.replace("data: ", "").trim()
                            if(rawChunk === "[DONE]"){
                                // This block handles non-server [DONE]
                                if(arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingOutput)){
                                    readed["0"] = readed["0"].replace(/(.*)<\/think>/gms, (m, p1) => {
                                        reasoningContent = p1
                                        return ""
                                    })
                                    if(reasoningContent){
                                        reasoningContent = reasoningContent.replace(/<think>/gm, '')
                                    }
                                }                
                                if(arg.extractJson && (db.jsonSchemaEnabled || arg.schema)){
                                    for(const key in readed){
                                        const extracted = extractJSON(readed[key], arg.extractJson)
                                        JSONreaded[key] = extracted
                                    }
                                    control.enqueue(JSONreaded)
                                }
                                else if(reasoningContent){
                                    control.enqueue({
                                        "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"]}`
                                    })
                                }
                                else {
                                    control.enqueue(readed)
                                }
                                return
                            }

                            // Handle our custom Server SSE format
                            if (isNodeServer) {
                                try {
                                    const parsed = JSON.parse(rawChunk);
                                    if (parsed.type === 'chunk') {
                                        if(!readed["0"]) readed["0"] = "";
                                        readed["0"] += (parsed.text || "");
                                        continue;
                                    } else if (parsed.type === 'fail' || parsed.type === 'error') {
                                        const errorMessage = typeof parsed.message === 'string' && parsed.message.trim()
                                            ? parsed.message.trim()
                                            : (typeof parsed.error === 'string' && parsed.error.trim()
                                                ? parsed.error.trim()
                                                : 'Server execution failed');
                                        readed["__error"] = errorMessage;
                                        if (typeof parsed.error === 'string' && parsed.error.trim()) {
                                            readed["__errorCode"] = parsed.error.trim();
                                        }
                                        if (typeof parsed.code === 'string' && parsed.code.trim()) {
                                            readed["__errorCode"] = parsed.code.trim();
                                        }
                                        if (Number.isFinite(Number(parsed.status))) {
                                            readed["__status"] = String(Number(parsed.status));
                                        }
                                        control.enqueue(readed);
                                        return;
                                    } else if (parsed.type === 'done') {
                                        if (parsed.newCharEtag) {
                                            readed["__newCharEtag"] = parsed.newCharEtag;
                                        }
                                        control.enqueue(readed);
                                        return;
                                    }
                                } catch {}
                            }

                            const choices = JSON.parse(rawChunk).choices
                            for(const choice of choices){
                                const chunk = choice.delta.content ?? choices.text
                                if(chunk){
                                    if(arg.multiGen){
                                        const ind = choice.index.toString()
                                        if(!readed[ind]){
                                            readed[ind] = ""
                                        }
                                        readed[ind] += chunk
                                    }
                                    else{
                                        if(!readed["0"]){
                                            readed["0"] = ""
                                        }
                                        readed["0"] += chunk
                                    }
                                }
                                // Check for tool calls in the delta
                                if(choice?.delta?.tool_calls){
                                    if(!readed["__tool_calls"]){
                                        readed["__tool_calls"] = JSON.stringify({})
                                    }
                                    const toolCallsData = JSON.parse(readed["__tool_calls"])
                                    
                                    for(const toolCall of choice.delta.tool_calls) {
                                        const index = toolCall.index ?? 0
                                        const toolCallId = toolCall.id
                                        
                                        // Initialize tool call data if not exists
                                        if(!toolCallsData[index]) {
                                            toolCallsData[index] = {
                                                id: toolCallId || null,
                                                type: 'function',
                                                function: {
                                                    name: null,
                                                    arguments: ''
                                                }
                                            }
                                        }
                                        
                                        // Update tool call data incrementally
                                        if(toolCall.id) {
                                            toolCallsData[index].id = toolCall.id
                                        }
                                        if(toolCall.function?.name) {
                                            toolCallsData[index].function.name = toolCall.function.name
                                        }
                                        if(toolCall.function?.arguments) {
                                            toolCallsData[index].function.arguments += toolCall.function.arguments
                                        }
                                    }
                                    
                                    readed["__tool_calls"] = JSON.stringify(toolCallsData)
                                }
                                if(choice?.delta?.reasoning_content){
                                    reasoningContent += choice.delta.reasoning_content
                                }
                            }
                        } catch {}
                    }
                }
                
                if(arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingOutput)){
                    readed["0"] = readed["0"].replace(/(.*)<\/think>/gms, (m, p1) => {
                        reasoningContent = p1
                        return ""
                    })

                    if(reasoningContent){
                        reasoningContent = reasoningContent.replace(/<think>/gm, '')
                    }
                }
                if(arg.extractJson && (db.jsonSchemaEnabled || arg.schema)){
                    for(const key in readed){
                        const extracted = extractJSON(readed[key], arg.extractJson)
                        JSONreaded[key] = extracted
                    }
                    control.enqueue(JSONreaded)
                }
                else if(reasoningContent){
                    control.enqueue({
                        "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"]}`
                    })
                }
                else {
                    control.enqueue(readed)
                }
            } catch {
                
            }
        }        
    })
}

function wrapToolStream(
    stream: ReadableStream<StreamResponseChunk>,
    body:any,
    headers:Record<string,string>,
    replacerURL:string,
    arg:RequestDataArgumentExtended
):ReadableStream<StreamResponseChunk> {
    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {

            const db = getDatabase()
            let reader = stream.getReader()
            let prefix = ''
            let lastValue

            while(true){
                const readResult = await reader.read()
                const { done } = readResult
                let { value } = readResult

                let content = value?.['0'] || ''
                const metaEntries = Object.entries(value ?? {}).filter(([key, val]) => key.startsWith('__') && typeof val === 'string') as [string, string][]
                const hasErrorMeta = metaEntries.some(([key]) => key === '__error')
                if(done){
                    value = lastValue ?? {'0': ''}
                    content = value?.['0'] || ''
                    const doneMetaEntries = Object.entries(value ?? {}).filter(([key, val]) => key.startsWith('__') && typeof val === 'string') as [string, string][]
                    const doneHasErrorMeta = doneMetaEntries.some(([key]) => key === '__error')
                    if (doneHasErrorMeta) {
                        const failedOut: StreamResponseChunk = {};
                        for (const [metaKey, metaValue] of doneMetaEntries) {
                            failedOut[metaKey] = metaValue;
                        }
                        controller.enqueue(failedOut);
                        return controller.close();
                    }
                    
                    const toolCalls = Object.values(JSON.parse(value?.['__tool_calls'] || '{}') || {}) as OpenAIToolCall[]; 
                    if(toolCalls && toolCalls.length > 0){
                        const messages = body.messages as OpenAIChatExtra[]

                        messages.push({
                            role: 'assistant',
                            content: content,
                            tool_calls: toolCalls.map(call => ({
                                id: call.id,
                                type: 'function',
                                function: {
                                    name: call.function.name,
                                    arguments: call.function.arguments
                                }
                            }))
                        })

                        const callCodes: string[] = []
                    
                        for(const toolCall of toolCalls){
                            if(!toolCall.function || !toolCall.function.name || !toolCall.function.arguments){
                                continue
                            }
                            try {
                                const functionArgs = JSON.parse(toolCall.function.arguments)
                                if(arg.tools && arg.tools.length > 0){
                                    const tool = arg.tools.find(t => t.name === toolCall.function.name)
                                    if(!tool){
                                        messages.push({
                                            role:'tool',
                                            content: 'No tool found with name: ' + toolCall.function.name,
                                            tool_call_id: toolCall.id
                                        })
                                    }
                                    else{
                                        const parsed = functionArgs
                                        const x = (await callTool(tool.name, parsed)).filter(m => m.type === 'text')
                                        if(x.length > 0){
                                            messages.push({
                                                role: 'tool',
                                                content: x[0].text,
                                                tool_call_id: toolCall.id
                                            })
                                            callCodes.push(await encodeToolCall({
                                                call: {
                                                    id: toolCall.id,
                                                    name: toolCall.function.name,
                                                    arg: toolCall.function.arguments
                                                },
                                                response: x
                                            }))
                                        }
                                        else{
                                            messages.push({
                                                role: 'tool',
                                                content: 'Tool call failed with no text response',
                                                tool_call_id: toolCall.id
                                            })
                                        }
                                    }
                                }
                            } catch (error) {
                                messages.push({
                                    role: 'tool',
                                    content: 'Tool call failed with error: ' + error,
                                    tool_call_id: toolCall.id
                                })
                            }
                        }    
                        
                        body.messages = messages
                        
                        let resRec
                        let attempt = 0
                        let errorFlag = true
                        
                        do {
                            attempt++
                            resRec = await fetchNative(replacerURL, {
                                body: JSON.stringify(body),
                                method: "POST",
                                headers: headers,
                                signal: arg.abortSignal,
                                chatId: arg.chatId
                            })
                            
                            if(resRec.status == 200 && resRec.headers.get('Content-Type').includes('text/event-stream')) {
                                addFetchLog({
                                    body: body,
                                    response: "Streaming",
                                    success: true,
                                    url: replacerURL,
                                    status: resRec.status,
                                })

                                errorFlag = false
                                break
                            }     
                        } while (attempt <= db.requestRetrys) // Retry up to db.requestRetrys times
                        
                        if(errorFlag){
                            alertError(`Failed to fetch model response after tool execution`)
                            return controller.close()
                        }
                        
                        const transtream = getTranStream(arg)                    
                        resRec.body.pipeTo(transtream.writable)
                        
                        reader = transtream.readable.getReader()
                        
                        prefix += (content ? content + '\n\n' : '') + callCodes.join('\n\n')
                        controller.enqueue({"0": prefix})

                        continue
                    }
                    return controller.close()
                }

                if (hasErrorMeta) {
                    const failedOut: StreamResponseChunk = {};
                    for (const [metaKey, metaValue] of metaEntries) {
                        failedOut[metaKey] = metaValue;
                    }
                    controller.enqueue(failedOut);
                    return controller.close();
                }
                
                lastValue = value

                const outChunk: StreamResponseChunk = {}
                for (const [metaKey, metaValue] of metaEntries) {
                    outChunk[metaKey] = metaValue
                }
                outChunk["0"] = (prefix ? prefix + '\n\n' : '') + content
                controller.enqueue(outChunk)
            }
        }
    })
}
