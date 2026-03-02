<script lang="ts">
    import { characterFormatUpdate, getCharImage, removeChar } from "../../ts/characters";
    import { type Database } from "../../ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import BarIcon from "../SideBars/BarIcon.svelte";
    import { ArrowLeft, User, Users, SquareMousePointer, TrashIcon, Undo2Icon } from "@lucide/svelte";
    import { MobileSearch, selectedCharID } from "../../ts/stores.svelte";
    import TextInput from "../UI/GUI/TextInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { language } from "src/lang";
    import { parseMultilangString } from "src/ts/util";
    import { checkCharOrder } from "src/ts/globalApi.svelte";
  import MobileCharacters from "../Mobile/MobileCharacters.svelte";
    interface Props {
        endGrid?: () => void;
        embedded?: boolean;
        shellSearchQuery?: string;
    }

    const {
        endGrid = () => {},
        embedded = false,
        shellSearchQuery = $bindable('')
    }: Props = $props();
    let localSearch = $state('')
    let selected = $state(3)

    const searchQuery = $derived.by(() => embedded ? shellSearchQuery : localSearch)

    $effect(() => {
        MobileSearch.set(searchQuery)
    })

    function changeChar(index = -1){
        characterFormatUpdate(index)
        selectedCharID.set(index)
        endGrid()
    }

    function formatChars(search:string, db:Database, trash = false){
        const charas:{
            image:string
            index:number
            type:string,
            name:string
            desc:string
        }[] = []

        for(let i=0;i<db.characters.length;i++){
            const c = db.characters[i]
            if(c.trashTime && !trash){
                continue
            }
            if(!c.trashTime && trash){
                continue
            }
            if(c.name.replace(/ /g,"").toLocaleLowerCase().includes(search.toLocaleLowerCase().replace(/ /g,""))){
                charas.push({
                    image: c.image,
                    index: i,
                    type: c.type,
                    name: c.name,
                    desc: c.creatorNotes ?? 'No description'
                })
            }
        }
        return charas
    }
</script>

<div class="grid-catalog-root">
    <div class="grid-catalog-panel" class:grid-catalog-panel-embedded={embedded}>
        <div class="grid-catalog-toolbar">
            {#if !embedded}
                <div class="grid-catalog-search-row">
                    <button 
                        type="button"
                        class="grid-catalog-back"
                        onclick={() => endGrid()}
                        title="Back"
                        aria-label="Back"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div class="grid-catalog-search-wrap">
                        <TextInput placeholder="Search" bind:value={localSearch} size="lg" autocomplete="off" fullwidth={true} className="control-field" />
                    </div>
                </div>
            {/if}
            <div class="grid-catalog-filter-row">
                <Button styled={selected === 3 ? 'primary' : 'outlined'} size="sm" onclick={() => {selected = 3}}>
                    {language.simple}
                </Button>
                <Button styled={selected === 0 ? 'primary' : 'outlined'} size="sm" onclick={() => {selected = 0}}>
                    {language.grid}
                </Button>
                <Button styled={selected === 1  ? 'primary' : 'outlined'} size="sm" onclick={() => {selected = 1}}>
                    {language.list}
                </Button>
                <Button styled={selected === 2  ? 'primary' : 'outlined'} size="sm" onclick={() => {selected = 2}}>
                    {language.trash}
                </Button>
                <div class="grid-catalog-grow"></div>
                <span class="grid-catalog-count">
                    {formatChars(searchQuery, DBState.db).length} {language.character}
                </span>
            </div>
        </div>
        {#if selected === 0}
            <div class="grid-catalog-grid-shell">
                <div class="grid-catalog-grid-list">
                    {#each formatChars(searchQuery, DBState.db) as char (char.index)}
                        <div class="grid-catalog-grid-item">
                            {#if char.image}
                                <BarIcon onClick={() => {changeChar(char.index)}} additionalStyle={getCharImage(char.image, 'css')}></BarIcon>
                            {:else}
                                <BarIcon onClick={() => {changeChar(char.index)}} additionalStyle={char.index === $selectedCharID ? 'background:var(--risu-theme-selected)' : ''}>
                                    {#if char.type === 'group'}
                                        <Users />
                                    {:else}
                                        <User/>
                                    {/if}
                                </BarIcon>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {:else if selected === 1}
            {#each formatChars(searchQuery, DBState.db) as char (char.index)}
                <div class="grid-catalog-card panel-shell">
                    <BarIcon onClick={() => {changeChar(char.index)}} additionalStyle={getCharImage(char.image, 'css')}></BarIcon>
                    <div class="grid-catalog-card-content">
                        <h4 class="grid-catalog-card-title">{char.name || "Unnamed"}</h4>
                        <span class="grid-catalog-card-desc">{parseMultilangString(char.desc)['en'] || parseMultilangString(char.desc)['xx'] || 'No description'}</span>
                        <div class="grid-catalog-card-actions action-rail">
                            <button
                                type="button"
                                class="grid-catalog-icon-btn icon-btn icon-btn--sm"
                                onclick={() => {
                                    changeChar(char.index)
                                }}
                                title="Open character"
                                aria-label="Open character"
                            >
                                <SquareMousePointer />
                            </button>
                            <button
                                type="button"
                                class="grid-catalog-icon-btn icon-btn icon-btn--sm"
                                onclick={() => {
                                    removeChar(char.index, char.name)
                                }}
                                title="Move to trash"
                                aria-label="Move to trash"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        {:else if selected === 2}
            <span class="grid-catalog-trash-note">{language.trashDesc}</span>
            {#each formatChars(searchQuery, DBState.db, true) as char (char.index)}
                <div class="grid-catalog-card panel-shell">
                    <BarIcon onClick={() => {changeChar(char.index)}} additionalStyle={getCharImage(char.image, 'css')}></BarIcon>
                    <div class="grid-catalog-card-content">
                        <h4 class="grid-catalog-card-title">{char.name || "Unnamed"}</h4>
                        <span class="grid-catalog-card-desc">{parseMultilangString(char.desc)['en'] || parseMultilangString(char.desc)['xx'] || 'No description'}</span>
                        <div class="grid-catalog-card-actions action-rail">
                            <button
                                type="button"
                                class="grid-catalog-icon-btn icon-btn icon-btn--sm"
                                onclick={() => {
                                    DBState.db.characters[char.index].trashTime = undefined
                                    checkCharOrder()
                                }}
                                title="Restore character"
                                aria-label="Restore character"
                            >
                                <Undo2Icon />
                            </button>
                            <button
                                type="button"
                                class="grid-catalog-icon-btn icon-btn icon-btn--sm"
                                onclick={() => {
                                    removeChar(char.index, char.name, 'permanent')
                                }}
                                title="Delete permanently"
                                aria-label="Delete permanently"
                            >
                                <TrashIcon />
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        {:else if selected === 3}
            <MobileCharacters gridMode endGrid={endGrid} />
        {/if}
    </div>
</div>

<style>
    .grid-catalog-root{
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
    }

    .grid-catalog-panel{
        width: min(42rem, 100%);
        max-width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: var(--ds-space-6);
        background: var(--ds-surface-2);
        color: var(--ds-text-primary);
        overflow-y: auto;
    }

    .grid-catalog-panel-embedded {
        width: 100%;
        max-width: 100%;
        padding: var(--ds-space-4);
        background: transparent;
    }

    .grid-catalog-panel-embedded .grid-catalog-toolbar {
        margin-inline: 0;
    }

    .grid-catalog-toolbar{
        margin-inline: var(--ds-space-4);
        margin-bottom: var(--ds-space-6);
        display: flex;
        flex-direction: column;
    }

    .grid-catalog-search-row{
        display: flex;
        align-items: center;
        gap: var(--ds-space-3);
        margin-bottom: var(--ds-space-2);
    }

    .grid-catalog-back{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--ds-space-2);
        border-radius: var(--ds-radius-md);
        flex-shrink: 0;
        transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
            color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .grid-catalog-back:hover{
        background: var(--ds-surface-active);
        color: var(--ds-border-strong);
    }

    .grid-catalog-search-wrap{
        flex: 1 1 auto;
        min-width: 0;
    }

    .grid-catalog-filter-row{
        display: flex;
        flex-wrap: wrap;
        gap: var(--ds-space-2);
        margin-top: var(--ds-space-2);
        align-items: center;
    }

    .grid-catalog-grow{
        flex: 1 1 auto;
        min-width: 0;
    }

    .grid-catalog-count{
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .grid-catalog-grid-shell{
        width: 100%;
        display: flex;
        justify-content: center;
    }

    .grid-catalog-grid-list{
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--ds-space-2);
    }

    .grid-catalog-grid-item{
        display: flex;
        align-items: center;
        color: var(--ds-text-primary);
    }

    .grid-catalog-card{
        display: flex;
        padding: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
    }

    .grid-catalog-card-content{
        margin-left: var(--ds-space-2);
        flex: 1 1 auto;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .grid-catalog-card-title{
        margin: 0 0 var(--ds-space-1);
        color: var(--ds-text-primary);
        font-weight: var(--ds-font-weight-bold);
        font-size: var(--ds-font-size-lg);
    }

    .grid-catalog-card-desc{
        color: var(--ds-text-secondary);
        overflow-wrap: anywhere;
    }

    .grid-catalog-card-actions{
        display: flex;
        justify-content: flex-end;
        gap: var(--ds-space-2);
    }

    .grid-catalog-icon-btn{
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .grid-catalog-icon-btn:hover{
        color: var(--ds-text-primary);
    }

    .grid-catalog-trash-note{
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
        margin-bottom: var(--ds-space-2);
    }
</style>
