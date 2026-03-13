<script lang="ts">
    import type { CharacterEvolutionState } from "src/ts/storage/database.types";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import type { DiffStatus, FieldDiffRow } from "./proposalSectionCompare.types";

    interface Props {
        rows: FieldDiffRow[];
        showUnchangedRows: boolean;
        proposedState: CharacterEvolutionState;
        rowDiscardLabel: (status: DiffStatus) => string;
        rejectObjectRow: (row: FieldDiffRow) => void;
        updateRelationship: (field: "trustLevel" | "dynamic", next: string) => void;
        updateLastInteractionEnded: (field: "state" | "residue", next: string) => void;
        getProposalRowStatusLabel: (status: DiffStatus, dismissed?: boolean) => string;
    }

    let {
        rows,
        showUnchangedRows,
        proposedState,
        rowDiscardLabel,
        rejectObjectRow,
        updateRelationship,
        updateLastInteractionEnded,
        getProposalRowStatusLabel,
    }: Props = $props();
</script>

<div class="proposal-diff-list">
    {#each rows as row (row.key)}
        {#if showUnchangedRows || row.status !== "unchanged" || row.forceVisible}
            <article class={`proposal-diff-row proposal-diff-row--${row.status}`}>
                <div class="proposal-diff-row-head">
                    <div class="proposal-diff-row-copy">
                        <span class="proposal-diff-row-title">{row.label}</span>
                    </div>
                    <div class="proposal-diff-row-actions">
                        <span class={`proposal-change-badge proposal-change-badge--${row.status}`}>{getProposalRowStatusLabel(row.status)}</span>
                        {#if row.status !== "unchanged"}
                            <button
                                type="button"
                                class="proposal-text-button"
                                onclick={() => rejectObjectRow(row)}
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
                            {#if row.key === "trustLevel"}
                                <TextInput value={row.currentValue} placeholder="Trust level" disabled={true} />
                            {:else if row.key === "dynamic"}
                                <TextAreaInput value={row.currentValue} className="proposal-diff-textarea-shell" height="full" placeholder="Dynamic" disabled={true} />
                            {:else if row.key === "state"}
                                <TextAreaInput value={row.currentValue} className="proposal-diff-textarea-shell" height="full" placeholder="State" disabled={true} />
                            {:else}
                                <TextAreaInput value={row.currentValue} className="proposal-diff-textarea-shell" height="full" placeholder="Residue" disabled={true} />
                            {/if}
                        </div>
                    </div>

                    <div class="proposal-diff-arrow" aria-hidden="true">-></div>

                    <div class="proposal-diff-side">
                        <span class="proposal-diff-side-label">Proposed</span>
                        <div class="proposal-diff-surface proposal-diff-surface--editable proposal-diff-surface--editor">
                            {#if row.key === "trustLevel"}
                                <TextInput
                                    value={proposedState.relationship.trustLevel}
                                    placeholder="Trust level"
                                    oninput={(event) => updateRelationship("trustLevel", event.currentTarget.value)}
                                />
                            {:else if row.key === "dynamic"}
                                <TextAreaInput
                                    value={proposedState.relationship.dynamic}
                                    className="proposal-diff-textarea-shell"
                                    height="full"
                                    placeholder="Dynamic"
                                    onValueChange={(next) => updateRelationship("dynamic", next)}
                                />
                            {:else if row.key === "state"}
                                <TextAreaInput
                                    value={proposedState.lastInteractionEnded.state}
                                    className="proposal-diff-textarea-shell"
                                    height="full"
                                    placeholder="State"
                                    onValueChange={(next) => updateLastInteractionEnded("state", next)}
                                />
                            {:else}
                                <TextAreaInput
                                    value={proposedState.lastInteractionEnded.residue}
                                    className="proposal-diff-textarea-shell"
                                    height="full"
                                    placeholder="Residue"
                                    onValueChange={(next) => updateLastInteractionEnded("residue", next)}
                                />
                            {/if}
                        </div>
                    </div>
                </div>
            </article>
        {/if}
    {/each}
</div>
