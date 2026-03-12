import type {
  Chat,
  Database,
} from "src/ts/storage/database.types";
import type {
  MemoryPreset,
  MemorySettings,
  SerializableMemoryData,
  SummarizeDebugLog,
} from "./memory.types";

type MemoryPromptOverride = { summarizationPrompt?: string };

const LEGACY_MEMORY_CONFIG_KEYS = [
  "memoryAlgorithmType",
  "hypaMemory",
  "hanuraiEnable",
  "hanuraiSplit",
  "hanuraiTokens",
  "hypaMemoryKey",
] as const;

function cloneMemorySettingsLike<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  return { ...(value as Record<string, unknown>) } as T;
}

function cloneMemoryPresetLike<T>(preset: T): T {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    return preset;
  }
  const next = { ...(preset as Record<string, unknown>) } as T & {
    settings?: unknown;
  };
  next.settings = cloneMemorySettingsLike(next.settings);
  return next;
}

function getSelectedMemorySettingsLike(
  presets: unknown,
  presetId: unknown,
): Record<string, unknown> | undefined {
  if (!Array.isArray(presets) || presets.length === 0) {
    return undefined;
  }
  const normalizedPresetId = Number.isFinite(Number(presetId))
    ? Number(presetId)
    : 0;
  const selectedPreset =
    presets[normalizedPresetId] ?? presets[0];
  if (!selectedPreset || typeof selectedPreset !== "object") {
    return undefined;
  }
  const settings = (selectedPreset as { settings?: unknown }).settings;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return undefined;
  }
  return settings as Record<string, unknown>;
}

export function canonicalizeDbMemoryPersistenceShape<
  T extends Record<string, unknown>,
>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  const target = value as T & Record<string, unknown>;
  const mutableTarget = target as Record<string, unknown>;
  const rawPresets = Array.isArray(target.memoryPresets)
    ? target.memoryPresets
    : undefined;
  const rawSettings =
    target.memorySettings && typeof target.memorySettings === "object"
      ? target.memorySettings
      : undefined;
  const rawPresetId = target.memoryPresetId;
  const rawEnabled = target.memoryEnabled;

  if (rawPresets !== undefined) {
    mutableTarget.memoryPresets = rawPresets.map((preset) => cloneMemoryPresetLike(preset));
  }
  if (rawPresetId !== undefined) {
    mutableTarget.memoryPresetId = Number.isFinite(Number(rawPresetId)) ? Number(rawPresetId) : 0;
  }
  const selectedPresetSettings = getSelectedMemorySettingsLike(
    mutableTarget.memoryPresets,
    mutableTarget.memoryPresetId ?? rawPresetId,
  );
  if (selectedPresetSettings) {
    mutableTarget.memorySettings = cloneMemorySettingsLike(selectedPresetSettings);
  } else if (rawSettings !== undefined) {
    mutableTarget.memorySettings = cloneMemorySettingsLike(rawSettings);
  }
  if (rawEnabled !== undefined) {
    mutableTarget.memoryEnabled = Boolean(rawEnabled);
  }

  delete target.hypaV3Presets;
  delete target.hypaV3Settings;
  delete target.hypaV3PresetId;
  delete target.hypaV3;
  for (const legacyKey of LEGACY_MEMORY_CONFIG_KEYS) {
    delete target[legacyKey];
  }

  return target;
}

export function getChatMemoryData(
  chat: Pick<Chat, "memoryData"> | null | undefined,
): SerializableMemoryData | undefined {
  return chat?.memoryData;
}

export function setChatMemoryData(
  chat:
    | (Pick<Chat, "memoryData"> & {
      hypaV2Data?: unknown
      hypaV3Data?: unknown
    })
    | null
    | undefined,
  data: SerializableMemoryData | undefined,
): void {
  if (!chat) return;
  if (chat.memoryData === data) return;
  chat.memoryData = data;
  delete (chat as Record<string, unknown>).hypaV3Data;
  delete (chat as Record<string, unknown>).hypaV2Data;
}

export function getCharacterMemoryPromptOverride(
  char:
    | { memoryPromptOverride?: { summarizationPrompt?: unknown } }
    | null
    | undefined,
): MemoryPromptOverride | undefined {
  const promptOverride = char?.memoryPromptOverride;
  if (!promptOverride || typeof promptOverride !== "object") return undefined;
  return {
    summarizationPrompt:
      typeof promptOverride.summarizationPrompt === "string"
        ? promptOverride.summarizationPrompt
        : "",
  };
}

export function setCharacterMemoryPromptOverride(
  char:
    | {
      memoryPromptOverride?: { summarizationPrompt?: unknown }
      hypaV3PromptOverride?: unknown
    }
    | null
    | undefined,
  value: MemoryPromptOverride | undefined,
): void {
  if (!char) return;
  const normalizedValue = value
    ? {
        summarizationPrompt:
          typeof value.summarizationPrompt === "string" ? value.summarizationPrompt : "",
      }
    : undefined;
  const currentPrompt = getCharacterMemoryPromptOverride(char)?.summarizationPrompt ?? "";
  const nextPrompt = normalizedValue?.summarizationPrompt ?? "";
  const memoryPrompt = char.memoryPromptOverride;
  const memoryNormalized =
    !!memoryPrompt &&
    typeof memoryPrompt === "object" &&
    typeof memoryPrompt.summarizationPrompt === "string";

  if (
    currentPrompt === nextPrompt &&
    (normalizedValue ? memoryNormalized : !memoryPrompt)
  ) {
    return;
  }

  char.memoryPromptOverride = normalizedValue;
  delete (char as Record<string, unknown>).hypaV3PromptOverride;
}

export function getDbMemoryEnabled(
  db: Pick<Database, "memoryEnabled">,
): boolean {
  return db.memoryEnabled ?? true;
}

export function setDbMemoryEnabled(
  db: Pick<Database, "memoryEnabled">,
  enabled: boolean,
): void {
  if (db.memoryEnabled === enabled) return;
  db.memoryEnabled = enabled;
  delete (db as Record<string, unknown>).hypaV3;
}

export function getDbMemoryPresets(
  db: Pick<Database, "memoryPresets">,
): MemoryPreset[] {
  return db.memoryPresets ?? [];
}

export function setDbMemoryPresets(
  db: Pick<Database, "memoryPresets">,
  presets: MemoryPreset[],
): void {
  const normalizedPresets = Array.isArray(presets)
    ? presets.map((preset) => ({
        ...preset,
        settings: preset?.settings ? { ...preset.settings } : preset?.settings,
      }))
    : [];
  db.memoryPresets = normalizedPresets;
  delete (db as Record<string, unknown>).hypaV3Presets;
}

export function getDbMemoryPresetId(
  db: Pick<Database, "memoryPresetId">,
): number {
  return db.memoryPresetId ?? 0;
}

export function setDbMemoryPresetId(
  db: Pick<Database, "memoryPresetId">,
  presetId: number,
): void {
  if (db.memoryPresetId === presetId) return;
  db.memoryPresetId = presetId;
  delete (db as Record<string, unknown>).hypaV3PresetId;
}

export function getDbMemorySettings(
  db: Pick<Database, "memorySettings">,
): MemorySettings {
  return db.memorySettings;
}

export function setDbMemorySettings(
  db: Pick<Database, "memorySettings">,
  settings: MemorySettings,
): void {
  db.memorySettings = settings;
  delete (db as Record<string, unknown>).hypaV3Settings;
}

export function getDbMemoryDebug(
  db: Pick<Database, "memoryDebug">,
): SummarizeDebugLog | undefined {
  return db.memoryDebug;
}

export function setDbMemoryDebug(
  db: Pick<Database, "memoryDebug">,
  debug: SummarizeDebugLog | undefined,
): void {
  db.memoryDebug = debug;
  delete (db as Record<string, unknown>).hypaV3Debug;
}
