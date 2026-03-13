<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte"
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte"
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte"
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte"
    import TextInput from "src/lib/UI/GUI/TextInput.svelte"
    import ModelList from "src/lib/UI/ModelList.svelte"
    import {
        getCharacterEvolutionModelSuggestions,
        normalizeCharacterEvolutionExtractionModel,
    } from "src/ts/characterEvolution"
    import type { CharacterEvolutionSettings, character as CharacterEntry } from "src/ts/storage/database.types"

    interface Props {
        characterEntry: CharacterEntry
        evolutionSettings: CharacterEvolutionSettings
        usingGlobalDefaults: boolean
        effectiveProvider: string
        effectiveModel: string
        hasTemplateSlot: boolean
        activeChatId?: string | null
        activeChatMessageCount?: number
        revealCharacterOverrides: boolean
        onToggleRevealCharacterOverrides: () => void
        onOpenGlobalDefaults: () => void
        manualRangeAvailable?: boolean
        manualRangeBlockedReason?: string
        manualRangeBusy?: boolean
        onRunManualRange?: (startMessageNumber: number, endMessageNumber: number) => void | Promise<void>
        replayCurrentChatAvailable?: boolean
        replayCurrentChatBusy?: boolean
        onReplayCurrentChat?: () => void | Promise<void>
    }

    let {
        characterEntry,
        evolutionSettings,
        usingGlobalDefaults,
        effectiveProvider,
        effectiveModel,
        hasTemplateSlot,
        activeChatId = null,
        activeChatMessageCount = 0,
        revealCharacterOverrides,
        onToggleRevealCharacterOverrides,
        onOpenGlobalDefaults,
        manualRangeAvailable = false,
        manualRangeBlockedReason = "",
        manualRangeBusy = false,
        onRunManualRange = () => {},
        replayCurrentChatAvailable = false,
        replayCurrentChatBusy = false,
        onReplayCurrentChat = () => {},
    }: Props = $props()

    let manualRangeStart = $state(1)
    let manualRangeEnd = $state(1)
    let manualRangeChatKey = $state("")

    function usesOpenRouterModelSelector(provider: string) {
        return provider.trim().toLowerCase() === "openrouter"
    }

    function setEvolutionFlag(
        key: "enabled" | "useGlobalDefaults",
        value: boolean,
    ) {
        characterEntry.characterEvolution = {
            ...characterEntry.characterEvolution,
            [key]: value,
        }
    }

    function setPrivacyFlag(
        key: "allowCharacterIntimatePreferences" | "allowUserIntimatePreferences",
        value: boolean,
    ) {
        characterEntry.characterEvolution = {
            ...characterEntry.characterEvolution,
            privacy: {
                ...characterEntry.characterEvolution.privacy,
                [key]: value,
            },
        }
    }

    const modelSuggestions = $derived(
        getCharacterEvolutionModelSuggestions(characterEntry.characterEvolution.extractionProvider)
    )
    const manualRangeMax = $derived(Math.max(1, Number(activeChatMessageCount) || 1))

    $effect(() => {
        const normalizedModel = normalizeCharacterEvolutionExtractionModel(
            characterEntry.characterEvolution.extractionProvider,
            characterEntry.characterEvolution.extractionModel,
        )
        if (characterEntry.characterEvolution.extractionModel !== normalizedModel) {
            characterEntry.characterEvolution.extractionModel = normalizedModel
        }
    })

    $effect(() => {
        const nextChatKey = activeChatId ?? ""
        if (manualRangeChatKey !== nextChatKey) {
            manualRangeChatKey = nextChatKey
            manualRangeStart = 1
            manualRangeEnd = manualRangeMax
            return
        }

        if (!Number.isInteger(manualRangeStart) || manualRangeStart < 1) {
            manualRangeStart = 1
        }
        if (!Number.isInteger(manualRangeEnd) || manualRangeEnd < 1) {
            manualRangeEnd = manualRangeMax
        }
        if (manualRangeStart > manualRangeMax) {
            manualRangeStart = manualRangeMax
        }
        if (manualRangeEnd > manualRangeMax) {
            manualRangeEnd = manualRangeMax
        }
    })

    async function submitManualRangeHandoff() {
        await onRunManualRange(manualRangeStart, manualRangeEnd)
    }
</script>

<div class="ds-settings-card evolution-setup-panel">
    <div class="ds-settings-section evolution-toggle-list">
        <CheckInput
            bare={true}
            className="evolution-toggle-row"
            check={characterEntry.characterEvolution.enabled}
            onChange={(value) => setEvolutionFlag("enabled", value)}
            name="Enable Character Evolution"
        />
        <CheckInput
            bare={true}
            className="evolution-toggle-row"
            check={characterEntry.characterEvolution.useGlobalDefaults}
            onChange={(value) => setEvolutionFlag("useGlobalDefaults", value)}
            name="Use Global Defaults"
        />
    </div>

    <div class="ds-settings-section evolution-runtime-summary">
        <div class="evolution-runtime-header">
            <span class="ds-settings-label">Extraction Runtime</span>
            <span class="evolution-runtime-source">{usingGlobalDefaults ? "Global defaults" : "Character override"}</span>
        </div>
        <div class="evolution-runtime-list">
            <div class="ds-settings-list-row evolution-runtime-row">
                <span class="ds-settings-label-muted-sm">Provider</span>
                <span class="ds-settings-text-medium evolution-runtime-value">{effectiveProvider || "Not configured"}</span>
            </div>
            <div class="ds-settings-list-row evolution-runtime-row">
                <span class="ds-settings-label-muted-sm">Model</span>
                <span class="ds-settings-text-medium evolution-runtime-value">{effectiveModel || "Not configured"}</span>
            </div>
            <div class="ds-settings-list-row evolution-runtime-row">
                <span class="ds-settings-label-muted-sm">Tokens</span>
                <span class="ds-settings-text-medium evolution-runtime-value">{evolutionSettings.extractionMaxTokens || 2400}</span>
            </div>
        </div>
    </div>

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
                    placeholder={modelSuggestions[0] ?? "Model id"}
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
                <CheckInput
                    check={characterEntry.characterEvolution.privacy.allowCharacterIntimatePreferences}
                    onChange={(value) => setPrivacyFlag("allowCharacterIntimatePreferences", value)}
                    name="Allow Character Intimate Preferences"
                    disabled={usingGlobalDefaults}
                />
                <CheckInput
                    check={characterEntry.characterEvolution.privacy.allowUserIntimatePreferences}
                    onChange={(value) => setPrivacyFlag("allowUserIntimatePreferences", value)}
                    name="Allow User Intimate Preferences"
                    disabled={usingGlobalDefaults}
                />
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

        {#if characterEntry.characterEvolution.enabled}
            <div class="evolution-manual-range">
                <div class="evolution-manual-range-header">
                    <span class="ds-settings-label">Manual Range Handoff</span>
                    <span class="ds-settings-label-muted-sm">{activeChatMessageCount} messages in current chat</span>
                </div>
                <span class="ds-settings-label-muted-sm">
                    Use 1-based inclusive message numbers. Example: 1 to 24.
                </span>
                <div class="evolution-manual-range-row">
                    <input
                        class="evolution-manual-range-input control-field"
                        type="number"
                        min="1"
                        max={manualRangeMax}
                        placeholder="Start"
                        bind:value={manualRangeStart}
                    />
                    <span class="evolution-manual-range-to">to</span>
                    <input
                        class="evolution-manual-range-input control-field"
                        type="number"
                        min="1"
                        max={manualRangeMax}
                        placeholder="End"
                        bind:value={manualRangeEnd}
                    />
                </div>
                {#if manualRangeBlockedReason}
                    <span class="ds-settings-label-muted-sm">{manualRangeBlockedReason}</span>
                {/if}
                <Button
                    size="sm"
                    styled="outlined"
                    className="ds-ui-fill-width"
                    onclick={submitManualRangeHandoff}
                    disabled={!manualRangeAvailable || manualRangeBusy}
                >
                    {manualRangeBusy ? "Running Handoff" : "Run Handoff on Range"}
                </Button>
            </div>
        {/if}

        <div class="evolution-setup-actions-stack">
            {#if usingGlobalDefaults}
                <Button size="sm" styled="outlined" className="ds-ui-fill-width" onclick={onOpenGlobalDefaults}>
                    Open Global Defaults
                </Button>
                <Button size="sm" styled="outlined" className="ds-ui-fill-width" onclick={onToggleRevealCharacterOverrides}>
                    {revealCharacterOverrides ? "Hide Character Overrides" : "Show Character Overrides"}
                </Button>
            {/if}
            {#if replayCurrentChatAvailable}
                <Button size="sm" styled="outlined" className="ds-ui-fill-width" onclick={onReplayCurrentChat} disabled={replayCurrentChatBusy}>
                    {replayCurrentChatBusy ? "Replaying Accepted Chat" : "Replay Accepted Chat"}
                </Button>
            {/if}
        </div>
    </div>
</div>

<datalist id="character-evolution-model-options">
    {#each modelSuggestions as model (model)}
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

    .evolution-runtime-row {
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--ds-space-3);
        min-height: 0;
        padding: 0;
    }

    .evolution-runtime-row + .evolution-runtime-row {
        border-top: 1px solid var(--ds-border-subtle);
        padding-top: var(--ds-space-2);
        margin-top: var(--ds-space-2);
    }

    .evolution-runtime-value {
        color: var(--ds-text-primary);
        text-align: right;
        overflow-wrap: anywhere;
    }

    .evolution-setup-actions-stack {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-manual-range {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        margin-bottom: var(--ds-space-3);
    }

    .evolution-manual-range-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-2);
        flex-wrap: wrap;
    }

    .evolution-manual-range-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .evolution-manual-range-input {
        min-width: 0;
        flex: 1 1 0;
    }

    .evolution-manual-range-to {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    @media (max-width: 640px) {
        .evolution-runtime-row {
            flex-direction: column;
        }

        .evolution-runtime-value {
            text-align: left;
        }
    }
</style>
