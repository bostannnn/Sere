<script lang="ts">
    import { DBState, EvolutionDefaultsSettingsTabIndex } from "src/ts/stores.svelte";
    import {
        BUILTIN_SECTION_DEFS,
        CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS,
        ensureDatabaseEvolutionDefaults,
        getCharacterEvolutionModelSuggestions,
        normalizeCharacterEvolutionExtractionModel,
    } from "src/ts/characterEvolution";
    import { DEFAULT_EXTRACTION_PROMPT } from "src/ts/character-evolution/constants";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import EmbeddingModelSelect from "src/lib/UI/GUI/EmbeddingModelSelect.svelte";
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
        { id: 3, label: "Semantic Recall" },
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
        if ((requestedTab === 0 || requestedTab === 1 || requestedTab === 2 || requestedTab === 3) && selectedTab !== requestedTab) {
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
    const semanticRecallSections = $derived(
        CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS.map((key) => ({
            key,
            label: BUILTIN_SECTION_DEFS.find((section) => section.key === key)?.label ?? key,
        }))
    );

    let showDefaultPrompt = $state(false);
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
                            These defaults drive the extraction/update model only. Live prompt injection uses the evolution prompt blocks in the active template, such as `characterState`, `userState`, and `relationshipState`.
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
                        <TextAreaInput bind:value={DBState.db.characterEvolutionDefaults.extractionPrompt} height="32" placeholder="Leave empty to use built-in default prompt" />
                        {#if !DBState.db.characterEvolutionDefaults.extractionPrompt}
                            <span class="ds-settings-label-muted-sm">Using built-in default prompt.</span>
                            <button class="evolution-defaults-toggle-link" onclick={() => showDefaultPrompt = !showDefaultPrompt}>
                                {showDefaultPrompt ? "Hide default prompt" : "Show default prompt"}
                            </button>
                            {#if showDefaultPrompt}
                                <pre class="evolution-defaults-prompt-preview">{DEFAULT_EXTRACTION_PROMPT}</pre>
                            {/if}
                        {/if}
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
        {:else if selectedTab === 2}
            <div class="evolution-defaults-panel">
                <span class="ds-settings-label-muted-sm evolution-defaults-panel-copy">
                    Retention controls accepted-state lifecycle in canonical storage: archive timing, stale non-active deletion, and optional stored caps.
                </span>
                <RetentionPolicyEditor bind:value={DBState.db.characterEvolutionDefaults.retention} />
            </div>
        {:else}
            <div class="evolution-defaults-panel">
                <span class="ds-settings-label-muted-sm evolution-defaults-panel-copy">
                    Semantic recall retrieves archived Character Evolution facts from accepted history at generation time. V1 is server-authoritative, chat-scoped, and archived-only.
                </span>

                <div class="ds-settings-section">
                    <CheckInput
                        bare={true}
                        className="evolution-defaults-toggle-row"
                        check={DBState.db.characterEvolutionDefaults.semanticRecall.enabled}
                        onChange={(value) => {
                            DBState.db.characterEvolutionDefaults.semanticRecall.enabled = value;
                        }}
                        name="Enable Semantic Recall"
                    />

                    <span class="ds-settings-label">Embedding Model</span>
                    <EmbeddingModelSelect bind:value={DBState.db.characterEvolutionDefaults.semanticRecall.embeddingModel} />

                    <span class="ds-settings-label">Minimum Similarity Score</span>
                    <NumberInput bind:value={DBState.db.characterEvolutionDefaults.semanticRecall.minScore} min={0} max={1} />

                    <span class="ds-settings-label">Max Recalled Items Per Prompt</span>
                    <NumberInput bind:value={DBState.db.characterEvolutionDefaults.semanticRecall.maxItems} min={1} />

                    <span class="ds-settings-label">Query Message Window</span>
                    <NumberInput bind:value={DBState.db.characterEvolutionDefaults.semanticRecall.queryMessageWindow} min={1} />
                </div>

                <div class="ds-settings-divider"></div>

                <div class="ds-settings-section">
                    <span class="ds-settings-label">Semantic Recall Sections</span>
                    <span class="ds-settings-label-muted-sm">
                        These categories are eligible for archived semantic recall. Active canon still comes from the live evolution prompt blocks. Optional per-section limits let you cap how many recalled items each category may contribute.
                    </span>
                    <div class="evolution-defaults-toggle-list">
                        {#each semanticRecallSections as section (section.key)}
                            <div class="evolution-semantic-recall-section-row">
                                <CheckInput
                                    bare={true}
                                    className="evolution-defaults-toggle-row"
                                    check={DBState.db.characterEvolutionDefaults.semanticRecall.sections[section.key]}
                                    onChange={(value) => {
                                        DBState.db.characterEvolutionDefaults.semanticRecall.sections[section.key] = value;
                                    }}
                                    name={section.label}
                                />
                                <div class="evolution-semantic-recall-limit">
                                    <span class="ds-settings-label-muted-sm">Per-section max</span>
                                    <NumberInput
                                        bind:value={DBState.db.characterEvolutionDefaults.semanticRecall.sectionLimits[section.key]}
                                        min={0}
                                        disabled={!DBState.db.characterEvolutionDefaults.semanticRecall.sections[section.key]}
                                    />
                                </div>
                            </div>
                        {/each}
                    </div>
                    <span class="ds-settings-label-muted-sm">
                        Set `0` to keep the default balancing behavior for that section.
                    </span>
                </div>
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

    .evolution-semantic-recall-section-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 140px;
        gap: var(--ds-space-3);
        align-items: center;
    }

    .evolution-semantic-recall-limit {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }

    :global(.evolution-defaults-toggle-row) {
        width: 100%;
        min-height: var(--ds-height-control-sm);
        justify-content: flex-start;
    }

    .evolution-defaults-toggle-link {
        all: unset;
        cursor: pointer;
        color: var(--ds-text-link, var(--ds-text-secondary));
        font-size: var(--ds-font-size-sm);
        text-decoration: underline;
        text-underline-offset: 2px;
    }

    .evolution-defaults-toggle-link:hover {
        color: var(--ds-text-primary);
    }

    .evolution-defaults-prompt-preview {
        margin: 0;
        padding: var(--ds-space-3);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm, 4px);
        background: var(--ds-surface-secondary, rgba(0,0,0,0.05));
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 24rem;
        overflow-y: auto;
    }

    @media (max-width: 640px) {
        .evolution-semantic-recall-section-row {
            grid-template-columns: 1fr;
        }
    }
</style>
