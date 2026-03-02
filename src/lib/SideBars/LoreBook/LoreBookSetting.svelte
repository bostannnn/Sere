<script lang="ts">
    
    import { DBState } from 'src/ts/stores.svelte';
    import { language } from "../../../lang";
    import { DownloadIcon, HardDriveUploadIcon, PlusIcon, SunIcon, LinkIcon, FolderPlusIcon } from "@lucide/svelte";
    import { addLorebook, addLorebookFolder, exportLoreBook, importLoreBook } from "../../../ts/process/lorebook.svelte";
    import Check from "../../UI/GUI/CheckInput.svelte";
    import NumberInput from "../../UI/GUI/NumberInput.svelte";
    import LoreBookList from "./LoreBookList.svelte";
    import RulebookRagSetting from "./RulebookRagSetting.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import { selectedCharID } from "src/ts/stores.svelte";

    let submenu = $state(0)
    interface Props {
        globalMode?: boolean;
        includeRulebookTab?: boolean;
    }

    let { globalMode = $bindable(false), includeRulebookTab = true }: Props = $props();

    $effect(() => {
        if (!includeRulebookTab && submenu === 3) {
            submenu = 0;
        }
    });

    function isAllCharacterLoreAlwaysActive() {
        const globalLore = DBState.db.characters[$selectedCharID].globalLore;
        return globalLore && globalLore.every((book) => book.alwaysActive);
    }

    function isAllChatLoreAlwaysActive() {
        const localLore = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].localLore;
        return localLore && localLore.every((book) => book.alwaysActive);
    }

    function toggleCharacterLoreAlwaysActive() {
        const globalLore = DBState.db.characters[$selectedCharID].globalLore;

        if (!globalLore) return;
        
        const allActive = globalLore.every((book) => book.alwaysActive);
        
        globalLore.forEach((book) => {
            book.alwaysActive = !allActive;
        });
    }

    function toggleChatLoreAlwaysActive() {
        const localLore = DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].localLore;

        if (!localLore) return;

        const allActive = localLore.every((book) => book.alwaysActive);

        localLore.forEach((book) => {
            book.alwaysActive = !allActive;
        });
    }
</script>

{#if !globalMode}
    <div class="lorebook-setting-tabs seg-tabs">
        <button type="button" title={DBState.db.characters[$selectedCharID].type === 'group' ? language.group : language.character} aria-label={DBState.db.characters[$selectedCharID].type === 'group' ? language.group : language.character} aria-pressed={submenu === 0} onclick={() => {
            submenu = 0
        }} class="lorebook-setting-tab seg-tab" class:is-active={submenu === 0} class:active={submenu === 0}>
            <span>{DBState.db.characters[$selectedCharID].type === 'group' ? language.group : language.character}</span>
        </button>
        <button type="button" title={language.Chat} aria-label={language.Chat} aria-pressed={submenu === 1} onclick={() => {
            submenu = 1
        }} class="lorebook-setting-tab seg-tab" class:is-active={submenu === 1} class:active={submenu === 1}>
            <span>{language.Chat}</span>
        </button>
        {#if includeRulebookTab}
            <button type="button" title="Rulebooks" aria-label="Rulebooks" aria-pressed={submenu === 3} onclick={() => {
                submenu = 3
            }} class="lorebook-setting-tab seg-tab" class:is-active={submenu === 3} class:active={submenu === 3}>
                <span>Rulebooks</span>
            </button>
        {/if}
        <button type="button" title={language.settings} aria-label={language.settings} aria-pressed={submenu === 2} onclick={() => {
            submenu = 2
        }} class="lorebook-setting-tab seg-tab" class:is-active={submenu === 2} class:active={submenu === 2}>
            <span>{language.settings}</span>
        </button>
    </div>
{/if}
{#if submenu !== 2 && submenu !== 3}
    {#if !globalMode}
        <span class="lorebook-setting-info">{submenu === 0 ? DBState.db.characters[$selectedCharID].type === 'group' ? language.groupLoreInfo : language.globalLoreInfo : language.localLoreInfo}</span>
    {/if}
    <LoreBookList globalMode={globalMode} submenu={submenu} lorePlus={(!globalMode) && DBState.db.characters[$selectedCharID]?.lorePlus} />
{:else if includeRulebookTab && submenu === 3}
    <RulebookRagSetting />
{:else}
    {#if DBState.db.characters[$selectedCharID].loreSettings}
        <div class="lorebook-setting-check-row">
            <Check check={false} onChange={() => {
                DBState.db.characters[$selectedCharID].loreSettings = undefined
            }}
            name={language.useGlobalSettings}
            />
        </div>
        <div class="lorebook-setting-check-row">
            <Check bind:check={DBState.db.characters[$selectedCharID].loreSettings.recursiveScanning} name={language.recursiveScanning}/>
        </div>
        <div class="lorebook-setting-check-row">
            <Check bind:check={DBState.db.characters[$selectedCharID].loreSettings.fullWordMatching} name={language.fullWordMatching}/>
        </div>
        <span class="lorebook-setting-label lorebook-setting-label-spaced">{language.loreBookDepth}</span>
        <NumberInput size="sm" min={0} max={20} bind:value={DBState.db.characters[$selectedCharID].loreSettings.scanDepth} />
        <span class="lorebook-setting-label">{language.loreBookToken}</span>
        <NumberInput size="sm" min={0} max={4096} bind:value={DBState.db.characters[$selectedCharID].loreSettings.tokenBudget} />
    {:else}
        <div class="lorebook-setting-check-row">
            <Check check={true} onChange={() => {
                DBState.db.characters[$selectedCharID].loreSettings = {
                    tokenBudget: DBState.db.loreBookToken,
                    scanDepth:DBState.db.loreBookDepth,
                    recursiveScanning: false
                }
            }}
            name={language.useGlobalSettings}
            />
        </div>
    {/if}
    <div class="lorebook-setting-check-row">
        {#if DBState.db.useExperimental}
            <Check bind:check={DBState.db.characters[$selectedCharID].lorePlus}
                name={language.lorePlus}
            ><Help key="lorePlus"></Help><Help key="experimental"></Help></Check>
        {/if}

    </div>
{/if}
{#if submenu !== 2 && submenu !== 3}

<div class="lorebook-setting-actions action-rail">
    <button type="button" title="Add lorebook entry" aria-label="Add lorebook entry" onclick={() => {addLorebook(globalMode ? -1 : submenu)}} class="lorebook-setting-action-btn icon-btn icon-btn--md">
        <PlusIcon />
    </button>
    <button type="button" title="Export lorebook entries" aria-label="Export lorebook entries" onclick={() => {
        exportLoreBook(globalMode ? 'sglobal' : submenu === 0 ? 'global' : 'local')
    }} class="lorebook-setting-action-btn icon-btn icon-btn--md lorebook-setting-action-btn-gap-sm">
        <DownloadIcon />
    </button>
    <button type="button" title="Add lorebook folder" aria-label="Add lorebook folder" onclick={() => {
        addLorebookFolder(globalMode ? -1 : submenu)
    }} class="lorebook-setting-action-btn icon-btn icon-btn--md lorebook-setting-action-btn-gap">
        <FolderPlusIcon />
    </button>
    <button type="button" title="Import lorebook entries" aria-label="Import lorebook entries" onclick={() => {
        importLoreBook(globalMode ? 'sglobal' : submenu === 0 ? 'global' : 'local')
    }} class="lorebook-setting-action-btn icon-btn icon-btn--md lorebook-setting-action-btn-gap">
        <HardDriveUploadIcon />
    </button>
    {#if DBState.db.bulkEnabling}
        <button type="button" title="Toggle all character lore activation" aria-label="Toggle all character lore activation" aria-pressed={isAllCharacterLoreAlwaysActive()} onclick={() => {
            toggleCharacterLoreAlwaysActive()
        }} class="lorebook-setting-action-btn icon-btn icon-btn--md lorebook-setting-action-btn-gap lorebook-setting-action-btn-with-label">
            {#if isAllCharacterLoreAlwaysActive()}
                <SunIcon />
            {:else}
                <LinkIcon />
            {/if}
            <span class="lorebook-setting-action-caption">CHAR</span>
        </button>
        <button type="button" title="Toggle all chat lore activation" aria-label="Toggle all chat lore activation" aria-pressed={isAllChatLoreAlwaysActive()} onclick={() => {
            toggleChatLoreAlwaysActive()
        }} class="lorebook-setting-action-btn icon-btn icon-btn--md lorebook-setting-action-btn-gap lorebook-setting-action-btn-with-label">
            {#if isAllChatLoreAlwaysActive()}
                <SunIcon />
            {:else}
                <LinkIcon />
            {/if}
            <span class="lorebook-setting-action-caption">CHAT</span>
        </button>
    {/if}
</div>
{/if}

<style>
    .lorebook-setting-tabs {
        width: 100%;
    }

    .lorebook-setting-tab {
        padding-inline: var(--ds-space-2);
    }

    .lorebook-setting-info {
        color: var(--ds-text-secondary);
        margin-top: var(--ds-space-2);
        margin-bottom: var(--ds-space-6);
        font-size: var(--ds-font-size-sm);
        display: block;
    }

    .lorebook-setting-check-row {
        display: flex;
        align-items: center;
        margin-top: var(--ds-space-4);
    }

    .lorebook-setting-label {
        color: var(--ds-text-primary);
        display: block;
    }

    .lorebook-setting-label-spaced {
        margin-top: var(--ds-space-4);
        margin-bottom: var(--ds-space-2);
    }

    .lorebook-setting-actions {
        flex-wrap: wrap;
        margin-top: var(--ds-space-2);
        color: var(--ds-text-secondary);
    }

    .lorebook-setting-action-btn {
        line-height: 1;
        vertical-align: middle;
    }

    .lorebook-setting-action-btn-gap-sm {
        margin-left: 0;
    }

    .lorebook-setting-action-btn-gap {
        margin-left: 0;
    }

    .lorebook-setting-action-btn-with-label {
        width: auto;
        min-width: calc(var(--ds-height-control-sm) + var(--ds-space-4));
        gap: var(--ds-space-1);
        padding-inline: var(--ds-space-1);
    }

    .lorebook-setting-action-caption {
        font-size: var(--ds-font-size-xs);
    }
</style>
