<script lang="ts">
    import type { CharacterEvolutionState } from "src/ts/storage/database.types";
    import Button from "../UI/GUI/Button.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import { PlusIcon } from "@lucide/svelte";
    import type { DiffStatus, StringDiffRow } from "./proposalSectionCompare.types";

    interface Props {
        rows: StringDiffRow[];
        showUnchangedRows: boolean;
        sectionKey: keyof CharacterEvolutionState;
        hasAnyItems: boolean;
        addStringItem: (key: keyof CharacterEvolutionState) => void;
        updateStringItem: (key: keyof CharacterEvolutionState, index: number, next: string) => void;
        rejectStringRow: (key: keyof CharacterEvolutionState, row: StringDiffRow) => void;
        diffRowLabel: (row: StringDiffRow) => string;
        rowDiscardLabel: (status: DiffStatus) => string;
        getProposalRowContainerVariant: (status: DiffStatus, dismissed?: boolean) => string;
        getProposalRowBadgeVariant: (status: DiffStatus, dismissed?: boolean) => string;
        getProposalRowStatusLabel: (status: DiffStatus, dismissed?: boolean) => string;
    }

    let {
        rows,
        showUnchangedRows,
        sectionKey,
        hasAnyItems,
        addStringItem,
        updateStringItem,
        rejectStringRow,
        diffRowLabel,
        rowDiscardLabel,
        getProposalRowContainerVariant,
        getProposalRowBadgeVariant,
        getProposalRowStatusLabel,
    }: Props = $props();
</script>

<div class="proposal-section-toolbar">
    <Button size="sm" styled="outlined" onclick={() => addStringItem(sectionKey)}>
        <PlusIcon size={16} />
        Add line
    </Button>
</div>

{#if !hasAnyItems}
    <div class="proposal-empty-state">No items in the current or proposed state yet.</div>
{/if}

<div class="proposal-diff-list">
    {#each rows as row (row.cacheKey)}
        {#if showUnchangedRows || row.status !== "unchanged" || row.forceVisible}
            <article class={`proposal-diff-row proposal-diff-row--${getProposalRowContainerVariant(row.status, row.dismissed)}`}>
                <div class="proposal-diff-row-head">
                    <div class="proposal-diff-row-copy">
                        <span class="proposal-diff-row-title">{diffRowLabel(row)}</span>
                    </div>
                    <div class="proposal-diff-row-actions">
                        <span class={`proposal-change-badge proposal-change-badge--${getProposalRowBadgeVariant(row.status, row.dismissed)}`}>{getProposalRowStatusLabel(row.status, row.dismissed)}</span>
                        {#if row.status !== "unchanged" && !row.dismissed}
                            <button
                                type="button"
                                class="proposal-text-button"
                                onclick={() => rejectStringRow(sectionKey, row)}
                            >
                                {rowDiscardLabel(row.status)}
                            </button>
                        {/if}
                    </div>
                </div>

                <div class="proposal-diff-grid">
                    <div class="proposal-diff-side">
                        <span class="proposal-diff-side-label">Current</span>
                        <div class="proposal-diff-surface proposal-diff-surface--editor">
                            {#if row.status === "added" || row.dismissed}
                                <span class="proposal-diff-placeholder">No current line</span>
                            {:else}
                                <TextAreaInput value={row.currentValue} className="proposal-diff-textarea-shell" height="full" disabled={true} />
                            {/if}
                        </div>
                    </div>

                    <div class="proposal-diff-arrow" aria-hidden="true">-></div>

                    <div class="proposal-diff-side">
                        <span class="proposal-diff-side-label">Proposed</span>
                        <div class="proposal-diff-surface proposal-diff-surface--editable proposal-diff-surface--editor">
                            {#if row.dismissed}
                                <span class="proposal-diff-placeholder">Addition discarded.</span>
                            {:else if row.status === "removed"}
                                <span class="proposal-diff-placeholder">This line will be removed if you accept.</span>
                            {:else}
                                <TextAreaInput
                                    value={row.proposedValue}
                                    className="proposal-diff-textarea-shell"
                                    height="full"
                                    onValueChange={(next) => updateStringItem(sectionKey, row.proposedIndex ?? 0, next)}
                                />
                            {/if}
                        </div>
                    </div>
                </div>
            </article>
        {/if}
    {/each}
</div>
