<script lang="ts">
    import type {
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionProcessedRange,
        CharacterEvolutionSectionConfig,
        CharacterEvolutionState,
        CharacterEvolutionVersionMeta,
        character,
    } from "src/ts/storage/database.types"
    import EvolutionHistoryPanel from "./EvolutionHistoryPanel.svelte"
    import EvolutionReviewPanel from "./EvolutionReviewPanel.svelte"
    import EvolutionSectionsPanel from "./EvolutionSectionsPanel.svelte"
    import EvolutionSetupPanel from "./EvolutionSetupPanel.svelte"
    import EvolutionStatePanel from "./EvolutionStatePanel.svelte"
    import EvolutionWorkspaceTabs from "./EvolutionWorkspaceTabs.svelte"
    import {
        EVOLUTION_HISTORY_TAB,
        EVOLUTION_REVIEW_TAB,
        EVOLUTION_SECTIONS_TAB,
        EVOLUTION_SETUP_TAB,
        EVOLUTION_STATE_TAB,
        type EvolutionWorkspaceTabId,
    } from "./evolutionSettingsTabs"

    interface Props {
        hasGroupSelection: boolean
        currentCharacter: character | null
        evolutionSettings: character["characterEvolution"] | null
        selectedWorkspaceTab: EvolutionWorkspaceTabId
        onSelectWorkspaceTab: (tab: EvolutionWorkspaceTabId) => void
        displayedProcessedRanges: CharacterEvolutionProcessedRange[]
        usingGlobalDefaults: boolean
        effectiveProvider: string
        effectiveModel: string
        hasTemplateSlot: boolean
        activeChatId: string | null
        activeChatMessageCount: number
        revealCharacterOverrides: boolean
        onToggleRevealCharacterOverrides: () => void
        onOpenGlobalDefaults: () => void
        manualRangeAvailable: boolean
        manualRangeBlockedReason: string
        runningManualRangeHandoff: boolean
        onRunManualRange: (startMessageNumber: number, endMessageNumber: number) => void | Promise<void>
        replayCurrentChatAvailable: boolean
        replayingAcceptedChat: boolean
        onReplayCurrentChat: () => void | Promise<void>
        sectionConfigDraft: CharacterEvolutionSectionConfig[]
        privacyDraft: CharacterEvolutionPrivacySettings
        onUseGlobalDefaultsChange: (nextValue: boolean) => void
        currentPendingProposal: character["characterEvolution"]["pendingProposal"] | null
        reviewActionBusy: boolean
        onOpenFullscreenReview: () => void
        onRejectProposal: () => void | Promise<void>
        currentStateDraft: CharacterEvolutionState | null
        onPersist: () => void | Promise<void>
        displayedStateVersions: CharacterEvolutionVersionMeta[]
        loadingVersions: boolean
        selectedVersion: number | null
        selectedVersionState: CharacterEvolutionState | null
        selectedVersionSectionConfigs: CharacterEvolutionSectionConfig[]
        selectedVersionPrivacy: CharacterEvolutionPrivacySettings
        onRefreshVersions: () => void | Promise<void>
        onLoadVersion: (version: number) => void | Promise<void>
    }

    let {
        hasGroupSelection,
        currentCharacter,
        evolutionSettings,
        selectedWorkspaceTab,
        onSelectWorkspaceTab,
        displayedProcessedRanges,
        usingGlobalDefaults,
        effectiveProvider,
        effectiveModel,
        hasTemplateSlot,
        activeChatId,
        activeChatMessageCount,
        revealCharacterOverrides,
        onToggleRevealCharacterOverrides,
        onOpenGlobalDefaults,
        manualRangeAvailable,
        manualRangeBlockedReason,
        runningManualRangeHandoff,
        onRunManualRange,
        replayCurrentChatAvailable,
        replayingAcceptedChat,
        onReplayCurrentChat,
        sectionConfigDraft = $bindable(),
        privacyDraft = $bindable(),
        onUseGlobalDefaultsChange,
        currentPendingProposal,
        reviewActionBusy,
        onOpenFullscreenReview,
        onRejectProposal,
        currentStateDraft = $bindable(),
        onPersist,
        displayedStateVersions,
        loadingVersions,
        selectedVersion,
        selectedVersionState,
        selectedVersionSectionConfigs,
        selectedVersionPrivacy,
        onRefreshVersions,
        onLoadVersion,
    }: Props = $props()
</script>

{#if hasGroupSelection}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Character evolution is not available for group chats.</span>
    </div>
{:else if !currentCharacter}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Select a single character to configure evolution.</span>
    </div>
{:else if evolutionSettings && currentCharacter.characterEvolution}
    <div class="ds-settings-page evolution-settings-page">
        <div class="ds-settings-section">
            <EvolutionWorkspaceTabs
                {selectedWorkspaceTab}
                onSelect={onSelectWorkspaceTab}
            />
        </div>

        {#if selectedWorkspaceTab === EVOLUTION_SETUP_TAB}
            <div
                class="ds-settings-section"
                role="tabpanel"
                id="evolution-panel-setup"
                aria-labelledby="evolution-subtab-0"
                tabindex="0"
            >
                <EvolutionSetupPanel
                    characterEntry={currentCharacter}
                    {evolutionSettings}
                    processedRanges={displayedProcessedRanges}
                    {usingGlobalDefaults}
                    {effectiveProvider}
                    {effectiveModel}
                    {hasTemplateSlot}
                    {activeChatId}
                    {activeChatMessageCount}
                    {revealCharacterOverrides}
                    {onToggleRevealCharacterOverrides}
                    {onOpenGlobalDefaults}
                    {manualRangeAvailable}
                    manualRangeBlockedReason={manualRangeBlockedReason}
                    manualRangeBusy={runningManualRangeHandoff}
                    onRunManualRange={onRunManualRange}
                    {replayCurrentChatAvailable}
                    replayCurrentChatBusy={replayingAcceptedChat}
                    onReplayCurrentChat={onReplayCurrentChat}
                />
            </div>
        {:else if selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
            <EvolutionSectionsPanel
                {usingGlobalDefaults}
                bind:sectionConfigDraft
                bind:privacyDraft
                onUseGlobalDefaultsChange={onUseGlobalDefaultsChange}
                onOpenGlobalDefaults={onOpenGlobalDefaults}
            />
        {:else if selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
            <EvolutionReviewPanel
                {currentPendingProposal}
                {reviewActionBusy}
                onOpenFullscreenReview={onOpenFullscreenReview}
                onRejectProposal={onRejectProposal}
            />
        {:else if selectedWorkspaceTab === EVOLUTION_STATE_TAB}
            <EvolutionStatePanel
                hasPendingProposal={Boolean(currentPendingProposal)}
                bind:currentStateDraft
                sectionConfigs={evolutionSettings.sectionConfigs}
                privacy={evolutionSettings.privacy}
                onPersist={onPersist}
            />
        {:else}
            <EvolutionHistoryPanel
                stateVersions={displayedStateVersions}
                {loadingVersions}
                {selectedVersion}
                {selectedVersionState}
                {selectedVersionSectionConfigs}
                {selectedVersionPrivacy}
                onRefresh={onRefreshVersions}
                onLoadVersion={onLoadVersion}
            />
        {/if}
    </div>
{/if}

<style>
    .evolution-settings-page {
        gap: var(--ds-settings-section-gap);
    }
</style>
