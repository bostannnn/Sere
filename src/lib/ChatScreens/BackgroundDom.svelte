<script lang="ts">
    import { ParseMarkdown, risuChatParser } from "src/ts/parser.svelte";
    import { type character, type groupChat } from "src/ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import { moduleBackgroundEmbedding, ReloadGUIPointer, selIdState } from "src/ts/stores.svelte";

    const backgroundHTML = $derived(DBState.db?.characters?.[selIdState.selId]?.backgroundHTML)
    const currentChar:character|groupChat = $derived(DBState.db?.characters?.[selIdState.selId])

</script>


{#if backgroundHTML || $moduleBackgroundEmbedding}
    {#if selIdState.selId > -1}
        {#key $ReloadGUIPointer}
            <div class="background-dom-layer">
                {#await ParseMarkdown(risuChatParser((backgroundHTML || '') + '\n' + ($moduleBackgroundEmbedding || ''), {chara:currentChar}), currentChar, 'back') then md} 
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                    {@html md}
                {/await}
            </div>
        {/key}
    {/if}
{/if}

<style>
    .background-dom-layer {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
    }

    .background-dom-layer :global(*) {
        pointer-events: none !important;
    }
</style>
