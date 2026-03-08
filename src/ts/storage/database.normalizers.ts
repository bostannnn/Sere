import type {
  Chat,
  ComfyCommanderConfig,
  ComfyCommanderState,
  ComfyCommanderTemplate,
  ComfyCommanderWorkflow,
  Database,
  RagSettings,
} from './database.types';

const COMFY_COMMANDER_DEFAULT_BASE_URL = 'http://127.0.0.1:8188';
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

type LegacyProviderTarget = {
  aiModel?: string;
  subModel?: string;
  openrouterRequestModel?: string;
  openrouterSubRequestModel?: string;
};

function cloneDefaultGlobalRagSettings() {
  return {
    ...DEFAULT_GLOBAL_RAG_SETTINGS,
    enabledRulebooks: [...DEFAULT_GLOBAL_RAG_SETTINGS.enabledRulebooks],
  };
}

function isRemovedLegacyModelId(value: unknown): value is string {
  return typeof value === 'string' && (value === 'reverse_proxy' || value.startsWith('xcustom:::'));
}

function ensureOpenRouterRequestModel(value: unknown) {
  if (typeof value !== 'string') {
    return DEFAULT_OPENROUTER_REQUEST_MODEL;
  }
  const trimmed = value.trim();
  if (!trimmed || isRemovedLegacyModelId(trimmed)) {
    return DEFAULT_OPENROUTER_REQUEST_MODEL;
  }
  return trimmed;
}

export function migrateRemovedProviderSelections(target: LegacyProviderTarget): boolean {
  let changed = false;

  if (isRemovedLegacyModelId(target.aiModel)) {
    target.aiModel = 'openrouter';
    target.openrouterRequestModel = ensureOpenRouterRequestModel(target.openrouterRequestModel);
    changed = true;
  } else if (target.aiModel === 'openrouter') {
    const nextRequestModel = ensureOpenRouterRequestModel(target.openrouterRequestModel);
    if (nextRequestModel !== target.openrouterRequestModel) {
      target.openrouterRequestModel = nextRequestModel;
      changed = true;
    }
  }

  if (isRemovedLegacyModelId(target.subModel)) {
    target.subModel = 'openrouter';
    target.openrouterSubRequestModel = ensureOpenRouterRequestModel(target.openrouterSubRequestModel);
    changed = true;
  } else if (target.subModel === 'openrouter') {
    const nextSubRequestModel = ensureOpenRouterRequestModel(target.openrouterSubRequestModel);
    if (nextSubRequestModel !== target.openrouterSubRequestModel) {
      target.openrouterSubRequestModel = nextSubRequestModel;
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

function defaultComfyCommanderConfig(baseUrl: string): ComfyCommanderConfig {
  return {
    baseUrl: (baseUrl || '').trim() || COMFY_COMMANDER_DEFAULT_BASE_URL,
    debug: false,
    timeoutSec: 120,
    pollIntervalMs: 1000,
  };
}

function defaultComfyCommanderState(baseUrl: string): ComfyCommanderState {
  return {
    version: 1,
    config: defaultComfyCommanderConfig(baseUrl),
    workflows: [],
    templates: [],
  };
}

function createComfyCommanderId(prefix: 'wf' | 'tpl') {
  return `cc-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createComfyCommanderId('wf');
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Workflow';
  return {
    id,
    name,
    workflow,
  };
}

function normalizeComfyCommanderTemplate(value: unknown): ComfyCommanderTemplate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const entry = value as Record<string, unknown>;
  const trigger = typeof entry.trigger === 'string' ? entry.trigger.trim() : '';
  if (!trigger) {
    return null;
  }
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : createComfyCommanderId('tpl');
  const showInChatMenuRaw = entry.showInChatMenu ?? entry.showInMenu;
  return {
    id,
    trigger,
    prompt: typeof entry.prompt === 'string' ? entry.prompt : '',
    negativePrompt: typeof entry.negativePrompt === 'string' ? entry.negativePrompt : '',
    workflowId: typeof entry.workflowId === 'string' ? entry.workflowId.trim() : '',
    showInChatMenu: !!showInChatMenuRaw,
    buttonName: typeof entry.buttonName === 'string' ? entry.buttonName : '',
  };
}

export function ensureComfyCommanderStateShape(data: Database) {
  const legacyBaseUrl = typeof data.comfyUiUrl === 'string' && data.comfyUiUrl.trim() ? data.comfyUiUrl.trim() : COMFY_COMMANDER_DEFAULT_BASE_URL;
  const fallback = defaultComfyCommanderState(legacyBaseUrl);
  const incoming = data.comfyCommander;

  data.comfyCommander = {
    ...fallback,
    ...(incoming && typeof incoming === 'object' ? incoming : {}),
    version: 1,
  };

  const config = incoming?.config && typeof incoming.config === 'object' ? (incoming.config as Partial<ComfyCommanderConfig>) : {};
  const timeoutSec = Number(config.timeoutSec);
  const pollIntervalMs = Number(config.pollIntervalMs);
  data.comfyCommander.config = {
    baseUrl: typeof config.baseUrl === 'string' && config.baseUrl.trim() ? config.baseUrl.trim() : fallback.config.baseUrl,
    debug: typeof config.debug === 'boolean' ? config.debug : false,
    timeoutSec: Number.isFinite(timeoutSec) && timeoutSec > 0 ? timeoutSec : fallback.config.timeoutSec,
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : fallback.config.pollIntervalMs,
  };

  const workflowsInput = Array.isArray(incoming?.workflows) ? incoming.workflows : [];
  data.comfyCommander.workflows = workflowsInput
    .map((item) => normalizeComfyCommanderWorkflow(item))
    .filter((item): item is ComfyCommanderWorkflow => item !== null);

  const templatesInput = Array.isArray(incoming?.templates) ? incoming.templates : [];
  data.comfyCommander.templates = templatesInput
    .map((item) => normalizeComfyCommanderTemplate(item))
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
