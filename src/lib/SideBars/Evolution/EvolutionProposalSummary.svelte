<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte"
    import type { CharacterEvolutionPendingProposal } from "src/ts/storage/database.types"

    interface Props {
        proposal: CharacterEvolutionPendingProposal
        title?: string
        description?: string
        openLabel?: string
        openDisabled?: boolean
        rejectDisabled?: boolean
        onOpen: () => void
        onReject?: (() => void | Promise<void>) | null
    }

    let {
        proposal,
        title = "Pending Proposal",
        description = "Review and accept this proposal in fullscreen. The sidebar only shows status and quick actions.",
        openLabel = "Open Fullscreen Review",
        openDisabled = false,
        rejectDisabled = false,
        onOpen,
        onReject = null,
    }: Props = $props()

    function getCoveredMessageCount() {
        if (!proposal.sourceRange) {
            return null
        }

        return Math.max(0, proposal.sourceRange.endMessageIndex - proposal.sourceRange.startMessageIndex + 1)
    }

    function formatSourceRange() {
        if (!proposal.sourceRange) {
            return null
        }

        return `Messages ${proposal.sourceRange.startMessageIndex + 1}-${proposal.sourceRange.endMessageIndex + 1}`
    }

    function formatCreatedAt(timestamp: number) {
        const date = new Date(timestamp)
        if (Number.isNaN(date.getTime())) {
            return "Just now"
        }

        return new Intl.DateTimeFormat(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
        }).format(date)
    }

    const changedSectionCount = $derived(proposal.changes.length)
    const coveredMessageCount = $derived(getCoveredMessageCount())
    const sourceRangeLabel = $derived(formatSourceRange())
    const createdAtLabel = $derived(formatCreatedAt(proposal.createdAt))
</script>

<div class="ds-settings-card ds-settings-card-stack-start evolution-proposal-summary">
    <div class="evolution-proposal-summary-head">
        <div class="evolution-proposal-summary-copy">
            <span class="ds-settings-label">{title}</span>
            <span class="ds-settings-label-muted-sm">{description}</span>
        </div>
        <span class="evolution-proposal-summary-badge">Pending review</span>
    </div>

    <div class="ds-settings-list-container evolution-proposal-summary-metrics">
        <div class="ds-settings-list-row ds-settings-list-row-inset evolution-proposal-summary-row">
            <span class="ds-settings-label-muted-sm">Changed sections</span>
            <span class="ds-settings-text-medium">{changedSectionCount}</span>
        </div>
        {#if sourceRangeLabel !== null}
            <div class="ds-settings-list-row ds-settings-list-row-inset evolution-proposal-summary-row">
                <span class="ds-settings-label-muted-sm">Source range</span>
                <span class="ds-settings-text-medium evolution-proposal-summary-value">
                    {sourceRangeLabel}{#if coveredMessageCount !== null} ({coveredMessageCount} messages){/if}
                </span>
            </div>
        {/if}
        <div class="ds-settings-list-row ds-settings-list-row-inset evolution-proposal-summary-row">
            <span class="ds-settings-label-muted-sm">Created</span>
            <span class="ds-settings-text-medium evolution-proposal-summary-value">{createdAtLabel}</span>
        </div>
    </div>

    <div class="ds-settings-inline-actions action-rail evolution-proposal-summary-actions">
        <Button size="sm" onclick={onOpen} disabled={openDisabled}>{openLabel}</Button>
        {#if onReject}
            <Button size="sm" styled="danger" onclick={onReject} disabled={rejectDisabled}>Reject Proposal</Button>
        {/if}
    </div>
</div>

<style>
    .evolution-proposal-summary {
        gap: var(--ds-space-3);
    }

    .evolution-proposal-summary-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-3);
        width: 100%;
        flex-wrap: wrap;
    }

    .evolution-proposal-summary-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .evolution-proposal-summary-badge {
        display: inline-flex;
        align-items: center;
        min-height: var(--ds-height-control-sm);
        padding: 0 var(--ds-space-2);
        border: 1px solid color-mix(in srgb, var(--color-blue-500) 28%, var(--ds-border-subtle));
        border-radius: var(--ds-radius-pill);
        background: color-mix(in srgb, var(--color-blue-500) 10%, var(--ds-surface-2));
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        white-space: nowrap;
    }

    .evolution-proposal-summary-metrics {
        width: 100%;
        overflow: hidden;
    }

    .evolution-proposal-summary-row {
        justify-content: space-between;
        gap: var(--ds-space-3);
    }

    .evolution-proposal-summary-row + .evolution-proposal-summary-row {
        border-top: 1px solid var(--ds-border-subtle);
    }

    .evolution-proposal-summary-value {
        min-width: 0;
        text-align: right;
        overflow-wrap: anywhere;
    }

    .evolution-proposal-summary-actions {
        width: 100%;
    }

    @media (max-width: 640px) {
        .evolution-proposal-summary-head {
            flex-direction: column;
        }

        .evolution-proposal-summary-row {
            align-items: flex-start;
            flex-direction: column;
        }

        .evolution-proposal-summary-value {
            text-align: left;
        }
    }
</style>
