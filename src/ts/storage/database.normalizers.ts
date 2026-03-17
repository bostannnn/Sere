import type {
  Chat,
  ComfyCommanderConfig,
  ComfyCommanderImagePromptConfig,
  ComfyCommanderReferenceStoreConfig,
  ComfyCommanderRunpodConfig,
  ComfyCommanderRunpodSchemaPreset,
  ComfyCommanderTemplate,
  ComfyCommanderWorkflow,
  Database,
  RagSettings,
} from './database.types';
import {
  COMFY_COMMANDER_DEFAULT_BASE_URL,
  createComfyCommanderEntityId,
  createDefaultComfyCommanderImagePromptConfig,
  createDefaultComfyCommanderReferenceStoreConfig,
  createDefaultComfyCommanderRunpodConfig,
  createDefaultComfyCommanderState,
} from 'src/ts/integrations/comfy/config';

export const DEFAULT_OPENROUTER_REQUEST_MODEL = 'openai/gpt-3.5-turbo';

type GlobalRagSettingsDefaults = {
  enabled: boolean;
  topK: number;
  minScore: number;
  budget: number;
  enabledRulebooks: string[];
  model: string;
};

export type ChatBackgroundMode = 'inherit' | 'default' | 'custom';

export const DEFAULT_GLOBAL_RAG_SETTINGS: Readonly<GlobalRagSettingsDefaults> = Object.freeze({
  enabled: false,
  topK: 7,
  minScore: 0.6,
  budget: 1500,
  enabledRulebooks: [] as string[],
  model: 'bgeLargeEnGPU',
});

const REMOVED_PROVIDER_FIELD_KEYS = [
  'textgenWebUIStreamURL',
  'textgenWebUIBlockingURL',
  'hordeConfig',
  'novellistAPI',
  'ooba',
  'ainconfig',
  'mancerHeader',
  'mistralKey',
  'claudeAws',
  'cohereAPIKey',
  'vertexPrivateKey',
  'vertexClientEmail',
  'vertexAccessToken',
  'vertexAccessTokenExpires',
  'vertexRegion',
  'echoMessage',
  'echoDelay',
] as const;

function cloneDefaultGlobalRagSettings() {
  return {
    ...DEFAULT_GLOBAL_RAG_SETTINGS,
    enabledRulebooks: [...DEFAULT_GLOBAL_RAG_SETTINGS.enabledRulebooks],
  };
}

export function stripRemovedProviderFields(target: Record<string, unknown> | null | undefined): boolean {
  if (!target) {
    return false;
  }

  let changed = false;
  for (const key of REMOVED_PROVIDER_FIELD_KEYS) {
    if (key in target) {
      delete target[key];
      changed = true;
    }
  }

  return changed;
}


export function resolveChatBackgroundMode(mode: unknown, backgroundImage: unknown): ChatBackgroundMode {
  const normalizedImage = typeof backgroundImage === 'string' ? backgroundImage.trim() : '';
  if (mode === 'default') {
    return 'default';
  }
  if (mode === 'custom' && normalizedImage) {
    return 'custom';
  }
  return 'inherit';
}

export function normalizeChatBackground(chat: Partial<Chat>) {
  const normalizedImage = typeof chat.backgroundImage === 'string' ? chat.backgroundImage.trim() : '';
  chat.backgroundImage = normalizedImage;
  chat.backgroundMode = resolveChatBackgroundMode(chat.backgroundMode, normalizedImage);
}

function normalizeComfyCommanderWorkflow(value: unknown): ComfyCommanderWorkflow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const workflow = typeof entry.workflow === 'string' ? entry.workflow.trim() : '';
  if (!workflow) {
    return null;
  }
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createComfyCommanderEntityId('wf');
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Workflow';
  return {
    id,
    name,
    workflow,
  };
}

function normalizeComfyCommanderTemplate(
  value: unknown,
  fallback: {
    imagePrompt: ComfyCommanderImagePromptConfig;
    runpod: ComfyCommanderRunpodConfig;
  },
): ComfyCommanderTemplate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const trigger = typeof entry.trigger === 'string' ? entry.trigger.trim() : '';
  if (!trigger) {
    return null;
  }
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createComfyCommanderEntityId('tpl');
  const showInChatMenuRaw = entry.showInChatMenu ?? entry.showInMenu;
  return {
    id,
    trigger,
    prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
    negativePrompt: typeof entry.negativePrompt === 'string' ? entry.negativePrompt : '',
    imagePromptModel: typeof entry.imagePromptModel === 'string' ? entry.imagePromptModel.trim() : fallback.imagePrompt.model,
    imagePromptSystemPrompt: typeof entry.imagePromptSystemPrompt === 'string' && entry.imagePromptSystemPrompt.trim()
      ? entry.imagePromptSystemPrompt
      : fallback.imagePrompt.systemPrompt,
    imagePromptUserPromptTemplate: typeof entry.imagePromptUserPromptTemplate === 'string' && entry.imagePromptUserPromptTemplate.trim()
      ? entry.imagePromptUserPromptTemplate
      : fallback.imagePrompt.userPromptTemplate,
    imagePromptContextMessageCount: Number.isFinite(Number(entry.imagePromptContextMessageCount)) && Number(entry.imagePromptContextMessageCount) > 0
      ? Number(entry.imagePromptContextMessageCount)
      : fallback.imagePrompt.contextMessageCount,
    imagePromptMaxContextChars: Number.isFinite(Number(entry.imagePromptMaxContextChars)) && Number(entry.imagePromptMaxContextChars) > 0
      ? Number(entry.imagePromptMaxContextChars)
      : fallback.imagePrompt.maxContextChars,
    workflowId: typeof entry.workflowId === 'string' ? entry.workflowId.trim() : '',
    showInChatMenu: !!showInChatMenuRaw,
    buttonName: typeof entry.buttonName === 'string' ? entry.buttonName : '',
    providerOverride: entry.providerOverride === 'comfyui' || entry.providerOverride === 'runpod'
      ? entry.providerOverride
      : 'none',
    runpodModelId: typeof entry.runpodModelId === 'string' ? entry.runpodModelId.trim() : '',
    runpodEndpointId: typeof entry.runpodEndpointId === 'string' ? entry.runpodEndpointId.trim() : '',
    runpodSchemaPreset: normalizeComfyCommanderRunpodSchemaPreset(entry.runpodSchemaPreset, 'generic-text'),
    runpodOutputFormat: typeof entry.runpodOutputFormat === 'string' && entry.runpodOutputFormat.trim()
      ? entry.runpodOutputFormat.trim()
      : fallback.runpod.outputFormat,
    runpodWidth: Number.isFinite(Number(entry.runpodWidth)) && Number(entry.runpodWidth) > 0
      ? Number(entry.runpodWidth)
      : fallback.runpod.width,
    runpodHeight: Number.isFinite(Number(entry.runpodHeight)) && Number(entry.runpodHeight) > 0
      ? Number(entry.runpodHeight)
      : fallback.runpod.height,
    runpodSize: typeof entry.runpodSize === 'string' && entry.runpodSize.trim()
      ? entry.runpodSize.trim()
      : fallback.runpod.size,
    runpodNumInferenceSteps: Number.isFinite(Number(entry.runpodNumInferenceSteps)) && Number(entry.runpodNumInferenceSteps) > 0
      ? Number(entry.runpodNumInferenceSteps)
      : fallback.runpod.numInferenceSteps,
    runpodGuidance: Number.isFinite(Number(entry.runpodGuidance))
      ? Number(entry.runpodGuidance)
      : fallback.runpod.guidance,
    runpodStrength: Number.isFinite(Number(entry.runpodStrength))
      ? Number(entry.runpodStrength)
      : fallback.runpod.strength,
    runpodEnableSafetyChecker: typeof entry.runpodEnableSafetyChecker === 'boolean'
      ? entry.runpodEnableSafetyChecker
      : fallback.runpod.enableSafetyChecker,
    modeDefault: entry.modeDefault === 'image-edit' ? 'image-edit' : 'text-to-image',
    useReferenceImage: !!entry.useReferenceImage,
    referenceSource: entry.referenceSource === 'character-portrait' ? 'character-portrait' : 'none',
    allowReferenceFallbackToText: !!entry.allowReferenceFallbackToText,
  };
}

function normalizeComfyCommanderRunpodSchemaPreset(
  value: unknown,
  fallback: ComfyCommanderRunpodSchemaPreset,
): ComfyCommanderRunpodSchemaPreset {
  switch (value) {
    case 'generic-text':
    case 'generic-edit':
    case 'flux':
    case 'z-image':
    case 'qwen-edit':
    case 'qwen-edit-2511':
      return value;
    default:
      return fallback;
  }
}

export function ensureComfyCommanderStateShape(data: Database) {
  const legacyBaseUrl = typeof data.comfyUiUrl === 'string' && data.comfyUiUrl.trim() ? data.comfyUiUrl.trim() : COMFY_COMMANDER_DEFAULT_BASE_URL;
  const fallback = createDefaultComfyCommanderState(legacyBaseUrl);
  const incoming = data.comfyCommander;

  data.comfyCommander = {
    ...fallback,
    ...(incoming && typeof incoming === 'object' ? incoming : {}),
    version: 1,
  };

  const config = incoming?.config && typeof incoming.config === 'object' ? (incoming.config as Partial<ComfyCommanderConfig>) : {};
  const timeoutSec = Number(config.timeoutSec);
  const pollIntervalMs = Number(config.pollIntervalMs);
  const imagePrompt = config.imagePrompt && typeof config.imagePrompt === 'object'
    ? config.imagePrompt as Partial<ComfyCommanderImagePromptConfig>
    : {};
  const runpod = config.runpod && typeof config.runpod === 'object'
    ? config.runpod as Partial<ComfyCommanderRunpodConfig>
    : {};
  const referenceStore = config.referenceStore && typeof config.referenceStore === 'object'
    ? config.referenceStore as Partial<ComfyCommanderReferenceStoreConfig>
    : {};
  const imagePromptDefaults = createDefaultComfyCommanderImagePromptConfig();
  const runpodDefaults = createDefaultComfyCommanderRunpodConfig();
  const referenceStoreDefaults = createDefaultComfyCommanderReferenceStoreConfig();
  data.comfyCommander.config = {
    baseUrl: typeof config.baseUrl === 'string' && config.baseUrl.trim() ? config.baseUrl.trim() : fallback.config.baseUrl,
    timeoutSec: Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : fallback.config.timeoutSec,
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : fallback.config.pollIntervalMs,
    activeProvider: config.activeProvider === 'runpod' ? 'runpod' : 'comfyui',
    imagePrompt: {
      model: typeof imagePrompt.model === 'string' ? imagePrompt.model.trim() : imagePromptDefaults.model,
      systemPrompt: typeof imagePrompt.systemPrompt === 'string' && imagePrompt.systemPrompt.trim()
        ? imagePrompt.systemPrompt
        : imagePromptDefaults.systemPrompt,
      userPromptTemplate: typeof imagePrompt.userPromptTemplate === 'string' && imagePrompt.userPromptTemplate.trim()
        ? imagePrompt.userPromptTemplate
        : imagePromptDefaults.userPromptTemplate,
      contextMessageCount: Number.isFinite(Number(imagePrompt.contextMessageCount)) && Number(imagePrompt.contextMessageCount) > 0
        ? Number(imagePrompt.contextMessageCount)
        : imagePromptDefaults.contextMessageCount,
      maxContextChars: Number.isFinite(Number(imagePrompt.maxContextChars)) && Number(imagePrompt.maxContextChars) > 0
        ? Number(imagePrompt.maxContextChars)
        : imagePromptDefaults.maxContextChars,
    },
    runpod: {
      apiKey: typeof runpod.apiKey === 'string' ? runpod.apiKey : runpodDefaults.apiKey,
      modelId: typeof runpod.modelId === 'string' && runpod.modelId.trim() ? runpod.modelId.trim() : runpodDefaults.modelId,
      requestMode: runpod.requestMode === 'run' ? 'run' : runpodDefaults.requestMode,
      outputFormat: typeof runpod.outputFormat === 'string' && runpod.outputFormat.trim() ? runpod.outputFormat.trim() : runpodDefaults.outputFormat,
      width: Number.isFinite(Number(runpod.width)) && Number(runpod.width) > 0 ? Number(runpod.width) : runpodDefaults.width,
      height: Number.isFinite(Number(runpod.height)) && Number(runpod.height) > 0 ? Number(runpod.height) : runpodDefaults.height,
      size: typeof runpod.size === 'string' && runpod.size.trim() ? runpod.size.trim() : runpodDefaults.size,
      numInferenceSteps: Number.isFinite(Number(runpod.numInferenceSteps)) && Number(runpod.numInferenceSteps) > 0
        ? Number(runpod.numInferenceSteps)
        : runpodDefaults.numInferenceSteps,
      guidance: Number.isFinite(Number(runpod.guidance)) ? Number(runpod.guidance) : runpodDefaults.guidance,
      strength: Number.isFinite(Number(runpod.strength)) ? Number(runpod.strength) : runpodDefaults.strength,
      enableSafetyChecker: typeof runpod.enableSafetyChecker === 'boolean'
        ? runpod.enableSafetyChecker
        : runpodDefaults.enableSafetyChecker,
      customEndpointId: typeof runpod.customEndpointId === 'string' ? runpod.customEndpointId.trim() : runpodDefaults.customEndpointId,
      customSchemaPreset: normalizeComfyCommanderRunpodSchemaPreset(runpod.customSchemaPreset, runpodDefaults.customSchemaPreset),
    },
    referenceStore: {
      provider: referenceStore.provider === 'yandex-disk' ? 'yandex-disk' : referenceStoreDefaults.provider,
      yandexDiskToken: typeof referenceStore.yandexDiskToken === 'string' ? referenceStore.yandexDiskToken : referenceStoreDefaults.yandexDiskToken,
      yandexDiskFolder: typeof referenceStore.yandexDiskFolder === 'string' && referenceStore.yandexDiskFolder.trim()
        ? referenceStore.yandexDiskFolder.trim()
        : referenceStoreDefaults.yandexDiskFolder,
    },
  };

  const workflowsInput = Array.isArray(incoming?.workflows) ? incoming.workflows : [];
  data.comfyCommander.workflows = workflowsInput
    .map((item) => normalizeComfyCommanderWorkflow(item))
    .filter((item): item is ComfyCommanderWorkflow => item !== null);

  const templatesInput = Array.isArray(incoming?.templates) ? incoming.templates : [];
  data.comfyCommander.templates = templatesInput
    .map((item) => normalizeComfyCommanderTemplate(item, {
      imagePrompt: data.comfyCommander.config.imagePrompt,
      runpod: data.comfyCommander.config.runpod,
    }))
    .filter((item): item is ComfyCommanderTemplate => item !== null);
}

export function resolveGlobalRagSettings(value: Partial<RagSettings> | null | undefined): RagSettings {
  const next = cloneDefaultGlobalRagSettings();
  if (value && typeof value === 'object') {
    if (typeof value.enabled === 'boolean') {
      next.enabled = value.enabled;
    }
    if (Number.isFinite(value.topK)) {
      next.topK = Number(value.topK);
    }
    if (Number.isFinite(value.minScore)) {
      next.minScore = Number(value.minScore);
    }
    if (Number.isFinite(value.budget)) {
      next.budget = Number(value.budget);
    }
    if (Array.isArray(value.enabledRulebooks)) {
      next.enabledRulebooks = value.enabledRulebooks.filter((entry): entry is string => typeof entry === 'string');
    }
    if (typeof value.model === 'string' && value.model.trim()) {
      next.model = value.model.trim();
    }
  }
  return next;
}
