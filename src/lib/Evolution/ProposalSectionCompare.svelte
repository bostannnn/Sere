<script lang="ts">
    import { PlusIcon } from "@lucide/svelte";
    import type {
        CharacterEvolutionChange,
        CharacterEvolutionItem,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import {
        buildIndexedRowKey,
        buildProposalSectionScopeKey,
        countHiddenUnchangedRows,
        getProposalRowBadgeVariant,
        getProposalRowContainerVariant,
        getProposalRowStatusLabel,
        mergeProposalDisplayRows,
        shouldResetProposalSectionTransientState,
        upsertDismissedAddedRow,
    } from "./proposalSectionCompare.helpers";
    import type { ProposalDiffStatus } from "./proposalSectionCompare.helpers";
    import Button from "../UI/GUI/Button.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";

    type DiffStatus = ProposalDiffStatus;

    interface StringDiffRow {
        cacheKey: string;
        status: DiffStatus;
        currentIndex: number | null;
        proposedIndex: number | null;
        currentValue: string;
        proposedValue: string;
        forceVisible?: boolean;
        dismissed?: boolean;
    }

    interface FactDiffRow {
        cacheKey: string;
        status: DiffStatus;
        currentIndex: number | null;
        proposedIndex: number | null;
        currentItem: CharacterEvolutionItem | null;
        proposedItem: CharacterEvolutionItem | null;
        changedFields: string[];
        forceVisible?: boolean;
        dismissed?: boolean;
    }

    interface FieldDiffRow {
        cacheKey: string;
        key: "trustLevel" | "dynamic" | "state" | "residue";
        label: string;
        status: DiffStatus;
        currentValue: string;
        proposedValue: string;
        multiline?: boolean;
        forceVisible?: boolean;
    }

    interface Props {
        proposalId?: string | null;
        section: CharacterEvolutionSectionConfig;
        currentState: CharacterEvolutionState;
        proposedState: CharacterEvolutionState;
        change?: CharacterEvolutionChange | null;
        privacy?: CharacterEvolutionPrivacySettings;
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
    }: Props = $props();

    let showUnchangedRows = $state(false);
    let transientScopeKey = $state<string | null>(null);
    let forceVisibleRowKeys = $state<Record<string, true>>({});
    let dismissedStringRows = $state<StringDiffRow[]>([]);
    let dismissedFactRows = $state<FactDiffRow[]>([]);

    function isStringListSection(key: string) {
        return key === "activeThreads" || key === "runningJokes" || key === "userRead" || key === "keyMoments";
    }

    function isObjectSection(key: string) {
        return key === "relationship" || key === "lastInteractionEnded";
    }

    function stringItemsForState(state: CharacterEvolutionState, key: keyof CharacterEvolutionState): string[] {
        const sectionValue = state[key];
        return Array.isArray(sectionValue) ? [...sectionValue as string[]] : [];
    }

    function factItemsForState(state: CharacterEvolutionState, key: keyof CharacterEvolutionState): CharacterEvolutionItem[] {
        const sectionValue = state[key];
        return Array.isArray(sectionValue) ? [...sectionValue as CharacterEvolutionItem[]] : [];
    }

    function normalizeText(value: string | null | undefined) {
        return String(value ?? "").trim();
    }

    function displayText(value: string | null | undefined) {
        const normalized = normalizeText(value);
        return normalized || "Empty";
    }

    function areStringItemsEqual(left: string, right: string) {
        return normalizeText(left) === normalizeText(right);
    }

    function normalizeFactItem(item: CharacterEvolutionItem | null | undefined) {
        return {
            value: normalizeText(item?.value),
            confidence: item?.confidence ?? "suspected",
            status: item?.status ?? "active",
            note: normalizeText(item?.note),
        };
    }

    function areFactItemsEqual(left: CharacterEvolutionItem | null | undefined, right: CharacterEvolutionItem | null | undefined) {
        const normalizedLeft = normalizeFactItem(left);
        const normalizedRight = normalizeFactItem(right);
        return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
    }

    function changedFactFields(left: CharacterEvolutionItem | null | undefined, right: CharacterEvolutionItem | null | undefined) {
        const normalizedLeft = normalizeFactItem(left);
        const normalizedRight = normalizeFactItem(right);
        const fields: string[] = [];

        if (normalizedLeft.value !== normalizedRight.value) {
            fields.push("text");
        }
        if (normalizedLeft.confidence !== normalizedRight.confidence) {
            fields.push("confidence");
        }
        if (normalizedLeft.status !== normalizedRight.status) {
            fields.push("status");
        }
        if (normalizedLeft.note !== normalizedRight.note) {
            fields.push("note");
        }

        return fields;
    }

    function sectionHasItems(state: CharacterEvolutionState, key: keyof CharacterEvolutionState) {
        if (key === "relationship") {
            return Boolean(state.relationship.trustLevel || state.relationship.dynamic);
        }
        if (key === "lastInteractionEnded") {
            return Boolean(state.lastInteractionEnded.state || state.lastInteractionEnded.residue);
        }
        const sectionValue = state[key];
        return Array.isArray(sectionValue) ? sectionValue.length > 0 : false;
    }

    function addStringItem(key: keyof CharacterEvolutionState) {
        (proposedState[key] as string[]).push("");
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
        proposedState = {
            ...proposedState,
            [key]: items,
        };
    }

    function restoreFactRow(key: keyof CharacterEvolutionState, row: FactDiffRow) {
        if (!row.currentItem) {
            return;
        }
        const items = factItemsForState(proposedState, key);
        const insertAt = row.currentIndex === null ? items.length : Math.min(row.currentIndex, items.length);
        items.splice(insertAt, 0, { ...row.currentItem });
        proposedState = {
            ...proposedState,
            [key]: items,
        };
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
        proposedState = {
            ...proposedState,
            [key]: items,
        };
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
        items[index] = {
            ...current,
            [field]: next,
        };
        proposedState = {
            ...proposedState,
            [key]: items,
        };
    }

    function replaceFactItem(key: keyof CharacterEvolutionState, index: number, item: CharacterEvolutionItem) {
        const items = factItemsForState(proposedState, key);
        items[index] = {
            ...item,
        };
        proposedState = {
            ...proposedState,
            [key]: items,
        };
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

    function buildStringDiffRows(key: keyof CharacterEvolutionState) {
        const currentItems = stringItemsForState(currentState, key);
        const proposedItems = stringItemsForState(proposedState, key);
        const rows: StringDiffRow[] = [];
        const totalRows = Math.max(currentItems.length, proposedItems.length);

        for (let index = 0; index < totalRows; index += 1) {
            const currentValue = currentItems[index];
            const proposedValue = proposedItems[index];
            const cacheKey = buildIndexedRowKey(
                "string",
                currentValue !== undefined ? index : null,
                proposedValue !== undefined ? index : null,
            );

            if (currentValue !== undefined && proposedValue !== undefined) {
                rows.push({
                    cacheKey,
                    status: areStringItemsEqual(currentValue, proposedValue) ? "unchanged" : "changed",
                    currentIndex: index,
                    proposedIndex: index,
                    currentValue,
                    proposedValue,
                    forceVisible: forceVisibleRowKeys[cacheKey] === true,
                });
                continue;
            }

            if (currentValue !== undefined) {
                rows.push({
                    cacheKey,
                    status: "removed",
                    currentIndex: index,
                    proposedIndex: null,
                    currentValue,
                    proposedValue: "",
                    forceVisible: forceVisibleRowKeys[cacheKey] === true,
                });
                continue;
            }

            rows.push({
                cacheKey,
                status: "added",
                currentIndex: null,
                proposedIndex: index,
                currentValue: "",
                proposedValue: proposedValue ?? "",
                forceVisible: forceVisibleRowKeys[cacheKey] === true,
            });
        }

        return rows;
    }

    function buildFactDiffRows(key: keyof CharacterEvolutionState) {
        const currentItems = factItemsForState(currentState, key);
        const proposedItems = factItemsForState(proposedState, key);
        const rows: FactDiffRow[] = [];
        const totalRows = Math.max(currentItems.length, proposedItems.length);

        for (let index = 0; index < totalRows; index += 1) {
            const currentItem = currentItems[index];
            const proposedItem = proposedItems[index];
            const cacheKey = buildIndexedRowKey(
                "fact",
                currentItem ? index : null,
                proposedItem ? index : null,
            );

            if (currentItem && proposedItem) {
                rows.push({
                    cacheKey,
                    status: areFactItemsEqual(currentItem, proposedItem) ? "unchanged" : "changed",
                    currentIndex: index,
                    proposedIndex: index,
                    currentItem,
                    proposedItem,
                    changedFields: changedFactFields(currentItem, proposedItem),
                    forceVisible: forceVisibleRowKeys[cacheKey] === true,
                });
                continue;
            }

            if (currentItem) {
                rows.push({
                    cacheKey,
                    status: "removed",
                    currentIndex: index,
                    proposedIndex: null,
                    currentItem,
                    proposedItem: null,
                    changedFields: [],
                    forceVisible: forceVisibleRowKeys[cacheKey] === true,
                });
                continue;
            }

            rows.push({
                cacheKey,
                status: "added",
                currentIndex: null,
                proposedIndex: index,
                currentItem: null,
                proposedItem: proposedItem ?? null,
                changedFields: [],
                forceVisible: forceVisibleRowKeys[cacheKey] === true,
            });
        }

        return rows;
    }

    function buildObjectRows(): FieldDiffRow[] {
        if (section.key === "relationship") {
            return [
                {
                    cacheKey: "object:relationship:trustLevel",
                    key: "trustLevel",
                    label: "Trust level",
                    status: areStringItemsEqual(currentState.relationship.trustLevel, proposedState.relationship.trustLevel)
                        ? "unchanged"
                        : currentState.relationship.trustLevel && proposedState.relationship.trustLevel
                            ? "changed"
                            : proposedState.relationship.trustLevel
                                ? "added"
                                : "removed",
                    currentValue: currentState.relationship.trustLevel,
                    proposedValue: proposedState.relationship.trustLevel,
                    forceVisible: forceVisibleRowKeys["object:relationship:trustLevel"] === true,
                },
                {
                    cacheKey: "object:relationship:dynamic",
                    key: "dynamic",
                    label: "Dynamic",
                    multiline: true,
                    status: areStringItemsEqual(currentState.relationship.dynamic, proposedState.relationship.dynamic)
                        ? "unchanged"
                        : currentState.relationship.dynamic && proposedState.relationship.dynamic
                            ? "changed"
                            : proposedState.relationship.dynamic
                                ? "added"
                                : "removed",
                    currentValue: currentState.relationship.dynamic,
                    proposedValue: proposedState.relationship.dynamic,
                    forceVisible: forceVisibleRowKeys["object:relationship:dynamic"] === true,
                },
            ] satisfies FieldDiffRow[];
        }

        return [
            {
                cacheKey: "object:lastInteractionEnded:state",
                key: "state",
                label: "State",
                multiline: true,
                status: areStringItemsEqual(currentState.lastInteractionEnded.state, proposedState.lastInteractionEnded.state)
                    ? "unchanged"
                    : currentState.lastInteractionEnded.state && proposedState.lastInteractionEnded.state
                        ? "changed"
                        : proposedState.lastInteractionEnded.state
                            ? "added"
                            : "removed",
                currentValue: currentState.lastInteractionEnded.state,
                proposedValue: proposedState.lastInteractionEnded.state,
                forceVisible: forceVisibleRowKeys["object:lastInteractionEnded:state"] === true,
            },
            {
                cacheKey: "object:lastInteractionEnded:residue",
                key: "residue",
                label: "Residue",
                multiline: true,
                status: areStringItemsEqual(currentState.lastInteractionEnded.residue, proposedState.lastInteractionEnded.residue)
                    ? "unchanged"
                    : currentState.lastInteractionEnded.residue && proposedState.lastInteractionEnded.residue
                        ? "changed"
                        : proposedState.lastInteractionEnded.residue
                            ? "added"
                            : "removed",
                currentValue: currentState.lastInteractionEnded.residue,
                proposedValue: proposedState.lastInteractionEnded.residue,
                forceVisible: forceVisibleRowKeys["object:lastInteractionEnded:residue"] === true,
            },
        ] satisfies FieldDiffRow[];
    }

    function countRowsWithStatus(rows: Array<{ status: DiffStatus }>, status: DiffStatus) {
        return rows.filter((row) => row.status === status).length;
    }

    function diffRowLabel(row: StringDiffRow | FactDiffRow) {
        const index = row.proposedIndex ?? row.currentIndex;
        const ordinal = index === null ? "" : ` ${index + 1}`;

        if (isStringListSection(section.key)) {
            return row.status === "added" ? `New line${ordinal}` : `Line${ordinal}`;
        }

        return row.status === "added" ? `New item${ordinal}` : `Item${ordinal}`;
    }

    function rowDiscardLabel(status: DiffStatus) {
        if (status === "added") {
            return "Discard addition";
        }

        return "Revert change";
    }

    function sectionChangeSummary() {
        const summary: string[] = [];

        if (changedCount > 0) summary.push(`${changedCount} changed`);
        if (addedCount > 0) summary.push(`${addedCount} added`);
        if (removedCount > 0) summary.push(`${removedCount} removed`);

        return summary.join(" · ");
    }

    function changedFieldSummary(fields: string[]) {
        if (fields.length === 0) {
            return "";
        }

        return `Edited: ${fields.join(", ")}`;
    }

    const sectionKey = $derived(section.key as keyof CharacterEvolutionState);
    const proposalScopeKey = $derived(buildProposalSectionScopeKey(proposalId, section.key));
    const objectRows = $derived.by(() => isObjectSection(section.key) ? buildObjectRows() : []);
    const stringRows = $derived.by(() => isStringListSection(section.key) ? buildStringDiffRows(sectionKey) : []);
    const factRows = $derived.by(() => !isObjectSection(section.key) && !isStringListSection(section.key) ? buildFactDiffRows(sectionKey) : []);
    const displayStringRows = $derived.by(() => mergeProposalDisplayRows(stringRows, dismissedStringRows));
    const displayFactRows = $derived.by(() => mergeProposalDisplayRows(factRows, dismissedFactRows));
    const hiddenUnchangedCount = $derived.by(() => {
        if (isObjectSection(section.key)) {
            return countHiddenUnchangedRows(objectRows);
        }
        if (isStringListSection(section.key)) {
            return countHiddenUnchangedRows(stringRows);
        }
        return countHiddenUnchangedRows(factRows);
    });
    const changedCount = $derived.by(() => {
        if (isObjectSection(section.key)) {
            return countRowsWithStatus(objectRows, "changed");
        }
        if (isStringListSection(section.key)) {
            return countRowsWithStatus(stringRows, "changed");
        }
        return countRowsWithStatus(factRows, "changed");
    });
    const addedCount = $derived.by(() => {
        if (isObjectSection(section.key)) {
            return countRowsWithStatus(objectRows, "added");
        }
        if (isStringListSection(section.key)) {
            return countRowsWithStatus(stringRows, "added");
        }
        return countRowsWithStatus(factRows, "added");
    });
    const removedCount = $derived.by(() => {
        if (isObjectSection(section.key)) {
            return countRowsWithStatus(objectRows, "removed");
        }
        if (isStringListSection(section.key)) {
            return countRowsWithStatus(stringRows, "removed");
        }
        return countRowsWithStatus(factRows, "removed");
    });

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
            {#if sectionChangeSummary()}
                <span class="proposal-section-compare-counts">{sectionChangeSummary()}</span>
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
        <div class="proposal-diff-list">
            {#each objectRows as row (row.key)}
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
                                        <TextInput
                                            value={row.currentValue}
                                            placeholder="Trust level"
                                            disabled={true}
                                        />
                                    {:else if row.key === "dynamic"}
                                        <TextAreaInput
                                            value={row.currentValue}
                                            className="proposal-diff-textarea-shell"
                                            height="full"
                                            placeholder="Dynamic"
                                            disabled={true}
                                        />
                                    {:else if row.key === "state"}
                                        <TextAreaInput
                                            value={row.currentValue}
                                            className="proposal-diff-textarea-shell"
                                            height="full"
                                            placeholder="State"
                                            disabled={true}
                                        />
                                    {:else}
                                        <TextAreaInput
                                            value={row.currentValue}
                                            className="proposal-diff-textarea-shell"
                                            height="full"
                                            placeholder="Residue"
                                            disabled={true}
                                        />
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
    {:else if isStringListSection(section.key)}
        <div class="proposal-section-toolbar">
            <Button
                size="sm"
                styled="outlined"
                onclick={() => addStringItem(sectionKey)}
            >
                <PlusIcon size={16} />
                Add line
            </Button>
        </div>

        {#if !sectionHasItems(proposedState, sectionKey) && !sectionHasItems(currentState, sectionKey)}
            <div class="proposal-empty-state">No items in the current or proposed state yet.</div>
        {/if}

        <div class="proposal-diff-list">
            {#each displayStringRows as row (row.cacheKey)}
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
                                        <TextAreaInput
                                            value={row.currentValue}
                                            className="proposal-diff-textarea-shell"
                                            height="full"
                                            disabled={true}
                                        />
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
    {:else}
        <div class="proposal-section-toolbar">
            <Button
                size="sm"
                styled="outlined"
                onclick={() => addFactItem(sectionKey)}
            >
                <PlusIcon size={16} />
                Add item
            </Button>
        </div>

        {#if !sectionHasItems(proposedState, sectionKey) && !sectionHasItems(currentState, sectionKey)}
            <div class="proposal-empty-state">No items in the current or proposed state yet.</div>
        {/if}

        <div class="proposal-diff-list">
            {#each displayFactRows as row (row.cacheKey)}
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
                                            <TextInput
                                                value={row.currentItem.value ?? ""}
                                                placeholder="Value"
                                                disabled={true}
                                            />
                                            <div class="proposal-select-grid">
                                                <SelectInput
                                                    value={row.currentItem.confidence ?? "suspected"}
                                                    disabled={true}
                                                >
                                                    <OptionInput value="suspected">suspected</OptionInput>
                                                    <OptionInput value="likely">likely</OptionInput>
                                                    <OptionInput value="confirmed">confirmed</OptionInput>
                                                </SelectInput>
                                                <SelectInput
                                                    value={row.currentItem.status ?? "active"}
                                                    disabled={true}
                                                >
                                                    <OptionInput value="active">active</OptionInput>
                                                    <OptionInput value="archived">archived</OptionInput>
                                                    <OptionInput value="corrected">corrected</OptionInput>
                                                </SelectInput>
                                            </div>
                                            <TextAreaInput
                                                value={row.currentItem.note ?? ""}
                                                height="20"
                                                placeholder="Note"
                                                disabled={true}
                                            />
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
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    </article>
                {/if}
            {/each}
        </div>
    {/if}
</section>

<style>
    .proposal-section-compare {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        padding: var(--ds-space-3) 0;
    }

    .proposal-section-compare-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-3);
        flex-wrap: wrap;
    }

    .proposal-section-compare-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .proposal-section-compare-title {
        color: var(--ds-text-primary);
        font-size: clamp(1.05rem, 0.98rem + 0.25vw, 1.2rem);
        font-weight: var(--ds-font-weight-semibold);
    }

    .proposal-section-compare-summary {
        color: var(--ds-text-secondary);
        max-width: 58rem;
    }

    .proposal-section-compare-meta,
    .proposal-diff-row-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .proposal-section-compare-counts,
    .proposal-diff-row-meta {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .proposal-change-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 1.5rem;
        padding: 0.1rem 0.55rem;
        border-radius: var(--ds-radius-pill);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
        background: color-mix(in srgb, var(--ds-surface-3) 76%, transparent);
    }

    .proposal-change-badge--changed {
        color: color-mix(in srgb, oklch(0.77 0.12 80) 72%, white);
    }

    .proposal-change-badge--added {
        color: color-mix(in srgb, oklch(0.73 0.14 150) 72%, white);
    }

    .proposal-change-badge--removed {
        color: color-mix(in srgb, oklch(0.68 0.18 28) 78%, white);
    }

    .proposal-change-badge--unchanged {
        color: var(--ds-text-secondary);
    }

    .proposal-change-badge--dismissed {
        color: var(--ds-text-secondary);
    }

    .proposal-text-button {
        border: 0;
        background: transparent;
        color: var(--ds-text-secondary);
        font: inherit;
        cursor: pointer;
        padding: 0;
    }

    .proposal-text-button:hover {
        color: var(--ds-text-primary);
    }

    .proposal-section-evidence {
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
        border-radius: var(--ds-radius-lg);
        background: color-mix(in srgb, var(--ds-surface-2) 70%, transparent);
        padding: 0.8rem 1rem;
    }

    .proposal-section-evidence summary {
        cursor: pointer;
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        font-weight: var(--ds-font-weight-medium);
    }

    .proposal-section-evidence ul {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        margin: 0.9rem 0 0;
        padding-left: 1.1rem;
        color: var(--ds-text-secondary);
    }

    .proposal-section-toolbar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    .proposal-empty-state {
        padding: 1rem 1.1rem;
        border: 1px dashed color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
        border-radius: var(--ds-radius-lg);
        color: var(--ds-text-secondary);
        background: color-mix(in srgb, var(--ds-surface-2) 76%, transparent);
    }

    .proposal-diff-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
    }

    .proposal-diff-row {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: 0.9rem 1rem;
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
        border-radius: var(--ds-radius-lg);
        background: color-mix(in srgb, var(--ds-surface-2) 76%, transparent);
    }

    .proposal-diff-row--changed {
        border-color: color-mix(in srgb, oklch(0.77 0.12 80) 18%, var(--ds-border-subtle));
    }

    .proposal-diff-row--added {
        border-color: color-mix(in srgb, oklch(0.73 0.14 150) 18%, var(--ds-border-subtle));
    }

    .proposal-diff-row--removed {
        border-color: color-mix(in srgb, oklch(0.68 0.18 28) 18%, var(--ds-border-subtle));
    }

    .proposal-diff-row--dismissed {
        border-color: color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
    }

    .proposal-diff-row-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    .proposal-diff-row-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .proposal-diff-row-title {
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-md);
        font-weight: var(--ds-font-weight-semibold);
    }

    .proposal-diff-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        gap: var(--ds-space-2);
        align-items: stretch;
    }

    .proposal-diff-side {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        min-width: 0;
        height: 100%;
    }

    .proposal-diff-side-label {
        display: inline-flex;
        align-items: center;
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }

    .proposal-diff-arrow {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 100%;
        color: var(--ds-text-tertiary);
        font-size: 1rem;
        padding-top: 2.2rem;
    }

    .proposal-diff-surface {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        gap: 0.55rem;
        min-height: 4.5rem;
        height: 100%;
        padding: 0.85rem 0.95rem;
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 74%, transparent);
        border-radius: var(--ds-radius-lg);
        background: color-mix(in srgb, var(--ds-surface-1) 72%, transparent);
    }

    .proposal-diff-surface--editable {
        background: color-mix(in srgb, var(--ds-surface-3) 84%, transparent);
    }

    .proposal-diff-surface--editor,
    .proposal-diff-surface--form {
        padding: 0;
        border-color: transparent;
        background: transparent;
        min-height: 0;
    }

    .proposal-diff-surface--editor {
        min-height: 8rem;
    }

    .proposal-diff-placeholder {
        color: var(--ds-text-tertiary);
    }

    .proposal-fact-editor {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    :global(.proposal-diff-textarea-shell) {
        height: 100%;
        min-height: 8rem;
        box-shadow: none;
    }

    :global(.proposal-diff-textarea-shell .ds-textarea-input-layer),
    :global(.proposal-diff-textarea-shell .ds-textarea-input-layer-highlight) {
        padding: 1rem 1.1rem;
    }

    .proposal-select-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ds-space-2);
    }

    @media (max-width: 980px) {
        .proposal-diff-grid {
            grid-template-columns: 1fr;
        }

        .proposal-diff-arrow {
            display: none;
        }
    }

    @media (max-width: 640px) {
        .proposal-select-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
