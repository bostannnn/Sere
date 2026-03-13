<script lang="ts">
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import type {
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
    } from "src/ts/storage/database.types"

    interface Props {
        usingGlobalDefaults: boolean
        sectionConfigDraft?: CharacterEvolutionSectionConfig[]
        privacyDraft?: CharacterEvolutionPrivacySettings
        onUseGlobalDefaultsChange: (nextValue: boolean) => void
        onOpenGlobalDefaults: () => void
    }

    let {
        usingGlobalDefaults,
        sectionConfigDraft = $bindable(),
        privacyDraft = $bindable(),
        onUseGlobalDefaultsChange,
        onOpenGlobalDefaults,
    }: Props = $props()
</script>

<div
    role="tabpanel"
    id="evolution-panel-sections"
    aria-labelledby="evolution-subtab-1"
    tabindex="0"
>
    <div class="ds-settings-section">
        <div class="ds-settings-card ds-settings-card-stack-start">
            <CheckInput
                bare={true}
                className="evolution-sections-toggle"
                check={usingGlobalDefaults}
                onChange={onUseGlobalDefaultsChange}
                name="Use Global Defaults For Sections And Privacy"
            />
            <span class="ds-settings-label-muted-sm">
                {usingGlobalDefaults
                    ? "Sections and privacy are inherited from global evolution defaults."
                    : "These section and privacy settings are specific to this character."}
            </span>
            <div class="ds-settings-inline-actions action-rail">
                <Button styled="outlined" size="sm" onclick={onOpenGlobalDefaults}>
                    Open Global Defaults
                </Button>
            </div>
        </div>
    </div>

    {#if !usingGlobalDefaults}
        <div class="ds-settings-section">
            <div class="ds-settings-card ds-settings-card-stack-start">
                <span class="ds-settings-label">Privacy</span>
                <div class="ds-settings-grid-two">
                    <CheckInput
                        bind:check={privacyDraft.allowCharacterIntimatePreferences}
                        name="Allow Character Intimate Preferences"
                    />
                    <CheckInput
                        bind:check={privacyDraft.allowUserIntimatePreferences}
                        name="Allow User Intimate Preferences"
                    />
                </div>
            </div>
        </div>
    {/if}

    <SectionConfigEditor
        bind:value={sectionConfigDraft}
        privacy={privacyDraft}
        readonly={usingGlobalDefaults}
        title={usingGlobalDefaults ? "Global Sections" : "Character Section Overrides"}
    />
</div>
