<script lang="ts">
    import { DBState, selIdState, ragLastResult, alertStore } from 'src/ts/stores.svelte';
    import { BookIcon, CheckIcon } from "@lucide/svelte";
    import { rulebookStorage } from "../../../ts/process/rag/storage";
    import Check from "../../UI/GUI/CheckInput.svelte";
    import IconButton from "../../UI/GUI/IconButton.svelte";
    import { onMount } from 'svelte';

    const lastRet = $derived($ragLastResult);
    let rulebooks = $state<{ id: string; name: string; chunkCount?: number; thumbnail?: string; metadata?: import("../../../ts/process/rag/types").RagIndexMetadata }[]>([]);

    const char = $derived(DBState.db.characters[selIdState.selId]);
    const ragSettings = $derived(char?.ragSettings);
    const enabledRulebooks = $derived(ragSettings?.enabledRulebooks || []);
    const rulebookRagSettingLog = (..._args: unknown[]) => {};

    onMount(async () => {
        try {
            const res = await rulebookStorage.listRulebooks();
            rulebookRagSettingLog("[RAG] Character Settings Refresh:", res);
            rulebooks = res;
        } catch (e) {
            rulebookRagSettingLog("Failed to fetch rulebooks:", e);
            alertStore.set({ type: 'error', msg: `Failed to fetch rulebooks: ${e.message}` });
        }
    });

    function toggleRulebook(id: string) {
        if (!char) return;
        if (!char.ragSettings) {
            char.ragSettings = { enabled: false, enabledRulebooks: [] };
        }

        const index = char.ragSettings.enabledRulebooks.indexOf(id);
        if (index === -1) {
            char.ragSettings.enabledRulebooks.push(id);
        } else {
            char.ragSettings.enabledRulebooks.splice(index, 1);
        }
    }

    function ensureSettings() {
        if (char && !char.ragSettings) {
            char.ragSettings = { enabled: false, enabledRulebooks: [] };
        }
    }
</script>

<div class="rag-rulebook-container">
    <div class="rag-rulebook-list list-shell" data-testid="rulebook-rag-list">
        {#each rulebooks as book (book.id)}
            {@const isEnabled = enabledRulebooks.includes(book.id)}
            <div class="ds-settings-card panel-shell rag-rulebook-item">
                <div class="rag-rulebook-info">
                    <BookIcon size={16} />
                    <div class="rag-rulebook-meta">
                        <span class="rag-rulebook-name">{book.name}</span>
                        <span class="rag-chunk-count">{book.chunkCount ?? 0} chunks</span>
                    </div>
                </div>
                <div class="rag-rulebook-actions action-rail" data-testid="rulebook-rag-actions">
                    <IconButton
                        onclick={() => toggleRulebook(book.id)}
                        className={`rag-rulebook-toggle-btn icon-btn icon-btn--sm${isEnabled ? " rag-toggle-btn-enabled" : ""}`}
                    >
                        <CheckIcon size={16} />
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
            <Check check={ragSettings?.enabled ?? false} onChange={(v) => {
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
    .rag-rulebook-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--ds-space-2) var(--ds-space-3);
    }
    .rag-rulebook-info {
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        color: var(--ds-text-primary);
    }
    .rag-rulebook-meta {
        display: flex;
        flex-direction: column;
    }
    .rag-rulebook-name {
        font-size: var(--ds-font-size-sm);
        word-break: break-all;
    }
    .rag-chunk-count {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-secondary);
    }
    .rag-rulebook-actions {
        justify-content: flex-end;
    }
    :global(.rag-toggle-btn-enabled) {
        color: var(--ds-text-success) !important;
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
</style>
