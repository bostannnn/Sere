<script lang="ts">
    import { ArrowLeft } from "@lucide/svelte";
    import { language } from "src/lang";
    import { PlaygroundStore, SizeStore, selectedCharID } from "src/ts/stores.svelte";
    import PlaygroundEmbedding from "./PlaygroundEmbedding.svelte";
    import PlaygroundTokenizer from "./PlaygroundTokenizer.svelte";
    import PlaygroundSyntax from "./PlaygroundSyntax.svelte";
    import { findCharacterIndexbyId } from "src/ts/util";
    import { characterFormatUpdate, createBlankChar } from "src/ts/characters";
    import { type character } from "src/ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import PlaygroundParser from "./PlaygroundParser.svelte";
    import PlaygroundSubtitle from "./PlaygroundSubtitle.svelte";
    import PlaygroundImageTrans from "./PlaygroundImageTrans.svelte";
    import PlaygroundTranslation from "./PlaygroundTranslation.svelte";
    import PlaygroundMcp from "./PlaygroundMCP.svelte";
    import PlaygroundDocs from "./PlaygroundDocs.svelte";
    import PlaygroundInlayExplorer from './PlaygroundInlayExplorer.svelte';

    type PlaygroundEntry = {
        id: number;
        label: string;
        wide?: boolean;
        onSelect: () => void;
    };

    const playgroundChat = () => {
        const charIndex = findCharacterIndexbyId('§playground')
        PlaygroundStore.set(2)

        if (charIndex !== -1) {

            const char = DBState.db.characters[charIndex] as character
            char.utilityBot = true
            char.name = 'assistant'
            char.firstMessage = '{{none}}'
            DBState.db.characters[charIndex] = char
            characterFormatUpdate(charIndex)

            selectedCharID.set(charIndex)
            return
        }

        const character = createBlankChar()
        character.chaId = '§playground'

        DBState.db.characters.push(character)

        playgroundChat()

    }

    const playgroundEntries: PlaygroundEntry[] = [
        { id: 2, label: language.Chat, wide: true, onSelect: playgroundChat },
        { id: 13, label: "CBS Doc", onSelect: () => PlaygroundStore.set(13) },
        { id: 3, label: language.embedding, onSelect: () => PlaygroundStore.set(3) },
        { id: 4, label: language.tokenizer, onSelect: () => PlaygroundStore.set(4) },
        { id: 5, label: language.syntax, onSelect: () => PlaygroundStore.set(5) },
        { id: 8, label: "Parser", onSelect: () => PlaygroundStore.set(8) },
        { id: 9, label: language.subtitles, onSelect: () => PlaygroundStore.set(9) },
        { id: 10, label: language.imageTranslation, onSelect: () => PlaygroundStore.set(10) },
        { id: 11, label: language.translator, onSelect: () => PlaygroundStore.set(11) },
        { id: 12, label: "MCP", onSelect: () => PlaygroundStore.set(12) },
        { id: 14, label: "Inlay Assets Explorer", onSelect: () => PlaygroundStore.set(14) },
    ];
</script>

<div class="h-full w-full flex flex-col overflow-y-auto items-center">
    {#if $PlaygroundStore === 1}
        <h2 class="text-4xl text-textcolor my-6 font-black relative">{language.playground}</h2>
        <div class="w-full max-w-4xl p-2 list-shell">
            <div class="playground-menu-grid grid grid-cols-1 gap-4 md:grid-cols-2">
                {#each playgroundEntries as entry (entry.id)}
                    <button
                        type="button"
                        title={entry.label}
                        aria-label={entry.label}
                        class={`playground-menu-card panel-shell bg-darkbg rounded-md p-6 flex flex-col transition-shadow hover:ring-1${entry.wide ? " md:col-span-2" : ""}`}
                        onclick={entry.onSelect}
                    >
                        <h1 class="text-2xl font-bold text-start">{entry.label}</h1>
                    </button>
                {/each}
            </div>
        </div>
    {:else}
        {#if $SizeStore.w < 1024}
            <div class="mt-14"></div>
        {/if}
        <div class="w-full max-w-4xl flex flex-col p-2">
            <div class="flex items-center mt-4">
                <button
                    type="button"
                    title="Back to playground menu"
                    aria-label="Back to playground menu"
                    class="mr-2 text-textcolor2 hover:text-green-500 icon-btn icon-btn--sm"
                    onclick={() => ($PlaygroundStore = 1)}
                >
                <ArrowLeft/>
                </button>
            </div>

            {#if $PlaygroundStore === 2}
                <!-- <PlaygroundChat/> -->
            {/if}
            {#if $PlaygroundStore === 3}
                <PlaygroundEmbedding/>
            {/if}
            {#if $PlaygroundStore === 4}
                <PlaygroundTokenizer/>
            {/if}
            {#if $PlaygroundStore === 5}
                <PlaygroundSyntax/>
            {/if}
            {#if $PlaygroundStore === 8}
                <PlaygroundParser/>
            {/if}  
            {#if $PlaygroundStore === 9}
                <PlaygroundSubtitle/>
            {/if}
            {#if $PlaygroundStore === 10}
               <PlaygroundImageTrans/>
            {/if}
            {#if $PlaygroundStore === 11}
                <PlaygroundTranslation/>
            {/if}
            {#if $PlaygroundStore === 12}
                <PlaygroundMcp/>
            {/if}
            {#if $PlaygroundStore === 13}
                <PlaygroundDocs/>
            {/if}
            {#if $PlaygroundStore === 14}
                <PlaygroundInlayExplorer/>
            {/if}
        </div>
    {/if}
</div>
