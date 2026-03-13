<script lang="ts">
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import type {
        CharacterEvolutionItem,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import { isCharacterEvolutionObjectSection } from "src/ts/character-evolution/items";
    import SelectInput from "../UI/GUI/SelectInput.svelte";
    import OptionInput from "../UI/GUI/OptionInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";

    interface Props {
        value: CharacterEvolutionState;
        sectionConfigs: CharacterEvolutionSectionConfig[];
        privacy?: CharacterEvolutionPrivacySettings;
        readonly?: boolean;
        title?: string;
        itemFilter?: "all" | "active-only";
    }

    let {
        value = $bindable(),
        sectionConfigs = [],
        privacy = {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        },
        readonly = false,
        title = "Current State",
        itemFilter = "all",
    }: Props = $props();

    function canRenderSection(key: string) {
        if (key === "characterIntimatePreferences" && !privacy.allowCharacterIntimatePreferences) {
            return false;
        }
        if (key === "userIntimatePreferences" && !privacy.allowUserIntimatePreferences) {
            return false;
        }
        return true;
    }

    function addFactItem(key: keyof CharacterEvolutionState) {
        (value[key] as CharacterEvolutionItem[]).push({
            value: "",
            confidence: "suspected",
            note: "",
            status: "active",
        });
        value = { ...value };
    }

    function removeListItem(key: keyof CharacterEvolutionState, index: number) {
        (value[key] as Array<unknown>).splice(index, 1);
        value = { ...value };
    }

    function isObjectSection(key: string) {
        return isCharacterEvolutionObjectSection(key);
    }

    function factItemsForSection(key: keyof CharacterEvolutionState): CharacterEvolutionItem[] {
        const section = value[key];
        return Array.isArray(section) ? [...section as CharacterEvolutionItem[]] : [];
    }

    function visibleFactItemsForSection(key: keyof CharacterEvolutionState): Array<{ item: CharacterEvolutionItem; index: number }> {
        return factItemsForSection(key)
            .map((item, index) => ({ item, index }))
            .filter((entry) => itemFilter !== "active-only" || (entry.item.status ?? "active") === "active");
    }

    function updateRelationship(field: "trustLevel" | "dynamic", next: string) {
        value = {
            ...value,
            relationship: {
                ...value.relationship,
                [field]: next,
            },
        };
    }

    function updateLastInteractionEnded(field: "state" | "residue", next: string) {
        value = {
            ...value,
            lastInteractionEnded: {
                ...value.lastInteractionEnded,
                [field]: next,
            },
        };
    }

    function updateFactItemField(
        key: keyof CharacterEvolutionState,
        index: number,
        field: keyof CharacterEvolutionItem,
        next: string,
    ) {
        const items = factItemsForSection(key);
        const current = items[index] ?? { value: "", status: "active" };
        items[index] = {
            ...current,
            [field]: next,
        };
        value = {
            ...value,
            [key]: items,
        };
    }
</script>

<div class="ds-settings-section evolution-state-editor">
    <div class="evolution-state-editor-header">
        <span class="ds-settings-label">{title}</span>
    </div>
    <div class="ds-settings-list-shell evolution-state-editor-list">
        {#each sectionConfigs as section (section.key)}
            {#if section.enabled && canRenderSection(section.key)}
                <section class="evolution-state-section">
                    <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between evolution-state-section-head">
                        <div class="evolution-state-section-copy">
                            <span class="ds-settings-label">{section.label}</span>
                            {#if readonly}
                                <span class="ds-settings-label-muted-sm">{section.key}</span>
                            {/if}
                        </div>
                        {#if !readonly}
                            {#if !isObjectSection(section.key)}
                                <button
                                    type="button"
                                    class="evolution-state-icon-action icon-btn icon-btn--sm"
                                    aria-label={`Add ${section.label}`}
                                    title={`Add ${section.label}`}
                                    onclick={() => addFactItem(section.key as keyof CharacterEvolutionState)}>
                                    <PlusIcon size={16}/>
                                </button>
                            {/if}
                        {/if}
                    </div>

                    {#if section.key === "relationship"}
                        <div class="evolution-state-fields">
                            <TextInput value={value.relationship.trustLevel} disabled={readonly} placeholder="Trust level" oninput={(event) => updateRelationship("trustLevel", event.currentTarget.value)} />
                            <TextAreaInput value={value.relationship.dynamic} disabled={readonly} height="20" placeholder="Dynamic" onValueChange={(next) => updateRelationship("dynamic", next)} />
                        </div>
                    {:else if section.key === "lastInteractionEnded"}
                        <div class="evolution-state-fields">
                            <TextAreaInput value={value.lastInteractionEnded.state} disabled={readonly} height="20" placeholder="State" onValueChange={(next) => updateLastInteractionEnded("state", next)} />
                            <TextAreaInput value={value.lastInteractionEnded.residue} disabled={readonly} height="20" placeholder="Residue" onValueChange={(next) => updateLastInteractionEnded("residue", next)} />
                        </div>
                    {:else}
                        {#if visibleFactItemsForSection(section.key as keyof CharacterEvolutionState).length === 0}
                            <span class="ds-settings-label-muted-sm">No items</span>
                        {/if}
                        {#each visibleFactItemsForSection(section.key as keyof CharacterEvolutionState) as entry (entry.index)}
                            <div class="evolution-state-fact-row">
                                <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between evolution-state-fact-head">
                                    <span class="ds-settings-label-muted-sm">Item {entry.index + 1}</span>
                                    {#if !readonly}
                                        <button
                                            type="button"
                                            class="evolution-state-icon-action icon-btn icon-btn--sm"
                                            aria-label={`Remove ${section.label} item ${entry.index + 1}`}
                                            title={`Remove ${section.label} item ${entry.index + 1}`}
                                            onclick={() => removeListItem(section.key as keyof CharacterEvolutionState, entry.index)}
                                        >
                                            <TrashIcon size={16}/>
                                        </button>
                                    {/if}
                                </div>
                                <div class="evolution-state-fields">
                                    <TextInput value={entry.item.value} disabled={readonly} placeholder="Value" oninput={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, entry.index, "value", event.currentTarget.value)} />
                                    <div class="evolution-state-select-row">
                                        <SelectInput value={entry.item.confidence ?? "suspected"} disabled={readonly} onchange={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, entry.index, "confidence", event.currentTarget.value)}>
                                            <OptionInput value="suspected">suspected</OptionInput>
                                            <OptionInput value="likely">likely</OptionInput>
                                            <OptionInput value="confirmed">confirmed</OptionInput>
                                        </SelectInput>
                                        <SelectInput value={entry.item.status ?? "active"} disabled={readonly} onchange={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, entry.index, "status", event.currentTarget.value)}>
                                            <OptionInput value="active">active</OptionInput>
                                            <OptionInput value="archived">archived</OptionInput>
                                            <OptionInput value="corrected">corrected</OptionInput>
                                        </SelectInput>
                                    </div>
                                    <TextAreaInput value={entry.item.note ?? ""} disabled={readonly} height="20" placeholder="Note" onValueChange={(next) => updateFactItemField(section.key as keyof CharacterEvolutionState, entry.index, "note", next)} />
                                </div>
                            </div>
                        {/each}
                    {/if}
                </section>
            {/if}
        {/each}
    </div>
</div>

<style>
    .evolution-state-editor {
        gap: var(--ds-space-3);
    }

    .evolution-state-editor-list {
        width: 100%;
        border: 0;
        background: transparent;
    }

    .evolution-state-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) 0;
    }

    .evolution-state-section + .evolution-state-section {
        border-top: 1px solid var(--ds-border-subtle);
    }

    .evolution-state-section-head {
        align-items: center;
        gap: var(--ds-space-2);
    }

    .evolution-state-section-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .evolution-state-fields {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-state-fact-row {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding-block: var(--ds-space-1);
    }

    .evolution-state-fact-row + .evolution-state-fact-row {
        border-top: 1px solid color-mix(in srgb, var(--ds-border-subtle) 72%, transparent);
    }

    .evolution-state-fact-head {
        align-items: center;
        gap: var(--ds-space-2);
    }

    .evolution-state-select-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--ds-space-2);
    }

    .evolution-state-icon-action {
        flex: 0 0 auto;
    }

    @media (max-width: 640px) {
        .evolution-state-select-row {
            grid-template-columns: 1fr;
        }
    }
</style>
