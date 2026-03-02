<script lang="ts">

  import {
    SettingsIcon,
    GlobeIcon,
    HouseIcon,
    Volume2Icon,
    Braces,
    ActivityIcon,
    BookIcon,
    BookOpenCheckIcon,
    SmileIcon,
    UserIcon
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import { CharConfigSubMenu, MobileGUIStack, MobileSideBar, selectedCharID } from "src/ts/stores.svelte";

</script>
{#if $selectedCharID === -1}

    <div class="ds-mobile-nav-shell ds-mobile-nav-shell-root">
        <div class="ds-mobile-nav-track ds-mobile-nav-track-root seg-tabs">
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-wide seg-tab" class:is-active={$MobileGUIStack === 0} title={language.home} aria-label={language.home} aria-pressed={$MobileGUIStack === 0} onclick={() => {
                MobileSideBar.set(0)
                MobileGUIStack.set(0)
            }}>
                <GlobeIcon size={24} />
                <span class="ds-mobile-nav-label">{language.home}</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-wide seg-tab" class:is-active={$MobileGUIStack === 1} title={language.character} aria-label={language.character} aria-pressed={$MobileGUIStack === 1} onclick={() => {
                MobileSideBar.set(0)
                MobileGUIStack.set(1)
            }}>
                <HouseIcon size={24} />
                <span class="ds-mobile-nav-label">{language.character}</span>
            </button>
            <button type="button" class="ds-mobile-nav-btn ds-mobile-nav-btn-wide seg-tab" class:is-active={$MobileGUIStack === 2} title={language.settings} aria-label={language.settings} aria-pressed={$MobileGUIStack === 2} onclick={() => {
                MobileSideBar.set(0)
                MobileGUIStack.set(2)
            }}>
                <SettingsIcon size={24} />
                <span class="ds-mobile-nav-label">{language.settings}</span>
            </button>
        </div>
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
