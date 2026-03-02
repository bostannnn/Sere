const { pipeline, env } = require('@huggingface/transformers');
const path = require('path');
const { resolveEmbeddingModel } = require('./model.cjs');

// Configure cache directory for models
env.cacheDir = path.join(process.cwd(), 'data', 'models');

let embeddingPipeline = null;
let currentModel = null;

/**
 * Gets or initializes the embedding pipeline on the server.
 */
async function getEmbeddingPipeline(modelKey = 'MiniLM', onProgress) {
    const start = Date.now();
    const resolvedModel = resolveEmbeddingModel(modelKey);
    const modelName = resolvedModel.modelName;
    
    if (embeddingPipeline && currentModel === modelName) {
        return embeddingPipeline;
    }

    try {
        console.log(`[RAG-Perf] Initializing server embedding model: ${modelName} (Key: ${resolvedModel.key}). This may take a while if downloading...`);
        embeddingPipeline = await pipeline('feature-extraction', modelName, {
            progress_callback: (info) => {
                if (onProgress) onProgress({ type: 'download', ...info });
            }
        });
        currentModel = modelName;
        console.log(`[RAG-Perf] Embedding model ${modelName} loaded in ${Date.now() - start}ms.`);
        return embeddingPipeline;
    } catch (e) {
        console.error(`[RAG] Failed to initialize embedding model ${modelName}:`, e);
        throw new Error(`Embedding model initialization failed: ${e.message}`);
    }
}

/**
 * Generates embeddings for an array of strings.
 */
async function generateEmbeddings(texts, modelKey, onProgress, signal = null) {
    try {
        const extractor = await getEmbeddingPipeline(modelKey, onProgress);
        const results = [];

        for (const text of texts) {
            // Check for cancellation before each individual embedding
            if (signal && signal.aborted) {
                console.log(`[RAG] Embedding aborted by signal`);
                throw new Error('aborted');
            }
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            results.push(Array.from(output.data));
        }

        return results;
    } catch (e) {
        if (e.message === 'aborted') throw e;
        console.error(`[RAG] Embedding generation failed:`, e);
        throw e;
    }
}

module.exports = {
    generateEmbeddings
};
