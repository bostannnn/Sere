/* eslint-disable @typescript-eslint/no-explicit-any */

import { language } from "src/lang"
import {
    getServerFailureMessage,
    getServerStringSuccessResult,
    normalizeServerEnvelope,
    parseServerErrorPayload,
    stringifyUnknownResponse,
} from "../request.responses";
import {
    requestServerJson,
    requestServerPreview,
    requestServerStream,
    readFailedServerStream,
} from "../request.transport";
import { getTranStream, wrapToolStream } from "./openai.stream";
import { buildServerExecutionPayloadPlan } from "./serverExecutionPayload";
import type { RequestDataArgumentExtended, requestDataResponse } from "../request";
import type { OpenAIHttpResponse } from "../openAI";

function buildCompactGenerateRequestBody(body: Record<string, any>) {
    const compact = (typeof structuredClone === 'function')
        ? structuredClone(body)
        : JSON.parse(JSON.stringify(body))
    delete compact.messages
    delete compact.prompt
    delete compact.stream
    return compact
}

async function requestServerExecution(
    arg: RequestDataArgumentExtended,
    body: Record<string, any>,
    opts: {
        provider: 'openrouter' | 'openai' | 'deepseek'
        providerLabel: string
        keyMissingCode: string
    }
): Promise<requestDataResponse> {
    const requestMode = String(arg.mode ?? 'model');
    const {
        payload,
        serverExecEndpoint,
    } = buildServerExecutionPayloadPlan({
        arg,
        body,
        provider: opts.provider,
        requestBodyCloneOptions: {
            stream: !!arg.useStreaming,
        },
        canUseGenerateEndpoint: (currentArg) => String(currentArg.mode ?? 'model') === 'model',
        isRawGenerateEligible: ({ requestBodyForServer }) => {
            const hasNonStringMessage = Array.isArray(requestBodyForServer.messages)
                && requestBodyForServer.messages.some((m: any) => typeof m?.content !== 'string')
            const hasPromptOnly = typeof requestBodyForServer.prompt === 'string'
                && (!Array.isArray(requestBodyForServer.messages) || requestBodyForServer.messages.length === 0)

            return !hasNonStringMessage && !hasPromptOnly
        },
        getModel: ({ requestBodyForServer }) =>
            typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
        getMaxTokens: ({ requestBodyForServer }) =>
            Number.isFinite(Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens))
                ? Number(requestBodyForServer.max_tokens ?? requestBodyForServer.max_completion_tokens)
                : undefined,
        getRequestMessages: ({ requestBodyForServer }) =>
            Array.isArray(requestBodyForServer.messages) ? requestBodyForServer.messages : undefined,
        getRequestPrompt: ({ requestBodyForServer }) =>
            typeof requestBodyForServer.prompt === 'string' ? requestBodyForServer.prompt : undefined,
        getRequestTools: ({ requestBodyForServer }) =>
            Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
        getSharedPayloadFields: ({ database, requestBodyForServer }) => {
            const requestModelId = typeof requestBodyForServer.model === 'string'
                ? requestBodyForServer.model.trim().toLowerCase()
                : ''

            return {
                allowReasoningOnlyForDeepSeekV32Speciale:
                    opts.provider === 'openrouter'
                    && requestModelId === 'deepseek/deepseek-v3.2-speciale'
                    && database.openrouterAllowReasoningOnlyForDeepSeekV32Speciale === true,
            }
        },
        buildRawRequestWrapper: ({ requestBodyForServer, model, maxTokens }) => ({
            requestBody: buildCompactGenerateRequestBody(requestBodyForServer),
            model,
            maxTokens,
            tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
        }),
    })

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
