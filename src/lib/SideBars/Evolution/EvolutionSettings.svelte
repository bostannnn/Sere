<script lang="ts">
    import ProposalPanel from "src/lib/Evolution/ProposalPanel.svelte"
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte"
    import StateEditor from "src/lib/Evolution/StateEditor.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import { alertError, alertNormal } from "src/ts/alert"
    import {
        createDefaultCharacterEvolutionSectionConfigs,
        ensureCharacterEvolution,
        getEffectiveCharacterEvolutionSettings,
        hasCharacterStateTemplateBlock,
        normalizeCharacterEvolutionSectionConfigs,
        normalizeCharacterEvolutionState,
    } from "src/ts/characterEvolution"
    import {
        getCharacterEvolutionErrorMessage,
    } from "src/ts/evolution"
    import { DBState, selectedCharID } from "src/ts/stores.svelte"
    import type {
        CharacterEvolutionSectionConfig,
        CharacterEvolutionPrivacySettings,
        CharacterEvolutionState,
        CharacterEvolutionVersionFile,
        character,
        groupChat,
    } from "src/ts/storage/database.types"
    import EvolutionSetupPanel from "./EvolutionSetupPanel.svelte"
    import EvolutionWorkspaceTabs from "./EvolutionWorkspaceTabs.svelte"
    import {
        cloneEvolutionSettingsSections,
        cloneEvolutionState,
    } from "src/ts/character-evolution/workflow"
    import {
        acceptEvolutionReviewFlow,
        hasAcceptedEvolutionForChat,
        rejectEvolutionReviewFlow,
        runEvolutionHandoffFlow,
        syncEvolutionProposalDraft,
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
        EVOLUTION_TAB_LABELS,
        type EvolutionWorkspaceTabId,
    } from "./evolutionSettingsTabs"
    import {
        clonePrivacy,
        deriveSelectedVersionPrivacy,
        deriveSelectedVersionSectionConfigs,
        isSingleCharacter,
        jsonEqual,
    } from "./evolutionSettings.helpers"

    let loadingVersions = $state(false)
    let accepting = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionFile = $state<CharacterEvolutionVersionFile | null>(null)
    let proposalDraft = $state<CharacterEvolutionState | null>(null)
    let proposalDraftKey = $state<string | null>(null)
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
    const selectedWorkspaceTitle = $derived(EVOLUTION_TAB_LABELS[selectedWorkspaceTab])
    const currentPendingProposal = $derived(currentCharacter?.characterEvolution.pendingProposal ?? null)
    const activeChatId = $derived(currentCharacter?.chats?.[currentCharacter.chatPage]?.id ?? null)
    const replayCurrentChatAvailable = $derived(
        Boolean(
            currentCharacter?.chaId
            && activeChatId
            && !currentPendingProposal
            && currentCharacter.characterEvolution.lastProcessedChatId === activeChatId
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
        let changed = false
        const nextEvolution = {
            ...baseCharacter.characterEvolution,
        }

        if (currentStateDraft) {
            const normalizedState = normalizeCharacterEvolutionState(currentStateDraft)
            if (!jsonEqual(baseCharacter.characterEvolution.currentState, normalizedState)) {
                nextEvolution.currentState = structuredClone(normalizedState)
                changed = true
            }
        }

        if (!baseCharacter.characterEvolution.useGlobalDefaults) {
            const normalizedSections = normalizeCharacterEvolutionSectionConfigs(sectionConfigDraft)
            const normalizedPrivacy = clonePrivacy(privacyDraft)
            if (!jsonEqual(baseCharacter.characterEvolution.sectionConfigs, normalizedSections)) {
                nextEvolution.sectionConfigs = structuredClone(normalizedSections)
                changed = true
            }
            if (!jsonEqual(baseCharacter.characterEvolution.privacy, normalizedPrivacy)) {
                nextEvolution.privacy = structuredClone(normalizedPrivacy)
                changed = true
            }
        }

        if (changed) {
            commitCharacter({
                ...baseCharacter,
                characterEvolution: nextEvolution,
            })
        }
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
        const nextKey = characterEntry?.chaId
            ? `${characterEntry.chaId}:${characterEntry.characterEvolution.useGlobalDefaults ? `global:${JSON.stringify(evolutionSettings?.sectionConfigs ?? [])}:${JSON.stringify(evolutionSettings?.privacy ?? {})}` : "local"}`
            : null
        if (sectionDraftKey === nextKey) {
            return
        }

        sectionDraftKey = nextKey
        if (!characterEntry) {
            sectionConfigDraft = []
            privacyDraft = clonePrivacy(null)
            return
        }

        if (characterEntry.characterEvolution.useGlobalDefaults) {
            sectionConfigDraft = cloneEvolutionSettingsSections(evolutionSettings?.sectionConfigs ?? createDefaultCharacterEvolutionSectionConfigs())
            privacyDraft = clonePrivacy(evolutionSettings?.privacy)
            return
        }

        sectionConfigDraft = cloneEvolutionSettingsSections(characterEntry.characterEvolution.sectionConfigs)
        privacyDraft = clonePrivacy(characterEntry.characterEvolution.privacy)
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
        const nextKey = characterEntry?.chaId
            ? `${characterEntry.chaId}:${characterEntry.characterEvolution.currentStateVersion}`
            : null
        if (currentStateDraftKey === nextKey) {
            return
        }

        currentStateDraftKey = nextKey
        currentStateDraft = cloneEvolutionState(characterEntry?.characterEvolution.currentState)
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

        accepting = true
        try {
            commitCharacter(await rejectEvolutionReviewFlow(characterEntry))
            if (currentCharacter?.chaId === characterEntry.chaId) {
                proposalDraft = null
                proposalDraftKey = null
            }
            alertNormal("Evolution proposal rejected.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            accepting = false
        }
    }

    async function acceptProposal(createNextChat = false) {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId || !proposalDraft) {
            return
        }

        accepting = true
        try {
            const acceptedSourceChatId = characterEntry.characterEvolution.pendingProposal?.sourceChatId ?? null
            const { nextCharacter, chatCreationError } = await acceptEvolutionReviewFlow({
                characterEntry,
                proposedState: proposalDraft,
                createNextChat,
                sourceChatId: acceptedSourceChatId,
                resolveCharacterById: findCharacterById,
            })
            commitCharacter(nextCharacter)
            currentStateDraft = cloneEvolutionState(nextCharacter.characterEvolution.currentState)
            currentStateDraftKey = `${nextCharacter.chaId}:${nextCharacter.characterEvolution.currentStateVersion}`
            if (currentCharacter?.chaId === characterEntry.chaId) {
                proposalDraft = null
                proposalDraftKey = null
            }
            selectedWorkspaceTab = EVOLUTION_STATE_TAB

            await handleRefreshVersions(characterEntry.chaId)

            alertNormal(
                createNextChat
                    ? (chatCreationError
                        ? "Evolution state accepted, but the new chat could not be created."
                        : "Evolution state accepted and a new chat was created.")
                    : "Evolution state accepted.",
            )
            if (chatCreationError) {
                alertError(chatCreationError)
            }
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            accepting = false
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

    $effect(() => {
        const nextDraftState = syncEvolutionProposalDraft({
            characterId: currentCharacter?.chaId,
            proposal: currentPendingProposal,
        })

        if (nextDraftState.proposalDraftKey) {
            if (!proposalDraft || proposalDraftKey !== nextDraftState.proposalDraftKey) {
                proposalDraft = nextDraftState.proposalDraft
                proposalDraftKey = nextDraftState.proposalDraftKey
                selectedWorkspaceTab = EVOLUTION_REVIEW_TAB
            }
            return
        }

        proposalDraft = null
        proposalDraftKey = null
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
    <div class="ds-settings-section">
        <EvolutionWorkspaceTabs
            selectedTab={selectedWorkspaceTab}
            onSelect={(tab) => {
                selectedWorkspaceTab = tab
            }}
        />
    </div>

    <div class="ds-settings-section">
        <h2 class="evolution-section-title">{selectedWorkspaceTitle}</h2>
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
                {loadingVersions}
                {revealCharacterOverrides}
                onToggleRevealCharacterOverrides={() => {
                    revealCharacterOverrides = !revealCharacterOverrides
                }}
                onOpenGlobalDefaults={openEvolutionGlobalDefaults}
                onPersistCharacter={persistCharacter}
                onRefreshVersions={handleRefreshVersions}
                {replayCurrentChatAvailable}
                replayCurrentChatBusy={replayingAcceptedChat}
                onReplayCurrentChat={replayAcceptedChat}
            />
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
        <div
            role="tabpanel"
            id="evolution-panel-sections"
            aria-labelledby="evolution-subtab-1"
            tabindex="0"
        >
            <div class="ds-settings-section">
                <div class="ds-settings-card ds-settings-card-stack-start">
                    <CheckInput
                        bare={true}
                        className="evolution-sections-toggle"
                        check={usingGlobalDefaults}
                        onChange={setUseGlobalDefaults}
                        name="Use Global Defaults For Sections And Privacy"
                    />
                    <span class="ds-settings-label-muted-sm">
                        {usingGlobalDefaults
                            ? "Sections and privacy are inherited from global evolution defaults."
                            : "These section and privacy settings are specific to this character."}
                    </span>
                    <div class="ds-settings-inline-actions action-rail">
                        <Button styled="outlined" size="sm" onclick={openEvolutionGlobalDefaults}>
                            Open Global Defaults
                        </Button>
                    </div>
                </div>
            </div>

            {#if !usingGlobalDefaults}
                <div class="ds-settings-section">
                    <div class="ds-settings-card ds-settings-card-stack-start">
                        <span class="ds-settings-label">Privacy</span>
                        <div class="ds-settings-grid-two">
                            <CheckInput
                                bind:check={privacyDraft.allowCharacterIntimatePreferences}
                                name="Allow Character Intimate Preferences"
                            />
                            <CheckInput
                                bind:check={privacyDraft.allowUserIntimatePreferences}
                                name="Allow User Intimate Preferences"
                            />
                        </div>
                    </div>
                </div>
            {/if}

            <SectionConfigEditor
                bind:value={sectionConfigDraft}
                privacy={privacyDraft}
                readonly={usingGlobalDefaults}
                title={usingGlobalDefaults ? "Global Sections" : "Character Section Overrides"}
            />
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
        <div
            role="tabpanel"
            id="evolution-panel-review"
            aria-labelledby="evolution-subtab-2"
            tabindex="0"
        >
            {#if currentPendingProposal}
                <ProposalPanel
                    proposal={currentPendingProposal}
                    currentState={evolutionSettings.currentState}
                    sectionConfigs={evolutionSettings.sectionConfigs}
                    privacy={evolutionSettings.privacy}
                    bind:bindState={proposalDraft}
                    onAccept={() => acceptProposal(false)}
                    onAcceptAndCreate={() => acceptProposal(true)}
                    onReject={rejectProposal}
                    loading={accepting}
                />
            {:else}
                <div class="ds-settings-section">
                    <div class="ds-settings-card ds-settings-card-stack-start">
                        <span class="ds-settings-label">Review</span>
                        <span class="ds-settings-label-muted-sm">
                            No pending evolution proposal. Run a chat handoff to review a new
                            state update here.
                        </span>
                    </div>
                </div>
            {/if}
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_STATE_TAB}
        <div
            role="tabpanel"
            id="evolution-panel-state"
            aria-labelledby="evolution-subtab-3"
            tabindex="0"
        >
            {#if currentPendingProposal}
                <div class="ds-settings-section">
                    <div class="ds-settings-card ds-settings-card-stack-start">
                        <span class="ds-settings-label">Current State</span>
                        <span class="ds-settings-label-muted-sm">
                            Resolve the pending proposal before editing the accepted state directly.
                        </span>
                    </div>
                </div>
            {:else}
                {#if currentStateDraft}
                    <StateEditor
                        bind:value={currentStateDraft}
                        sectionConfigs={evolutionSettings.sectionConfigs}
                        privacy={evolutionSettings.privacy}
                        title="Current State"
                    />
                    <div class="ds-settings-section">
                        <div class="ds-settings-inline-actions action-rail">
                            <Button styled="outlined" onclick={persistCharacter}>
                                Save Current State
                            </Button>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    {:else}
        <div
            class="ds-settings-section"
            role="tabpanel"
            id="evolution-panel-history"
            aria-labelledby="evolution-subtab-4"
            tabindex="0"
        >
            <span class="ds-settings-label">Version History</span>
            <div class="ds-settings-card ds-settings-list-shell">
                {#if currentCharacter.characterEvolution.stateVersions.length === 0}
                    <span class="ds-settings-label-muted-sm">No accepted versions yet.</span>
                {/if}

                {#each currentCharacter.characterEvolution.stateVersions as version (version.version)}
                    <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between">
                        <span class="ds-settings-label">
                            v{version.version} {version.chatId ? `after ${version.chatId}` : ""}
                        </span>
                        <Button
                            size="sm"
                            styled="outlined"
                            onclick={() => loadVersion(version.version)}
                            disabled={loadingVersions}
                        >
                            View
                        </Button>
                    </div>
                {/each}
            </div>
        </div>

        {#if selectedVersion !== null && selectedVersionState}
            <StateEditor
                value={selectedVersionState}
                sectionConfigs={selectedVersionSectionConfigs}
                privacy={selectedVersionPrivacy}
                readonly={true}
                title={`Version v${selectedVersion}`}
            />
        {/if}
    {/if}
{/if}

<style>
    .evolution-section-title {
        margin: 0;
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-semibold);
        color: var(--ds-text-primary);
    }
</style>
