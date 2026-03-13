<script lang="ts">
    import StateEditor from "src/lib/Evolution/StateEditor.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import type {
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types"

    interface Props {
        hasPendingProposal: boolean
        currentStateDraft?: CharacterEvolutionState | null
        sectionConfigs: CharacterEvolutionSectionConfig[]
        privacy: CharacterEvolutionPrivacySettings
        onPersist: () => void | Promise<void>
    }

    let {
        hasPendingProposal,
        currentStateDraft = $bindable(),
        sectionConfigs,
        privacy,
        onPersist,
    }: Props = $props()
</script>

<div
    role="tabpanel"
    id="evolution-panel-state"
    aria-labelledby="evolution-subtab-3"
    tabindex="0"
>
    {#if hasPendingProposal}
        <div class="ds-settings-section">
            <div class="ds-settings-card ds-settings-card-stack-start">
                <span class="ds-settings-label">Current State</span>
                <span class="ds-settings-label-muted-sm">
                    Resolve the pending proposal before editing the accepted state directly.
                </span>
            </div>
        </div>
    {:else if currentStateDraft}
        <StateEditor
            bind:value={currentStateDraft}
            {sectionConfigs}
            {privacy}
            title="Current State"
            itemFilter="active-only"
        />
        <div class="ds-settings-section">
            <div class="ds-settings-inline-actions action-rail">
                <Button styled="outlined" onclick={onPersist}>
                    Save Current State
                </Button>
            </div>
        </div>
    {/if}
</div>
