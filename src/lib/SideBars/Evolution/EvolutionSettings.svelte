<script lang="ts">
    import { alertError, alertNormal } from "src/ts/alert"
    import { ensureCharacterEvolution, getEffectiveCharacterEvolutionSettings, hasCharacterStateTemplateBlock } from "src/ts/characterEvolution"
    import { getCharacterEvolutionErrorMessage } from "src/ts/evolution"
    import { DBState, evolutionReviewOpenRequest, selectedCharID } from "src/ts/stores.svelte"
    import type { CharacterEvolutionSectionConfig, CharacterEvolutionPrivacySettings, CharacterEvolutionState, CharacterEvolutionVersionMeta, CharacterEvolutionVersionFile, character } from "src/ts/storage/database.types"
    import EvolutionWorkspaceContent from "./EvolutionWorkspaceContent.svelte"
    import { acceptEvolutionReviewFlow, hasAcceptedEvolutionForChat, rejectEvolutionReviewFlow, runEvolutionHandoffFlow } from "src/ts/character-evolution/reviewFlow"
    import { getPendingProposalSourceRange } from "src/ts/character-evolution/pendingProposal"
    import { findSingleCharacterById } from "src/ts/storage/characterList"
    import { sleep } from "src/ts/util"
    import { openEvolutionGlobalDefaults, persistEvolutionCharacter, refreshEvolutionWorkspaceVersions, loadEvolutionWorkspaceVersion } from "./evolutionSettings.actions"
    import { EVOLUTION_HISTORY_TAB, EVOLUTION_REVIEW_TAB, EVOLUTION_SETUP_TAB, type EvolutionWorkspaceTabId } from "./evolutionSettingsTabs"
    import { createCurrentStateDraft, createSectionDraftSnapshot, getCurrentStateDraftHydrationKey, getSectionDraftHydrationKey } from "./evolutionSettings.drafts"
    import { commitEvolutionCharacter, setCharacterUseGlobalEvolutionDefaults, syncEvolutionCharacterDrafts } from "./evolutionSettings.character"
    import { deriveSelectedVersionPrivacy, deriveSelectedVersionSectionConfigs, deriveMergedProcessedRanges, isSingleCharacter, mergeEvolutionVersionMetas } from "./evolutionSettings.helpers"

    let loadingVersions = $state(false)
    let reviewActionBusy = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionFile = $state<CharacterEvolutionVersionFile | null>(null)
    let refreshedVersionMetas = $state<CharacterEvolutionVersionMeta[]>([])
    let activeProposalId = $state<string | null>(null)
    let versionCharacterId = $state<string | null>(null)
    let revealCharacterOverrides = $state(false)
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
    const usingGlobalDefaults = $derived(currentCharacter?.characterEvolution.useGlobalDefaults ?? true)
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
        const chatId = activeChatId?.trim()
        if (!chatId) return 1
        const ranges = displayedProcessedRanges
            .filter((entry) => entry.range.chatId === chatId)
            .sort((a, b) => a.range.startMessageIndex - b.range.startMessageIndex)
        let contiguousEnd = -1
        for (const entry of ranges) {
            if (entry.range.startMessageIndex > contiguousEnd + 1) break
            contiguousEnd = Math.max(contiguousEnd, entry.range.endMessageIndex)
        }
        return contiguousEnd + 2
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

    function setUseGlobalDefaults(nextValue: boolean) {
        const characterEntry = currentCharacter
        if (!characterEntry) {
            return
        }

        setCharacterUseGlobalEvolutionDefaults(characterEntry, nextValue, commitCharacter)
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
        if (!characterEntry || characterEntry.characterEvolution.useGlobalDefaults) {
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

    async function handleRefreshVersions(characterId = currentCharacter?.chaId ?? null) {
        if (!characterId) {
            return
        }

        loadingVersions = true
        if (currentCharacter?.chaId === characterId) {
            selectedVersionFile = null
        }
        try {
            await refreshEvolutionWorkspaceVersions({
                characterId,
                selectedVersion,
                currentCharacterId: currentCharacter?.chaId ?? null,
                findCharacterById,
                commitCharacter,
                setRefreshedVersionMetas: (versions) => {
                    refreshedVersionMetas = versions
                },
                setSelectedVersionFile: (file) => {
                    selectedVersionFile = file
                },
            })
        } catch (error) {
            if (currentCharacter?.chaId === characterId) {
                refreshedVersionMetas = []
                selectedVersionFile = null
            }
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            loadingVersions = false
        }
    }

    async function loadVersion(version: number) {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId) {
            return
        }
        const characterId = characterEntry.chaId

        loadingVersions = true
        selectedVersionFile = null
        try {
            selectedWorkspaceTab = EVOLUTION_HISTORY_TAB
            selectedVersion = version
            await loadEvolutionWorkspaceVersion({
                characterId,
                version,
                currentCharacterId: currentCharacter?.chaId ?? null,
                setSelectedVersionFile: (file) => {
                    selectedVersionFile = file
                },
            })
        } catch (error) {
            if (currentCharacter?.chaId === characterId) {
                selectedVersionFile = null
            }
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            loadingVersions = false
        }
    }

    async function rejectProposal() {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId) {
            return
        }

        reviewActionBusy = true
        try {
            commitCharacter(await rejectEvolutionReviewFlow(characterEntry))
            alertNormal("Evolution proposal rejected.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            reviewActionBusy = false
        }
    }

    async function replayAcceptedChat() {
        const characterEntry = currentCharacter
        const chatId = characterEntry?.chats?.[characterEntry.chatPage]?.id ?? null
        if (!characterEntry?.chaId || !chatId || !replayCurrentChatAvailable) {
            return
        }
        if (!hasAcceptedEvolutionForChat(characterEntry, chatId)) {
            return
        }
        if (typeof window !== "undefined" && !window.confirm("This chat was already accepted for evolution. Replay handoff for recovery?")) {
            return
        }

        replayingAcceptedChat = true
        try {
            const result = await runEvolutionHandoffFlow({
                characterEntry,
                chatId,
                chatMessageCount: activeChatMessageCount,
                forceReplay: true,
                resolveCharacterById: findCharacterById,
            })
            if (!result.nextCharacter) {
                return
            }
            commitCharacter(result.nextCharacter)
            alertNormal("Evolution proposal was regenerated for the accepted chat.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            replayingAcceptedChat = false
        }
    }

    async function runManualRangeHandoff(startMessageNumber: number, endMessageNumber: number) {
        const characterEntry = currentCharacter
        const chatId = activeChatId
        const maxCount = activeChatMessageCount
        if (!characterEntry?.chaId || !chatId) {
            alertError("Cannot run ranged evolution handoff without a saved character and chat.")
            return
        }

        if (
            !Number.isInteger(startMessageNumber)
            || !Number.isInteger(endMessageNumber)
            || startMessageNumber < 1
            || endMessageNumber < startMessageNumber
            || endMessageNumber > maxCount
        ) {
            alertError(`Invalid range. Use values between 1 and ${Math.max(1, maxCount)}, and keep Start less than or equal to End.`)
            return
        }

        runningManualRangeHandoff = true
        try {
            const result = await runEvolutionHandoffFlow({
                characterEntry,
                chatId,
                chatMessageCount: maxCount,
                sourceRange: {
                    chatId,
                    startMessageIndex: startMessageNumber - 1,
                    endMessageIndex: endMessageNumber - 1,
                },
                resolveCharacterById: findCharacterById,
            })
            if (!result.nextCharacter) {
                return
            }
            commitCharacter(result.nextCharacter)
            alertNormal(`Evolution proposal is ready for review for messages ${startMessageNumber}-${endMessageNumber}.`)
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            runningManualRangeHandoff = false
        }
    }

    function cancelAutoProcess() {
        autoProcessCancelled = true
    }

    async function runAutoProcess() {
        const characterEntry = currentCharacter
        const chatId = activeChatId
        if (!characterEntry?.chaId || !chatId) {
            alertError("Cannot run auto process without a saved character and chat.")
            return
        }

        const batchSize = Math.max(1, Math.floor(autoHandoffBatchSize || 10))
        const totalMessages = activeChatMessageCount

        let nextStart = nextUnprocessedMessageNumber

        // Count full batches available
        let batchCount = 0
        let tempStart = nextStart
        while (tempStart + batchSize - 1 <= totalMessages) {
            batchCount++
            tempStart += batchSize
        }

        if (batchCount === 0) return

        autoProcessing = true
        autoProcessCancelled = false
        autoProcessedBatches = 0
        autoProcessTotalBatches = batchCount

        try {
            while (true) {
                if (autoProcessCancelled) break

                const batchEnd = nextStart + batchSize - 1
                if (batchEnd > totalMessages) break

                const freshEntry = findCharacterById(characterEntry.chaId)
                if (!freshEntry) break

                const sourceRange = {
                    chatId,
                    startMessageIndex: nextStart - 1,
                    endMessageIndex: batchEnd - 1,
                }

                let handoffResult: Awaited<ReturnType<typeof runEvolutionHandoffFlow>>
                try {
                    handoffResult = await runEvolutionHandoffFlow({
                        characterEntry: freshEntry,
                        chatId,
                        chatMessageCount: totalMessages,
                        sourceRange,
                        resolveCharacterById: findCharacterById,
                    })
                } catch (error) {
                    alertError(getCharacterEvolutionErrorMessage(error))
                    break
                }

                if (!handoffResult.nextCharacter) break
                commitCharacter(handoffResult.nextCharacter)

                if (autoProcessCancelled) {
                    const charWithProposal = findCharacterById(characterEntry.chaId)
                    if (charWithProposal?.characterEvolution.pendingProposal) {
                        try {
                            commitCharacter(await rejectEvolutionReviewFlow(charWithProposal))
                        } catch (rejectError) {
                            alertError(getCharacterEvolutionErrorMessage(rejectError))
                        }
                    }
                    break
                }

                const freshForAccept = findCharacterById(characterEntry.chaId) ?? handoffResult.nextCharacter
                const proposalDraft = handoffResult.proposalDraft
                if (!proposalDraft) break

                try {
                    const { nextCharacter } = await acceptEvolutionReviewFlow({
                        characterEntry: freshForAccept,
                        proposedState: JSON.parse(JSON.stringify(proposalDraft)),
                        sourceRange,
                        resolveCharacterById: findCharacterById,
                    })
                    commitCharacter(nextCharacter)
                } catch (error) {
                    alertError(getCharacterEvolutionErrorMessage(error))
                    break
                }

                autoProcessedBatches++
                nextStart = batchEnd + 1

                if (nextStart + batchSize - 1 > totalMessages) break
                await sleep(500)
            }
        } finally {
            autoProcessing = false
        }
    }

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
        void handleRefreshVersions()
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
        {usingGlobalDefaults}
        {effectiveProvider}
        {effectiveModel}
        {hasTemplateSlot}
        {activeChatId}
        {activeChatMessageCount}
        {revealCharacterOverrides}
        onToggleRevealCharacterOverrides={() => {
            revealCharacterOverrides = !revealCharacterOverrides
        }}
        onOpenGlobalDefaults={openEvolutionGlobalDefaults}
        {manualRangeAvailable}
        manualRangeBlockedReason={manualRangeBlockedReason}
        {runningManualRangeHandoff}
        onRunManualRange={runManualRangeHandoff}
        {autoProcessAvailable}
        {autoProcessing}
        {autoProcessedBatches}
        {autoProcessTotalBatches}
        onRunAutoProcess={runAutoProcess}
        onCancelAutoProcess={cancelAutoProcess}
        {replayCurrentChatAvailable}
        {replayingAcceptedChat}
        onReplayCurrentChat={replayAcceptedChat}
        bind:sectionConfigDraft
        bind:privacyDraft
        onUseGlobalDefaultsChange={setUseGlobalDefaults}
        {currentPendingProposal}
        {reviewActionBusy}
        onOpenFullscreenReview={openFullscreenReview}
        onRejectProposal={rejectProposal}
        bind:currentStateDraft
        onPersist={persistCharacter}
        {displayedStateVersions}
        {loadingVersions}
        {selectedVersion}
        {selectedVersionState}
        {selectedVersionSectionConfigs}
        {selectedVersionPrivacy}
        onRefreshVersions={() => handleRefreshVersions()}
        onLoadVersion={loadVersion}
    />
{/if}
