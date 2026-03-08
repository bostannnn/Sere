<script lang="ts">
    import { DBState, selIdState, ragLastResult, alertStore } from 'src/ts/stores.svelte';
    import { CheckIcon, SquareIcon } from "@lucide/svelte";
    import { rulebookStorage } from "../../../ts/process/rag/storage";
    import Check from "../../UI/GUI/CheckInput.svelte";
    import IconButton from "../../UI/GUI/IconButton.svelte";
    import { onMount } from 'svelte';

    const lastRet = $derived($ragLastResult);
    let rulebooks = $state<{ id: string; name: string; chunkCount?: number; thumbnail?: string; metadata?: import("../../../ts/process/rag/types").RagIndexMetadata }[]>([]);

    const char = $derived(DBState.db.characters[selIdState.selId]);
    const ragEnabled = $derived(char?.ragSettings?.enabled ?? false);
    const enabledRulebooks = $derived.by(() => {
        const selected = char?.ragSettings?.enabledRulebooks;
        return Array.isArray(selected) ? [...selected] : [];
    });
    const enabledRulebookCount = $derived(enabledRulebooks.length);
    const selectedSummary = $derived(`${enabledRulebookCount} of ${rulebooks.length} selected`);
    const rulebookRagSettingLog = (..._args: unknown[]) => {};

    function ensureSettings() {
        if (!char) {
            return null;
        }
        if (!char.ragSettings) {
            char.ragSettings = { enabled: false, enabledRulebooks: [] };
        }
        if (!Array.isArray(char.ragSettings.enabledRulebooks)) {
            char.ragSettings = { ...char.ragSettings, enabledRulebooks: [] };
        }
        return char.ragSettings;
    }

    function setEnabledRulebooks(nextEnabledRulebooks: string[]) {
        const settings = ensureSettings();
        if (!settings || !char) {
            return;
        }
        char.ragSettings = {
            ...settings,
            enabledRulebooks: Array.from(new Set(nextEnabledRulebooks.filter((id) => typeof id === "string" && id.trim()))),
        };
    }

    function reconcileEnabledRulebooks(availableRulebooks: { id: string }[]) {
        const settings = ensureSettings();
        if (!settings) {
            return;
        }
        const availableIds = new Set(availableRulebooks.map((book) => book.id));
        const nextEnabledRulebooks = settings.enabledRulebooks.filter((id) => availableIds.has(id));
        if (nextEnabledRulebooks.length !== settings.enabledRulebooks.length) {
            setEnabledRulebooks(nextEnabledRulebooks);
        }
    }

    onMount(async () => {
        try {
            const res = await rulebookStorage.listRulebooks();
            rulebookRagSettingLog("[RAG] Character Settings Refresh:", res);
            rulebooks = res;
            reconcileEnabledRulebooks(res);
        } catch (e) {
            rulebookRagSettingLog("Failed to fetch rulebooks:", e);
            alertStore.set({ type: 'error', msg: `Failed to fetch rulebooks: ${e.message}` });
        }
    });

    function toggleRulebook(id: string) {
        const settings = ensureSettings();
        if (!settings) return;
        if (settings.enabledRulebooks.includes(id)) {
            setEnabledRulebooks(settings.enabledRulebooks.filter((bookId) => bookId !== id));
            return;
        }
        setEnabledRulebooks([...settings.enabledRulebooks, id]);
    }

    function clearEnabledRulebooks() {
        setEnabledRulebooks([]);
    }
</script>

<div class="rag-rulebook-container">
    <div class="rag-rulebook-summary" data-testid="rulebook-rag-summary">
        <div class="rag-summary-copy">
            <span class="rag-section-title">Choose Rulebooks</span>
            <p class="rag-summary-text">This character may reference {selectedSummary}.</p>
        </div>
        <button
            type="button"
            class="rag-summary-action"
            onclick={clearEnabledRulebooks}
            disabled={enabledRulebookCount === 0}
            aria-label="Clear selected rulebooks"
        >
            Clear all
        </button>
    </div>
    <div class="rag-rulebook-list list-shell" data-testid="rulebook-rag-list">
        {#each rulebooks as book (book.id)}
            {@const isEnabled = enabledRulebooks.includes(book.id)}
            <div
                class="ds-settings-card panel-shell rag-rulebook-item"
                class:is-enabled={isEnabled}
                data-selected={isEnabled ? "1" : "0"}
                data-testid="rulebook-rag-item"
                role="button"
                tabindex="0"
                aria-pressed={isEnabled}
                onclick={() => toggleRulebook(book.id)}
                onkeydown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleRulebook(book.id);
                    }
                }}
            >
                <div class="rag-rulebook-info">
                    <div class="rag-rulebook-meta">
                        <span class="rag-rulebook-name">{book.name}</span>
                        {#if isEnabled}
                            <span class="rag-rulebook-status">Included in chat</span>
                        {/if}
                    </div>
                </div>
                <div class="rag-rulebook-actions action-rail" data-testid="rulebook-rag-actions">
                    <IconButton
                        onclick={(event) => {
                            event.stopPropagation();
                            toggleRulebook(book.id);
                        }}
                        className={`rag-rulebook-toggle-btn icon-btn icon-btn--sm${isEnabled ? " rag-toggle-btn-enabled" : ""}`}
                        ariaLabel={`${isEnabled ? "Remove" : "Select"} ${book.name} for this character`}
                        ariaPressed={isEnabled}
                    >
                        {#if isEnabled}
                            <CheckIcon size={16} />
                        {:else}
                            <SquareIcon size={16} />
                        {/if}
                    </IconButton>
                </div>
            </div>
        {/each}
        {#if rulebooks.length === 0}
            <div class="rag-empty empty-state" data-testid="rulebook-rag-empty">No rulebooks in library. Use the Library icon in the main menu to upload PDFs or text files.</div>
        {/if}
    </div>

    <div class="ds-settings-divider ds-settings-divider-spaced"></div>

    <div class="rag-settings-form">
        <div class="rag-setting-row">
            <Check check={ragEnabled} onChange={(v) => {
                ensureSettings();
                if(!char?.ragSettings){
                    return;
                }
                char.ragSettings.enabled = v;
            }} name="Enable Rulebook RAG" />
        </div>
    </div>

    {#if lastRet.query}
        <div class="ds-settings-divider ds-settings-divider-spaced"></div>
        <div class="rag-last-retrieval">
            <span class="rag-section-title">Last Retrieval</span>
            <div class="rag-query-box">
                <span class="rag-label">Query:</span>
                <span class="rag-query-text">{lastRet.query}</span>
            </div>
            <div class="rag-result-list list-shell" data-testid="rulebook-rag-result-list">
                {#each lastRet.results as res, i (i)}
                    <div class="ds-settings-card panel-shell rag-result-item">
                        <div class="rag-result-header">
                            <span class="rag-result-source">{res.source}</span>
                            <span class="rag-result-score">{(res.score * 100).toFixed(1)}%</span>
                        </div>
                        <div class="rag-result-content">{res.content}</div>
                    </div>
                {/each}
                {#if lastRet.results.length === 0}
                    <div class="rag-empty empty-state" data-testid="rulebook-rag-result-empty">No chunks met the similarity threshold.</div>
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .rag-rulebook-container {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        padding: var(--ds-space-2);
    }
    .rag-rulebook-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
    }
    .rag-rulebook-summary {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ds-space-3);
        padding: 0 var(--ds-space-2) var(--ds-space-1);
    }
    .rag-summary-copy {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .rag-summary-text {
        margin: 0;
        font-size: 13px;
        line-height: 1.4;
        color: color-mix(in srgb, var(--ds-text-primary) 72%, var(--ds-surface-1));
    }
    .rag-rulebook-item {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-3);
        padding: 16px 18px;
        border: 1px solid color-mix(in srgb, var(--ds-border-subtle) 85%, transparent);
        background: color-mix(in srgb, var(--ds-surface-1) 94%, transparent);
        transition: border-color 0.16s ease, background-color 0.16s ease, transform 0.16s ease;
        cursor: pointer;
        isolation: isolate;
    }
    .rag-rulebook-item::before {
        content: "";
        position: absolute;
        inset: 10px auto 10px 0;
        width: 4px;
        border-radius: 999px;
        background: transparent;
        transition: background-color 0.16s ease, opacity 0.16s ease;
        opacity: 0;
    }
    .rag-rulebook-item.is-enabled {
        border-color: color-mix(in srgb, var(--color-green-500) 70%, var(--ds-border-subtle));
        background:
            linear-gradient(135deg, color-mix(in srgb, var(--color-green-500) 12%, transparent), transparent 42%),
            color-mix(in srgb, var(--color-green-500) 16%, var(--ds-surface-1));
        box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--color-green-500) 20%, transparent),
            0 8px 24px color-mix(in srgb, black 28%, transparent);
    }
    .rag-rulebook-item.is-enabled::before {
        background: linear-gradient(180deg, color-mix(in srgb, var(--color-green-500) 95%, white), color-mix(in srgb, var(--color-green-500) 65%, transparent));
        opacity: 1;
    }
    .rag-rulebook-item:hover {
        transform: translateY(-1px);
    }
    .rag-rulebook-item:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--color-green-500) 70%, white);
        outline-offset: 2px;
    }
    .rag-rulebook-info {
        display: flex;
        align-items: center;
        color: var(--ds-text-primary);
        min-width: 0;
        flex: 1 1 auto;
    }
    .rag-rulebook-meta {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }
    .rag-rulebook-name {
        font-size: var(--ds-font-size-sm);
        line-height: 1.35;
        word-break: break-word;
        color: color-mix(in srgb, var(--ds-text-primary) 94%, white 6%);
    }
    .rag-rulebook-item.is-enabled .rag-rulebook-name {
        font-weight: 650;
    }
    .rag-rulebook-status {
        font-size: 11px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: color-mix(in srgb, var(--color-green-500) 88%, white 12%);
    }
    .rag-rulebook-actions {
        justify-content: flex-end;
        flex: 0 0 auto;
    }
    :global(.rag-toggle-btn-enabled) {
        color: color-mix(in srgb, white 94%, var(--color-green-500)) !important;
        background: color-mix(in srgb, var(--color-green-500) 78%, var(--ds-surface-1)) !important;
        border-color: color-mix(in srgb, var(--color-green-500) 44%, var(--ds-border-subtle)) !important;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-green-500) 18%, transparent);
    }
    :global(.rag-rulebook-toggle-btn) {
        min-width: 42px;
        min-height: 42px;
        justify-content: center;
    }
    .rag-summary-action {
        border: none;
        background: transparent;
        padding: 6px 0;
        font-size: 13px;
        font-weight: 600;
        color: color-mix(in srgb, var(--ds-text-secondary) 88%, transparent);
        cursor: pointer;
        white-space: nowrap;
    }
    .rag-summary-action:disabled {
        opacity: 0.45;
        cursor: default;
    }
    .rag-empty {
        font-style: italic;
    }
    .rag-settings-form {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
    }
    .rag-setting-row {
        display: flex;
        align-items: center;
    }
    .rag-label {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-secondary);
    }
    .rag-section-title {
        font-size: var(--ds-font-size-sm);
        font-weight: var(--ds-font-weight-bold);
        color: var(--ds-text-primary);
        margin-bottom: var(--ds-space-2);
        display: block;
    }
    .rag-last-retrieval {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }
    .rag-query-box {
        background: var(--ds-surface-1);
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-sm);
        font-size: var(--ds-font-size-xs);
    }
    .rag-query-text {
        color: var(--ds-text-primary);
        font-style: italic;
    }
    .rag-result-list {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
    }
    .rag-result-item {
        padding: var(--ds-space-2);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
    }
    .rag-result-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--ds-border-subtle);
        padding-bottom: var(--ds-space-1);
        margin-bottom: var(--ds-space-1);
    }
    .rag-result-source {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-secondary);
        font-weight: var(--ds-font-weight-bold);
    }
    .rag-result-score {
        font-size: 10px;
        color: var(--color-green-500);
    }
    .rag-result-content {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-primary);
        white-space: pre-wrap;
        max-height: 250px;
        overflow-y: auto;
    }
    @media (max-width: 640px) {
        .rag-rulebook-summary {
            align-items: stretch;
            flex-direction: column;
        }
        .rag-summary-action {
            align-self: flex-start;
        }
        .rag-rulebook-item {
            align-items: flex-start;
        }
        .rag-rulebook-actions {
            padding-top: 2px;
        }
    }
</style>
