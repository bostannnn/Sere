<script lang="ts">
    import { CheckIcon, CopyIcon, XIcon } from "@lucide/svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { alertStore, DBState, selectedCharID } from "src/ts/stores.svelte";
    import { alertGenerationInfoStore } from "src/ts/alert";
    import { aiLawApplies } from "src/ts/globalApi.svelte";
    import { tokenize } from "src/ts/tokenizer";
    import { language } from "src/lang";
    import { copyToClipboardSafe, createRequestDataLoader, formatCombinedRequestData } from "./request-data";
    import type { AlertState } from "./types";

    interface Props {
        alert: AlertState;
    }

    const { alert }: Props = $props();
    const loadRequestData = createRequestDataLoader();

    let selectedTab = $state(0);
    let requestDataCopiedKey: string | null = $state(null);

    function getCurrentChatState() {
        if ($selectedCharID === -1) {
            return null;
        }
        const character = DBState.db.characters[$selectedCharID];
        if (!character) {
            return null;
        }
        return character.chats[character.chatPage] ?? null;
    }

    async function copyRequestData(text: string, key: string) {
        await copyToClipboardSafe(text);
        requestDataCopiedKey = key;
        setTimeout(() => {
            if (requestDataCopiedKey === key) {
                requestDataCopiedKey = null;
            }
        }, 1500);
    }

    function closeModal() {
        alertStore.set({
            type: "none",
            msg: "",
        });
    }
</script>

<div class="alert-overlay">
    <div class="alert-modal-base break-any">
        {#if aiLawApplies()}
            <div>{language.generatedByAIDisclaimer}</div>
        {/if}

        <div class="alert-inline-toolbar">
            <Button selected={selectedTab === 0} size="sm" onclick={() => selectedTab = 0}>{language.tokens}</Button>
            <Button selected={selectedTab === 1} size="sm" onclick={() => selectedTab = 1}>{language.metaData}</Button>
            <Button selected={selectedTab === 2} size="sm" onclick={() => selectedTab = 2}>{language.log}</Button>
            <Button selected={selectedTab === 3} size="sm" onclick={() => selectedTab = 3}>{language.prompt}</Button>
            <button
                type="button"
                class="alert-toolbar-close"
                title="Close request data"
                aria-label="Close request data"
                onclick={closeModal}
            >
                <XIcon />
            </button>
        </div>

        {#if selectedTab === 0}
            <div class="alert-requestdata-chart-row">
                <div
                    class="alert-requestdata-chart"
                    style:background={`linear-gradient(0deg,
                        var(--alert-info-primary) 0%,
                        var(--alert-info-primary) ${(($alertGenerationInfoStore?.genInfo.inputTokens ?? 0) / ($alertGenerationInfoStore?.genInfo.maxContext ?? 1)) * 100}%,
                        var(--alert-info-success) ${(($alertGenerationInfoStore?.genInfo.inputTokens ?? 0) / ($alertGenerationInfoStore?.genInfo.maxContext ?? 1)) * 100}%,
                        var(--alert-info-success) ${((($alertGenerationInfoStore?.genInfo.outputTokens ?? 0) + ($alertGenerationInfoStore?.genInfo.inputTokens ?? 0)) / ($alertGenerationInfoStore?.genInfo.maxContext ?? 1)) * 100}%,
                        var(--alert-info-muted) ${((($alertGenerationInfoStore?.genInfo.outputTokens ?? 0) + ($alertGenerationInfoStore?.genInfo.inputTokens ?? 0)) / ($alertGenerationInfoStore?.genInfo.maxContext ?? 1)) * 100}%,
                        var(--alert-info-muted) 100%)`}
                ></div>
            </div>
            <div class="alert-info-grid">
                <span class="alert-info-primary">{language.inputTokens}</span>
                <span class="alert-info-primary alert-grid-end">{$alertGenerationInfoStore?.genInfo.inputTokens ?? "?"} {language.tokens}</span>
                <span class="alert-info-success">{language.outputTokens}</span>
                <span class="alert-info-success alert-grid-end">{$alertGenerationInfoStore?.genInfo.outputTokens ?? "?"} {language.tokens}</span>
                <span class="alert-info-muted">{language.maxContextSize}</span>
                <span class="alert-info-muted alert-grid-end">{$alertGenerationInfoStore?.genInfo.maxContext ?? "?"} {language.tokens}</span>
            </div>
            <span class="alert-body-submessage alert-text-sm">{language.tokenWarning}</span>
        {/if}

        {#if selectedTab === 1 && $alertGenerationInfoStore}
            <div class="alert-info-grid">
                <span class="alert-info-primary">Index</span>
                <span class="alert-info-primary alert-grid-end">{$alertGenerationInfoStore.idx}</span>
                <span class="alert-info-warning">Model</span>
                <span class="alert-info-warning alert-grid-end">{$alertGenerationInfoStore.genInfo.model}</span>
                <span class="alert-info-success">ID</span>
                <span class="alert-info-success alert-grid-end">{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].chatId ?? "None"}</span>
                <span class="alert-info-danger">GenID</span>
                <span class="alert-info-danger alert-grid-end">{$alertGenerationInfoStore.genInfo.generationId}</span>
                <span class="alert-info-accent">Saying</span>
                <span class="alert-info-accent alert-grid-end">{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].saying}</span>
                <span class="alert-info-secondary">Size</span>
                <span class="alert-info-secondary alert-grid-end">{JSON.stringify(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx]).length} Bytes</span>
                <span class="alert-info-warning">Time</span>
                <span class="alert-info-warning alert-grid-end">{new Date(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].time ?? 0).toLocaleString()}</span>
                {#if $alertGenerationInfoStore.genInfo.stageTiming}
                    {@const stage1 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage1 ?? 0) / 1000).toFixed(1)))}
                    {@const stage2 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage2 ?? 0) / 1000).toFixed(1)))}
                    {@const stage3 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage3 ?? 0) / 1000).toFixed(1)))}
                    {@const stage4 = parseFloat(((($alertGenerationInfoStore.genInfo.stageTiming.stage4 ?? 0) / 1000).toFixed(1)))}
                    {@const totalRounded = (stage1 + stage2 + stage3 + stage4).toFixed(1)}
                    <span class="alert-info-muted">Timing</span>
                    <span class="alert-info-muted alert-grid-end">
                        <span class="alert-timing-stage-1">{stage1}</span> +
                        <span class="alert-timing-stage-2">{stage2}</span> +
                        <span class="alert-timing-stage-3">{stage3}</span> +
                        <span class="alert-timing-stage-4">{stage4}</span> =
                        <span class="alert-timing-total">{totalRounded}s</span>
                    </span>
                {/if}
                <span class="alert-info-success">Tokens</span>
                {#await tokenize(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].data)}
                    <span class="alert-info-success alert-grid-end">Loading</span>
                {:then tokens}
                    <span class="alert-info-success alert-grid-end">{tokens}</span>
                {/await}
            </div>
        {/if}

        {#if selectedTab === 2}
            {#await loadRequestData(alert.msg, $alertGenerationInfoStore, { selectedCharId: $selectedCharID, chat: getCurrentChatState() }) then data}
                {#if !data}
                    <span class="alert-body-message-lg">{language.errors.requestLogRemoved}</span>
                    <span class="alert-body-submessage">{language.errors.requestLogRemovedDesc}</span>
                {:else}
                    <h1 class="alert-section-title">Log Source</h1>
                    <code class="alert-code-block alert-prewrap">{data.source === "client" ? "Client request log (in-memory)" : "Server durable log fallback"}</code>
                    <h1 class="alert-section-title">URL</h1>
                    <code class="alert-code-block alert-prewrap">{data.url}</code>
                    <div class="alert-requestdata-actions">
                        <Button size="sm" styled="outlined" onclick={() => copyRequestData(data.body, "request")}>
                            {#if requestDataCopiedKey === "request"}
                                <CheckIcon class="alert-copy-icon" />
                                {language.copied}
                            {:else}
                                <CopyIcon class="alert-copy-icon" />
                                {language.copy} Request
                            {/if}
                        </Button>
                        <Button size="sm" styled="outlined" onclick={() => copyRequestData(data.response, "response")}>
                            {#if requestDataCopiedKey === "response"}
                                <CheckIcon class="alert-copy-icon" />
                                {language.copied}
                            {:else}
                                <CopyIcon class="alert-copy-icon" />
                                {language.copy} Response
                            {/if}
                        </Button>
                        <Button size="sm" styled="outlined" onclick={() => copyRequestData(formatCombinedRequestData(data), "both")}>
                            {#if requestDataCopiedKey === "both"}
                                <CheckIcon class="alert-copy-icon" />
                                {language.copied}
                            {:else}
                                <CopyIcon class="alert-copy-icon" />
                                {language.copy} Both
                            {/if}
                        </Button>
                    </div>
                    <h1 class="alert-section-title">Request Body</h1>
                    <code class="alert-code-block alert-prewrap">{data.body}</code>
                    <h1 class="alert-section-title">Response</h1>
                    <code class="alert-code-block alert-prewrap">{data.response}</code>
                {/if}
            {/await}
        {/if}

        {#if selectedTab === 3 && $alertGenerationInfoStore}
            {#if Object.keys(DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo || {}).length === 0}
                <div class="alert-body-message-lg">{language.promptInfoEmptyMessage}</div>
            {:else}
                <div class="alert-info-grid">
                    <span class="alert-info-primary">Preset Name</span>
                    <span class="alert-info-primary alert-grid-end">{DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptName}</span>
                    <span class="alert-info-secondary">Toggles</span>
                    <div class="alert-grid-span-full alert-prompt-pane alert-prompt-pane-sm">
                        {#if DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptToggles.length === 0}
                            <div class="alert-prompt-empty">{language.promptInfoEmptyToggle}</div>
                        {:else}
                            <div class="alert-info-grid alert-info-grid-no-top">
                                {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptToggles as toggle, index (index)}
                                    <span class="alert-prompt-key alert-truncate">{toggle.key}</span>
                                    <span class="alert-prompt-key alert-grid-end alert-truncate">{toggle.value}</span>
                                {/each}
                            </div>
                        {/if}
                    </div>
                    <span class="alert-info-danger">Prompt Text</span>
                    <div class="alert-grid-span-full alert-prompt-pane alert-prompt-pane-lg">
                        {#if !DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptText}
                            <div class="alert-prompt-empty">{language.promptInfoEmptyText}</div>
                        {:else}
                            {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].message[$alertGenerationInfoStore.idx].promptInfo.promptText as block, index (index)}
                                <div class="alert-block-gap-sm">
                                    <div class="alert-prompt-role">{block.role}</div>
                                    <pre class="alert-prompt-content">{block.content}</pre>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    :global(:root) {
        --alert-info-primary: var(--risu-theme-primary-500);
        --alert-info-success: var(--risu-theme-success-500);
        --alert-info-danger: var(--ds-text-danger, var(--risu-theme-danger-500));
        --alert-info-warning: color-mix(in srgb, var(--ds-text-primary) 82%, var(--ds-border-strong) 18%);
        --alert-info-accent: var(--ds-border-strong);
        --alert-info-secondary: color-mix(in srgb, var(--ds-text-primary) 68%, var(--ds-border-strong) 32%);
        --alert-info-muted: var(--ds-text-secondary);
    }

    .alert-overlay {
        position: absolute;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, #000 50%, transparent);
    }

    .alert-modal-base {
        display: flex;
        flex-direction: column;
        max-width: 48rem;
        max-height: 100%;
        overflow-y: auto;
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-inline-toolbar,
    .alert-requestdata-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-inline-toolbar {
        width: 100%;
    }

    .alert-toolbar-close {
        margin-left: auto;
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-toolbar-close:hover {
        color: var(--ds-text-primary);
    }

    .alert-requestdata-chart-row {
        width: 100%;
        margin-top: var(--ds-space-4);
        display: flex;
        justify-content: center;
    }

    .alert-requestdata-chart {
        width: 8rem;
        height: 8rem;
        border: 4px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
    }

    .alert-info-grid {
        width: 100%;
        margin-top: var(--ds-space-4);
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        row-gap: var(--ds-space-2);
        column-gap: var(--ds-space-4);
    }

    .alert-info-grid-no-top {
        margin-top: 0;
    }

    .alert-grid-end {
        justify-self: end;
    }

    .alert-grid-span-full {
        grid-column: 1 / -1;
    }

    .alert-truncate {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .alert-body-submessage,
    .alert-prompt-role {
        color: var(--ds-text-secondary);
    }

    .alert-text-sm {
        font-size: var(--ds-font-size-sm);
    }

    .alert-section-title {
        margin: var(--ds-space-4) 0;
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-semibold);
    }

    .alert-body-message-lg {
        margin-top: var(--ds-space-2);
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-lg);
    }

    .alert-code-block,
    .alert-prompt-content {
        color: var(--ds-text-primary);
        border: 1px solid var(--ds-border-subtle);
    }

    .alert-code-block {
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2);
    }

    .alert-prompt-pane {
        overflow-y: auto;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-sm);
        background: color-mix(in srgb, var(--ds-surface-1) 86%, var(--ds-surface-2) 14%);
    }

    .alert-prompt-pane-sm {
        max-height: 8rem;
        padding: var(--ds-space-2);
    }

    .alert-prompt-pane-lg {
        max-height: 20rem;
        padding: var(--ds-space-3);
    }

    .alert-prompt-empty {
        color: var(--ds-text-secondary);
        font-style: italic;
        text-align: center;
        padding: var(--ds-space-4) 0;
    }

    .alert-prompt-key {
        color: var(--ds-text-primary);
    }

    .alert-block-gap-sm {
        margin-bottom: var(--ds-space-2);
    }

    .alert-prompt-content {
        white-space: pre-wrap;
        font-size: var(--ds-font-size-sm);
        background: color-mix(in srgb, var(--ds-surface-1) 90%, black 10%);
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-sm);
    }

    :global(.alert-copy-icon) {
        width: 0.9rem;
        height: 0.9rem;
        margin-right: var(--ds-space-1);
    }

    .alert-prewrap {
        white-space: pre-wrap;
    }

    .alert-info-primary {
        color: var(--alert-info-primary);
    }

    .alert-info-success {
        color: var(--alert-info-success);
    }

    .alert-info-danger {
        color: var(--alert-info-danger);
    }

    .alert-info-warning {
        color: var(--alert-info-warning);
    }

    .alert-info-accent {
        color: var(--alert-info-accent);
    }

    .alert-info-secondary {
        color: var(--alert-info-secondary);
    }

    .alert-info-muted {
        color: var(--alert-info-muted);
    }

    .alert-timing-stage-1 {
        color: color-mix(in srgb, var(--alert-info-primary) 78%, var(--ds-text-primary) 22%);
    }

    .alert-timing-stage-2 {
        color: color-mix(in srgb, var(--alert-info-danger) 75%, var(--ds-text-primary) 25%);
    }

    .alert-timing-stage-3 {
        color: color-mix(in srgb, var(--alert-info-success) 78%, var(--ds-text-primary) 22%);
    }

    .alert-timing-stage-4 {
        color: color-mix(in srgb, var(--alert-info-accent) 80%, var(--ds-text-primary) 20%);
    }

    .alert-timing-total {
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-bold);
    }

    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
