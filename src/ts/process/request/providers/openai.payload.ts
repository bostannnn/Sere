/* eslint-disable @typescript-eslint/no-explicit-any */

import { language } from "src/lang"
import { getFreeOpenRouterModel } from "src/ts/model/openrouter"
import { LLMFlags } from "src/ts/model/modellist"
import { getDatabase } from "src/ts/storage/database.svelte"
import { strongBan, tokenizeNum } from "src/ts/tokenizer"
import { simplifySchema } from "src/ts/util"
import { supportsInlayImage } from "../../files/inlays"
import { decodeToolCall } from "../../mcp/mcp"
import { applyChatTemplate } from "../../templates/chatTemplate"
import { getOpenAIJSONSchema } from "../../templates/jsonSchema"
import {
    applyParameters,
    type OpenAIChatExtra,
    type OpenAIContents,
    type RequestDataArgumentExtended,
    type requestDataResponse,
} from "../request"

type OpenAIRequestPayload = {
    body: Record<string, any>
    headers: Record<string, string>
    replacerURL: string
}

type OpenAIRequestPayloadResult =
    | {
        type: "response"
        response: requestDataResponse
    }
    | ({
        type: "payload"
    } & OpenAIRequestPayload)

export async function buildOpenAIRequestPayload(
    arg: RequestDataArgumentExtended,
    log: (...args: unknown[]) => void = () => {}
): Promise<OpenAIRequestPayloadResult> {
    let formatedChat: OpenAIChatExtra[] = []
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
            type: 'response',
            response: {
                type: 'fail',
                noRetry: true,
                result: `${language.errors.httpError}Provider has been removed: ${aiModel}.`,
            },
        }
    }

    const processToolCalls = async (text: string, originalMessage: any) => {
        const segments = text.split(/(<tool_call>.*?<\/tool_call>)/gms)
        const processedMessages = []
        let currentContent = ''

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i]

            if (segment.match(/<tool_call>(.*?)<\/tool_call>/gms)) {
                const toolCallMatch = segment.match(/<tool_call>(.*?)<\/tool_call>/s)
                if (toolCallMatch) {
                    const call = await decodeToolCall(toolCallMatch[1])
                    if (call) {
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

                        processedMessages.push({
                            role: 'tool',
                            content: call.response.filter(m => m.type === 'text').map(m => m.text).join('\n'),
                            tool_call_id: call.call.id,
                            cachePoint: true
                        })

                        currentContent = ''
                    }
                }
            }
            else {
                currentContent += segment
            }
        }

        if (currentContent.trim()) {
            processedMessages.push({
                ...originalMessage,
                role: 'assistant',
                content: currentContent
            })
        }

        return processedMessages
    }

    for (let i = 0; i < formated.length; i++) {
        const message = formated[i]

        if (message.content && message.content.includes('<tool_call>')) {
            const processedMessages = await processToolCalls(message.content, message)
            formatedChat.push(...processedMessages)
        }
        else if (message.multimodals && message.multimodals.length > 0 && message.role === 'user') {
            const clonedMessage: OpenAIChatExtra = safeStructuredClone(message)
            const contents: OpenAIContents[] = []
            for (let j = 0; j < message.multimodals.length; j++) {
                contents.push({
                    type: "image_url",
                    image_url: {
                        url: message.multimodals[j].base64,
                        detail: db.gptVisionQuality
                    }
                })
            }
            contents.push({
                type: "text",
                text: message.content
            })
            clonedMessage.content = contents
            formatedChat.push(clonedMessage)
        }
        else {
            formatedChat.push(message)
        }
    }

    for (let i = 0; i < formatedChat.length; i++) {
        if (formatedChat[i].role !== 'function') {
            if (!(formatedChat[i].name && formatedChat[i].name.startsWith('example_') && db.newOAIHandle)) {
                formatedChat[i].name = undefined
            }
            if (db.newOAIHandle && formatedChat[i].memo && formatedChat[i].memo.startsWith('NewChat')) {
                formatedChat[i].content = ''
            }
            if (arg.modelInfo.flags.includes(LLMFlags.deepSeekPrefix) && i === formatedChat.length - 1 && formatedChat[i].role === 'assistant') {
                formatedChat[i].prefix = true
            }
            if (arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingInput) && i === formatedChat.length - 1 && formatedChat[i].thoughts && formatedChat[i].thoughts.length > 0 && formatedChat[i].role === 'assistant') {
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

    if (db.newOAIHandle) {
        formatedChat = formatedChat.filter(message => {
            return message.content !== '' || (message.multimodals && message.multimodals.length > 0) || message.tool_calls || message.role === 'tool'
        })
    }

    for (let i = 0; i < arg.biasString.length; i++) {
        const bias = arg.biasString[i]
        if (bias[0].startsWith('[[') && bias[0].endsWith(']]')) {
            const num = parseInt(bias[0].replace('[[', '').replace(']]', ''))
            arg.bias[num] = bias[1]
            continue
        }

        if (bias[1] === -101) {
            arg.bias = await strongBan(bias[0], arg.bias)
            continue
        }
        const tokens = await tokenizeNum(bias[0])

        for (const token of tokens) {
            arg.bias[token] = bias[1]
        }
    }

    const requestModel = aiModel === 'openrouter' ? db.proxyRequestModel : aiModel
    const useSubmodelOpenrouter = arg.mode && arg.mode !== 'model'
    let openrouterRequestModel = useSubmodelOpenrouter
        ? (db.openrouterSubRequestModel || db.openrouterRequestModel)
        : db.openrouterRequestModel

    if (aiModel === 'openrouter' && openrouterRequestModel === 'risu/free') {
        openrouterRequestModel = await getFreeOpenRouterModel()
    }

    if (arg.modelInfo.flags.includes(LLMFlags.DeveloperRole)) {
        formatedChat = formatedChat.map((message) => {
            if (message.role === 'system') {
                message.role = 'developer'
            }
            return message
        })
    }

    log(formatedChat)

    db.cipherChat = false
    let body: Record<string, any> = {
        model: aiModel === 'openrouter' ? openrouterRequestModel :
            requestModel === 'gpt35' ? 'gpt-3.5-turbo'
                : requestModel === 'gpt35_0613' ? 'gpt-3.5-turbo-0613'
                    : requestModel === 'gpt35_16k' ? 'gpt-3.5-turbo-16k'
                        : requestModel === 'gpt35_16k_0613' ? 'gpt-3.5-turbo-16k-0613'
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
    }

    if (Object.keys(body.logit_bias).length === 0) {
        delete body.logit_bias
    }

    if (arg.modelInfo.flags.includes(LLMFlags.OAICompletionTokens)) {
        body.max_completion_tokens = body.max_tokens
        delete body.max_tokens
    }

    if (db.generationSeed > 0) {
        body.seed = db.generationSeed
    }

    if (db.jsonSchemaEnabled || arg.schema) {
        body.response_format = {
            type: "json_schema",
            json_schema: getOpenAIJSONSchema(arg.schema)
        }
    }

    if (db.OAIPrediction) {
        body.prediction = {
            type: "content",
            content: db.OAIPrediction
        }
    }

    if (aiModel === 'openrouter') {
        if (db.openrouterFallback) {
            body.route = "fallback"
        }
        body.transforms = db.openrouterMiddleOut ? ['middle-out'] : []

        if (db.openrouterProvider) {
            const provider: typeof db.openrouterProvider = {} as typeof db.openrouterProvider
            if (db.openrouterProvider.order?.length) {
                provider.order = db.openrouterProvider.order
            }
            if (db.openrouterProvider.only?.length) {
                provider.only = db.openrouterProvider.only
            }
            if (db.openrouterProvider.ignore?.length) {
                provider.ignore = db.openrouterProvider.ignore
            }
            if (Object.keys(provider).length) {
                body.provider = provider
            }
        }

        if (db.useInstructPrompt) {
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

    if (arg.tools && arg.tools.length > 0) {
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

    if (supportsInlayImage()) {
        if (!aiModel.startsWith('gpt')) {
            delete body.logit_bias
        }
    }

    let replacerURL = aiModel === 'openrouter' ? "https://openrouter.ai/api/v1/chat/completions" :
        (arg.customURL) ?? ('https://api.openai.com/v1/chat/completions')

    if (arg.modelInfo?.endpoint) {
        replacerURL = arg.modelInfo.endpoint
    }

    let risuIdentify = false
    if (replacerURL.startsWith("risu::")) {
        risuIdentify = true
        replacerURL = replacerURL.replace("risu::", '')
    }

    const headers = {
        Authorization: "Bearer " + (arg.key ?? (aiModel === 'openrouter' ? db.openrouterKey : db.openAIKey)),
        "Content-Type": "application/json"
    }

    if (arg.modelInfo?.keyIdentifier) {
        headers.Authorization = "Bearer " + db.OaiCompAPIKeys[arg.modelInfo.keyIdentifier]
    }
    if (aiModel === 'openrouter') {
        headers["X-Title"] = 'RisuAI'
        headers["HTTP-Referer"] = 'https://risuai.xyz'
    }
    if (risuIdentify) {
        headers["X-Proxy-Risu"] = 'RisuAI'
    }
    if (arg.multiGen) {
        if (arg.tools && arg.tools.length > 0) {
            return {
                type: 'response',
                response: {
                    type: 'fail',
                    result: 'MultiGen mode cannot be used with tool calls. Please disable one of them.'
                }
            }
        }
        body.n = db.genTime
    }

    return {
        type: 'payload',
        body,
        headers,
        replacerURL,
    }
}
