<script lang="ts">
     
    import { XIcon, LinkIcon, SunIcon, BookCopyIcon, FolderIcon, FolderOpen, PlusIcon } from "@lucide/svelte";
    import { v4 } from "uuid";
    import { language } from "../../../lang";
    import { getCurrentCharacter, getCurrentChat, type loreBook } from "../../../ts/storage/database.svelte";
    import { alertConfirm, alertMd } from "../../../ts/alert";
    import Check from "../../UI/GUI/CheckInput.svelte";
    import Help from "../../Others/Help.svelte";
    import TextInput from "../../UI/GUI/TextInput.svelte";
    import NumberInput from "../../UI/GUI/NumberInput.svelte";
    import TextAreaInput from "../../UI/GUI/TextAreaInput.svelte";
    import { tokenizeAccurate } from "src/ts/tokenizer";
    import { DBState } from "src/ts/stores.svelte";
    import LoreBookList from "./LoreBookList.svelte";

    interface Props {
        value: loreBook;
        onRemove?: () => void;
        onClose?: (isDetail?: boolean) => void;
        onOpen?: (isDetail?: boolean) => void;
        lorePlus?: boolean;
        idx: number;
        externalLoreBooks?: loreBook[];
        idgroup: string;
        isOpen?: boolean;
        openFolders?: number;
        isLastInContainer?: boolean;
    }

    let {
        value = $bindable(),
        onRemove = () => {},
        onClose = (_isDetail = true) => {},
        onOpen = (_isDetail = true) => {},
        lorePlus = false,
        idx,
        externalLoreBooks = $bindable(),
        idgroup,
        isOpen = false,
        openFolders = 0,
        isLastInContainer = false
    }: Props = $props();
    
    let open = $derived(isOpen)

    async function getTokens(data:string){
        tokens = await tokenizeAccurate(data)
        return tokens
    }
    let tokens = $state(0)

    function isLocallyActivated(book: loreBook){
        return book.id ? getCurrentChat()?.localLore.some(e => e.id === book.id) : false
    }
    function activateLocally(book: loreBook){
        if(!book.id){
            book.id = v4()
        }
        
        const childLore: loreBook = {
            key: '',
            comment: '',
            content: '',
            mode: 'child',
            insertorder: 100,
            alwaysActive: true,
            secondkey: '',
            selective: false,
            id: book.id,
        }
        getCurrentChat().localLore.push(childLore)
    }
    function deactivateLocally(book: loreBook){
        if(!book.id) return
        const chat = getCurrentChat()
        const childLore = chat?.localLore?.find(e => e.id === book.id)
        if(childLore){
            chat.localLore = chat.localLore.filter(e => e.id !== book.id)
        }
    }
    function toggleLocalActive(check: boolean, book: loreBook){
        if(check){
            activateLocally(book)
        }else{
            deactivateLocally(book)
        }
    }
    function getParentLoreName(book: loreBook){
        if(book.mode === 'child'){
            const value = getCurrentCharacter()?.globalLore.find(e => e.id === book.id)
            if(value){
                return value.comment.length === 0 ? value.key.length === 0 ? "Unnamed Lore" : value.key : value.comment
            }
        }
    }

    
</script>
<div class="lorebook-data-root"
    class:lorebook-data-root-last={isLastInContainer}
    class:lorebook-data-root-default={!isLastInContainer}
    class:no-sort={value.mode === 'folder' && openFolders > 0}
    data-risu-idx={idx} data-risu-idgroup={idgroup}
>
    <div class="lorebook-data-header">

    {#if value.mode !== 'child'}
        <button type="button" class="lorebook-data-main-btn lorebook-data-action-btn" title="Toggle lorebook entry" aria-label="Toggle lorebook entry" onclick={() => {
            value.secondkey = value.secondkey ?? ''
            if(!open){
                open = true
                onOpen(value.mode !== 'folder') // If not a folder, pass true
            }
            else{
                open = false
                onClose(value.mode !== 'folder') // If not a folder, pass true
            }
        }}>
            {#if value.mode === 'folder'}
                {#if open}
                    <FolderOpen size={20} class="lorebook-data-leading-icon" />
                {:else}
                    <FolderIcon size={20} class="lorebook-data-leading-icon" />
                {/if}
            {/if}
            {#if value.mode === 'folder'}
                <span class="lorebook-data-title">{value.comment.length === 0 ? "Unnamed Folder" : value.comment}</span>
            {:else}
                <span class="lorebook-data-title">{value.comment.length === 0 ? value.key.length === 0 ? "Unnamed Lore" : value.key : value.comment}</span>
            {/if}
        </button>
        <button
            type="button"
            class="lorebook-data-toggle-btn lorebook-data-icon-btn icon-btn icon-btn--sm"
            class:is-active={value.alwaysActive}
            class:is-inactive={!value.alwaysActive}
            data-testid="lorebook-data-toggle-btn"
            title="Toggle active state"
            aria-label="Toggle active state"
            aria-pressed={value.alwaysActive}
            onclick={async () => {
                if(value.mode === 'folder'){
                    for(let i = 0; i < externalLoreBooks.length; i++){
                        if(externalLoreBooks[i].folder === value.key){
                            externalLoreBooks[i].alwaysActive = !value.alwaysActive
                        }
                    }
                }
                value.alwaysActive = !value.alwaysActive
            }}
        >
            {#if value.alwaysActive}
                <SunIcon size={20} />
            {:else}
                <LinkIcon size={20} />
            {/if}
        </button>
        <button type="button" class="lorebook-data-action-btn lorebook-data-icon-btn icon-btn icon-btn--sm" data-testid="lorebook-data-remove-btn" title="Remove lorebook entry" aria-label="Remove lorebook entry" onclick={async () => {
            let shouldRemove = true;
            if (value.mode === 'folder' && externalLoreBooks.some(e => e.folder === value.key)) {
                const firstConfirm = await alertConfirm(language.folderRemoveConfirm);
                if (!firstConfirm) {
                    shouldRemove = false;
                }
            }

            if (shouldRemove) {
                const secondConfirm = await alertConfirm(language.removeConfirm + (value.comment || 'Unnamed Folder'));
                if (secondConfirm) {
                    if (!open) {
                        onClose();
                    }
                    deactivateLocally(value);
                    onRemove();
                }
            }
        }}>
            <XIcon size={20} />
        </button>
    {:else}
        <button type="button" class="lorebook-data-main-btn lorebook-data-action-btn" title="View child lore source" aria-label="View child lore source" onclick={() => alertMd(language.childLoreDesc)}>
            <BookCopyIcon size={20} class="lorebook-data-leading-icon" />
            <span class="lorebook-data-title">{getParentLoreName(value)}</span>
        </button>
        <button type="button" class="lorebook-data-action-btn lorebook-data-icon-btn icon-btn icon-btn--sm" data-testid="lorebook-data-remove-child-btn" title="Remove child lore entry" aria-label="Remove child lore entry" onclick={async () => {
            const d = await alertConfirm(language.removeConfirm + getParentLoreName(value))
            if(d){
                if(!open){
                    onClose()
                }
                onRemove()
            }
        }}>
            <XIcon size={20} />
        </button>
    {/if}
    </div>
    {#if open}
        {#if value.mode === 'folder'}
        <div class="lorebook-data-panel panel-shell">
            <span class="lorebook-data-label lorebook-data-label-with-gap">{language.folderName}</span>
            <TextInput size="sm" bind:value={value.comment}/>

            <div class="lorebook-data-nested-list list-shell">
                <LoreBookList externalLoreBooks={externalLoreBooks} showFolder={value.key} />
            </div>
            
            <div class="lorebook-data-folder-actions action-rail">
                <button type="button" class="lorebook-data-action-btn lorebook-data-action-btn-muted lorebook-data-icon-btn icon-btn icon-btn--sm" data-testid="lorebook-data-add-in-folder-btn" title="Add lore entry in folder" aria-label="Add lore entry in folder" onclick={() => {
                    externalLoreBooks.push({
                        key: '',
                        comment: '',
                        content: '',
                        mode: 'normal',
                        insertorder: 100,
                        alwaysActive: true,
                        secondkey: '',
                        selective: false,
                        folder: value.key,
                    })
                }}>
                    <PlusIcon size={20} />
                </button>
            </div>
        </div>
        {:else}
        <div class="lorebook-data-panel panel-shell">
            <span class="lorebook-data-label lorebook-data-label-with-gap">{language.name} <Help key="loreName"/></span>
            <TextInput size="sm" bind:value={value.comment}/>
            {#if !lorePlus}
                {#if !value.alwaysActive}
                    <span class="lorebook-data-label lorebook-data-label-with-gap">{language.activationKeys} <Help key="loreActivationKey"/></span>
                    <span class="lorebook-data-help-text">{language.activationKeysInfo}</span>
                    <TextInput size="sm" bind:value={value.key}/>

                    {#if value.selective}
                        <span class="lorebook-data-label lorebook-data-label-with-gap">{language.SecondaryKeys}</span>
                        <span class="lorebook-data-help-text">{language.activationKeysInfo}</span>
                        <TextInput size="sm" bind:value={value.secondkey}/>
                    {/if}
                {/if}
            {/if}
            {#if !lorePlus}
                {#if !(value.activationPercent === undefined || value.activationPercent === null)}
                    <span class="lorebook-data-label lorebook-data-label-with-gap">{language.activationProbability}</span>
                    <NumberInput size="sm" bind:value={value.activationPercent} onChange={() => {
                        if(isNaN(value.activationPercent) || !value.activationPercent || value.activationPercent < 0){
                            value.activationPercent = 0
                        }
                        if(value.activationPercent > 100){
                            value.activationPercent = 100
                        }
                    }} />
                {/if}
            {/if}
            {#if !lorePlus}
                <span class="lorebook-data-label lorebook-data-label-with-gap-sm">{language.insertOrder} <Help key="loreorder"/></span>
                <NumberInput size="sm" bind:value={value.insertorder} min={0} max={1000}/>
            {/if}
            <span class="lorebook-data-label lorebook-data-label-block">{language.prompt}</span>
            <TextAreaInput highlight autocomplete="off" bind:value={value.content} />
            {#await getTokens(value.content)}
                <span class="lorebook-data-token-count">{tokens} {language.tokens}</span>
            {:then e}
                <span class="lorebook-data-token-count">{e} {language.tokens}</span>
            {/await}
            <div class="lorebook-data-check-row">
                <Check bind:check={value.alwaysActive} name={language.alwaysActive}/>
            </div>
            {#if !value.alwaysActive && getCurrentCharacter()?.globalLore?.includes(value) && DBState.db.localActivationInGlobalLorebook}
                <div class="lorebook-data-check-row lorebook-data-check-row-compact">
                    <Check check={isLocallyActivated(value)} onChange={(check: boolean) => toggleLocalActive(check, value)} name={language.alwaysActiveInChat}/>
                </div>
            {/if}
            {#if !lorePlus && !value.useRegex}
                <div class="lorebook-data-check-row lorebook-data-check-row-compact">
                    <Check bind:check={value.selective} name={language.selective}/>
                    <Help key="loreSelective" name={language.selective}/>
                </div>
            {/if}
            {#if !lorePlus && !value.alwaysActive}
                <div class="lorebook-data-check-row lorebook-data-check-row-compact">
                    <Check bind:check={value.useRegex} name={language.useRegexLorebook}/>
                    <Help key="useRegexLorebook" name={language.useRegexLorebook}/>
                </div>
            {/if}
        </div>
        {/if}
    {/if}
</div>



<style>
    .lorebook-data-root {
        width: 100%;
        display: flex;
        flex-direction: column;
    }

    .lorebook-data-root-last {
        padding-bottom: 0;
        margin-bottom: 0;
        border: 0;
    }

    .lorebook-data-root-default {
        padding-bottom: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
                border-bottom: 1px solid var(--risu-theme-selected);
    }

    .lorebook-data-header {
        display: flex;
        align-items: center;
        gap: var(--ds-space-1);
        width: 100%;
        padding: var(--ds-space-1);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .lorebook-data-action-btn {
        cursor: pointer;
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .lorebook-data-action-btn:hover {
        color: var(--ds-text-primary);
    }

    .lorebook-data-main-btn {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        text-align: left;
        min-width: 0;
        flex: 1 1 auto;
        border: 0;
        background: transparent;
        padding: 0;
        flex-grow: 1;
        color: var(--ds-text-primary);
    }

    .lorebook-data-title {
        text-align: left;
        overflow-wrap: anywhere;
        min-width: 0;
    }

    :global(.lorebook-data-leading-icon) {
        margin-right: var(--ds-space-1);
        flex-shrink: 0;
    }

    .lorebook-data-icon-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: var(--ds-height-control-sm);
        height: var(--ds-height-control-sm);
        min-width: var(--ds-height-control-sm);
        flex-shrink: 0;
        padding: 0;
    }

    .lorebook-data-toggle-btn {
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .lorebook-data-toggle-btn.is-active {
        color: var(--ds-text-primary);
    }

    .lorebook-data-toggle-btn.is-inactive {
        color: var(--ds-text-secondary);
    }

    .lorebook-data-panel {
        width: 100%;
        margin-top: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
        display: flex;
        flex-direction: column;
    }

    .lorebook-data-label {
        color: var(--ds-text-primary);
        display: block;
    }

    .lorebook-data-label-with-gap {
        margin-top: var(--ds-space-6);
    }

    .lorebook-data-label-with-gap-sm {
        margin-top: var(--ds-space-4);
    }

    .lorebook-data-label-block {
        margin-top: var(--ds-space-4);
        margin-bottom: var(--ds-space-2);
    }

    .lorebook-data-help-text {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-xs);
    }

    .lorebook-data-token-count {
        color: var(--ds-text-secondary);
        margin-top: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
        font-size: var(--ds-font-size-sm);
    }

    .lorebook-data-nested-list {
        margin-top: var(--ds-space-4);
    }

    .lorebook-data-folder-actions {
        margin-top: var(--ds-space-2);
    }

    .lorebook-data-action-btn-muted {
        color: var(--ds-text-secondary);
    }

    .lorebook-data-check-row {
        display: flex;
        align-items: center;
        margin-top: var(--ds-space-4);
    }

    .lorebook-data-check-row-compact {
        margin-top: var(--ds-space-2);
    }

    /* Styles for SortableJS drag-and-drop feedback */
    :global(.risu-chosen-item) {
        /* The item being dragged */
        padding-bottom: 0.5rem;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid;
        border-bottom-color: var(--risu-theme-selected);
        opacity: 0.7;
    }

    :global(.risu-ghost-item) {
        /* The placeholder for the drop location */
        background-color: rgba(var(--risu-theme-selected-rgb), 0.2);

    }
</style>
