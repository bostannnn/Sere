import { decryptBuffer, encryptBuffer } from '../util';
import { prebuiltPresets } from '../process/templates/templates';
import { LLMFormat } from '../model/modellist';
import { decodeRPack, encodeRPack } from '../rpack/rpack_js';
import { encode as encodeMsgpack, decode as decodeMsgpack } from 'msgpackr/index-no-eval';
import * as fflate from 'fflate';
import { cloneDefaultPromptTemplate, normalizePromptTemplate } from './defaultPrompts';
import { stripRemovedProviderFields } from './database.normalizers';
import type { PromptItem, PromptItemPlain } from '../process/prompt';
import type { Database, botPreset } from './database.types';

export const presetTemplate:botPreset = {
  name: 'New Preset',
  apiType: 'gemini-3-flash-preview',
  openAIKey: '',
  temperature: 80,
  maxContext: 4000,
  maxResponse: 300,
  frequencyPenalty: 70,
  PresensePenalty: 70,
  aiModel: 'gemini-3-flash-preview',
  subModel: 'gemini-3-flash-preview',
  forceReplaceUrl: '',
  forceReplaceUrl2: '',
  proxyKey: '',
  bias: [],
  reverseProxyOobaArgs: {
    mode: 'instruct',
  },
  promptTemplate: cloneDefaultPromptTemplate(),
  top_p: 1,
  useInstructPrompt: false,
  verbosity: 1,
};

export type PresetDownloadType = 'json' | 'risupreset' | 'return';

type ImportPresetFile = {
  name: string
  data: Uint8Array
};

type PresetArchivePayload = {
  presetVersion: number
  type: string
  preset?: Uint8Array
  pres?: Uint8Array
};

type PrebuiltNaiInput = {
  presetVersion?: number
  parameters?: {
    temperature?: number
    max_length?: number
    top_k?: number
    top_p?: number
    top_a?: number
    typical_p?: number
    tail_free_sampling?: number
    repetition_penalty?: number
    repetition_penalty_range?: number
    repetition_penalty_slope?: number
    repetition_penalty_frequency?: number
    repetition_penalty_presence?: number
    cfg_scale?: number
    mirostat_lr?: number
    mirostat_tau?: number
  }
  name?: string
};

type STPromptOrderItem = {
  enabled?: boolean
  identifier?: string | number
};

type STPrompt = {
  identifier: string | number
  content?: string
  role?: PromptItemRole
};

type STPresetInput = {
  prompt_order?: Array<{ order?: STPromptOrderItem[] }>
  prompts?: STPrompt[]
  temperature?: number
  frequency_penalty?: number
  presence_penalty?: number
  top_p?: number
  assistant_prefill?: string
};

type PromptItemRole = PromptItemPlain['role'];

function normalizePromptItemRole(role: unknown): PromptItemRole {
  if (role === 'user' || role === 'bot' || role === 'system') {
    return role;
  }
  return 'system';
}

function buildSavedPreset(db: Database): botPreset {
  const presets = Array.isArray(db.botPresets) ? db.botPresets : [];
  return {
    name: presets[db.botPresetsId]?.name ?? 'Preset',
    apiType: db.apiType,
    openAIKey: db.openAIKey,
    temperature: db.temperature,
    maxContext: db.maxContext,
    maxResponse: db.maxResponse,
    frequencyPenalty: db.frequencyPenalty,
    PresensePenalty: db.PresensePenalty,
    aiModel: db.aiModel,
    subModel: db.subModel,
    forceReplaceUrl: db.forceReplaceUrl,
    bias: db.bias,
    koboldURL: db.koboldURL,
    proxyKey: db.proxyKey,
    proxyRequestModel: db.proxyRequestModel,
    openrouterRequestModel: db.openrouterRequestModel,
    openrouterSubRequestModel: db.openrouterSubRequestModel,
    NAISettings: safeStructuredClone(db.NAIsettings),
    promptTemplate: safeStructuredClone(db.promptTemplate),
    NAIadventure: db.NAIadventure ?? false,
    NAIappendName: db.NAIappendName ?? false,
    localStopStrings: db.localStopStrings,
    autoSuggestPrompt: db.autoSuggestPrompt,
    customProxyRequestModel: db.customProxyRequestModel,
    reverseProxyOobaArgs: safeStructuredClone(db.reverseProxyOobaArgs) ?? null,
    top_p: db.top_p ?? 1,
    promptSettings: safeStructuredClone(db.promptSettings) ?? null,
    repetition_penalty: db.repetition_penalty,
    min_p: db.min_p,
    top_a: db.top_a,
    openrouterProvider: db.openrouterProvider,
    openrouterAllowReasoningOnlyForDeepSeekV32Speciale: db.openrouterAllowReasoningOnlyForDeepSeekV32Speciale ?? false,
    useInstructPrompt: db.useInstructPrompt,
    customPromptTemplateToggle: db.customPromptTemplateToggle ?? '',
    templateDefaultVariables: db.templateDefaultVariables ?? '',
    moduleIntergration: db.moduleIntergration ?? '',
    top_k: db.top_k,
    instructChatTemplate: db.instructChatTemplate,
    JinjaTemplate: db.JinjaTemplate ?? '',
    jsonSchemaEnabled: db.jsonSchemaEnabled ?? false,
    jsonSchema: db.jsonSchema ?? '',
    strictJsonSchema: db.strictJsonSchema ?? true,
    extractJson: db.extractJson ?? '',
    groupOtherBotRole: db.groupOtherBotRole ?? 'user',
    groupTemplate: db.groupTemplate ?? '',
    seperateParametersEnabled: db.seperateParametersEnabled ?? false,
    seperateParameters: safeStructuredClone(db.seperateParameters),
    customAPIFormat: safeStructuredClone(db.customAPIFormat),
    systemContentReplacement: db.systemContentReplacement,
    systemRoleReplacement: db.systemRoleReplacement,
    customFlags: safeStructuredClone(db.customFlags),
    enableCustomFlags: db.enableCustomFlags,
    regex: db.presetRegex,
    image: presets?.[db.botPresetsId]?.image ?? '',
    reasonEffort: db.reasoningEffort ?? 0,
    thinkingTokens: db.thinkingTokens ?? null,
    outputImageModal: db.outputImageModal ?? false,
    seperateModelsForAxModels: db.doNotChangeSeperateModels ? false : db.seperateModelsForAxModels ?? false,
    seperateModels: db.doNotChangeSeperateModels ? null : safeStructuredClone(db.seperateModels),
    modelTools: safeStructuredClone(db.modelTools),
    fallbackModels: safeStructuredClone(db.fallbackModels),
    fallbackWhenBlankResponse: db.fallbackWhenBlankResponse ?? false,
    verbosity: db.verbosity ?? 1,
    dynamicOutput: db.dynamicOutput ?? null,
  };
}

function appendPreset(db: Database, preset: botPreset) {
  let presets = db.botPresets;
  if (!Array.isArray(presets)) {
    presets = [];
  }
  if (db.botPresetsId >= presets.length) {
    presets.push(preset);
  } else {
    presets[db.botPresetsId] = preset;
  }
  db.botPresets = presets;
}

function sanitizePresetForExport(preset: botPreset): botPreset {
  const sanitized = safeStructuredClone(preset);
  stripRemovedProviderFields(sanitized as unknown as Record<string, unknown>);
  sanitized.openAIKey = '';
  sanitized.forceReplaceUrl = '';
  sanitized.forceReplaceUrl2 = '';
  sanitized.proxyKey = '';
  return sanitized;
}

function isPresetArchivePayload(value: unknown): value is PresetArchivePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.presetVersion === 'number' && typeof record.type === 'string';
}

function toSTPromptTemplate(input: STPresetInput, log: (...args: unknown[]) => void): PromptItem[] {
  const promptTemplate: PromptItem[] = [];
  const order = input.prompt_order?.[0]?.order ?? [];
  const prompts = Array.isArray(input.prompts) ? input.prompts : [];
  const findPrompt = (identifier: string | number) => prompts.find((prompt) => prompt.identifier === identifier);

  for (const promptOrderItem of order) {
    if (!promptOrderItem?.enabled) {
      continue;
    }
    const prompt = findPrompt(promptOrderItem?.identifier ?? -1);
    if (!prompt) {
      log('Prompt not found', promptOrderItem);
      continue;
    }

    switch (prompt.identifier) {
      case 'main':
        promptTemplate.push({ type: 'plain', type2: 'main', text: prompt.content ?? '', role: normalizePromptItemRole(prompt.role) });
        break;
      case 'jailbreak':
      case 'nsfw':
        promptTemplate.push({ type: 'jailbreak', type2: 'normal', text: prompt.content ?? '', role: normalizePromptItemRole(prompt.role) });
        break;
      case 'dialogueExamples':
      case 'charPersonality':
      case 'scenario':
      case 'worldInfoAfter':
        break;
      case 'chatHistory':
        promptTemplate.push({ type: 'chat', rangeEnd: 'end', rangeStart: 0 });
        break;
      case 'worldInfoBefore':
        promptTemplate.push({ type: 'lorebook' });
        break;
      case 'charDescription':
        promptTemplate.push({ type: 'description' });
        break;
      case 'personaDescription':
        promptTemplate.push({ type: 'persona' });
        break;
      default:
        log(prompt);
        promptTemplate.push({ type: 'plain', type2: 'normal', text: prompt.content ?? '', role: normalizePromptItemRole(prompt.role) });
    }
  }

  if (input.assistant_prefill) {
    promptTemplate.push({ type: 'postEverything' });
    promptTemplate.push({
      type: 'plain',
      type2: 'main',
      text: `{{#if {{prefill_supported}}}}${input.assistant_prefill}{{/if}}`,
      role: 'bot',
    });
  }

  return promptTemplate;
}

export function saveCurrentPresetInDatabase(db: Database) {
  const savedPreset = buildSavedPreset(db);
  appendPreset(db, savedPreset);
}

export function copyPresetInDatabase(db: Database, id: number) {
  saveCurrentPresetInDatabase(db);
  const presets = Array.isArray(db.botPresets) ? db.botPresets : [];
  const source = presets[id];
  if (!source) {
    return;
  }
  const copied = safeStructuredClone(source);
  copied.name += ' Copy';
  presets.push(copied);
  db.botPresets = presets;
}

export function setPresetOnDatabase(db: Database, newPres: botPreset) {
  stripRemovedProviderFields(newPres as unknown as Record<string, unknown>);
  db.apiType = newPres.apiType ?? db.apiType;
  db.temperature = newPres.temperature ?? db.temperature;
  db.maxContext = newPres.maxContext ?? db.maxContext;
  db.maxResponse = newPres.maxResponse ?? db.maxResponse;
  db.frequencyPenalty = newPres.frequencyPenalty ?? db.frequencyPenalty;
  db.PresensePenalty = newPres.PresensePenalty ?? db.PresensePenalty;
  db.aiModel = newPres.aiModel ?? db.aiModel;
  db.subModel = newPres.subModel ?? db.subModel;
  db.forceReplaceUrl = newPres.forceReplaceUrl ?? db.forceReplaceUrl;
  db.bias = newPres.bias ?? db.bias;
  db.koboldURL = newPres.koboldURL ?? db.koboldURL;
  db.proxyKey = newPres.proxyKey ?? db.proxyKey;
  db.openrouterRequestModel = newPres.openrouterRequestModel ?? db.openrouterRequestModel;
  db.openrouterSubRequestModel = newPres.openrouterSubRequestModel ?? db.openrouterSubRequestModel;
  db.proxyRequestModel = newPres.proxyRequestModel ?? db.proxyRequestModel;
  db.NAIsettings = newPres.NAISettings ?? db.NAIsettings;
  db.autoSuggestPrompt = newPres.autoSuggestPrompt ?? db.autoSuggestPrompt;
  db.autoSuggestPrefix = newPres.autoSuggestPrefix ?? db.autoSuggestPrefix;
  db.autoSuggestClean = newPres.autoSuggestClean ?? db.autoSuggestClean;
  db.promptTemplate = normalizePromptTemplate(newPres.promptTemplate);
  db.NAIadventure = newPres.NAIadventure;
  db.NAIappendName = newPres.NAIappendName;
  db.NAIsettings.cfg_scale ??= 1;
  db.NAIsettings.mirostat_tau ??= 0;
  db.NAIsettings.mirostat_lr ??= 1;
  db.localStopStrings = newPres.localStopStrings;
  db.customProxyRequestModel = newPres.customProxyRequestModel ?? '';
  db.reverseProxyOobaArgs = safeStructuredClone(newPres.reverseProxyOobaArgs) ?? { mode: 'instruct' };
  db.top_p = newPres.top_p ?? 1;
  db.promptSettings = safeStructuredClone(newPres.promptSettings) ?? {
    assistantPrefill: '',
    postEndInnerFormat: '',
    sendChatAsSystem: false,
    sendName: false,
    utilOverride: false,
  };
  db.promptSettings.maxThoughtTagDepth ??= -1;
  db.repetition_penalty = newPres.repetition_penalty;
  db.min_p = newPres.min_p;
  db.top_a = newPres.top_a;
  db.openrouterProvider = newPres.openrouterProvider;
  db.openrouterAllowReasoningOnlyForDeepSeekV32Speciale = newPres.openrouterAllowReasoningOnlyForDeepSeekV32Speciale ?? false;
  db.useInstructPrompt = newPres.useInstructPrompt ?? false;
  db.customPromptTemplateToggle = newPres.customPromptTemplateToggle ?? '';
  db.templateDefaultVariables = newPres.templateDefaultVariables ?? '';
  db.moduleIntergration = newPres.moduleIntergration ?? '';
  db.top_k = newPres.top_k ?? db.top_k;
  db.instructChatTemplate = newPres.instructChatTemplate ?? db.instructChatTemplate;
  db.JinjaTemplate = newPres.JinjaTemplate ?? db.JinjaTemplate;
  db.jsonSchemaEnabled = newPres.jsonSchemaEnabled ?? false;
  db.jsonSchema = newPres.jsonSchema ?? '';
  db.strictJsonSchema = newPres.strictJsonSchema ?? true;
  db.extractJson = newPres.extractJson ?? '';
  db.groupOtherBotRole = newPres.groupOtherBotRole ?? 'user';
  db.groupTemplate = newPres.groupTemplate ?? '';
  db.seperateParametersEnabled = newPres.seperateParametersEnabled ?? false;
  db.seperateParameters = newPres.seperateParameters
    ? safeStructuredClone(newPres.seperateParameters)
    : { memory: {}, emotion: {}, translate: {}, otherAx: {} };
  db.customAPIFormat = safeStructuredClone(newPres.customAPIFormat) ?? LLMFormat.OpenAICompatible;
  db.systemContentReplacement = newPres.systemContentReplacement ?? '';
  db.systemRoleReplacement = newPres.systemRoleReplacement ?? 'user';
  db.customFlags = safeStructuredClone(newPres.customFlags) ?? [];
  db.enableCustomFlags = newPres.enableCustomFlags ?? false;
  db.presetRegex = newPres.regex ?? [];
  db.reasoningEffort = newPres.reasonEffort ?? 0;
  db.thinkingTokens = newPres.thinkingTokens ?? null;
  db.outputImageModal = newPres.outputImageModal ?? false;
  if (!db.doNotChangeSeperateModels) {
    db.seperateModelsForAxModels = newPres.seperateModelsForAxModels ?? false;
    db.seperateModels = newPres.seperateModels
      ? safeStructuredClone(newPres.seperateModels)
      : { memory: '', emotion: '', translate: '', otherAx: '' };
  }
  if (!db.doNotChangeFallbackModels) {
    db.fallbackModels = newPres.fallbackModels
      ? safeStructuredClone(newPres.fallbackModels)
      : { memory: [], emotion: [], translate: [], otherAx: [], model: [] };
    db.fallbackWhenBlankResponse = newPres.fallbackWhenBlankResponse ?? false;
  }
  db.modelTools = safeStructuredClone(newPres.modelTools ?? []);
  db.verbosity = newPres.verbosity ?? 1;
  db.dynamicOutput = newPres.dynamicOutput;

  return db;
}

export function changeToPresetInDatabase(db: Database, id = 0, saveCurrent = true) {
  if (saveCurrent) {
    saveCurrentPresetInDatabase(db);
  }
  const presets = Array.isArray(db.botPresets) ? db.botPresets : [];
  const next = presets[id];
  if (!next) {
    return db;
  }
  db.botPresetsId = id;
  return setPresetOnDatabase(db, next);
}

export function buildDownloadPresetForExport(db: Database, id: number) {
  const presets = Array.isArray(db.botPresets) ? db.botPresets : [];
  const preset = safeStructuredClone(presets[id] ?? presetTemplate);
  return sanitizePresetForExport(preset);
}

export async function encodeDownloadPresetBuffer(preset: botPreset) {
  const compressed = fflate.compressSync(
    encodeMsgpack({
      presetVersion: 2,
      type: 'preset',
      preset: await encryptBuffer(encodeMsgpack(preset), 'risupreset'),
    }),
  );
  return encodeRPack(compressed);
}

export async function decodeImportedPresetFile(file: ImportPresetFile) {
  if (file.name.endsWith('.risupreset') || file.name.endsWith('.risup')) {
    let data = file.data;
    if (file.name.endsWith('.risup')) {
      data = await decodeRPack(data);
    }
    const decoded = decodeMsgpack(fflate.decompressSync(data));
    if (!isPresetArchivePayload(decoded)) {
      return null;
    }
    if ((decoded.presetVersion === 0 || decoded.presetVersion === 2) && decoded.type === 'preset') {
      const encryptedPreset = decoded.preset ?? decoded.pres;
      if (!encryptedPreset) {
        return null;
      }
      const decrypted = await decryptBuffer(encryptedPreset, 'risupreset');
      return { ...presetTemplate, ...decodeMsgpack(Buffer.from(decrypted)) };
    }
    return null;
  }
  return { ...presetTemplate, ...JSON.parse(Buffer.from(file.data).toString('utf-8')) };
}

export function applyImportedPresetToDatabase(db: Database, importedPreset: unknown, log: (...args: unknown[]) => void) {
  if (!importedPreset || typeof importedPreset !== 'object') {
    return;
  }
  const preset = importedPreset as Record<string, unknown>;

  if (typeof preset.presetVersion === 'number' && preset.presetVersion >= 3) {
    const naiPreset = safeStructuredClone(prebuiltPresets.NAI);
    const input = preset as PrebuiltNaiInput;
    const params = input.parameters ?? {};
    naiPreset.temperature = (params.temperature ?? 0.8) * 100;
    naiPreset.maxResponse = params.max_length ?? naiPreset.maxResponse;
    naiPreset.NAISettings.topK = params.top_k ?? naiPreset.NAISettings.topK;
    naiPreset.NAISettings.topP = params.top_p ?? naiPreset.NAISettings.topP;
    naiPreset.NAISettings.topA = params.top_a ?? naiPreset.NAISettings.topA;
    naiPreset.NAISettings.typicalp = params.typical_p ?? naiPreset.NAISettings.typicalp;
    naiPreset.NAISettings.tailFreeSampling = params.tail_free_sampling ?? naiPreset.NAISettings.tailFreeSampling;
    naiPreset.NAISettings.repetitionPenalty = params.repetition_penalty ?? naiPreset.NAISettings.repetitionPenalty;
    naiPreset.NAISettings.repetitionPenaltyRange = params.repetition_penalty_range ?? naiPreset.NAISettings.repetitionPenaltyRange;
    naiPreset.NAISettings.repetitionPenaltySlope = params.repetition_penalty_slope ?? naiPreset.NAISettings.repetitionPenaltySlope;
    naiPreset.NAISettings.frequencyPenalty = params.repetition_penalty_frequency ?? naiPreset.NAISettings.frequencyPenalty;
    naiPreset.NAISettings.repostitionPenaltyPresence = params.repetition_penalty_presence ?? naiPreset.NAISettings.repostitionPenaltyPresence;
    naiPreset.PresensePenalty = (params.repetition_penalty_presence ?? 0) * 100;
    naiPreset.NAISettings.cfg_scale = params.cfg_scale ?? naiPreset.NAISettings.cfg_scale;
    naiPreset.NAISettings.mirostat_lr = params.mirostat_lr ?? naiPreset.NAISettings.mirostat_lr;
    naiPreset.NAISettings.mirostat_tau = params.mirostat_tau ?? naiPreset.NAISettings.mirostat_tau;
    naiPreset.name = typeof input.name === 'string' && input.name ? input.name : 'Imported';

    if (!Array.isArray(db.botPresets)) {
      db.botPresets = [];
    }
    db.botPresets.push(naiPreset);
    return;
  }

  const stPreset = preset as STPresetInput;
  if (Array.isArray(stPreset.prompt_order?.[0]?.order) && Array.isArray(stPreset.prompts)) {
    const converted = safeStructuredClone(presetTemplate);
    converted.promptTemplate = toSTPromptTemplate(stPreset, log);
    converted.temperature = (stPreset.temperature ?? 0.8) * 100;
    converted.frequencyPenalty = (stPreset.frequency_penalty ?? 0.7) * 100;
    converted.PresensePenalty = ((stPreset.presence_penalty ?? 0.7) * 0.7) * 100;
    converted.top_p = stPreset.top_p ?? 1;
    converted.name = 'Imported ST Preset';

    if (!Array.isArray(db.botPresets)) {
      db.botPresets = [];
    }
    db.botPresets.push(converted);
    return;
  }

  const generic = preset as unknown as botPreset;
  generic.name ??= 'Imported';
  stripRemovedProviderFields(generic as unknown as Record<string, unknown>);
  if (!Array.isArray(db.botPresets)) {
    db.botPresets = [];
  }
  db.botPresets.push(generic);
}
