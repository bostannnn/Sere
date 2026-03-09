<script lang="ts">
    import { DBState } from "src/ts/stores.svelte";
    import {
        CHARACTER_EVOLUTION_MODEL_SUGGESTIONS,
        ensureDatabaseEvolutionDefaults,
    } from "src/ts/characterEvolution";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import ModelList from "src/lib/UI/ModelList.svelte";
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import SectionConfigEditor from "src/lib/Evolution/SectionConfigEditor.svelte";

    $effect(() => {
        ensureDatabaseEvolutionDefaults(DBState.db)
    })

    function usesOpenRouterModelSelector(provider: string) {
        return provider.trim().toLowerCase() === "openrouter";
    }
</script>

{#if DBState.db.characterEvolutionDefaults}
    <div class="ds-settings-section evolution-defaults-page" id="character-evolution-defaults">
        <h3 class="evolution-defaults-title">Character Evolution Defaults</h3>
        <span class="ds-settings-label-muted-sm evolution-defaults-lead">
            Used when a character has evolution enabled and `Use Global Defaults` is on.
        </span>

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
                    <TextInput bind:value={DBState.db.characterEvolutionDefaults.extractionModel} placeholder="anthropic/claude-3.5-haiku" list="character-evolution-default-model-options" />
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
                    <CheckInput bare={true} className="evolution-defaults-toggle-row" bind:check={DBState.db.characterEvolutionDefaults.privacy.allowCharacterIntimatePreferences} name="Allow Character Intimate Preferences" />
                    <CheckInput bare={true} className="evolution-defaults-toggle-row" bind:check={DBState.db.characterEvolutionDefaults.privacy.allowUserIntimatePreferences} name="Allow User Intimate Preferences" />
                </div>
            </div>
        </div>

        <SectionConfigEditor bind:value={DBState.db.characterEvolutionDefaults.sectionConfigs} privacy={DBState.db.characterEvolutionDefaults.privacy} title="Default Sections" />
    </div>
    <datalist id="character-evolution-default-model-options">
        {#each CHARACTER_EVOLUTION_MODEL_SUGGESTIONS as model (model)}
            <option value={model}></option>
        {/each}
    </datalist>
{/if}

<style>
    .evolution-defaults-page {
        gap: var(--ds-space-4);
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
