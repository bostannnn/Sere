import { getDatabase } from "src/ts/storage/database.svelte"
import { replaceAsync, simplifySchema } from "src/ts/util"
import type { MultiModal } from "../../index.svelte"
import { decodeToolCall } from "../../mcp/mcp"
import {
    applyParameters,
    type RequestDataArgumentExtended,
    type requestDataResponse,
} from "../request"
import type {
    AnthropicRequestBody,
    Claude3Chat,
    Claude3ContentBlock,
    Claude3ExtendedChat,
} from "../anthropic"

type AnthropicRequestPayload = {
    body: AnthropicRequestBody
    headers: Record<string, string>
    replacerURL: string
}

type AnthropicRequestPayloadResult =
    | {
        type: "response"
        response: requestDataResponse
    }
    | ({
        type: "payload"
    } & AnthropicRequestPayload)

export async function buildAnthropicRequestPayload(
    arg: RequestDataArgumentExtended,
    log: (...args: unknown[]) => void = () => {}
): Promise<AnthropicRequestPayloadResult> {
    const formated = arg.formated
    const db = getDatabase()
    const useStreaming = arg.useStreaming
    const replacerURL = arg.customURL ?? ('https://api.anthropic.com/v1/messages')
    const apiKey = arg.key || db.claudeAPIKey
    const maxTokens = arg.maxTokens

    const claudeChat: Claude3Chat[] = []
    let systemPrompt = ''

    const addClaudeChat = (chat: {
        role: 'user' | 'assistant'
        content: string
        cache: boolean
    }, multimodals?: MultiModal[]) => {
        if (claudeChat.length > 0 && claudeChat[claudeChat.length - 1].role === chat.role) {
            let content = claudeChat[claudeChat.length - 1].content
            if (multimodals && multimodals.length > 0 && !Array.isArray(content)) {
                content = [{
                    type: 'text',
                    text: content
                }]
            }

            if (Array.isArray(content)) {
                const lastContent = content[content.length - 1]
                if (lastContent?.type === 'text') {
                    lastContent.text += "\n\n" + chat.content
                    content[content.length - 1] = lastContent
                }
                else {
                    content.push({
                        type: 'text',
                        text: chat.content
                    })
                }

                if (multimodals && multimodals.length > 0) {
                    for (const modal of multimodals) {
                        if (modal.type === 'image') {
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
            if (chat.cache) {
                content[content.length - 1].cache_control = {
                    type: 'ephemeral'
                }
            }
            claudeChat[claudeChat.length - 1].content = content
        }
        else {
            const formatedChat: Claude3Chat = {
                role: chat.role,
                content: [{
                    type: 'text',
                    text: chat.content
                }]
            }
            if (multimodals && multimodals.length > 0) {
                formatedChat.content = [{
                    type: 'text',
                    text: chat.content
                }]
                for (const modal of multimodals) {
                    if (modal.type === 'image') {
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
            if (chat.cache) {
                formatedChat.content[0].cache_control = {
                    type: 'ephemeral'
                }
            }
            claudeChat.push(formatedChat)
        }
    }

    for (const chat of formated) {
        switch (chat.role) {
            case 'user': {
                addClaudeChat({
                    role: 'user',
                    content: chat.content,
                    cache: chat.cachePoint
                }, chat.multimodals)
                break
            }
            case 'assistant': {
                addClaudeChat({
                    role: 'assistant',
                    content: chat.content,
                    cache: chat.cachePoint
                }, chat.multimodals)
                break
            }
            case 'system': {
                if (claudeChat.length === 0) {
                    systemPrompt += '\n\n' + chat.content
                }
                else {
                    addClaudeChat({
                        role: 'user',
                        content: "System: " + chat.content,
                        cache: chat.cachePoint
                    })
                }
                break
            }
            case 'function': {
                break
            }
        }
    }

    if (claudeChat.length === 0 && systemPrompt === '') {
        return {
            type: 'response',
            response: {
                type: 'fail',
                result: 'No input'
            }
        }
    }
    if (claudeChat.length === 0 && systemPrompt !== '') {
        claudeChat.push({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        })
        systemPrompt = ''
    }
    if (claudeChat[0].role !== 'user') {
        claudeChat.unshift({
            role: 'user',
            content: [{
                type: 'text',
                text: 'Start'
            }]
        })
    }

    for (let j = 0; j < claudeChat.length; j++) {
        let chat = claudeChat[j]
        for (let i = 0; i < chat.content.length; i++) {
            const content = chat.content[i]
            if (content.type === 'text') {
                content.text = await replaceAsync(content.text, /<tool_call>(.*?)<\/tool_call>/g, async (_match: string, payload: string) => {
                    try {
                        const parsed = await decodeToolCall(payload)
                        if (parsed?.call && parsed?.response) {
                            const toolUse: Claude3ContentBlock = {
                                type: 'tool_use',
                                id: parsed.call.id,
                                name: parsed.call.name,
                                input: parsed.call.arg
                            }
                            const toolResponse: Claude3ContentBlock = {
                                type: 'tool_result',
                                tool_use_id: parsed.call.id,
                                content: parsed.response.map((responsePart) => {
                                    if (responsePart.type === 'text') {
                                        return {
                                            type: 'text',
                                            text: responsePart.text
                                        }
                                    }
                                    if (responsePart.type === 'image') {
                                        return {
                                            type: 'image',
                                            source: {
                                                type: 'base64',
                                                media_type: responsePart.mimeType,
                                                data: responsePart.data
                                            }
                                        }
                                    }
                                    return {
                                        type: 'text',
                                        text: `Unsupported tool response type: ${responsePart.type}`
                                    }
                                })
                            }
                            claudeChat.splice(j, 0, {
                                role: 'assistant',
                                content: [toolUse]
                            })

                            claudeChat.splice(j + 1, 0, {
                                role: 'user',
                                content: [toolResponse]
                            })
                            j += 2
                            chat = claudeChat[j]
                            return ''
                        }
                    }
                    catch {
                    }

                    return ''
                })
            }
        }
    }

    const finalChat: Claude3ExtendedChat[] = claudeChat

    log(arg.modelInfo.parameters)
    const body = applyParameters({
        model: arg.modelInfo.internalID,
        messages: finalChat,
        system: systemPrompt.trim(),
        max_tokens: maxTokens,
        stream: useStreaming ?? false
    }, arg.modelInfo.parameters, {
        thinking_tokens: 'thinking.budget_tokens'
    }, arg.mode) as AnthropicRequestBody

    if (body?.thinking?.budget_tokens === 0) {
        delete body.thinking
    }
    else if (body?.thinking?.budget_tokens && body?.thinking?.budget_tokens > 0) {
        body.thinking.type = 'enabled'
    }
    else if (body?.thinking?.budget_tokens === null) {
        delete body.thinking
    }

    if (systemPrompt === '') {
        delete body.system
    }

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        accept: "application/json",
    }

    const betas: string[] = []

    if (typeof body.max_tokens === 'number' && body.max_tokens > 8192) {
        betas.push('output-128k-2025-02-19')
    }

    if (betas.length > 0) {
        headers['anthropic-beta'] = betas.join(',')
    }

    if (db.usePlainFetch) {
        headers['anthropic-dangerous-direct-browser-access'] = 'true'
    }

    if (arg.tools && arg.tools.length > 0) {
        body.tools = arg.tools.map((tool) => {
            return {
                name: tool.name,
                description: tool.description,
                input_schema: simplifySchema(tool.inputSchema)
            }
        })
    }

    return {
        type: 'payload',
        body,
        headers,
        replacerURL,
    }
}
