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

export function canonicalizeDbMemoryPersistenceShape<
  T extends Record<string, unknown>,
>(value: T): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  const target = value as T & Record<string, unknown>;
  const rawPresets = Array.isArray(target.memoryPresets)
    ? target.memoryPresets
    : (Array.isArray(target.hypaV3Presets) ? target.hypaV3Presets : undefined);
  const rawSettings =
    target.memorySettings && typeof target.memorySettings === "object"
      ? target.memorySettings
      : (target.hypaV3Settings && typeof target.hypaV3Settings === "object"
        ? target.hypaV3Settings
        : undefined);
  const rawPresetId = target.memoryPresetId ?? target.hypaV3PresetId;
  const rawEnabled = target.memoryEnabled ?? target.hypaV3;

  if (rawPresets !== undefined) {
    target.memoryPresets = rawPresets.map((preset) => cloneMemoryPresetLike(preset));
  }
  if (rawSettings !== undefined) {
    target.memorySettings = cloneMemorySettingsLike(rawSettings);
  }
  if (rawPresetId !== undefined) {
    target.memoryPresetId = Number.isFinite(Number(rawPresetId)) ? Number(rawPresetId) : 0;
  }
  if (rawEnabled !== undefined) {
    target.memoryEnabled = Boolean(rawEnabled);
  }

  delete target.hypaV3Presets;
  delete target.hypaV3Settings;
  delete target.hypaV3PresetId;
  delete target.hypaV3;

  return target;
}

export function getChatMemoryData(
  chat: Pick<Chat, "memoryData" | "hypaV3Data"> | null | undefined,
): SerializableMemoryData | undefined {
  return chat?.memoryData ?? chat?.hypaV3Data;
}

export function setChatMemoryData(
  chat: Pick<Chat, "memoryData" | "hypaV3Data"> | null | undefined,
  data: SerializableMemoryData | undefined,
): void {
  if (!chat) return;
  if (chat.memoryData === data && chat.hypaV3Data === data) return;
  chat.memoryData = data;
  chat.hypaV3Data = data;
}

export function getCharacterMemoryPromptOverride(
  char:
    | { memoryPromptOverride?: { summarizationPrompt?: unknown }; hypaV3PromptOverride?: { summarizationPrompt?: unknown } }
    | null
    | undefined,
): MemoryPromptOverride | undefined {
  const promptOverride = char?.memoryPromptOverride ?? char?.hypaV3PromptOverride;
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
    | { memoryPromptOverride?: { summarizationPrompt?: unknown }; hypaV3PromptOverride?: { summarizationPrompt?: unknown } }
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
  const legacyPrompt = char.hypaV3PromptOverride;
  const memoryNormalized =
    !!memoryPrompt &&
    typeof memoryPrompt === "object" &&
    typeof memoryPrompt.summarizationPrompt === "string";
  const legacyNormalized =
    !!legacyPrompt &&
    typeof legacyPrompt === "object" &&
    typeof legacyPrompt.summarizationPrompt === "string";

  if (
    currentPrompt === nextPrompt &&
    memoryPrompt === legacyPrompt &&
    (normalizedValue ? memoryNormalized && legacyNormalized : !memoryPrompt && !legacyPrompt)
  ) {
    return;
  }

  char.memoryPromptOverride = normalizedValue;
  char.hypaV3PromptOverride = normalizedValue;
}

export function getDbMemoryEnabled(
  db: Pick<Database, "memoryEnabled" | "hypaV3">,
): boolean {
  return db.memoryEnabled ?? db.hypaV3 ?? true;
}

export function setDbMemoryEnabled(
  db: Pick<Database, "memoryEnabled" | "hypaV3">,
  enabled: boolean,
): void {
  db.memoryEnabled = enabled;
  db.hypaV3 = enabled;
}

export function getDbMemoryPresets(
  db: Pick<Database, "memoryPresets" | "hypaV3Presets">,
): MemoryPreset[] {
  return db.memoryPresets ?? db.hypaV3Presets ?? [];
}

export function setDbMemoryPresets(
  db: Pick<Database, "memoryPresets" | "hypaV3Presets">,
  presets: MemoryPreset[],
): void {
  const normalizedPresets = Array.isArray(presets)
    ? presets.map((preset) => ({
        ...preset,
        settings: preset?.settings ? { ...preset.settings } : preset?.settings,
      }))
    : [];
  db.memoryPresets = normalizedPresets;
  db.hypaV3Presets = normalizedPresets;
}

export function getDbMemoryPresetId(
  db: Pick<Database, "memoryPresetId" | "hypaV3PresetId">,
): number {
  return db.memoryPresetId ?? db.hypaV3PresetId ?? 0;
}

export function setDbMemoryPresetId(
  db: Pick<Database, "memoryPresetId" | "hypaV3PresetId">,
  presetId: number,
): void {
  db.memoryPresetId = presetId;
  db.hypaV3PresetId = presetId;
}

export function getDbMemorySettings(
  db: Pick<Database, "memorySettings" | "hypaV3Settings">,
): MemorySettings {
  return db.memorySettings ?? db.hypaV3Settings;
}

export function setDbMemorySettings(
  db: Pick<Database, "memorySettings" | "hypaV3Settings">,
  settings: MemorySettings,
): void {
  db.memorySettings = settings;
  db.hypaV3Settings = settings;
}

export function getDbMemoryDebug(
  db: Pick<Database, "memoryDebug" | "hypaV3Debug">,
): SummarizeDebugLog | undefined {
  return db.memoryDebug ?? db.hypaV3Debug;
}

export function setDbMemoryDebug(
  db: Pick<Database, "memoryDebug" | "hypaV3Debug">,
  debug: SummarizeDebugLog | undefined,
): void {
  db.memoryDebug = debug;
  db.hypaV3Debug = debug;
}
