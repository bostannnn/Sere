<script lang="ts">
    import { ArrowLeft, MenuIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { MobileGUIStack, MobileSearch, selectedCharID, SettingsMenuIndex, MobileSideBar } from "src/ts/stores.svelte";

</script>
<div class="ds-mobile-header">
    {#if $selectedCharID !== -1 && $MobileSideBar > 0}
        <button type="button" class="ds-mobile-header-icon-btn icon-btn icon-btn--md" title="Back" aria-label="Back" onclick={() => {
            MobileSideBar.set(0)
        }}>
            <ArrowLeft size={18} />
        </button>
        <span class="ds-mobile-header-title">{language.menu}</span>
    {:else if $selectedCharID !== -1}
        <button type="button" class="ds-mobile-header-icon-btn icon-btn icon-btn--md" title="Back" aria-label="Back" onclick={() => {
            selectedCharID.set(-1)
        }}>
            <ArrowLeft size={18} />
        </button>
        <span class="ds-mobile-header-title">{DBState.db.characters[$selectedCharID].name}</span>
        <div class="ds-mobile-header-actions action-rail">
            <button type="button" class="ds-mobile-header-icon-btn icon-btn icon-btn--md" title="Open menu" aria-label="Open menu" onclick={() => {
                MobileSideBar.set(1)
            }}>
                <MenuIcon size={18} />
            </button>
        </div>
    {:else if $MobileGUIStack === 2 && $SettingsMenuIndex > -1}
        <button type="button" class="ds-mobile-header-icon-btn icon-btn icon-btn--md" title="Back" aria-label="Back" onclick={() => {
            SettingsMenuIndex.set(-1)
        }}>
            <ArrowLeft size={18} />
        </button>
        <span class="ds-mobile-header-title">Risuai</span>
    {:else if $MobileGUIStack === 0}
        <div class="ds-mobile-header-search-shell">
            <input type="search" aria-label={language.search} placeholder={language.search + '...'} bind:value={$MobileSearch} class="ds-mobile-header-search-input control-field">
        </div>
    {:else if $MobileGUIStack === 1}
        <span class="ds-mobile-header-title">Rulebooks</span>
    {:else if $MobileGUIStack === 2}
        <span class="ds-mobile-header-title">{language.settings}</span>
    {:else if $MobileGUIStack === 3}
        <span class="ds-mobile-header-title">{language.playground}</span>
    {:else}
        <span class="ds-mobile-header-title">Risuai</span>

    {/if}
</div>
