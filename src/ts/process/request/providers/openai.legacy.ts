import { language } from "src/lang"
import { globalFetch } from "src/ts/globalApi.svelte"
import { getDatabase } from "src/ts/storage/database.svelte"
import { applyParameters, type RequestDataArgumentExtended, type requestDataResponse } from "../request"

interface OAIResponseInputItem {
    content: ({
        type: 'input_text',
        text: string
    } | {
        detail: 'high' | 'low' | 'auto'
        type: 'input_image',
        image_url: string
    } | {
        type: 'input_file',
        file_data: string
        filename?: string
    })[]
    role: 'user' | 'system' | 'developer'
}

interface OAIResponseOutputItem {
    content: ({
        type: 'output_text',
        text: string,
        annotations: []
    })[]
    type: 'message',
    status: 'in_progress' | 'complete' | 'incomplete'
    role: 'assistant'
}

type OAIResponseItem = OAIResponseInputItem | OAIResponseOutputItem

export async function requestOpenAILegacyInstruct(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const maxTokens = arg.maxTokens
    const temperature = arg.temperature
    const prompt = formated.filter(m => m.content?.trim()).map(m => {
        let author = '';

        if (m.role == 'system') {
            m.content = m.content.trim();
        }

        switch (m.role) {
            case 'user': author = 'User'; break;
            case 'assistant': author = 'Assistant'; break;
            case 'system': author = 'Instruction'; break;
            default: author = m.role; break;
        }

        return `\n## ${author}\n${m.content.trim()}`;
    }).join("") + `\n## Response\n`;

    if (arg.previewBody) {
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
            stop: ["User:", " User:", "user:", " user:"],
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

    if (!response.ok) {
        return {
            type: 'fail',
            result: (language.errors.httpError + `${JSON.stringify(response.data)}`)
        }
    }
    const text: string = response.data.choices[0].text
    return {
        type: 'success',
        result: text.replace(/##\n/g, '')
    }
}

export async function requestOpenAIResponseAPI(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const maxTokens = arg.maxTokens

    const items: OAIResponseItem[] = []

    for (let i = 0; i < formated.length; i++) {
        const content = formated[i]
        switch (content.role) {
            case 'function':
                break
            case 'assistant': {
                const item: OAIResponseOutputItem = {
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
            case 'system': {
                const item: OAIResponseInputItem = {
                    content: [],
                    role: content.role
                }

                item.content.push({
                    type: 'input_text',
                    text: content.content
                })

                content.multimodals ??= []
                for (const multimodal of content.multimodals) {
                    if (multimodal.type === 'image') {
                        item.content.push({
                            type: 'input_image',
                            detail: 'auto',
                            image_url: multimodal.base64
                        })
                    }
                    else {
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

    if (items[items.length - 1].role === 'assistant') {
        (items[items.length - 1] as OAIResponseOutputItem).status = 'incomplete'
    }

    const body = applyParameters({
        model: arg.modelInfo.internalID ?? aiModel,
        input: items,
        max_output_tokens: maxTokens,
        tools: [],
        store: false
    }, ['temperature', 'top_p'], {}, arg.mode)

    let requestURL = arg.customURL ?? "https://api.openai.com/v1/responses"
    if (arg.modelInfo?.endpoint) {
        requestURL = arg.modelInfo.endpoint
    }

    let risuIdentify = false
    if (requestURL.startsWith("risu::")) {
        risuIdentify = true
        requestURL = requestURL.replace("risu::", '')
    }

    const headers = {
        "Authorization": "Bearer " + (arg.key ?? db.openAIKey),
        "Content-Type": "application/json"
    } as Record<string, string>

    if (risuIdentify) {
        headers["X-Proxy-Risu"] = 'RisuAI'
    }

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                url: requestURL,
                body: body,
                headers: headers
            })
        }
    }

    if (db.modelTools.includes('search')) {
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

    if (!response.ok) {
        return {
            type: 'fail',
            result: (language.errors.httpError + `${JSON.stringify(response.data)}`)
        }
    }

    const result: string = (response.data.output?.find((m: OAIResponseOutputItem) => m.type === 'message') as OAIResponseOutputItem)?.content?.find(m => m.type === 'output_text')?.text

    if (!result) {
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
