<script lang="ts">
    import { Trash2Icon, PlusIcon, DatabaseIcon } from "@lucide/svelte";
    import { DBState, selectedCharID, stateEditorActive } from "src/ts/stores.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import IconButton from "../UI/GUI/IconButton.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { fade } from "svelte/transition";
    import { onMount, onDestroy } from "svelte";

    onMount(() => {
        stateEditorActive.set(true);
    });

    onDestroy(() => {
        stateEditorActive.set(false);
    });

    const char = $derived(DBState.db.characters[$selectedCharID]);
    const gameState = $derived(char.gameState || {});
    const keys = $derived(Object.keys(gameState).sort());

    let newKey = $state("");
    let newValue = $state("");

    function updateValue(key: string, val: unknown) {
        if (!char.gameState) char.gameState = {};
        char.gameState[key] = val;
        // Trigger reactivity
        char.gameState = { ...char.gameState };
    }

    function removeKey(key: string) {
        if (char.gameState) {
            delete char.gameState[key];
            char.gameState = { ...char.gameState };
        }
    }

    function addEntry() {
        if (!newKey.trim()) return;
        if (!char.gameState) char.gameState = {};
        
        // Normalize key
        const normalized = newKey.trim().toLowerCase().replace(/\s+/g, '_');
        char.gameState[normalized] = newValue;
        char.gameState = { ...char.gameState };
        
        newKey = "";
        newValue = "";
    }

    function clearState() {
        if (confirm("Are you sure you want to clear all tracked stats for this character?")) {
            char.gameState = {};
        }
    }
</script>

<div class="game-state-editor panel-shell" data-testid="game-state-editor-root">
    <div class="state-header action-rail">
        <div class="state-title">
            <DatabaseIcon size={18} />
            <span>Active Session Variables</span>
        </div>
        <Button size="sm" styled="outlined" onclick={clearState}>Clear All</Button>
    </div>

    <p class="state-help-text">
        These variables are automatically captured from the AI's [SYSTEM] block. 
        You can manually override or add new ones here.
    </p>

    <div class="state-table-container panel-shell list-shell" data-testid="game-state-editor-list">
        <table class="state-table">
            <thead>
                <tr>
                    <th>Variable</th>
                    <th>Value</th>
                    <th class="actions-col"></th>
                </tr>
            </thead>
            <tbody>
                {#each keys as key (key)}
                    <tr transition:fade={{ duration: 100 }}>
                        <td class="key-cell"><code>{key}</code></td>
                        <td>
                            <TextInput 
                                size="sm" 
                                value={gameState[key]} 
                                className="state-value-input"
                                oninput={(e) => updateValue(key, (e.target as HTMLInputElement).value)} 
                            />
                        </td>
                        <td class="actions-col">
                            <IconButton
                                onclick={() => removeKey(key)}
                                className="state-row-action"
                                title="Remove variable"
                                ariaLabel={`Remove ${key}`}
                            >
                                <Trash2Icon size={14} />
                            </IconButton>
                        </td>
                    </tr>
                {/each}
                {#if keys.length === 0}
                    <tr>
                        <td colspan="3" class="empty-msg empty-state" data-testid="game-state-editor-empty">No variables tracked yet.</td>
                    </tr>
                {/if}
            </tbody>
        </table>
    </div>

    <div class="state-add-row action-rail panel-shell" data-testid="game-state-editor-add-row">
        <TextInput placeholder="New variable (e.g. hunger)" bind:value={newKey} size="sm" className="state-add-input state-add-input-key" />
        <TextInput placeholder="Value" bind:value={newValue} size="sm" className="state-add-input state-add-input-value" />
        <IconButton onclick={addEntry} className="add-btn state-add-btn" title="Add variable" ariaLabel="Add variable">
            <PlusIcon size={18} />
        </IconButton>
    </div>
</div>

<style>
    .game-state-editor {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        color: var(--ds-text-primary);
    }

    .game-state-editor.panel-shell {
        padding: var(--ds-space-3);
    }

    .state-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .state-header.action-rail {
        gap: var(--ds-space-2);
    }

    .state-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: var(--ds-font-weight-bold);
        font-size: var(--ds-font-size-md);
    }

    .state-help-text {
        font-size: var(--ds-font-size-xs);
        color: var(--ds-text-secondary);
        margin: 0;
        line-height: 1.4;
    }

    .state-table-container {
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
        overflow: hidden;
    }

    .state-table-container.panel-shell.list-shell {
        padding: 0;
    }

    .state-table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--ds-font-size-sm);
    }

    .state-table th {
        text-align: left;
        padding: var(--ds-space-2) var(--ds-space-3);
        background: var(--ds-surface-2);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--ds-text-secondary);
        border-bottom: 1px solid var(--ds-border-subtle);
    }

    .state-table td {
        padding: var(--ds-space-2) var(--ds-space-3);
        border-bottom: 1px solid var(--ds-border-subtle);
    }

    .state-table tr:last-child td {
        border-bottom: none;
    }

    .key-cell {
        font-family: var(--ds-font-family-mono);
        color: var(--ds-text-secondary);
    }

    .actions-col {
        width: 40px;
        text-align: center;
    }

    .empty-msg {
        text-align: center;
        color: var(--ds-text-secondary);
        font-style: italic;
        padding: var(--ds-space-6) !important;
    }

    .empty-msg.empty-state {
        border: none;
        border-radius: 0;
        box-shadow: none;
        background: transparent;
    }

    .state-add-row {
        display: grid;
        grid-template-columns: 1fr 1fr 40px;
        gap: var(--ds-space-2);
        align-items: center;
        background: var(--ds-surface-2);
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-md);
        border: 1px dashed var(--ds-border-subtle);
    }

    .state-add-row.action-rail.panel-shell {
        justify-content: stretch;
    }

    :global(.state-value-input.control-field),
    :global(.state-add-input.control-field) {
        width: 100%;
    }

    :global(.add-btn.state-add-btn) {
        color: var(--ds-text-success) !important;
    }
</style>
