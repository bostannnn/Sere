import {
    acceptEvolutionProposalAction,
    loadEvolutionVersionState,
    persistEvolutionCharacter,
    refreshEvolutionVersions,
    rejectEvolutionProposalAction,
} from "src/ts/character-evolution/actions"
import { getEvolutionProposalIdentity } from "src/ts/character-evolution/workflow"
import { EvolutionDefaultsSettingsTabIndex, OtherBotSettingsSubMenuIndex, SettingsMenuIndex, settingsOpen } from "src/ts/stores.svelte"
import type { CharacterEvolutionVersionFile, CharacterEvolutionVersionMeta, character } from "src/ts/storage/database.types"
import { deriveMergedProcessedRanges, mergeEvolutionVersionMetas } from "./evolutionSettings.helpers"
export {
    acceptEvolutionProposalAction,
    getEvolutionProposalIdentity,
    loadEvolutionVersionState,
    persistEvolutionCharacter,
    refreshEvolutionVersions,
    rejectEvolutionProposalAction,
}

export async function refreshEvolutionWorkspaceVersions(args: {
    characterId: string
    selectedVersion: number | null
    currentCharacterId: string | null
    findCharacterById: (characterId: string) => character | null
    commitCharacter: (characterEntry: character) => void
    setRefreshedVersionMetas: (versions: CharacterEvolutionVersionMeta[]) => void
    setSelectedVersionFile: (file: CharacterEvolutionVersionFile | null) => void
}): Promise<void> {
    const payload = await refreshEvolutionVersions(
        args.characterId,
        args.selectedVersion,
    )
    const characterEntry = args.findCharacterById(args.characterId)
    if (characterEntry) {
        const mergedStateVersions = mergeEvolutionVersionMetas(
            characterEntry.characterEvolution.stateVersions,
            payload.versions,
        )
        characterEntry.characterEvolution.stateVersions = mergedStateVersions
        characterEntry.characterEvolution.processedRanges = deriveMergedProcessedRanges({
            evolutionSettings: characterEntry.characterEvolution,
            mergedStateVersions,
        })
        args.commitCharacter(characterEntry)
    }
    if (args.currentCharacterId === args.characterId) {
        args.setRefreshedVersionMetas(payload.versions)
        args.setSelectedVersionFile(payload.selectedVersionFile)
    }
}

export async function loadEvolutionWorkspaceVersion(args: {
    characterId: string
    version: number
    currentCharacterId: string | null
    setSelectedVersionFile: (file: CharacterEvolutionVersionFile | null) => void
}): Promise<void> {
    const payload = await loadEvolutionVersionState(args.characterId, args.version)
    if (args.currentCharacterId === args.characterId) {
        args.setSelectedVersionFile(payload)
    }
}

export function openEvolutionGlobalDefaults(): void {
    EvolutionDefaultsSettingsTabIndex.set(0)
    OtherBotSettingsSubMenuIndex.set(3)
    SettingsMenuIndex.set(2)
    settingsOpen.set(true)

    window.setTimeout(() => {
        document.getElementById("character-evolution-defaults")?.scrollIntoView({
            block: "start",
            behavior: "smooth",
        })
    }, 0)
}
