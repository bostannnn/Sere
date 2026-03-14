import {
  createDefaultCharacterEvolutionSectionConfigs,
  getCharacterEvolutionProcessedRanges,
  normalizeCharacterEvolutionPrivacy,
} from "src/ts/characterEvolution";
import type {
  CharacterEvolutionProcessedRange,
  CharacterEvolutionPrivacySettings,
  CharacterEvolutionSectionConfig,
  CharacterEvolutionSettings,
  CharacterEvolutionState,
  CharacterEvolutionVersionMeta,
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

function normalizeVersion(value: unknown): number | null {
  const version = Number(value);
  if (!Number.isFinite(version) || version < 0) {
    return null;
  }
  return Math.floor(version);
}

function mergeVersionMetaEntry(
  base: CharacterEvolutionVersionMeta | null | undefined,
  overlay: CharacterEvolutionVersionMeta | null | undefined,
): CharacterEvolutionVersionMeta | null {
  const version = normalizeVersion(overlay?.version ?? base?.version);
  if (version === null) {
    return null;
  }

  const range = overlay?.range ?? base?.range;
  return {
    version,
    chatId: overlay?.chatId ?? base?.chatId ?? null,
    acceptedAt: Number(overlay?.acceptedAt ?? base?.acceptedAt) || 0,
    ...(range ? { range } : {}),
  };
}

export function mergeEvolutionVersionMetas(
  localVersions: CharacterEvolutionVersionMeta[] | null | undefined,
  refreshedVersions: CharacterEvolutionVersionMeta[] | null | undefined,
): CharacterEvolutionVersionMeta[] {
  const byVersion = new Map<number, CharacterEvolutionVersionMeta>();

  for (const entry of localVersions ?? []) {
    const version = normalizeVersion(entry?.version);
    if (version === null) {
      continue;
    }
    const merged = mergeVersionMetaEntry(null, entry);
    if (merged) {
      byVersion.set(version, merged);
    }
  }

  for (const entry of refreshedVersions ?? []) {
    const version = normalizeVersion(entry?.version);
    if (version === null) {
      continue;
    }
    const merged = mergeVersionMetaEntry(byVersion.get(version), entry);
    if (merged) {
      byVersion.set(version, merged);
    }
  }

  return [...byVersion.values()].sort((left, right) => right.version - left.version);
}

export function deriveMergedProcessedRanges(args: {
  evolutionSettings: CharacterEvolutionSettings | null | undefined;
  mergedStateVersions: CharacterEvolutionVersionMeta[] | null | undefined;
}): CharacterEvolutionProcessedRange[] {
  const { evolutionSettings, mergedStateVersions } = args;
  const fromVersions = getCharacterEvolutionProcessedRanges({
    processedRanges: [],
    stateVersions: mergedStateVersions ?? [],
  });
  const explicit = getCharacterEvolutionProcessedRanges({
    processedRanges: evolutionSettings?.processedRanges,
    stateVersions: [],
  });

  const byVersion = new Map<number, CharacterEvolutionProcessedRange>();
  for (const entry of fromVersions) {
    byVersion.set(entry.version, entry);
  }
  for (const entry of explicit) {
    byVersion.set(entry.version, entry);
  }

  return [...byVersion.values()].sort((left, right) => {
    if (left.range.chatId !== right.range.chatId) {
      return left.range.chatId.localeCompare(right.range.chatId);
    }
    return left.range.startMessageIndex - right.range.startMessageIndex;
  });
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
