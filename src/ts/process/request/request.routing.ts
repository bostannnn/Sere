import { LLMFormat, LLMProvider, type LLMModel } from "../../model/modellist"
import { isNodeServer } from "../../platform"

const SERVER_NON_STREAMING_PROVIDERS = new Set(['novelai', 'kobold'])

export function isRemovedProviderModel(aiModel?: string): boolean {
    if (!aiModel) return false
    const normalized = aiModel.trim().toLowerCase()
    return (
        normalized === 'ooba' ||
        normalized === 'textgen_webui' ||
        normalized === 'mancer' ||
        normalized.startsWith('cohere-') ||
        normalized === 'horde' ||
        normalized.startsWith('horde:::') ||
        normalized === 'reverse_proxy' ||
        normalized.startsWith('xcustom:::') ||
        normalized.startsWith('mistral-') ||
        normalized === 'open-mistral-nemo' ||
        normalized === 'novellist' ||
        normalized === 'novellist_damsel' ||
        normalized === 'echo_model' ||
        normalized.startsWith('hf:::') ||
        normalized.startsWith('deepinfra_') ||
        normalized.startsWith('anthropic.claude-') ||
        normalized.endsWith('-vertex')
    )
}

export function isCanonicalServerRuntimeModel(aiModel?: string, modelInfo?: LLMModel): boolean {
    if (!aiModel) return false
    const normalized = aiModel.trim().toLowerCase()
    if (!normalized) return false

    if (modelInfo) {
        if (
            modelInfo.format === LLMFormat.OpenAILegacyInstruct ||
            modelInfo.format === LLMFormat.OpenAIResponseAPI ||
            modelInfo.format === LLMFormat.Ooba ||
            modelInfo.format === LLMFormat.OobaLegacy
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

export function resolveServerStreaming(provider: string, requested: boolean, log: (...args: unknown[]) => void = () => {}): boolean {
    if (!isNodeServer || !requested) return requested
    if (!SERVER_NON_STREAMING_PROVIDERS.has(provider)) return requested
    log(`[LLM] Streaming requested for ${provider} on node-server path; falling back to non-streaming.`)
    return false
}
