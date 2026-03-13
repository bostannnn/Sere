<script lang="ts">
    import EvolutionProposalSummary from "./EvolutionProposalSummary.svelte"
    import type { CharacterEvolutionPendingProposal } from "src/ts/storage/database.types"

    interface Props {
        currentPendingProposal: CharacterEvolutionPendingProposal | null
        reviewActionBusy: boolean
        onOpenFullscreenReview: () => void
        onRejectProposal: () => void | Promise<void>
    }

    let {
        currentPendingProposal,
        reviewActionBusy,
        onOpenFullscreenReview,
        onRejectProposal,
    }: Props = $props()
</script>

<div
    role="tabpanel"
    id="evolution-panel-review"
    aria-labelledby="evolution-subtab-2"
    tabindex="0"
>
    {#if currentPendingProposal}
        <EvolutionProposalSummary
            proposal={currentPendingProposal}
            onOpen={onOpenFullscreenReview}
            onReject={onRejectProposal}
            openDisabled={reviewActionBusy}
            rejectDisabled={reviewActionBusy}
        />
    {:else}
        <div class="ds-settings-section">
            <div class="ds-settings-card ds-settings-card-stack-start">
                <span class="ds-settings-label-muted-sm">
                    No pending evolution proposal. When a proposal is ready, open fullscreen review from here.
                </span>
            </div>
        </div>
    {/if}
</div>
