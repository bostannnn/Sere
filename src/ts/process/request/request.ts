import { language } from "../../../lang";
import { getModelInfo, LLMFlags, LLMFormat, type LLMModel } from "../../model/modellist";
import { risuEscape, risuUnescape } from "../../parser.svelte";
import { getCurrentCharacter, getCurrentChat, getDatabase, type character } from "../../storage/database.svelte";
import { sleep } from "../../util";
import type { MultiModal, OpenAIChat } from "../index.svelte";
import { getTools } from "../mcp/mcp";
import type { MCPTool } from "../mcp/mcplib";
import { runTrigger } from "../triggers";
import { requestClaude } from './anthropic';
import { requestGoogleCloudVertex } from './google';
import { requestOpenAI, requestOpenAILegacyInstruct, requestOpenAIResponseAPI } from "./openAI";
import { requestKobold, requestNovelAI } from "./request.local";
import { requestOllama } from "./request.ollama";
import { isRemovedProviderModel } from "./request.routing";

export type ToolCall = {
    name: string;
    arguments: string;
}

interface requestDataArgument{
    formated: OpenAIChat[]
    bias: {[key:number]:number}
    biasString?: [string,number][]
    currentChar?: character
    temperature?: number
    maxTokens?:number
    PresensePenalty?: number
    frequencyPenalty?: number,
    useStreaming?:boolean
    isGroupChat?:boolean
    useEmotion?:boolean
    continue?:boolean
    chatId?:string
    noMultiGen?:boolean
    schema?:string
    extractJson?:string
    imageResponse?:boolean
    previewBody?:boolean
    staticModel?: string
    escape?:boolean
    tools?: MCPTool[]
}

export interface RequestDataArgumentExtended extends requestDataArgument{
    aiModel?:string
    multiGen?:boolean
    abortSignal?:AbortSignal
    modelInfo?:LLMModel
    customURL?:string
    mode?:ModelModeExtended
    key?:string
    additionalOutput?:string
}

export type requestDataResponse = {
    type: 'success'|'fail'
    result: string
    noRetry?: boolean,
    special?: {
        emotion?: string
    },
    failByServerError?: boolean
    model?: string
    newCharEtag?: string
}|{
    type: "streaming",
    result: ReadableStream<StreamResponseChunk>,
    special?: {
        emotion?: string
    }
    model?: string
}|{
    type: "multiline",
    result: ['user'|'char',string][],
    special?: {
        emotion?: string
    }
    model?: string
}

export interface StreamResponseChunk{[key:string]:string}

export type Parameter = 'temperature'|'top_k'|'repetition_penalty'|'min_p'|'top_a'|'top_p'|'frequency_penalty'|'presence_penalty'|'reasoning_effort'|'thinking_tokens'|'verbosity'
export type ModelModeExtended = 'model'|'submodel'|'memory'|'emotion'|'otherAx'|'translate'

const llmRequestLog = (..._args: unknown[]) => {};
export { applyParameters, setObjectValue } from "./request.parameters";

export async function requestChatData(arg:requestDataArgument, model:ModelModeExtended, abortSignal:AbortSignal=null):Promise<requestDataResponse> {
    const db = getDatabase()
    if (typeof arg.chatId !== 'string' || arg.chatId.trim().length === 0) {
        const activeChatId = getCurrentChat()?.id;
        if (typeof activeChatId === 'string' && activeChatId.trim().length > 0) {
            arg.chatId = activeChatId;
        }
    }
    const fallBackModels:string[] = safeStructuredClone(db?.fallbackModels?.[model] ?? [])
    const tools = await getTools()
    fallBackModels.push('')
    let da:requestDataResponse

    if(arg.escape){
        arg.useStreaming = false
        llmRequestLog('Escape is enabled, disabling streaming')
    }

    const originalFormated = safeStructuredClone(arg.formated).map(m => {
        m.content = risuUnescape(m.content)
        return m
    })

    for(let fallbackIndex=0;fallbackIndex<fallBackModels.length;fallbackIndex++){
        let trys = 0
        arg.formated = safeStructuredClone(originalFormated)

        if(fallbackIndex !== 0 && !fallBackModels[fallbackIndex]){
            continue
        }

        while(true){
            
            if(abortSignal?.aborted){
                return {
                    type: 'fail',
                    result: 'Aborted'
                }
            }
            
            try{
                const currentChar = getCurrentCharacter()
                if(currentChar?.type !== 'group'){
                    const perf = performance.now()
                const d = await runTrigger(currentChar, 'request', {
                    chat: getCurrentChat(),
                    displayMode: true,
                    displayData: JSON.stringify(arg.formated)
                })
                if(d && typeof d.displayData === 'string'){
                    const got = JSON.parse(d.displayData)
                    if(!got || !Array.isArray(got)){
                        throw new Error('Invalid return')
                    }
                    arg.formated = got
                }
                llmRequestLog('Trigger time', performance.now() - perf)
                }
            }
            catch(e){
                llmRequestLog(e)
            }
            
    
            da = await requestChatDataMain({
                ...arg,
                staticModel: fallBackModels[fallbackIndex],
                tools: tools,
            }, model, abortSignal)

            if(abortSignal?.aborted){
                return {
                    type: 'fail',
                    result: 'Aborted'
                }
            }

            if(da.type === 'success' && arg.escape){
                da.result = risuEscape(da.result)
            }
    
            if(da.type === 'success' && db.banCharacterset?.length > 0){
                let failed = false
                for(const set of db.banCharacterset){
                    llmRequestLog(set)
                    const checkRegex = new RegExp(`\\p{Script=${set}}`, 'gu')
    
                    if(checkRegex.test(da.result)){
                        trys += 1
                        failed = true
                        break
                    }
                }
    
                if(failed){
                    continue
                }
            }
    
            if(da.type === 'success' && fallbackIndex !== fallBackModels.length-1 && db.fallbackWhenBlankResponse){
                if(da.result.trim() === ''){
                    break
                }
            }
    
            if(da.type !== 'fail' || da.noRetry){
                return {
                    ...da,
                    model: fallBackModels[fallbackIndex]
                }
            }
    
            if(da.failByServerError){
                await sleep(1000)
                if(db.antiServerOverloads){
                    trys -= 0.5 // reduce trys by 0.5, so that it will retry twice as much
                }
            }
            
            trys += 1
            if(trys > db.requestRetrys){
                if(fallbackIndex === fallBackModels.length-1){
                    return da
                }
                break
            }
        }   
    }


    return da ?? {
        type: 'fail',
        result: "All models failed"
    }
}

export interface OpenAITextContents {
    type: 'text'
    text: string
}

export interface OpenAIImageContents {
    type: 'image'|'image_url'
    image_url: {
        url: string
        detail: string
    }
}

export type OpenAIContents = OpenAITextContents|OpenAIImageContents

export interface OpenAIToolCall {
    id:string,
    type:'function',
    function:{
        name:string,
        arguments:string
    },
}

export interface OpenAIChatExtra {
    role: 'system'|'user'|'assistant'|'function'|'developer'|'tool'
    content: string|OpenAIContents[]
    memo?:string
    name?:string
    removable?:boolean
    attr?:string[]
    multimodals?:MultiModal[]
    thoughts?:string[]
    prefix?:boolean
    reasoning_content?:string
    cachePoint?:boolean
    function?: {
        name: string
        description?: string
        parameters: unknown
        strict: boolean
    }
    tool_call_id?: string
    tool_calls?: OpenAIToolCall[]
}

export function reformater(formated:OpenAIChat[],modelInfo:LLMModel|LLMFlags[]){

    const flags = Array.isArray(modelInfo) ? modelInfo : modelInfo.flags
    
    const db = getDatabase()
    let systemPrompt:OpenAIChat|null = null

    if(!flags.includes(LLMFlags.hasFullSystemPrompt)){
        if(flags.includes(LLMFlags.hasFirstSystemPrompt)){
            while(formated[0].role === 'system'){
                if(systemPrompt){
                    systemPrompt.content += '\n\n' + formated[0].content
                }
                else{
                    systemPrompt = formated[0]
                }
                formated = formated.slice(1)
            }
        }

        for(let i=0;i<formated.length;i++){
            if(formated[i].role === 'system'){
                formated[i].content = db.systemContentReplacement ? db.systemContentReplacement.replace('{{slot}}', formated[i].content) : `system: ${formated[i].content}`
                formated[i].role = db.systemRoleReplacement
            }
        }
    }
    
    if(flags.includes(LLMFlags.requiresAlternateRole)){
        const newFormated:OpenAIChat[] = []
        for(let i=0;i<formated.length;i++){
            const m = formated[i]
            if(newFormated.length === 0){
                newFormated.push(m)
                continue
            }

            if(newFormated[newFormated.length-1].role === m.role){
            
                newFormated[newFormated.length-1].content += '\n' + m.content

                if(m.multimodals){
                    if(!newFormated[newFormated.length-1].multimodals){
                        newFormated[newFormated.length-1].multimodals = []
                    }
                    newFormated[newFormated.length-1].multimodals.push(...m.multimodals)
                }

                if(m.thoughts){
                    if(!newFormated[newFormated.length-1].thoughts){
                        newFormated[newFormated.length-1].thoughts = []
                    }
                    newFormated[newFormated.length-1].thoughts.push(...m.thoughts)
                }

                if(m.cachePoint){
                    if(!newFormated[newFormated.length-1].cachePoint){
                        newFormated[newFormated.length-1].cachePoint = true
                    }
                }

                continue
            }
            else{
                newFormated.push(m)
            }
        }
        formated = newFormated
    }

    if(flags.includes(LLMFlags.mustStartWithUserInput)){
        if(formated.length === 0 || formated[0].role !== 'user'){
            formated.unshift({
                role: 'user',
                content: ' '
            })
        }
    }

    if(systemPrompt){
        formated.unshift(systemPrompt)
    }

    return formated
}


export async function requestChatDataMain(arg:requestDataArgument, model:ModelModeExtended, abortSignal:AbortSignal=null):Promise<requestDataResponse> {
    const db = getDatabase()
    const targ:RequestDataArgumentExtended = arg
    targ.formated = safeStructuredClone(arg.formated)
    targ.maxTokens = arg.maxTokens ??db.maxResponse
    targ.temperature = arg.temperature ?? (db.temperature / 100)
    targ.bias = arg.bias
    targ.currentChar = arg.currentChar
    targ.useStreaming = db.useStreaming && arg.useStreaming
    targ.continue = arg.continue ?? false
    targ.biasString = arg.biasString ?? []
    targ.aiModel = arg.staticModel ? arg.staticModel : (model === 'model' ? db.aiModel : db.subModel)
    targ.multiGen = ((db.genTime > 1 && targ.aiModel.startsWith('gpt') && (!arg.continue)) && (!arg.noMultiGen))
    targ.abortSignal = abortSignal
    targ.modelInfo = getModelInfo(targ.aiModel)
    targ.mode = model
    targ.extractJson = arg.extractJson ?? db.extractJson

    if(db.seperateModelsForAxModels && !arg.staticModel){
        if(db.seperateModels[model]){
            targ.aiModel = db.seperateModels[model]
            targ.modelInfo = getModelInfo(targ.aiModel)
        }
    }

    const format = targ.modelInfo.format

    targ.formated = reformater(targ.formated, targ.modelInfo)

    if (isRemovedProviderModel(targ.aiModel)) {
        return {
            type: 'fail',
            noRetry: true,
            result: `${language.errors.httpError}Provider has been removed: ${targ.aiModel}`,
        }
    }
    switch(format){
        case LLMFormat.OpenAICompatible:
            return requestOpenAI(targ)
        case LLMFormat.OpenAILegacyInstruct:
            return requestOpenAILegacyInstruct(targ)
        case LLMFormat.NovelAI:
            return requestNovelAI(targ)
        case LLMFormat.GoogleCloud:
            return requestGoogleCloudVertex(targ)
        case LLMFormat.Kobold:
            return requestKobold(targ)
        case LLMFormat.Ollama:
            return requestOllama(targ)
        case LLMFormat.Anthropic:
        case LLMFormat.AnthropicLegacy:
            return requestClaude(targ)
        case LLMFormat.OpenAIResponseAPI:
            return requestOpenAIResponseAPI(targ)
    }

    return {
        type: 'fail',
        result: (language.errors.unknownModel)
    }
}
