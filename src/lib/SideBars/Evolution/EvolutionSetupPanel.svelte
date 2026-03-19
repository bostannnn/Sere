<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte"
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte"
    import EvolutionAcceptedCoverageCard from "./EvolutionAcceptedCoverageCard.svelte"
    import {
        getLastProcessedMessageIndexForChat,
        getNextUnprocessedMessageIndexForChat,
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
        effectiveProvider: string
        effectiveModel: string
        hasTemplateSlot: boolean
        activeChatId?: string | null
        activeChatMessageCount?: number
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
        effectiveProvider,
        effectiveModel,
        hasTemplateSlot,
        activeChatId = null,
        activeChatMessageCount = 0,
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

    function setEvolutionFlag(
        key: "enabled",
        value: boolean,
    ) {
        characterEntry.characterEvolution = {
            ...characterEntry.characterEvolution,
            [key]: value,
        }
    }
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
        return getNextUnprocessedMessageIndexForChat(
            {
                lastProcessedChatId: evolutionSettings.lastProcessedChatId,
                lastProcessedMessageIndexByChat: evolutionSettings.lastProcessedMessageIndexByChat,
                processedRanges,
                stateVersions: evolutionSettings.stateVersions,
            },
            activeChatId,
        ) + 1
    })
    const activeChatProcessedCursor = $derived.by(() => (
        activeChatId
            ? getLastProcessedMessageIndexForChat(evolutionSettings, activeChatId)
            : -1
    ))

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
    </div>

    <div class="ds-settings-section evolution-runtime-summary">
        <div class="evolution-runtime-header">
            <span class="ds-settings-label">Extraction Runtime</span>
            <span class="evolution-runtime-source">Global defaults</span>
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
        <span class="ds-settings-label-muted-sm">
            Extraction configuration, sections, privacy, prompt projection, and retention are managed globally.
        </span>
    </div>

    <div class="ds-settings-section">
        {#if characterEntry.characterEvolution.enabled && !hasTemplateSlot}
            <span class="ds-settings-note-danger">
                Evolution is enabled, but the active prompt template does not include an evolution state block such as `characterState`, `userState`, or `relationshipState`.
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
                    Runs handoffs from the next unprocessed message and auto-accepts each batch. Batch size counts raw chat messages, not user/character pairs.
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
                <span class="ds-settings-label-muted-sm">
                    Counts raw chat messages from the next unprocessed point.
                </span>
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

            <EvolutionAcceptedCoverageCard
                {activeChatProcessedRanges}
                {activeChatProcessedCursor}
                {nextUnprocessedMessageNumber}
            />
        {/if}

        <div class="evolution-setup-actions-stack">
            <Button size="sm" styled="outlined" className="ds-ui-fill-width" onclick={onOpenGlobalDefaults}>
                Open Global Defaults
            </Button>
            {#if replayCurrentChatAvailable}
                <Button size="sm" styled="outlined" className="ds-ui-fill-width" onclick={onReplayCurrentChat} disabled={replayCurrentChatBusy}>
                    {replayCurrentChatBusy ? "Replaying Accepted Chat" : "Replay Accepted Chat"}
                </Button>
            {/if}
        </div>
    </div>
</div>

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

    @media (max-width: 640px) {
        .evolution-runtime-row {
            flex-direction: column;
        }

        .evolution-runtime-value {
            text-align: left;
        }
    }
</style>
