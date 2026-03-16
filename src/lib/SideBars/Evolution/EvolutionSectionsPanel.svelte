<script lang="ts">
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import type {
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
    } from "src/ts/storage/database.types"

    interface Props {
        sectionConfigDraft?: CharacterEvolutionSectionConfig[]
        privacyDraft?: CharacterEvolutionPrivacySettings
        onOpenGlobalDefaults: () => void
    }

    let {
        sectionConfigDraft = $bindable(),
        privacyDraft = $bindable(),
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
            <span class="ds-settings-label-muted-sm">
                Sections and privacy are managed globally.
            </span>
            <div class="ds-settings-inline-actions action-rail">
                <Button styled="outlined" size="sm" onclick={onOpenGlobalDefaults}>
                    Open Global Defaults
                </Button>
            </div>
        </div>
    </div>

    <div class="ds-settings-section">
        <div class="ds-settings-card ds-settings-card-stack-start">
            <span class="ds-settings-label">Privacy</span>
            <div class="ds-settings-grid-two">
                <span class="ds-settings-label-muted-sm">
                    Character intimate preferences: {privacyDraft.allowCharacterIntimatePreferences ? "Allowed" : "Blocked"}
                </span>
                <span class="ds-settings-label-muted-sm">
                    User intimate preferences: {privacyDraft.allowUserIntimatePreferences ? "Allowed" : "Blocked"}
                </span>
            </div>
        </div>
    </div>

    <SectionConfigEditor
        bind:value={sectionConfigDraft}
        privacy={privacyDraft}
        readonly={true}
        title="Global Sections"
    />
</div>
