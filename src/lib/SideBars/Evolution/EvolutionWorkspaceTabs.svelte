<script lang="ts">
    import { Clock3Icon, ClipboardCheckIcon, FileStackIcon, Settings2Icon, SlidersHorizontalIcon } from "@lucide/svelte"
    import { tick } from "svelte"
    import {
        EVOLUTION_HISTORY_TAB,
        EVOLUTION_REVIEW_TAB,
        EVOLUTION_SECTIONS_TAB,
        EVOLUTION_SETUP_TAB,
        EVOLUTION_STATE_TAB,
        EVOLUTION_TAB_LABELS,
        EVOLUTION_TAB_ORDER,
        getHorizontalDirection,
        getNextEvolutionTab,
        type EvolutionWorkspaceTabId,
    } from "./evolutionSettingsTabs"

    interface Props {
        selectedTab: EvolutionWorkspaceTabId
        onSelect: (tab: EvolutionWorkspaceTabId) => void
    }

    let { selectedTab, onSelect }: Props = $props()

    const iconSize = 18

    function focusTab(tab: EvolutionWorkspaceTabId) {
        const tabButton = document.getElementById(`evolution-subtab-${tab}`) as HTMLButtonElement | null
        tabButton?.focus()
    }

    async function selectTabAndFocus(tab: EvolutionWorkspaceTabId) {
        onSelect(tab)
        await tick()
        focusTab(tab)
    }

    async function handleTabKeydown(event: KeyboardEvent, currentTab: EvolutionWorkspaceTabId = selectedTab) {
        if (event.key === "Home") {
            await selectTabAndFocus(EVOLUTION_TAB_ORDER[0])
            event.preventDefault()
            return
        }

        if (event.key === "End") {
            await selectTabAndFocus(EVOLUTION_TAB_ORDER[EVOLUTION_TAB_ORDER.length - 1])
            event.preventDefault()
            return
        }

        const direction = getHorizontalDirection(event.key)
        if (direction === 0) {
            return
        }

        await selectTabAndFocus(getNextEvolutionTab(currentTab, direction))
        event.preventDefault()
    }
</script>

<div
    class="evolution-subtabs seg-tabs"
    role="tablist"
    aria-label="Character evolution sections"
    tabindex="-1"
    onkeydown={(event) => {
        if (event.target !== event.currentTarget) {
            return
        }
        void handleTabKeydown(event)
    }}
>
    <button
        type="button"
        class="evolution-subtab seg-tab"
        class:active={selectedTab === EVOLUTION_SETUP_TAB}
        id="evolution-subtab-0"
        role="tab"
        aria-label={EVOLUTION_TAB_LABELS[EVOLUTION_SETUP_TAB]}
        aria-selected={selectedTab === EVOLUTION_SETUP_TAB}
        aria-controls="evolution-panel-setup"
        tabindex={selectedTab === EVOLUTION_SETUP_TAB ? 0 : -1}
        onclick={() => {
            void selectTabAndFocus(EVOLUTION_SETUP_TAB)
        }}
        onkeydown={(event) => {
            void handleTabKeydown(event, EVOLUTION_SETUP_TAB)
        }}
    >
        <Settings2Icon size={iconSize} />
    </button>

    <button
        type="button"
        class="evolution-subtab seg-tab"
        class:active={selectedTab === EVOLUTION_SECTIONS_TAB}
        id="evolution-subtab-1"
        role="tab"
        aria-label={EVOLUTION_TAB_LABELS[EVOLUTION_SECTIONS_TAB]}
        aria-selected={selectedTab === EVOLUTION_SECTIONS_TAB}
        aria-controls="evolution-panel-sections"
        tabindex={selectedTab === EVOLUTION_SECTIONS_TAB ? 0 : -1}
        onclick={() => {
            void selectTabAndFocus(EVOLUTION_SECTIONS_TAB)
        }}
        onkeydown={(event) => {
            void handleTabKeydown(event, EVOLUTION_SECTIONS_TAB)
        }}
    >
        <SlidersHorizontalIcon size={iconSize} />
    </button>

    <button
        type="button"
        class="evolution-subtab seg-tab"
        class:active={selectedTab === EVOLUTION_REVIEW_TAB}
        id="evolution-subtab-2"
        role="tab"
        aria-label={EVOLUTION_TAB_LABELS[EVOLUTION_REVIEW_TAB]}
        aria-selected={selectedTab === EVOLUTION_REVIEW_TAB}
        aria-controls="evolution-panel-review"
        tabindex={selectedTab === EVOLUTION_REVIEW_TAB ? 0 : -1}
        onclick={() => {
            void selectTabAndFocus(EVOLUTION_REVIEW_TAB)
        }}
        onkeydown={(event) => {
            void handleTabKeydown(event, EVOLUTION_REVIEW_TAB)
        }}
    >
        <ClipboardCheckIcon size={iconSize} />
    </button>

    <button
        type="button"
        class="evolution-subtab seg-tab"
        class:active={selectedTab === EVOLUTION_STATE_TAB}
        id="evolution-subtab-3"
        role="tab"
        aria-label={EVOLUTION_TAB_LABELS[EVOLUTION_STATE_TAB]}
        aria-selected={selectedTab === EVOLUTION_STATE_TAB}
        aria-controls="evolution-panel-state"
        tabindex={selectedTab === EVOLUTION_STATE_TAB ? 0 : -1}
        onclick={() => {
            void selectTabAndFocus(EVOLUTION_STATE_TAB)
        }}
        onkeydown={(event) => {
            void handleTabKeydown(event, EVOLUTION_STATE_TAB)
        }}
    >
        <FileStackIcon size={iconSize} />
    </button>

    <button
        type="button"
        class="evolution-subtab seg-tab"
        class:active={selectedTab === EVOLUTION_HISTORY_TAB}
        id="evolution-subtab-4"
        role="tab"
        aria-label={EVOLUTION_TAB_LABELS[EVOLUTION_HISTORY_TAB]}
        aria-selected={selectedTab === EVOLUTION_HISTORY_TAB}
        aria-controls="evolution-panel-history"
        tabindex={selectedTab === EVOLUTION_HISTORY_TAB ? 0 : -1}
        onclick={() => {
            void selectTabAndFocus(EVOLUTION_HISTORY_TAB)
        }}
        onkeydown={(event) => {
            void handleTabKeydown(event, EVOLUTION_HISTORY_TAB)
        }}
    >
        <Clock3Icon size={iconSize} />
    </button>
</div>

<style>
    .evolution-subtabs {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        align-items: center;
        gap: 2px;
        padding: 4px;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        overflow: hidden;
    }

    .evolution-subtab {
        width: 100%;
        min-width: 0;
        height: 32px;
        min-height: 32px;
        padding: 0;
        border: 0;
        border-radius: var(--ds-radius-sm);
        color: var(--ds-text-secondary);
        background: transparent;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition:
            color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .evolution-subtab:hover {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    .evolution-subtab.active {
        color: var(--ds-text-primary);
        background: var(--ds-surface-active);
    }

    :global(.evolution-subtab :global(svg)) {
        width: 16px;
        height: 16px;
        flex: 0 0 auto;
    }

    @media (min-width: 1400px) {
        .evolution-subtab {
            height: 36px;
            min-height: 36px;
        }

        :global(.evolution-subtab :global(svg)) {
            width: 20px;
            height: 20px;
        }
    }
</style>
