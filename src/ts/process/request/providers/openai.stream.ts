/* eslint-disable @typescript-eslint/no-explicit-any */

import { addFetchLog, fetchNative } from "src/ts/globalApi.svelte"
import { LLMFlags } from "src/ts/model/modellist"
import { isNodeServer } from "src/ts/platform"
import { getDatabase } from "src/ts/storage/database.svelte"
import { alertError } from "src/ts/alert"
import { callTool, encodeToolCall } from "../../mcp/mcp"
import { extractJSON } from "../../templates/jsonSchema"
import type { OpenAIChatExtra, OpenAIToolCall, RequestDataArgumentExtended, StreamResponseChunk } from "../request"

export function getTranStream(arg: RequestDataArgumentExtended): TransformStream<Uint8Array, StreamResponseChunk> {
    let dataUint: Uint8Array | Buffer = new Uint8Array([])
    let reasoningContent = ""
    let sawDoneEvent = false
    let sawTerminalError = false
    const db = getDatabase()

    return new TransformStream<Uint8Array, StreamResponseChunk>({
        transform(chunk, control) {
            dataUint = Buffer.from(new Uint8Array([...dataUint, ...chunk]))
            const JSONreaded: { [key: string]: string } = {}
            try {
                const datas = dataUint.toString().split('\n')
                const readed: { [key: string]: string } = {}
                for (const data of datas) {
                    if (data.startsWith("data: ")) {
                        try {
                            const rawChunk = data.replace("data: ", "").trim()
                            if (rawChunk === "[DONE]") {
                                sawDoneEvent = true
                                if (arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingOutput)) {
                                    readed["0"] = readed["0"].replace(/(.*)<\/think>/gms, (m: string, p1: string) => {
                                        reasoningContent = p1
                                        return ""
                                    })
                                    if (reasoningContent) {
                                        reasoningContent = reasoningContent.replace(/<think>/gm, '')
                                    }
                                }
                                if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
                                    for (const key in readed) {
                                        const extracted = extractJSON(readed[key], arg.extractJson)
                                        JSONreaded[key] = extracted
                                    }
                                    control.enqueue(JSONreaded)
                                }
                                else if (reasoningContent) {
                                    control.enqueue({
                                        "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"]}`
                                    })
                                }
                                else {
                                    control.enqueue(readed)
                                }
                                return
                            }

                            if (isNodeServer) {
                                try {
                                    const parsed = JSON.parse(rawChunk)
                                    if (parsed.type === 'chunk') {
                                        if (!readed["0"]) readed["0"] = ""
                                        readed["0"] += (parsed.text || "")
                                        continue
                                    } else if (parsed.type === 'fail' || parsed.type === 'error') {
                                        sawTerminalError = true
                                        const errorMessage = typeof parsed.message === 'string' && parsed.message.trim()
                                            ? parsed.message.trim()
                                            : (typeof parsed.error === 'string' && parsed.error.trim()
                                                ? parsed.error.trim()
                                                : 'Server execution failed')
                                        readed["__error"] = errorMessage
                                        if (typeof parsed.error === 'string' && parsed.error.trim()) {
                                            readed["__errorCode"] = parsed.error.trim()
                                        }
                                        if (typeof parsed.code === 'string' && parsed.code.trim()) {
                                            readed["__errorCode"] = parsed.code.trim()
                                        }
                                        if (Number.isFinite(Number(parsed.status))) {
                                            readed["__status"] = String(Number(parsed.status))
                                        }
                                        control.enqueue(readed)
                                        return
                                    } else if (parsed.type === 'done') {
                                        sawDoneEvent = true
                                        if (parsed.newCharEtag) {
                                            readed["__newCharEtag"] = parsed.newCharEtag
                                        }
                                        control.enqueue(readed)
                                        return
                                    }
                                } catch {
                                }
                            }

                            const choices = JSON.parse(rawChunk).choices
                            for (const choice of choices) {
                                const chunkText = choice.delta.content ?? choices.text
                                if (chunkText) {
                                    if (arg.multiGen) {
                                        const ind = choice.index.toString()
                                        if (!readed[ind]) {
                                            readed[ind] = ""
                                        }
                                        readed[ind] += chunkText
                                    }
                                    else {
                                        if (!readed["0"]) {
                                            readed["0"] = ""
                                        }
                                        readed["0"] += chunkText
                                    }
                                }
                                if (choice?.delta?.tool_calls) {
                                    if (!readed["__tool_calls"]) {
                                        readed["__tool_calls"] = JSON.stringify({})
                                    }
                                    const toolCallsData = JSON.parse(readed["__tool_calls"])

                                    for (const toolCall of choice.delta.tool_calls) {
                                        const index = toolCall.index ?? 0
                                        const toolCallId = toolCall.id
                                        if (!toolCallsData[index]) {
                                            toolCallsData[index] = {
                                                id: toolCallId || null,
                                                type: 'function',
                                                function: {
                                                    name: null,
                                                    arguments: ''
                                                }
                                            }
                                        }

                                        if (toolCall.id) {
                                            toolCallsData[index].id = toolCall.id
                                        }
                                        if (toolCall.function?.name) {
                                            toolCallsData[index].function.name = toolCall.function.name
                                        }
                                        if (toolCall.function?.arguments) {
                                            toolCallsData[index].function.arguments += toolCall.function.arguments
                                        }
                                    }

                                    readed["__tool_calls"] = JSON.stringify(toolCallsData)
                                }
                                if (choice?.delta?.reasoning_content) {
                                    reasoningContent += choice.delta.reasoning_content
                                }
                            }
                        } catch {
                        }
                    }
                }

                if (arg.modelInfo.flags.includes(LLMFlags.deepSeekThinkingOutput)) {
                    readed["0"] = readed["0"].replace(/(.*)<\/think>/gms, (m: string, p1: string) => {
                        reasoningContent = p1
                        return ""
                    })

                    if (reasoningContent) {
                        reasoningContent = reasoningContent.replace(/<think>/gm, '')
                    }
                }
                if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
                    for (const key in readed) {
                        const extracted = extractJSON(readed[key], arg.extractJson)
                        JSONreaded[key] = extracted
                    }
                    control.enqueue(JSONreaded)
                }
                else if (reasoningContent) {
                    control.enqueue({
                        "0": `<Thoughts>\n${reasoningContent}\n</Thoughts>\n${readed["0"]}`
                    })
                }
                else {
                    control.enqueue(readed)
                }
            } catch {
            }
        },
        flush(control) {
            if (sawDoneEvent || sawTerminalError) {
                return
            }
            control.enqueue({
                "__error": "Server stream ended before done event.",
                "__errorCode": "UPSTREAM_STREAM_INCOMPLETE",
                "__status": "502",
            })
        }
    })
}

export function wrapToolStream(
    stream: ReadableStream<StreamResponseChunk>,
    body: any,
    headers: Record<string, string>,
    replacerURL: string,
    arg: RequestDataArgumentExtended
): ReadableStream<StreamResponseChunk> {
    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            const db = getDatabase()
            let reader = stream.getReader()
            let prefix = ''
            let lastValue

            while (true) {
                const readResult = await reader.read()
                const { done } = readResult
                let { value } = readResult

                let content = value?.['0'] || ''
                const metaEntries = Object.entries(value ?? {}).filter(([key, val]) => key.startsWith('__') && typeof val === 'string') as [string, string][]
                const hasErrorMeta = metaEntries.some(([key]) => key === '__error')
                if (done) {
                    value = lastValue ?? { '0': '' }
                    content = value?.['0'] || ''
                    const doneMetaEntries = Object.entries(value ?? {}).filter(([key, val]) => key.startsWith('__') && typeof val === 'string') as [string, string][]
                    const doneHasErrorMeta = doneMetaEntries.some(([key]) => key === '__error')
                    if (doneHasErrorMeta) {
                        const failedOut: StreamResponseChunk = {}
                        for (const [metaKey, metaValue] of doneMetaEntries) {
                            failedOut[metaKey] = metaValue
                        }
                        controller.enqueue(failedOut)
                        return controller.close()
                    }

                    const toolCalls = Object.values(JSON.parse(value?.['__tool_calls'] || '{}') || {}) as OpenAIToolCall[]
                    if (toolCalls && toolCalls.length > 0) {
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

                        for (const toolCall of toolCalls) {
                            if (!toolCall.function || !toolCall.function.name || !toolCall.function.arguments) {
                                continue
                            }
                            try {
                                const functionArgs = JSON.parse(toolCall.function.arguments)
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

                            if (resRec.status == 200 && resRec.headers.get('Content-Type').includes('text/event-stream')) {
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
                        } while (attempt <= db.requestRetrys)

                        if (errorFlag) {
                            alertError(`Failed to fetch model response after tool execution`)
                            return controller.close()
                        }

                        const transtream = getTranStream(arg)
                        resRec.body.pipeTo(transtream.writable)
                        reader = transtream.readable.getReader()

                        prefix += (content ? content + '\n\n' : '') + callCodes.join('\n\n')
                        controller.enqueue({ "0": prefix })
                        continue
                    }
                    return controller.close()
                }

                if (hasErrorMeta) {
                    const failedOut: StreamResponseChunk = {}
                    for (const [metaKey, metaValue] of metaEntries) {
                        failedOut[metaKey] = metaValue
                    }
                    controller.enqueue(failedOut)
                    return controller.close()
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
