import { addFetchLog, fetchNative, globalFetch, textifyReadableStream } from "src/ts/globalApi.svelte"
import type { RequestDataArgumentExtended, StreamResponseChunk } from "./request"

export function cloneServerRequestBody<T>(body: T, arg: {
    stream?: boolean
} = {}): T {
    const cloned = (typeof structuredClone === 'function')
        ? structuredClone(body)
        : JSON.parse(JSON.stringify(body))

    if (typeof arg.stream === 'boolean' && cloned && typeof cloned === 'object' && !Array.isArray(cloned)) {
        ;(cloned as Record<string, unknown>).stream = arg.stream
    }

    return cloned
}

export function getLatestUserMessage(formated: RequestDataArgumentExtended['formated']): string {
    return [...(formated || [])]
        .reverse()
        .find((m) => m?.role === 'user' && typeof m?.content === 'string' && m.content.trim().length > 0)
        ?.content?.trim() || ''
}

export function hasMultimodalMessages(formated: RequestDataArgumentExtended['formated']): boolean {
    return (formated || []).some((m) => Array.isArray(m?.multimodals) && m.multimodals.length > 0)
}

export function resolveServerExecutionEndpoint(arg: RequestDataArgumentExtended, canUseGenerateEndpoint: boolean): string {
    const hasServerAssemblyContext = !!(arg.currentChar?.chaId) && !!arg.chatId
    return (canUseGenerateEndpoint && hasServerAssemblyContext) ? '/data/llm/generate' : '/data/llm/execute'
}

export async function requestServerPreview(
    payload: Record<string, unknown>,
    arg: RequestDataArgumentExtended
) {
    const previewRes = await globalFetch('/data/llm/preview', {
        method: 'POST',
        body: payload,
        abortSignal: arg.abortSignal,
        chatId: arg.chatId,
    })

    addFetchLog({
        body: payload,
        response: previewRes.data,
        success: previewRes.ok,
        url: '/data/llm/preview',
        status: previewRes.status,
        chatId: arg.chatId,
    })

    return previewRes
}

export async function requestServerJson(
    endpoint: string,
    payload: Record<string, unknown>,
    arg: RequestDataArgumentExtended
) {
    const serverRes = await globalFetch(endpoint, {
        method: 'POST',
        body: payload,
        abortSignal: arg.abortSignal,
        chatId: arg.chatId,
    })

    addFetchLog({
        body: payload,
        response: serverRes.data,
        success: serverRes.ok,
        url: endpoint,
        status: serverRes.status,
        chatId: arg.chatId,
    })

    return serverRes
}

export async function requestServerStream(
    endpoint: string,
    payload: Record<string, unknown>,
    arg: RequestDataArgumentExtended
) {
    const res = await fetchNative(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        signal: arg.abortSignal,
    })

    if (res.status === 200) {
        addFetchLog({
            body: payload,
            response: 'Streaming (Server)',
            success: true,
            url: endpoint,
            status: res.status,
            chatId: arg.chatId,
        })
    }

    return res
}

export function createAccumulatingServerResponseStream(res: Response): ReadableStream<StreamResponseChunk> {
    return new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            const reader = res.body.getReader()
            const decoder = new TextDecoder()
            let parserData = ''
            let acc = ''
            let sawDoneEvent = false
            let sawErrorEvent = false

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                parserData += decoder.decode(value, { stream: true })
                const parts = parserData.split('\n')
                parserData = parts.pop() ?? ''

                for (const line of parts) {
                    const trimmed = line.trim()
                    if (!trimmed.startsWith('data: ')) continue

                    const raw = trimmed.slice(6).trim()
                    if (!raw) continue

                    try {
                        const parsed = JSON.parse(raw)
                        if (parsed.type === 'chunk') {
                            acc += (parsed.text || '')
                            controller.enqueue({ "0": acc })
                        } else if (parsed.type === 'done') {
                            sawDoneEvent = true
                            if (parsed.newCharEtag) {
                                controller.enqueue({ "__newCharEtag": parsed.newCharEtag })
                            }
                            controller.close()
                            return
                        } else if (parsed.type === 'error' || parsed.type === 'fail') {
                            sawErrorEvent = true
                            controller.enqueue({ "0": `Error: ${parsed.message || parsed.error || 'Server stream failed'}` })
                            controller.close()
                            return
                        }
                    } catch {
                    }
                }
            }

            if (!sawDoneEvent && !sawErrorEvent) {
                controller.enqueue({
                    "__error": "Server stream ended before done event.",
                    "__errorCode": "UPSTREAM_STREAM_INCOMPLETE",
                    "__status": "502",
                })
            }

            controller.close()
        },
    })
}

export async function readFailedServerStream(res: Response): Promise<string> {
    return await textifyReadableStream(res.body)
}
