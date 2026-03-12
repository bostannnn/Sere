import type {
    CharacterEvolutionPendingProposal,
    CharacterEvolutionRangeRef,
} from "../storage/database.types"

export function getPendingProposalSourceRange(
    proposal: CharacterEvolutionPendingProposal | null | undefined,
): CharacterEvolutionRangeRef | null {
    return proposal?.sourceRange ?? null
}
