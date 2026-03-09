<script lang="ts">
    import type { CharacterEvolutionPrivacySettings, CharacterEvolutionSectionConfig } from "src/ts/storage/database.types";
    import CheckInput from "../UI/GUI/CheckInput.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";

    interface Props {
        value: CharacterEvolutionSectionConfig[];
        privacy?: CharacterEvolutionPrivacySettings;
        readonly?: boolean;
        title?: string;
    }

    let {
        value = $bindable([]),
        privacy = {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        },
        readonly = false,
        title = "Tracked Sections",
    }: Props = $props();

    function sectionHelp(key: string) {
        if (key === "characterIntimatePreferences") {
            return privacy.allowCharacterIntimatePreferences
                ? ""
                : "Disabled by privacy settings.";
        }
        if (key === "userIntimatePreferences") {
            return privacy.allowUserIntimatePreferences
                ? ""
                : "Disabled by privacy settings.";
        }
        return "";
    }
</script>

<div class="ds-settings-section">
    <span class="ds-settings-label">{title}</span>
    <div class="ds-settings-card ds-settings-list-shell">
        {#each value as section, index (section.key)}
            <div class="ds-settings-card ds-settings-card-stack-start">
                <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between">
                    <span class="ds-settings-label">{section.key}</span>
                    {#if sectionHelp(section.key)}
                        <span class="ds-settings-label-muted-sm">{sectionHelp(section.key)}</span>
                    {/if}
                </div>
                <TextInput bind:value={value[index].label} disabled={readonly} />
                <div class="ds-settings-grid-two">
                    <CheckInput bind:check={value[index].enabled} disabled={readonly} name="Enabled" />
                    <CheckInput bind:check={value[index].includeInPrompt} disabled={readonly} name="Use In RP Prompt" />
                </div>
                <CheckInput bind:check={value[index].sensitive} disabled={readonly} name="Sensitive" />
                <TextAreaInput bind:value={value[index].instruction} disabled={readonly} height="24" />
            </div>
        {/each}
    </div>
</div>
