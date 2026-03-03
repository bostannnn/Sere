<script lang="ts">
    import { MobileGUIStack, MobileSideBar, selectedCharID } from "src/ts/stores.svelte";
    import Settings from "../Setting/Settings.svelte";
    import MobileCharacters from "./MobileCharacters.svelte";
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import CharConfig from "../SideBars/CharConfig.svelte";
    import { language } from "src/lang";
    import SideChatList from "../SideBars/SideChatList.svelte";
    import HypaV3Modal from "../Others/HypaV3Modal.svelte";
    import { isLite } from "src/ts/lite";
    import RulebookLibrary from "../Others/RulebookManager/RulebookLibrary.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    const loadPlaygroundMenu = () => import("../Playground/PlaygroundMenu.svelte").then((m) => m.default);

    $effect(() => {
        // Prevent stale side-panel state when no character is selected.
        if ($selectedCharID === -1 && $MobileSideBar !== 0) {
            MobileSideBar.set(0);
        }
    });
</script>

{#if $selectedCharID !== -1 && $MobileSideBar > 0 && !$isLite}
<div class="ds-mobile-topbar seg-tabs">
    <button type="button" class="ds-mobile-topbar-btn ds-mobile-topbar-btn-divider seg-tab" class:is-active={$MobileSideBar === 1} title={language.Chat} aria-label={language.Chat} aria-pressed={$MobileSideBar === 1} onclick={() => {
        $MobileSideBar = 1
    }}>
        {language.Chat}
    </button>
    <button type="button" class="ds-mobile-topbar-btn ds-mobile-topbar-btn-divider seg-tab" class:is-active={$MobileSideBar === 2} title={language.character} aria-label={language.character} aria-pressed={$MobileSideBar === 2} onclick={() => {
        $MobileSideBar = 2
    }}>
        {language.character}
    </button>
    <button type="button" class="ds-mobile-topbar-btn ds-mobile-topbar-btn-divider seg-tab" class:is-active={$MobileSideBar === 3} title={language.memoryTab} aria-label={language.memoryTab} aria-pressed={$MobileSideBar === 3} onclick={() => {
        $MobileSideBar = 3
    }}>
        {language.memoryTab}
    </button>
</div>
{/if}
<div class="ds-mobile-body-shell" class:ds-mobile-body-shell-reserve-char-footer={$selectedCharID !== -1 && $MobileSideBar > 0 && !$isLite}>
    {#if $selectedCharID !== -1 && $MobileSideBar > 0}
        <div class="ds-mobile-sidepanel-shell">
            {#if $MobileSideBar === 1}
                <SideChatList chara={DBState.db.characters[$selectedCharID]} />
            {:else if $MobileSideBar === 2}
                <CharConfig />
            {:else if $MobileSideBar === 3}
                <HypaV3Modal embedded />
            {/if}
        </div>
    {:else if $selectedCharID !== -1}
        <ChatScreen />
    {:else if $MobileGUIStack === 0}
        <MobileCharacters />
    {:else if $MobileGUIStack === 1}
        <RulebookLibrary onClose={() => MobileGUIStack.set(0)} />
    {:else if $MobileGUIStack === 2}
        <Settings />
    {:else if $MobileGUIStack === 3}
        {#await loadPlaygroundMenu() then PlaygroundMenu}
            <PlaygroundMenu />
        {/await}
    {:else}
        <MobileCharacters />
    {/if}
</div>
