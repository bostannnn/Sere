/* eslint-disable @typescript-eslint/no-explicit-any */

import { LLMFormat } from "src/ts/model/modellist"
import { getDatabase } from "src/ts/storage/database.svelte"
import { type RequestDataArgumentExtended, type requestDataResponse } from "./request"
import { isNodeServer } from "src/ts/platform"
import { buildCharacterRagPayload, buildGlobalRagPayload } from "./ragPayload"
import {
    getServerStringSuccessResult,
    normalizeServerEnvelope,
    parseServerErrorPayload,
    stringifyUnknownResponse,
} from "./request.responses"
import {
    buildGoogleBaseRequestPayload,
    finalizeGoogleRequestPayload,
} from "./providers/google.payload"
import {
    requestGoogle as requestGoogleImpl,
} from "./providers/google.response"
import {
    cloneServerRequestBody,
    createAccumulatingServerResponseStream,
    getLatestUserMessage,
    hasMultimodalMessages,
    requestServerJson,
    requestServerPreview,
    requestServerStream,
    resolveServerExecutionEndpoint,
    readFailedServerStream,
} from "./request.transport"
const googleRequestLog = (..._args: unknown[]) => {};

export type GeminiFunctionCall = {
    id?: string;
    name: string;
    args: any
}

type GeminiFunctionResponse = {
    id?: string;
    name: string;
    response: any
}

export interface GeminiPart{
    text?:string
    thought?:boolean
    thoughtSignature?:string
    "inlineData"?: {
        "mimeType": string,
        "data": string
    },
    functionCall?: GeminiFunctionCall
    functionResponse?: GeminiFunctionResponse
}

export interface GeminiChat {
    role: "user"|"model"|"function"
    parts:|GeminiPart[]
}

type GoogleServerExecutionResponse = {
    type?: string
    result?: unknown
    newCharEtag?: string
    message?: string
    error?: string
    details?: {
        status?: number
        body?: {
            error?: {
                message?: string
            }
            message?: string
            [key: string]: unknown
        }
        [key: string]: unknown
    }
    status?: number
    [key: string]: unknown
}

async function requestGoogleServerExecution(arg: RequestDataArgumentExtended, body: Record<string, any>): Promise<requestDataResponse> {
    const serverExecEndpoint = resolveServerExecutionEndpoint(arg, true);

    const charRagSettings = arg.currentChar?.ragSettings
    const globalRagSettings = getDatabase().globalRagSettings
    const requestBodyForServer = cloneServerRequestBody(body);
    const latestUserMessage = getLatestUserMessage(arg.formated);
    const hasMultimodal = hasMultimodalMessages(arg.formated);
    const canUseRawGeneratePayload =
        !arg.previewBody
        && !!(arg.currentChar?.chaId)
        && !!arg.chatId
        && !!latestUserMessage
        && !hasMultimodal;

    const payload = canUseRawGeneratePayload
        ? {
            mode: arg.mode ?? 'model',
            provider: 'google',
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            userMessage: latestUserMessage,
            model: typeof arg.modelInfo?.internalID === 'string' ? arg.modelInfo.internalID : undefined,
            maxTokens: Number.isFinite(Number(requestBodyForServer?.generation_config?.maxOutputTokens))
                ? Number(requestBodyForServer.generation_config.maxOutputTokens)
                : undefined,
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
        }
        : {
            mode: arg.mode ?? 'model',
            provider: 'google',
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            useClientAssembledRequest: serverExecEndpoint === '/data/llm/generate',
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
            request: {
                requestBody: requestBodyForServer,
                messages: Array.isArray(requestBodyForServer.contents) ? requestBodyForServer.contents : undefined,
                model: typeof arg.modelInfo?.internalID === 'string' ? arg.modelInfo.internalID : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer?.generation_config?.maxOutputTokens))
                    ? Number(requestBodyForServer.generation_config.maxOutputTokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer?.tools?.functionDeclarations)
                    ? requestBodyForServer.tools.functionDeclarations
                    : undefined,
            },
        };

    if (arg.previewBody) {
        const previewRes = await requestServerPreview(payload, arg);
        const parsedRaw = previewRes.data;
        const parsed = normalizeServerEnvelope(parsedRaw) as GoogleServerExecutionResponse;
        if (!previewRes.ok) {
            return {
                type: 'fail',
                result: stringifyUnknownResponse(parsedRaw)
            };
        }
        return {
            type: 'success',
            result: JSON.stringify(parsed, null, 2),
        };
    }

    if (arg.useStreaming) {
        const res = await requestServerStream(serverExecEndpoint, payload, arg);
        if (res.status !== 200) {
            return {
                type: 'fail',
                result: await readFailedServerStream(res)
            };
        }

        return {
            type: 'streaming',
            result: createAccumulatingServerResponseStream(res),
        };
    }

    const serverRes = await requestServerJson(serverExecEndpoint, payload, arg);
    const parsedRaw = serverRes.data;
    const parsed = normalizeServerEnvelope(parsedRaw) as GoogleServerExecutionResponse;

    if (!serverRes.ok) {
        const err = parseServerErrorPayload(parsed, serverRes.status);
        if (err.code === 'GOOGLE_KEY_MISSING') {
            return { type: 'fail', noRetry: true, result: `Google key is missing in server settings.` };
        }
        return {
            type: 'fail',
            failByServerError: err.status >= 500,
            result: err.message,
        };
    }

    const successResult = getServerStringSuccessResult(parsedRaw)
    if (successResult) {
        return {
            type: 'success',
            result: successResult.result,
            newCharEtag: successResult.newCharEtag,
        };
    }

    return {
        type: 'fail',
        result: stringifyUnknownResponse(parsedRaw),
    };
}

export async function requestGoogleCloudVertex(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const { body } = await buildGoogleBaseRequestPayload(arg, googleRequestLog)

    const useServerGoogle =
        isNodeServer &&
        arg.modelInfo.format === LLMFormat.GoogleCloud &&
        !arg.customURL;
    if (useServerGoogle) {
        return await requestGoogleServerExecution(arg, body);
    }

    const { headers, url } = finalizeGoogleRequestPayload(arg, body, googleRequestLog)

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: url,
                body: body,
                headers: headers
            })      
        }
    }

    return requestGoogle(url, body, headers, arg)
}

async function requestGoogle(url:string, body:any, headers:{[key:string]:string}, arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    return requestGoogleImpl(url, body, headers, arg)
}
