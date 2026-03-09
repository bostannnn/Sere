<script lang="ts">
    import type {
        CharacterEvolutionPendingProposal,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
    } from "src/ts/storage/database.types";
    import Button from "../UI/GUI/Button.svelte";
    import StateEditor from "./StateEditor.svelte";

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
</script>

{#if proposal}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Pending Evolution Proposal</span>
        <div class="ds-settings-list-shell">
            {#if proposal.changes.length === 0}
                <span class="ds-settings-label-muted-sm">No summarized changes. You can still inspect and edit the proposed state.</span>
            {/if}
            {#each proposal.changes as change, index (index)}
                <div class="ds-settings-card ds-settings-card-stack-start">
                    <span class="ds-settings-label">{change.sectionKey}</span>
                    <span class="ds-settings-label-muted-sm">{change.summary}</span>
                    {#if change.evidence.length > 0}
                        {#each change.evidence as evidence (evidence)}
                            <span class="ds-settings-label-muted-sm">Evidence: {evidence}</span>
                        {/each}
                    {/if}
                </div>
            {/each}
        </div>
    </div>

    <StateEditor value={currentState} {sectionConfigs} {privacy} readonly={true} title="Current State" />
    <StateEditor bind:value={bindState} {sectionConfigs} {privacy} title="Proposed State" />

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
