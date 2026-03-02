const MODEL_MAPPING = Object.freeze({
    MiniLM: 'Xenova/all-MiniLM-L6-v2',
    MiniLMGPU: 'Xenova/all-MiniLM-L6-v2',
    nomic: 'nomic-ai/nomic-embed-text-v1.5',
    nomicGPU: 'nomic-ai/nomic-embed-text-v1.5',
    bgeSmallEn: 'Xenova/bge-small-en-v1.5',
    bgeSmallEnGPU: 'Xenova/bge-small-en-v1.5',
    bgeLargeEn: 'Xenova/bge-large-en-v1.5',
    bgeLargeEnGPU: 'Xenova/bge-large-en-v1.5',
    bgem3: 'Xenova/bge-m3',
    bgem3GPU: 'Xenova/bge-m3',
    multiMiniLM: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    multiMiniLMGPU: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    bgeM3Ko: 'HyperBlaze/BGE-m3-ko',
    bgeM3KoGPU: 'HyperBlaze/BGE-m3-ko',
});

function toStringOrEmpty(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function resolveEmbeddingModel(modelKey = 'MiniLM') {
    const normalizedKey = toStringOrEmpty(modelKey) || 'MiniLM';
    const modelName = MODEL_MAPPING[normalizedKey] || normalizedKey || 'Xenova/all-MiniLM-L6-v2';
    return {
        requestedKey: normalizedKey,
        key: normalizedKey,
        modelName,
        isAlias: MODEL_MAPPING[normalizedKey] !== undefined,
    };
}

module.exports = {
    MODEL_MAPPING,
    resolveEmbeddingModel,
};
