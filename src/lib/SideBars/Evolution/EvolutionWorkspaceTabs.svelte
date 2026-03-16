<script lang="ts">
    import { Clock3Icon, ClipboardCheckIcon, FileStackIcon, Settings2Icon, SlidersHorizontalIcon } from "@lucide/svelte"
    import SettingsSubTabs, { type SettingsSubTabItem } from "src/lib/Setting/SettingsSubTabs.svelte"
    import {
        EVOLUTION_HISTORY_TAB,
        EVOLUTION_REVIEW_TAB,
        EVOLUTION_SECTIONS_TAB,
        EVOLUTION_SETUP_TAB,
        EVOLUTION_STATE_TAB,
        EVOLUTION_TAB_LABELS,
        type EvolutionWorkspaceTabId,
    } from "./evolutionSettingsTabs"

    interface Props {
        selectedTab: EvolutionWorkspaceTabId
        onSelect: (tab: EvolutionWorkspaceTabId) => void
    }

    let { selectedTab, onSelect }: Props = $props()

    const tabItems: SettingsSubTabItem[] = [
        {
            id: EVOLUTION_SETUP_TAB,
            label: EVOLUTION_TAB_LABELS[EVOLUTION_SETUP_TAB],
            ariaLabel: EVOLUTION_TAB_LABELS[EVOLUTION_SETUP_TAB],
            buttonId: "evolution-subtab-0",
            controls: "evolution-panel-setup",
            icon: Settings2Icon,
            iconSize: 18,
            hideLabel: true,
        },
        {
            id: EVOLUTION_SECTIONS_TAB,
            label: EVOLUTION_TAB_LABELS[EVOLUTION_SECTIONS_TAB],
            ariaLabel: EVOLUTION_TAB_LABELS[EVOLUTION_SECTIONS_TAB],
            buttonId: "evolution-subtab-1",
            controls: "evolution-panel-sections",
            icon: SlidersHorizontalIcon,
            iconSize: 18,
            hideLabel: true,
        },
        {
            id: EVOLUTION_REVIEW_TAB,
            label: EVOLUTION_TAB_LABELS[EVOLUTION_REVIEW_TAB],
            ariaLabel: EVOLUTION_TAB_LABELS[EVOLUTION_REVIEW_TAB],
            buttonId: "evolution-subtab-2",
            controls: "evolution-panel-review",
            icon: ClipboardCheckIcon,
            iconSize: 18,
            hideLabel: true,
        },
        {
            id: EVOLUTION_STATE_TAB,
            label: EVOLUTION_TAB_LABELS[EVOLUTION_STATE_TAB],
            ariaLabel: EVOLUTION_TAB_LABELS[EVOLUTION_STATE_TAB],
            buttonId: "evolution-subtab-3",
            controls: "evolution-panel-state",
            icon: FileStackIcon,
            iconSize: 18,
            hideLabel: true,
        },
        {
            id: EVOLUTION_HISTORY_TAB,
            label: EVOLUTION_TAB_LABELS[EVOLUTION_HISTORY_TAB],
            ariaLabel: EVOLUTION_TAB_LABELS[EVOLUTION_HISTORY_TAB],
            buttonId: "evolution-subtab-4",
            controls: "evolution-panel-history",
            icon: Clock3Icon,
            iconSize: 18,
            hideLabel: true,
        },
    ]
</script>

<SettingsSubTabs
    items={tabItems}
    selectedId={selectedTab}
    tablistAriaLabel="Character evolution sections"
    tabsClassName="evolution-subtabs"
    tabClassName="evolution-subtab"
    onSelect={(tab) => {
        onSelect(tab as EvolutionWorkspaceTabId)
    }}
/>

<style>
    :global(.ds-settings-tabs.evolution-subtabs) {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        align-items: stretch;
        overflow: hidden;
    }

    :global(.ds-settings-tab.evolution-subtab) {
        width: 100%;
        min-width: 0;
        height: var(--ds-settings-tab-height);
        min-height: var(--ds-settings-tab-height);
        padding: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }

    :global(.ds-settings-tab.evolution-subtab svg) {
        width: 18px;
        height: 18px;
    }
</style>
