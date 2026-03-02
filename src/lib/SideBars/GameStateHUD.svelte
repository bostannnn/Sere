<script lang="ts">
    import { DBState, selectedCharID } from "src/ts/stores.svelte";
    import { slide } from "svelte/transition";
    import { ChevronDownIcon, DatabaseIcon } from "@lucide/svelte";

    const char = $derived(DBState.db.characters[$selectedCharID]);
    const gameState = $derived(char?.gameState || {});
    const entries = $derived(Object.entries(gameState).sort());
    
    let isExpanded = $state(false); // Default to collapsed for a clean ribbon look

    function formatKey(key: string) {
        return key.replace(/_/g, ' ');
    }

    // Priority keys that should always appear first
    const priorityKeys = ['hunger', 'health', 'candles', 'willpower', 'humanity', 'brink', 'blood', 'vitae', 'sanity'];
    
    // Memoized sort to prevent re-sorting on every streaming chunk update
    // Only re-sort when the set of keys actually changes
    const stateKeys = $derived(Object.keys(gameState).join(','));
    const sortedEntries = $derived.by(() => {
        void stateKeys; // Track keys change
        return [...entries].sort((a, b) => {
            const aName = a[0].toLowerCase();
            const bName = b[0].toLowerCase();
            const aPrio = priorityKeys.includes(aName) ? 0 : 1;
            const bPrio = priorityKeys.includes(bName) ? 0 : 1;
            return aPrio - bPrio || aName.localeCompare(bName);
        });
    });

    // Show up to 8 stats in the ribbon view if they exist
    const ribbonStats = $derived(sortedEntries.slice(0, 8));
</script>

{#if char && entries.length > 0}
    <div class="game-state-hud-ribbon" class:is-expanded={isExpanded}>
        <button class="hud-main-bar" onclick={() => isExpanded = !isExpanded}>
            <div class="hud-ribbon-content">
                <div class="hud-ribbon-label">
                    <DatabaseIcon size={12} />
                    <span class="desktop-only">CHRONICLE STATS</span>
                </div>
                
                <div class="hud-ribbon-stats">
                    {#each ribbonStats as [key, value] (key)}
                        <div class="ribbon-chip control-chip">
                            <span class="ribbon-key">{formatKey(key)}:</span>
                            <span class="ribbon-val">{value}</span>
                        </div>
                    {/each}
                    {#if entries.length > ribbonStats.length}
                        <span class="more-indicator control-chip">+{entries.length - ribbonStats.length} more</span>
                    {/if}
                </div>
            </div>
            
            <div class="hud-toggle-section">
                <span class="hud-toggle-wrap" style:transform={isExpanded ? 'rotate(180deg)' : ''}>
                    <ChevronDownIcon size={14} />
                </span>
            </div>
        </button>

        {#if isExpanded}
            <div class="hud-expanded-overlay" transition:slide={{ duration: 250 }}>
                <div class="hud-full-grid">
                    {#each entries as [key, value] (key)}
                        <div class="hud-full-item panel-shell">
                            <span class="full-key">{formatKey(key)}</span>
                            <span class="full-val">{value}</span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .game-state-hud-ribbon {
        position: sticky;
        top: 0;
        z-index: 100;
        background: color-mix(in srgb, var(--ds-surface-2) 85%, transparent);
        backdrop-filter: blur(8px);
        border-bottom: 1px solid var(--ds-border-subtle);
        width: 100%;
        transition: all var(--ds-motion-normal) var(--ds-ease-standard);
    }

    .hud-main-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px var(--ds-space-4);
        background: transparent;
        border: none;
        cursor: pointer;
        width: 100%;
        min-height: 36px;
        color: var(--ds-text-secondary);
    }

    .hud-main-bar:hover {
        background: var(--ds-surface-active);
    }

    .hud-ribbon-content {
        display: flex;
        align-items: center;
        gap: var(--ds-space-4);
        flex: 1;
        min-width: 0;
    }

    .hud-ribbon-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 10px;
        font-weight: var(--ds-font-weight-bold);
        letter-spacing: 1px;
        color: var(--ds-text-primary);
        opacity: 0.8;
        flex-shrink: 0;
    }

    .hud-ribbon-stats {
        display: flex;
        align-items: center;
        gap: 12px;
        overflow-x: auto;
        scrollbar-width: none; /* Hide scrollbar for clean look */
        padding-right: 20px; /* Space for the fade edge */
        mask-image: linear-gradient(to right, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
        
        /* Mobile Polish */
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x mandatory;
        scroll-behavior: smooth;
    }

    .hud-ribbon-stats::-webkit-scrollbar {
        display: none;
    }

    .ribbon-chip {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        white-space: nowrap;
        scroll-snap-align: start;
    }

    .ribbon-key {
        color: var(--ds-text-secondary);
        font-size: 10px;
        text-transform: uppercase;
    }

    .ribbon-val {
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-bold);
    }

    .more-indicator {
        font-size: 10px;
        background: var(--ds-surface-3);
        padding: 1px 6px;
        border-radius: var(--ds-radius-pill);
        color: var(--ds-text-secondary);
    }

    .hud-toggle-wrap {
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform var(--ds-motion-normal) var(--ds-ease-standard);
    }

    .hud-expanded-overlay {
        background: var(--ds-surface-1);
        padding: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-subtle);
        box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
    }

    .hud-full-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 10px;
    }

    .hud-full-item {
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .full-key {
        font-size: 9px;
        text-transform: uppercase;
        color: var(--ds-text-secondary);
        letter-spacing: 0.5px;
    }

    .full-val {
        font-size: 13px;
        font-weight: var(--ds-font-weight-bold);
        color: var(--ds-text-primary);
        word-break: break-all;
    }

    @media (max-width: 640px) {
        .desktop-only { display: none; }
        .hud-ribbon-content { gap: var(--ds-space-2); }
        .ribbon-chip { font-size: 11px; }
    }
</style>
