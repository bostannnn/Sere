<script lang="ts">
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import type {
        CharacterEvolutionItem,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
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

    function addStringItem(key: keyof CharacterEvolutionState) {
        (value[key] as string[]).push("");
        value = { ...value };
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

    function isStringListSection(key: string) {
        return key === "activeThreads" || key === "runningJokes" || key === "userRead" || key === "keyMoments";
    }

    function isObjectSection(key: string) {
        return key === "relationship" || key === "lastChatEnded";
    }

    function stringItemsForSection(key: keyof CharacterEvolutionState): string[] {
        const section = value[key];
        return Array.isArray(section) ? [...section as string[]] : [];
    }

    function factItemsForSection(key: keyof CharacterEvolutionState): CharacterEvolutionItem[] {
        const section = value[key];
        return Array.isArray(section) ? [...section as CharacterEvolutionItem[]] : [];
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

    function updateLastChatEnded(field: "state" | "residue", next: string) {
        value = {
            ...value,
            lastChatEnded: {
                ...value.lastChatEnded,
                [field]: next,
            },
        };
    }

    function updateStringItem(key: keyof CharacterEvolutionState, index: number, next: string) {
        const items = stringItemsForSection(key);
        items[index] = next;
        value = {
            ...value,
            [key]: items,
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
                                    onclick={() => {
                                    if (isStringListSection(section.key)) {
                                        addStringItem(section.key as keyof CharacterEvolutionState)
                                        return
                                    }
                                    addFactItem(section.key as keyof CharacterEvolutionState)
                                }}>
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
                    {:else if section.key === "lastChatEnded"}
                        <div class="evolution-state-fields">
                            <TextAreaInput value={value.lastChatEnded.state} disabled={readonly} height="20" placeholder="State" onValueChange={(next) => updateLastChatEnded("state", next)} />
                            <TextAreaInput value={value.lastChatEnded.residue} disabled={readonly} height="20" placeholder="Residue" onValueChange={(next) => updateLastChatEnded("residue", next)} />
                        </div>
                    {:else if isStringListSection(section.key)}
                        {#if stringItemsForSection(section.key as keyof CharacterEvolutionState).length === 0}
                            <span class="ds-settings-label-muted-sm">No items</span>
                        {/if}
                        {#each stringItemsForSection(section.key as keyof CharacterEvolutionState) as item, index (index)}
                            <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-nowrap evolution-state-inline-row">
                                <TextAreaInput value={item} disabled={readonly} height="20" onValueChange={(next) => updateStringItem(section.key as keyof CharacterEvolutionState, index, next)} />
                                {#if !readonly}
                                    <button
                                        type="button"
                                        class="evolution-state-icon-action icon-btn icon-btn--sm"
                                        aria-label={`Remove ${section.label} item ${index + 1}`}
                                        title={`Remove ${section.label} item ${index + 1}`}
                                        onclick={() => removeListItem(section.key as keyof CharacterEvolutionState, index)}
                                    >
                                        <TrashIcon size={16}/>
                                    </button>
                                {/if}
                            </div>
                        {/each}
                    {:else}
                        {#if factItemsForSection(section.key as keyof CharacterEvolutionState).length === 0}
                            <span class="ds-settings-label-muted-sm">No items</span>
                        {/if}
                        {#each factItemsForSection(section.key as keyof CharacterEvolutionState) as item, index (index)}
                            <div class="evolution-state-fact-row">
                                <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between evolution-state-fact-head">
                                    <span class="ds-settings-label-muted-sm">Item {index + 1}</span>
                                    {#if !readonly}
                                        <button
                                            type="button"
                                            class="evolution-state-icon-action icon-btn icon-btn--sm"
                                            aria-label={`Remove ${section.label} item ${index + 1}`}
                                            title={`Remove ${section.label} item ${index + 1}`}
                                            onclick={() => removeListItem(section.key as keyof CharacterEvolutionState, index)}
                                        >
                                            <TrashIcon size={16}/>
                                        </button>
                                    {/if}
                                </div>
                                <div class="evolution-state-fields">
                                    <TextInput value={item.value} disabled={readonly} placeholder="Value" oninput={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, index, "value", event.currentTarget.value)} />
                                    <div class="evolution-state-select-row">
                                        <SelectInput value={item.confidence ?? "suspected"} disabled={readonly} onchange={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, index, "confidence", event.currentTarget.value)}>
                                            <OptionInput value="suspected">suspected</OptionInput>
                                            <OptionInput value="likely">likely</OptionInput>
                                            <OptionInput value="confirmed">confirmed</OptionInput>
                                        </SelectInput>
                                        <SelectInput value={item.status ?? "active"} disabled={readonly} onchange={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, index, "status", event.currentTarget.value)}>
                                            <OptionInput value="active">active</OptionInput>
                                            <OptionInput value="archived">archived</OptionInput>
                                            <OptionInput value="corrected">corrected</OptionInput>
                                        </SelectInput>
                                    </div>
                                    <TextAreaInput value={item.note ?? ""} disabled={readonly} height="20" placeholder="Note" onValueChange={(next) => updateFactItemField(section.key as keyof CharacterEvolutionState, index, "note", next)} />
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

    .evolution-state-inline-row {
        align-items: flex-start;
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
