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

function makeDeepInfraModels(id:string[]):LLMModel[]{
    return id.map((id) => {
        return {
            id: 'deepinfra_' + id,
            name: id,
            internalID: id,
            provider: LLMProvider.DeepInfra,
            format: LLMFormat.OpenAICompatible,
            parameters: ['frequency_penalty', 'presence_penalty','temperature', 'top_p'],
            flags: [LLMFlags.hasFirstSystemPrompt, LLMFlags.requiresAlternateRole, LLMFlags.mustStartWithUserInput, LLMFlags.hasPrefill, LLMFlags.deepSeekThinkingOutput, LLMFlags.hasStreaming],
            tokenizer: LLMTokenizer.DeepSeek,
            endpoint: 'https://api.deepinfra.com/v1/openai/chat/completions',
            keyIdentifier: 'deepinfra',
            recommended: true
        } as LLMModel
    })
}

export const LLMModels: LLMModel[] = [
    ...OpenAIModels,
    ...AnthropicModels,
    // AWS Bedrock Claude models
    {
        name: 'Claude 4.5 Sonnet (20250929) v1',
        id: 'anthropic.claude-sonnet-4-5-20250929-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [
            LLMFlags.hasPrefill,
            LLMFlags.hasImageInput,
            LLMFlags.hasFirstSystemPrompt,
            LLMFlags.claudeThinking
        ],
        parameters: [...ClaudeParameters, 'thinking_tokens'],
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 4.1 Opus (20250805) v1',
        id: 'anthropic.claude-opus-4-1-20250805-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [
            LLMFlags.hasPrefill,
            LLMFlags.hasImageInput,
            LLMFlags.hasFirstSystemPrompt,
            LLMFlags.claudeThinking
        ],
        parameters: [...ClaudeParameters, 'thinking_tokens'],
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 4 Opus (20250514) v1',
        id: 'anthropic.claude-opus-4-20250514-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [
            LLMFlags.hasPrefill,
            LLMFlags.hasImageInput,
            LLMFlags.hasFirstSystemPrompt,
            LLMFlags.claudeThinking
        ],
        parameters: [...ClaudeParameters, 'thinking_tokens'],
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 4 Sonnet (20250514) v1',
        id: 'anthropic.claude-sonnet-4-20250514-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [
            LLMFlags.hasPrefill,
            LLMFlags.hasImageInput,
            LLMFlags.hasFirstSystemPrompt,
            LLMFlags.claudeThinking
        ],
        parameters: [...ClaudeParameters, 'thinking_tokens'],
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 3.7 Sonnet (20250219) v1',
        id: 'anthropic.claude-3-7-sonnet-20250219-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [
            LLMFlags.hasPrefill,
            LLMFlags.hasImageInput,
            LLMFlags.hasFirstSystemPrompt,
            LLMFlags.claudeThinking
        ],
        parameters: [...ClaudeParameters, 'thinking_tokens'],
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 3.5 Sonnet (20241022) v2',
        id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [LLMFlags.hasPrefill, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt],
        parameters: ClaudeParameters,
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 3.5 Sonnet (20240620) v1',
        id: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [LLMFlags.hasPrefill, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt],
        parameters: ClaudeParameters,
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 3 Opus (20240229) v1',
        id: 'anthropic.claude-3-opus-20240229-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [LLMFlags.hasPrefill, LLMFlags.hasImageInput, LLMFlags.hasFirstSystemPrompt],
        parameters: ClaudeParameters,
        tokenizer: LLMTokenizer.Claude
    },
    {
        name: 'Claude 3 Sonnet (20240229) v1',
        id: 'anthropic.claude-3-sonnet-20240229-v1:0',
        provider: LLMProvider.AWS,
        format: LLMFormat.AWSBedrockClaude,
        flags: [
            LLMFlags.hasPrefill,
            LLMFlags.hasImageInput,
            LLMFlags.hasFirstSystemPrompt
        ],
        parameters: ClaudeParameters,
        tokenizer: LLMTokenizer.Claude
    },
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
    // NovelList
    {
        name: "SuperTrin",
        id: 'novellist',
        provider: LLMProvider.NovelList,
        format: LLMFormat.NovelList,
        flags: [],
        parameters: [],
        tokenizer: LLMTokenizer.NovelList
    },
    {
        name: "Damsel",
        id: 'novellist_damsel',
        provider: LLMProvider.NovelList,
        format: LLMFormat.NovelList,
        flags: [],
        parameters: [],
        tokenizer: LLMTokenizer.NovelList
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
    // WebLLM
    {
        id: 'hf:::Xenova/opt-350m',
        name: 'opt-350m',
        provider: LLMProvider.WebLLM,
        format: LLMFormat.WebLLM,
        flags: [LLMFlags.hasFullSystemPrompt],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Local
    },
    {
        id: 'hf:::Xenova/tiny-random-mistral',
        name: 'tiny-random-mistral',
        provider: LLMProvider.WebLLM,
        format: LLMFormat.WebLLM,
        flags: [LLMFlags.hasFullSystemPrompt],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Local
    },
    {
        id: 'hf:::Xenova/gpt2-large-conversational',
        name: 'gpt2-large-conversational',
        provider: LLMProvider.WebLLM,
        format: LLMFormat.WebLLM,
        flags: [LLMFlags.hasFullSystemPrompt],
        parameters: OpenAIParameters,
        tokenizer: LLMTokenizer.Local
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
    // DeepInfra
    ...makeDeepInfraModels([
        'deepseek-ai/DeepSeek-R1',
        'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
        'deepseek-ai/DeepSeek-V3',
        'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        'meta-llama/Llama-3.3-70B-Instruct',
        'microsoft/phi-4',
        'meta-llama/Meta-Llama-3.1-70B-Instruct',
        'meta-llama/Meta-Llama-3.1-8B-Instruct',
        'meta-llama/Meta-Llama-3.1-405B-Instruct',
        'Qwen/QwQ-32B-Preview',
        'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        'Qwen/Qwen2.5-Coder-32B-Instruct',
        'nvidia/Llama-3.1-Nemotron-70B-Instruct',
        'Qwen/Qwen2.5-72B-Instruct',
        'meta-llama/Llama-3.2-90B-Vision-Instruct',
        'meta-llama/Llama-3.2-11B-Vision-Instruct',
        'microsoft/WizardLM-2-8x22B',
        '01-ai/Yi-34B-Chat',
        'Austism/chronos-hermes-13b-v2',
        'Gryphe/MythoMax-L2-13b',
        'Gryphe/MythoMax-L2-13b-turbo',
        'Sao10K/L3.3-70B-Euryale-v2.3',
        'Sao10K/L3.1-70B-Euryale-v2.2',
        'Sao10K/L3-70B-Euryale-v2.1',
        'google/gemma-2-27b-it',
        'google/gemma-2-9b-it'
    ]),
    {
        id: 'echo_model',
        name: "Echo",
        provider: LLMProvider.Echo,
        format: LLMFormat.Echo,
        flags: [LLMFlags.hasFullSystemPrompt],
        recommended: false,
        parameters: [],
        tokenizer: LLMTokenizer.Unknown
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
    if(LLMModels[i].provider === LLMProvider.GoogleCloud){
        LLMModels.push({
            ...LLMModels[i],
            id: `${LLMModels[i].id}-vertex`,
            name: `${LLMModels[i].name} Vertex`,
            fullName: `${LLMModels[i].fullName ?? LLMModels[i].name} Vertex`,
            flags: [...LLMModels[i].flags],
            recommended: false,
            provider: LLMProvider.VertexAI,
            format: LLMFormat.VertexAIGemini
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

    if(id.startsWith('hf:::')){
        const withoutPrefix = id.replace('hf:::', '')
        return {
            id,
            name: withoutPrefix,
            shortName: withoutPrefix,
            fullName: withoutPrefix,
            internalID: withoutPrefix,
            provider: LLMProvider.WebLLM,
            format: LLMFormat.WebLLM,
            flags: [],
            parameters: OpenAIParameters,
            tokenizer: LLMTokenizer.Local
        }
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
