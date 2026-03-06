<script lang="ts">
    import { AccessibilityIcon, ActivityIcon, PackageIcon, BotIcon, CodeIcon, ContactIcon, LanguagesIcon, MonitorIcon, Sailboat, CircleXIcon, KeyboardIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import DisplaySettings from "./Pages/DisplaySettings.svelte";
    import BotSettings from "./Pages/BotSettings.svelte";
    import OtherBotSettings from "./Pages/OtherBotSettings.svelte";
    import PluginSettings from "./Pages/PluginSettings.svelte";
    import AdvancedSettings from "./Pages/AdvancedSettings.svelte";
    import { additionalSettingsMenu, DBState, MobileGUI, SettingsMenuIndex, settingsOpen, SizeStore } from "src/ts/stores.svelte";
    import LanguageSettings from "./Pages/LanguageSettings.svelte";
    import AccessibilitySettings from "./Pages/AccessibilitySettings.svelte";
    import PersonaSettings from "./Pages/PersonaSettings.svelte";
    import PromptSettings from "./Pages/PromptSettings.svelte";
    import ModuleSettings from "./Pages/Module/ModuleSettings.svelte";
    import { isLite } from "src/ts/lite";
    import HotkeySettings from "./Pages/HotkeySettings.svelte";
    import ComfyCommanderPage from "./Pages/ComfyCommanderPage.svelte";
    import LogsSettingsPage from "./Pages/LogsSettingsPage.svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";
    import { isWebKit } from "src/ts/platform";
    import Button from "src/lib/UI/GUI/Button.svelte";

    const isDesktopSettings = $derived($SizeStore.w >= 700 && !$MobileGUI)
    const isStackedSettings = $derived(!isDesktopSettings)
    const allowedSettingsMenus = new Set([-1, 1, 2, 3, 4, 6, 10, 11, 12, 13, 14, 15, 16, 17]);

    function selectMenu(index: number) {
        if ($SettingsMenuIndex === index) {
            return;
        }
        $SettingsMenuIndex = index;
    }

    function closeSettingsPanel() {
        if (isDesktopSettings) {
            settingsOpen.set(false);
            return;
        }
        $SettingsMenuIndex = -1;
    }

    function handleNavListKeydown(event: KeyboardEvent) {
        const current = event.currentTarget;
        if (!(current instanceof HTMLButtonElement)) return;
        if (!current.classList.contains('ds-settings-nav-item')) return;

        const navRoot = current.closest('.ds-settings-nav-shell');
        if (!(navRoot instanceof HTMLElement)) return;

        const navButtons = Array.from(navRoot.querySelectorAll<HTMLButtonElement>('button.ds-settings-nav-item'));
        const currentIndex = navButtons.indexOf(current);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;
        switch (event.key) {
            case 'ArrowDown':
            case 'ArrowRight':
                nextIndex = (currentIndex + 1) % navButtons.length;
                break;
            case 'ArrowUp':
            case 'ArrowLeft':
                nextIndex = (currentIndex - 1 + navButtons.length) % navButtons.length;
                break;
            case 'Home':
                nextIndex = 0;
                break;
            case 'End':
                nextIndex = navButtons.length - 1;
                break;
            default:
                return;
        }

        event.preventDefault();
        const nextButton = navButtons[nextIndex];
        if (!nextButton) return;
        nextButton.focus();
        nextButton.click();
    }

    // Keep desktop settings opening deterministic after mobile/back transitions.
    $effect(() => {
        if ($SettingsMenuIndex === 15 && $SizeStore.w < 768) {
            $SettingsMenuIndex = isDesktopSettings ? 1 : -1;
            return;
        }
        if (!allowedSettingsMenus.has($SettingsMenuIndex)) {
            $SettingsMenuIndex = isDesktopSettings ? 1 : -1;
            return;
        }
        if ($SizeStore.w >= 900 && $SettingsMenuIndex === -1 && !$MobileGUI) {
            $SettingsMenuIndex = 1;
        }
    });

</script>
<div class="ds-settings-shell" class:ds-settings-shell-mobile-bg={$MobileGUI} class:ds-settings-shell-bg={!$MobileGUI} class:ds-settings-webkit-fix={isWebKit}>
    <div class="ds-settings-shell-inner">
        {#if isDesktopSettings || $SettingsMenuIndex === -1}
            <div class="ds-settings-nav-panel ds-settings-nav-shell"
                class:ds-settings-nav-shell-force-single-column={isStackedSettings}
                class:ds-settings-nav-shell-stacked={isStackedSettings}
                class:ds-settings-nav-shell-mobile-bg={$MobileGUI}
                class:ds-settings-nav-shell-desktop-bg={!$MobileGUI}
            >
                
                {#if !$isLite}
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.chatBot}
                        aria-label={language.chatBot}
                        aria-pressed={$SettingsMenuIndex === 1 || $SettingsMenuIndex === 13}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 1 || $SettingsMenuIndex === 13}
                        onclick={() => {
                            selectMenu(1)
                    }}>
                        <BotIcon />
                        <span>{language.chatBot}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.otherBots}
                        aria-label={language.otherBots}
                        aria-pressed={$SettingsMenuIndex === 2}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 2}
                        onclick={() => {
                            selectMenu(2)
                    }}>
                        <Sailboat />
                        <span>{language.otherBots}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.persona}
                        aria-label={language.persona}
                        aria-pressed={$SettingsMenuIndex === 12}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 12}
                        onclick={() => {
                            selectMenu(12)
                    }}>
                        <ContactIcon />
                        <span>{language.persona}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.display}
                        aria-label={language.display}
                        aria-pressed={$SettingsMenuIndex === 3}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 3}
                        onclick={() => {
                            selectMenu(3)
                    }}>
                        <MonitorIcon />
                        <span>{language.display}</span>
                    </button>
                {/if}
                <button
                    type="button"
                    class="ds-settings-nav-item"
                    title={language.language}
                    aria-label={language.language}
                    aria-pressed={$SettingsMenuIndex === 10}
                    onkeydown={handleNavListKeydown}
                    class:is-active={$SettingsMenuIndex === 10}
                    onclick={() => {
                        selectMenu(10)
                }}>
                    <LanguagesIcon />
                    <span>{language.language}</span>
                </button>
                {#if !$isLite}
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.accessibility}
                        aria-label={language.accessibility}
                        aria-pressed={$SettingsMenuIndex === 11}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 11}
                        onclick={() => {
                            selectMenu(11)
                    }}>
                        <AccessibilityIcon />
                        <span>{language.accessibility}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.modules}
                        aria-label={language.modules}
                        aria-pressed={$SettingsMenuIndex === 14}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 14}
                        onclick={() => {
                            selectMenu(14)
                    }}>
                        <PackageIcon />
                        <span>{language.modules}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.plugin}
                        aria-label={language.plugin}
                        aria-pressed={$SettingsMenuIndex === 4}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 4}
                        onclick={() => {
                        selectMenu(4)
                    }}>
                        <CodeIcon />
                        <span>{language.plugin}</span>
                    </button>
                {/if}
                {#if $SizeStore.w >= 768}
                        <button
                            type="button"
                            class="ds-settings-nav-item"
                            title={language.hotkey}
                            aria-label={language.hotkey}
                            aria-pressed={$SettingsMenuIndex === 15}
                            onkeydown={handleNavListKeydown}
                            class:is-active={$SettingsMenuIndex === 15}
                            onclick={() => {
                            selectMenu(15)
                        }}>
                            <KeyboardIcon />
                            <span>{language.hotkey}</span>
                        </button>
                {/if}
                {#if !$isLite}
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.advancedSettings}
                        aria-label={language.advancedSettings}
                        aria-pressed={$SettingsMenuIndex === 6}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 6}
                        onclick={() => {
                        selectMenu(6)
                    }}>
                        <ActivityIcon />
                        <span>{language.advancedSettings}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.comfyCommander}
                        aria-label={language.comfyCommander}
                        aria-pressed={$SettingsMenuIndex === 16}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 16}
                        onclick={() => {
                        selectMenu(16)
                    }}>
                        <ActivityIcon />
                        <span>{language.comfyCommander}</span>
                    </button>
                    <button
                        type="button"
                        class="ds-settings-nav-item"
                        title={language.logs}
                        aria-label={language.logs}
                        aria-pressed={$SettingsMenuIndex === 17}
                        onkeydown={handleNavListKeydown}
                        class:is-active={$SettingsMenuIndex === 17}
                        onclick={() => {
                        selectMenu(17)
                    }}>
                        <CodeIcon />
                        <span>{language.logs}</span>
                    </button>
                    {#each additionalSettingsMenu as menu, index (`${menu.name}-${index}`)}
                        <button
                            type="button"
                            class="ds-settings-nav-item"
                            title={menu.name}
                            aria-label={menu.name}
                            onkeydown={handleNavListKeydown}
                            onclick={() => {
                                menu.callback()
                        }}>
                            <PluginDefinedIcon ico={menu} />
                            <span>{menu.name}</span>
                        </button>
                    {/each}
                {/if}
            </div>
        {/if}
        {#if isDesktopSettings || $SettingsMenuIndex !== -1}
            {#key $SettingsMenuIndex}
                <div class="ds-settings-content-panel ds-settings-content-shell"
                    class:ds-settings-content-shell-stacked={isStackedSettings}>
                    {#if $SettingsMenuIndex === 1}
                        <BotSettings goPromptTemplate={() => {
                            $SettingsMenuIndex = 13
                        }} />
                    {:else if $SettingsMenuIndex === 2}
                        <OtherBotSettings />
                    {:else if $SettingsMenuIndex === 3}
                        <DisplaySettings />
                    {:else if $SettingsMenuIndex === 4}
                        <PluginSettings />
                    {:else if $SettingsMenuIndex === 6}
                        <AdvancedSettings />
                    {:else if $SettingsMenuIndex === 10}
                        <LanguageSettings/>
                    {:else if $SettingsMenuIndex === 11}
                        <AccessibilitySettings/>
                    {:else if $SettingsMenuIndex === 12}
                        <PersonaSettings/>
                    {:else if $SettingsMenuIndex === 14}
                        <ModuleSettings/>
                    {:else if $SettingsMenuIndex === 13}
                        <PromptSettings onGoBack={() => {
                            $SettingsMenuIndex = 1
                        }}/>
                    {:else if $SettingsMenuIndex === 15 && $SizeStore.w >= 768}
                        <HotkeySettings/>
                    {:else if $SettingsMenuIndex === 16}
                        <ComfyCommanderPage/>
                    {:else if $SettingsMenuIndex === 17}
                        <LogsSettingsPage/>
                    {/if}
            </div>
            {/key}
            {#if !$MobileGUI}
                <Button size="sm" className="ds-settings-panel-close ds-settings-panel-close-button ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm" onclick={closeSettingsPanel}>
                    <CircleXIcon size={DBState.db.settingsCloseButtonSize} />
                </Button>
            {/if}
        {/if}
    </div>
</div>
