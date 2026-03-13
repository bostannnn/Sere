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

    if (!characterEntry.characterEvolution.useGlobalDefaults) {
        return `${characterEntry.chaId}:local`
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

    if (characterEntry.characterEvolution.useGlobalDefaults) {
        return {
            sectionConfigDraft: cloneEvolutionSettingsSections(
                evolutionSettings?.sectionConfigs ?? createDefaultCharacterEvolutionSectionConfigs(),
            ),
            privacyDraft: clonePrivacy(evolutionSettings?.privacy),
        }
    }

    return {
        sectionConfigDraft: cloneEvolutionSettingsSections(
            characterEntry.characterEvolution.sectionConfigs,
        ),
        privacyDraft: clonePrivacy(characterEntry.characterEvolution.privacy),
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
    sectionConfigDraft,
    privacyDraft,
}: BuildEvolutionSyncSettingsArgs): CharacterEvolutionSettings | null {
    const baseEvolution = baseCharacter.characterEvolution
    if (!baseEvolution) {
        return null
    }

    let changed = false
    const nextEvolution: CharacterEvolutionSettings = {
        ...baseEvolution,
    }

    if (currentStateDraft) {
        const normalizedState = normalizeCharacterEvolutionState(currentStateDraft)
        if (!jsonEqual(baseEvolution.currentState, normalizedState)) {
            nextEvolution.currentState = structuredClone(normalizedState)
            changed = true
        }
    }

    if (!baseEvolution.useGlobalDefaults) {
        const normalizedSections = normalizeCharacterEvolutionSectionConfigs(sectionConfigDraft)
        const normalizedPrivacy = clonePrivacy(privacyDraft)

        if (!jsonEqual(baseEvolution.sectionConfigs, normalizedSections)) {
            nextEvolution.sectionConfigs = structuredClone(normalizedSections)
            changed = true
        }

        if (!jsonEqual(baseEvolution.privacy, normalizedPrivacy)) {
            nextEvolution.privacy = structuredClone(normalizedPrivacy)
            changed = true
        }
    }

    return changed ? nextEvolution : null
}
