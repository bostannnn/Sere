<script lang="ts">
    import type {
        CharacterEvolutionChange,
        CharacterEvolutionItem,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import { isCharacterEvolutionObjectSection } from "src/ts/character-evolution/items";
    import {
        buildProposalFactDiffRows,
        buildProposalObjectRows,
        buildProposalSectionScopeKey,
        buildProposalStringDiffRows,
        countHiddenUnchangedRows,
        getProposalRowBadgeVariant,
        getProposalRowContainerVariant,
        getProposalRowStatusLabel,
        mergeProposalDisplayRows,
        reviewCurrentProposalFactItems,
        sectionHasProposalItems,
        shouldResetProposalSectionTransientState,
        upsertDismissedAddedRow,
    } from "./proposalSectionCompare.helpers";
    import {
        changedProposalFieldSummary,
        countProposalRowsWithStatus,
        diffProposalRowLabel,
        proposalRowDiscardLabel,
        proposalSectionChangeSummary,
    } from "./proposalSectionCompare.summary";
    import type { FactDiffRow, FieldDiffRow, StringDiffRow } from "./proposalSectionCompare.types";
    import ProposalFactDiffList from "./ProposalFactDiffList.svelte";
    import ProposalObjectDiffList from "./ProposalObjectDiffList.svelte";
    import ProposalStringDiffList from "./ProposalStringDiffList.svelte";
    import "./proposalSectionCompare.css";

    interface Props {
        proposalId?: string | null;
        section: CharacterEvolutionSectionConfig;
        currentState: CharacterEvolutionState;
        proposedState: CharacterEvolutionState;
        change?: CharacterEvolutionChange | null;
        privacy?: CharacterEvolutionPrivacySettings;
        showAdvancedInfo?: boolean;
    }

    let {
        proposalId = null,
        section,
        currentState,
        proposedState = $bindable(),
        change = null,
        privacy: _privacy = {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        },
        showAdvancedInfo = false,
    }: Props = $props();

    let showUnchangedRows = $state(false);
    let transientScopeKey = $state<string | null>(null);
    let forceVisibleRowKeys = $state<Record<string, true>>({});
    let dismissedStringRows = $state<StringDiffRow[]>([]);
    let dismissedFactRows = $state<FactDiffRow[]>([]);
    const CHARACTER_EVOLUTION_STRING_SECTION_KEYS: readonly string[] = [];

    function isStringListSection(key: string) {
        return CHARACTER_EVOLUTION_STRING_SECTION_KEYS.includes(key);
    }

    function isObjectSection(key: string) {
        return isCharacterEvolutionObjectSection(key);
    }

    function stringItemsForState(state: CharacterEvolutionState, key: keyof CharacterEvolutionState): string[] {
        const sectionValue = state[key];
        return Array.isArray(sectionValue) ? [...sectionValue as unknown as string[]] : [];
    }

    function factItemsForState(state: CharacterEvolutionState, key: keyof CharacterEvolutionState): CharacterEvolutionItem[] {
        const sectionValue = state[key];
        return Array.isArray(sectionValue) ? [...sectionValue as CharacterEvolutionItem[]] : [];
    }

    function addStringItem(key: keyof CharacterEvolutionState) {
        (proposedState[key] as unknown as string[]).push("");
        proposedState = { ...proposedState };
    }

    function addFactItem(key: keyof CharacterEvolutionState) {
        (proposedState[key] as CharacterEvolutionItem[]).push({
            value: "",
            confidence: "suspected",
            note: "",
            status: "active",
        });
        proposedState = { ...proposedState };
    }

    function removeListItem(key: keyof CharacterEvolutionState, index: number) {
        (proposedState[key] as Array<unknown>).splice(index, 1);
        proposedState = { ...proposedState };
    }

    function restoreStringRow(key: keyof CharacterEvolutionState, row: StringDiffRow) {
        const items = stringItemsForState(proposedState, key);
        const insertAt = row.currentIndex === null ? items.length : Math.min(row.currentIndex, items.length);
        items.splice(insertAt, 0, row.currentValue);
        proposedState = { ...proposedState, [key]: items };
    }

    function restoreFactRow(key: keyof CharacterEvolutionState, row: FactDiffRow) {
        if (!row.currentItem) {
            return;
        }
        const items = factItemsForState(proposedState, key);
        const insertAt = row.currentIndex === null ? items.length : Math.min(row.currentIndex, items.length);
        items.splice(insertAt, 0, { ...row.currentItem });
        proposedState = { ...proposedState, [key]: items };
    }

    function updateRelationship(field: "trustLevel" | "dynamic", next: string) {
        proposedState = {
            ...proposedState,
            relationship: {
                ...proposedState.relationship,
                [field]: next,
            },
        };
    }

    function updateLastInteractionEnded(field: "state" | "residue", next: string) {
        proposedState = {
            ...proposedState,
            lastInteractionEnded: {
                ...proposedState.lastInteractionEnded,
                [field]: next,
            },
        };
    }

    function markRowVisible(cacheKey: string) {
        forceVisibleRowKeys = {
            ...forceVisibleRowKeys,
            [cacheKey]: true,
        };
    }

    function rememberDiscardedStringRow(row: StringDiffRow) {
        dismissedStringRows = upsertDismissedAddedRow(dismissedStringRows, row, {
            proposedValue: "",
        });
    }

    function rememberDiscardedFactRow(row: FactDiffRow) {
        dismissedFactRows = upsertDismissedAddedRow(dismissedFactRows, row, {
            proposedItem: null,
        });
    }

    function rejectObjectRow(row: FieldDiffRow) {
        if (row.key === "trustLevel" || row.key === "dynamic") {
            updateRelationship(row.key, row.currentValue);
            markRowVisible(row.cacheKey);
            return;
        }

        updateLastInteractionEnded(row.key, row.currentValue);
        markRowVisible(row.cacheKey);
    }

    function updateStringItem(key: keyof CharacterEvolutionState, index: number, next: string) {
        const items = stringItemsForState(proposedState, key);
        items[index] = next;
        proposedState = { ...proposedState, [key]: items };
    }

    function rejectStringRow(key: keyof CharacterEvolutionState, row: StringDiffRow) {
        if (row.status === "added") {
            if (row.proposedIndex !== null) {
                removeListItem(key, row.proposedIndex);
                rememberDiscardedStringRow(row);
            }
            return;
        }

        if (row.status === "removed") {
            restoreStringRow(key, row);
            markRowVisible(row.cacheKey);
            return;
        }

        if (row.proposedIndex !== null) {
            updateStringItem(key, row.proposedIndex, row.currentValue);
            markRowVisible(row.cacheKey);
        }
    }

    function updateFactItemField(
        key: keyof CharacterEvolutionState,
        index: number,
        field: keyof CharacterEvolutionItem,
        next: string,
    ) {
        const items = factItemsForState(proposedState, key);
        const current = items[index] ?? { value: "", status: "active" };
        items[index] = { ...current, [field]: next };
        proposedState = { ...proposedState, [key]: items };
    }

    function replaceFactItem(key: keyof CharacterEvolutionState, index: number, item: CharacterEvolutionItem) {
        const items = factItemsForState(proposedState, key);
        items[index] = { ...item };
        proposedState = { ...proposedState, [key]: items };
    }

    function rejectFactRow(key: keyof CharacterEvolutionState, row: FactDiffRow) {
        if (row.status === "added") {
            if (row.proposedIndex !== null) {
                removeListItem(key, row.proposedIndex);
                rememberDiscardedFactRow(row);
            }
            return;
        }

        if (row.status === "removed") {
            restoreFactRow(key, row);
            markRowVisible(row.cacheKey);
            return;
        }

        if (row.proposedIndex !== null && row.currentItem) {
            replaceFactItem(key, row.proposedIndex, row.currentItem);
            markRowVisible(row.cacheKey);
        }
    }

    const sectionKey = $derived(section.key as keyof CharacterEvolutionState);
    const proposalScopeKey = $derived(buildProposalSectionScopeKey(proposalId, section.key));
    const objectRows = $derived.by(() => isObjectSection(section.key) ? buildProposalObjectRows(section.key, currentState, proposedState, forceVisibleRowKeys) : []);
    const stringRows = $derived.by(() => isStringListSection(section.key) ? buildProposalStringDiffRows(stringItemsForState(currentState, sectionKey), stringItemsForState(proposedState, sectionKey), forceVisibleRowKeys) : []);
    const factRows = $derived.by(() => !isObjectSection(section.key) && !isStringListSection(section.key)
        ? buildProposalFactDiffRows(
            reviewCurrentProposalFactItems(factItemsForState(currentState, sectionKey), factItemsForState(proposedState, sectionKey)),
            factItemsForState(proposedState, sectionKey),
            forceVisibleRowKeys,
        )
        : []);
    const displayStringRows = $derived.by(() => mergeProposalDisplayRows(stringRows, dismissedStringRows));
    const displayFactRows = $derived.by(() => mergeProposalDisplayRows(factRows, dismissedFactRows));
    const hiddenUnchangedCount = $derived.by(() => {
        if (isObjectSection(section.key)) return countHiddenUnchangedRows(objectRows);
        if (isStringListSection(section.key)) return countHiddenUnchangedRows(stringRows);
        return countHiddenUnchangedRows(factRows);
    });
    const changedCount = $derived.by(() => {
        if (isObjectSection(section.key)) return countProposalRowsWithStatus(objectRows, "changed");
        if (isStringListSection(section.key)) return countProposalRowsWithStatus(stringRows, "changed");
        return countProposalRowsWithStatus(factRows, "changed");
    });
    const addedCount = $derived.by(() => {
        if (isObjectSection(section.key)) return countProposalRowsWithStatus(objectRows, "added");
        if (isStringListSection(section.key)) return countProposalRowsWithStatus(stringRows, "added");
        return countProposalRowsWithStatus(factRows, "added");
    });
    const removedCount = $derived.by(() => {
        if (isObjectSection(section.key)) return countProposalRowsWithStatus(objectRows, "removed");
        if (isStringListSection(section.key)) return countProposalRowsWithStatus(stringRows, "removed");
        return countProposalRowsWithStatus(factRows, "removed");
    });
    const hasAnyItems = $derived(sectionHasProposalItems(proposedState, sectionKey) || sectionHasProposalItems(currentState, sectionKey));

    $effect(() => {
        if (!shouldResetProposalSectionTransientState(transientScopeKey, proposalScopeKey)) {
            return;
        }

        transientScopeKey = proposalScopeKey;
        showUnchangedRows = false;
        forceVisibleRowKeys = {};
        dismissedStringRows = [];
        dismissedFactRows = [];
    });
</script>

<section class="proposal-section-compare">
    <div class="proposal-section-compare-head">
        <div class="proposal-section-compare-copy">
            <span class="proposal-section-compare-title">{section.label || section.key}</span>
            {#if change?.summary}
                <span class="proposal-section-compare-summary">{change.summary}</span>
            {/if}
        </div>

        <div class="proposal-section-compare-meta">
            {#if proposalSectionChangeSummary(changedCount, addedCount, removedCount)}
                <span class="proposal-section-compare-counts">{proposalSectionChangeSummary(changedCount, addedCount, removedCount)}</span>
            {/if}
            {#if hiddenUnchangedCount > 0}
                <button
                    type="button"
                    class="proposal-text-button"
                    onclick={() => {
                        showUnchangedRows = !showUnchangedRows;
                    }}
                >
                    {showUnchangedRows ? "Hide unchanged" : `Show ${hiddenUnchangedCount} unchanged`}
                </button>
            {/if}
        </div>
    </div>

    {#if change?.evidence && change.evidence.length > 0}
        <details class="proposal-section-evidence">
            <summary>Evidence</summary>
            <ul>
                {#each change.evidence as evidence (evidence)}
                    <li>{evidence}</li>
                {/each}
            </ul>
        </details>
    {/if}

    {#if isObjectSection(section.key)}
        <ProposalObjectDiffList
            rows={objectRows}
            {showUnchangedRows}
            {proposedState}
            rowDiscardLabel={proposalRowDiscardLabel}
            {rejectObjectRow}
            {updateRelationship}
            {updateLastInteractionEnded}
            {getProposalRowStatusLabel}
        />
    {:else if isStringListSection(section.key)}
        <ProposalStringDiffList
            rows={displayStringRows}
            {showUnchangedRows}
            {sectionKey}
            {hasAnyItems}
            {addStringItem}
            {updateStringItem}
            {rejectStringRow}
            diffRowLabel={(row) => diffProposalRowLabel(row, true)}
            rowDiscardLabel={proposalRowDiscardLabel}
            {getProposalRowContainerVariant}
            {getProposalRowBadgeVariant}
            {getProposalRowStatusLabel}
        />
    {:else}
        <ProposalFactDiffList
            rows={displayFactRows}
            {showUnchangedRows}
            {sectionKey}
            {hasAnyItems}
            {showAdvancedInfo}
            {addFactItem}
            {updateFactItemField}
            {rejectFactRow}
            diffRowLabel={(row) => diffProposalRowLabel(row, false)}
            rowDiscardLabel={proposalRowDiscardLabel}
            changedFieldSummary={changedProposalFieldSummary}
            {getProposalRowContainerVariant}
            {getProposalRowBadgeVariant}
            {getProposalRowStatusLabel}
        />
    {/if}
</section>
