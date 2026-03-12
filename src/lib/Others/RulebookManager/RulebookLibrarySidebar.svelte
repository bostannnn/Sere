<script lang="ts">
    import { BookIcon, ChevronRightIcon, LayoutGridIcon } from "@lucide/svelte";
    import { DBState } from "src/ts/stores.svelte";
    import NumberInput from "../../UI/GUI/NumberInput.svelte";
    import EmbeddingModelSelect from "../../UI/GUI/EmbeddingModelSelect.svelte";
    import type { EmbeddingModel } from "src/ts/process/memory/embeddings";
    import { DEFAULT_GLOBAL_RAG_SETTINGS } from "src/ts/storage/database.svelte";

    interface Props {
        section: "library" | "settings";
        systemTree?: Array<[string, Set<string>]>;
        expandedSystems?: Set<string>;
        selectedSystemFilter?: string;
        selectedEditionFilter?: string;
        rulebookCount?: number;
        onToggleSystem?: (system: string) => void;
        onSelectSystem?: (system: string) => void;
        onSelectEdition?: (system: string, edition: string) => void;
        onClearFilters?: () => void;
    }

    let {
        section,
        systemTree = [],
        expandedSystems = new Set<string>(),
        selectedSystemFilter = "All",
        selectedEditionFilter = "All",
        rulebookCount = 0,
        onToggleSystem = () => {},
        onSelectSystem = () => {},
        onSelectEdition = () => {},
        onClearFilters = () => {},
    }: Props = $props();

    let ragModel = $state((DBState.db.globalRagSettings.model ?? DEFAULT_GLOBAL_RAG_SETTINGS.model) as EmbeddingModel);
    let ragTopK = $state(Number(DBState.db.globalRagSettings.topK ?? DEFAULT_GLOBAL_RAG_SETTINGS.topK));
    let ragMinScore = $state(Number(DBState.db.globalRagSettings.minScore ?? DEFAULT_GLOBAL_RAG_SETTINGS.minScore));
    let ragBudget = $state(Number(DBState.db.globalRagSettings.budget ?? DEFAULT_GLOBAL_RAG_SETTINGS.budget));

    $effect(() => {
        DBState.db.globalRagSettings.model = ragModel;
        DBState.db.globalRagSettings.topK = ragTopK;
        DBState.db.globalRagSettings.minScore = ragMinScore;
        DBState.db.globalRagSettings.budget = ragBudget;
    });
</script>

<div class="rag-sidebar-shell is-drawer">
    {#if section === "library"}
        <section class="rag-sidebar-section">
            <h3 class="rag-sidebar-title">Library</h3>
            <div class="rag-system-list list-shell" data-testid="rulebook-library-system-list">
                <button
                    type="button"
                    class="rag-system-item"
                    class:is-active={selectedSystemFilter === "All"}
                    onclick={onClearFilters}
                >
                    <LayoutGridIcon size={14} />
                    <span>All Documents</span>
                </button>

                <div class="rag-sidebar-separator"></div>

                {#each systemTree as [system, editions] (system)}
                    <div class="rag-tree-node">
                        <div class="rag-system-row" class:is-active={selectedSystemFilter === system && selectedEditionFilter === "All"}>
                            <button
                                type="button"
                                class="rag-tree-toggle icon-btn icon-btn--sm"
                                onclick={() => onToggleSystem(system)}
                                title={expandedSystems.has(system) ? `Collapse ${system}` : `Expand ${system}`}
                                aria-label={expandedSystems.has(system) ? `Collapse ${system} editions` : `Expand ${system} editions`}
                                aria-expanded={expandedSystems.has(system)}
                            >
                                <span class="rag-tree-icon-wrap" style:transform={expandedSystems.has(system) ? "rotate(90deg)" : ""}>
                                    <ChevronRightIcon size={14} />
                                </span>
                            </button>
                            <button type="button" class="rag-system-name" onclick={() => onSelectSystem(system)}>
                                <span>{system}</span>
                            </button>
                        </div>

                        {#if expandedSystems.has(system)}
                            <div class="rag-edition-list">
                                {#each Array.from(editions).sort() as edition (edition)}
                                    <button
                                        type="button"
                                        class="rag-edition-item"
                                        class:is-active={selectedSystemFilter === system && selectedEditionFilter === edition}
                                        onclick={() => onSelectEdition(system, edition)}
                                    >
                                        <span>{edition}</span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>
        <div class="rag-sidebar-footer">
            <div class="rag-stats">
                <span>{rulebookCount} Books</span>
            </div>
        </div>
    {:else}
        <section class="rag-sidebar-section">
            <h3 class="rag-sidebar-title">RAG Settings</h3>
            <div class="rag-sidebar-config">
                <div class="rag-setting-field">
                    <span class="rag-label">Embedding Model</span>
                    <EmbeddingModelSelect bind:value={ragModel} />
                </div>
                <div class="rag-setting-field">
                    <span class="rag-label">Top K Chunks</span>
                    <NumberInput size="sm" min={1} max={10} bind:value={ragTopK} />
                </div>
                <div class="rag-setting-field">
                    <span class="rag-label">Min Similarity</span>
                    <NumberInput size="sm" min={0} max={1} bind:value={ragMinScore} />
                </div>
                <div class="rag-setting-field">
                    <span class="rag-label">Token Budget</span>
                    <NumberInput size="sm" min={0} max={4096} bind:value={ragBudget} />
                </div>
            </div>
        </section>
        <div class="rag-sidebar-footer">
            <div class="rag-stats rag-stats-muted">
                <BookIcon size={14} />
                <span>Library settings</span>
            </div>
        </div>
    {/if}
</div>

<style>
    .rag-sidebar-shell {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
        min-height: 0;
    }

    .rag-sidebar-shell.is-drawer {
        height: 100%;
        padding: var(--ds-space-2);
        gap: var(--ds-space-5);
    }

    .rag-sidebar-section {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .rag-sidebar-title {
        font-size: 10px;
        font-weight: var(--ds-font-weight-bold);
        text-transform: uppercase;
        color: var(--ds-text-secondary);
        letter-spacing: 1px;
        margin-bottom: var(--ds-space-1);
    }

    .rag-system-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .rag-system-list.list-shell {
        padding: 0;
        border: none;
        background: transparent;
        box-shadow: none;
    }

    .rag-system-item {
        display: flex;
        align-items: center;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2) var(--ds-space-3);
        border-radius: var(--ds-radius-sm);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        text-align: left;
        font-size: var(--ds-font-size-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
        width: 100%;
    }

    .rag-system-item:hover {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
    }

    .rag-system-item.is-active {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-medium);
    }

    .rag-system-item:focus-visible,
    .rag-tree-toggle:focus-visible,
    .rag-system-name:focus-visible,
    .rag-edition-item:focus-visible {
        outline: 2px solid var(--accent-strong);
        outline-offset: 1px;
    }

    .rag-sidebar-separator {
        height: 1px;
        background: var(--ds-border-subtle);
        margin: var(--ds-space-1) 0;
    }

    .rag-tree-node {
        display: flex;
        flex-direction: column;
    }

    .rag-system-row {
        display: flex;
        align-items: center;
        border-radius: var(--ds-radius-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-system-row:hover {
        background: var(--ds-surface-active);
    }

    .rag-system-row.is-active {
        background: var(--ds-surface-active);
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-medium);
    }

    .rag-tree-toggle {
        padding: var(--ds-space-2) 0 var(--ds-space-2) var(--ds-space-2);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .rag-tree-toggle.icon-btn.icon-btn--sm {
        width: 1.5rem;
        height: 1.5rem;
        min-width: 1.5rem;
        min-height: 1.5rem;
        padding: 0;
        border: none;
        border-color: transparent;
        background: transparent;
        box-shadow: none;
    }

    .rag-tree-icon-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-system-name {
        flex: 1;
        padding: var(--ds-space-2) var(--ds-space-3) var(--ds-space-2) var(--ds-space-1);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        text-align: left;
        font-size: var(--ds-font-size-sm);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .rag-system-row:hover .rag-system-name,
    .rag-system-row.is-active .rag-system-name {
        color: var(--ds-text-primary);
    }

    .rag-edition-list {
        display: flex;
        flex-direction: column;
        padding-left: 24px;
        margin-top: 2px;
        gap: 2px;
        border-left: 1px solid var(--ds-border-subtle);
        margin-left: 12px;
    }

    .rag-edition-item {
        padding: var(--ds-space-1) var(--ds-space-3);
        background: transparent;
        border: none;
        color: var(--ds-text-secondary);
        cursor: pointer;
        text-align: left;
        font-size: 11px;
        border-radius: var(--ds-radius-sm);
        transition: all var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .rag-edition-item:hover {
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
    }

    .rag-edition-item.is-active {
        color: var(--ds-text-primary);
        background: var(--ds-surface-3);
        font-weight: var(--ds-font-weight-bold);
    }

    .rag-sidebar-config {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-4);
    }

    .rag-setting-field {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .rag-label {
        font-size: 11px;
        font-weight: var(--ds-font-weight-medium);
        color: var(--ds-text-secondary);
    }

    .rag-sidebar-footer {
        margin-top: auto;
        padding-top: var(--ds-space-2);
        border-top: 1px solid var(--ds-border-subtle);
    }

    .rag-stats {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        font-size: var(--ds-font-size-sm);
        color: var(--ds-text-secondary);
    }

    .rag-stats-muted {
        opacity: 0.88;
    }
</style>
