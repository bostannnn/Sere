<script lang="ts">
    import { BotIcon, PackageIcon, Sailboat } from "@lucide/svelte";
    import { QuickSettings } from "src/ts/stores.svelte";
    import BotSettings from "../Setting/Pages/BotSettings.svelte";
    import OtherBotSettings from "../Setting/Pages/OtherBotSettings.svelte";
    import ModuleSettings from "../Setting/Pages/Module/ModuleSettings.svelte";

    const tabLabels = [
        "Chat bot settings",
        "Other bot settings",
        "Module settings",
    ] as const;

    const tabIds = [
        "quick-settings-tab-0",
        "quick-settings-tab-1",
        "quick-settings-tab-2",
    ] as const;

    const panelIds = [
        "quick-settings-panel-0",
        "quick-settings-panel-1",
        "quick-settings-panel-2",
    ] as const;

    const setQuickSettingsTab = (nextIndex: number) => {
        QuickSettings.index = nextIndex;
    };

    const handleTabKeydown = (event: KeyboardEvent, currentIndex: number) => {
        if (event.key === "Home") {
            setQuickSettingsTab(0);
            event.preventDefault();
            return;
        }
        if (event.key === "End") {
            setQuickSettingsTab(2);
            event.preventDefault();
            return;
        }
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "Right" && event.key !== "Left") {
            return;
        }
        const direction = event.key === "ArrowRight" || event.key === "Right" ? 1 : -1;
        const nextIndex = (currentIndex + direction + tabIds.length) % tabIds.length;
        setQuickSettingsTab(nextIndex);
        event.preventDefault();
    };
</script>

<div class="ds-quick-settings-tabs seg-tabs" role="tablist" aria-label="Quick settings categories">
    <button
        type="button"
        class="ds-quick-settings-tab seg-tab icon-btn icon-btn--md"
        id={tabIds[0]}
        role="tab"
        title={tabLabels[0]}
        aria-label={tabLabels[0]}
        aria-selected={QuickSettings.index === 0}
        aria-controls={panelIds[0]}
        tabindex={QuickSettings.index === 0 ? 0 : -1}
        class:is-active={QuickSettings.index === 0}
        class:active={QuickSettings.index === 0}
        onclick={() => {setQuickSettingsTab(0)}}
        onkeydown={(event) => handleTabKeydown(event, 0)}
    >
        <BotIcon />
    </button>
    <button
        type="button"
        class="ds-quick-settings-tab seg-tab icon-btn icon-btn--md"
        id={tabIds[1]}
        role="tab"
        title={tabLabels[1]}
        aria-label={tabLabels[1]}
        aria-selected={QuickSettings.index === 1}
        aria-controls={panelIds[1]}
        tabindex={QuickSettings.index === 1 ? 0 : -1}
        class:is-active={QuickSettings.index === 1}
        class:active={QuickSettings.index === 1}
        onclick={() => {setQuickSettingsTab(1)}}
        onkeydown={(event) => handleTabKeydown(event, 1)}
    >
        <Sailboat />
    </button>
    <button
        type="button"
        class="ds-quick-settings-tab seg-tab icon-btn icon-btn--md"
        id={tabIds[2]}
        role="tab"
        title={tabLabels[2]}
        aria-label={tabLabels[2]}
        aria-selected={QuickSettings.index === 2}
        aria-controls={panelIds[2]}
        tabindex={QuickSettings.index === 2 ? 0 : -1}
        class:is-active={QuickSettings.index === 2}
        class:active={QuickSettings.index === 2}
        onclick={() => {setQuickSettingsTab(2)}}
        onkeydown={(event) => handleTabKeydown(event, 2)}
    >
        <PackageIcon />
    </button>
</div>

<div class="ds-quick-settings-content rs-setting-cont-5">
    {#if QuickSettings.index === 0}
        <div id={panelIds[0]} role="tabpanel" aria-labelledby={tabIds[0]}>
            <BotSettings />
        </div>
    {:else if QuickSettings.index === 1}
        <div id={panelIds[1]} role="tabpanel" aria-labelledby={tabIds[1]}>
            <OtherBotSettings />
        </div>
    {:else if QuickSettings.index === 2}
        <div id={panelIds[2]} role="tabpanel" aria-labelledby={tabIds[2]}>
            <ModuleSettings />
        </div>
    {/if}
</div>
