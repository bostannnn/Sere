<script lang="ts">
    import { PlusIcon } from "@lucide/svelte";
    import type {
        CharacterEvolutionChange,
        CharacterEvolutionItem,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";

    type DiffStatus = "unchanged" | "changed" | "added" | "removed";

    interface StringDiffRow {
        status: DiffStatus;
        currentIndex: number | null;
        proposedIndex: number | null;
        currentValue: string;
        proposedValue: string;
    }

    interface FactDiffRow {
        status: DiffStatus;
        currentIndex: number | null;
        proposedIndex: number | null;
        currentItem: CharacterEvolutionItem | null;
        proposedItem: CharacterEvolutionItem | null;
        changedFields: string[];
    }

    interface FieldDiffRow {
        key: "trustLevel" | "dynamic" | "state" | "residue";
        label: string;
        status: DiffStatus;
        currentValue: string;
        proposedValue: string;
        multiline?: boolean;
    }

    interface Props {
        section: CharacterEvolutionSectionConfig;
        currentState: CharacterEvolutionState;
        proposedState: CharacterEvolutionState;
        change?: CharacterEvolutionChange | null;
        privacy?: CharacterEvolutionPrivacySettings;
    }

    let {
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

    function isStringListSection(key: string) {
        return key === "activeThreads" || key === "runningJokes" || key === "userRead" || key === "keyMoments";
    }

    function isObjectSection(key: string) {
        return key === "relationship" || key === "lastChatEnded";
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
        if (key === "lastChatEnded") {
            return Boolean(state.lastChatEnded.state || state.lastChatEnded.residue);
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

    function updateLastChatEnded(field: "state" | "residue", next: string) {
        proposedState = {
            ...proposedState,
            lastChatEnded: {
                ...proposedState.lastChatEnded,
                [field]: next,
            },
        };
    }

    function rejectObjectRow(row: FieldDiffRow) {
        if (row.key === "trustLevel" || row.key === "dynamic") {
            updateRelationship(row.key, row.currentValue);
            return;
        }

        updateLastChatEnded(row.key, row.currentValue);
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
            }
            return;
        }

        if (row.status === "removed") {
            restoreStringRow(key, row);
            return;
        }

        if (row.proposedIndex !== null) {
            updateStringItem(key, row.proposedIndex, row.currentValue);
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
            }
            return;
        }

        if (row.status === "removed") {
            restoreFactRow(key, row);
            return;
        }

        if (row.proposedIndex !== null && row.currentItem) {
            replaceFactItem(key, row.proposedIndex, row.currentItem);
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

            if (currentValue !== undefined && proposedValue !== undefined) {
                rows.push({
                    status: areStringItemsEqual(currentValue, proposedValue) ? "unchanged" : "changed",
                    currentIndex: index,
                    proposedIndex: index,
                    currentValue,
                    proposedValue,
                });
                continue;
            }

            if (currentValue !== undefined) {
                rows.push({
                    status: "removed",
                    currentIndex: index,
                    proposedIndex: null,
                    currentValue,
                    proposedValue: "",
                });
                continue;
            }

            rows.push({
                status: "added",
                currentIndex: null,
                proposedIndex: index,
                currentValue: "",
                proposedValue: proposedValue ?? "",
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

            if (currentItem && proposedItem) {
                rows.push({
                    status: areFactItemsEqual(currentItem, proposedItem) ? "unchanged" : "changed",
                    currentIndex: index,
                    proposedIndex: index,
                    currentItem,
                    proposedItem,
                    changedFields: changedFactFields(currentItem, proposedItem),
                });
                continue;
            }

            if (currentItem) {
                rows.push({
                    status: "removed",
                    currentIndex: index,
                    proposedIndex: null,
                    currentItem,
                    proposedItem: null,
                    changedFields: [],
                });
                continue;
            }

            rows.push({
                status: "added",
                currentIndex: null,
                proposedIndex: index,
                currentItem: null,
                proposedItem: proposedItem ?? null,
                changedFields: [],
            });
        }

        return rows;
    }

    function buildObjectRows() {
        if (section.key === "relationship") {
            return [
                {
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
                },
                {
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
                },
            ] satisfies FieldDiffRow[];
        }

        return [
            {
                key: "state",
                label: "State",
                multiline: true,
                status: areStringItemsEqual(currentState.lastChatEnded.state, proposedState.lastChatEnded.state)
                    ? "unchanged"
                    : currentState.lastChatEnded.state && proposedState.lastChatEnded.state
                        ? "changed"
                        : proposedState.lastChatEnded.state
                            ? "added"
                            : "removed",
                currentValue: currentState.lastChatEnded.state,
                proposedValue: proposedState.lastChatEnded.state,
            },
            {
                key: "residue",
                label: "Residue",
                multiline: true,
                status: areStringItemsEqual(currentState.lastChatEnded.residue, proposedState.lastChatEnded.residue)
                    ? "unchanged"
                    : currentState.lastChatEnded.residue && proposedState.lastChatEnded.residue
                        ? "changed"
                        : proposedState.lastChatEnded.residue
                            ? "added"
                            : "removed",
                currentValue: currentState.lastChatEnded.residue,
                proposedValue: proposedState.lastChatEnded.residue,
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

    function diffRowHint(status: DiffStatus) {
        if (status === "added") {
            return "Will be added to the accepted state.";
        }
        if (status === "removed") {
            return "Exists today, but will be removed if you accept.";
        }
        if (status === "changed") {
            return "Current value on the left will be replaced by the proposed value on the right.";
        }
        return "No change.";
    }

    function statusLabel(status: DiffStatus) {
        if (status === "added") return "Added";
        if (status === "removed") return "Removed";
        if (status === "changed") return "Changed";
        return "Unchanged";
    }

    function rowDiscardLabel(status: DiffStatus) {
        if (status === "added") {
            return "Discard addition";
        }

        return "Keep current";
    }

    function factMeta(item: CharacterEvolutionItem | null) {
        if (!item) {
            return "";
        }

        return [item.confidence ?? "suspected", item.status ?? "active"].filter(Boolean).join(" · ");
    }

    const sectionKey = $derived(section.key as keyof CharacterEvolutionState);
    const objectRows = $derived.by(() => isObjectSection(section.key) ? buildObjectRows() : []);
    const stringRows = $derived.by(() => isStringListSection(section.key) ? buildStringDiffRows(sectionKey) : []);
    const factRows = $derived.by(() => !isObjectSection(section.key) && !isStringListSection(section.key) ? buildFactDiffRows(sectionKey) : []);
    const hiddenUnchangedCount = $derived.by(() => {
        if (isObjectSection(section.key)) {
            return countRowsWithStatus(objectRows, "unchanged");
        }
        if (isStringListSection(section.key)) {
            return countRowsWithStatus(stringRows, "unchanged");
        }
        return countRowsWithStatus(factRows, "unchanged");
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
            {#if changedCount > 0}
                <span class="proposal-change-badge proposal-change-badge--changed">{changedCount} changed</span>
            {/if}
            {#if addedCount > 0}
                <span class="proposal-change-badge proposal-change-badge--added">{addedCount} added</span>
            {/if}
            {#if removedCount > 0}
                <span class="proposal-change-badge proposal-change-badge--removed">{removedCount} removed</span>
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
            <summary>Why this changed</summary>
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
                {#if showUnchangedRows || row.status !== "unchanged"}
                    <article class={`proposal-diff-row proposal-diff-row--${row.status}`}>
                        <div class="proposal-diff-row-head">
                            <div class="proposal-diff-row-copy">
                                <span class="proposal-diff-row-title">{row.label}</span>
                                <span class="proposal-diff-row-hint">{diffRowHint(row.status)}</span>
                            </div>
                            <span class={`proposal-change-badge proposal-change-badge--${row.status}`}>{statusLabel(row.status)}</span>
                        </div>

                        <div class="proposal-diff-grid">
                            <div class="proposal-diff-side">
                                <span class="proposal-diff-side-label">Current</span>
                                <div class="proposal-diff-surface">
                                    <span class:proposal-diff-placeholder={!normalizeText(row.currentValue)}>
                                        {displayText(row.currentValue)}
                                    </span>
                                </div>
                            </div>

                            <div class="proposal-diff-arrow" aria-hidden="true">-></div>

                            <div class="proposal-diff-side">
                                <div class="proposal-diff-side-bar">
                                    <span class="proposal-diff-side-label">Proposed</span>
                                    {#if row.status !== "unchanged"}
                                        <button
                                            type="button"
                                            class="proposal-inline-action"
                                            onclick={() => rejectObjectRow(row)}
                                        >
                                            {rowDiscardLabel(row.status)}
                                        </button>
                                    {/if}
                                </div>
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
                                            value={proposedState.lastChatEnded.state}
                                            className="proposal-diff-textarea-shell"
                                            height="full"
                                            placeholder="State"
                                            onValueChange={(next) => updateLastChatEnded("state", next)}
                                        />
                                    {:else}
                                        <TextAreaInput
                                            value={proposedState.lastChatEnded.residue}
                                            className="proposal-diff-textarea-shell"
                                            height="full"
                                            placeholder="Residue"
                                            onValueChange={(next) => updateLastChatEnded("residue", next)}
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
            <span class="proposal-section-toolbar-note">Each row maps one current line to its proposed result.</span>
            <button
                type="button"
                class="proposal-inline-action proposal-inline-action--primary"
                aria-label={`Add ${section.label}`}
                title={`Add ${section.label}`}
                onclick={() => addStringItem(sectionKey)}
            >
                <PlusIcon size={16} />
                Add line
            </button>
        </div>

        {#if !sectionHasItems(proposedState, sectionKey) && !sectionHasItems(currentState, sectionKey)}
            <div class="proposal-empty-state">No items in the current or proposed state yet.</div>
        {/if}

        <div class="proposal-diff-list">
            {#each stringRows as row, rowIndex (`${row.currentIndex ?? "c"}-${row.proposedIndex ?? "p"}-${rowIndex}`)}
                {#if showUnchangedRows || row.status !== "unchanged"}
                    <article class={`proposal-diff-row proposal-diff-row--${row.status}`}>
                        <div class="proposal-diff-row-head">
                            <div class="proposal-diff-row-copy">
                                <span class="proposal-diff-row-title">{diffRowLabel(row)}</span>
                                <span class="proposal-diff-row-hint">{diffRowHint(row.status)}</span>
                            </div>
                            <span class={`proposal-change-badge proposal-change-badge--${row.status}`}>{statusLabel(row.status)}</span>
                        </div>

                        <div class="proposal-diff-grid">
                            <div class="proposal-diff-side">
                                <span class="proposal-diff-side-label">Current</span>
                                <div class="proposal-diff-surface">
                                    {#if row.status === "added"}
                                        <span class="proposal-diff-placeholder">No current line</span>
                                    {:else}
                                        <span>{displayText(row.currentValue)}</span>
                                    {/if}
                                </div>
                            </div>

                            <div class="proposal-diff-arrow" aria-hidden="true">-></div>

                            <div class="proposal-diff-side">
                                <div class="proposal-diff-side-bar">
                                    <span class="proposal-diff-side-label">Proposed</span>
                                    {#if row.status !== "unchanged"}
                                        <button
                                            type="button"
                                            class="proposal-inline-action"
                                            onclick={() => rejectStringRow(sectionKey, row)}
                                        >
                                            {rowDiscardLabel(row.status)}
                                        </button>
                                    {/if}
                                </div>

                                <div class="proposal-diff-surface proposal-diff-surface--editable proposal-diff-surface--editor">
                                    {#if row.status === "removed"}
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
            <span class="proposal-section-toolbar-note">Each row maps one current item to its proposed result.</span>
            <button
                type="button"
                class="proposal-inline-action proposal-inline-action--primary"
                aria-label={`Add ${section.label}`}
                title={`Add ${section.label}`}
                onclick={() => addFactItem(sectionKey)}
            >
                <PlusIcon size={16} />
                Add item
            </button>
        </div>

        {#if !sectionHasItems(proposedState, sectionKey) && !sectionHasItems(currentState, sectionKey)}
            <div class="proposal-empty-state">No items in the current or proposed state yet.</div>
        {/if}

        <div class="proposal-diff-list">
            {#each factRows as row, rowIndex (`${row.currentIndex ?? "c"}-${row.proposedIndex ?? "p"}-${rowIndex}`)}
                {#if showUnchangedRows || row.status !== "unchanged"}
                    <article class={`proposal-diff-row proposal-diff-row--${row.status}`}>
                        <div class="proposal-diff-row-head">
                            <div class="proposal-diff-row-copy">
                                <span class="proposal-diff-row-title">{diffRowLabel(row)}</span>
                                <span class="proposal-diff-row-hint">{diffRowHint(row.status)}</span>
                            </div>
                            <div class="proposal-diff-row-badges">
                                <span class={`proposal-change-badge proposal-change-badge--${row.status}`}>{statusLabel(row.status)}</span>
                                {#if row.status === "changed"}
                                    {#each row.changedFields as field (field)}
                                        <span class="proposal-field-badge">{field}</span>
                                    {/each}
                                {/if}
                            </div>
                        </div>

                        <div class="proposal-diff-grid">
                            <div class="proposal-diff-side">
                                <span class="proposal-diff-side-label">Current</span>
                                <div class="proposal-diff-surface">
                                    {#if row.status === "added" || !row.currentItem}
                                        <span class="proposal-diff-placeholder">No current item</span>
                                    {:else}
                                        <div class="proposal-fact-summary">
                                            <span>{displayText(row.currentItem.value)}</span>
                                            <span class="proposal-fact-meta">{factMeta(row.currentItem)}</span>
                                            {#if row.currentItem.note}
                                                <span class="proposal-fact-note">{row.currentItem.note}</span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <div class="proposal-diff-arrow" aria-hidden="true">-></div>

                            <div class="proposal-diff-side">
                                <div class="proposal-diff-side-bar">
                                    <span class="proposal-diff-side-label">Proposed</span>
                                    {#if row.status !== "unchanged"}
                                        <button
                                            type="button"
                                            class="proposal-inline-action"
                                            onclick={() => rejectFactRow(sectionKey, row)}
                                        >
                                            {rowDiscardLabel(row.status)}
                                        </button>
                                    {/if}
                                </div>

                                <div class="proposal-diff-surface proposal-diff-surface--editable proposal-diff-surface--form">
                                    {#if row.status === "removed" || !row.proposedItem}
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
        gap: 6px;
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
    .proposal-diff-row-badges {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }

    .proposal-change-badge,
    .proposal-field-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 1.75rem;
        padding: 0.15rem 0.65rem;
        border-radius: var(--ds-radius-pill);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        letter-spacing: 0.02em;
    }

    .proposal-change-badge--changed {
        background: color-mix(in srgb, oklch(0.77 0.12 80) 18%, var(--ds-surface-3));
        color: color-mix(in srgb, oklch(0.77 0.12 80) 82%, white);
        border: 1px solid color-mix(in srgb, oklch(0.77 0.12 80) 36%, transparent);
    }

    .proposal-change-badge--added {
        background: color-mix(in srgb, oklch(0.73 0.14 150) 16%, var(--ds-surface-3));
        color: color-mix(in srgb, oklch(0.73 0.14 150) 82%, white);
        border: 1px solid color-mix(in srgb, oklch(0.73 0.14 150) 34%, transparent);
    }

    .proposal-change-badge--removed {
        background: color-mix(in srgb, oklch(0.68 0.18 28) 14%, var(--ds-surface-3));
        color: color-mix(in srgb, oklch(0.68 0.18 28) 85%, white);
        border: 1px solid color-mix(in srgb, oklch(0.68 0.18 28) 30%, transparent);
    }

    .proposal-change-badge--unchanged,
    .proposal-field-badge {
        background: color-mix(in srgb, var(--ds-surface-3) 78%, transparent);
        color: var(--ds-text-secondary);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
    }

    .proposal-text-button,
    .proposal-inline-action {
        border: 0;
        background: transparent;
        color: var(--ds-text-secondary);
        font: inherit;
        cursor: pointer;
        padding: 0;
    }

    .proposal-text-button:hover,
    .proposal-inline-action:hover {
        color: var(--ds-text-primary);
    }

    .proposal-inline-action {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        min-height: 2rem;
        padding: 0 0.8rem;
        border-radius: var(--ds-radius-pill);
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent);
        background: color-mix(in srgb, var(--ds-surface-3) 78%, transparent);
    }

    .proposal-inline-action--primary {
        color: var(--ds-text-primary);
    }

    .proposal-inline-icon {
        flex: 0 0 auto;
    }

    .proposal-section-evidence {
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
        border-radius: var(--ds-radius-lg);
        background: color-mix(in srgb, var(--ds-surface-2) 78%, transparent);
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
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    .proposal-section-toolbar-note {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
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
        gap: var(--ds-space-3);
        padding: 1rem;
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 78%, transparent);
        border-radius: calc(var(--ds-radius-lg) + 2px);
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--ds-surface-2) 82%, transparent),
            color-mix(in srgb, var(--ds-surface-1) 92%, transparent)
        );
    }

    .proposal-diff-row--changed {
        border-color: color-mix(in srgb, oklch(0.77 0.12 80) 22%, var(--ds-border-subtle));
    }

    .proposal-diff-row--added {
        border-color: color-mix(in srgb, oklch(0.73 0.14 150) 22%, var(--ds-border-subtle));
    }

    .proposal-diff-row--removed {
        border-color: color-mix(in srgb, oklch(0.68 0.18 28) 22%, var(--ds-border-subtle));
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
    }

    .proposal-diff-row-title {
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-md);
        font-weight: var(--ds-font-weight-semibold);
    }

    .proposal-diff-row-hint {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
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

    .proposal-diff-side-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        min-height: 2rem;
    }

    .proposal-diff-side-label {
        display: inline-flex;
        align-items: center;
        min-height: 2rem;
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
        min-height: 5rem;
        height: 100%;
        padding: 0.95rem 1rem;
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

    .proposal-fact-summary,
    .proposal-fact-editor {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
    }

    .proposal-fact-meta,
    .proposal-fact-note {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
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
