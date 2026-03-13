/* eslint-disable @typescript-eslint/no-explicit-any */

import { language } from "src/lang"
import { getDatabase } from "src/ts/storage/database.svelte"
import { buildCharacterRagPayload, buildGlobalRagPayload } from "../ragPayload";
import {
    getServerFailureMessage,
    getServerStringSuccessResult,
    normalizeServerEnvelope,
    parseServerErrorPayload,
    stringifyUnknownResponse,
} from "../request.responses";
import {
    cloneServerRequestBody,
    getLatestUserMessage,
    hasMultimodalMessages,
    requestServerJson,
    requestServerPreview,
    requestServerStream,
    resolveServerExecutionEndpoint,
    readFailedServerStream,
} from "../request.transport";
import { getTranStream, wrapToolStream } from "./openai.stream";
import type { RequestDataArgumentExtended, requestDataResponse } from "../request";
import type { OpenAIHttpResponse } from "../openAI";

async function requestServerExecution(
    arg: RequestDataArgumentExtended,
    body: Record<string, any>,
    opts: {
        provider: 'openrouter' | 'openai' | 'deepseek'
        providerLabel: string
        keyMissingCode: string
    }
): Promise<requestDataResponse> {
    const generateProviders = new Set(['openrouter', 'openai', 'deepseek']);
    const rawGenerateProviders = new Set(['openrouter', 'openai', 'deepseek']);
    const requestMode = String(arg.mode ?? 'model');
    const canUseGenerateEndpoint = requestMode === 'model';
    const serverExecEndpoint = resolveServerExecutionEndpoint(
        arg,
        canUseGenerateEndpoint && generateProviders.has(opts.provider)
    );

    const db = getDatabase();
    const charRagSettings = arg.currentChar?.ragSettings;
    const globalRagSettings = db.globalRagSettings;
    const requestBodyForServer = cloneServerRequestBody(body, {
        stream: !!arg.useStreaming,
    });
    const latestUserMessage = getLatestUserMessage(arg.formated);
    const hasMultimodal = hasMultimodalMessages(arg.formated);
    const hasNonStringMessage = Array.isArray(requestBodyForServer.messages)
        && requestBodyForServer.messages.some((m: any) => typeof m?.content !== 'string');
    const hasPromptOnly = typeof requestBodyForServer.prompt === 'string'
        && (!Array.isArray(requestBodyForServer.messages) || requestBodyForServer.messages.length === 0);
    const compactRequestBodyForGenerate = (() => {
        const compact = (typeof structuredClone === 'function')
            ? structuredClone(requestBodyForServer)
            : JSON.parse(JSON.stringify(requestBodyForServer));
        delete compact.messages;
        delete compact.prompt;
        delete compact.stream;
        return compact;
    })();
    const canUseRawGeneratePayload =
        serverExecEndpoint === '/data/llm/generate'
        && rawGenerateProviders.has(opts.provider)
        && !arg.previewBody
        && !!(arg.currentChar?.chaId)
        && !!arg.chatId
        && !!latestUserMessage
        && !hasMultimodal
        && !hasNonStringMessage
        && !hasPromptOnly;
    const requestModelId = typeof requestBodyForServer.model === 'string'
        ? requestBodyForServer.model.trim().toLowerCase()
        : '';
    const allowReasoningOnlyForDeepSeekV32Speciale =
        opts.provider === 'openrouter'
        && requestModelId === 'deepseek/deepseek-v3.2-speciale'
        && db.openrouterAllowReasoningOnlyForDeepSeekV32Speciale === true;

    const payload = canUseRawGeneratePayload
        ? {
            mode: arg.mode ?? 'model',
            provider: opts.provider,
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            allowReasoningOnlyForDeepSeekV32Speciale,
            userMessage: latestUserMessage,
            model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
            maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                : undefined,
            request: {
                requestBody: compactRequestBodyForGenerate,
                model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                    ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
            },
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
        }
        : {
            mode: arg.mode ?? 'model',
            provider: opts.provider,
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            allowReasoningOnlyForDeepSeekV32Speciale,
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
            request: {
                requestBody: requestBodyForServer,
                messages: Array.isArray(requestBodyForServer.messages) ? requestBodyForServer.messages : undefined,
                prompt: typeof requestBodyForServer.prompt === 'string' ? requestBodyForServer.prompt : undefined,
                model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                    ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
            },
        };

    const requestModel = typeof body?.model === 'string' && body.model.trim().length > 0 ? body.model.trim() : '(unset)';
    const requestContext = `mode=${requestMode}, model=${requestModel}`;

    if (arg.previewBody) {
        try {
            const previewRes = await requestServerPreview(payload, arg);
            const parsedRaw = previewRes.data;
            const parsed = normalizeServerEnvelope(parsedRaw) as unknown as OpenAIHttpResponse;
            if (!previewRes.ok) {
                return {
                    type: 'fail',
                    result: language.errors.httpError + `${stringifyUnknownResponse(parsedRaw)}`
                };
            }
            return {
                type: 'success',
                result: JSON.stringify(parsed, null, 2),
            };
        } catch (error) {
            return {
                type: 'fail',
                result: language.errors.httpError + `${error}`,
            };
        }
    }

    if (arg.useStreaming) {
        try {
            const res = await requestServerStream(serverExecEndpoint, payload, arg);

            if (res.status !== 200) {
                return {
                    type: 'fail',
                    result: await readFailedServerStream(res)
                };
            }

            const transtream = getTranStream(arg);
            res.body.pipeTo(transtream.writable);

            return {
                type: 'streaming',
                result: wrapToolStream(transtream.readable, body, { 'content-type': 'application/json' }, serverExecEndpoint, arg)
            };
        } catch (error) {
            return {
                type: 'fail',
                result: language.errors.httpError + `${error}`,
            };
        }
    }

    try {
        const serverRes = await requestServerJson(serverExecEndpoint, payload, arg);
        const parsedRaw = serverRes.data;
        const parsed = normalizeServerEnvelope(parsedRaw) as unknown as OpenAIHttpResponse;

        if (!serverRes.ok) {
            const err = parseServerErrorPayload(parsed, serverRes.status);
            if (err.code === opts.keyMissingCode) {
                return {
                    type: 'fail',
                    noRetry: true,
                    result: `${language.errors.httpError}${opts.providerLabel} key is missing in server settings. [${requestContext}]`,
                };
            }
            if (err.status === 429) {
                return {
                    type: 'fail',
                    noRetry: true,
                    result: `${language.errors.httpError}${opts.providerLabel} rate limit (429): ${err.message} [${requestContext}]`,
                };
            }
            return {
                type: 'fail',
                failByServerError: err.status >= 500,
                result: `${language.errors.httpError}${err.message} [${requestContext}]`,
            };
        }

        const successResult = getServerStringSuccessResult(parsedRaw);
        if (successResult) {
            return {
                type: 'success',
                result: successResult.result,
                newCharEtag: successResult.newCharEtag,
            };
        }

        if (parsed?.type === 'fail' || ((parsed?.result && typeof parsed.result === 'object') ? (parsed.result as { type?: string }).type === 'fail' : false)) {
            return {
                type: 'fail',
                result: `${getServerFailureMessage(parsedRaw)} [${requestContext}]`,
            };
        }

        return {
            type: 'fail',
            result: language.errors.httpError + `${stringifyUnknownResponse(parsedRaw)}`,
        };
    } catch (error) {
        return {
            type: 'fail',
            result: language.errors.httpError + `${error}`,
        };
    }
}

export async function requestOpenRouterServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    return await requestServerExecution(arg, body, {
        provider: 'openrouter',
        providerLabel: 'OpenRouter',
        keyMissingCode: 'OPENROUTER_KEY_MISSING',
    });
}

export async function requestOpenAIServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    return await requestServerExecution(arg, body, {
        provider: 'openai',
        providerLabel: 'OpenAI',
        keyMissingCode: 'OPENAI_KEY_MISSING',
    });
}

export async function requestDeepSeekServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    return await requestServerExecution(arg, body, {
        provider: 'deepseek',
        providerLabel: 'DeepSeek',
        keyMissingCode: 'DEEPSEEK_KEY_MISSING',
    });
}
