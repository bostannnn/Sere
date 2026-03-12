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

type CharacterMemoryToggle = { memoryEnabled?: boolean };

export function getChatMemoryData(
  chat: Pick<Chat, "memoryData"> | null | undefined,
): SerializableMemoryData | undefined {
  return chat?.memoryData;
}

export function setChatMemoryData(
  chat: Pick<Chat, "memoryData"> | null | undefined,
  data: SerializableMemoryData | undefined,
): void {
  if (!chat) return;
  if (chat.memoryData === data) return;
  chat.memoryData = data;
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
    | { memoryPromptOverride?: { summarizationPrompt?: unknown } }
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
}

export function getCharacterMemoryEnabled(
  char: CharacterMemoryToggle | null | undefined,
): boolean {
  return char?.memoryEnabled === true;
}

export function setCharacterMemoryEnabled(
  char: CharacterMemoryToggle | null | undefined,
  enabled: boolean,
): void {
  if (!char) return;
  if (char.memoryEnabled === enabled) return;
  char.memoryEnabled = enabled;
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
  db.memoryPresets = Array.isArray(presets)
    ? presets.map((preset) => ({
        ...preset,
        settings: preset?.settings ? { ...preset.settings } : preset?.settings,
      }))
    : [];
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
}
