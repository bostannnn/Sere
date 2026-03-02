<script>
    import { alertConfirm } from "../../ts/alert";
    import { language } from "../../lang";
    import Button from "../UI/GUI/Button.svelte";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { SquarePenIcon, PlusIcon, TrashIcon, XIcon } from "@lucide/svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    let editMode = $state(false)
    /** @type {{close?: any}} */
    const { close = () => {} } = $props();
</script>

<div class="ds-settings-modal-overlay">
    <div class="ds-settings-modal ds-settings-modal--md ds-settings-break-any">
        <div class="ds-settings-modal-header">
            <h2 class="ds-settings-modal-title">{language.loreBook}</h2>
            <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
                <Button
                    onclick={close}
                    size="sm"
                    styled="outlined"
                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
                >
                    <XIcon size={24}/>
                </Button>
            </div>
        </div>
        {#each DBState.db.loreBook as lore, ind (lore.id ?? ind)}
            <button onclick={() => {
                if(!editMode){
                    DBState.db.loreBookPage = ind
                }
            }} class="ds-settings-modal-list-row" class:ds-settings-modal-list-row-selected={ind === DBState.db.loreBookPage}>
                {#if editMode}
                    <TextInput bind:value={DBState.db.loreBook[ind].name} placeholder="string" padding={false}/>
                {:else}
                    <span>{lore.name}</span>
                {/if}
                <div class="ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail">
                    <div class="ds-settings-icon-link icon-btn icon-btn--sm" role="button" tabindex="0" aria-label="Delete lore book" title="Delete lore book" onclick={async (e) => {
                        e.stopPropagation()
                        if(DBState.db.loreBook.length === 1){
                            return
                        }
                        const d = await alertConfirm(`${language.removeConfirm}${lore.name}`)
                        if(d){
                            DBState.db.loreBookPage = 0
                            const loreBook = DBState.db.loreBook
                            loreBook.splice(ind, 1)
                            DBState.db.loreBook = loreBook
                        }
                    }} onkeydown={(e) => {
                        if(e.key === 'Enter'){
                            e.currentTarget.click()
                        }
                    }}>
                        <TrashIcon size={18}/>
                    </div>
                </div>
            </button>
        {/each}
        <div class="ds-settings-inline-actions action-rail">
            <Button
                onclick={() => {
                const loreBooks = DBState.db.loreBook
                const newLoreBook = {
                    name: `New LoreBook`,
                    data: []
                }
                loreBooks.push(newLoreBook)

                DBState.db.loreBook = loreBooks
            }}
                size="sm"
                styled="outlined"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
            >
                <PlusIcon/>
            </Button>
            <Button
                onclick={() => {
                editMode = !editMode
            }}
                size="sm"
                styled="outlined"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-icon-state-muted-hover-primary"
            >
                <SquarePenIcon size={18}/>
            </Button>
        </div>
    </div>
</div>
