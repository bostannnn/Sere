/* eslint-disable @typescript-eslint/no-explicit-any */

import { LLMFormat } from "src/ts/model/modellist"
import { type RequestDataArgumentExtended, type requestDataResponse } from "./request"
import { isNodeServer } from "src/ts/platform"
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
import { buildServerExecutionPayloadPlan } from "./providers/serverExecutionPayload"
import {
    requestGoogle as requestGoogleImpl,
} from "./providers/google.response"
import {
    createAccumulatingServerResponseStream,
    requestServerJson,
    requestServerPreview,
    requestServerStream,
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
    const { payload, serverExecEndpoint } = buildServerExecutionPayloadPlan({
        arg,
        body,
        provider: 'google',
        getModel: ({ arg: currentArg }) =>
            typeof currentArg.modelInfo?.internalID === 'string' ? currentArg.modelInfo.internalID : undefined,
        getMaxTokens: ({ requestBodyForServer }) =>
            Number.isFinite(Number(requestBodyForServer?.generation_config?.maxOutputTokens))
                ? Number(requestBodyForServer.generation_config.maxOutputTokens)
                : undefined,
        getRequestMessages: ({ requestBodyForServer }) =>
            Array.isArray(requestBodyForServer.contents) ? requestBodyForServer.contents : undefined,
        getRequestTools: ({ requestBodyForServer }) =>
            Array.isArray(requestBodyForServer?.tools?.functionDeclarations)
                ? requestBodyForServer.tools.functionDeclarations
                : undefined,
        getFallbackPayloadFields: ({ serverExecEndpoint: endpoint }) => ({
            useClientAssembledRequest: endpoint === '/data/llm/generate',
        }),
    })

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
