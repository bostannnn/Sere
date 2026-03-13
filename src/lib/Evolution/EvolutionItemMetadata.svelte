<script lang="ts">
    import type { CharacterEvolutionItem } from "src/ts/storage/database.types";
    import { getCharacterEvolutionItemMetadataRows } from "src/ts/character-evolution/itemMetadata";

    interface Props {
        item?: CharacterEvolutionItem | null;
    }

    let { item = null }: Props = $props();

    const metadataRows = $derived(getCharacterEvolutionItemMetadataRows(item));
</script>

{#if metadataRows.length > 0}
    <div class="evolution-item-metadata">
        <span class="ds-settings-label-muted-sm evolution-item-metadata-label">Advanced metadata</span>
        <div class="evolution-item-metadata-list">
            {#each metadataRows as row (row.label)}
                <div class="evolution-item-metadata-row">
                    <span class="ds-settings-label-muted-sm evolution-item-metadata-key">{row.label}</span>
                    <span class="ds-settings-text-medium evolution-item-metadata-value">{row.value}</span>
                    {#if row.detail}
                        <span class="ds-settings-label-muted-sm evolution-item-metadata-detail">{row.detail}</span>
                    {/if}
                </div>
            {/each}
        </div>
    </div>
{/if}

<style>
    .evolution-item-metadata {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 80%, transparent);
        border-radius: var(--ds-radius-md);
        background: color-mix(in srgb, var(--ds-surface-2) 92%, transparent);
    }

    .evolution-item-metadata-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-item-metadata-row {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        padding-block: var(--ds-space-1);
    }

    .evolution-item-metadata-row + .evolution-item-metadata-row {
        border-top: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
    }

    .evolution-item-metadata-key,
    .evolution-item-metadata-value {
        min-width: 0;
        overflow-wrap: anywhere;
    }

    .evolution-item-metadata-value {
        font-family: var(--ds-font-family-mono, monospace);
        font-size: var(--ds-font-size-sm);
        line-height: 1.45;
    }

    .evolution-item-metadata-detail {
        font-family: var(--ds-font-family-mono, monospace);
        font-size: var(--ds-font-size-xs);
        line-height: 1.4;
    }
</style>
