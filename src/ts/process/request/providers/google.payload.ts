/* eslint-disable @typescript-eslint/no-explicit-any */

import { LLMFlags, LLMFormat } from "src/ts/model/modellist"
import { getDatabase } from "src/ts/storage/database.svelte"
import { simplifySchema } from "src/ts/util"
import { decodeToolCall } from "../../mcp/mcp"
import { getGeneralJSONSchema } from "../../templates/jsonSchema"
import { applyParameters, type Parameter, type RequestDataArgumentExtended } from "../request"
import type { GeminiChat, GeminiPart } from "../google"

type GoogleRequestPayload = {
    body: Record<string, any>
    headers: Record<string, string>
    url: string
}

export async function buildGoogleBaseRequestPayload(
    arg: RequestDataArgumentExtended,
    log: (...args: unknown[]) => void = () => {}
): Promise<Pick<GoogleRequestPayload, "body">> {
    const formated = arg.formated
    const maxTokens = arg.maxTokens

    const reformatedChat: GeminiChat[] = []
    let systemPrompt = ''

    if (formated[0].role === 'system') {
        systemPrompt = formated[0].content
        formated.shift()
    }

    for (let i = 0; i < formated.length; i++) {
        const chat = formated[i]
        const prevChat = reformatedChat[reformatedChat.length - 1]
        if (chat.multimodals && chat.multimodals.length > 0) {
            const geminiParts: GeminiPart[] = []

            geminiParts.push({
                text: chat.content,
            })

            for (const modal of chat.multimodals) {
                if (
                    (modal.type === "image" && arg.modelInfo.flags.includes(LLMFlags.hasImageInput)) ||
                    (modal.type === "audio" && arg.modelInfo.flags.includes(LLMFlags.hasAudioInput)) ||
                    (modal.type === "video" && arg.modelInfo.flags.includes(LLMFlags.hasVideoInput))
                ) {
                    const dataurl = modal.base64
                    const base64 = dataurl.split(",")[1]
                    const mediaType = dataurl.split(";")[0].split(":")[1]

                    geminiParts.push({
                        inlineData: {
                            mimeType: mediaType,
                            data: base64,
                        }
                    })
                }
            }

            reformatedChat.push({
                role: chat.role === 'user' ? 'user' : 'model',
                parts: geminiParts,
            })
        }
        else if (chat.role === 'system') {
            if (prevChat?.role === 'user') {
                reformatedChat[reformatedChat.length - 1].parts[0].text += '\nsystem:' + chat.content
            }
            else {
                reformatedChat.push({
                    role: "user",
                    parts: [{
                        text: chat.role + ':' + chat.content
                    }]
                })
            }
        }
        else if (chat.role === 'assistant' || chat.role === 'user') {
            reformatedChat.push({
                role: chat.role === 'user' ? 'user' : 'model',
                parts: [{
                    text: chat.content
                }]
            })
        }
        else {
            reformatedChat.push({
                role: "user",
                parts: [{
                    text: chat.role + ':' + chat.content
                }]
            })
        }
    }

    for (let i = 0; i < reformatedChat.length; i++) {
        const chat = reformatedChat[i]
        for (let j = 0; j < chat.parts.length; j++) {
            const part = chat.parts[j]
            if (part.text && part.text.includes('<tool_call>')) {
                const toolCallMatches = [...part.text.matchAll(/<tool_call>(.*?)<\/tool_call>/g)]
                if (toolCallMatches.length > 0) {
                    const segments = []
                    let lastIndex = 0

                    for (let k = 0; k < toolCallMatches.length; k++) {
                        const match = toolCallMatches[k]
                        if (match.index > lastIndex) {
                            segments.push({
                                type: 'text',
                                content: part.text.substring(lastIndex, match.index).trim(),
                                role: chat.role
                            })
                        }

                        const call = await decodeToolCall(match[1])
                        if (call) {
                            const tool = arg?.tools?.find((toolEntry) => toolEntry.name === call.call.name)
                            if (tool) {
                                segments.push({
                                    type: 'functionCall',
                                    call: call,
                                    tool: tool
                                })
                            }
                        }

                        lastIndex = match.index + match[0].length
                    }
                    if (lastIndex < part.text.length) {
                        segments.push({
                            type: 'text',
                            content: part.text.substring(lastIndex).trim(),
                            role: chat.role
                        })
                    }
                    if (segments.length > 0 && segments[0].type === 'text') {
                        part.text = segments[0].content.trim() ? segments[0].content : ''
                        segments.shift()
                    }
                    else {
                        part.text = ''
                    }

                    const shouldRemoveCurrentPart = !part.text.trim()
                    let insertIndex = i + 1

                    for (const segment of segments) {
                        if (segment.type === 'text') {
                            if (segment.content.trim()) {
                                reformatedChat.splice(insertIndex, 0, {
                                    role: segment.role,
                                    parts: [{
                                        text: segment.content
                                    }]
                                })
                                insertIndex++
                            }
                        }
                        else if (segment.type === 'functionCall') {
                            reformatedChat.splice(insertIndex, 0, {
                                role: 'model',
                                parts: [{
                                    functionCall: {
                                        name: segment.call.call.name,
                                        args: segment.call.call.arg
                                    }
                                }]
                            })
                            insertIndex++

                            reformatedChat.splice(insertIndex, 0, {
                                role: 'function',
                                parts: [{
                                    functionResponse: {
                                        name: segment.call.call.name,
                                        response: {
                                            data: segment.call.response.filter((responsePart) => {
                                                return responsePart.type === 'text'
                                            }).map((responsePart) => {
                                                return responsePart.text
                                            })
                                        }
                                    }
                                }]
                            })
                            insertIndex++
                        }
                    }

                    if (shouldRemoveCurrentPart) {
                        reformatedChat.splice(i, 1)
                        i = insertIndex - 2
                    }
                    else {
                        i = insertIndex - 1
                    }
                }
            }
        }
    }

    for (let i = reformatedChat.length - 1; i >= 1; i--) {
        const currentChat = reformatedChat[i]
        const prevChat = reformatedChat[i - 1]

        if (currentChat.role === prevChat.role) {
            const prevLastPart = prevChat.parts[prevChat.parts.length - 1]
            const currentFirstPart = currentChat.parts[0]

            if (prevLastPart.text && currentFirstPart.text) {
                prevLastPart.text += '\n\n' + currentFirstPart.text
                prevChat.parts.push(...currentChat.parts.slice(1))
            }
            else {
                prevChat.parts.push(...currentChat.parts)
            }

            reformatedChat.splice(i, 1)
        }
    }

    const uncensoredCatagory = [
        {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
        },
        {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_NONE"
        },
        {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
        },
        {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
        },
        {
            category: "HARM_CATEGORY_CIVIC_INTEGRITY",
            threshold: "BLOCK_NONE"
        }
    ]

    if (arg.modelInfo.flags.includes(LLMFlags.noCivilIntegrity)) {
        uncensoredCatagory.splice(4, 1)
    }

    if (arg.modelInfo.flags.includes(LLMFlags.geminiBlockOff)) {
        for (let i = 0; i < uncensoredCatagory.length; i++) {
            uncensoredCatagory[i].threshold = "OFF"
        }
    }

    let para: Parameter[] = ['temperature', 'top_p', 'top_k', 'presence_penalty', 'frequency_penalty']

    if (arg.modelInfo.flags.includes(LLMFlags.geminiThinking)) {
        para.push('thinking_tokens')
    }

    para = para.filter((parameter) => {
        return arg.modelInfo.parameters.includes(parameter)
    })

    const body: Record<string, any> = {
        contents: reformatedChat,
        generation_config: applyParameters({
            maxOutputTokens: maxTokens
        }, para, {
            top_p: "topP",
            top_k: "topK",
            presence_penalty: "presencePenalty",
            frequency_penalty: "frequencyPenalty",
            thinking_tokens: "thinkingBudget"
        }, arg.mode, {
            ignoreTopKIfZero: true
        }),
        safetySettings: uncensoredCatagory,
        systemInstruction: {
            parts: [
                {
                    text: systemPrompt
                }
            ]
        },
        tools: {
            functionDeclarations: arg?.tools?.map((tool, i) => {
                log(tool.name, i)
                return {
                    name: tool.name,
                    description: tool.description,
                    parameters: simplifySchema(tool.inputSchema)
                }
            }) ?? []
        }
    }

    if (arg.modelInfo.flags.includes(LLMFlags.geminiThinking)) {
        const internalId = arg.modelInfo.internalID
        const thinkingBudget = body.generation_config.thinkingBudget

        if (internalId && /^gemini-3-/.test(internalId)) {
            const budgetNum = typeof thinkingBudget === 'number' ? thinkingBudget : Number(thinkingBudget)

            let thinkingLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH'
            if (internalId === 'gemini-3-flash-preview') {
                if (!Number.isFinite(budgetNum) || budgetNum >= 16384) thinkingLevel = 'HIGH'
                else if (budgetNum >= 4096) thinkingLevel = 'MEDIUM'
                else thinkingLevel = 'LOW'
            }
            else {
                if (!Number.isFinite(budgetNum) || budgetNum >= 8192) thinkingLevel = 'HIGH'
                else thinkingLevel = 'LOW'
            }

            body.generation_config.thinkingConfig = {
                thinkingLevel,
                includeThoughts: true,
            }
        }
        else {
            body.generation_config.thinkingConfig = {
                thinkingBudget,
                includeThoughts: true,
            }
        }

        delete body.generation_config.thinkingBudget
    }

    if (systemPrompt === '') {
        delete body.systemInstruction
    }

    return { body }
}

export function finalizeGoogleRequestPayload(
    arg: RequestDataArgumentExtended,
    body: Record<string, any>,
    log: (...args: unknown[]) => void = () => {}
): Omit<GoogleRequestPayload, "body"> {
    const db = getDatabase()
    const headers: Record<string, string> = {}

    if (arg.modelInfo.flags.includes(LLMFlags.hasAudioOutput)) {
        body.generation_config.responseModalities = [
            'TEXT', 'AUDIO'
        ]
        arg.useStreaming = false
    }
    if (arg.imageResponse || arg.modelInfo.flags.includes(LLMFlags.hasImageOutput)) {
        body.generation_config.responseModalities = [
            'TEXT', 'IMAGE'
        ]
        arg.useStreaming = false
    }

    if (db.gptVisionQuality === 'high') {
        body.generation_config.mediaResolution = "MEDIA_RESOLUTION_MEDIUM"
    }

    log(arg.modelInfo)

    if (db.jsonSchemaEnabled || arg.schema) {
        body.generation_config.response_mime_type = "application/json"
        body.generation_config.response_schema = getGeneralJSONSchema(arg.schema, ['$schema', 'additionalProperties'])
        log(body.generation_config.response_schema)
    }

    let url = ''
    const apiKey = arg.key || db.google.accessToken

    if (arg.customURL) {
        let baseURL = arg.customURL
        if (!baseURL.endsWith('/')) {
            baseURL += '/'
        }
        const endpoint = arg.useStreaming ? 'streamGenerateContent' : 'generateContent'
        const urlObject = new URL(`models/${arg.modelInfo.internalID}:${endpoint}`, baseURL)
        urlObject.searchParams.set('key', apiKey)
        if (arg.useStreaming) {
            urlObject.searchParams.set('alt', 'sse')
        }
        url = urlObject.toString()
    }
    else if (arg.modelInfo.format === LLMFormat.GoogleCloud && arg.useStreaming) {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${arg.modelInfo.internalID}:streamGenerateContent?key=${apiKey}&alt=sse`
    }
    else {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${arg.modelInfo.internalID}:generateContent?key=${apiKey}`
    }

    if (body.tools?.functionDeclarations?.length === 0) {
        body.tools = undefined
    }

    return {
        headers,
        url,
    }
}
