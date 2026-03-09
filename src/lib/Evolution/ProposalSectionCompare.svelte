<script lang="ts">
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
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
        privacy = {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        },
    }: Props = $props();

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

    function updateStringItem(key: keyof CharacterEvolutionState, index: number, next: string) {
        const items = stringItemsForState(proposedState, key);
        items[index] = next;
        proposedState = {
            ...proposedState,
            [key]: items,
        };
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

    const sectionKey = $derived(section.key as keyof CharacterEvolutionState);
</script>

<section class="proposal-section-compare">
    <div class="proposal-section-compare-head">
        <div class="proposal-section-compare-copy">
            <span class="proposal-section-compare-title">{section.label || section.key}</span>
            {#if change?.summary}
                <span class="ds-settings-label-muted-sm">{change.summary}</span>
            {/if}
        </div>
        {#if change?.evidence && change.evidence.length > 0}
            <div class="proposal-section-compare-evidence">
                {#each change.evidence as evidence (evidence)}
                    <span class="proposal-section-compare-chip">{evidence}</span>
                {/each}
            </div>
        {/if}
    </div>

    <div class="proposal-section-compare-columns">
        <div class="proposal-section-column">
            <span class="proposal-section-column-label">Current</span>
            <div class="proposal-section-surface">
                {#if section.key === "relationship"}
                    <div class="proposal-field-stack">
                        <div class="proposal-static-field">
                            <span class="proposal-static-field-label">Trust level</span>
                            <span class:proposal-static-field-empty={!currentState.relationship.trustLevel}>
                                {currentState.relationship.trustLevel || "Empty"}
                            </span>
                        </div>
                        <div class="proposal-static-field">
                            <span class="proposal-static-field-label">Dynamic</span>
                            <span class:proposal-static-field-empty={!currentState.relationship.dynamic}>
                                {currentState.relationship.dynamic || "Empty"}
                            </span>
                        </div>
                    </div>
                {:else if section.key === "lastChatEnded"}
                    <div class="proposal-field-stack">
                        <div class="proposal-static-field">
                            <span class="proposal-static-field-label">State</span>
                            <span class:proposal-static-field-empty={!currentState.lastChatEnded.state}>
                                {currentState.lastChatEnded.state || "Empty"}
                            </span>
                        </div>
                        <div class="proposal-static-field">
                            <span class="proposal-static-field-label">Residue</span>
                            <span class:proposal-static-field-empty={!currentState.lastChatEnded.residue}>
                                {currentState.lastChatEnded.residue || "Empty"}
                            </span>
                        </div>
                    </div>
                {:else if isStringListSection(section.key)}
                    {#if stringItemsForState(currentState, sectionKey).length === 0}
                        <span class="ds-settings-label-muted-sm">No items</span>
                    {:else}
                        <div class="proposal-static-list">
                            {#each stringItemsForState(currentState, sectionKey) as item, index (index)}
                                <div class="proposal-static-item">
                                    <span>{item}</span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                {:else}
                    {#if factItemsForState(currentState, sectionKey).length === 0}
                        <span class="ds-settings-label-muted-sm">No items</span>
                    {:else}
                        <div class="proposal-static-list">
                            {#each factItemsForState(currentState, sectionKey) as item, index (index)}
                                <div class="proposal-static-item">
                                    <span>{item.value || "Empty"}</span>
                                    {#if item.confidence || item.status}
                                        <span class="ds-settings-label-muted-sm">
                                            {[item.confidence, item.status].filter(Boolean).join(" · ")}
                                        </span>
                                    {/if}
                                    {#if item.note}
                                        <span class="ds-settings-label-muted-sm">{item.note}</span>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                {/if}
            </div>
        </div>

        <div class="proposal-section-column">
            <div class="proposal-section-column-bar">
                <span class="proposal-section-column-label">Proposed</span>
                {#if !isObjectSection(section.key)}
                    <button
                        type="button"
                        class="proposal-section-column-action icon-btn icon-btn--sm"
                        aria-label={`Add ${section.label}`}
                        title={`Add ${section.label}`}
                        onclick={() => {
                            if (isStringListSection(section.key)) {
                                addStringItem(sectionKey);
                                return;
                            }
                            addFactItem(sectionKey);
                        }}
                    >
                        <PlusIcon size={16} />
                    </button>
                {/if}
            </div>
            <div class="proposal-section-surface proposal-section-surface-editable">
                {#if section.key === "relationship"}
                    <div class="proposal-field-stack">
                        <TextInput
                            value={proposedState.relationship.trustLevel}
                            placeholder="Trust level"
                            oninput={(event) => updateRelationship("trustLevel", event.currentTarget.value)}
                        />
                        <TextAreaInput
                            value={proposedState.relationship.dynamic}
                            height="20"
                            placeholder="Dynamic"
                            onValueChange={(next) => updateRelationship("dynamic", next)}
                        />
                    </div>
                {:else if section.key === "lastChatEnded"}
                    <div class="proposal-field-stack">
                        <TextAreaInput
                            value={proposedState.lastChatEnded.state}
                            height="20"
                            placeholder="State"
                            onValueChange={(next) => updateLastChatEnded("state", next)}
                        />
                        <TextAreaInput
                            value={proposedState.lastChatEnded.residue}
                            height="20"
                            placeholder="Residue"
                            onValueChange={(next) => updateLastChatEnded("residue", next)}
                        />
                    </div>
                {:else if isStringListSection(section.key)}
                    {#if !sectionHasItems(proposedState, sectionKey)}
                        <span class="ds-settings-label-muted-sm">No items</span>
                    {/if}
                    <div class="proposal-edit-list">
                        {#each stringItemsForState(proposedState, sectionKey) as item, index (index)}
                            <div class="proposal-edit-row">
                                <TextAreaInput
                                    value={item}
                                    height="20"
                                    onValueChange={(next) => updateStringItem(sectionKey, index, next)}
                                />
                                <button
                                    type="button"
                                    class="proposal-section-column-action icon-btn icon-btn--sm"
                                    aria-label={`Remove ${section.label} item ${index + 1}`}
                                    title={`Remove ${section.label} item ${index + 1}`}
                                    onclick={() => removeListItem(sectionKey, index)}
                                >
                                    <TrashIcon size={16} />
                                </button>
                            </div>
                        {/each}
                    </div>
                {:else}
                    {#if !sectionHasItems(proposedState, sectionKey)}
                        <span class="ds-settings-label-muted-sm">No items</span>
                    {/if}
                    <div class="proposal-edit-list">
                        {#each factItemsForState(proposedState, sectionKey) as item, index (index)}
                            <div class="proposal-fact-editor">
                                <div class="proposal-fact-editor-head">
                                    <span class="ds-settings-label-muted-sm">Item {index + 1}</span>
                                    <button
                                        type="button"
                                        class="proposal-section-column-action icon-btn icon-btn--sm"
                                        aria-label={`Remove ${section.label} item ${index + 1}`}
                                        title={`Remove ${section.label} item ${index + 1}`}
                                        onclick={() => removeListItem(sectionKey, index)}
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                </div>
                                <div class="proposal-field-stack">
                                    <TextInput
                                        value={item.value}
                                        placeholder="Value"
                                        oninput={(event) => updateFactItemField(sectionKey, index, "value", event.currentTarget.value)}
                                    />
                                    <div class="proposal-select-grid">
                                        <SelectInput
                                            value={item.confidence ?? "suspected"}
                                            onchange={(event) => updateFactItemField(sectionKey, index, "confidence", event.currentTarget.value)}
                                        >
                                            <OptionInput value="suspected">suspected</OptionInput>
                                            <OptionInput value="likely">likely</OptionInput>
                                            <OptionInput value="confirmed">confirmed</OptionInput>
                                        </SelectInput>
                                        <SelectInput
                                            value={item.status ?? "active"}
                                            onchange={(event) => updateFactItemField(sectionKey, index, "status", event.currentTarget.value)}
                                        >
                                            <OptionInput value="active">active</OptionInput>
                                            <OptionInput value="archived">archived</OptionInput>
                                            <OptionInput value="corrected">corrected</OptionInput>
                                        </SelectInput>
                                    </div>
                                    <TextAreaInput
                                        value={item.note ?? ""}
                                        height="20"
                                        placeholder="Note"
                                        onValueChange={(next) => updateFactItemField(sectionKey, index, "note", next)}
                                    />
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    </div>
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
        font-size: var(--ds-font-size-md);
        font-weight: var(--ds-font-weight-medium);
    }

    .proposal-section-compare-evidence {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-1);
    }

    .proposal-section-compare-chip {
        padding: 0.3rem 0.55rem;
        border-radius: var(--ds-radius-pill);
        background: color-mix(in srgb, var(--ds-surface-3) 72%, transparent);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
    }

    .proposal-section-compare-columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ds-space-3);
        align-items: start;
    }

    .proposal-section-column {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        min-width: 0;
    }

    .proposal-section-column-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
    }

    .proposal-section-column-label {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .proposal-section-surface {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        min-height: 100%;
        padding: var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-lg);
        background: var(--ds-surface-2);
    }

    .proposal-section-surface-editable {
        background: var(--ds-surface-3);
    }

    .proposal-field-stack,
    .proposal-edit-list,
    .proposal-static-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .proposal-static-field,
    .proposal-static-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .proposal-static-field-label {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .proposal-static-field-empty {
        color: var(--ds-text-tertiary);
    }

    .proposal-edit-row {
        display: flex;
        align-items: flex-start;
        gap: var(--ds-space-2);
    }

    .proposal-fact-editor {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding-top: var(--ds-space-1);
    }

    .proposal-fact-editor + .proposal-fact-editor {
        border-top: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
    }

    .proposal-fact-editor-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
    }

    .proposal-select-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ds-space-2);
    }

    .proposal-section-column-action {
        flex: 0 0 auto;
    }

    @media (max-width: 880px) {
        .proposal-section-compare-columns {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 640px) {
        .proposal-select-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
