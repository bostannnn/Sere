<script lang="ts">
    import { language } from "src/lang";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import { alertConfirm, alertSelect } from "src/ts/alert";
    import { getCharImage } from "src/ts/characters";
    import { changeUserPersona, exportUserPersona, importUserPersona, saveUserPersona, selectUserImg } from "src/ts/persona";
    import Sortable from 'sortablejs';
    import { onDestroy, onMount } from "svelte";
    import { sleep, sortableOptions } from "src/ts/util";
    import { DBState } from 'src/ts/stores.svelte';
    import { PlusIcon } from "@lucide/svelte";
    import { v4 } from "uuid"

    let stb: Sortable | null = null
    let ele: HTMLDivElement | undefined = $state()
    let sorted = $state(0)
    let selectedId: string | null = null
    const createStb = () => {
        if(!ele){
            return
        }
        stb = Sortable.create(ele, {
            onStart: async () => {
                const selectedPersona = DBState.db.personas[DBState.db.selectedPersona]
                if(!selectedPersona){
                    return
                }
                selectedPersona.id ??= v4()
                selectedId = selectedPersona.id
                saveUserPersona()
            },
            onEnd: async () => {
                const idx:number[] = []
                const targetElement = ele
                if(!targetElement){
                    return
                }
                targetElement.querySelectorAll('[data-risu-idx]').forEach((e) => {
                    const idxString = e.getAttribute('data-risu-idx')
                    if(idxString !== null){
                        idx.push(parseInt(idxString))
                    }
                })
                const newValue:{
                    personaPrompt:string
                    name:string
                    icon:string
                    note?:string
                    largePortrait?:boolean
                    id?:string
                }[] = []
                idx.forEach((i) => {
                    newValue.push(DBState.db.personas[i])
                })
                DBState.db.personas = newValue
                const selectedPersona = DBState.db.personas.findIndex((e) => e.id === selectedId)
                changeUserPersona(selectedPersona !== -1 ? selectedPersona : 0, 'noSave')
                try {
                    stb?.destroy()
                } catch {}
                sorted += 1
                await sleep(1)
                createStb()
            },
            ...sortableOptions
        })
    }

    onMount(createStb)

    onDestroy(() => {
        if(stb){
            try {
                stb.destroy()
            } catch {}
        }
    })
</script>
<h2 class="ds-settings-page-title">{language.persona}</h2>

<div class="ds-settings-page">
{#key sorted}
<div class="ds-settings-section ds-settings-card ds-settings-wrap-row" bind:this={ele}>
    {#each DBState.db.personas as persona, i (persona.id ?? i)}
        <Button
            size="sm"
            styled="outlined"
            data-risu-idx={i}
            className={"ds-settings-icon-action ds-settings-persona-tile icon-btn " + (i === DBState.db.selectedPersona ? "ds-settings-persona-tile-selected" : "")}
            onclick={() => {
            changeUserPersona(i)
        }}>
            {#if persona.icon === ''}
                <div class="ds-settings-avatar-fallback"></div>
            {:else}
                {#await getCharImage(persona.icon, 'css')}
                    <div class="ds-settings-avatar-fallback"></div>
                {:then im} 
                    <div class="ds-settings-avatar-fallback" style={im}></div>
                {/await}
            {/if}
        </Button>
    {/each}
    <div class="ds-settings-inline-actions action-rail">
        <Button
            size="sm"
            className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
            onclick={async () => {
                const sel = parseInt(await alertSelect([language.createfromScratch, language.importCharacter]))
                if(sel === 0){
                    DBState.db.personas.push({
                        name: 'New Persona',
                        icon: '',
                        personaPrompt: '',
                        note: ''
                    })
                    changeUserPersona(DBState.db.personas.length - 1)
                } else if(sel === 1){
                    await importUserPersona()
                }
            }}>
            <PlusIcon />
        </Button>
    </div>
</div>
{/key}

<div class="ds-settings-section ds-settings-card ds-settings-persona-profile">
    <div class="ds-settings-section">
        <Button size="sm" styled="outlined" className="ds-settings-icon-action ds-settings-persona-user-tile icon-btn" onclick={() => {selectUserImg()}}>
            {#if DBState.db.userIcon === ''}
                <div class="ds-settings-avatar-fallback"></div>
            {:else}
                {#await getCharImage(DBState.db.userIcon, DBState.db.personas[DBState.db.selectedPersona].largePortrait ? 'lgcss' : 'css')}
                    <div class="ds-settings-avatar-fallback"></div>
                {:then im} 
                    <div class="ds-settings-avatar-fallback" style={im}></div>
                {/await}
            {/if}
        </Button>
    </div>
    <div class="ds-settings-section ds-settings-persona-editor">
        <span class="ds-settings-label-muted-sm">{language.name}</span>
        <TextInput size="sm" placeholder="User" bind:value={DBState.db.username}/>
        <span class="ds-settings-label-muted-sm">{language.description}</span>
        <TextAreaInput autocomplete="off" bind:value={DBState.db.personaPrompt} placeholder="Put the description of this persona here.\nExample: [<user> is a 20 year old girl.]" />
        <div class="ds-settings-inline-actions ds-settings-inline-actions-fluid action-rail">
            <Button onclick={exportUserPersona}>{language.export}</Button>
            <Button onclick={importUserPersona}>{language.import}</Button>

            <Button styled="danger" onclick={async () => {
                if(DBState.db.personas.length === 1){
                    return
                }
                const d = await alertConfirm(`${language.removeConfirm}${DBState.db.personas[DBState.db.selectedPersona].name}`)
                if(d){
                    saveUserPersona()
                    const personas = DBState.db.personas
                    personas.splice(DBState.db.selectedPersona, 1)
                    DBState.db.personas = personas
                    changeUserPersona(0, 'noSave')
                }
            }}>{language.remove}</Button>
            <Check bind:check={DBState.db.personas[DBState.db.selectedPersona].largePortrait}>{language.largePortrait}</Check>
        </div>
    </div>
</div>
</div>
