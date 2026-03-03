<script lang="ts">
  import {
    SettingsIcon,
    Volume2Icon,
    Braces,
    ActivityIcon,
    BookIcon,
    BookOpenCheckIcon,
    SmileIcon,
    UserIcon,
    HomeIcon,
    EllipsisIcon,
    ShellIcon,
  } from "@lucide/svelte";
  import { onDestroy, onMount } from "svelte";
  import { language } from "src/lang";
  import { additionalHamburgerMenu, CharConfigSubMenu, MobileGUIStack, MobileSideBar, PlaygroundStore, selectedCharID } from "src/ts/stores.svelte";
  import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";

  let mobileNavOverflowOpen = $state(false);
  let mobileNavOverflowWrapEl = $state<HTMLElement | null>(null);
  let lastMobileStack = $state<number | null>(null);

  const homeActive = $derived($MobileGUIStack === 0);
  const rulebooksActive = $derived($MobileGUIStack === 1);
  const settingsActive = $derived($MobileGUIStack === 2);
  const playgroundActive = $derived($MobileGUIStack === 3);

  const openHome = () => {
    PlaygroundStore.set(0);
    MobileSideBar.set(0);
    MobileGUIStack.set(0);
    mobileNavOverflowOpen = false;
  };

  const openRulebooks = () => {
    PlaygroundStore.set(0);
    MobileSideBar.set(0);
    MobileGUIStack.set(1);
    mobileNavOverflowOpen = false;
  };

  const openSettings = () => {
    PlaygroundStore.set(0);
    MobileSideBar.set(0);
    MobileGUIStack.set(2);
    mobileNavOverflowOpen = false;
  };

  const openPlayground = () => {
    MobileSideBar.set(0);
    PlaygroundStore.set(1);
    MobileGUIStack.set(3);
    mobileNavOverflowOpen = false;
  };

  const toggleMore = () => {
    mobileNavOverflowOpen = !mobileNavOverflowOpen;
  };

  const onDocumentPointerDown = (event: PointerEvent) => {
    if (!mobileNavOverflowOpen) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }
    if (mobileNavOverflowWrapEl?.contains(target)) {
      return;
    }
    mobileNavOverflowOpen = false;
  };

  onMount(() => {
    document.addEventListener("pointerdown", onDocumentPointerDown);
  });

  onDestroy(() => {
    document.removeEventListener("pointerdown", onDocumentPointerDown);
  });

  $effect(() => {
    if ($selectedCharID !== -1 && mobileNavOverflowOpen) {
      mobileNavOverflowOpen = false;
    }
  });

  $effect(() => {
    const stack = $MobileGUIStack;
    if (lastMobileStack !== null && stack !== lastMobileStack && mobileNavOverflowOpen) {
      mobileNavOverflowOpen = false;
    }
    lastMobileStack = stack;
  });

</script>
{#if $selectedCharID === -1}
    <div class="ds-mobile-nav-shell ds-mobile-nav-shell-root">
        <nav
            class="ds-mobile-nav-track ds-mobile-nav-track-root action-rail"
            class:ds-mobile-nav-track-root-overflow-open={mobileNavOverflowOpen}
            aria-label="Primary navigation"
        >
            <button
                type="button"
                class="ds-mobile-nav-btn ds-mobile-nav-btn-root icon-btn icon-btn--md"
                aria-label="Go to Home"
                title="Home"
                aria-pressed={homeActive}
                data-pressed={homeActive ? "1" : "0"}
                onclick={openHome}
            ><HomeIcon size={20} /></button>

            <button
                type="button"
                class="ds-mobile-nav-btn ds-mobile-nav-btn-root icon-btn icon-btn--md"
                aria-label="Go to Rulebooks"
                title="Rulebooks"
                aria-pressed={rulebooksActive}
                data-pressed={rulebooksActive ? "1" : "0"}
                onclick={openRulebooks}
            ><BookIcon size={20} /></button>

            <button
                type="button"
                class="ds-mobile-nav-btn ds-mobile-nav-btn-root icon-btn icon-btn--md"
                aria-label="Go to Settings"
                title="Settings"
                aria-pressed={settingsActive}
                data-pressed={settingsActive ? "1" : "0"}
                onclick={openSettings}
            ><SettingsIcon size={20} /></button>

            <div class="ds-mobile-nav-overflow-wrap" bind:this={mobileNavOverflowWrapEl}>
                <button
                    type="button"
                    class="ds-mobile-nav-btn ds-mobile-nav-btn-root icon-btn icon-btn--md"
                    aria-label="More navigation actions"
                    title="More"
                    aria-pressed={mobileNavOverflowOpen}
                    aria-expanded={mobileNavOverflowOpen}
                    aria-controls="mobile-nav-overflow-menu"
                    data-pressed={mobileNavOverflowOpen || playgroundActive ? "1" : "0"}
                    onclick={toggleMore}
                ><EllipsisIcon size={20} /></button>

                {#if mobileNavOverflowOpen}
                    <div
                        id="mobile-nav-overflow-menu"
                        class="ds-mobile-nav-overflow panel-shell ds-ui-menu"
                        aria-label="More navigation actions"
                    >
                        <button
                            type="button"
                            class="ds-mobile-nav-overflow-item ds-ui-menu-item"
                            data-active={playgroundActive ? "1" : "0"}
                            onclick={openPlayground}
                        >
                            <ShellIcon size={16} />
                            <span>Playground</span>
                        </button>

                        {#if additionalHamburgerMenu.length > 0}
                            <div class="ds-mobile-nav-overflow-separator"></div>
                            {#each additionalHamburgerMenu as item (`${item.id}-${item.name}`)}
                                <button
                                    type="button"
                                    class="ds-mobile-nav-overflow-item ds-ui-menu-item"
                                    onclick={() => {
                                        item.callback();
                                        mobileNavOverflowOpen = false;
                                    }}
                                >
                                    <PluginDefinedIcon ico={item} />
                                    <span>{item.name}</span>
                                </button>
                            {/each}
                        {/if}
                    </div>
                {/if}
            </div>
        </nav>
    </div>
{/if}

{#if $selectedCharID !== -1 && $MobileSideBar === 2}
    <div class="ds-mobile-nav-shell ds-mobile-nav-shell-char">
        <div class="ds-mobile-nav-track ds-mobile-nav-track-char">
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 0} title={language.basicInfo} aria-label={language.basicInfo} aria-pressed={$CharConfigSubMenu === 0} onclick={() => {
                CharConfigSubMenu.set(0)
            }}>
                <UserIcon size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">{language.basicInfo}</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 1} title={language.characterDisplay} aria-label={language.characterDisplay} aria-pressed={$CharConfigSubMenu === 1} onclick={() => {
                CharConfigSubMenu.set(1)
            }}>
                <SmileIcon size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">{language.characterDisplay}</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 3} title={language.loreBook} aria-label={language.loreBook} aria-pressed={$CharConfigSubMenu === 3} onclick={() => {
                CharConfigSubMenu.set(3)
            }}>
                <BookIcon size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">{language.loreBook}</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 8} title="Rulebooks" aria-label="Rulebooks" aria-pressed={$CharConfigSubMenu === 8} onclick={() => {
                CharConfigSubMenu.set(8)
            }}>
                <BookOpenCheckIcon size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">Rulebooks</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 5} title="TTS" aria-label="TTS" aria-pressed={$CharConfigSubMenu === 5} onclick={() => {
                CharConfigSubMenu.set(5)
            }}>
                <Volume2Icon size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">TTS</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 4} title={language.scripts} aria-label={language.scripts} aria-pressed={$CharConfigSubMenu === 4} onclick={() => {
                CharConfigSubMenu.set(4)
            }}>
                <Braces size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">{language.scripts}</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-char" class:is-active={$CharConfigSubMenu === 2} title={language.advanced} aria-label={language.advanced} aria-pressed={$CharConfigSubMenu === 2} onclick={() => {
                CharConfigSubMenu.set(2)
            }}>
                <ActivityIcon size={24} />
                <span class="ds-mobile-nav-label ds-mobile-nav-label-truncate">{language.advanced}</span>
            </button>
        </div>
    </div>
{/if}
