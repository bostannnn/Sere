import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionRangeRef,
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
    sourceRange: CharacterEvolutionRangeRef | null
    sourceChatId?: string | null
}): character {
    const { characterEntry, state, version, acceptedAt, sourceRange, sourceChatId = null } = args
    const acceptedVersion = Number(version) || characterEntry.characterEvolution.currentStateVersion
    const acceptedTimestamp = Number(acceptedAt) || 0
    const acceptedChatId = sourceRange?.chatId ?? sourceChatId ?? null
    const nextVersions = [
        {
            version: acceptedVersion,
            chatId: acceptedChatId,
            acceptedAt: acceptedTimestamp,
            ...(sourceRange ? { range: sourceRange } : {}),
        },
        ...(Array.isArray(characterEntry.characterEvolution.stateVersions)
            ? characterEntry.characterEvolution.stateVersions.filter((entry) => Number(entry?.version) !== acceptedVersion)
            : []),
    ]
    const nextProcessedRanges = [
        ...(Array.isArray(characterEntry.characterEvolution.processedRanges)
            ? characterEntry.characterEvolution.processedRanges.filter((entry) => Number(entry?.version) !== acceptedVersion)
            : []),
        ...(sourceRange ? [{
            version: acceptedVersion,
            acceptedAt: acceptedTimestamp,
            range: sourceRange,
        }] : []),
    ]
    const nextLastProcessedMessageIndexByChat = {
        ...(characterEntry.characterEvolution.lastProcessedMessageIndexByChat ?? {}),
        ...(sourceRange
            ? {
                [sourceRange.chatId]: Math.max(
                    characterEntry.characterEvolution.lastProcessedMessageIndexByChat?.[sourceRange.chatId] ?? -1,
                    sourceRange.endMessageIndex,
                ),
            }
            : {}),
    }

    return {
        ...characterEntry,
        characterEvolution: {
            ...characterEntry.characterEvolution,
            currentState: state,
            currentStateVersion: acceptedVersion,
            pendingProposal: null,
            lastProcessedChatId: acceptedChatId ?? characterEntry.characterEvolution.lastProcessedChatId ?? null,
            lastProcessedMessageIndexByChat: nextLastProcessedMessageIndexByChat,
            processedRanges: nextProcessedRanges,
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
