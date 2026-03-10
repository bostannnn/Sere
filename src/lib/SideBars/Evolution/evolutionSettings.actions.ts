import {
    acceptEvolutionProposalAction,
    loadEvolutionVersionState,
    persistEvolutionCharacter,
    refreshEvolutionVersions,
    rejectEvolutionProposalAction,
} from "src/ts/character-evolution/actions"
import { getEvolutionProposalIdentity } from "src/ts/character-evolution/workflow"
import { OtherBotSettingsSubMenuIndex, SettingsMenuIndex, settingsOpen } from "src/ts/stores.svelte"
export {
    acceptEvolutionProposalAction,
    getEvolutionProposalIdentity,
    loadEvolutionVersionState,
    persistEvolutionCharacter,
    refreshEvolutionVersions,
    rejectEvolutionProposalAction,
}

export function openEvolutionGlobalDefaults(): void {
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
