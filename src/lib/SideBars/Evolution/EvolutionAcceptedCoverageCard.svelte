<script lang="ts">
    import type { CharacterEvolutionProcessedRange } from "src/ts/storage/database.types"

    interface Props {
        activeChatProcessedRanges: CharacterEvolutionProcessedRange[]
        activeChatProcessedCursor: number
        nextUnprocessedMessageNumber: number
    }

    let {
        activeChatProcessedRanges,
        activeChatProcessedCursor,
        nextUnprocessedMessageNumber,
    }: Props = $props()

    function formatProcessedRange(range: CharacterEvolutionProcessedRange["range"]) {
        return `Messages ${range.startMessageIndex + 1}-${range.endMessageIndex + 1}`
    }
</script>

<div class="evolution-accepted-coverage">
    <div class="evolution-manual-range-header">
        <span class="ds-settings-label">Accepted Coverage</span>
        <span class="ds-settings-label-muted-sm">{activeChatProcessedRanges.length} accepted range{activeChatProcessedRanges.length === 1 ? "" : "s"}</span>
    </div>

    {#if activeChatProcessedRanges.length > 0}
        <div class="evolution-accepted-coverage-list">
            {#each activeChatProcessedRanges as entry (entry.version + ":" + entry.range.chatId + ":" + entry.range.startMessageIndex + ":" + entry.range.endMessageIndex)}
                <div class="ds-settings-list-row evolution-accepted-coverage-row">
                    <span class="ds-settings-label-muted-sm">v{entry.version}</span>
                    <span class="ds-settings-text-medium">{formatProcessedRange(entry.range)}</span>
                </div>
            {/each}
        </div>
        <span class="ds-settings-label-muted-sm">Next unprocessed message: {nextUnprocessedMessageNumber}</span>
    {:else if activeChatProcessedCursor >= 0}
        <span class="ds-settings-label-muted-sm">
            Accepted coverage exists through message {activeChatProcessedCursor + 1}, but detailed range history is unavailable for this chat.
        </span>
        <span class="ds-settings-label-muted-sm">Next unprocessed message: {activeChatProcessedCursor + 2}</span>
    {:else}
        <span class="ds-settings-label-muted-sm">No accepted handoffs for the current chat yet.</span>
    {/if}
</div>

<style>
    .evolution-accepted-coverage {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        margin-bottom: var(--ds-space-3);
    }

    .evolution-accepted-coverage-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-accepted-coverage-row {
        justify-content: space-between;
        align-items: center;
        gap: var(--ds-space-3);
        min-height: 0;
        padding: 0;
    }

    .evolution-manual-range-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    @media (max-width: 640px) {
        .evolution-accepted-coverage-row {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
