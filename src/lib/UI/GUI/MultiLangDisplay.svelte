<script lang="ts">
    import { ColorSchemeTypeStore } from "src/ts/gui/colorscheme";
    import { ParseMarkdown } from "src/ts/parser.svelte";
    import { parseMultilangString, toLangName } from "src/ts/util";

    interface Props {
        value: string;
        markdown?: boolean;
    }

    const { value, markdown = false }: Props = $props();
    const valueObject: {[code:string]:string} = $derived(parseMultilangString(value))
    let selectedLang = $state("en")
    $effect.pre(() => {
        if(valueObject["en"] === undefined){
            selectedLang = "xx"
        }
    });
</script>

<div class="ds-multilang-display-root">
    <div class="ds-multilang-display-tabs seg-tabs">
        {#each Object.keys(valueObject) as lang (lang)}
            {#if lang !== 'xx' || Object.keys(valueObject).length === 1}
                <button class="ds-multilang-display-tab seg-tab" class:is-active={selectedLang === lang} onclick={((e) => {
                    e.stopPropagation()
                    selectedLang = lang
                })}>{toLangName(lang)}</button>
            {/if}
        {/each}
    </div>
    {#if markdown}
        <div class="ds-multilang-display-content text chat chattext prose" class:prose-invert={$ColorSchemeTypeStore}>
            {#await ParseMarkdown(valueObject[selectedLang]) then md} 
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html md}
            {/await}
        </div>
    {:else}
        <div class="ds-multilang-display-content text chat chattext prose" class:prose-invert={$ColorSchemeTypeStore}>
            {valueObject[selectedLang]}
        </div>
    {/if}
</div>

<style>
    .ds-multilang-display-root{
        display: flex;
        flex-direction: column;
    }

    .ds-multilang-display-tabs.seg-tabs{
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

    .ds-multilang-display-tab.seg-tab{
        background: var(--ds-surface-3);
        color: var(--ds-text-primary);
        min-height: var(--ds-height-control-sm);
        padding: var(--ds-space-2) var(--ds-space-4);
        border-radius: var(--ds-radius-md);
        border: 1px solid transparent;
        border-right: 1px solid transparent;
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .ds-multilang-display-tab.seg-tab.is-active{
        border-color: var(--ds-border-strong);
        background: var(--ds-surface-active);
        box-shadow: none;
    }

    .ds-multilang-display-content{
        margin-left: var(--ds-space-2);
        max-width: 100%;
        overflow-wrap: anywhere;
    }
</style>
