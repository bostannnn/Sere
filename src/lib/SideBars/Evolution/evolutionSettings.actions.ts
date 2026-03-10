import {
    acceptCharacterEvolutionProposal,
    createNewChatAfterEvolution,
    fetchCharacterEvolutionVersion,
    listCharacterEvolutionVersions,
    rejectCharacterEvolutionProposal,
} from "src/ts/evolution"
import { saveServerDatabase } from "src/ts/storage/serverDb"
import { OtherBotSettingsSubMenuIndex, SettingsMenuIndex, settingsOpen } from "src/ts/stores.svelte"
import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionState,
    CharacterEvolutionVersionFile,
    CharacterEvolutionVersionMeta,
    Database,
} from "src/ts/storage/database.types"

export interface AcceptedEvolutionProposalPayload extends Record<string, unknown> {
    state?: CharacterEvolutionState
    version?: number | string
}

export function getEvolutionProposalIdentity(
    characterId: string | undefined,
    proposal: CharacterEvolutionPendingProposal | null | undefined,
): string | null {
    if (!characterId || !proposal) {
        return null
    }

    return `${characterId}:${proposal.proposalId ?? proposal.sourceChatId ?? "pending"}:${proposal.createdAt ?? 0}`
}

export async function persistEvolutionCharacter(
    db: Database,
    characterId: string,
): Promise<void> {
    await saveServerDatabase(db, {
        character: [characterId],
        chat: [],
    })
}

export async function refreshEvolutionVersions(
    characterId: string,
    selectedVersion: number | null,
): Promise<{
    versions: CharacterEvolutionVersionMeta[]
    selectedVersionState: CharacterEvolutionState | null
}> {
    const versions = await listCharacterEvolutionVersions(characterId)

    if (selectedVersion === null) {
        return {
            versions,
            selectedVersionState: null,
        }
    }

    const version = await fetchCharacterEvolutionVersion(characterId, selectedVersion)

    return {
        versions,
        selectedVersionState: version?.state ?? null,
    }
}

export async function loadEvolutionVersionState(
    characterId: string,
    version: number,
): Promise<CharacterEvolutionVersionFile | null> {
    return await fetchCharacterEvolutionVersion(characterId, version)
}

export async function rejectEvolutionProposalAction(
    characterId: string,
): Promise<void> {
    await rejectCharacterEvolutionProposal(characterId)
}

export async function acceptEvolutionProposalAction(args: {
    characterId: string
    proposedState: CharacterEvolutionState
    createNextChat?: boolean
    selectedCharIndex: number
}): Promise<AcceptedEvolutionProposalPayload> {
    const payload = await acceptCharacterEvolutionProposal(
        args.characterId,
        args.proposedState,
    )

    if (args.createNextChat) {
        await createNewChatAfterEvolution(args.selectedCharIndex)
    }

    return payload as AcceptedEvolutionProposalPayload
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
