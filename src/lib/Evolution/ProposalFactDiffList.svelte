<script lang="ts">
    import { PlusIcon } from "@lucide/svelte";
    import type {
        CharacterEvolutionItem,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import EvolutionItemMetadata from "./EvolutionItemMetadata.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import type { DiffStatus, FactDiffRow } from "./proposalSectionCompare.types";

    interface Props {
        rows: FactDiffRow[];
        showUnchangedRows: boolean;
        sectionKey: keyof CharacterEvolutionState;
        hasAnyItems: boolean;
        showAdvancedInfo: boolean;
        addFactItem: (key: keyof CharacterEvolutionState) => void;
        updateFactItemField: (
            key: keyof CharacterEvolutionState,
            index: number,
            field: keyof CharacterEvolutionItem,
            next: string,
        ) => void;
        rejectFactRow: (key: keyof CharacterEvolutionState, row: FactDiffRow) => void;
        diffRowLabel: (row: FactDiffRow) => string;
        rowDiscardLabel: (status: DiffStatus) => string;
        changedFieldSummary: (fields: string[]) => string;
        getProposalRowContainerVariant: (status: DiffStatus, dismissed?: boolean) => string;
        getProposalRowBadgeVariant: (status: DiffStatus, dismissed?: boolean) => string;
        getProposalRowStatusLabel: (status: DiffStatus, dismissed?: boolean) => string;
    }

    let {
        rows,
        showUnchangedRows,
        sectionKey,
        hasAnyItems,
        showAdvancedInfo,
        addFactItem,
        updateFactItemField,
        rejectFactRow,
        diffRowLabel,
        rowDiscardLabel,
        changedFieldSummary,
        getProposalRowContainerVariant,
        getProposalRowBadgeVariant,
        getProposalRowStatusLabel,
    }: Props = $props();
</script>

<div class="proposal-section-toolbar">
    <Button size="sm" styled="outlined" onclick={() => addFactItem(sectionKey)}>
        <PlusIcon size={16} />
        Add item
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
                        {#if row.status === "changed"}
                            <span class="proposal-diff-row-meta">{changedFieldSummary(row.changedFields)}</span>
                        {/if}
                    </div>
                    <div class="proposal-diff-row-actions">
                        <span class={`proposal-change-badge proposal-change-badge--${getProposalRowBadgeVariant(row.status, row.dismissed)}`}>{getProposalRowStatusLabel(row.status, row.dismissed)}</span>
                        {#if row.status !== "unchanged" && !row.dismissed}
                            <button
                                type="button"
                                class="proposal-text-button"
                                onclick={() => rejectFactRow(sectionKey, row)}
                            >
                                {rowDiscardLabel(row.status)}
                            </button>
                        {/if}
                    </div>
                </div>

                <div class="proposal-diff-grid">
                    <div class="proposal-diff-side">
                        <span class="proposal-diff-side-label">Current</span>
                        <div class="proposal-diff-surface proposal-diff-surface--form">
                            {#if row.status === "added" || !row.currentItem}
                                <span class="proposal-diff-placeholder">No current item</span>
                            {:else}
                                <div class="proposal-fact-editor">
                                    <TextInput value={row.currentItem.value ?? ""} placeholder="Value" disabled={true} />
                                    <div class="proposal-select-grid">
                                        <SelectInput value={row.currentItem.confidence ?? "suspected"} disabled={true}>
                                            <OptionInput value="suspected">suspected</OptionInput>
                                            <OptionInput value="likely">likely</OptionInput>
                                            <OptionInput value="confirmed">confirmed</OptionInput>
                                        </SelectInput>
                                        <SelectInput value={row.currentItem.status ?? "active"} disabled={true}>
                                            <OptionInput value="active">active</OptionInput>
                                            <OptionInput value="archived">archived</OptionInput>
                                            <OptionInput value="corrected">corrected</OptionInput>
                                        </SelectInput>
                                    </div>
                                    <TextAreaInput value={row.currentItem.note ?? ""} height="20" placeholder="Note" disabled={true} />
                                    {#if showAdvancedInfo}
                                        <EvolutionItemMetadata item={row.currentItem} />
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>

                    <div class="proposal-diff-arrow" aria-hidden="true">-></div>

                    <div class="proposal-diff-side">
                        <span class="proposal-diff-side-label">Proposed</span>
                        <div class="proposal-diff-surface proposal-diff-surface--editable proposal-diff-surface--form">
                            {#if row.dismissed}
                                <span class="proposal-diff-placeholder">Addition discarded.</span>
                            {:else if row.status === "removed" || !row.proposedItem}
                                <span class="proposal-diff-placeholder">This item will be removed if you accept.</span>
                            {:else}
                                <div class="proposal-fact-editor">
                                    <TextInput
                                        value={row.proposedItem.value}
                                        placeholder="Value"
                                        oninput={(event) => updateFactItemField(sectionKey, row.proposedIndex ?? 0, "value", event.currentTarget.value)}
                                    />
                                    <div class="proposal-select-grid">
                                        <SelectInput
                                            value={row.proposedItem.confidence ?? "suspected"}
                                            onchange={(event) => updateFactItemField(sectionKey, row.proposedIndex ?? 0, "confidence", event.currentTarget.value)}
                                        >
                                            <OptionInput value="suspected">suspected</OptionInput>
                                            <OptionInput value="likely">likely</OptionInput>
                                            <OptionInput value="confirmed">confirmed</OptionInput>
                                        </SelectInput>
                                        <SelectInput
                                            value={row.proposedItem.status ?? "active"}
                                            onchange={(event) => updateFactItemField(sectionKey, row.proposedIndex ?? 0, "status", event.currentTarget.value)}
                                        >
                                            <OptionInput value="active">active</OptionInput>
                                            <OptionInput value="archived">archived</OptionInput>
                                            <OptionInput value="corrected">corrected</OptionInput>
                                        </SelectInput>
                                    </div>
                                    <TextAreaInput
                                        value={row.proposedItem.note ?? ""}
                                        height="20"
                                        placeholder="Note"
                                        onValueChange={(next) => updateFactItemField(sectionKey, row.proposedIndex ?? 0, "note", next)}
                                    />
                                    {#if showAdvancedInfo}
                                        <EvolutionItemMetadata item={row.proposedItem} />
                                    {/if}
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </article>
        {/if}
    {/each}
</div>
