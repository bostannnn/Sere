<script lang="ts">
    import { alertError, alertNormal } from "src/ts/alert"
    import {
        ensureCharacterEvolution,
        getEffectiveCharacterEvolutionSettings,
        hasCharacterStateTemplateBlock,
    } from "src/ts/characterEvolution"
    import {
        getCharacterEvolutionErrorMessage,
    } from "src/ts/evolution"
    import { DBState, evolutionReviewOpenRequest, selectedCharID } from "src/ts/stores.svelte"
    import type {
        CharacterEvolutionSectionConfig,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionState,
        CharacterEvolutionVersionFile,
        character,
    } from "src/ts/storage/database.types"
    import EvolutionHistoryPanel from "./EvolutionHistoryPanel.svelte"
    import EvolutionReviewPanel from "./EvolutionReviewPanel.svelte"
    import EvolutionSectionsPanel from "./EvolutionSectionsPanel.svelte"
    import EvolutionSetupPanel from "./EvolutionSetupPanel.svelte"
    import EvolutionStatePanel from "./EvolutionStatePanel.svelte"
    import EvolutionWorkspaceTabs from "./EvolutionWorkspaceTabs.svelte"
    import {
        hasAcceptedEvolutionForChat,
        rejectEvolutionReviewFlow,
        runEvolutionHandoffFlow,
    } from "src/ts/character-evolution/reviewFlow"
    import { findSingleCharacterById, replaceCharacterById } from "src/ts/storage/characterList"
    import {
        loadEvolutionVersionState,
        openEvolutionGlobalDefaults,
        persistEvolutionCharacter,
        refreshEvolutionVersions,
    } from "./evolutionSettings.actions"
    import {
        EVOLUTION_HISTORY_TAB,
        EVOLUTION_REVIEW_TAB,
        EVOLUTION_SECTIONS_TAB,
        EVOLUTION_SETUP_TAB,
        EVOLUTION_STATE_TAB,
        type EvolutionWorkspaceTabId,
    } from "./evolutionSettingsTabs"
    import {
        buildEvolutionSyncSettings,
        createCurrentStateDraft,
        createSectionDraftSnapshot,
        getCurrentStateDraftHydrationKey,
        getSectionDraftHydrationKey,
    } from "./evolutionSettings.drafts"
    import {
        deriveSelectedVersionPrivacy,
        deriveSelectedVersionSectionConfigs,
        isSingleCharacter,
    } from "./evolutionSettings.helpers"

    let loadingVersions = $state(false)
    let reviewActionBusy = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionFile = $state<CharacterEvolutionVersionFile | null>(null)
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

    function findCharacterById(characterId: string) {
        return findSingleCharacterById(DBState.db.characters, characterId)
    }

    function commitCharacter(characterEntry: character) {
        replaceCharacterById(DBState.db.characters, characterEntry)
    }

    function syncCharacterDrafts(characterEntry: character) {
        const baseCharacter = findCharacterById(characterEntry.chaId) ?? characterEntry
        const nextEvolution = buildEvolutionSyncSettings({
            baseCharacter,
            currentStateDraft,
            sectionConfigDraft,
            privacyDraft,
        })
        if (!nextEvolution) {
            return
        }

        commitCharacter({
            ...baseCharacter,
            characterEvolution: nextEvolution,
        })
    }

    function setUseGlobalDefaults(nextValue: boolean) {
        const characterEntry = currentCharacter
        if (!characterEntry) {
            return
        }

        characterEntry.characterEvolution = {
            ...characterEntry.characterEvolution,
            useGlobalDefaults: nextValue,
        }
        commitCharacter(characterEntry)
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

        syncCharacterDrafts(characterEntry)
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

        syncCharacterDrafts(characterEntry)
    })

    async function persistCharacter() {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId) {
            return
        }

        syncCharacterDrafts(characterEntry)
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
            const payload = await refreshEvolutionVersions(
                characterId,
                selectedVersion,
            )
            const characterEntry = findCharacterById(characterId)
            if (characterEntry) {
                characterEntry.characterEvolution.stateVersions = payload.versions
                commitCharacter(characterEntry)
            }
            if (currentCharacter?.chaId === characterId) {
                selectedVersionFile = payload.selectedVersionFile
            }
        } catch (error) {
            if (currentCharacter?.chaId === characterId) {
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
            const payload = await loadEvolutionVersionState(characterId, version)
            if (currentCharacter?.chaId === characterId) {
                selectedVersionFile = payload
            }
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
            selectedVersion = null
            selectedVersionFile = null
            return
        }

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
{:else if evolutionSettings && currentCharacter.characterEvolution}
    <div class="ds-settings-page evolution-settings-page">
        <div class="ds-settings-section">
            <EvolutionWorkspaceTabs
                selectedTab={selectedWorkspaceTab}
                onSelect={(tab) => {
                    selectedWorkspaceTab = tab
                }}
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
                    {usingGlobalDefaults}
                    {effectiveProvider}
                    {effectiveModel}
                    {hasTemplateSlot}
                    {revealCharacterOverrides}
                    onToggleRevealCharacterOverrides={() => {
                        revealCharacterOverrides = !revealCharacterOverrides
                    }}
                    onOpenGlobalDefaults={openEvolutionGlobalDefaults}
                    {replayCurrentChatAvailable}
                    replayCurrentChatBusy={replayingAcceptedChat}
                    onReplayCurrentChat={replayAcceptedChat}
                />
            </div>
        {:else if selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
            <EvolutionSectionsPanel
                {usingGlobalDefaults}
                bind:sectionConfigDraft
                bind:privacyDraft
                onUseGlobalDefaultsChange={setUseGlobalDefaults}
                onOpenGlobalDefaults={openEvolutionGlobalDefaults}
            />
        {:else if selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
            <EvolutionReviewPanel
                {currentPendingProposal}
                {reviewActionBusy}
                onOpenFullscreenReview={openFullscreenReview}
                onRejectProposal={rejectProposal}
            />
        {:else if selectedWorkspaceTab === EVOLUTION_STATE_TAB}
            <EvolutionStatePanel
                hasPendingProposal={Boolean(currentPendingProposal)}
                bind:currentStateDraft
                sectionConfigs={evolutionSettings.sectionConfigs}
                privacy={evolutionSettings.privacy}
                onPersist={persistCharacter}
            />
        {:else}
            <EvolutionHistoryPanel
                stateVersions={currentCharacter.characterEvolution.stateVersions}
                {loadingVersions}
                {selectedVersion}
                {selectedVersionState}
                {selectedVersionSectionConfigs}
                {selectedVersionPrivacy}
                onRefresh={() => handleRefreshVersions()}
                onLoadVersion={loadVersion}
            />
        {/if}
    </div>
{/if}

<style>
    .evolution-settings-page {
        gap: var(--ds-settings-section-gap);
    }
</style>
