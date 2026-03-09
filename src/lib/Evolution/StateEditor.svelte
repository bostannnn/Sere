<script lang="ts">
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import type {
        CharacterEvolutionItem,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import Button from "../UI/GUI/Button.svelte";
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

<div class="ds-settings-section">
    <span class="ds-settings-label">{title}</span>
    <div class="ds-settings-card ds-settings-list-shell">
        {#each sectionConfigs as section (section.key)}
            {#if section.enabled && canRenderSection(section.key)}
                <div class="ds-settings-card ds-settings-card-stack-start">
                    <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between">
                        <span class="ds-settings-label">{section.label}</span>
                        {#if !readonly}
                            {#if !isObjectSection(section.key)}
                                <Button size="sm" styled="outlined" onclick={() => {
                                    if (isStringListSection(section.key)) {
                                        addStringItem(section.key as keyof CharacterEvolutionState)
                                        return
                                    }
                                    addFactItem(section.key as keyof CharacterEvolutionState)
                                }}>
                                    <PlusIcon size={16}/>
                                </Button>
                            {/if}
                        {/if}
                    </div>

                    {#if section.key === "relationship"}
                        <TextInput value={value.relationship.trustLevel} disabled={readonly} placeholder="Trust level" oninput={(event) => updateRelationship("trustLevel", event.currentTarget.value)} />
                        <TextAreaInput value={value.relationship.dynamic} disabled={readonly} height="20" placeholder="Dynamic" onValueChange={(next) => updateRelationship("dynamic", next)} />
                    {:else if section.key === "lastChatEnded"}
                        <TextAreaInput value={value.lastChatEnded.state} disabled={readonly} height="20" placeholder="State" onValueChange={(next) => updateLastChatEnded("state", next)} />
                        <TextAreaInput value={value.lastChatEnded.residue} disabled={readonly} height="20" placeholder="Residue" onValueChange={(next) => updateLastChatEnded("residue", next)} />
                    {:else if isStringListSection(section.key)}
                        {#if stringItemsForSection(section.key as keyof CharacterEvolutionState).length === 0}
                            <span class="ds-settings-label-muted-sm">No items</span>
                        {/if}
                        {#each stringItemsForSection(section.key as keyof CharacterEvolutionState) as item, index (index)}
                            <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-nowrap">
                                <TextAreaInput value={item} disabled={readonly} height="20" onValueChange={(next) => updateStringItem(section.key as keyof CharacterEvolutionState, index, next)} />
                                {#if !readonly}
                                    <Button size="sm" styled="outlined" onclick={() => removeListItem(section.key as keyof CharacterEvolutionState, index)}>
                                        <TrashIcon size={16}/>
                                    </Button>
                                {/if}
                            </div>
                        {/each}
                    {:else}
                        {#if factItemsForSection(section.key as keyof CharacterEvolutionState).length === 0}
                            <span class="ds-settings-label-muted-sm">No items</span>
                        {/if}
                        {#each factItemsForSection(section.key as keyof CharacterEvolutionState) as item, index (index)}
                            <div class="ds-settings-card ds-settings-card-stack-start">
                                <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between">
                                    <span class="ds-settings-label-muted-sm">Item {index + 1}</span>
                                    {#if !readonly}
                                        <Button size="sm" styled="outlined" onclick={() => removeListItem(section.key as keyof CharacterEvolutionState, index)}>
                                            <TrashIcon size={16}/>
                                        </Button>
                                    {/if}
                                </div>
                                <TextInput value={item.value} disabled={readonly} placeholder="Value" oninput={(event) => updateFactItemField(section.key as keyof CharacterEvolutionState, index, "value", event.currentTarget.value)} />
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
                                <TextAreaInput value={item.note ?? ""} disabled={readonly} height="20" placeholder="Note" onValueChange={(next) => updateFactItemField(section.key as keyof CharacterEvolutionState, index, "note", next)} />
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        {/each}
    </div>
</div>
