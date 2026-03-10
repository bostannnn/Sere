<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte"
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte"
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import ModelList from "src/lib/UI/ModelList.svelte"
    import { CHARACTER_EVOLUTION_MODEL_SUGGESTIONS } from "src/ts/characterEvolution"
    import type { CharacterEvolutionSettings, character as CharacterEntry } from "src/ts/storage/database.types"

    interface Props {
        characterEntry: CharacterEntry
        evolutionSettings: CharacterEvolutionSettings
        usingGlobalDefaults: boolean
        effectiveProvider: string
        effectiveModel: string
        hasTemplateSlot: boolean
        loadingVersions: boolean
        revealCharacterOverrides: boolean
        onToggleRevealCharacterOverrides: () => void
        onOpenGlobalDefaults: () => void
        onPersistCharacter: () => void | Promise<void>
        onRefreshVersions: () => void | Promise<void>
    }

    let {
        characterEntry,
        evolutionSettings,
        usingGlobalDefaults,
        effectiveProvider,
        effectiveModel,
        hasTemplateSlot,
        loadingVersions,
        revealCharacterOverrides,
        onToggleRevealCharacterOverrides,
        onOpenGlobalDefaults,
        onPersistCharacter,
        onRefreshVersions,
    }: Props = $props()

    function usesOpenRouterModelSelector(provider: string) {
        return provider.trim().toLowerCase() === "openrouter"
    }
</script>

<div class="ds-settings-card evolution-setup-panel">
    <div class="ds-settings-section evolution-toggle-list">
        <CheckInput bare={true} className="evolution-toggle-row" bind:check={characterEntry.characterEvolution.enabled} name="Enable Character Evolution" />
        <CheckInput bare={true} className="evolution-toggle-row" bind:check={characterEntry.characterEvolution.useGlobalDefaults} name="Use Global Defaults" />
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
                <Button styled="outlined" onclick={onOpenGlobalDefaults}>Open Global Defaults</Button>
                <Button styled="outlined" onclick={onToggleRevealCharacterOverrides}>
                    {revealCharacterOverrides ? "Hide Character Overrides" : "Show Character Overrides"}
                </Button>
            </div>
        </div>
    {/if}

    {#if !usingGlobalDefaults || revealCharacterOverrides}
        <div class="ds-settings-section">
            <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Provider" : "Extraction Provider"}</span>
            <ModelList bind:value={characterEntry.characterEvolution.extractionProvider} mode="provider" disabled={usingGlobalDefaults} />

            {#if usesOpenRouterModelSelector(characterEntry.characterEvolution.extractionProvider)}
                <OpenRouterModelSelect
                    bind:value={characterEntry.characterEvolution.extractionModel}
                    label={usingGlobalDefaults ? "Character Override Model" : "Extraction Model"}
                    disabled={usingGlobalDefaults}
                />
            {:else}
                <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Model" : "Extraction Model"}</span>
                <TextInput
                    bind:value={characterEntry.characterEvolution.extractionModel}
                    placeholder="anthropic/claude-3.5-haiku"
                    disabled={usingGlobalDefaults}
                    list="character-evolution-model-options"
                />
            {/if}

            <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Max Response Tokens" : "Extraction Max Response Tokens"}</span>
            <NumberInput bind:value={characterEntry.characterEvolution.extractionMaxTokens} min={64} disabled={usingGlobalDefaults} placeholder="2400" />

            <span class="ds-settings-label-muted-sm">
                Caps only the extractor response. Evolution does not currently enforce a separate transcript/context limit.
            </span>

            <span class="ds-settings-label">{usingGlobalDefaults ? "Character Override Prompt" : "Extraction Prompt Override"}</span>
            <TextAreaInput bind:value={characterEntry.characterEvolution.extractionPrompt} height="32" disabled={usingGlobalDefaults} />

            <span class="ds-settings-label-muted-sm">
                This prompt is used only for the extraction/update pass, not for live roleplay prompting.
            </span>

            <div class="ds-settings-grid-two">
                <CheckInput bind:check={characterEntry.characterEvolution.privacy.allowCharacterIntimatePreferences} name="Allow Character Intimate Preferences" disabled={usingGlobalDefaults} />
                <CheckInput bind:check={characterEntry.characterEvolution.privacy.allowUserIntimatePreferences} name="Allow User Intimate Preferences" disabled={usingGlobalDefaults} />
            </div>

            {#if usingGlobalDefaults}
                <span class="ds-settings-label-muted-sm">
                    Turn off `Use Global Defaults` to edit these character-specific fields.
                </span>
            {/if}
        </div>
    {/if}

    <div class="ds-settings-section">
        {#if characterEntry.characterEvolution.enabled && !hasTemplateSlot}
            <span class="ds-settings-note-danger">
                Evolution is enabled, but the active prompt template does not include a `characterState` block.
            </span>
        {/if}

        <div class="ds-settings-inline-actions action-rail evolution-setup-actions">
            <Button styled="outlined" onclick={onPersistCharacter}>Save Evolution Settings</Button>
            <Button styled="outlined" onclick={onRefreshVersions} disabled={loadingVersions}>Refresh Versions</Button>
        </div>
    </div>
</div>

<datalist id="character-evolution-model-options">
    {#each CHARACTER_EVOLUTION_MODEL_SUGGESTIONS as model (model)}
        <option value={model}></option>
    {/each}
</datalist>

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

    @media (max-width: 640px) {
        .evolution-runtime-grid {
            grid-template-columns: 1fr;
            gap: 2px;
        }
    }
</style>
