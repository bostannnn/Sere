import { saveServerDatabase } from "src/ts/storage/serverDb"
import {
    acceptCharacterEvolutionProposal,
    clearCharacterEvolutionCoverage,
    createNewChatAfterEvolution,
    deleteCharacterEvolutionVersion,
    fetchCharacterEvolutionVersion,
    listCharacterEvolutionVersions,
    previewCharacterEvolutionRetention,
    rejectCharacterEvolutionProposal,
    revertCharacterEvolutionVersion,
} from "src/ts/evolution"
import { DBState } from "src/ts/stores.svelte"
import type {
    CharacterEvolutionProposalState,
    CharacterEvolutionRangeRef,
    CharacterEvolutionRetentionDryRunReport,
    CharacterEvolutionState,
    CharacterEvolutionVersionFile,
    CharacterEvolutionVersionMeta,
    CharacterEvolutionProcessedRange,
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

export interface CharacterEvolutionVersionMutationPayload extends Record<string, unknown> {
    currentStateVersion?: number | string
    invalidatedVersions?: number[]
    state?: CharacterEvolutionState
    versions?: CharacterEvolutionVersionMeta[]
    processedRanges?: CharacterEvolutionProcessedRange[]
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

export async function clearEvolutionCoverageAction(
    characterId: string,
    range: CharacterEvolutionRangeRef,
): Promise<CharacterEvolutionVersionMutationPayload> {
    return await clearCharacterEvolutionCoverage(characterId, range)
}

export async function revertEvolutionVersionAction(
    characterId: string,
    version: number,
): Promise<CharacterEvolutionVersionMutationPayload> {
    return await revertCharacterEvolutionVersion(characterId, version)
}

export async function deleteEvolutionVersionAction(
    characterId: string,
    version: number,
): Promise<CharacterEvolutionVersionMutationPayload> {
    return await deleteCharacterEvolutionVersion(characterId, version)
}

export async function previewEvolutionRetentionAction(
    characterId: string,
): Promise<CharacterEvolutionRetentionDryRunReport | null> {
    return await previewCharacterEvolutionRetention(characterId)
}

export async function rejectEvolutionProposalAction(
    characterId: string,
): Promise<void> {
    await rejectCharacterEvolutionProposal(characterId)
}

export async function acceptEvolutionProposalAction(args: {
    characterId: string
    proposedState: CharacterEvolutionProposalState
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
