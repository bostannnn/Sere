import {
    createDefaultCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionState,
} from "src/ts/characterEvolution"
import {
    cloneEvolutionSettingsSections,
    cloneEvolutionState,
} from "src/ts/character-evolution/workflow"
import type {
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionRuntimeSettings,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSettings,
    CharacterEvolutionState,
    character,
} from "src/ts/storage/database.types"
import { clonePrivacy, jsonEqual } from "./evolutionSettings.helpers"

interface SectionDraftSnapshot {
    sectionConfigDraft: CharacterEvolutionSectionConfig[]
    privacyDraft: CharacterEvolutionPrivacySettings
}

interface DraftSettingsArgs {
    characterEntry: character | null | undefined
    evolutionSettings: CharacterEvolutionSettings | null
}

export function getSectionDraftHydrationKey({
    characterEntry,
    evolutionSettings,
}: DraftSettingsArgs): string | null {
    if (!characterEntry?.chaId || !characterEntry.characterEvolution) {
        return null
    }

    return `${characterEntry.chaId}:global:${JSON.stringify(evolutionSettings?.sectionConfigs ?? [])}:${JSON.stringify(evolutionSettings?.privacy ?? {})}`
}

export function createSectionDraftSnapshot({
    characterEntry,
    evolutionSettings,
}: DraftSettingsArgs): SectionDraftSnapshot {
    if (!characterEntry?.characterEvolution) {
        return {
            sectionConfigDraft: [],
            privacyDraft: clonePrivacy(null),
        }
    }

    return {
        sectionConfigDraft: cloneEvolutionSettingsSections(
            evolutionSettings?.sectionConfigs ?? createDefaultCharacterEvolutionSectionConfigs(),
        ),
        privacyDraft: clonePrivacy(evolutionSettings?.privacy),
    }
}

export function getCurrentStateDraftHydrationKey(
    characterEntry: character | null | undefined,
): string | null {
    if (!characterEntry?.chaId || !characterEntry.characterEvolution) {
        return null
    }

    return `${characterEntry.chaId}:${characterEntry.characterEvolution.currentStateVersion}`
}

export function createCurrentStateDraft(
    characterEntry: character | null | undefined,
): CharacterEvolutionState | null {
    return cloneEvolutionState(characterEntry?.characterEvolution?.currentState)
}

interface BuildEvolutionSyncSettingsArgs {
    baseCharacter: character
    currentStateDraft: CharacterEvolutionState | null
    sectionConfigDraft: CharacterEvolutionSectionConfig[]
    privacyDraft: CharacterEvolutionPrivacySettings
}

export function buildEvolutionSyncSettings({
    baseCharacter,
    currentStateDraft,
    sectionConfigDraft: _sectionConfigDraft,
    privacyDraft: _privacyDraft,
}: BuildEvolutionSyncSettingsArgs): CharacterEvolutionRuntimeSettings | null {
    const baseEvolution = baseCharacter.characterEvolution
    if (!baseEvolution) {
        return null
    }

    let changed = false
    const nextEvolution: CharacterEvolutionRuntimeSettings = {
        ...baseEvolution,
    }

    if (currentStateDraft) {
        const normalizedState = normalizeCharacterEvolutionState(currentStateDraft)
        if (!jsonEqual(baseEvolution.currentState, normalizedState)) {
            nextEvolution.currentState = structuredClone(normalizedState)
            changed = true
        }
    }

    return changed ? nextEvolution : null
}
