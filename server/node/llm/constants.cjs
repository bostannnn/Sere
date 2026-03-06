// Streaming transport policy (server-side execution layer, not model capability).
// - native: provider path supports streaming through current server adapter.
// - error: requests with streaming=true should fail explicitly.
const STREAMING_PROVIDER_POLICY = Object.freeze({
    openrouter: 'native',
    openai: 'native',
    deepseek: 'native',
    anthropic: 'native',
    google: 'native',
    ollama: 'native',
    kobold: 'error',
    novelai: 'error',
    unknown: 'error',
});

const ALLOWED_MODES = new Set([
    'model',
    'submodel',
    'memory',
    'emotion',
    'otherAx',
    'translate',
]);

function normalizeProvider(rawProvider, rawModel) {
    const provider = typeof rawProvider === 'string' ? rawProvider.trim().toLowerCase() : '';
    if (provider) {
        return provider;
    }

    const model = typeof rawModel === 'string' ? rawModel.trim().toLowerCase() : '';
    if (!model) {
        return 'unknown';
    }
    if (model === 'openrouter' || model.startsWith('openrouter')) {
        return 'openrouter';
    }
    if (
        model.startsWith('gpt') ||
        model.startsWith('chatgpt') ||
        model.startsWith('o1') ||
        model.startsWith('o3') ||
        model.startsWith('o4')
    ) {
        return 'openai';
    }
    if (model.startsWith('deepseek')) {
        return 'deepseek';
    }
    if (model.startsWith('claude') || model.startsWith('anthropic')) {
        return 'anthropic';
    }
    if (model.startsWith('gemini') || model.startsWith('google')) {
        return 'google';
    }
    if (model.startsWith('ollama')) {
        return 'ollama';
    }
    if (model.startsWith('kobold')) {
        return 'kobold';
    }
    if (model.startsWith('novelai')) {
        return 'novelai';
    }
    return 'unknown';
}

function getStreamingPolicy(provider) {
    const key = typeof provider === 'string' ? provider.trim().toLowerCase() : 'unknown';
    return STREAMING_PROVIDER_POLICY[key] || STREAMING_PROVIDER_POLICY.unknown;
}

module.exports = {
    ALLOWED_MODES,
    normalizeProvider,
    STREAMING_PROVIDER_POLICY,
    getStreamingPolicy,
};
