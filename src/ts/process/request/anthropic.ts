import { registerClaudeObserver } from "src/ts/observer.svelte"
import { isNodeServer } from "src/ts/platform"
import { getDatabase } from "src/ts/storage/database.svelte"
import { type RequestDataArgumentExtended, type requestDataResponse } from "./request"
import { buildCharacterRagPayload, buildGlobalRagPayload } from "./ragPayload"
import { buildAnthropicRequestPayload } from "./providers/anthropic.payload"
import { requestClaudeHTTP as requestClaudeHTTPImpl } from "./providers/anthropic.response"
import {
    getServerStringSuccessResult,
    parseServerErrorPayload,
    stringifyUnknownResponse,
} from "./request.responses"
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
const anthropicLog = (..._args: unknown[]) => {};

interface Claude3TextBlock {
    type: 'text',
    text: string,
    cache_control?: {
        "type": "ephemeral",
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ImageBlock {
    type: 'image',
    source: {
        type: 'base64'
        media_type: string,
        data: string
    }
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

interface Claude3ToolUseBlock {
    "type": "tool_use",
    "id": string,
    "name": string,
    "input": unknown,
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

export interface Claude3ToolResponseBlock {
    type: "tool_result",
    tool_use_id: string
    content: Claude3ContentBlock[]
    cache_control?: {
        "type": "ephemeral"
        "ttl"?: "5m" | "1h"
    }
}

export type Claude3ContentBlock = Claude3TextBlock|Claude3ImageBlock|Claude3ToolUseBlock|Claude3ToolResponseBlock

export interface Claude3Chat {
    role: 'user'|'assistant'
    content: Claude3ContentBlock[]
}

export interface Claude3ExtendedChat {
    role: 'user'|'assistant'
    content: Claude3ContentBlock[]|string
}

type AnthropicServerErrorPayload = {
    details?: {
        status?: number
        body?: {
            error?: { message?: string }
            message?: string
        }
    }
    status?: number
    message?: string
    error?: string
}

type AnthropicThinkingConfig = {
    budget_tokens?: number | null
    type?: string
}

export type AnthropicRequestBody = {
    messages?: Claude3ExtendedChat[]
    stream?: boolean
    thinking?: AnthropicThinkingConfig
    model?: string
    system?: string
    max_tokens?: number
    [key: string]: unknown
}

async function requestAnthropicServerExecution(arg: RequestDataArgumentExtended, body: Record<string, unknown>): Promise<requestDataResponse> {
    const serverExecEndpoint = resolveServerExecutionEndpoint(arg, true);

    const charRagSettings = arg.currentChar?.ragSettings
    const globalRagSettings = getDatabase().globalRagSettings
    const requestBodyForServer = cloneServerRequestBody(body, {
        stream: !!arg.useStreaming,
    });
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
            provider: 'anthropic',
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            userMessage: latestUserMessage,
            model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
            maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens))
                ? Number(requestBodyForServer.max_tokens)
                : undefined,
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
        }
        : {
            mode: arg.mode ?? 'model',
            provider: 'anthropic',
            characterId: arg.currentChar?.chaId ?? '',
            chatId: arg.chatId ?? '',
            continue: !!arg.continue,
            streaming: !!arg.useStreaming,
            useClientAssembledRequest: serverExecEndpoint === '/data/llm/generate',
            ragSettings: buildCharacterRagPayload(charRagSettings),
            globalRagSettings: buildGlobalRagPayload(globalRagSettings),
            request: {
                requestBody: requestBodyForServer,
                messages: Array.isArray(requestBodyForServer.messages) ? requestBodyForServer.messages : undefined,
                model: typeof requestBodyForServer.model === 'string' ? requestBodyForServer.model : undefined,
                maxTokens: Number.isFinite(Number(requestBodyForServer.max_tokens))
                    ? Number(requestBodyForServer.max_tokens)
                    : undefined,
                tools: Array.isArray(requestBodyForServer.tools) ? requestBodyForServer.tools : undefined,
            },
        };

    if (arg.previewBody) {
        const previewRes = await requestServerPreview(payload, arg);
        const parsed = previewRes.data as unknown;
        if (!previewRes.ok) {
            return {
                type: 'fail',
                result: stringifyUnknownResponse(parsed)
            };
        }
        return {
            type: 'success',
            result: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2),
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
    const parsed = serverRes.data as unknown;

    if (!serverRes.ok) {
        if (typeof parsed === 'string') {
            return { type: 'fail', result: parsed };
        }
        const err = parseServerErrorPayload(
            (typeof parsed === 'object' && parsed !== null) ? parsed as AnthropicServerErrorPayload : undefined,
            serverRes.status
        );
        if (err.code === 'ANTHROPIC_KEY_MISSING') {
            return { type: 'fail', noRetry: true, result: `Anthropic key is missing in server settings.` };
        }
        return {
            type: 'fail',
            failByServerError: err.status >= 500,
            result: err.message,
        };
    }

    const successResult = getServerStringSuccessResult(parsed)
    if (successResult) {
        return {
            type: 'success',
            result: successResult.result,
            newCharEtag: successResult.newCharEtag,
        };
    }

    return {
        type: 'fail',
        result: stringifyUnknownResponse(parsed),
    };
}

export async function requestClaude(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const db = getDatabase()
    const payloadResult = await buildAnthropicRequestPayload(arg, anthropicLog)
    if (payloadResult.type === 'response') {
        return payloadResult.response
    }

    const { body, headers, replacerURL } = payloadResult

    const useServerAnthropic =
        isNodeServer &&
        !(arg.tools && arg.tools.length > 0);

    if (useServerAnthropic) {
        return await requestAnthropicServerExecution(arg, body);
    }

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: replacerURL,
                body: body,
                headers: headers
            })
        }
    }

    if(db.claudeRetrivalCaching){
        registerClaudeObserver({
            url: replacerURL,
            body: body,
            headers: headers
        })
    }

    return requestClaudeHTTP(replacerURL, headers, body, arg)
}

async function requestClaudeHTTP(replacerURL:string, headers:{[key:string]:string}, body:AnthropicRequestBody, arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    return requestClaudeHTTPImpl(replacerURL, headers, body, arg)
}
