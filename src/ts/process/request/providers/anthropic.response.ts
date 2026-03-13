import { fetchNative, globalFetch, textifyReadableStream } from "src/ts/globalApi.svelte"
import { getDatabase } from "src/ts/storage/database.svelte"
import { sleep } from "src/ts/util"
import { callTool, encodeToolCall } from "../../mcp/mcp"
import { extractJSON } from "../../templates/jsonSchema"
import type { RequestDataArgumentExtended, StreamResponseChunk, requestDataResponse } from "../request"
import type {
    AnthropicRequestBody,
    Claude3Chat,
    Claude3ContentBlock,
    Claude3ExtendedChat,
    Claude3ToolResponseBlock,
} from "../anthropic"

export async function requestClaudeHTTP(
    replacerURL: string,
    headers: { [key: string]: string },
    body: AnthropicRequestBody,
    arg: RequestDataArgumentExtended
): Promise<requestDataResponse> {
    if (arg.useStreaming) {
        const res = await fetchNative(replacerURL, {
            body: JSON.stringify(body),
            headers: headers,
            method: "POST",
            chatId: arg.chatId
        })

        if (res.status !== 200) {
            return {
                type: 'fail',
                result: await textifyReadableStream(res.body)
            }
        }
        let thinking = false

        const stream = new ReadableStream<StreamResponseChunk>({
            async start(controller) {
                let text = ''
                let reader = res.body.getReader()
                let parserData = ''
                const decoder = new TextDecoder()
                const db = getDatabase()
                const parseEvent = ((e: string) => {
                    try {
                        const parsedData = JSON.parse(e)

                        if (parsedData?.type === 'content_block_delta') {
                            if (parsedData?.delta?.type === 'text' || parsedData.delta?.type === 'text_delta') {
                                if (thinking) {
                                    text += "</Thoughts>\n\n"
                                    thinking = false
                                }
                                text += parsedData.delta?.text ?? ''
                            }

                            if (parsedData?.delta?.type === 'thinking' || parsedData.delta?.type === 'thinking_delta') {
                                if (!thinking) {
                                    text += "<Thoughts>\n"
                                    thinking = true
                                }
                                text += parsedData.delta?.thinking ?? ''
                            }

                            if (parsedData?.delta?.type === 'redacted_thinking') {
                                if (!thinking) {
                                    text += "<Thoughts>\n"
                                    thinking = true
                                }
                                text += '\n{{redacted_thinking}}\n'
                            }
                        }

                        if (parsedData?.type === 'error') {
                            const errormsg: string = parsedData?.error?.message
                            if (errormsg && errormsg.toLocaleLowerCase().includes('overload') && db.antiServerOverloads) {
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
                let i = 0
                let prevText = ''
                while (true) {
                    try {
                        if (arg?.abortSignal?.aborted || breakWhile) {
                            break
                        }
                        const { done, value } = await reader.read()
                        if (done) {
                            break
                        }
                        parserData += (decoder.decode(value))
                        const parts = parserData.split('\n')
                        for (; i < parts.length - 1; i++) {
                            prevText = text
                            if (parts?.[i]?.startsWith('data: ')) {
                                const d = await parseEvent(parts[i].slice(6))
                                if (d === 'overload') {
                                    parserData = ''
                                    prevText = ''
                                    text = ''
                                    reader.cancel()
                                    const retried = await fetchNative(replacerURL, {
                                        body: JSON.stringify(body),
                                        headers: headers,
                                        method: "POST",
                                        chatId: arg.chatId
                                    })

                                    if (retried.status !== 200) {
                                        controller.enqueue({
                                            "0": await textifyReadableStream(retried.body)
                                        })
                                        breakWhile = true
                                        break
                                    }

                                    reader = retried.body.getReader()
                                    break
                                }
                            }
                        }
                        i--
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
            cancel() {
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

    if (!res.ok) {
        const stringlified = JSON.stringify(res.data)
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLocaleLowerCase()?.includes('overload')
        }
    }
    if (res.data.error) {
        const stringlified = JSON.stringify(res.data.error)
        return {
            type: 'fail',
            result: stringlified,
            failByServerError: stringlified?.toLocaleLowerCase()?.includes('overload')
        }
    }
    const contents = res?.data?.content
    if (!contents || contents.length === 0) {
        return {
            type: 'fail',
            result: JSON.stringify(res.data)
        }
    }
    let resText = ''
    let thinking = false

    const hasToolUse = (contents as Claude3ContentBlock[]).some((v) => v.type === 'tool_use')

    if (hasToolUse) {
        const messages: Claude3ExtendedChat[] = Array.isArray(body.messages) ? body.messages : []
        const response: Claude3Chat = {
            role: 'user',
            content: []
        }

        for (const content of (contents as Claude3ContentBlock[])) {
            if (messages[messages.length - 1].role !== 'assistant') {
                messages.push({
                    role: 'assistant',
                    content: []
                })
            }
            if (typeof messages[messages.length - 1].content === 'string') {
                messages[messages.length - 1].content = [{
                    type: 'text',
                    text: messages[messages.length - 1].content as string
                }]
            }

            if (content.type === 'tool_use') {
                const used = await callTool(content.name, content.input)
                const r: Claude3ToolResponseBlock = {
                    type: 'tool_result',
                    tool_use_id: content.id,
                    content: used.map((v) => {
                        switch (v.type) {
                            case 'text':
                                return {
                                    type: 'text',
                                    text: v.text,
                                }
                            case 'image':
                                return {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: v.mimeType,
                                        data: v.data
                                    }
                                }
                            default:
                                return {
                                    type: 'text',
                                    text: `Unsupported tool response type: ${v.type}`
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

            ;(messages[messages.length - 1] as Claude3Chat).content.push(content)
        }

        messages.push(response)

        body.messages = messages
        body.stream = false

        return requestClaudeHTTP(replacerURL, headers, body, arg)
    }
    for (const content of contents) {
        if (content.type === 'text') {
            if (thinking) {
                resText += "</Thoughts>\n\n"
                thinking = false
            }
            resText += content.text
        }
        if (content.type === 'thinking') {
            if (!thinking) {
                resText += "<Thoughts>\n"
                thinking = true
            }
            resText += content.thinking ?? ''
        }
        if (content.type === 'redacted_thinking') {
            if (!thinking) {
                resText += "<Thoughts>\n"
                thinking = true
            }
            resText += '\n{{redacted_thinking}}\n'
        }
    }

    arg.additionalOutput ??= ""
    if (arg.extractJson && db.jsonSchemaEnabled) {
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
