<script lang="ts">
    import type {
        CharacterEvolutionPendingProposal,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionSectionKey,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import Button from "../UI/GUI/Button.svelte";
    import ProposalSectionCompare from "./ProposalSectionCompare.svelte";

    interface Props {
        proposal: CharacterEvolutionPendingProposal | null;
        currentState: CharacterEvolutionState;
        sectionConfigs: CharacterEvolutionSectionConfig[];
        privacy?: CharacterEvolutionPrivacySettings;
        bindState?: CharacterEvolutionState;
        onAccept?: () => void;
        onAcceptAndCreate?: () => void;
        onReject?: () => void;
        loading?: boolean;
        showCreateButton?: boolean;
    }

    let {
        proposal = null,
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
        loading = false,
        showCreateButton = true,
    }: Props = $props();

    $effect(() => {
        if (proposal && (!bindState || JSON.stringify(bindState) === "{}")) {
            bindState = JSON.parse(JSON.stringify(proposal.proposedState));
        }
    });

    function canRenderSection(key: string) {
        if (key === "characterIntimatePreferences" && !privacy.allowCharacterIntimatePreferences) {
            return false;
        }
        if (key === "userIntimatePreferences" && !privacy.allowUserIntimatePreferences) {
            return false;
        }
        return true;
    }

    function sectionValue(state: CharacterEvolutionState, key: CharacterEvolutionSectionKey) {
        return state[key];
    }

    function changedSectionKeys() {
        if (!proposal) {
            return [];
        }

        const fromSummary = proposal.changes.map((change) => change.sectionKey);
        const fromDiff = sectionConfigs
            .filter((section) => section.enabled && canRenderSection(section.key))
            .filter((section) => JSON.stringify(sectionValue(currentState, section.key)) !== JSON.stringify(sectionValue(effectiveBindState, section.key)))
            .map((section) => section.key);

        return [...new Set([...fromSummary, ...fromDiff])];
    }

    function compareSections() {
        const changedKeys = new Set(changedSectionKeys());
        return sectionConfigs.filter((section) => section.enabled && canRenderSection(section.key) && changedKeys.has(section.key));
    }

    function changeForSection(key: CharacterEvolutionSectionKey) {
        return proposal?.changes.find((change) => change.sectionKey === key) ?? null;
    }

    const effectiveBindState = $derived(bindState ?? proposal?.proposedState ?? currentState);
    const visibleCompareSections = $derived(compareSections());
</script>

{#if proposal}
    <div class="ds-settings-section proposal-panel">
        <div class="proposal-panel-header">
            <div class="proposal-panel-header-copy">
                <span class="ds-settings-label">Pending Evolution Proposal</span>
                <span class="ds-settings-label-muted-sm">
                    Each section is broken into concrete edits. Left shows what exists now, right shows what will be saved, and badges mark added, changed, or removed rows.
                </span>
            </div>
            <div class="proposal-panel-meta">
                <span class="proposal-panel-meta-value">{visibleCompareSections.length}</span>
                <span class="ds-settings-label-muted-sm">sections with edits</span>
            </div>
        </div>

        {#if !bindState}
            <div class="proposal-panel-empty">
                <span class="ds-settings-label-muted-sm">Preparing review…</span>
            </div>
        {:else if visibleCompareSections.length === 0}
            <div class="proposal-panel-empty">
                <span class="ds-settings-label-muted-sm">No section-level differences detected between the current and proposed state.</span>
            </div>
        {:else}
            <div class="proposal-panel-sections">
                {#each visibleCompareSections as section (section.key)}
                    <ProposalSectionCompare
                        {section}
                        {currentState}
                        bind:proposedState={bindState}
                        change={changeForSection(section.key)}
                        {privacy}
                    />
                {/each}
            </div>
        {/if}
    </div>

    <div class="ds-settings-section">
        <div class="ds-settings-inline-actions action-rail">
            <Button styled="danger" onclick={onReject} disabled={loading}>Reject</Button>
            <Button styled="outlined" onclick={onAccept} disabled={loading}>Accept</Button>
            {#if showCreateButton}
                <Button onclick={onAcceptAndCreate} disabled={loading}>Accept And Create New Chat</Button>
            {/if}
        </div>
    </div>
{/if}

<style>
    .proposal-panel {
        gap: var(--ds-space-3);
    }

    .proposal-panel-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-3);
        flex-wrap: wrap;
    }

    .proposal-panel-header-copy {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-width: 42rem;
    }

    .proposal-panel-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
        flex: 0 0 auto;
    }

    .proposal-panel-meta-value {
        color: var(--ds-text-primary);
        font-size: clamp(1.5rem, 1.1rem + 1vw, 2rem);
        font-weight: var(--ds-font-weight-semibold);
        line-height: 1;
    }

    .proposal-panel-sections {
        display: flex;
        flex-direction: column;
    }

    .proposal-panel-sections :global(.proposal-section-compare + .proposal-section-compare) {
        border-top: 1px solid var(--ds-border-subtle);
    }

    .proposal-panel-empty {
        padding: var(--ds-space-3) 0;
        border-top: 1px solid var(--ds-border-subtle);
    }

    @media (max-width: 640px) {
        .proposal-panel-meta {
            align-items: flex-start;
        }
    }
</style>
