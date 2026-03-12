import {
  createDefaultCharacterEvolutionSectionConfigs,
  normalizeCharacterEvolutionPrivacy,
} from "src/ts/characterEvolution";
import type {
  CharacterEvolutionPrivacySettings,
  CharacterEvolutionSectionConfig,
  CharacterEvolutionSettings,
  CharacterEvolutionState,
  CharacterEvolutionVersionFile,
  character,
  groupChat,
} from "src/ts/storage/database.types";

export function isSingleCharacter(
  value: character | groupChat | null | undefined,
): value is character {
  return !!value && value.type !== "group";
}

export function clonePrivacy(
  value: CharacterEvolutionPrivacySettings | null | undefined,
): CharacterEvolutionPrivacySettings {
  return structuredClone(normalizeCharacterEvolutionPrivacy(value));
}

export function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function versionSectionHasData(
  state: CharacterEvolutionState | null,
  key: string,
): boolean {
  if (!state) {
    return false;
  }
  if (key === "relationship") {
    return Boolean(state.relationship.trustLevel || state.relationship.dynamic);
  }
  if (key === "lastInteractionEnded") {
    return Boolean(state.lastInteractionEnded.state || state.lastInteractionEnded.residue);
  }
  const value = state[key as keyof CharacterEvolutionState];
  return Array.isArray(value) ? value.length > 0 : false;
}

export function deriveSelectedVersionSectionConfigs(args: {
  selectedVersionFile: CharacterEvolutionVersionFile | null;
  selectedVersionState: CharacterEvolutionState | null;
  evolutionSettings: CharacterEvolutionSettings | null;
}): CharacterEvolutionSectionConfig[] {
  const { selectedVersionFile, selectedVersionState, evolutionSettings } = args;
  if (selectedVersionFile?.sectionConfigs) {
    return selectedVersionFile.sectionConfigs as CharacterEvolutionSectionConfig[];
  }

  const defaults = createDefaultCharacterEvolutionSectionConfigs();
  const currentMap = new Map(
    (evolutionSettings?.sectionConfigs ?? []).map((section) => [section.key, section] as const),
  );

  return defaults.map((section) => {
    const current = currentMap.get(section.key);
    const shouldShowFromSnapshot = versionSectionHasData(selectedVersionState, section.key);
    return {
      ...section,
      enabled: Boolean(current?.enabled || shouldShowFromSnapshot),
      includeInPrompt: current?.includeInPrompt ?? section.includeInPrompt,
      label: current?.label ?? section.label,
      instruction: current?.instruction ?? section.instruction,
      kind: current?.kind ?? section.kind,
      sensitive: current?.sensitive ?? section.sensitive,
    };
  });
}

export function deriveSelectedVersionPrivacy(args: {
  selectedVersionFile: CharacterEvolutionVersionFile | null;
  selectedVersionState: CharacterEvolutionState | null;
  evolutionSettings: CharacterEvolutionSettings | null;
}): CharacterEvolutionPrivacySettings {
  const { selectedVersionFile, selectedVersionState, evolutionSettings } = args;
  if (selectedVersionFile?.privacy) {
    return selectedVersionFile.privacy as CharacterEvolutionPrivacySettings;
  }
  return {
    allowCharacterIntimatePreferences:
      (selectedVersionState?.characterIntimatePreferences?.length ?? 0) > 0
      || (evolutionSettings?.privacy.allowCharacterIntimatePreferences ?? false),
    allowUserIntimatePreferences:
      (selectedVersionState?.userIntimatePreferences?.length ?? 0) > 0
      || (evolutionSettings?.privacy.allowUserIntimatePreferences ?? false),
  };
}
