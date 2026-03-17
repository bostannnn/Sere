<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte"

    interface Props {
        activeChatId?: string | null
        rebuildingSemanticRecall?: boolean
        handoffBusy?: boolean
        autoProcessing?: boolean
        onRebuildSemanticRecall?: () => void | Promise<void>
    }

    let {
        activeChatId = null,
        rebuildingSemanticRecall = false,
        handoffBusy = false,
        autoProcessing = false,
        onRebuildSemanticRecall = () => {},
    }: Props = $props()
</script>

<div
    class="ds-settings-section"
    role="tabpanel"
    id="evolution-panel-semantic-recall"
    aria-labelledby="evolution-subtab-5"
    tabindex="0"
>
    <div class="ds-settings-card evolution-semantic-recall-panel">
        <div class="evolution-semantic-recall-header">
            <span class="ds-settings-label">Semantic Recall Index</span>
            <span class="ds-settings-label-muted-sm">{activeChatId ? "Current chat" : "No active chat"}</span>
        </div>
        <span class="ds-settings-label-muted-sm">
            Rebuild the archived semantic recall index for the current chat now instead of waiting for lazy rebuild on next generation.
        </span>
        <Button
            size="sm"
            styled="outlined"
            className="ds-ui-fill-width"
            onclick={onRebuildSemanticRecall}
            disabled={!activeChatId || rebuildingSemanticRecall || handoffBusy || autoProcessing}
        >
            {rebuildingSemanticRecall ? "Rebuilding Semantic Recall" : "Rebuild Semantic Recall for Current Chat"}
        </Button>
    </div>
</div>

<style>
    .evolution-semantic-recall-panel {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-semantic-recall-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }
</style>
