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
        sourceLabel?: string;
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
        sourceLabel = "Review the next state before accepting it into this character.",
    }: Props = $props();
</script>

<section class="evolution-review-workspace">
    <header class="evolution-review-header">
        <div class="evolution-review-header-copy">
            <span class="evolution-review-kicker">Character Evolution Review</span>
            <h2 class="evolution-review-title">Compare current state to proposed state</h2>
            <p class="evolution-review-note">{sourceLabel}</p>
        </div>
        <div class="evolution-review-actions">
            <Button styled="outlined" onclick={onClose}>Back To Chat</Button>
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
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-3);
        padding: var(--ds-space-4);
        border-bottom: 1px solid var(--ds-border-subtle);
        background: var(--ds-surface-1);
    }

    .evolution-review-header-copy {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        min-width: 0;
    }

    .evolution-review-kicker {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
        font-weight: var(--ds-font-weight-medium);
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .evolution-review-title {
        margin: 0;
        color: var(--ds-text-primary);
        font-size: clamp(1.375rem, 1.05rem + 1vw, 2rem);
        font-weight: var(--ds-font-weight-semibold);
        line-height: 1.1;
    }

    .evolution-review-note {
        margin: 0;
        max-width: 52rem;
        color: var(--ds-text-secondary);
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
            flex-direction: column;
        }

        .evolution-review-actions {
            width: 100%;
        }
    }
</style>
