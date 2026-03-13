/* eslint-disable @typescript-eslint/no-explicit-any */

import { language } from "src/lang"
import { globalFetch } from "src/ts/globalApi.svelte"
import { LLMFlags } from "src/ts/model/modellist"
import { getDatabase } from "src/ts/storage/database.svelte"
import { alertError } from "src/ts/alert"
import type { OpenAIChatFull } from "../../index.svelte"
import { callTool, encodeToolCall } from "../../mcp/mcp"
import { extractJSON } from "../../templates/jsonSchema"
import type {
    OpenAIChatExtra,
    OpenAIToolCall,
    RequestDataArgumentExtended,
    requestDataResponse,
} from "../request"
import type { OpenAIHttpResponse } from "../openAI"

export async function requestHTTPOpenAI(
    replacerURL: string,
    body: any,
    headers: Record<string, string>,
    arg: RequestDataArgumentExtended
): Promise<requestDataResponse> {
    const db = getDatabase()
    const res = await globalFetch(replacerURL, {
        body: body,
        headers: headers,
        abortSignal: arg.abortSignal,
        chatId: arg.chatId
    })

    function processTextResponse(dat: any): string {
        if (dat?.choices[0]?.text) {
            const text = dat.choices[0].text as string
            if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
                try {
                    const parsed = JSON.parse(text)
                    const extracted = extractJSON(parsed, arg.extractJson)
                    return extracted
                } catch {
                    return text
                }
            }
            return text
        }
        if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
            return extractJSON(dat.choices[0].message.content, arg.extractJson)
        }
        const msg: OpenAIChatFull = (dat.choices[0].message)
        let result = msg.content
        if (arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingOutput)) {
            let reasoningContent = ""
            result = result.replace(/(.*)<\/think>/gms, (m: string, p1: string) => {
                reasoningContent = p1
                return ""
            })
            if (reasoningContent) {
                reasoningContent = reasoningContent.replace(/<think>/gms, '')
                result = `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${result}`
            }
        }
        const reasoningContentField = dat?.choices[0]?.reasoning_content ?? dat?.choices[0]?.message?.reasoning_content
        if (reasoningContentField) {
            result = `<Thoughts>\n${reasoningContentField}\n</Thoughts>\n${result}`
        }
        if (dat?.choices?.[0]?.message?.reasoning) {
            result = `<Thoughts>\n${dat.choices[0].message.reasoning}\n</Thoughts>\n${result}`
        }

        return result
    }

    const dat = (res.data && typeof res.data === 'object')
        ? (res.data as OpenAIHttpResponse)
        : ({} as OpenAIHttpResponse)

    if (res.ok) {
        try {
            let allToolCalls: OpenAIToolCall[] = []
            if (dat.choices) {
                for (const choice of dat.choices) {
                    if (choice.message?.tool_calls && choice.message.tool_calls.length > 0) {
                        allToolCalls = allToolCalls.concat(choice.message.tool_calls)
                    }
                }
            }

            if (dat.choices?.[0]?.message && allToolCalls.length > 0) {
                dat.choices[0].message.tool_calls = allToolCalls
            }

            if (dat.choices?.[0]?.message?.tool_calls && dat.choices[0].message.tool_calls.length > 0) {
                const toolCalls = dat.choices[0].message.tool_calls as OpenAIToolCall[]
                const messages = body.messages as OpenAIChatExtra[]
                messages.push(dat.choices[0].message)

                const callCodes: string[] = []

                for (const toolCall of toolCalls) {
                    if (!toolCall.function || !toolCall.function.name || toolCall.function.arguments === undefined || toolCall.function.arguments === null) {
                        continue
                    }
                    try {
                        const functionArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {}
                        if (arg.tools && arg.tools.length > 0) {
                            const tool = arg.tools.find(t => t.name === toolCall.function.name)
                            if (!tool) {
                                messages.push({
                                    role: 'tool',
                                    content: 'No tool found with name: ' + toolCall.function.name,
                                    tool_call_id: toolCall.id
                                })
                            }
                            else {
                                const x = (await callTool(tool.name, functionArgs)).filter(m => m.type === 'text')
                                if (x.length > 0) {
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
                                else {
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
                do {
                    attempt++
                    resRec = await requestHTTPOpenAI(replacerURL, body, headers, arg)
                    if (resRec.type != 'fail') {
                        break
                    }
                } while (attempt <= db.requestRetrys)

                const callCode = callCodes.join('\n\n')
                const result = (processTextResponse(dat) ?? '') + '\n\n' + callCode

                if (resRec.type === 'fail') {
                    alertError(`Failed to fetch model response after tool execution`)
                    return {
                        type: 'success',
                        result: result
                    }
                } else if (resRec.type === 'success') {
                    return {
                        type: 'success',
                        result: result + '\n\n' + resRec.result
                    }
                }

                return resRec
            }

            if (arg.multiGen && dat.choices) {
                if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
                    const c = dat.choices.map((v: { message: { content: string } }) => {
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

    if (dat.error && dat.error.message) {
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
