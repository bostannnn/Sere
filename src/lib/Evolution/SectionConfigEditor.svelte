<script lang="ts">
    import type { CharacterEvolutionPrivacySettings, CharacterEvolutionSectionConfig } from "src/ts/storage/database.types";
    import { BUILTIN_SECTION_DEFS } from "src/ts/character-evolution/constants";
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

    const builtinInstructionByKey = Object.fromEntries(
        BUILTIN_SECTION_DEFS.map((s) => [s.key, s.instruction])
    );

    let expandedDefaults: Record<string, boolean> = $state({});

    function toggleDefaultPreview(key: string) {
        expandedDefaults = { ...expandedDefaults, [key]: !expandedDefaults[key] };
    }

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
    <div class="evolution-section-editor-header">
        <div class="evolution-section-editor-header-copy">
            <span class="ds-settings-label">{title}</span>
            <span class="ds-settings-label-muted-sm">
                {readonly
                    ? "Built-in v1 sections for extracted character state. Inherited from global defaults."
                    : "Built-in v1 sections for extracted character state."}
            </span>
        </div>
    </div>
    <div class="ds-settings-list-container evolution-section-editor-list">
        {#each value as section, index (section.key)}
            <section class="evolution-section-editor-item">
                <div class="evolution-section-editor-item-head">
                    <div class="evolution-section-editor-item-meta">
                        <span class="evolution-section-editor-key">{section.label || section.key}</span>
                        <span class="ds-settings-label-muted-sm evolution-section-editor-id">{section.key}</span>
                    </div>
                    {#if sectionHelp(section.key)}
                        <span class="ds-settings-label-muted-sm evolution-section-editor-help">{sectionHelp(section.key)}</span>
                    {/if}
                </div>
                <div class="ds-settings-section evolution-section-editor-body">
                    <TextInput bind:value={value[index].label} disabled={readonly} placeholder="Display label" />
                    <div class="evolution-section-editor-toggles">
                        <CheckInput bare={true} className="evolution-section-editor-toggle" bind:check={value[index].enabled} disabled={readonly} name="Enabled" />
                        <CheckInput bare={true} className="evolution-section-editor-toggle" bind:check={value[index].includeInPrompt} disabled={readonly} name="Use In RP Prompt" />
                        <CheckInput bare={true} className="evolution-section-editor-toggle" bind:check={value[index].sensitive} disabled={readonly} name="Sensitive" />
                    </div>
                    <TextAreaInput bind:value={value[index].instruction} disabled={readonly} height="24" placeholder="Leave empty to use built-in default" />
                    {#if !value[index].instruction && builtinInstructionByKey[section.key]}
                        <button class="evolution-section-toggle-link" onclick={() => toggleDefaultPreview(section.key)}>
                            {expandedDefaults[section.key] ? "Hide default" : "Show default"}
                        </button>
                        {#if expandedDefaults[section.key]}
                            <span class="evolution-section-default-preview">{builtinInstructionByKey[section.key]}</span>
                        {/if}
                    {/if}
                </div>
            </section>
        {/each}
    </div>
</div>

<style>
    .evolution-section-editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    .evolution-section-editor-header-copy {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .evolution-section-editor-list {
        width: 100%;
        border: 0;
        border-radius: 0;
        background: transparent;
    }

    .evolution-section-editor-item {
        padding: var(--ds-space-2) 0;
    }

    .evolution-section-editor-item + .evolution-section-editor-item {
        border-top: 1px solid var(--ds-border-subtle);
    }

    .evolution-section-editor-item-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-3);
    }

    .evolution-section-editor-item-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .evolution-section-editor-key {
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-md);
        font-weight: var(--ds-font-weight-medium);
    }

    .evolution-section-editor-id {
        text-transform: none;
    }

    .evolution-section-editor-help {
        max-width: 22rem;
        text-align: right;
    }

    .evolution-section-editor-body {
        margin-top: var(--ds-space-3);
    }

    .evolution-section-editor-toggles {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
    }

    :global(.evolution-section-editor-toggle) {
        justify-content: flex-start;
    }

    .evolution-section-toggle-link {
        all: unset;
        cursor: pointer;
        color: var(--ds-text-link, var(--ds-text-secondary));
        font-size: var(--ds-font-size-sm);
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .evolution-section-toggle-link:hover {
        color: var(--ds-text-primary);
    }

    .evolution-section-default-preview {
        display: block;
        padding: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm, 4px);
        background: var(--ds-surface-secondary, rgba(0,0,0,0.05));
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        line-height: 1.5;
    }

    @media (max-width: 640px) {
        .evolution-section-editor-item-head {
            flex-direction: column;
            align-items: flex-start;
        }

        .evolution-section-editor-help {
            max-width: none;
            text-align: left;
        }

        .evolution-section-editor-toggles {
            flex-direction: column;
        }
    }
</style>
