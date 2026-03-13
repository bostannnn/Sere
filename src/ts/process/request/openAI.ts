/* eslint-disable @typescript-eslint/no-explicit-any */

import type { OpenAIToolCall, RequestDataArgumentExtended, requestDataResponse, StreamResponseChunk } from "./request"
import { LLMFormat } from "src/ts/model/modellist"
import { addFetchLog, fetchNative, textifyReadableStream } from "src/ts/globalApi.svelte"
import { isNodeServer, isTauri } from "src/ts/platform"
import type { OpenAIChatFull } from "../index.svelte"
import { buildOpenAIRequestPayload } from "./providers/openai.payload";
import { requestDeepSeekServerExecution, requestOpenAIServerExecution, requestOpenRouterServerExecution } from "./providers/openai.server";
import {
    requestHTTPOpenAI as requestHTTPOpenAIImpl,
} from "./providers/openai.response";
import { getTranStream as getOpenAITranStreamImpl, wrapToolStream as wrapOpenAIToolStreamImpl } from "./providers/openai.stream";
const openAiRequestLog = (..._args: unknown[]) => {};
export { requestOpenAILegacyInstruct, requestOpenAIResponseAPI } from "./providers/openai.legacy";

export type OpenAIHttpResponse = {
    type?: string
    result?: string | {
        type?: string
        result?: string
        message?: string
        error?: string
        newCharEtag?: string
        [key: string]: unknown
    }
    newCharEtag?: string
    message?: string
    error?: {
        message?: string
        [key: string]: unknown
    }
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
    choices?: Array<{
        text?: string
        message: OpenAIChatFull & {
            reasoning_content?: string
            reasoning?: string
            tool_calls?: OpenAIToolCall[]
        }
        reasoning_content?: string
        [key: string]: unknown
    }>
    [key: string]: unknown
}

export async function requestOpenAI(arg:RequestDataArgumentExtended):Promise<requestDataResponse>{
    const aiModel = arg.aiModel
    const payloadResult = await buildOpenAIRequestPayload(arg, openAiRequestLog)
    if (payloadResult.type === 'response') {
        return payloadResult.response
    }

    const { body, headers, replacerURL } = payloadResult

    const isNodeServerOpenAIPath =
        isNodeServer &&
        arg.modelInfo.format === LLMFormat.OpenAICompatible &&
        aiModel !== 'openrouter' &&
        !aiModel.startsWith('deepseek');

    if (isNodeServer && aiModel === 'openrouter') {
        return await requestOpenRouterServerExecution(arg, body)
    }
    if (isNodeServerOpenAIPath) {
        return await requestOpenAIServerExecution(arg, body)
    }
    if (isNodeServer && aiModel.startsWith('deepseek')) {
        return await requestDeepSeekServerExecution(arg, body)
    }
    if(arg.useStreaming){
        body.stream = true
        const urlHost = new URL(replacerURL).host
        if(urlHost.includes("localhost") || urlHost.includes("172.0.0.1") || urlHost.includes("0.0.0.0")){
            if(!isTauri){
                return {
                    type: 'fail',
                    result: 'You are trying local request on streaming. this is not allowed dude to browser/os security policy. turn off streaming.',
                }
            }
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
        const da = await fetchNative(replacerURL, {
            body: JSON.stringify(body),
            method: "POST",
            headers: headers,
            signal: arg.abortSignal,
            chatId: arg.chatId
        })

        if(da.status !== 200){
            return {
                type: "fail",
                result: await textifyReadableStream(da.body)
            }
        }

        if (!da.headers.get('Content-Type').includes('text/event-stream')){
            return {
                type: "fail",
                result: await textifyReadableStream(da.body)
            }
        }

        addFetchLog({
            body: body,
            response: "Streaming",
            success: true,
            url: replacerURL,
            status: da.status,
        })

        const transtream = getTranStream(arg)

        da.body.pipeTo(transtream.writable)

        return {
            type: 'streaming',
            result: wrapToolStream(transtream.readable, body, headers, replacerURL, arg)
        }
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

    return requestHTTPOpenAI(replacerURL, body, headers, arg)

}

export async function requestHTTPOpenAI(replacerURL:string, body:any, headers:Record<string,string>, arg:RequestDataArgumentExtended):Promise<requestDataResponse>{
    return requestHTTPOpenAIImpl(replacerURL, body, headers, arg)
}

function getTranStream(arg:RequestDataArgumentExtended):TransformStream<Uint8Array, StreamResponseChunk> {
    return getOpenAITranStreamImpl(arg)
}

function wrapToolStream(
    stream: ReadableStream<StreamResponseChunk>,
    body:any,
    headers:Record<string,string>,
    replacerURL:string,
    arg:RequestDataArgumentExtended
):ReadableStream<StreamResponseChunk> {
    return wrapOpenAIToolStreamImpl(stream, body, headers, replacerURL, arg)
}
