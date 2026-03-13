/* eslint-disable @typescript-eslint/no-explicit-any */

import { fetchNative, globalFetch, textifyReadableStream } from "src/ts/globalApi.svelte"
import { LLMFormat } from "src/ts/model/modellist"
import { getDatabase } from "src/ts/storage/database.svelte"
import { v4 } from "uuid"
import { setInlayAsset, writeInlayImage } from "../../files/inlays"
import { callTool, encodeToolCall } from "../../mcp/mcp"
import { extractJSON } from "../../templates/jsonSchema"
import { alertError } from "src/ts/alert"
import type { RequestDataArgumentExtended, requestDataResponse } from "../request"
import type { GeminiChat, GeminiFunctionCall, GeminiPart } from "../google"
import { getTranStream, wrapToolStream } from "./google.stream"

export async function requestGoogle(
    url: string,
    body: any,
    headers: { [key: string]: string },
    arg: RequestDataArgumentExtended
): Promise<requestDataResponse> {
    const db = getDatabase()

    const fallBackGemini = async (originalError: string): Promise<requestDataResponse> => {
        if (!db.antiServerOverloads) {
            return {
                type: 'fail',
                result: originalError,
                failByServerError: true
            }
        }

        if (arg?.abortSignal?.aborted) {
            return {
                type: 'fail',
                result: originalError,
                failByServerError: true
            }
        }
        return requestGoogle(url, body, headers, arg)
    }

    const processTextResponse = (rDatas: { text: string, thought?: boolean }[]) => {
        if (arg.extractJson && (db.jsonSchemaEnabled || arg.schema)) {
            for (let i = 0; i < rDatas.length; i++) {
                const extracted = extractJSON(rDatas[i].text, arg.extractJson)
                rDatas[i].text = extracted
            }
        }
        const thoughts = rDatas.filter(d => d.thought).map(d => d.text).join('\n\n')
        const content = rDatas.filter(d => !d.thought).map(d => d.text).join('\n\n')
        return (thoughts ? `<Thoughts>\n\n${thoughts}\n\n</Thoughts>\n\n` : '') + content
    }

    if (arg.modelInfo.format === LLMFormat.GoogleCloud && arg.useStreaming) {
        headers['Content-Type'] = 'application/json'

        const f = await fetchNative(url, {
            headers: headers,
            body: JSON.stringify(body),
            method: 'POST',
            chatId: arg.chatId,
            signal: arg.abortSignal,
        })

        if (f.status !== 200) {
            const text = await textifyReadableStream(f.body)
            if (text.includes('RESOURCE_EXHAUSTED')) {
                return fallBackGemini(text)
            }
            return {
                type: 'fail',
                result: text
            }
        }

        const transtream = getTranStream()
        f.body.pipeTo(transtream.writable)

        return {
            type: 'streaming',
            result: wrapToolStream(transtream.readable, body, headers, url, arg)
        }
    }

    const res = await globalFetch(url, {
        headers: headers,
        body: body,
        chatId: arg.chatId,
        abortSignal: arg.abortSignal,
    })

    if (!res.ok) {
        const text = JSON.stringify(res.data)
        if (text.includes('RESOURCE_EXHAUSTED')) {
            return fallBackGemini(text)
        }
        return {
            type: 'fail',
            result: `${JSON.stringify(res.data)}`
        }
    }

    const rDatas: { text: string, thought?: boolean }[] = []
    const processDataItem = async (data: any): Promise<GeminiPart[]> => {
        const parts = data?.candidates?.[0]?.content?.parts as GeminiPart[]

        if (parts) {
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i]

                if (part.text) {
                    rDatas.push({
                        text: part.text,
                        thought: part.thought
                    })
                }

                if (part.inlineData) {
                    const imgHTML = new Image()
                    const id = crypto.randomUUID()

                    if (part.inlineData.mimeType.startsWith('image/')) {
                        imgHTML.src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                        await writeInlayImage(imgHTML, {
                            id: id
                        })
                        rDatas.push({
                            text: `{{inlayeddata::${id}}}`
                        })
                    }
                    else {
                        const assetId = v4()
                        await setInlayAsset(assetId, {
                            name: 'gemini-audio',
                            type: 'audio',
                            data: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                            height: 0,
                            width: 0,
                            ext: part.inlineData.mimeType.split('/')[1],
                        })
                    }
                }
            }
        }
        return parts
    }

    let parts: GeminiPart[] = []
    if (Array.isArray(res.data)) {
        for (const data of res.data) {
            const p = await processDataItem(data)
            parts = parts.concat(p)
        }
    }
    else {
        const p = await processDataItem(res.data)
        parts = parts.concat(p)
    }
    parts = parts.filter((p) => p)

    const calls = parts.filter((p) => !!p?.functionCall).map((p) => p?.functionCall as GeminiFunctionCall)

    if (calls.length > 0) {
        const chat = body.contents as GeminiChat[]

        chat.push({
            role: 'model',
            parts: parts.filter((p) => !p.thought)
        })
        if (chat[chat.length - 2]?.role === 'model') {
            chat[chat.length - 2].parts = chat[chat.length - 2].parts.concat(chat[chat.length - 1].parts)
            chat.pop()
        }

        const functionParts: GeminiPart[] = []
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
                    functionParts.push({
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
                    functionParts.push({
                        functionResponse: {
                            name: call.name,
                            response
                        }
                    })
                }
            }
            else {
                functionParts.push({
                    functionResponse: {
                        name: call.name,
                        response: `Tool ${call.name} not found.`
                    }
                })
            }
        }

        chat.push({
            role: 'function',
            parts: functionParts
        })

        body.contents = chat

        let resRec
        let attempt = 0
        do {
            attempt++
            resRec = await requestGoogle(url, body, headers, arg)

            if (resRec.type != 'fail') {
                break
            }
        } while (attempt <= db.requestRetrys)

        const result = processTextResponse(rDatas) + '\n\n' + callCodes.join('\n\n')

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

    const result = processTextResponse(rDatas)
    if (!result) {
        return {
            type: 'fail',
            result: `Got empty response: ${JSON.stringify(res.data)}`
        }
    }

    return {
        type: 'success',
        result: result
    }
}
