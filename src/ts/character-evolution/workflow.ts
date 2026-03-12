import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionState,
    CharacterEvolutionSettings,
    character,
} from "../storage/database.types"

export function getEvolutionProposalIdentity(
    characterId: string | undefined,
    proposal: CharacterEvolutionPendingProposal | null | undefined,
): string | null {
    if (!characterId || !proposal) {
        return null
    }

    return `${characterId}:${proposal.proposalId ?? proposal.sourceChatId ?? "pending"}:${proposal.createdAt ?? 0}`
}

export function withPendingEvolutionProposal(
    characterEntry: character,
    proposal: CharacterEvolutionPendingProposal | null,
): character {
    return {
        ...characterEntry,
        characterEvolution: {
            ...characterEntry.characterEvolution,
            pendingProposal: proposal,
        },
    }
}

export function withAcceptedEvolutionState(args: {
    characterEntry: character
    state: CharacterEvolutionState
    version: number | string | undefined
    acceptedAt: number | string | undefined
    sourceChatId: string | null
}): character {
    const { characterEntry, state, version, acceptedAt, sourceChatId } = args
    const acceptedVersion = Number(version) || characterEntry.characterEvolution.currentStateVersion
    const acceptedTimestamp = Number(acceptedAt) || 0
    const nextVersions = [
        {
            version: acceptedVersion,
            chatId: sourceChatId,
            acceptedAt: acceptedTimestamp,
        },
        ...(Array.isArray(characterEntry.characterEvolution.stateVersions)
            ? characterEntry.characterEvolution.stateVersions.filter((entry) => Number(entry?.version) !== acceptedVersion)
            : []),
    ]

    return {
        ...characterEntry,
        characterEvolution: {
            ...characterEntry.characterEvolution,
            currentState: state,
            currentStateVersion: acceptedVersion,
            pendingProposal: null,
            lastProcessedChatId: sourceChatId,
            stateVersions: nextVersions,
        },
    }
}

export function cloneEvolutionState(value: CharacterEvolutionState | null | undefined): CharacterEvolutionState | null {
    return value ? structuredClone(value) : null
}

export function cloneEvolutionSettingsSections(value: CharacterEvolutionSettings["sectionConfigs"] | null | undefined) {
    return structuredClone(value ?? [])
}
