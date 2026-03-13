/* eslint-disable @typescript-eslint/no-explicit-any */

import { addFetchLog, fetchNative } from "src/ts/globalApi.svelte"
import { getDatabase } from "src/ts/storage/database.svelte"
import { alertError } from "src/ts/alert"
import { callTool, encodeToolCall } from "../../mcp/mcp"
import { extractJSON } from "../../templates/jsonSchema"
import type { RequestDataArgumentExtended, StreamResponseChunk } from "../request"
import type { GeminiChat, GeminiFunctionCall, GeminiPart } from "../google"

function initStreamState(state?: { [key: string]: string }): { [key: string]: string } {
    if (!state) {
        return {
            "__sign_text": "",
            "__sign_function": "",
            "__last_thought": "",
            "__thoughts": "",
            "__tool_calls": "[]",
            "0": ""
        }
    }
    state["__sign_text"] = state["__sign_text"] || ""
    state["__sign_function"] = state["__sign_function"] || ""
    state["__last_thought"] = state["__last_thought"] || ""
    state["__thoughts"] = state["__thoughts"] || ""
    state["__tool_calls"] = state["__tool_calls"] || "[]"
    state["0"] = state["0"] || ""
    return state
}

export function getTranStream(): TransformStream<Uint8Array, StreamResponseChunk> {
    let buffer = ''

    return new TransformStream<Uint8Array, StreamResponseChunk>({
        transform(chunk, control) {
            buffer += new TextDecoder().decode(chunk)
            const lines = buffer.split('\n')
            const readed = initStreamState()

            try {
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.slice(6).trim()
                        if (dataStr === '[DONE]') return

                        const jsonData = JSON.parse(dataStr)

                        if (jsonData.candidates?.[0]?.content?.parts) {
                            const parts = jsonData.candidates[0].content.parts
                            for (const part of parts) {
                                if (part.text) {
                                    readed["__thoughts"] += readed["__last_thought"]
                                    readed["__last_thought"] = ""
                                    if (part.thought) {
                                        readed["__last_thought"] = part.text
                                    }
                                    else {
                                        readed["0"] += part.text
                                    }
                                    if (part.thoughtSignature) {
                                        readed["__sign_text"] = part.thoughtSignature
                                    }
                                }
                                if (part.functionCall) {
                                    const toolCallsData = JSON.parse(readed["__tool_calls"])
                                    toolCallsData.push(part.functionCall)
                                    readed["__tool_calls"] = JSON.stringify(toolCallsData)
                                    if (part.thoughtSignature) {
                                        readed["__sign_function"] = part.thoughtSignature
                                    }
                                }
                            }
                        }
                    }
                }
                control.enqueue(readed)
            } catch {
            }
        }
    })
}

export function wrapToolStream(
    stream: ReadableStream<StreamResponseChunk>,
    body: any,
    headers: Record<string, string>,
    url: string,
    arg: RequestDataArgumentExtended
): ReadableStream<StreamResponseChunk> {
    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            const db = getDatabase()
            let reader = stream.getReader()
            let prefix = ''
            let lastValue = initStreamState()

            while (true) {
                const readResult = await reader.read()
                const { done } = readResult
                let { value } = readResult

                value = initStreamState(value)

                if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
                    value["0"] = extractJSON(value["0"], arg.extractJson)
                }

                let content = value["0"]
                let thoughts = value["__thoughts"]
                let lastThought = value["__last_thought"]

                if (done) {
                    value = initStreamState(lastValue)

                    content = value["0"]
                    thoughts = value["__thoughts"]
                    lastThought = value["__last_thought"]
                    const signText = value["__sign_text"]
                    const signFunction = value["__sign_function"]

                    const calls = JSON.parse(value["__tool_calls"]) as GeminiFunctionCall[]
                    if (calls && calls.length > 0) {
                        const chat = body.contents as GeminiChat[]

                        chat.push({
                            role: 'model',
                            parts: [{
                                text: content,
                                ...(signText ? { thoughtSignature: signText } : {})
                            } as GeminiPart]
                                .concat(
                                    calls.map((call, index) => ({
                                        functionCall: {
                                            name: call.name,
                                            args: call.args
                                        },
                                        ...(index === 0 && signFunction ? { thoughtSignature: signFunction } : {})
                                    } as GeminiPart))
                                )
                        })
                        if (chat[chat.length - 2]?.role === 'model') {
                            chat[chat.length - 2].parts = chat[chat.length - 2].parts.concat(chat[chat.length - 1].parts)
                            chat.pop()
                        }
                        const parts: GeminiPart[] = []
                        const callCodes: string[] = []
                        const tools = arg?.tools ?? []
                        for (const call of calls) {
                            const functionName = call.name
                            const functionArgs = call.args
                            const tool = tools.find((t) => t.name === functionName)
                            if (tool) {
                                const result = (await callTool(tool.name, functionArgs)).filter((r) => {
                                    return r.type === 'text'
                                })
                                if (result.length === 0) {
                                    parts.push({
                                        functionResponse: {
                                            name: call.name,
                                            response: 'No response from tool.'
                                        }
                                    })
                                }
                                callCodes.push(await encodeToolCall({
                                    call: {
                                        id: call.id,
                                        name: call.name,
                                        arg: call.args
                                    },
                                    response: result
                                }))
                                for (let i = 0; i < result.length; i++) {
                                    let response: any = result[i].text
                                    try {
                                        response = {
                                            data: JSON.parse(response)
                                        }
                                    } catch {
                                        response = {
                                            data: response
                                        }
                                    }
                                    parts.push({
                                        functionResponse: {
                                            name: call.name,
                                            response
                                        }
                                    })
                                }
                            }
                            else {
                                parts.push({
                                    functionResponse: {
                                        name: call.name,
                                        response: `Tool ${call.name} not found.`
                                    }
                                })
                            }
                        }
                        chat.push({
                            role: 'function',
                            parts: parts
                        })

                        body.contents = chat
                        headers['Content-Type'] = 'application/json'

                        let resRec
                        let attempt = 0
                        let errorFlag = true

                        do {
                            attempt++
                            resRec = await fetchNative(url, {
                                headers: headers,
                                body: JSON.stringify(body),
                                method: 'POST',
                                chatId: arg.chatId,
                                signal: arg.abortSignal,
                            })

                            if (resRec.status == 200) {
                                addFetchLog({
                                    body: body,
                                    response: "Streaming",
                                    success: true,
                                    url: url,
                                    status: resRec.status,
                                })

                                errorFlag = false
                                break
                            }
                        } while (attempt <= db.requestRetrys)

                        if (errorFlag) {
                            alertError(`Failed to fetch model response after tool execution`)
                            return controller.close()
                        }

                        const transtream = getTranStream()
                        resRec.body.pipeTo(transtream.writable)
                        reader = transtream.readable.getReader()

                        prefix += (thoughts + lastThought ? `<Thoughts>\n\n${thoughts + lastThought}\n\n</Thoughts>\n\n` : '')
                            + (content ? content + '\n\n' : '')
                            + callCodes.join('\n\n')

                        controller.enqueue({ "0": prefix })
                        continue
                    }
                    return controller.close()
                }

                lastValue = value

                if (db.streamGeminiThoughts) {
                    controller.enqueue({
                        "0": (prefix ? prefix + '\n\n' : '')
                            + (thoughts ? `<Thoughts>\n\n${thoughts}\n\n</Thoughts>\n\n` : '')
                            + (lastThought ? lastThought + '\n\n' : '')
                            + content
                    })
                }
                else {
                    controller.enqueue({
                        "0": (prefix ? prefix + '\n\n' : '')
                            + (thoughts + lastThought ? `<Thoughts>\n\n${thoughts + lastThought}\n\n</Thoughts>\n\n` : '')
                            + content
                    })
                }
            }
        }
    })
}
