import { Ollama } from 'ollama/dist/browser.mjs';
import { language } from "../../../lang";
import { fetchNative, globalFetch, textifyReadableStream } from "../../globalApi.svelte";
import { getModelInfo, LLMFlags, LLMFormat, LLMProvider, type LLMModel } from "../../model/modellist";
import { risuEscape, risuUnescape } from "../../parser.svelte";
import { pluginV2 } from "../../plugins/plugins.svelte";
import { getCurrentCharacter, getCurrentChat, getDatabase, type character } from "../../storage/database.svelte";
import { tokenizeNum } from "../../tokenizer";
import { sleep } from "../../util";
import type { MultiModal, OpenAIChat } from "../index.svelte";
import { getTools } from "../mcp/mcp";
import type { MCPTool } from "../mcp/mcplib";
import { NovelAIBadWordIds, stringlizeNAIChat } from "../models/nai";
import { stringlizeAINChat, unstringlizeAIN, unstringlizeChat } from "../stringlize";
import { applyChatTemplate } from "../templates/chatTemplate";
import { runTransformers } from "../transformers";
import { runTrigger } from "../triggers";
import { isNodeServer } from '../../platform';
import { requestClaude } from './anthropic';
import { requestGoogleCloudVertex } from './google';
import { requestOpenAI, requestOpenAILegacyInstruct, requestOpenAIResponseAPI } from "./openAI";

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
type ParameterMap = {
    [key in Parameter]?: string;
};

const SERVER_NON_STREAMING_PROVIDERS = new Set(['novelai', 'kobold']);
const llmRequestLog = (..._args: unknown[]) => {};
type GenericObject = Record<string, unknown>;
type ServerGenerateResponse = {
    type?: string;
    result?: unknown;
    newCharEtag?: string;
    error?: string;
};
const getServerGenerateResponse = (raw: unknown): ServerGenerateResponse => {
    if (typeof raw === 'object' && raw !== null) {
        return raw as ServerGenerateResponse;
    }
    return {};
};

function isRemovedProviderModel(aiModel?: string): boolean {
    if (!aiModel) return false
    return (
        aiModel === 'ooba' ||
        aiModel === 'mancer' ||
        aiModel.startsWith('cohere-') ||
        aiModel === 'horde' ||
        aiModel.startsWith('horde:::') ||
        aiModel === 'reverse_proxy' ||
        aiModel.startsWith('xcustom:::') ||
        aiModel.startsWith('mistral-') ||
        aiModel === 'open-mistral-nemo'
    );
}

function isCanonicalServerRuntimeModel(aiModel?: string, modelInfo?: LLMModel): boolean {
    if (!aiModel) return false
    const normalized = aiModel.trim().toLowerCase()
    if (!normalized) return false

    if (modelInfo) {
        if (
            modelInfo.format === LLMFormat.OpenAIResponseAPI ||
            modelInfo.format === LLMFormat.OpenAILegacyInstruct ||
            modelInfo.format === LLMFormat.AWSBedrockClaude ||
            modelInfo.format === LLMFormat.VertexAIGemini ||
            modelInfo.format === LLMFormat.NovelList ||
            modelInfo.format === LLMFormat.WebLLM ||
            modelInfo.format === LLMFormat.Plugin ||
            modelInfo.format === LLMFormat.Echo ||
            modelInfo.format === LLMFormat.Cohere ||
            modelInfo.format === LLMFormat.Horde ||
            modelInfo.format === LLMFormat.Ooba ||
            modelInfo.format === LLMFormat.OobaLegacy ||
            modelInfo.format === LLMFormat.Mistral
        ) {
            return false
        }
    }

    if (
        normalized === 'openrouter' ||
        normalized === 'kobold' ||
        normalized === 'ollama-hosted' ||
        normalized === 'novelai' ||
        normalized === 'novelai_kayra'
    ) {
        return true
    }

    if (
        normalized.startsWith('gpt') ||
        normalized.startsWith('chatgpt') ||
        normalized.startsWith('o1') ||
        normalized.startsWith('o3') ||
        normalized.startsWith('o4') ||
        normalized.startsWith('deepseek') ||
        normalized.startsWith('claude') ||
        normalized.startsWith('gemini') ||
        normalized.startsWith('google')
    ) {
        return true
    }

    if (!modelInfo) return false
    if (modelInfo.provider === LLMProvider.OpenAI && modelInfo.format === LLMFormat.OpenAICompatible) return true
    if (modelInfo.provider === LLMProvider.DeepSeek && modelInfo.format === LLMFormat.OpenAICompatible) return true
    if (
        modelInfo.provider === LLMProvider.Anthropic &&
        (modelInfo.format === LLMFormat.Anthropic || modelInfo.format === LLMFormat.AnthropicLegacy)
    ) return true
    if (modelInfo.provider === LLMProvider.GoogleCloud && modelInfo.format === LLMFormat.GoogleCloud) return true
    if (
        modelInfo.format === LLMFormat.Kobold ||
        modelInfo.format === LLMFormat.Ollama ||
        modelInfo.format === LLMFormat.NovelAI
    ) return true

    return false
}

function resolveServerStreaming(provider: string, requested: boolean) {
    if (!isNodeServer || !requested) return requested;
    if (!SERVER_NON_STREAMING_PROVIDERS.has(provider)) return requested;
    llmRequestLog(`[LLM] Streaming requested for ${provider} on node-server path; falling back to non-streaming.`);
    return false;
}

export function setObjectValue(obj: GenericObject, key: string, value: unknown): GenericObject {

    const splitKey = key.split('.');
    if(splitKey.length > 1){
        const firstKey = splitKey.shift()
        if(!firstKey){
            return obj;
        }
        const child = obj[firstKey];
        const childObject: GenericObject = (typeof child === 'object' && child !== null && !Array.isArray(child))
            ? (child as GenericObject)
            : {};
        obj[firstKey] = setObjectValue(childObject, splitKey.join('.'), value);
        return obj;
    }

    obj[key] = value;
    return obj;
}

export function applyParameters(data: GenericObject, parameters: Parameter[], rename: ParameterMap, ModelMode:ModelModeExtended, arg:{
    ignoreTopKIfZero?:boolean
} = {}): GenericObject {
    const db = getDatabase()

    function getEffort(effort:number){
        switch(effort){
            case -1:{
                return 'minimal'
            }
            case 0:{
                return 'low'
            }
            case 1:{
                return 'medium'
            }
            case 2:{
                return 'high'
            }
            default:{
                return 'medium'
            }
        }
    }

    function getVerbosity(verbosity:number){
        switch(verbosity){
            case 0:{
                return 'low'
            }
            case 1:{
                return 'medium'
            }
            case 2:{
                return 'high'
            }
            default:{
                return 'medium'
            }
        }
    }

    if(db.seperateParametersEnabled && ModelMode !== 'model'){
        if(ModelMode === 'submodel'){
            ModelMode = 'otherAx'
        }

        for(const parameter of parameters){
            
            let value:number|string = 0
            if(parameter === 'top_k' && arg.ignoreTopKIfZero && db.seperateParameters[ModelMode][parameter] === 0){
                continue
            }

            switch(parameter){
                case 'temperature':{
                    value = db.seperateParameters[ModelMode].temperature === -1000 ? -1000 : (db.seperateParameters[ModelMode].temperature / 100)
                    break
                }
                case 'top_k':{
                    value = db.seperateParameters[ModelMode].top_k
                    break
                }
                case 'repetition_penalty':{
                    value = db.seperateParameters[ModelMode].repetition_penalty
                    break
                }
                case 'min_p':{
                    value = db.seperateParameters[ModelMode].min_p
                    break
                }
                case 'top_a':{
                    value = db.seperateParameters[ModelMode].top_a
                    break
                }
                case 'top_p':{
                    value = db.seperateParameters[ModelMode].top_p
                    break
                }
                case 'thinking_tokens':{
                    value = db.seperateParameters[ModelMode].thinking_tokens
                    break
                }
                case 'frequency_penalty':{
                    value = db.seperateParameters[ModelMode].frequency_penalty === -1000 ? -1000 : (db.seperateParameters[ModelMode].frequency_penalty / 100)
                    break
                }
                case 'presence_penalty':{
                    value = db.seperateParameters[ModelMode].presence_penalty === -1000 ? -1000 : (db.seperateParameters[ModelMode].presence_penalty / 100)
                    break
                }
                case 'reasoning_effort':{
                    value = getEffort(db.seperateParameters[ModelMode].reasoning_effort)
                    break
                }
                case 'verbosity':{
                    value = getVerbosity(db.seperateParameters[ModelMode].verbosity)
                    break
                }
            }

            if(value === -1000 || value === undefined || value === null || (typeof value === 'number' && isNaN(value))){
                continue
            }

            data = setObjectValue(data, rename[parameter] ?? parameter, value)
        }
        return data
    }


    for(const parameter of parameters){
        let value:number|string = 0
        if(parameter === 'top_k' && arg.ignoreTopKIfZero && db.top_k === 0){
            continue
        }
        switch(parameter){
            case 'temperature':{
                value = db.temperature === -1000 ? -1000 : (db.temperature / 100)
                break
            }
            case 'top_k':{
                value = db.top_k
                break
            }
            case 'repetition_penalty':{
                value = db.repetition_penalty
                break
            }
            case 'min_p':{
                value = db.min_p
                break
            }
            case 'top_a':{
                value = db.top_a
                break
            }
            case 'top_p':{
                value = db.top_p
                break
            }
            case 'reasoning_effort':{
                value = getEffort(db.reasoningEffort)
                break
            }
            case 'verbosity':{
                value = getVerbosity(db.verbosity)
                break
            }
            case 'frequency_penalty':{
                value = db.frequencyPenalty === -1000 ? -1000 : (db.frequencyPenalty / 100)
                break
            }
            case 'presence_penalty':{
                value = db.PresensePenalty === -1000 ? -1000 : (db.PresensePenalty / 100)
                break
            }
            case 'thinking_tokens':{
                value = db.thinkingTokens
                break
            }
        }

        if(value === -1000){
            continue
        }

        data = setObjectValue(data, rename[parameter] ?? parameter, value)
    }
    return data
}

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
    
            if(pluginV2.replacerbeforeRequest.size > 0){
                for(const replacer of pluginV2.replacerbeforeRequest){
                    arg.formated = await replacer(arg.formated, model)
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
    
            if(da.type === 'success' && pluginV2.replacerafterRequest.size > 0){
                for(const replacer of pluginV2.replacerafterRequest){
                    da.result = await replacer(da.result, model)
                }
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
                if(fallbackIndex === fallBackModels.length-1 || da.model === 'custom'){
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
    if (!isCanonicalServerRuntimeModel(targ.aiModel, targ.modelInfo)) {
        return {
            type: 'fail',
            noRetry: true,
            result: `${language.errors.httpError}Provider is not supported in server-first runtime: ${targ.aiModel}`,
        }
    }

    switch(format){
        case LLMFormat.OpenAICompatible:
            return requestOpenAI(targ)
        case LLMFormat.OpenAILegacyInstruct:
            return requestOpenAILegacyInstruct(targ)
        case LLMFormat.NovelAI:
            return requestNovelAI(targ)
        case LLMFormat.VertexAIGemini:
        case LLMFormat.GoogleCloud:
            return requestGoogleCloudVertex(targ)
        case LLMFormat.Kobold:
            return requestKobold(targ)
        case LLMFormat.NovelList:
            return requestNovelList(targ)
        case LLMFormat.Ollama:
            return requestOllama(targ)
        case LLMFormat.Anthropic:
        case LLMFormat.AnthropicLegacy:
        case LLMFormat.AWSBedrockClaude:
            return requestClaude(targ)
        case LLMFormat.WebLLM:
            return requestWebLLM(targ)
        case LLMFormat.OpenAIResponseAPI:
            return requestOpenAIResponseAPI(targ)
        case LLMFormat.Echo:
            return requestEcho(targ)
    }

    return {
        type: 'fail',
        result: (language.errors.unknownModel)
    }
}




async function requestNovelAI(arg:RequestDataArgumentExtended):Promise<requestDataResponse>{
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const temperature = arg.temperature
    const maxTokens = arg.maxTokens
    const biasString = arg.biasString
    const currentChar = getCurrentCharacter()
    const prompt = stringlizeNAIChat(formated, currentChar?.name ?? '', arg.continue)
    const abortSignal = arg.abortSignal
    const logit_bias_exp:{
        sequence: number[], bias: number, ensure_sequence_finish: false, generate_once: true
    }[] = []

    if(arg.previewBody && !isNodeServer){
        return {
            type: 'success',
            result: JSON.stringify({
                error: "This model is not supported in preview mode"
            })
        }
    }

    for(let i=0;i<biasString.length;i++){
        const bia = biasString[i]
        const tokens = await tokenizeNum(bia[0])

        const tokensInNumberArray:number[] = []

        for(const token of tokens){
            tokensInNumberArray.push(token)
        }
        logit_bias_exp.push({
            sequence: tokensInNumberArray,
            bias: bia[1],
            ensure_sequence_finish: false,
            generate_once: true
        })
    }

    let prefix = 'vanilla'

    if(db.NAIadventure){
        prefix = 'theme_textadventure'
    }

    const gen = db.NAIsettings
    const payload = {
        temperature:temperature,
        max_length: maxTokens,
        min_length: 1,
        top_k: gen.topK,
        top_p: gen.topP,
        top_a: gen.topA,
        tail_free_sampling: gen.tailFreeSampling,
        repetition_penalty: gen.repetitionPenalty,
        repetition_penalty_range: gen.repetitionPenaltyRange,
        repetition_penalty_slope: gen.repetitionPenaltySlope,
        repetition_penalty_frequency: gen.frequencyPenalty,
        repetition_penalty_presence: gen.presencePenalty,
        generate_until_sentence: true,
        use_cache: false,
        use_string: true,
        return_full_text: false,
        prefix: prefix,
        order: [6, 2, 3, 0, 4, 1, 5, 8],
        typical_p: gen.typicalp,
        repetition_penalty_whitelist:[49256,49264,49231,49230,49287,85,49255,49399,49262,336,333,432,363,468,492,745,401,426,623,794,1096,2919,2072,7379,1259,2110,620,526,487,16562,603,805,761,2681,942,8917,653,3513,506,5301,562,5010,614,10942,539,2976,462,5189,567,2032,123,124,125,126,127,128,129,130,131,132,588,803,1040,49209,4,5,6,7,8,9,10,11,12],
        stop_sequences: [[49287], [49405]],
        bad_words_ids: NovelAIBadWordIds,
        logit_bias_exp: logit_bias_exp,
        mirostat_lr: gen.mirostat_lr ?? 1,
        mirostat_tau: gen.mirostat_tau ?? 0,
        cfg_scale: gen.cfg_scale ?? 1,
        cfg_uc: ""   
    }

    

      
    const body = {
        "input": prompt,
        "model": aiModel === 'novelai_kayra' ? 'kayra-v1' : 'clio-v1',
        "parameters":payload
    }

    const effectiveStreaming = resolveServerStreaming('novelai', !!arg.useStreaming)

    const makeServerPayload = () => ({
        useClientAssembledRequest: true,
        streaming: effectiveStreaming,
        mode: arg.mode ?? 'model',
        provider: 'novelai',
        characterId: arg.currentChar?.chaId ?? '',
        chatId: arg.chatId ?? '',
        continue: !!arg.continue,
        ragSettings: arg.currentChar?.ragSettings ? {
            enabled: arg.currentChar.ragSettings.enabled === true,
            enabledRulebooks: Array.isArray(arg.currentChar.ragSettings.enabledRulebooks) ? arg.currentChar.ragSettings.enabledRulebooks : [],
        } : undefined,
        globalRagSettings: db.globalRagSettings ? {
            topK: db.globalRagSettings.topK,
            minScore: db.globalRagSettings.minScore,
            budget: db.globalRagSettings.budget,
            model: db.globalRagSettings.model,
        } : undefined,
        request: {
            requestBody: body,
            model: body.model,
            maxTokens: arg.maxTokens,
            prompt,
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
                    result: typeof previewRes.data === 'string' ? previewRes.data : JSON.stringify(previewRes.data),
                }
            }
            return {
                type: 'success',
                result: JSON.stringify(previewRes.data, null, 2),
            }
        }

        const serverRes = await globalFetch('/data/llm/generate', {
            method: 'POST',
            body: makeServerPayload(),
            abortSignal: arg.abortSignal,
            chatId: arg.chatId,
        })
        const rawData = serverRes.data as unknown
        const data = getServerGenerateResponse(rawData)
        if (!serverRes.ok) {
            const errCode = String(data?.error || '')
            if (errCode === 'NOVELAI_KEY_MISSING') {
                return {
                    type: 'fail',
                    noRetry: true,
                    result: `${language.errors.httpError}NovelAI key is missing in server settings.`,
                }
            }
            return {
                type: 'fail',
                result: (language.errors.httpError + `${typeof rawData === 'string' ? rawData : JSON.stringify(rawData)}`)
            }
        }
        if (data?.type === 'success' && typeof data?.result === 'string') {
            return {
                type: "success",
                result: unstringlizeChat(data.result, formated, currentChar?.name ?? ''),
                newCharEtag: data.newCharEtag,
            }
        }
        return {
            type: 'fail',
            result: (language.errors.httpError + `${typeof rawData === 'string' ? rawData : JSON.stringify(rawData)}`)
        }
    }

    const da = await globalFetch(aiModel === 'novelai_kayra' ? "https://text.novelai.net/ai/generate" : "https://api.novelai.net/ai/generate", {
        body: body,
        headers: {
            "Authorization": "Bearer " + (arg.key ?? db.novelai.token)
        },
        abortSignal,
        chatId: arg.chatId,
    })

    if((!da.ok )|| (!da.data.output)){
        return {
            type: 'fail',
            result: (language.errors.httpError + `${JSON.stringify(da.data)}`)
        }
    }
    return {
        type: "success",
        result: unstringlizeChat(da.data.output, formated, currentChar?.name ?? '')
    }
}

async function requestEcho(_arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const db = getDatabase()
    const delay = db.echoDelay ?? 0
    const message = db.echoMessage ?? "Echo Message"

    if(delay > 0){
        await sleep(delay * 1000)
    }

    return {
        type: 'success',
        result: message
    }
}

async function requestKobold(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const maxTokens = arg.maxTokens
    const abortSignal = arg.abortSignal

    const prompt = applyChatTemplate(formated)
    const url = new URL(db.koboldURL)
    if(url.pathname.length < 3){
        url.pathname = 'api/v1/generate'
    }

    const body = applyParameters({
        "prompt": prompt,
        max_length: maxTokens,
        max_context_length: db.maxContext,
        n: 1
    }, [
        'temperature',
        'top_p',
        'repetition_penalty',
        'top_k',
        'top_a'
    ], {
        'repetition_penalty': 'rep_pen'
    }, arg.mode) as unknown as KoboldGenerationInputSchema

    const effectiveStreaming = resolveServerStreaming('kobold', !!arg.useStreaming)

    const makeServerPayload = () => ({
        useClientAssembledRequest: true,
        mode: arg.mode ?? 'model',
        provider: 'kobold',
        characterId: arg.currentChar?.chaId ?? '',
        chatId: arg.chatId ?? '',
        continue: !!arg.continue,
        streaming: effectiveStreaming,
        ragSettings: arg.currentChar?.ragSettings ? {
            enabled: arg.currentChar.ragSettings.enabled === true,
            enabledRulebooks: Array.isArray(arg.currentChar.ragSettings.enabledRulebooks) ? arg.currentChar.ragSettings.enabledRulebooks : [],
        } : undefined,
        globalRagSettings: db.globalRagSettings ? {
            topK: db.globalRagSettings.topK,
            minScore: db.globalRagSettings.minScore,
            budget: db.globalRagSettings.budget,
            model: db.globalRagSettings.model,
        } : undefined,
        request: {
            requestBody: {
                ...body,
                kobold_url: db.koboldURL,
            },
            prompt,
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
        const serverRes = await globalFetch('/data/llm/generate', {
            method: 'POST',
            body: makeServerPayload(),
            abortSignal: arg.abortSignal,
            chatId: arg.chatId,
        })
        const rawData = serverRes.data as unknown
        const data = getServerGenerateResponse(rawData)
        if (!serverRes.ok) {
            return {
                type: 'fail',
                result: typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
                noRetry: true
            }
        }
        if (data?.type === 'success' && typeof data?.result === 'string') {
            return {
                type: 'success',
                result: data.result,
                newCharEtag: data.newCharEtag,
            }
        }
        return {
            type: 'fail',
            result: typeof rawData === 'string' ? rawData : JSON.stringify(rawData),
            noRetry: true
        }
    }

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: url.toString(),
                body: body,
                headers: {}
            })      
        }
    }
    
    const da = await globalFetch(url.toString(), {
        method: "POST",
        body: body,
        headers: {
            "content-type": "application/json",
        },
        abortSignal,
        chatId: arg.chatId
    })

    if(!da.ok){
        return {
            type: "fail",
            result: da.data,
            noRetry: true
        }
    }

    const data = da.data
    return {
        type: 'success',
        result: data.results[0].text
    }
}

async function requestNovelList(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {

    const formated = arg.formated
    const db = getDatabase()
    const maxTokens = arg.maxTokens
    const temperature = arg.temperature
    const biasString = arg.biasString
    const currentChar = getCurrentCharacter()
    const aiModel = arg.aiModel
    const auth_key = db.novellistAPI;
    const api_server_url = 'https://api.tringpt.com/';
    const logit_bias:string[] = []
    const logit_bias_values:string[] = []
    for(let i=0;i<biasString.length;i++){
        const bia = biasString[i]
        logit_bias.push(bia[0])
        logit_bias_values.push(bia[1].toString())
    }
    const headers = {
        'Authorization': `Bearer ${auth_key}`,
        'Content-Type': 'application/json'
    };
    
    const send_body = {
        text: stringlizeAINChat(formated, currentChar?.name ?? '', arg.continue),
        length: maxTokens,
        temperature: temperature,
        top_p: db.ainconfig.top_p,
        top_k: db.ainconfig.top_k,
        rep_pen: db.ainconfig.rep_pen,
        top_a: db.ainconfig.top_a,
        rep_pen_slope: db.ainconfig.rep_pen_slope,
        rep_pen_range: db.ainconfig.rep_pen_range,
        typical_p: db.ainconfig.typical_p,
        badwords: db.ainconfig.badwords,
        model: aiModel === 'novellist_damsel' ? 'damsel' : 'supertrin',
        stoptokens: ["「"].join("<<|>>") + db.ainconfig.stoptokens,
        logit_bias: (logit_bias.length > 0) ? logit_bias.join("<<|>>") : undefined,
        logit_bias_values: (logit_bias_values.length > 0) ? logit_bias_values.join("|") : undefined,
    };


    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                url: api_server_url + '/api',
                body: send_body,
                headers: headers
            })      
        }
    }
    const response = await globalFetch(arg.customURL ?? api_server_url + '/api', {
        method: 'POST',
        headers: headers,
        body: send_body,
        chatId: arg.chatId,
        abortSignal: arg.abortSignal
    });

    if(!response.ok){
        return {
            type: 'fail',
            result: response.data
        }
    }

    if(response.data.error){
        return {
            'type': 'fail',
            'result': `${response.data.error.replace("token", "api key")}`
        }
    }

    const result = response.data.data[0];
    const unstr = unstringlizeAIN(result, formated, currentChar?.name ?? '')
    return {
        'type': 'multiline',
        'result': unstr
    }
}

async function requestOllama(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
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
        ragSettings: arg.currentChar?.ragSettings ? {
            enabled: arg.currentChar.ragSettings.enabled === true,
            enabledRulebooks: Array.isArray(arg.currentChar.ragSettings.enabledRulebooks) ? arg.currentChar.ragSettings.enabledRulebooks : [],
        } : undefined,
        globalRagSettings: db.globalRagSettings ? {
            topK: db.globalRagSettings.topK,
            minScore: db.globalRagSettings.minScore,
            budget: db.globalRagSettings.budget,
            model: db.globalRagSettings.model,
        } : undefined,
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
        if(arg.previewBody){
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
                                    if (parsed.newCharEtag) {
                                        controller.enqueue({ "__newCharEtag": parsed.newCharEtag });
                                    }
                                    controller.close();
                                    return;
                                } else if (parsed.type === 'error' || parsed.type === 'fail') {
                                    controller.enqueue({ "0": `Error: ${parsed.message || parsed.error || 'Server stream failed'}` });
                                    controller.close();
                                    return;
                                }
                            } catch {}
                        }
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
        const data = getServerGenerateResponse(rawData)
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
                result: JSON.stringify(rawData),
            }
        }
        if (data?.type === 'success' && typeof data?.result === 'string') {
            return {
                type: 'success',
                result: data.result,
                newCharEtag: data.newCharEtag,
            }
        }
        return {
            type: 'fail',
            result: JSON.stringify(rawData),
        }
    }

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                error: "Preview body is not supported for Ollama"
            })
        }
    }

    const ollama = new Ollama({host: db.ollamaURL})

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
        async start(controller){
            for await(const chunk of response){
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


async function requestWebLLM(arg:RequestDataArgumentExtended):Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const currentChar = getCurrentCharacter()
    const maxTokens = arg.maxTokens
    const temperature = arg.temperature
    const realModel = aiModel.split(":::")[1]
    const prompt = applyChatTemplate(formated)

    if(arg.previewBody){
        return {
            type: 'success',
            result: JSON.stringify({
                error: "Preview body is not supported for WebLLM"
            })
        }
    }
    const v = await runTransformers(prompt, realModel, {
        temperature: temperature,
        max_new_tokens: maxTokens,
        top_k: db.ooba.top_k,
        top_p: db.ooba.top_p,
        repetition_penalty: db.ooba.repetition_penalty,
        typical_p: db.ooba.typical_p,
    } as Parameters<typeof runTransformers>[2])
    return {
        type: 'success',
        result: unstringlizeChat(v.generated_text as string, formated, currentChar?.name ?? '')
    }
}

export interface KoboldSamplerSettingsSchema {
    rep_pen?: number;
    rep_pen_range?: number;
    rep_pen_slope?: number;
    top_k?: number;
    top_a?: number;
    top_p?: number;
    tfs?: number;
    typical?: number;
    temperature?: number;
}

export interface KoboldGenerationInputSchema extends KoboldSamplerSettingsSchema {
    prompt: string;
    use_memory?: boolean;
    use_story?: boolean;
    use_authors_note?: boolean;
    use_world_info?: boolean;
    use_userscripts?: boolean;
    soft_prompt?: string;
    max_length?: number;
    max_context_length?: number;
    n: number;
    disable_output_formatting?: boolean;
    frmttriminc?: boolean;
    frmtrmblln?: boolean;
    frmtrmspch?: boolean;
    singleline?: boolean;
    disable_input_formatting?: boolean;
    frmtadsnsp?: boolean;
    quiet?: boolean;
    sampler_order?: number[];
    sampler_seed?: number;
    sampler_full_determinism?: boolean;
}
