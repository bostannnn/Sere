import { Ollama } from 'ollama/dist/browser.mjs';
import { language } from "../../../lang";
import { fetchNative, globalFetch, textifyReadableStream } from "../../globalApi.svelte";
import { getDatabase } from "../../storage/database.svelte";
import { isNodeServer } from '../../platform';
import { getServerStringSuccessResult, normalizeServerEnvelope, stringifyUnknownResponse } from "./request.responses";
import { buildCharacterRagPayload, buildGlobalRagPayload } from "./ragPayload";
import type { RequestDataArgumentExtended, StreamResponseChunk, requestDataResponse } from "./request";

export async function requestOllama(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()

    const makeServerPayload = () => ({
        useClientAssembledRequest: true,
        mode: arg.mode ?? 'model',
        provider: 'ollama',
        characterId: arg.currentChar?.chaId ?? '',
        chatId: arg.chatId ?? '',
        continue: !!arg.continue,
        streaming: !!arg.useStreaming,
        ragSettings: buildCharacterRagPayload(arg.currentChar?.ragSettings),
        globalRagSettings: buildGlobalRagPayload(db.globalRagSettings),
        request: {
            requestBody: {
                model: db.ollamaModel,
                ollama_url: db.ollamaURL,
                messages: formated.map((v) => {
                    return {
                        role: v.role,
                        content: v.content
                    }
                }).filter((v) => {
                    return v.role === 'assistant' || v.role === 'user' || v.role === 'system'
                }),
            },
            model: db.ollamaModel,
            messages: formated,
        },
    })

    if (isNodeServer) {
        if (arg.previewBody) {
            const previewRes = await globalFetch('/data/llm/preview', {
                method: 'POST',
                body: makeServerPayload(),
                abortSignal: arg.abortSignal,
                chatId: arg.chatId,
            })
            if (!previewRes.ok) {
                return {
                    type: 'fail',
                    result: JSON.stringify(previewRes.data),
                }
            }
            return {
                type: 'success',
                result: JSON.stringify(previewRes.data, null, 2),
            }
        }

        if (arg.useStreaming) {
            const res = await fetchNative('/data/llm/generate', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(makeServerPayload()),
                signal: arg.abortSignal,
            });
            if (res.status !== 200) {
                return {
                    type: 'fail',
                    result: await textifyReadableStream(res.body)
                };
            }

            const stream = new ReadableStream<StreamResponseChunk>({
                async start(controller) {
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let parserData = '';
                    let acc = '';
                    let sawDoneEvent = false;
                    let sawErrorEvent = false;
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        parserData += decoder.decode(value, { stream: true });
                        const parts = parserData.split('\n');
                        parserData = parts.pop() ?? '';
                        for (const line of parts) {
                            const trimmed = line.trim();
                            if (!trimmed.startsWith('data: ')) continue;
                            const raw = trimmed.slice(6).trim();
                            if (!raw) continue;
                            try {
                                const parsed = JSON.parse(raw);
                                if (parsed.type === 'chunk') {
                                    acc += (parsed.text || '');
                                    controller.enqueue({ "0": acc });
                                } else if (parsed.type === 'done') {
                                    sawDoneEvent = true;
                                    if (parsed.newCharEtag) {
                                        controller.enqueue({ "__newCharEtag": parsed.newCharEtag });
                                    }
                                    controller.close();
                                    return;
                                } else if (parsed.type === 'error' || parsed.type === 'fail') {
                                    sawErrorEvent = true;
                                    controller.enqueue({ "0": `Error: ${parsed.message || parsed.error || 'Server stream failed'}` });
                                    controller.close();
                                    return;
                                }
                            } catch { }
                        }
                    }
                    if (!sawDoneEvent && !sawErrorEvent) {
                        controller.enqueue({
                            "__error": "Server stream ended before done event.",
                            "__errorCode": "UPSTREAM_STREAM_INCOMPLETE",
                            "__status": "502",
                        });
                    }
                    controller.close();
                },
            });

            return {
                type: 'streaming',
                result: stream,
            };
        }

        const serverRes = await globalFetch('/data/llm/generate', {
            method: 'POST',
            body: makeServerPayload(),
            abortSignal: arg.abortSignal,
            chatId: arg.chatId,
        })
        const rawData = serverRes.data as unknown
        const data = normalizeServerEnvelope(rawData)
        const successResult = getServerStringSuccessResult(rawData)
        if (!serverRes.ok) {
            const errCode = String(data?.error || '')
            if (errCode === 'OLLAMA_MODEL_MISSING') {
                return {
                    type: 'fail',
                    noRetry: true,
                    result: `${language.errors.httpError}Ollama model is missing in server settings.`,
                }
            }
            return {
                type: 'fail',
                result: stringifyUnknownResponse(rawData),
            }
        }
        if (successResult) {
            return {
                type: 'success',
                result: successResult.result,
                newCharEtag: successResult.newCharEtag,
            }
        }
        return {
            type: 'fail',
            result: stringifyUnknownResponse(rawData),
        }
    }

    if (arg.previewBody) {
        return {
            type: 'success',
            result: JSON.stringify({
                error: "Preview body is not supported for Ollama"
            })
        }
    }

    const ollama = new Ollama({ host: db.ollamaURL })

    const response = await ollama.chat({
        model: db.ollamaModel,
        messages: formated.map((v) => {
            return {
                role: v.role,
                content: v.content
            }
        }).filter((v) => {
            return v.role === 'assistant' || v.role === 'user' || v.role === 'system'
        }),
        stream: true
    })

    const readableStream = new ReadableStream<StreamResponseChunk>({
        async start(controller) {
            for await (const chunk of response) {
                controller.enqueue({
                    "0": chunk.message.content
                })
            }
            controller.close()
        }
    })

    return {
        type: 'streaming',
        result: readableStream
    }
}
