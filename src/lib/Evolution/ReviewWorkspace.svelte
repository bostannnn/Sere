<script lang="ts">
    import type {
        CharacterEvolutionPendingProposal,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import Button from "../UI/GUI/Button.svelte";
    import ProposalPanel from "./ProposalPanel.svelte";

    interface Props {
        proposal: CharacterEvolutionPendingProposal;
        currentState: CharacterEvolutionState;
        sectionConfigs: CharacterEvolutionSectionConfig[];
        privacy?: CharacterEvolutionPrivacySettings;
        bindState?: CharacterEvolutionState;
        onAccept?: () => void;
        onAcceptAndCreate?: () => void;
        onReject?: () => void;
        onClose?: () => void;
        loading?: boolean;
    }

    let {
        proposal,
        currentState,
        sectionConfigs = [],
        privacy = {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        },
        bindState = $bindable(),
        onAccept = () => {},
        onAcceptAndCreate = () => {},
        onReject = () => {},
        onClose = () => {},
        loading = false,
    }: Props = $props();
</script>

<section class="evolution-review-workspace">
    <header class="evolution-review-header">
        <div class="evolution-review-header-copy">
            <h2 class="evolution-review-title">Evolution Review</h2>
        </div>
        <div class="evolution-review-actions">
            <Button size="sm" styled="outlined" onclick={onClose}>Back To Chat</Button>
        </div>
    </header>

    <div class="evolution-review-body">
        <ProposalPanel
            {proposal}
            {currentState}
            {sectionConfigs}
            {privacy}
            bind:bindState
            {onAccept}
            {onAcceptAndCreate}
            {onReject}
            {loading}
        />
    </div>
</section>

<style>
    .evolution-review-workspace {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        flex-direction: column;
        background: var(--ds-surface-1);
    }

    .evolution-review-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        padding: var(--ds-space-3) var(--ds-space-4);
        border-bottom: 1px solid var(--ds-border-subtle);
        background: var(--ds-surface-1);
    }

    .evolution-review-header-copy {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .evolution-review-title {
        margin: 0;
        color: var(--ds-text-primary);
        font-size: clamp(1.25rem, 1.02rem + 0.7vw, 1.75rem);
        font-weight: var(--ds-font-weight-semibold);
        line-height: 1.1;
    }

    .evolution-review-actions {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        flex: 0 0 auto;
    }

    .evolution-review-body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: var(--ds-space-4);
    }

    @media (max-width: 720px) {
        .evolution-review-header {
            align-items: flex-start;
            flex-direction: column;
        }

        .evolution-review-actions {
            width: 100%;
        }
    }
</style>
