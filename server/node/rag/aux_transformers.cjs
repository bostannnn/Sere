const { pipeline } = require('@huggingface/transformers');

let summarizerPipeline = null;
let imageCaptionPipeline = null;
let summarizerPipelinePromise = null;
let imageCaptionPipelinePromise = null;

async function getSummarizerPipeline() {
    if (summarizerPipeline) return summarizerPipeline;
    if (summarizerPipelinePromise) return await summarizerPipelinePromise;
    summarizerPipelinePromise = pipeline('summarization', 'Xenova/distilbart-cnn-6-6')
        .then((instance) => {
            summarizerPipeline = instance;
            return instance;
        })
        .finally(() => {
            summarizerPipelinePromise = null;
        });
    return await summarizerPipelinePromise;
}

async function getImageCaptionPipeline() {
    if (imageCaptionPipeline) return imageCaptionPipeline;
    if (imageCaptionPipelinePromise) return await imageCaptionPipelinePromise;
    imageCaptionPipelinePromise = pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning')
        .then((instance) => {
            imageCaptionPipeline = instance;
            return instance;
        })
        .finally(() => {
            imageCaptionPipelinePromise = null;
        });
    return await imageCaptionPipelinePromise;
}

async function summarizeTextWithTransformers(text) {
    const input = String(text || '').trim();
    if (!input) {
        throw new Error('text is required');
    }
    const summarizer = await getSummarizerPipeline();
    const output = await summarizer(input);
    const summary = Array.isArray(output) ? output[0]?.summary_text : null;
    if (typeof summary !== 'string' || summary.length === 0) {
        throw new Error('summarization output is invalid');
    }
    return summary;
}

async function captionImageWithTransformers(dataUrl) {
    const input = String(dataUrl || '').trim();
    if (!input) {
        throw new Error('dataUrl is required');
    }
    const captioner = await getImageCaptionPipeline();
    const output = await captioner(input);
    if (!Array.isArray(output)) {
        throw new Error('image caption output is invalid');
    }
    return output;
}

module.exports = {
    summarizeTextWithTransformers,
    captionImageWithTransformers,
};
