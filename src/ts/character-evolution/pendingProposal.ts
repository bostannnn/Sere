import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionProposalState,
    CharacterEvolutionRangeRef,
    CharacterEvolutionState,
} from "../storage/database.types"
import { createDefaultCharacterEvolutionState } from "./schema"

const CHARACTER_EVOLUTION_PROPOSAL_SECTION_KEYS = Object.keys(
    createDefaultCharacterEvolutionState(),
) as Array<keyof CharacterEvolutionState>

export function getPendingProposalSourceRange(
    proposal: CharacterEvolutionPendingProposal | null | undefined,
): CharacterEvolutionRangeRef | null {
    return proposal?.sourceRange ?? null
}

export function rebasePendingProposalAfterMessageDeletion(
    proposal: CharacterEvolutionPendingProposal | null | undefined,
    chatId: string | null | undefined,
    startMessageIndex: number,
    endMessageIndex: number,
): CharacterEvolutionPendingProposal | null {
    if (!proposal) {
        return null
    }

    const normalizedChatId = typeof chatId === "string" ? chatId.trim() : ""
    if (
        !normalizedChatId
        || !Number.isInteger(startMessageIndex)
        || !Number.isInteger(endMessageIndex)
        || startMessageIndex < 0
        || endMessageIndex < startMessageIndex
    ) {
        return proposal
    }

    if (!proposal.sourceRange) {
        return proposal.sourceChatId === normalizedChatId ? null : proposal
    }

    if (proposal.sourceRange.chatId !== normalizedChatId) {
        return proposal
    }

    if (endMessageIndex < proposal.sourceRange.startMessageIndex) {
        const removedCount = endMessageIndex - startMessageIndex + 1
        return {
            ...proposal,
            sourceRange: {
                ...proposal.sourceRange,
                startMessageIndex: proposal.sourceRange.startMessageIndex - removedCount,
                endMessageIndex: proposal.sourceRange.endMessageIndex - removedCount,
            },
        }
    }

    if (startMessageIndex > proposal.sourceRange.endMessageIndex) {
        return proposal
    }

    return null
}

export function mergeProposalStateWithCurrentState(
    proposedState: CharacterEvolutionProposalState | null | undefined,
    currentState: CharacterEvolutionState,
): CharacterEvolutionState {
    const merged = structuredClone(currentState)
    const source = proposedState ?? {}
    const assignMergedSection = <K extends keyof CharacterEvolutionState>(key: K, sectionValue: CharacterEvolutionState[K] | CharacterEvolutionProposalState[K]) => {
        ;(merged as unknown as Record<string, unknown>)[key] = sectionValue as unknown
    }

    for (const key of CHARACTER_EVOLUTION_PROPOSAL_SECTION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(source, key)) continue
        if (key === "relationship") {
            const relationshipPatch = source.relationship ?? {}
            assignMergedSection(key, {
                ...merged.relationship,
                ...structuredClone(relationshipPatch),
            })
            continue
        }
        const sectionValue = structuredClone(source[key] as CharacterEvolutionState[typeof key])
        assignMergedSection(key, sectionValue)
    }

    return merged
}

export function buildChangedProposalState(
    currentState: CharacterEvolutionState,
    nextState: CharacterEvolutionState,
): CharacterEvolutionProposalState {
    const proposalState: CharacterEvolutionProposalState = {}
    const assignProposalSection = <K extends keyof CharacterEvolutionState>(key: K, sectionValue: CharacterEvolutionState[K]) => {
        ;(proposalState as Record<string, unknown>)[key] = sectionValue as unknown
    }

    for (const key of CHARACTER_EVOLUTION_PROPOSAL_SECTION_KEYS) {
        if (JSON.stringify(currentState[key]) === JSON.stringify(nextState[key])) {
            continue
        }
        const sectionValue = structuredClone(nextState[key])
        assignProposalSection(key, sectionValue)
    }

    return proposalState
}
