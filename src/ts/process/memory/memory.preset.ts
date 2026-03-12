import { getDatabase } from "src/ts/storage/database.svelte";
import { getDbMemoryPresetId, getDbMemoryPresets } from "./storage";
import type { MemoryPreset, MemorySettings } from "./memory.types";

export function getCurrentMemoryPreset(): MemoryPreset {
  const db = getDatabase();
  const presets = getDbMemoryPresets(db);
  const preset = presets[getDbMemoryPresetId(db)];

  if (!preset) {
    throw new Error("Preset not found. Please select a valid preset.");
  }

  return preset;
}

export function createMemoryPreset(
  name = "New Preset",
  existingSettings = {}
): MemoryPreset {
  const settings: MemorySettings = {
    summarizationModel: "subModel",
    summarizationPrompt: "",
    memoryTokensRatio: 0.2,
    maxChatsPerSummary: 6,
    maxSelectedSummaries: 4,
    periodicSummarizationEnabled: true,
    periodicSummarizationInterval: 10,
    recentSummarySlots: 3,
    similarSummarySlots: 1,
    recentMemoryRatio: 0.75,
    similarMemoryRatio: 0.25,
    processRegexScript: false,
    doNotSummarizeUserMessage: false,
  };

  if (
    existingSettings &&
    typeof existingSettings === "object" &&
    !Array.isArray(existingSettings)
  ) {
    for (const [key, value] of Object.entries(existingSettings)) {
      if (key in settings && typeof value === typeof settings[key]) {
        settings[key as keyof MemorySettings] = value as never;
      }
    }
  }

  settings.summarizationModel = "subModel";

  return {
    name,
    settings,
  };
}
