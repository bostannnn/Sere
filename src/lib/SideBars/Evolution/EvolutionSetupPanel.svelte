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
        getLastProcessedMessageIndexForChat,
        normalizeCharacterEvolutionExtractionModel,
    } from "src/ts/characterEvolution"
    import type {
        CharacterEvolutionProcessedRange,
        CharacterEvolutionSettings,
        character as CharacterEntry,
    } from "src/ts/storage/database.types"

    interface Props {
        characterEntry: CharacterEntry
        evolutionSettings: CharacterEvolutionSettings
        processedRanges?: CharacterEvolutionProcessedRange[]
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
        autoProcessAvailable?: boolean
        autoProcessing?: boolean
        autoProcessedBatches?: number
        autoProcessTotalBatches?: number
        onRunAutoProcess?: () => void | Promise<void>
        onCancelAutoProcess?: () => void
        replayCurrentChatAvailable?: boolean
        replayCurrentChatBusy?: boolean
        onReplayCurrentChat?: () => void | Promise<void>
    }

    let {
        characterEntry,
        evolutionSettings,
        processedRanges = [],
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
        autoProcessAvailable = false,
        autoProcessing = false,
        autoProcessedBatches = 0,
        autoProcessTotalBatches = 0,
        onRunAutoProcess = () => {},
        onCancelAutoProcess = () => {},
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
    const activeChatProcessedRanges = $derived.by(() => {
        const chatId = activeChatId?.trim()
        if (!chatId) {
            return []
        }

        return processedRanges
            .filter((entry) => entry.range.chatId === chatId)
            .sort((left, right) => left.range.startMessageIndex - right.range.startMessageIndex)
    })
    const nextUnprocessedMessageNumber = $derived.by(() => {
        let contiguousProcessedEnd = -1
        for (const entry of activeChatProcessedRanges) {
            if (entry.range.startMessageIndex > contiguousProcessedEnd + 1) {
                break
            }
            contiguousProcessedEnd = Math.max(contiguousProcessedEnd, entry.range.endMessageIndex)
        }
        return contiguousProcessedEnd + 2
    })
    const activeChatProcessedCursor = $derived.by(() => (
        activeChatId
            ? getLastProcessedMessageIndexForChat(evolutionSettings, activeChatId)
            : -1
    ))

    function formatProcessedRange(range: CharacterEvolutionProcessedRange["range"]) {
        return `Messages ${range.startMessageIndex + 1}-${range.endMessageIndex + 1}`
    }

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

    function setAutoHandoffFlag(
        key: "autoHandoffEnabled" | "autoHandoffAutoAccept",
        value: boolean,
    ) {
        characterEntry.characterEvolution = {
            ...characterEntry.characterEvolution,
            [key]: value,
        }
    }

    function setAutoHandoffBatchSize(value: number) {
        const clamped = Math.max(1, Math.floor(Number(value) || 10))
        characterEntry.characterEvolution = {
            ...characterEntry.characterEvolution,
            autoHandoffBatchSize: clamped,
        }
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
                    disabled={!manualRangeAvailable || manualRangeBusy || autoProcessing}
                >
                    {manualRangeBusy ? "Running Handoff" : "Run Handoff on Range"}
                </Button>
            </div>

            <div class="evolution-auto-process">
                <div class="evolution-manual-range-header">
                    <span class="ds-settings-label">Auto Process</span>
                    {#if autoProcessing}
                        <span class="ds-settings-label-muted-sm">{autoProcessedBatches}/{autoProcessTotalBatches} batches</span>
                    {/if}
                </div>
                <span class="ds-settings-label-muted-sm">
                    Runs handoffs from next unprocessed message and auto-accepts each batch.
                </span>
                <div class="evolution-auto-process-row">
                    {#if autoProcessing}
                        <Button
                            size="sm"
                            styled="outlined"
                            className="ds-ui-fill-width"
                            onclick={onCancelAutoProcess}
                        >
                            Cancel
                        </Button>
                    {:else}
                        <Button
                            size="sm"
                            styled="outlined"
                            className="ds-ui-fill-width"
                            onclick={onRunAutoProcess}
                            disabled={!autoProcessAvailable || manualRangeBusy}
                        >
                            Auto Process
                        </Button>
                    {/if}
                </div>
            </div>

            <div class="evolution-auto-handoff-settings">
                <div class="evolution-manual-range-header">
                    <span class="ds-settings-label">Auto Handoff Every X Messages</span>
                </div>
                <CheckInput
                    bare={true}
                    className="evolution-toggle-row"
                    check={characterEntry.characterEvolution.autoHandoffEnabled ?? false}
                    onChange={(value) => setAutoHandoffFlag("autoHandoffEnabled", value)}
                    name="Enable auto handoff"
                />
                <div class="evolution-auto-handoff-row">
                    <span class="ds-settings-label-muted-sm">Batch size</span>
                    <input
                        class="evolution-manual-range-input control-field"
                        type="number"
                        min="1"
                        placeholder="10"
                        value={characterEntry.characterEvolution.autoHandoffBatchSize ?? 10}
                        oninput={(e) => setAutoHandoffBatchSize(Number((e.target as HTMLInputElement).value))}
                    />
                </div>
                <CheckInput
                    bare={true}
                    className="evolution-toggle-row"
                    check={characterEntry.characterEvolution.autoHandoffAutoAccept !== false}
                    onChange={(value) => setAutoHandoffFlag("autoHandoffAutoAccept", value)}
                    name="Auto-accept proposals"
                />
            </div>

            <div class="evolution-accepted-coverage">
                <div class="evolution-manual-range-header">
                    <span class="ds-settings-label">Accepted Coverage</span>
                    <span class="ds-settings-label-muted-sm">{activeChatProcessedRanges.length} accepted range{activeChatProcessedRanges.length === 1 ? "" : "s"}</span>
                </div>

                {#if activeChatProcessedRanges.length > 0}
                    <div class="evolution-accepted-coverage-list">
                        {#each activeChatProcessedRanges as entry (entry.version + ":" + entry.range.chatId + ":" + entry.range.startMessageIndex + ":" + entry.range.endMessageIndex)}
                            <div class="ds-settings-list-row evolution-accepted-coverage-row">
                                <span class="ds-settings-label-muted-sm">v{entry.version}</span>
                                <span class="ds-settings-text-medium">{formatProcessedRange(entry.range)}</span>
                            </div>
                        {/each}
                    </div>
                    <span class="ds-settings-label-muted-sm">Next unprocessed message: {nextUnprocessedMessageNumber}</span>
                {:else if activeChatProcessedCursor >= 0}
                    <span class="ds-settings-label-muted-sm">
                        Accepted coverage exists through message {activeChatProcessedCursor + 1}, but detailed range history is unavailable for this chat.
                    </span>
                    <span class="ds-settings-label-muted-sm">Next unprocessed message: {activeChatProcessedCursor + 2}</span>
                {:else}
                    <span class="ds-settings-label-muted-sm">No accepted handoffs for the current chat yet.</span>
                {/if}
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

    .evolution-auto-process {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        margin-bottom: var(--ds-space-3);
    }

    .evolution-auto-process-row {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .evolution-auto-handoff-settings {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        margin-bottom: var(--ds-space-3);
    }

    .evolution-auto-handoff-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
    }

    .evolution-auto-handoff-row .evolution-manual-range-input {
        max-width: 80px;
    }

    .evolution-accepted-coverage {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        margin-bottom: var(--ds-space-3);
    }

    .evolution-accepted-coverage-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .evolution-accepted-coverage-row {
        justify-content: space-between;
        align-items: center;
        gap: var(--ds-space-3);
        min-height: 0;
        padding: 0;
    }

    @media (max-width: 640px) {
        .evolution-runtime-row {
            flex-direction: column;
        }

        .evolution-runtime-value {
            text-align: left;
        }

        .evolution-accepted-coverage-row {
            flex-direction: column;
            align-items: flex-start;
        }
    }
</style>
