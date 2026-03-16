<script lang="ts">
    import { ensureCharacterEvolution, getEffectiveCharacterEvolutionSettings, getNextUnprocessedMessageIndexForChat, hasCharacterStateTemplateBlock } from "src/ts/characterEvolution"
    import { DBState, evolutionReviewOpenRequest, selectedCharID } from "src/ts/stores.svelte"
    import type { CharacterEvolutionPrivacySettings, CharacterEvolutionSectionConfig, CharacterEvolutionState, CharacterEvolutionVersionFile, CharacterEvolutionVersionMeta, character } from "src/ts/storage/database.types"
    import EvolutionWorkspaceContent from "./EvolutionWorkspaceContent.svelte"
    import { hasAcceptedEvolutionForChat } from "src/ts/character-evolution/reviewFlow"
    import { findSingleCharacterById } from "src/ts/storage/characterList"
    import {
        openEvolutionGlobalDefaults,
        persistEvolutionCharacter,
    } from "./evolutionSettings.actions"
    import { createEvolutionSettingsOperations } from "./evolutionSettings.operations"
    import { EVOLUTION_REVIEW_TAB, EVOLUTION_SETUP_TAB, type EvolutionWorkspaceTabId } from "./evolutionSettingsTabs"
    import { createCurrentStateDraft, createSectionDraftSnapshot, getCurrentStateDraftHydrationKey, getSectionDraftHydrationKey } from "./evolutionSettings.drafts"
    import { commitEvolutionCharacter, syncEvolutionCharacterDrafts } from "./evolutionSettings.character"
    import { deriveMergedProcessedRanges, deriveSelectedVersionPrivacy, deriveSelectedVersionSectionConfigs, isSingleCharacter, mergeEvolutionVersionMetas } from "./evolutionSettings.helpers"

    let loadingVersions = $state(false)
    let reviewActionBusy = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionFile = $state<CharacterEvolutionVersionFile | null>(null)
    let refreshedVersionMetas = $state<CharacterEvolutionVersionMeta[]>([])
    let activeProposalId = $state<string | null>(null)
    let versionCharacterId = $state<string | null>(null)
    let selectedWorkspaceTab = $state<EvolutionWorkspaceTabId>(EVOLUTION_SETUP_TAB)
    let sectionConfigDraft = $state<CharacterEvolutionSectionConfig[]>([])
    let privacyDraft = $state<CharacterEvolutionPrivacySettings>({
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
    })
    let sectionDraftKey = $state<string | null>(null)
    let currentStateDraft = $state<CharacterEvolutionState | null>(null)
    let currentStateDraftKey = $state<string | null>(null)
    let replayingAcceptedChat = $state(false)
    let runningManualRangeHandoff = $state(false)
    let autoProcessing = $state(false)
    let autoProcessCancelled = $state(false)
    let autoProcessedBatches = $state(0)
    let autoProcessTotalBatches = $state(0)

    const selectedEntry = $derived.by(() => {
        const selectedIndex = Number($selectedCharID)
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
            return null
        }

        const characters = Array.isArray(DBState.db.characters) ? DBState.db.characters : []
        return characters[selectedIndex] ?? null
    })

    const currentCharacter = $derived.by(() => {
        return isSingleCharacter(selectedEntry) ? selectedEntry : null
    })

    const hasGroupSelection = $derived(selectedEntry?.type === "group")

    const evolutionSettings = $derived.by(() => {
        const characterEntry = currentCharacter
        if (!characterEntry) {
            return null
        }

        return getEffectiveCharacterEvolutionSettings(DBState.db, characterEntry)
    })
    const displayedStateVersions = $derived.by(() => mergeEvolutionVersionMetas(
        currentCharacter?.characterEvolution.stateVersions,
        refreshedVersionMetas,
    ))
    const displayedProcessedRanges = $derived.by(() => deriveMergedProcessedRanges({
        evolutionSettings: currentCharacter?.characterEvolution,
        mergedStateVersions: displayedStateVersions,
    }))

    const hasTemplateSlot = $derived(hasCharacterStateTemplateBlock(DBState.db))
    const effectiveProvider = $derived(evolutionSettings?.extractionProvider ?? "")
    const effectiveModel = $derived(evolutionSettings?.extractionModel ?? "")
    const currentPendingProposal = $derived(currentCharacter?.characterEvolution.pendingProposal ?? null)
    const activeChatId = $derived(currentCharacter?.chats?.[currentCharacter.chatPage]?.id ?? null)
    const activeChatMessageCount = $derived(currentCharacter?.chats?.[currentCharacter.chatPage]?.message?.length ?? 0)
    const replayCurrentChatAvailable = $derived(
        Boolean(
            currentCharacter?.chaId
            && activeChatId
            && !currentPendingProposal
            && hasAcceptedEvolutionForChat(currentCharacter, activeChatId, activeChatMessageCount)
        )
    )
    const manualRangeBlockedReason = $derived.by(() => {
        if (!currentCharacter?.chaId || !activeChatId) {
            return "Open a saved chat before running ranged handoff."
        }
        if (currentPendingProposal) {
            return "Resolve the current proposal before running another handoff."
        }
        if (activeChatMessageCount < 1) {
            return "Add at least one message to the current chat before running ranged handoff."
        }
        return ""
    })
    const manualRangeAvailable = $derived(manualRangeBlockedReason.length === 0)

    const autoHandoffBatchSize = $derived(currentCharacter?.characterEvolution.autoHandoffBatchSize ?? 10)

    const nextUnprocessedMessageNumber = $derived.by(() => {
        return getNextUnprocessedMessageIndexForChat(
            {
                lastProcessedChatId: currentCharacter?.characterEvolution.lastProcessedChatId,
                lastProcessedMessageIndexByChat: currentCharacter?.characterEvolution.lastProcessedMessageIndexByChat,
                processedRanges: displayedProcessedRanges,
                stateVersions: displayedStateVersions,
            },
            activeChatId,
        ) + 1
    })

    const autoProcessAvailable = $derived(
        manualRangeAvailable
        && !autoProcessing
        && nextUnprocessedMessageNumber + autoHandoffBatchSize - 1 <= activeChatMessageCount
    )

    function findCharacterById(characterId: string) {
        return findSingleCharacterById(DBState.db.characters, characterId)
    }

    function commitCharacter(characterEntry: character) {
        commitEvolutionCharacter(DBState.db.characters, characterEntry)
    }

    $effect(() => {
        const characterEntry = currentCharacter
        if (!characterEntry) {
            return
        }

        ensureCharacterEvolution(characterEntry)
    })

    $effect(() => {
        const characterEntry = currentCharacter
        const nextKey = getSectionDraftHydrationKey({
            characterEntry,
            evolutionSettings,
        })
        if (sectionDraftKey === nextKey) {
            return
        }

        sectionDraftKey = nextKey
        const nextDrafts = createSectionDraftSnapshot({
            characterEntry,
            evolutionSettings,
        })
        sectionConfigDraft = nextDrafts.sectionConfigDraft
        privacyDraft = nextDrafts.privacyDraft
    })

    $effect(() => {
        const characterEntry = currentCharacter
        const nextKey = getCurrentStateDraftHydrationKey(characterEntry)
        if (currentStateDraftKey === nextKey) {
            return
        }

        currentStateDraftKey = nextKey
        currentStateDraft = createCurrentStateDraft(characterEntry)
    })

    $effect(() => {
        const characterEntry = currentCharacter
        if (!characterEntry || !currentStateDraft || evolutionSettings?.pendingProposal) {
            return
        }

        syncEvolutionCharacterDrafts({
            characterEntry,
            currentStateDraft,
            sectionConfigDraft,
            privacyDraft,
            resolveCharacterById: findCharacterById,
            commitCharacter,
        })
    })

    async function persistCharacter() {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId) {
            return
        }

        syncEvolutionCharacterDrafts({
            characterEntry,
            currentStateDraft,
            sectionConfigDraft,
            privacyDraft,
            resolveCharacterById: findCharacterById,
            commitCharacter,
        })
        await persistEvolutionCharacter(DBState.db, characterEntry.chaId)
    }

    const operations = createEvolutionSettingsOperations({
        getCurrentCharacter: () => currentCharacter,
        getCurrentCharacterId: () => currentCharacter?.chaId ?? null,
        getSelectedVersion: () => selectedVersion,
        getDisplayedStateVersions: () => displayedStateVersions,
        getCurrentPendingProposal: () => currentPendingProposal,
        getActiveChatId: () => activeChatId,
        getActiveChatMessageCount: () => activeChatMessageCount,
        getReplayCurrentChatAvailable: () => replayCurrentChatAvailable,
        getAutoHandoffBatchSize: () => autoHandoffBatchSize,
        getNextUnprocessedMessageNumber: () => nextUnprocessedMessageNumber,
        getAutoProcessCancelled: () => autoProcessCancelled,
        findCharacterById,
        commitCharacter,
        setLoadingVersions: (value) => {
            loadingVersions = value
        },
        setReviewActionBusy: (value) => {
            reviewActionBusy = value
        },
        setSelectedVersion: (value) => {
            selectedVersion = value
        },
        setSelectedVersionFile: (value) => {
            selectedVersionFile = value
        },
        setRefreshedVersionMetas: (value) => {
            refreshedVersionMetas = value
        },
        setSelectedWorkspaceTab: (value) => {
            selectedWorkspaceTab = value
        },
        setReplayingAcceptedChat: (value) => {
            replayingAcceptedChat = value
        },
        setRunningManualRangeHandoff: (value) => {
            runningManualRangeHandoff = value
        },
        setAutoProcessing: (value) => {
            autoProcessing = value
        },
        setAutoProcessCancelled: (value) => {
            autoProcessCancelled = value
        },
        setAutoProcessedBatches: (value) => {
            autoProcessedBatches = value
        },
        setAutoProcessTotalBatches: (value) => {
            autoProcessTotalBatches = value
        },
    })

    function openFullscreenReview() {
        const characterId = currentCharacter?.chaId
        if (!characterId || !currentPendingProposal) {
            return
        }

        evolutionReviewOpenRequest.set(characterId)
    }

    $effect(() => {
        const nextProposalId = currentPendingProposal?.proposalId ?? null
        if (!nextProposalId) {
            activeProposalId = null
            return
        }

        if (activeProposalId === nextProposalId) {
            return
        }

        activeProposalId = nextProposalId
        selectedWorkspaceTab = EVOLUTION_REVIEW_TAB
    })

    $effect(() => {
        const characterId = currentCharacter?.chaId ?? null
        if (versionCharacterId === characterId) {
            return
        }

        versionCharacterId = characterId

        if (!characterId) {
            refreshedVersionMetas = []
            selectedVersion = null
            selectedVersionFile = null
            return
        }

        refreshedVersionMetas = []
        selectedVersion = null
        selectedVersionFile = null
        void operations.handleRefreshVersions()
    })

    const selectedVersionState = $derived(selectedVersionFile?.state ?? null)
    const selectedVersionSectionConfigs = $derived(
        deriveSelectedVersionSectionConfigs({
            selectedVersionFile,
            selectedVersionState,
            evolutionSettings,
        })
    )
    const selectedVersionPrivacy = $derived(
        deriveSelectedVersionPrivacy({
            selectedVersionFile,
            selectedVersionState,
            evolutionSettings,
        })
    )
</script>

{#if hasGroupSelection}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Character evolution is not available for group chats.</span>
    </div>
{:else if !currentCharacter}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Select a single character to configure evolution.</span>
    </div>
{:else}
    <EvolutionWorkspaceContent
        {hasGroupSelection}
        {currentCharacter}
        {evolutionSettings}
        {selectedWorkspaceTab}
        onSelectWorkspaceTab={(tab) => {
            selectedWorkspaceTab = tab
        }}
        {displayedProcessedRanges}
        {effectiveProvider}
        {effectiveModel}
        {hasTemplateSlot}
        {activeChatId}
        {activeChatMessageCount}
        onOpenGlobalDefaults={openEvolutionGlobalDefaults}
        {manualRangeAvailable}
        manualRangeBlockedReason={manualRangeBlockedReason}
        {runningManualRangeHandoff}
        onRunManualRange={operations.runManualRangeHandoff}
        {autoProcessAvailable}
        {autoProcessing}
        {autoProcessedBatches}
        {autoProcessTotalBatches}
        onRunAutoProcess={operations.runAutoProcess}
        onCancelAutoProcess={operations.cancelAutoProcess}
        {replayCurrentChatAvailable}
        {replayingAcceptedChat}
        onReplayCurrentChat={operations.replayAcceptedChat}
        bind:sectionConfigDraft
        bind:privacyDraft
        {currentPendingProposal}
        {reviewActionBusy}
        onOpenFullscreenReview={openFullscreenReview}
        onRejectProposal={operations.rejectProposal}
        bind:currentStateDraft
        onPersist={persistCharacter}
        {displayedStateVersions}
        {loadingVersions}
        {selectedVersion}
        {selectedVersionState}
        {selectedVersionSectionConfigs}
        {selectedVersionPrivacy}
        onRefreshVersions={() => operations.handleRefreshVersions()}
        onPreviewRetention={operations.previewRetention}
        onLoadVersion={operations.loadVersion}
        onRevertVersion={operations.revertVersion}
        onDeleteVersion={operations.deleteVersion}
    />
{/if}
