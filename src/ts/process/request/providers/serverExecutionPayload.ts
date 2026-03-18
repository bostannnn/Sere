/* eslint-disable @typescript-eslint/no-explicit-any */

import { getDatabase } from "src/ts/storage/database.svelte"
import type { RequestDataArgumentExtended } from "../request"
import { buildCharacterRagPayload, buildGlobalRagPayload } from "../ragPayload"
import {
    cloneServerRequestBody,
    getLatestUserMessage,
    hasMultimodalMessages,
    resolveServerExecutionEndpoint,
} from "../request.transport"

type ServerExecutionPayloadPlannerContext<TBody extends Record<string, any>> = {
    arg: RequestDataArgumentExtended
    body: TBody
    database: ReturnType<typeof getDatabase>
    requestBodyForServer: TBody
    serverExecEndpoint: string
    latestUserMessage: string
    hasMultimodal: boolean
    model: string | undefined
    maxTokens: number | undefined
}

type ServerExecutionPayloadPlannerOptions<TBody extends Record<string, any>> = {
    arg: RequestDataArgumentExtended
    body: TBody
    provider: string
    requestBodyCloneOptions?: {
        stream?: boolean
    }
    canUseGenerateEndpoint?: boolean | ((arg: RequestDataArgumentExtended) => boolean)
    isRawGenerateEligible?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => boolean
    getModel?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => string | undefined
    getMaxTokens?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => number | undefined
    getRequestMessages?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => unknown
    getRequestPrompt?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => string | undefined
    getRequestTools?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => unknown
    getSharedPayloadFields?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => Record<string, unknown>
    getRawPayloadFields?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => Record<string, unknown>
    getFallbackPayloadFields?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => Record<string, unknown>
    getRequestFields?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => Record<string, unknown>
    buildRawRequestWrapper?: (ctx: ServerExecutionPayloadPlannerContext<TBody>) => Record<string, unknown> | undefined
}

export type ServerExecutionPayloadPlan<TBody extends Record<string, any>> = {
    serverExecEndpoint: string
    requestBodyForServer: TBody
    canUseRawGeneratePayload: boolean
    payload: Record<string, unknown>
}

export function buildServerExecutionPayloadPlan<TBody extends Record<string, any>>(
    options: ServerExecutionPayloadPlannerOptions<TBody>
): ServerExecutionPayloadPlan<TBody> {
    const canUseGenerateEndpoint = typeof options.canUseGenerateEndpoint === 'function'
        ? options.canUseGenerateEndpoint(options.arg)
        : options.canUseGenerateEndpoint ?? true
    const serverExecEndpoint = resolveServerExecutionEndpoint(options.arg, canUseGenerateEndpoint)
    const requestBodyForServer = cloneServerRequestBody(options.body, options.requestBodyCloneOptions)
    const latestUserMessage = getLatestUserMessage(options.arg.formated)
    const hasMultimodal = hasMultimodalMessages(options.arg.formated)
    const database = getDatabase()

    const baseContext = {
        arg: options.arg,
        body: options.body,
        database,
        requestBodyForServer,
        serverExecEndpoint,
        latestUserMessage,
        hasMultimodal,
    }
    const model = options.getModel?.({
        ...baseContext,
        model: undefined,
        maxTokens: undefined,
    })
    const maxTokens = options.getMaxTokens?.({
        ...baseContext,
        model,
        maxTokens: undefined,
    })
    const context: ServerExecutionPayloadPlannerContext<TBody> = {
        ...baseContext,
        model,
        maxTokens,
    }

    const canUseRawGeneratePayload =
        serverExecEndpoint === '/data/llm/generate'
        && !options.arg.previewBody
        && !!(options.arg.currentChar?.chaId)
        && !!options.arg.chatId
        && !!latestUserMessage
        && !hasMultimodal
        && (options.isRawGenerateEligible?.(context) ?? true)
    const sharedPayloadFields = options.getSharedPayloadFields?.(context)
    const rawPayloadFields = canUseRawGeneratePayload ? options.getRawPayloadFields?.(context) : undefined
    const fallbackPayloadFields = canUseRawGeneratePayload ? undefined : options.getFallbackPayloadFields?.(context)
    const requestFields = options.getRequestFields?.(context)
    const rawRequestWrapper = canUseRawGeneratePayload ? options.buildRawRequestWrapper?.(context) : undefined

    const sharedPayload = {
        mode: options.arg.mode ?? 'model',
        provider: options.provider,
        characterId: options.arg.currentChar?.chaId ?? '',
        chatId: options.arg.chatId ?? '',
        continue: !!options.arg.continue,
        streaming: !!options.arg.useStreaming,
        ragSettings: buildCharacterRagPayload(options.arg.currentChar?.ragSettings),
        globalRagSettings: buildGlobalRagPayload(database.globalRagSettings),
        ...sharedPayloadFields,
    }

    const payload = canUseRawGeneratePayload
        ? {
            ...sharedPayload,
            userMessage: latestUserMessage,
            model,
            maxTokens,
            ...rawPayloadFields,
            ...(rawRequestWrapper
                ? { request: rawRequestWrapper }
                : {}),
        }
        : {
            ...sharedPayload,
            ...fallbackPayloadFields,
            request: {
                requestBody: requestBodyForServer,
                messages: options.getRequestMessages?.(context),
                prompt: options.getRequestPrompt?.(context),
                model,
                maxTokens,
                tools: options.getRequestTools?.(context),
                ...requestFields,
            },
        }

    return {
        serverExecEndpoint,
        requestBodyForServer,
        canUseRawGeneratePayload,
        payload,
    }
}
