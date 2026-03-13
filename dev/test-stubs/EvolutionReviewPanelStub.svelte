<script lang="ts">
    import type { CharacterEvolutionPendingProposal } from "src/ts/storage/database.types"

    interface Props {
        currentPendingProposal: CharacterEvolutionPendingProposal | null
        reviewActionBusy?: boolean
        onOpenFullscreenReview?: () => void
        onRejectProposal?: () => void
    }

    let {
        currentPendingProposal,
        onOpenFullscreenReview = () => {},
        onRejectProposal = () => {},
    }: Props = $props()
</script>

<div data-testid="review-panel-stub">
    <span data-testid="proposal-id">{currentPendingProposal?.proposalId ?? "none"}</span>
    <span data-testid="proposal-trust-level">{currentPendingProposal?.proposedState.relationship.trustLevel ?? ""}</span>
    <button data-testid="proposal-open" onclick={onOpenFullscreenReview}>Open Review</button>
    <button data-testid="proposal-reject" onclick={onRejectProposal}>Reject Proposal</button>
</div>
