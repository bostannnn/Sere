<script lang="ts">
    import { Clock3Icon, ClipboardCheckIcon, FileStackIcon, Settings2Icon, SlidersHorizontalIcon } from "@lucide/svelte";
    import { onMount, tick } from "svelte";
    import ProposalPanel from "src/lib/Evolution/ProposalPanel.svelte";
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte";
    import StateEditor from "src/lib/Evolution/StateEditor.svelte";
    import { alertError, alertNormal } from "src/ts/alert";
    import {
        CHARACTER_EVOLUTION_MODEL_SUGGESTIONS,
        ensureCharacterEvolution,
        getEffectiveCharacterEvolutionSettings,
        hasCharacterStateTemplateBlock,
    } from "src/ts/characterEvolution";
    import {
        acceptCharacterEvolutionProposal,
        createNewChatAfterEvolution,
        fetchCharacterEvolutionVersion,
        getCharacterEvolutionErrorMessage,
        listCharacterEvolutionVersions,
        rejectCharacterEvolutionProposal,
    } from "src/ts/evolution";
    import { saveServerDatabase } from "src/ts/storage/serverDb";
    import { DBState, OtherBotSettingsSubMenuIndex, SettingsMenuIndex, selectedCharID, settingsOpen } from "src/ts/stores.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";

    type EvolutionWorkspaceTabId = 0 | 1 | 2 | 3 | 4;
    const EVOLUTION_SETUP_TAB = 0 as const;
    const EVOLUTION_SECTIONS_TAB = 1 as const;
    const EVOLUTION_REVIEW_TAB = 2 as const;
    const EVOLUTION_STATE_TAB = 3 as const;
    const EVOLUTION_HISTORY_TAB = 4 as const;
    const evolutionTabOrder: EvolutionWorkspaceTabId[] = [
        EVOLUTION_SETUP_TAB,
        EVOLUTION_SECTIONS_TAB,
        EVOLUTION_REVIEW_TAB,
        EVOLUTION_STATE_TAB,
        EVOLUTION_HISTORY_TAB,
    ]
    const evolutionTabLabels: Record<EvolutionWorkspaceTabId, string> = {
        [EVOLUTION_SETUP_TAB]: "Setup",
        [EVOLUTION_SECTIONS_TAB]: "Sections",
        [EVOLUTION_REVIEW_TAB]: "Review",
        [EVOLUTION_STATE_TAB]: "State",
        [EVOLUTION_HISTORY_TAB]: "History",
    }

    let loadingVersions = $state(false)
    let accepting = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionState = $state(null)
    let proposalDraft = $state(null)
    let revealCharacterOverrides = $state(false)
    let selectedWorkspaceTab = $state<EvolutionWorkspaceTabId>(EVOLUTION_SETUP_TAB)
    const evolutionTabIconSize = 18

    const currentCharacter = $derived.by(() => {
        const selectedIndex = Number($selectedCharID)
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
            return null
        }
        const characters = Array.isArray(DBState.db.characters) ? DBState.db.characters : []
        return characters[selectedIndex] ?? null
    })
    const evolutionSettings = $derived.by(() => {
        const character = currentCharacter
        if (!character || character.type === 'group') {
            return null
        }
        return getEffectiveCharacterEvolutionSettings(DBState.db, character)
    })
    const hasTemplateSlot = $derived(hasCharacterStateTemplateBlock(DBState.db))
    const usingGlobalDefaults = $derived(evolutionSettings?.useGlobalDefaults ?? true)
    const effectiveProvider = $derived(evolutionSettings?.extractionProvider ?? "")
    const effectiveModel = $derived(evolutionSettings?.extractionModel ?? "")
    const selectedWorkspaceTitle = $derived(evolutionTabLabels[selectedWorkspaceTab])

    function focusEvolutionTab(tab: EvolutionWorkspaceTabId) {
        const tabButton = document.getElementById(`evolution-subtab-${tab}`) as HTMLButtonElement | null
        tabButton?.focus()
    }

    async function selectWorkspaceTabAndFocus(tab: EvolutionWorkspaceTabId) {
        selectedWorkspaceTab = tab
        await tick()
        focusEvolutionTab(tab)
    }

    function getHorizontalDirection(key: string): 1 | -1 | 0 {
        if (key === "ArrowRight" || key === "Right") {
            return 1
        }
        if (key === "ArrowLeft" || key === "Left") {
            return -1
        }
        return 0
    }

    async function handleEvolutionTabKeydown(event: KeyboardEvent, currentTab: EvolutionWorkspaceTabId = selectedWorkspaceTab) {
        if (event.key === "Home") {
            await selectWorkspaceTabAndFocus(evolutionTabOrder[0])
            event.preventDefault()
            return
        }

        if (event.key === "End") {
            await selectWorkspaceTabAndFocus(evolutionTabOrder[evolutionTabOrder.length - 1])
            event.preventDefault()
            return
        }

        const direction = getHorizontalDirection(event.key)
        if (direction === 0) {
            return
        }

        const currentIndex = evolutionTabOrder.indexOf(currentTab)
        const safeIndex = currentIndex >= 0 ? currentIndex : 0
        const nextIndex = (safeIndex + direction + evolutionTabOrder.length) % evolutionTabOrder.length
        await selectWorkspaceTabAndFocus(evolutionTabOrder[nextIndex])
        event.preventDefault()
    }

    $effect(() => {
        const character = currentCharacter
        if (!character || character.type === "group") {
            return
        }
        ensureCharacterEvolution(character)
    })

    async function persistCharacter() {
        const character = currentCharacter
        if (!character?.chaId) return
        await saveServerDatabase(DBState.db, {
            character: [character.chaId],
            chat: [],
        })
    }

    async function refreshVersions() {
        const character = currentCharacter
        if (!character || character.type === 'group' || !character.chaId) {
            return
        }
        loadingVersions = true
        try {
            const versions = await listCharacterEvolutionVersions(character.chaId)
            character.characterEvolution.stateVersions = versions
            if (selectedVersion !== null) {
                const version = await fetchCharacterEvolutionVersion(character.chaId, selectedVersion)
                selectedVersionState = version?.state ?? null
            }
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            loadingVersions = false
        }
    }

    async function loadVersion(version: number) {
        const character = currentCharacter
        if (!character || character.type === 'group' || !character.chaId) return
        loadingVersions = true
        try {
            selectedWorkspaceTab = EVOLUTION_HISTORY_TAB
            selectedVersion = version
            const payload = await fetchCharacterEvolutionVersion(character.chaId, version)
            selectedVersionState = payload?.state ?? null
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            loadingVersions = false
        }
    }

    async function rejectProposal() {
        const character = currentCharacter
        if (!character || character.type === 'group' || !character.chaId) return
        accepting = true
        try {
            await rejectCharacterEvolutionProposal(character.chaId)
            character.characterEvolution.pendingProposal = null
            proposalDraft = null
            alertNormal("Evolution proposal rejected.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            accepting = false
        }
    }

    function openGlobalDefaults() {
        OtherBotSettingsSubMenuIndex.set(3)
        SettingsMenuIndex.set(2)
        settingsOpen.set(true)
        window.setTimeout(() => {
            document.getElementById("character-evolution-defaults")?.scrollIntoView({
                block: "start",
                behavior: "smooth",
            })
        }, 0)
    }

    function usesOpenRouterModelSelector(provider: string) {
        return provider.trim().toLowerCase() === "openrouter"
    }

    async function acceptProposal(createNextChat = false) {
        const character = currentCharacter
        if (!character || character.type === 'group' || !character.chaId || !proposalDraft) return
        accepting = true
        try {
            const payload = await acceptCharacterEvolutionProposal(character.chaId, proposalDraft)
            character.characterEvolution.currentState = payload.state as typeof character.characterEvolution.currentState
            character.characterEvolution.currentStateVersion = Number(payload.version) || character.characterEvolution.currentStateVersion
            character.characterEvolution.pendingProposal = null
            proposalDraft = null
            selectedWorkspaceTab = EVOLUTION_STATE_TAB
            await refreshVersions()
            if (createNextChat) {
                await createNewChatAfterEvolution(Number($selectedCharID))
            }
            alertNormal(createNextChat ? "Evolution state accepted and a new chat was created." : "Evolution state accepted.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            accepting = false
        }
    }

    $effect(() => {
        const pendingProposal = evolutionSettings?.pendingProposal ?? null
        if (pendingProposal) {
            proposalDraft = JSON.parse(JSON.stringify(pendingProposal.proposedState))
            selectedWorkspaceTab = EVOLUTION_REVIEW_TAB
            return
        }
        proposalDraft = null
    })

    onMount(() => {
        void refreshVersions()
    })
</script>

    {#if currentCharacter?.type === 'group'}
        <div class="ds-settings-section ds-settings-card">
            <span class="ds-settings-label">Character evolution is not available for group chats.</span>
        </div>
{:else if !currentCharacter}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Select a single character to configure evolution.</span>
    </div>
{:else if evolutionSettings && currentCharacter.characterEvolution}
    <div class="ds-settings-section">
        <div
            class="evolution-subtabs seg-tabs"
            role="tablist"
            aria-label="Character evolution sections"
            tabindex="-1"
            onkeydown={(event) => {
                if (event.target !== event.currentTarget) {
                    return
                }
                handleEvolutionTabKeydown(event)
            }}
        >
            <button
                type="button"
                class="evolution-subtab seg-tab"
                class:active={selectedWorkspaceTab === EVOLUTION_SETUP_TAB}
                id="evolution-subtab-0"
                role="tab"
                aria-label={evolutionTabLabels[EVOLUTION_SETUP_TAB]}
                aria-selected={selectedWorkspaceTab === EVOLUTION_SETUP_TAB}
                aria-controls="evolution-panel-setup"
                tabindex={selectedWorkspaceTab === EVOLUTION_SETUP_TAB ? 0 : -1}
                onclick={() => selectWorkspaceTabAndFocus(EVOLUTION_SETUP_TAB)}
                onkeydown={(event) => handleEvolutionTabKeydown(event, EVOLUTION_SETUP_TAB)}
            >
                <Settings2Icon size={evolutionTabIconSize} />
            </button>
            <button
                type="button"
                class="evolution-subtab seg-tab"
                class:active={selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
                id="evolution-subtab-1"
                role="tab"
                aria-label={evolutionTabLabels[EVOLUTION_SECTIONS_TAB]}
                aria-selected={selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
                aria-controls="evolution-panel-sections"
                tabindex={selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB ? 0 : -1}
                onclick={() => selectWorkspaceTabAndFocus(EVOLUTION_SECTIONS_TAB)}
                onkeydown={(event) => handleEvolutionTabKeydown(event, EVOLUTION_SECTIONS_TAB)}
            >
                <SlidersHorizontalIcon size={evolutionTabIconSize} />
            </button>
            <button
                type="button"
                class="evolution-subtab seg-tab"
                class:active={selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
                id="evolution-subtab-2"
                role="tab"
                aria-label={evolutionTabLabels[EVOLUTION_REVIEW_TAB]}
                aria-selected={selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
                aria-controls="evolution-panel-review"
                tabindex={selectedWorkspaceTab === EVOLUTION_REVIEW_TAB ? 0 : -1}
                onclick={() => selectWorkspaceTabAndFocus(EVOLUTION_REVIEW_TAB)}
                onkeydown={(event) => handleEvolutionTabKeydown(event, EVOLUTION_REVIEW_TAB)}
            >
                <ClipboardCheckIcon size={evolutionTabIconSize} />
            </button>
            <button
                type="button"
                class="evolution-subtab seg-tab"
                class:active={selectedWorkspaceTab === EVOLUTION_STATE_TAB}
                id="evolution-subtab-3"
                role="tab"
                aria-label={evolutionTabLabels[EVOLUTION_STATE_TAB]}
                aria-selected={selectedWorkspaceTab === EVOLUTION_STATE_TAB}
                aria-controls="evolution-panel-state"
                tabindex={selectedWorkspaceTab === EVOLUTION_STATE_TAB ? 0 : -1}
                onclick={() => selectWorkspaceTabAndFocus(EVOLUTION_STATE_TAB)}
                onkeydown={(event) => handleEvolutionTabKeydown(event, EVOLUTION_STATE_TAB)}
            >
                <FileStackIcon size={evolutionTabIconSize} />
            </button>
            <button
                type="button"
                class="evolution-subtab seg-tab"
                class:active={selectedWorkspaceTab === EVOLUTION_HISTORY_TAB}
                id="evolution-subtab-4"
                role="tab"
                aria-label={evolutionTabLabels[EVOLUTION_HISTORY_TAB]}
                aria-selected={selectedWorkspaceTab === EVOLUTION_HISTORY_TAB}
                aria-controls="evolution-panel-history"
                tabindex={selectedWorkspaceTab === EVOLUTION_HISTORY_TAB ? 0 : -1}
                onclick={() => selectWorkspaceTabAndFocus(EVOLUTION_HISTORY_TAB)}
                onkeydown={(event) => handleEvolutionTabKeydown(event, EVOLUTION_HISTORY_TAB)}
            >
                <Clock3Icon size={evolutionTabIconSize} />
            </button>
        </div>
    </div>

    <div class="ds-settings-section">
        <h2 class="evolution-section-title">{selectedWorkspaceTitle}</h2>
    </div>

    {#if selectedWorkspaceTab === EVOLUTION_SETUP_TAB}
        <div class="ds-settings-section" role="tabpanel" id="evolution-panel-setup" aria-labelledby="evolution-subtab-0" tabindex="0">
            <div class="ds-settings-card evolution-setup-panel">
                <div class="ds-settings-section evolution-toggle-list">
                    <CheckInput bare={true} className="evolution-toggle-row" bind:check={currentCharacter.characterEvolution.enabled} name="Enable Character Evolution" />
                    <CheckInput bare={true} className="evolution-toggle-row" bind:check={currentCharacter.characterEvolution.useGlobalDefaults} name="Use Global Defaults" />
                </div>

                <div class="ds-settings-section evolution-runtime-summary">
                    <div class="evolution-runtime-header">
                        <span class="ds-settings-label">Extraction Runtime</span>
                        <span class="evolution-runtime-source">{usingGlobalDefaults ? "Global defaults" : "Character override"}</span>
                    </div>
                    <div class="evolution-runtime-grid">
                        <span class="ds-settings-label-muted-sm">Provider</span>
                        <span class="evolution-runtime-value">{effectiveProvider || "Not configured"}</span>
                        <span class="ds-settings-label-muted-sm">Model</span>
                        <span class="evolution-runtime-value">{effectiveModel || "Not configured"}</span>
                        <span class="ds-settings-label-muted-sm">Max response tokens</span>
                        <span class="evolution-runtime-value">{evolutionSettings.extractionMaxTokens || 2400}</span>
                    </div>
                    {#if usingGlobalDefaults}
                        <span class="ds-settings-label-muted-sm">
                            Global defaults are active. Extraction provider, model, prompt, privacy, and tracked sections are inherited from Other Bots -> Evolution.
                        </span>
                    {/if}
                </div>

                {#if usingGlobalDefaults}
                    <div class="ds-settings-section">
                        <div class="ds-settings-inline-actions action-rail">
                            <Button styled="outlined" onclick={openGlobalDefaults}>Open Global Defaults</Button>
                            <Button styled="outlined" onclick={() => {
                                revealCharacterOverrides = !revealCharacterOverrides
                            }}>
                                {revealCharacterOverrides ? "Hide Character Overrides" : "Show Character Overrides"}
                            </Button>
                        </div>
                    </div>
                {/if}

                {#if !usingGlobalDefaults || revealCharacterOverrides}
                    <div class="ds-settings-section">
                    <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Provider" : "Extraction Provider"}</span>
                    <ModelList bind:value={currentCharacter.characterEvolution.extractionProvider} mode="provider" disabled={usingGlobalDefaults} />
                    {#if usesOpenRouterModelSelector(currentCharacter.characterEvolution.extractionProvider)}
                        <OpenRouterModelSelect
                            bind:value={currentCharacter.characterEvolution.extractionModel}
                            label={usingGlobalDefaults ? "Character Override Model" : "Extraction Model"}
                            disabled={usingGlobalDefaults}
                        />
                    {:else}
                        <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Model" : "Extraction Model"}</span>
                        <TextInput bind:value={currentCharacter.characterEvolution.extractionModel} placeholder="anthropic/claude-3.5-haiku" disabled={usingGlobalDefaults} list="character-evolution-model-options" />
                    {/if}
                    <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Max Response Tokens" : "Extraction Max Response Tokens"}</span>
                    <NumberInput bind:value={currentCharacter.characterEvolution.extractionMaxTokens} min={64} disabled={usingGlobalDefaults} placeholder="2400" />
                    <span class="ds-settings-label-muted-sm">Caps only the extractor response. Evolution does not currently enforce a separate transcript/context limit.</span>
                    <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Prompt" : "Extraction Prompt Override"}</span>
                    <TextAreaInput bind:value={currentCharacter.characterEvolution.extractionPrompt} height="32" disabled={usingGlobalDefaults} />
                    <span class="ds-settings-label-muted-sm">This prompt is used only for the extraction/update pass, not for live roleplay prompting.</span>
                    <div class="ds-settings-grid-two">
                        <CheckInput bind:check={currentCharacter.characterEvolution.privacy.allowCharacterIntimatePreferences} name="Allow Character Intimate Preferences" disabled={usingGlobalDefaults} />
                        <CheckInput bind:check={currentCharacter.characterEvolution.privacy.allowUserIntimatePreferences} name="Allow User Intimate Preferences" disabled={usingGlobalDefaults} />
                    </div>
                    {#if usingGlobalDefaults}
                        <span class="ds-settings-label-muted-sm">Turn off `Use Global Defaults` to edit these character-specific fields.</span>
                    {/if}
                    </div>
                {/if}

                <div class="ds-settings-section">
                    {#if currentCharacter.characterEvolution.enabled && !hasTemplateSlot}
                        <span class="ds-settings-note-danger">Evolution is enabled, but the active prompt template does not include a `characterState` block.</span>
                    {/if}
                    <div class="ds-settings-inline-actions action-rail evolution-setup-actions">
                        <Button styled="outlined" onclick={persistCharacter}>Save Evolution Settings</Button>
                        <Button styled="outlined" onclick={refreshVersions} disabled={loadingVersions}>Refresh Versions</Button>
                    </div>
                </div>
            </div>
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_SECTIONS_TAB}
        <div role="tabpanel" id="evolution-panel-sections" aria-labelledby="evolution-subtab-1" tabindex="0">
            <SectionConfigEditor bind:value={currentCharacter.characterEvolution.sectionConfigs} privacy={currentCharacter.characterEvolution.privacy} readonly={usingGlobalDefaults} />
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_REVIEW_TAB}
        <div role="tabpanel" id="evolution-panel-review" aria-labelledby="evolution-subtab-2" tabindex="0">
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
                    <span class="ds-settings-label-muted-sm">No pending evolution proposal. Run a chat handoff to review a new state update here.</span>
                </div>
            </div>
        {/if}
        </div>
    {:else if selectedWorkspaceTab === EVOLUTION_STATE_TAB}
        <div role="tabpanel" id="evolution-panel-state" aria-labelledby="evolution-subtab-3" tabindex="0">
        {#if evolutionSettings.pendingProposal}
            <div class="ds-settings-section">
                <div class="ds-settings-card ds-settings-card-stack-start">
                    <span class="ds-settings-label">Current State</span>
                    <span class="ds-settings-label-muted-sm">Resolve the pending proposal before editing the accepted state directly.</span>
                </div>
            </div>
        {:else}
            <StateEditor bind:value={currentCharacter.characterEvolution.currentState} sectionConfigs={evolutionSettings.sectionConfigs} privacy={evolutionSettings.privacy} title="Current State" />
            <div class="ds-settings-section">
                <div class="ds-settings-inline-actions action-rail">
                    <Button styled="outlined" onclick={persistCharacter}>Save Current State</Button>
                </div>
            </div>
        {/if}
        </div>
    {:else}
        <div class="ds-settings-section" role="tabpanel" id="evolution-panel-history" aria-labelledby="evolution-subtab-4" tabindex="0">
            <span class="ds-settings-label">Version History</span>
            <div class="ds-settings-card ds-settings-list-shell">
                {#if currentCharacter.characterEvolution.stateVersions.length === 0}
                    <span class="ds-settings-label-muted-sm">No accepted versions yet.</span>
                {/if}
                {#each currentCharacter.characterEvolution.stateVersions as version (version.version)}
                    <div class="ds-settings-inline-actions action-rail ds-settings-inline-actions-space-between">
                        <span class="ds-settings-label">v{version.version} {version.chatId ? `after ${version.chatId}` : ""}</span>
                        <Button size="sm" styled="outlined" onclick={() => loadVersion(version.version)} disabled={loadingVersions}>View</Button>
                    </div>
                {/each}
            </div>
        </div>

        {#if selectedVersion !== null && selectedVersionState}
            <StateEditor value={selectedVersionState} sectionConfigs={evolutionSettings.sectionConfigs} privacy={evolutionSettings.privacy} readonly={true} title={`Version v${selectedVersion}`} />
        {/if}
    {/if}
    <datalist id="character-evolution-model-options">
        {#each CHARACTER_EVOLUTION_MODEL_SUGGESTIONS as model (model)}
            <option value={model}></option>
        {/each}
    </datalist>
{/if}

<style>
    .evolution-setup-panel {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .evolution-toggle-list {
        gap: var(--ds-space-3);
    }

    :global(.evolution-toggle-row) {
        width: 100%;
        min-height: var(--ds-height-control-sm);
        justify-content: flex-start;
        font-size: var(--ds-font-size-lg);
    }

    .evolution-runtime-summary {
        gap: var(--ds-space-3);
        padding-block: var(--ds-space-3);
        border-block: 1px solid var(--ds-border-subtle);
    }

    .evolution-runtime-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    .evolution-runtime-source {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .evolution-runtime-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: var(--ds-space-2) var(--ds-space-4);
        align-items: baseline;
    }

    .evolution-runtime-value {
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-md);
    }

    .evolution-setup-actions {
        align-items: center;
    }

    .evolution-subtabs {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        align-items: center;
        gap: 2px;
        padding: 4px;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        overflow: hidden;
    }

    .evolution-subtab {
        width: 100%;
        min-width: 0;
        height: 32px;
        min-height: 32px;
        padding: 0;
        border: 0;
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .evolution-subtab:hover {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .evolution-subtab.active {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .evolution-section-title {
        margin: 0;
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-semibold);
        color: var(--ds-text-primary);
    }

    :global(.evolution-subtab :global(svg)) {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
    }

    @media (min-width: 1400px) {
        .evolution-subtab {
            height: 36px;
            min-height: 36px;
        }

        :global(.evolution-subtab :global(svg)) {
            width: 20px;
            height: 20px;
        }
    }

    @media (max-width: 640px) {
        .evolution-runtime-grid {
            grid-template-columns: 1fr;
            gap: 2px;
        }
    }
</style>
