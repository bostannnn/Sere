import { alertError } from "../alert";
import { getCurrentCharacter, getDatabase, type character } from "../storage/database.svelte";
import { runTranslator, translateVox } from "../translator/translator";
import { globalFetch, loadAsset } from "../globalApi.svelte";
import { language } from "src/lang";
import { sleep } from "../util";
import { runVITS } from "./transformers";
const ttsLog = (..._args: unknown[]) => {};

type GptSoVitsConfig = NonNullable<character['gptSoVitsConfig']>;
type GptSoVitsRequestBody = {
    text: string;
    text_lang?: GptSoVitsConfig['text_lang'];
    ref_audio_path?: string;
    ref_audio_name: string;
    ref_audio_data: string;
    prompt_text?: string | null;
    prompt_lang?: GptSoVitsConfig['prompt_lang'];
    top_p?: number;
    temperature?: number;
    speed_factor?: number;
    top_k?: number;
    text_split_method?: GptSoVitsConfig['text_split_method'];
    parallel_infer: boolean;
    ref_free: boolean;
};

let sourceNode: AudioBufferSourceNode | null = null

export async function sayTTS(character: character | null | undefined, text: string) {
    try {
        if(!character){
            const v = getCurrentCharacter()
            if(v.type === 'group'){
                return
            }
            character = v
        }

        if(!text){
            return
        }
    
        const db = getDatabase()
        text = text.replace(/\*/g,'')
    
        if(character.ttsReadOnlyQuoted){
            const matches = text.match(/["「](.*?)["」]/g)
            if(matches && matches.length > 0){
                text = matches.map(match => match.slice(1, -1)).join("");
            }
            else{
                text = ''
            }
        }
    
        switch(character.ttsMode){
            case "webspeech":{
                if(speechSynthesis && SpeechSynthesisUtterance){
                    const utterThis = new SpeechSynthesisUtterance(text);
                    const voices = speechSynthesis.getVoices();
                    let voiceIndex = 0
                    for(let i=0;i<voices.length;i++){
                        if(voices[i].name === character.ttsSpeech){
                            voiceIndex = i
                        }
                    }
                    utterThis.voice = voices[voiceIndex]
                    speechSynthesis.speak(utterThis)
                }
                break
            }
            case "elevenlab": {
                const audioContext = new AudioContext();
                const elevenHeaders: Record<string, string> = {
                    "Content-Type": "application/json",
                };
                if (db.elevenLabKey) {
                    elevenHeaders['xi-api-key'] = db.elevenLabKey;
                }
                const da = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${character.ttsSpeech}`, {
                    body: JSON.stringify({
                        text: text,
                        model_id: "eleven_multilingual_v2"
                    }),
                    method: "POST",
                    headers: elevenHeaders
                })
                if(da.status >= 200 && da.status < 300){
                    const audioBuffer = await audioContext.decodeAudioData(await da.arrayBuffer())
                    sourceNode = audioContext.createBufferSource();
                    sourceNode.buffer = audioBuffer;
                    sourceNode.connect(audioContext.destination);            
                    sourceNode.start();
                }
                else{
                    alertError(await da.text())
                }
                break
            }
            case "VOICEVOX": {
                const voicevoxConfig = character.voicevoxConfig;
                if (!voicevoxConfig) {
                    throw new Error('VOICEVOX config is missing');
                }
                const jpText = await translateVox(text)
                const audioContext = new AudioContext();
                const query = await fetch(`${db.voicevoxUrl}/audio_query?text=${jpText}&speaker=${character.ttsSpeech}`, {
                    method: 'POST',
                    headers: { "Content-Type": "application/json"},
                })
                if (query.status == 200){
                    const queryJson = await query.json();
                    const bodyData = {
                        accent_phrases: queryJson.accent_phrases,
                        speedScale: voicevoxConfig.SPEED_SCALE ?? 1,
                        pitchScale: voicevoxConfig.PITCH_SCALE ?? 0,
                        volumeScale: voicevoxConfig.VOLUME_SCALE ?? 1,
                        intonationScale: voicevoxConfig.INTONATION_SCALE ?? 1,
                        prePhonemeLength: queryJson.prePhonemeLength,
                        postPhonemeLength: queryJson.postPhonemeLength,
                        outputSamplingRate: queryJson.outputSamplingRate,
                        outputStereo: queryJson.outputStereo,
                        kana: queryJson.kana,
                    }
                    const getVoice = await fetch(`${db.voicevoxUrl}/synthesis?speaker=${character.ttsSpeech}`, {
                        method: 'POST',
                        headers: { "Content-Type": "application/json"},
                        body: JSON.stringify(bodyData),
                    })
                    if (getVoice.status == 200 && getVoice.headers.get('content-type') === 'audio/wav'){
                        const audioBuffer = await audioContext.decodeAudioData(await getVoice.arrayBuffer())
                        sourceNode = audioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(audioContext.destination);
                        sourceNode.start();
                    }
                }
                break
            }
            case 'openai':{
                const key = db.openAIKey
                const res = await globalFetch('https://api.openai.com/v1/audio/speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + key,
                    },
                    body: {
                        model: 'tts-1',
                        input: text,
                        voice: character.oaiVoice,
                        
                    },
                    rawResponse: true,
                })
                const dat = res.data
    
                if(res.ok){
                    try {
                        const audio = Buffer.from(dat).buffer
                        const audioContext = new AudioContext();
                        const audioBuffer = await audioContext.decodeAudioData(audio)
                        sourceNode = audioContext.createBufferSource();
                        sourceNode.buffer = audioBuffer;
                        sourceNode.connect(audioContext.destination);
                        sourceNode.start();
                    } catch (error) {                    
                        alertError(language.errors.httpError + `${error}`)
                    }
                }
                else{
                    if(dat.error && dat.error.message){                    
                        alertError((language.errors.httpError + `${dat.error.message}`))
                    }
                    else{                    
                        alertError((language.errors.httpError + `${Buffer.from(res.data).toString()}`))
                    }
                }
                break;
    
            }
            case 'novelai': {
                const naittsConfig = character.naittsConfig;
                if (!naittsConfig?.voice || !naittsConfig.version) {
                    throw new Error('NovelAI TTS config is missing');
                }
                const audioContext = new AudioContext();
                if(text === ''){
                    break;
                }
                const encodedText = encodeURIComponent(text);
                const encodedSeed = encodeURIComponent(naittsConfig.voice);
    
                const url = `https://api.novelai.net/ai/generate-voice?text=${encodedText}&voice=-1&seed=${encodedSeed}&opus=false&version=${naittsConfig.version}`;
    
                const response = await globalFetch(url, {
                    method: 'GET',
                    headers: {
                        "Authorization": "Bearer " + db.novelai.token,
                    },
                    rawResponse: true
                });
            
                if (response.ok) {
                    const audioBuffer = response.data.buffer;
                    audioContext.decodeAudioData(audioBuffer, (decodedData) => {
                        const sourceNode = audioContext.createBufferSource();
                        sourceNode.buffer = decodedData;
                        sourceNode.connect(audioContext.destination);
                        sourceNode.start();
                    });
                } else {
                    alertError("Error fetching or decoding audio data");
                }
                break;
            }
            case 'huggingface': {
                const hfTTS = character.hfTTS;
                if (!hfTTS?.model || !hfTTS.language) {
                    throw new Error('HuggingFace TTS config is missing');
                }
                while(true){
                    if(hfTTS.language !== 'en'){
                        text = await runTranslator(text, false, 'en', hfTTS.language)
                    }
                    const audioContext = new AudioContext();
                    const response = await fetch(`https://api-inference.huggingface.co/models/${hfTTS.model}`, {
                        method: 'POST',
                        headers: {
                            "Authorization": "Bearer " + db.huggingfaceKey,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            inputs: text,
                        })
                    });
        
                    if(response.status === 503 && response.headers.get('content-type') === 'application/json'){
                        const json = await response.json()
                        if(json.estimated_time){
                            await sleep(json.estimated_time * 1000)
                            continue
                        }
                    }
                    else if(response.status >= 400){
                        alertError(language.errors.httpError + `${await response.text()}`)
                        return
                    }
                    else if (response.status === 200) {
                        const audioBuffer = await response.arrayBuffer();
                        audioContext.decodeAudioData(audioBuffer, (decodedData) => {
                            const sourceNode = audioContext.createBufferSource();
                            sourceNode.buffer = decodedData;
                            sourceNode.connect(audioContext.destination);
                            sourceNode.start();
                        });
                    } else {
                        alertError("Error fetching or decoding audio data");
                    }
                    return
                }
            }
            case 'vits':{
                await runVITS(text, character.vits)
                break;
            }
            case 'gptsovits':{
                const gptSoVitsConfig = character.gptSoVitsConfig;
                if (!gptSoVitsConfig?.url || !gptSoVitsConfig.ref_audio_data?.assetId || !gptSoVitsConfig.ref_audio_data.fileName) {
                    throw new Error('GPT-SoVITS config is missing');
                }
                const audioContext = new AudioContext();

                const audio: Uint8Array = await loadAsset(gptSoVitsConfig.ref_audio_data.assetId);
                const base64Audio = btoa(new Uint8Array(audio).reduce((data, byte) => data + String.fromCharCode(byte), ''));

                const body: GptSoVitsRequestBody = {
                    text: text,
                    text_lang: gptSoVitsConfig.text_lang,
                    ref_audio_name: gptSoVitsConfig.ref_audio_data.fileName,
                    ref_audio_data: base64Audio,
                    prompt_lang: gptSoVitsConfig.prompt_lang,
                    top_p: gptSoVitsConfig.top_p,
                    temperature: gptSoVitsConfig.temperature,
                    speed_factor: gptSoVitsConfig.speed,
                    top_k: gptSoVitsConfig.top_k,
                    text_split_method: gptSoVitsConfig.text_split_method,
                    parallel_infer: true,
                    // media_type: gptSoVitsConfig.ref_audio_data.fileName.split('.')[1],
                    ref_free: !!gptSoVitsConfig.use_long_audio || !gptSoVitsConfig.use_prompt,
                }

                if (gptSoVitsConfig.use_prompt){
                    body.prompt_text = gptSoVitsConfig.prompt ?? null
                }

                if (gptSoVitsConfig.use_auto_path){
                    ttsLog('auto')
                    const path = await globalFetch(`${gptSoVitsConfig.url}/get_path`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        rawResponse: false,
                        plainFetchDeforce: true,
                    })
                    ttsLog(path)
                    if(path.ok){
                        body.ref_audio_path = path.data.message + '/public/audio/' + gptSoVitsConfig.ref_audio_data.fileName
                    }
                    else{
                        throw new Error('Failed to Auto get path')
                    }
                } else {
                    body.ref_audio_path = `${gptSoVitsConfig.ref_audio_path || ''}/public/audio/${gptSoVitsConfig.ref_audio_data.fileName}`
                }
                ttsLog(body)

                const response = await globalFetch(`${gptSoVitsConfig.url}/tts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: body,
                    rawResponse: true,
                })
                ttsLog(response)

                if (response.ok) {
                    const audioBuffer = response.data.buffer;
                    audioContext.decodeAudioData(audioBuffer, (decodedData) => {
                        const sourceNode = audioContext.createBufferSource();
                        sourceNode.buffer = decodedData;
                        
                        const gainNode = audioContext.createGain();
                        gainNode.gain.value = gptSoVitsConfig.volume || 1.0;
                        
                        sourceNode.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        sourceNode.start();
                    });
                } else {
                    const textBuffer: Uint8Array = response.data.buffer
                    const text = Buffer.from(textBuffer).toString('utf-8')
                    throw new Error(text);
                }
                break;
            }
            case 'fishspeech':{
                const fishSpeechConfig = character.fishSpeechConfig;
                if (!fishSpeechConfig?.model?._id){
                    throw new Error('FishSpeech Model is not selected')
                }
                const audioContext = new AudioContext();

                const body = {
                    text: text,
                    reference_id: fishSpeechConfig.model._id,
                    chunk_length: fishSpeechConfig.chunk_length,
                    normalize: fishSpeechConfig.normalize,
                    format: 'mp3',
                    mp3_bitrate: 192,
                }


                ttsLog(body)

                const response = await globalFetch(`https://api.fish.audio/v1/tts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${db.fishSpeechKey}`
                    },
                    body: body,
                    rawResponse: true,
                })
                ttsLog(response)

                if (response.ok) {
                    const audioBuffer = response.data.buffer;
                    audioContext.decodeAudioData(audioBuffer, (decodedData) => {
                        const sourceNode = audioContext.createBufferSource();
                        sourceNode.buffer = decodedData;
                        sourceNode.connect(audioContext.destination);
                        sourceNode.start();
                    });
                } else {
                    const textBuffer: Uint8Array = response.data.buffer
                    const text = Buffer.from(textBuffer).toString('utf-8')
                    throw new Error(text);
                }
            }
        }   
    } catch (error) {
        alertError(`TTS Error: ${error}`)
    }
}



export const oaiVoices = [
    'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
]

export function stopTTS(){
    if(sourceNode){
        sourceNode.stop()
    }
    if(speechSynthesis && SpeechSynthesisUtterance){
        speechSynthesis.cancel()
    }
}


export function getWebSpeechTTSVoices() {
    return speechSynthesis.getVoices().map(v => {
        return v.name
    })
}

export async function getElevenTTSVoices() {
    const db = getDatabase()
    const headers: Record<string, string> = {};
    if (db.elevenLabKey) {
        headers['xi-api-key'] = db.elevenLabKey;
    }

    const data = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers
    })
    const res = await data.json()

    ttsLog(res)
    return res.voices
}

export async function getVOICEVOXVoices() {
    const db = getDatabase();
    const speakerData = await fetch(`${db.voicevoxUrl}/speakers`)
    const speakerList = await speakerData.json() as Array<{
        name: string;
        styles: Array<{
            name: string;
            id: number | string;
        }>;
    }>
    const speakersInfo = speakerList.map((speaker) => {
      const styles = speaker.styles.map((style) => {
        return {name: style.name, id: `${style.id}`}
      })
      return {name: speaker.name, list: JSON.stringify(styles)}
    })
    speakersInfo.unshift({ name: "None", list: JSON.stringify([]) })
    return speakersInfo;
}

export function getNovelAIVoices(){
    return [
        {
            gender: "UNISEX",
            voices: ['Anananan']
        },
        {
            gender: "FEMALE",
            voices: ['Aini', 'Orea', 'Claea', 'Lim', 'Aurae', 'Naia']
        },
        {
            gender: "MALE",
            voices: ['Aulon', 'Elei', 'Ogma', 'Raid', 'Pega', 'Lam']
        }
    ];
}

export function FixNAITTS(data:character){
    if (data.naittsConfig === undefined){
        data.naittsConfig = {
            customvoice: false,
            version: 'v2',
            voice: 'Anananan',
        }
    } else if (!data.naittsConfig.voice) {
        data.naittsConfig.voice = 'Anananan'
    }

    return data
}
