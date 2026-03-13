<script lang="ts">
    import ReviewWorkspace from "../Evolution/ReviewWorkspace.svelte";
    import type {
        CharacterEvolutionPendingProposal,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";

    type EvolutionSettings = {
        pendingProposal?: CharacterEvolutionPendingProposal;
        currentState?: CharacterEvolutionState;
        sectionConfigs?: CharacterEvolutionSectionConfig[];
        privacy?: CharacterEvolutionPrivacySettings;
    } | null;

    interface Props {
        evolutionSettings?: EvolutionSettings;
        evolutionProposalDraft?: CharacterEvolutionState;
        evolutionBusy?: boolean;
        onAccept?: () => void;
        onAcceptAndCreate?: () => void;
        onReject?: () => void;
        onClose?: () => void;
    }

    let {
        evolutionSettings = null,
        evolutionProposalDraft = $bindable(null),
        evolutionBusy = false,
        onAccept = () => {},
        onAcceptAndCreate = () => {},
        onReject = () => {},
        onClose = () => {},
    }: Props = $props();
</script>

{#if evolutionSettings?.pendingProposal}
    <div class="ds-chat-review-mode">
        <ReviewWorkspace
            proposal={evolutionSettings.pendingProposal}
            currentState={evolutionSettings.currentState}
            sectionConfigs={evolutionSettings.sectionConfigs}
            privacy={evolutionSettings.privacy}
            bind:bindState={evolutionProposalDraft}
            loading={evolutionBusy}
            {onAccept}
            onAcceptAndCreate={onAcceptAndCreate}
            {onReject}
            {onClose}
        />
    </div>
{/if}

<style>
    .ds-chat-review-mode {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        width: 100%;
        background: var(--ds-surface-1);
    }
</style>
