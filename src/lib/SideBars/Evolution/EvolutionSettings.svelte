<script lang="ts">
    import { onMount } from "svelte";
    import ProposalPanel from "src/lib/Evolution/ProposalPanel.svelte";
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte";
    import StateEditor from "src/lib/Evolution/StateEditor.svelte";
    import { alertError, alertNormal } from "src/ts/alert";
    import {
        ensureCharacterEvolution,
        getEffectiveCharacterEvolutionSettings,
        hasCharacterStateTemplateBlock,
    } from "src/ts/characterEvolution";
    import {
        acceptCharacterEvolutionProposal,
        fetchCharacterEvolutionVersion,
        getCharacterEvolutionErrorMessage,
        listCharacterEvolutionVersions,
        rejectCharacterEvolutionProposal,
    } from "src/ts/evolution";
    import { saveServerDatabase } from "src/ts/storage/serverDb";
    import { DBState, selectedCharID } from "src/ts/stores.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";

    let loadingVersions = $state(false)
    let accepting = $state(false)
    let selectedVersion = $state<number | null>(null)
    let selectedVersionState = $state(null)
    let proposalDraft = $state(null)

    const currentCharacter = $derived(DBState.db.characters[$selectedCharID] ?? null)
    const evolutionSettings = $derived.by(() => {
        const character = currentCharacter
        if (!character || character.type === 'group') {
            return null
        }
        return getEffectiveCharacterEvolutionSettings(DBState.db, character)
    })
    const hasTemplateSlot = $derived(hasCharacterStateTemplateBlock(DBState.db))
    const usingGlobalDefaults = $derived(evolutionSettings?.useGlobalDefaults ?? true)

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
            await persistCharacter()
            alertNormal("Evolution proposal rejected.")
        } catch (error) {
            alertError(getCharacterEvolutionErrorMessage(error))
        } finally {
            accepting = false
        }
    }

    async function acceptProposal() {
        const character = currentCharacter
        if (!character || character.type === 'group' || !character.chaId || !proposalDraft) return
        accepting = true
        try {
            const payload = await acceptCharacterEvolutionProposal(character.chaId, proposalDraft)
            character.characterEvolution.currentState = payload.state as typeof character.characterEvolution.currentState
            character.characterEvolution.currentStateVersion = Number(payload.version) || character.characterEvolution.currentStateVersion
            character.characterEvolution.pendingProposal = null
            proposalDraft = null
            await refreshVersions()
            await persistCharacter()
            alertNormal("Evolution state accepted.")
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
        }
    })

    onMount(() => {
        void refreshVersions()
    })
</script>

{#if currentCharacter?.type === 'group'}
    <div class="ds-settings-section ds-settings-card">
        <span class="ds-settings-label">Character evolution is not available for group chats.</span>
    </div>
{:else if evolutionSettings && currentCharacter.characterEvolution}
    <div class="ds-settings-section">
        <span class="ds-settings-label">Character Evolution</span>
        <div class="ds-settings-card ds-settings-card-stack-start">
            <CheckInput bind:check={currentCharacter.characterEvolution.enabled} name="Enable Character Evolution" />
            <CheckInput bind:check={currentCharacter.characterEvolution.useGlobalDefaults} name="Use Global Defaults" />
            <span class="ds-settings-label">Extraction Provider</span>
            <TextInput bind:value={currentCharacter.characterEvolution.extractionProvider} placeholder="openrouter" disabled={usingGlobalDefaults} />
            <span class="ds-settings-label">Extraction Model</span>
            <TextInput bind:value={currentCharacter.characterEvolution.extractionModel} placeholder="anthropic/claude-3.5-haiku" disabled={usingGlobalDefaults} />
            <span class="ds-settings-label">Extraction Prompt Override</span>
            <TextAreaInput bind:value={currentCharacter.characterEvolution.extractionPrompt} height="32" disabled={usingGlobalDefaults} />
            <div class="ds-settings-grid-two">
                <CheckInput bind:check={currentCharacter.characterEvolution.privacy.allowCharacterIntimatePreferences} name="Allow Character Intimate Preferences" disabled={usingGlobalDefaults} />
                <CheckInput bind:check={currentCharacter.characterEvolution.privacy.allowUserIntimatePreferences} name="Allow User Intimate Preferences" disabled={usingGlobalDefaults} />
            </div>
            {#if usingGlobalDefaults}
                <span class="ds-settings-label-muted-sm">Global defaults are active. Turn off `Use Global Defaults` to edit character-specific extraction settings.</span>
            {/if}
            {#if currentCharacter.characterEvolution.enabled && !hasTemplateSlot}
                <span class="ds-settings-note-danger">Evolution is enabled, but the active prompt template does not include a `characterState` block.</span>
            {/if}
            <div class="ds-settings-inline-actions action-rail">
                <Button styled="outlined" onclick={persistCharacter}>Save Evolution Settings</Button>
                <Button styled="outlined" onclick={refreshVersions} disabled={loadingVersions}>Refresh Versions</Button>
            </div>
        </div>
    </div>

    <SectionConfigEditor bind:value={currentCharacter.characterEvolution.sectionConfigs} privacy={currentCharacter.characterEvolution.privacy} readonly={usingGlobalDefaults} />

    <ProposalPanel
        proposal={evolutionSettings.pendingProposal}
        currentState={evolutionSettings.currentState}
        sectionConfigs={evolutionSettings.sectionConfigs}
        privacy={evolutionSettings.privacy}
        bind:bindState={proposalDraft}
        onAccept={acceptProposal}
        onAcceptAndCreate={acceptProposal}
        onReject={rejectProposal}
        loading={accepting}
        showCreateButton={false}
    />

    {#if !evolutionSettings.pendingProposal}
        <StateEditor bind:value={currentCharacter.characterEvolution.currentState} sectionConfigs={evolutionSettings.sectionConfigs} privacy={evolutionSettings.privacy} title="Current State" />
        <div class="ds-settings-section">
            <div class="ds-settings-inline-actions action-rail">
                <Button styled="outlined" onclick={persistCharacter}>Save Current State</Button>
            </div>
        </div>
    {/if}

    <div class="ds-settings-section">
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
