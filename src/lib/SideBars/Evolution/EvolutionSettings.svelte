<script lang="ts">
    import ProposalPanel from "src/lib/Evolution/ProposalPanel.svelte"
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte"
    import StateEditor from "src/lib/Evolution/StateEditor.svelte"
    import Button from "src/lib/UI/GUI/Button.svelte"
    import { alertError, alertNormal } from "src/ts/alert"
    import {
        ensureCharacterEvolution,
        getEffectiveCharacterEvolutionSettings,
        hasCharacterStateTemplateBlock,
    } from "src/ts/characterEvolution"
    import { getCharacterEvolutionErrorMessage } from "src/ts/evolution"
    import { DBState, selectedCharID } from "src/ts/stores.svelte"
    import type { CharacterEvolutionState, character, groupChat } from "src/ts/storage/database.types"
    import EvolutionSetupPanel from "./EvolutionSetupPanel.svelte"
    import EvolutionWorkspaceTabs from "./EvolutionWorkspaceTabs.svelte"
    import {
        acceptEvolutionProposalAction,
        getEvolutionProposalIdentity,
        loadEvolutionVersionState,
        openEvolutionGlobalDefaults,
        persistEvolutionCharacter,
        refreshEvolutionVersions,
        rejectEvolutionProposalAction,
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

    function isSingleCharacter(value: character | groupChat | null | undefined): value is character {
        return !!value && value.type !== "group"
    }

    let loadingVersions = $state(false)
    let accepting = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionState = $state<CharacterEvolutionState | null>(null)
    let proposalDraft = $state<CharacterEvolutionState | null>(null)
    let proposalDraftKey = $state<string | null>(null)
    let versionCharacterId = $state<string | null>(null)
    let revealCharacterOverrides = $state(false)
    let selectedWorkspaceTab = $state<EvolutionWorkspaceTabId>(EVOLUTION_SETUP_TAB)

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
    const usingGlobalDefaults = $derived(evolutionSettings?.useGlobalDefaults ?? true)
    const effectiveProvider = $derived(evolutionSettings?.extractionProvider ?? "")
    const effectiveModel = $derived(evolutionSettings?.extractionModel ?? "")
    const selectedWorkspaceTitle = $derived(EVOLUTION_TAB_LABELS[selectedWorkspaceTab])

    $effect(() => {
        const characterEntry = currentCharacter
        if (!characterEntry) {
            return
        }

        ensureCharacterEvolution(characterEntry)
    })

    async function persistCharacter() {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId) {
            return
        }

        await persistEvolutionCharacter(DBState.db, characterEntry.chaId)
    }

    async function handleRefreshVersions() {
        const characterEntry = currentCharacter
        if (!characterEntry?.chaId) {
            return
        }

        loadingVersions = true
        try {
            const payload = await refreshEvolutionVersions(
                characterEntry.chaId,
                selectedVersion,
            )
            characterEntry.characterEvolution.stateVersions = payload.versions
            selectedVersionState = payload.selectedVersionState
        } catch (error) {
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

        loadingVersions = true
        try {
            selectedWorkspaceTab = EVOLUTION_HISTORY_TAB
            selectedVersion = version
            const payload = await loadEvolutionVersionState(characterEntry.chaId, version)
            selectedVersionState = payload?.state ?? null
        } catch (error) {
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
            await rejectEvolutionProposalAction(characterEntry.chaId)
            characterEntry.characterEvolution.pendingProposal = null
            proposalDraft = null
            proposalDraftKey = null
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
            const payload = await acceptEvolutionProposalAction({
                characterId: characterEntry.chaId,
                proposedState: proposalDraft,
                createNextChat,
                selectedCharIndex: Number($selectedCharID),
            })

            characterEntry.characterEvolution.currentState =
                payload.state as typeof characterEntry.characterEvolution.currentState
            characterEntry.characterEvolution.currentStateVersion =
                Number(payload.version) || characterEntry.characterEvolution.currentStateVersion
            characterEntry.characterEvolution.pendingProposal = null
            proposalDraft = null
            proposalDraftKey = null
            selectedWorkspaceTab = EVOLUTION_STATE_TAB

            await handleRefreshVersions()

            alertNormal(
                createNextChat
                    ? "Evolution state accepted and a new chat was created."
                    : "Evolution state accepted.",
            )
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            accepting = false
        }
    }

    $effect(() => {
        const pendingProposal = evolutionSettings?.pendingProposal ?? null
        const proposalIdentity = getEvolutionProposalIdentity(
            currentCharacter?.chaId,
            pendingProposal,
        )

        if (proposalIdentity) {
            if (!proposalDraft || proposalDraftKey !== proposalIdentity) {
                proposalDraft = structuredClone(pendingProposal.proposedState)
                proposalDraftKey = proposalIdentity
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
            selectedVersionState = null
            return
        }

        selectedVersion = null
        selectedVersionState = null
        void handleRefreshVersions()
    })
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
            />
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
        <div
            role="tabpanel"
            id="evolution-panel-sections"
            aria-labelledby="evolution-subtab-1"
            tabindex="0"
        >
            <SectionConfigEditor
                bind:value={currentCharacter.characterEvolution.sectionConfigs}
                privacy={currentCharacter.characterEvolution.privacy}
                readonly={usingGlobalDefaults}
            />
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
        <div
            role="tabpanel"
            id="evolution-panel-review"
            aria-labelledby="evolution-subtab-2"
            tabindex="0"
        >
            {#if evolutionSettings.pendingProposal}
                <ProposalPanel
                    proposal={evolutionSettings.pendingProposal}
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
            {#if evolutionSettings.pendingProposal}
                <div class="ds-settings-section">
                    <div class="ds-settings-card ds-settings-card-stack-start">
                        <span class="ds-settings-label">Current State</span>
                        <span class="ds-settings-label-muted-sm">
                            Resolve the pending proposal before editing the accepted state directly.
                        </span>
                    </div>
                </div>
            {:else}
                <StateEditor
                    bind:value={currentCharacter.characterEvolution.currentState}
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
                sectionConfigs={evolutionSettings.sectionConfigs}
                privacy={evolutionSettings.privacy}
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
