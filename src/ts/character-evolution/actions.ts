import { saveServerDatabase } from "src/ts/storage/serverDb"
import {
    acceptCharacterEvolutionProposal,
    createNewChatAfterEvolution,
    fetchCharacterEvolutionVersion,
    listCharacterEvolutionVersions,
    rejectCharacterEvolutionProposal,
} from "src/ts/evolution"
import { DBState } from "src/ts/stores.svelte"
import type {
    CharacterEvolutionRangeRef,
    CharacterEvolutionState,
    CharacterEvolutionVersionFile,
    CharacterEvolutionVersionMeta,
    Database,
} from "src/ts/storage/database.types"

export interface AcceptedEvolutionProposalPayload extends Record<string, unknown> {
    state?: CharacterEvolutionState
    version?: number | string
    acceptedAt?: number | string
    chatId?: string | null
    range?: CharacterEvolutionRangeRef
    chatCreationError?: string
}

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message
    }
    return String(error ?? "Unknown error")
}

function findCharacterIndexById(characterId: string): number {
    return Array.isArray(DBState.db.characters)
        ? DBState.db.characters.findIndex((entry) => entry?.type !== "group" && entry?.chaId === characterId)
        : -1
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
    selectedVersionFile: CharacterEvolutionVersionFile | null
}> {
    const versions = await listCharacterEvolutionVersions(characterId)

    if (selectedVersion === null) {
        return {
            versions,
            selectedVersionFile: null,
        }
    }

    const version = await fetchCharacterEvolutionVersion(characterId, selectedVersion)

    return {
        versions,
        selectedVersionFile: version,
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
}): Promise<AcceptedEvolutionProposalPayload> {
    const payload = await acceptCharacterEvolutionProposal(
        args.characterId,
        args.proposedState,
    )

    if (args.createNextChat) {
        try {
            const selectedCharIndex = findCharacterIndexById(args.characterId)
            if (selectedCharIndex < 0) {
                throw new Error("Character is no longer available for new chat creation.")
            }
            await createNewChatAfterEvolution(selectedCharIndex)
        } catch (error) {
            return {
                ...(payload as AcceptedEvolutionProposalPayload),
                chatCreationError: toErrorMessage(error),
            }
        }
    }

    return payload as AcceptedEvolutionProposalPayload
}
