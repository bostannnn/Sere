<script lang="ts">
    import { DBState, EvolutionDefaultsSettingsTabIndex } from "src/ts/stores.svelte";
    import {
        ensureDatabaseEvolutionDefaults,
        getCharacterEvolutionModelSuggestions,
        normalizeCharacterEvolutionExtractionModel,
    } from "src/ts/characterEvolution";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte";
    import ProjectionPolicyEditor from "src/lib/Evolution/ProjectionPolicyEditor.svelte";
    import RetentionPolicyEditor from "src/lib/Evolution/RetentionPolicyEditor.svelte";
    import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";

    const evolutionSettingsTabs = [
        { id: 0, label: "Global Defaults" },
        { id: 1, label: "Prompt Projection" },
        { id: 2, label: "Retention" },
    ] as const;

    let selectedTab = $state(0);

    $effect(() => {
        ensureDatabaseEvolutionDefaults(DBState.db)
    })

    $effect(() => {
        const defaults = DBState.db.characterEvolutionDefaults
        if (!defaults) {
            return
        }

        const normalizedModel = normalizeCharacterEvolutionExtractionModel(
            defaults.extractionProvider,
            defaults.extractionModel,
        )
        if (defaults.extractionModel !== normalizedModel) {
            defaults.extractionModel = normalizedModel
        }
    })

    $effect(() => {
        const requestedTab = $EvolutionDefaultsSettingsTabIndex
        if (requestedTab === null) {
            return
        }
        if ((requestedTab === 0 || requestedTab === 1 || requestedTab === 2) && selectedTab !== requestedTab) {
            selectedTab = requestedTab
        }
        EvolutionDefaultsSettingsTabIndex.set(null)
    })

    function usesOpenRouterModelSelector(provider: string) {
        return provider.trim().toLowerCase() === "openrouter";
    }

    function setDefaultPrivacyFlag(
        key: "allowCharacterIntimatePreferences" | "allowUserIntimatePreferences",
        value: boolean,
    ) {
        if (!DBState.db.characterEvolutionDefaults) {
            return
        }

        DBState.db.characterEvolutionDefaults = {
            ...DBState.db.characterEvolutionDefaults,
            privacy: {
                ...DBState.db.characterEvolutionDefaults.privacy,
                [key]: value,
            },
        }
    }

    const modelSuggestions = $derived(
        getCharacterEvolutionModelSuggestions(DBState.db.characterEvolutionDefaults?.extractionProvider ?? "openrouter")
    );
</script>

{#if DBState.db.characterEvolutionDefaults}
    <div class="ds-settings-section evolution-defaults-page" id="character-evolution-defaults">
        <h3 class="evolution-defaults-title">Character Evolution Defaults</h3>
        <span class="ds-settings-label-muted-sm evolution-defaults-lead">
            Used when a character has evolution enabled and `Use Global Defaults` is on.
        </span>

        <SettingsSubTabs
            className="evolution-defaults-tabs"
            items={[...evolutionSettingsTabs]}
            selectedId={selectedTab}
            onSelect={(id) => {
                selectedTab = id;
            }}
        />

        {#if selectedTab === 0}
            <div class="evolution-defaults-panel">
                <div class="evolution-defaults-runtime-card">
                    <div class="ds-settings-section">
                        <span class="ds-settings-label">Extraction Runtime</span>
                        <span class="ds-settings-label-muted-sm">
                            These defaults drive the extraction/update model only. Live prompt injection still uses the `characterState` prompt block.
                        </span>

                        <span class="ds-settings-label">Extraction Provider</span>
                        <ModelList bind:value={DBState.db.characterEvolutionDefaults.extractionProvider} mode="provider" />

                        {#if usesOpenRouterModelSelector(DBState.db.characterEvolutionDefaults.extractionProvider)}
                            <OpenRouterModelSelect bind:value={DBState.db.characterEvolutionDefaults.extractionModel} label="Extraction Model" />
                        {:else}
                            <span class="ds-settings-label">Extraction Model</span>
                            <TextInput
                                bind:value={DBState.db.characterEvolutionDefaults.extractionModel}
                                placeholder={modelSuggestions[0] ?? "Model id"}
                                list="character-evolution-default-model-options"
                            />
                        {/if}

                        <span class="ds-settings-label">Extraction Max Response Tokens</span>
                        <NumberInput bind:value={DBState.db.characterEvolutionDefaults.extractionMaxTokens} min={64} placeholder="2400" />
                        <span class="ds-settings-label-muted-sm">
                            Caps only the extractor response length. Evolution currently does not have a separate transcript/context limit.
                        </span>

                        <span class="ds-settings-label">Extraction Prompt</span>
                        <TextAreaInput bind:value={DBState.db.characterEvolutionDefaults.extractionPrompt} height="32" />
                    </div>

                    <div class="ds-settings-divider"></div>

                    <div class="ds-settings-section">
                        <span class="ds-settings-label">Privacy</span>
                        <div class="evolution-defaults-toggle-list">
                            <CheckInput
                                bare={true}
                                className="evolution-defaults-toggle-row"
                                check={DBState.db.characterEvolutionDefaults.privacy.allowCharacterIntimatePreferences}
                                onChange={(value) => setDefaultPrivacyFlag("allowCharacterIntimatePreferences", value)}
                                name="Allow Character Intimate Preferences"
                            />
                            <CheckInput
                                bare={true}
                                className="evolution-defaults-toggle-row"
                                check={DBState.db.characterEvolutionDefaults.privacy.allowUserIntimatePreferences}
                                onChange={(value) => setDefaultPrivacyFlag("allowUserIntimatePreferences", value)}
                                name="Allow User Intimate Preferences"
                            />
                        </div>
                    </div>
                </div>

                <SectionConfigEditor bind:value={DBState.db.characterEvolutionDefaults.sectionConfigs} privacy={DBState.db.characterEvolutionDefaults.privacy} title="Default Sections" />
            </div>
        {:else if selectedTab === 1}
            <div class="evolution-defaults-panel">
                <span class="ds-settings-label-muted-sm evolution-defaults-panel-copy">
                    Phase 4.5 prompt projection controls how much accepted active state is surfaced to generation and extraction prompts.
                </span>
                <ProjectionPolicyEditor bind:value={DBState.db.characterEvolutionDefaults.promptProjection} />
            </div>
        {:else}
            <div class="evolution-defaults-panel">
                <span class="ds-settings-label-muted-sm evolution-defaults-panel-copy">
                    Retention controls accepted-state lifecycle in canonical storage: archive timing, stale non-active deletion, and optional stored caps.
                </span>
                <RetentionPolicyEditor bind:value={DBState.db.characterEvolutionDefaults.retention} />
            </div>
        {/if}
    </div>
    <datalist id="character-evolution-default-model-options">
        {#each modelSuggestions as model (model)}
            <option value={model}></option>
        {/each}
    </datalist>
{/if}

<style>
    .evolution-defaults-page {
        gap: var(--ds-space-4);
    }

    :global(.evolution-defaults-tabs) {
        width: 100%;
    }

    .evolution-defaults-title {
        margin: 0;
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-semibold);
        color: var(--ds-text-primary);
    }

    .evolution-defaults-lead {
        max-width: 64ch;
    }

    .evolution-defaults-panel {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .evolution-defaults-panel-copy {
        max-width: 68ch;
    }

    .evolution-defaults-runtime-card {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        padding-block: var(--ds-space-1);
    }

    .evolution-defaults-toggle-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
    }

    :global(.evolution-defaults-toggle-row) {
        width: 100%;
        min-height: var(--ds-height-control-sm);
        justify-content: flex-start;
    }
</style>
