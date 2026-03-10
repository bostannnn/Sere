import { getDatabase } from "../storage/database.svelte"
import {
    LLMFlags,
    LLMProvider,
    LLMFormat,
    LLMTokenizer,
    ProviderNames,
    OpenAIParameters,
    ClaudeParameters,
    type LLMModel
} from './types'
import { OpenAIModels } from './providers/openai'
import { AnthropicModels } from './providers/anthropic'
import { GoogleModels } from './providers/google'

// Re-export types for backwards compatibility
export { LLMFlags, LLMProvider, LLMFormat, LLMTokenizer, ProviderNames, OpenAIParameters, ClaudeParameters }
export type { LLMModel }

export const LLMModels: LLMModel[] = [
    ...OpenAIModels,
    ...AnthropicModels,
    // Other providers
    {
        name: 'OpenRouter',
        id: 'openrouter',
        provider: LLMProvider.AsIs,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFullSystemPrompt, LLMFlags.hasImageInput, LLMFlags.hasStreaming],
        parameters: ['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'repetition_penalty', 'min_p', 'top_a', 'top_k'],
        recommended: true,
        tokenizer: LLMTokenizer.Unknown
    },
    // Google models
    ...GoogleModels,
    // Kobold
    {
        name: 'Kobold',
        id: 'kobold',
        provider: LLMProvider.AsIs,
        format: LLMFormat.Kobold,
        flags: [LLMFlags.hasFirstSystemPrompt],
        recommended: true,
        parameters: [
            'temperature',
            'top_p',
            'repetition_penalty',
            'top_k',
            'top_a'
        ],
        tokenizer: LLMTokenizer.Unknown
    },
    // NovelAI
    {
        name: "Clio",
        id: 'novelai',
        provider: LLMProvider.NovelAI,
        format: LLMFormat.NovelAI,
        flags: [LLMFlags.hasFullSystemPrompt],
        recommended: true,
        parameters: [
            'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'
        ],
        tokenizer: LLMTokenizer.NovelAI
    },
    {
        name: "Kayra",
        id: 'novelai_kayra',
        provider: LLMProvider.NovelAI,
        format: LLMFormat.NovelAI,
        flags: [LLMFlags.hasFullSystemPrompt],
        recommended: true,
        parameters: [
            'temperature', 'top_k', 'top_p', 'presence_penalty', 'frequency_penalty'
        ],
        tokenizer: LLMTokenizer.NovelAI
    },
    // Ollama
    {
        id: 'ollama-hosted',
        name: 'Ollama',
        provider: LLMProvider.AsIs,
        format: LLMFormat.Ollama,
        flags: [LLMFlags.hasFullSystemPrompt],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Unknown
    },
    // DeepSeek
    {
        id: 'deepseek-chat',
        name: 'Deepseek Chat',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.hasStreaming],
        parameters: ['frequency_penalty', 'presence_penalty','temperature', 'top_p'],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek',
        recommended: true
    },
    {
        id: 'deepseek-reasoner',
        name: 'Deepseek Reasoner',
        provider: LLMProvider.DeepSeek,
        format: LLMFormat.OpenAICompatible,
        flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekPrefix, LLMFlags.deepSeekThinkingInput, LLMFlags.hasStreaming],
        parameters: [],
        tokenizer: LLMTokenizer.DeepSeek,
        endpoint: 'https://api.deepseek.com/beta/chat/completions',
        keyIdentifier: 'deepseek',
        recommended: true
    },
]

for(const model of LLMModels){
    model.shortName ??= model.name
    model.internalID ??= model.id
    model.fullName ??= model.provider !== LLMProvider.AsIs ? `${ProviderNames.get(model.provider) ?? ''} ${model.name}`.trim() : model.name
}

for(let i=0; i<LLMModels.length; i++){
    if(LLMModels[i].provider === LLMProvider.OpenAI && LLMModels[i].format === LLMFormat.OpenAICompatible){
        LLMModels.push({
            ...LLMModels[i],
            format: LLMFormat.OpenAIResponseAPI,
            flags: [...LLMModels[i].flags, LLMFlags.hasPrefill],
            id: `${LLMModels[i].id}-response-api`,
            name: `${LLMModels[i].name} (Response API)`,
            fullName: `${LLMModels[i].fullName ?? LLMModels[i].name} (Response API)`,
            recommended: false

        })
    }
}

export function getModelInfo(id?: string | null): LLMModel{

    const db = getDatabase()
    if(!id){
        return {
            id: '',
            name: 'Unknown',
            shortName: 'Unknown',
            fullName: 'Unknown',
            internalID: '',
            provider: LLMProvider.AsIs,
            format: LLMFormat.OpenAICompatible,
            flags: [],
            parameters: OpenAIParameters,
            tokenizer: LLMTokenizer.Unknown
        }
    }
    const found = safeStructuredClone(LLMModels.find(model => model.id === id)) as LLMModel | undefined

    if(found){
        if(db.enableCustomFlags){
            found.flags = db.customFlags
        }

        return found
    }

    return {
        id,
        name: id,
        shortName: id,
        fullName: id,
        internalID: id,
        provider: LLMProvider.AsIs,
        format: LLMFormat.OpenAICompatible,
        flags: [],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Unknown
    }
}

interface GetModelListGroup {
    providerName: string
    models: LLMModel[]
}

function isCanonicalServerRuntimeCatalogModel(model: LLMModel): boolean {
    if (!model || typeof model !== 'object') return false

    if (model.id === 'openrouter') return true
    if (model.format === LLMFormat.Kobold) return true
    if (model.format === LLMFormat.Ollama) return true
    if (model.format === LLMFormat.NovelAI) return true

    if (model.provider === LLMProvider.OpenAI && model.format === LLMFormat.OpenAICompatible) return true
    if (model.provider === LLMProvider.DeepSeek && model.format === LLMFormat.OpenAICompatible) return true
    if (
        model.provider === LLMProvider.Anthropic &&
        (model.format === LLMFormat.Anthropic || model.format === LLMFormat.AnthropicLegacy)
    ) return true
    if (model.provider === LLMProvider.GoogleCloud && model.format === LLMFormat.GoogleCloud) return true

    return false
}

export function getModelList<T extends boolean>(arg:{
    recommendedOnly?:boolean,
    groupedByProvider?:T
} = {}): T extends true ? GetModelListGroup[] : LLMModel[]{
    let models = LLMModels.filter((model) => isCanonicalServerRuntimeCatalogModel(model))
    if(arg.recommendedOnly){
        models = models.filter(model => model.recommended)
    }
    if(arg.groupedByProvider){
        const group: GetModelListGroup[] = []
        for(const model of models){
            const providerName = model.provider === LLMProvider.AsIs
                ? '@as-is'
                : (ProviderNames.get(model.provider) || 'Unknown')
            const groupIndex = group.findIndex(g => g.providerName === providerName)
            if(groupIndex === -1){
                group.push({
                    providerName,
                    models: [model]
                })
            }else{
                group[groupIndex].models.push(model)
            }
        }
        return group as unknown as T extends true ? GetModelListGroup[] : LLMModel[]
    }
    return models as unknown as T extends true ? GetModelListGroup[] : LLMModel[]
}
