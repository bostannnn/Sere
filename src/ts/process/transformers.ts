import type { SummarizationOutput, TextToAudioPipeline, FeatureExtractionPipeline, TextGenerationConfig, TextGenerationOutput, ImageToTextOutput } from '@huggingface/transformers';
import { unzip } from 'fflate';
import { globalFetch, loadAsset, saveAsset } from 'src/ts/globalApi.svelte';
import { isNodeServer } from '../platform';
import { selectSingleFile, asBuffer  } from 'src/ts/util';
import { v4 } from 'uuid';
const transformersLog = (..._args: unknown[]) => {};
let tfLoaded = false
const tfMap: { [key: string]: string } = {}
async function initTransformers() {
    if (tfLoaded) {
        return
    }
    const { env } = await import('@huggingface/transformers');
    if (typeof caches === 'undefined') {
        env.useCustomCache = false
        env.useBrowserCache = false
        env.useFSCache = false
    } else {
        const cache = await caches.open('tfCache')
        env.useCustomCache = true
        env.useBrowserCache = false
        env.useFSCache = false
        env.customCache = {
            put: async (url: URL | string, response: Response) => {
                await cache.put(url, response)
            },
            match: async (url: URL | string) => {
                if (typeof url === 'string') {
                    if (Object.keys(tfMap).includes(url)) {
                        const assetId = tfMap[url]
                        return new Response(asBuffer(await loadAsset(assetId)))
                    }
                }
                return await cache.match(url)
            }
        }
    }
    env.localModelPath = "https://sv.risuai.xyz/transformers/"
    env.allowLocalModels = true
    tfLoaded = true
    transformersLog('transformers loaded')
}

export const runTransformers = async (baseText: string, model: string, config: TextGenerationConfig, device: 'webgpu' | 'wasm' = 'wasm') => {
    await initTransformers()
    const { pipeline } = await import('@huggingface/transformers');
    const text = baseText
    const generator = await pipeline('text-generation', model, {
        device
    });
    const output = await generator(text, config) as TextGenerationOutput
    const outputOne = output[0]
    return outputOne
}

export const runSummarizer = async (text: string) => {
    if (isNodeServer) {
        const response = await globalFetch('/data/transformers/summarize', {
            method: 'POST',
            body: { text }
        });
        if (!response.ok) {
            throw new Error(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
        }
        const summary = (response.data as { summary?: string })?.summary;
        if (typeof summary !== 'string') {
            throw new Error('Invalid summarize response payload');
        }
        return summary;
    }
    await initTransformers()
    const { pipeline } = await import('@huggingface/transformers');
    const classifier = await pipeline("summarization", "Xenova/distilbart-cnn-6-6")
    const v = await classifier(text) as SummarizationOutput
    return v[0].summary_text
}

let extractor: FeatureExtractionPipeline | null = null
let lastEmbeddingModelQuery: string = ''
type EmbeddingModel = 'Xenova/all-MiniLM-L6-v2' | 'nomic-ai/nomic-embed-text-v1.5'
export const runEmbedding = async (texts: string[], model: EmbeddingModel = 'Xenova/all-MiniLM-L6-v2', device: 'webgpu' | 'wasm'): Promise<Float32Array[]> => {
    await initTransformers()
    transformersLog('running embedding')
    const embeddingModelQuery = model + device
    const { pipeline } = await import('@huggingface/transformers');
    if (!extractor || embeddingModelQuery !== lastEmbeddingModelQuery) {
        // Dispose old extractor
        if (extractor) {
            await extractor.dispose()
        }
        extractor = await pipeline<"feature-extraction">('feature-extraction', model, {
            // Default dtype for webgpu is fp32, so we can use q8, which is the default dtype in wasm.
            dtype: "q8",
            device: device,
            progress_callback: (progress) => {
                transformersLog(progress)
            }
        });
        lastEmbeddingModelQuery = embeddingModelQuery
        transformersLog('extractor loaded')
    }
    const result = await extractor(texts, { pooling: 'mean', normalize: true });
    transformersLog(texts, result)
    const data = result.data as Float32Array
    transformersLog(data)
    const lenPerText = data.length / texts.length
    const res: Float32Array[] = []
    for (let i = 0; i < texts.length; i++) {
        res.push(data.subarray(i * lenPerText, (i + 1) * lenPerText))
    }
    transformersLog(res)
    return res ?? [];
}

export const runImageEmbedding = async (dataurl: string) => {
    if (isNodeServer) {
        const response = await globalFetch('/data/transformers/image-caption', {
            method: 'POST',
            body: { dataUrl: dataurl }
        });
        if (!response.ok) {
            throw new Error(typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
        }
        const output = (response.data as { output?: ImageToTextOutput })?.output;
        if (!Array.isArray(output)) {
            throw new Error('Invalid image-caption response payload');
        }
        return output;
    }
    await initTransformers()
    const { pipeline } = await import('@huggingface/transformers');
    const captioner = await pipeline('image-to-text', 'Xenova/vit-gpt2-image-captioning');
    const output = await captioner(dataurl)
    return output as ImageToTextOutput
}

let synthesizer: TextToAudioPipeline | null = null
let lastSynth: string | null = null

export interface OnnxModelFiles {
    files: { [key: string]: string },
    id: string,
    name?: string
}

export const runVITS = async (text: string, modelData: string | OnnxModelFiles = 'Xenova/mms-tts-eng') => {
    await initTransformers()
    const { WaveFile } = await import('wavefile')
    const { pipeline, env } = await import('@huggingface/transformers');
    if (modelData === null) {
        return
    }
    if (typeof modelData === 'string') {
        if ((!synthesizer) || (lastSynth !== modelData)) {
            lastSynth = modelData
            synthesizer = await pipeline<"text-to-speech">('text-to-speech', modelData);
        }
    }
    else {
        if ((!synthesizer) || (lastSynth !== modelData.id)) {
            const files = modelData.files
            const keys = Object.keys(files)
            for (const key of keys) {
                const fileURL = env.localModelPath + modelData.id + '/' + key
                tfMap[fileURL] = files[key]
                tfMap[location.origin + fileURL] = files[key]
            }
            lastSynth = modelData.id
            synthesizer = await pipeline<"text-to-speech">('text-to-speech', modelData.id);
        }
    }
    const out = await synthesizer(text, {});
    const wav = new WaveFile();
    wav.fromScratch(1, out.sampling_rate, '32f', out.audio);
    const audioContext = new AudioContext();
    audioContext.decodeAudioData(asBuffer(wav.toBuffer().buffer), (decodedData) => {
        const sourceNode = audioContext.createBufferSource();
        sourceNode.buffer = decodedData;
        sourceNode.connect(audioContext.destination);
        sourceNode.start();
    });
}

export const registerOnnxModel = async (): Promise<OnnxModelFiles | undefined> => {
    const id = v4().replace(/-/g, '')

    const modelFile = await selectSingleFile(['zip'])

    if (!modelFile) {
        return
    }

    const unziped = await new Promise<Record<string, Uint8Array>>((res, rej) => {
        unzip(modelFile.data, {
            filter: (file) => {
                return file.name.endsWith('.onnx') || file.size < 10_000_000 || file.name.includes('.git')
            }
        }, (err, unzipped) => {
            if (err) {
                rej(err)
            }
            else {
                res(unzipped)
            }
        })
    })

    transformersLog(unziped)

    const fileIdMapped: { [key: string]: string } = {}

    const keys = Object.keys(unziped)
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const file = unziped[key]
        const fid = await saveAsset(file)
        let url = key
        if (url.startsWith('/')) {
            url = url.substring(1)
        }
        fileIdMapped[url] = fid
    }

    return {
        files: fileIdMapped,
        name: modelFile.name,
        id: id,
    }

}
