<script lang="ts">
     
    import { encodeMultilangString, languageCodes, parseMultilangString, toLangName } from "src/ts/util";
    import TextAreaInput from "./TextAreaInput.svelte";
    let addingLang = $state(false)
    let selectedLang = $state("en")
    interface Props {
        value: string;
        className?: string;
        onInput?: () => void;
    }

    let { value = $bindable(), className = "", onInput = () => {} }: Props = $props();
    const parsed = parseMultilangString(value)
    if(parsed["en"] === undefined){
        parsed["en"] = parsed["xx"]
        delete parsed["xx"]
    }
    let valueObject: {[code:string]:string} = $state(parsed)
    const updateValue = () => {
        for(const lang in valueObject){
            if(valueObject[lang] === "" && lang !== selectedLang && lang!=="en" ){
                delete valueObject[lang]
            }
        }
        if(valueObject.xx){
            delete valueObject.xx
        }
        if(valueObject.en === ""){
            valueObject.en = ' '
        }
        valueObject = valueObject // force update
        value = encodeMultilangString(valueObject)
    }
    updateValue()
</script>

<div class="ds-multilang-tabs seg-tabs">
    {#each Object.keys(valueObject) as lang (lang)}
        {#if lang !== 'xx'}
            <button class="ds-multilang-tab seg-tab" class:is-active={selectedLang === lang} onclick={() => {
                selectedLang = lang
                updateValue()
            }}>{toLangName(lang)}</button>
        {/if}
    {/each}
    <button class="ds-multilang-tab ds-multilang-tab-add seg-tab" class:is-active={addingLang} onclick={() => {addingLang = !addingLang}}>+</button>
</div>
{#if addingLang}
    <div class="ds-multilang-add-list">
        {#each languageCodes as lang (lang)}
            {#if toLangName(lang) !== lang}
                <button class="ds-multilang-tab ds-multilang-tab-add seg-tab" onclick={() => {
                    valueObject[lang] = ""
                    selectedLang = lang
                    addingLang = false
                }}>{toLangName(lang)}</button>
            {/if}
        {/each}
    </div>
{/if}
<TextAreaInput autocomplete="off" bind:value={valueObject[selectedLang]} onInput={() => {
    updateValue()
    onInput()
}} className={className} />

<style>
    .ds-multilang-tabs.seg-tabs{
        display: flex;
        flex-wrap: wrap;
        max-width: fit-content;
        width: fit-content;
        padding: var(--ds-space-1);
        gap: var(--ds-space-2);
        border: 0;
        background: transparent;
        overflow: visible;
    }

    .ds-multilang-add-list{
        margin: var(--ds-space-1);
        padding: var(--ds-space-1);
        display: flex;
        flex-wrap: wrap;
        max-width: fit-content;
        gap: var(--ds-space-1);
        border-radius: var(--ds-radius-md);
        border: 1px solid var(--ds-border-subtle);
    }

    .ds-multilang-tab.seg-tab{
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
        min-height: var(--ds-height-control-sm);
        padding: var(--ds-space-2) var(--ds-space-4);
        border-radius: var(--ds-radius-md);
        white-space: nowrap;
        border: 1px solid transparent;
        border-right: 1px solid transparent;
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-multilang-tab.seg-tab.is-active{
        border-color: var(--ds-border-strong);
        background: var(--ds-surface-active);
        box-shadow: none;
    }

    .ds-multilang-tab-add{
        color: var(--ds-text-secondary);
    }
</style>
