import { language } from "../../../lang";
import { globalFetch } from "../../globalApi.svelte";
import { getCurrentCharacter, getDatabase } from "../../storage/database.svelte";
import { tokenizeNum } from "../../tokenizer";
import { applyChatTemplate } from "../templates/chatTemplate";
import { NovelAIBadWordIds, stringlizeNAIChat } from "../models/nai";
import { unstringlizeChat } from "../stringlize";
import { isNodeServer } from '../../platform';
import { applyParameters } from "./request.parameters";
import { getServerStringSuccessResult, normalizeServerEnvelope, stringifyUnknownResponse } from "./request.responses";
import { buildCharacterRagPayload, buildGlobalRagPayload } from "./ragPayload";
import { resolveServerStreaming } from "./request.routing";
import type { RequestDataArgumentExtended, requestDataResponse } from "./request";

export async function requestNovelAI(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const aiModel = arg.aiModel
    const temperature = arg.temperature
    const maxTokens = arg.maxTokens
    const biasString = arg.biasString
    const currentChar = getCurrentCharacter()
    const prompt = stringlizeNAIChat(formated, currentChar?.name ?? '', arg.continue)
    const abortSignal = arg.abortSignal
    const logit_bias_exp: {
        sequence: number[], bias: number, ensure_sequence_finish: false, generate_once: true
    }[] = []

    if (arg.previewBody && !isNodeServer) {
        return {
            type: 'success',
            result: JSON.stringify({
                error: "This model is not supported in preview mode"
            })
        }
    }

    for (let i = 0; i < biasString.length; i++) {
        const bia = biasString[i]
        const tokens = await tokenizeNum(bia[0])

        const tokensInNumberArray: number[] = []

        for (const token of tokens) {
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

    if (db.NAIadventure) {
        prefix = 'theme_textadventure'
    }

    const gen = db.NAIsettings
    const payload = {
        temperature: temperature,
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
        repetition_penalty_whitelist: [49256, 49264, 49231, 49230, 49287, 85, 49255, 49399, 49262, 336, 333, 432, 363, 468, 492, 745, 401, 426, 623, 794, 1096, 2919, 2072, 7379, 1259, 2110, 620, 526, 487, 16562, 603, 805, 761, 2681, 942, 8917, 653, 3513, 506, 5301, 562, 5010, 614, 10942, 539, 2976, 462, 5189, 567, 2032, 123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 588, 803, 1040, 49209, 4, 5, 6, 7, 8, 9, 10, 11, 12],
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
        "parameters": payload
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
        ragSettings: buildCharacterRagPayload(arg.currentChar?.ragSettings),
        globalRagSettings: buildGlobalRagPayload(db.globalRagSettings),
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
                    result: stringifyUnknownResponse(previewRes.data),
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
        const data = normalizeServerEnvelope(rawData)
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
                result: (language.errors.httpError + `${stringifyUnknownResponse(rawData)}`)
            }
        }
        const successResult = getServerStringSuccessResult(rawData)
        if (successResult) {
            return {
                type: "success",
                result: unstringlizeChat(successResult.result, formated, currentChar?.name ?? ''),
                newCharEtag: successResult.newCharEtag,
            }
        }
        return {
            type: 'fail',
            result: (language.errors.httpError + `${stringifyUnknownResponse(rawData)}`)
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

    if ((!da.ok) || (!da.data.output)) {
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

export async function requestKobold(arg: RequestDataArgumentExtended): Promise<requestDataResponse> {
    const formated = arg.formated
    const db = getDatabase()
    const maxTokens = arg.maxTokens
    const abortSignal = arg.abortSignal

    const prompt = applyChatTemplate(formated)
    const url = new URL(db.koboldURL)
    if (url.pathname.length < 3) {
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
        ragSettings: buildCharacterRagPayload(arg.currentChar?.ragSettings),
        globalRagSettings: buildGlobalRagPayload(db.globalRagSettings),
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
        const successResult = getServerStringSuccessResult(rawData)
        if (!serverRes.ok) {
            return {
                type: 'fail',
                result: stringifyUnknownResponse(rawData),
                noRetry: true
            }
        }
        if (successResult) {
            return {
                type: 'success',
                result: successResult.result,
                newCharEtag: successResult.newCharEtag,
            }
        }
        return {
            type: 'fail',
            result: stringifyUnknownResponse(rawData),
            noRetry: true
        }
    }

    if (arg.previewBody) {
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

    if (!da.ok) {
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
