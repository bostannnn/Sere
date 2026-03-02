<script lang="ts">
    import { type character, type groupChat } from "src/ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import BarIcon from "../SideBars/BarIcon.svelte";
    import { addCharacter, changeChar, getCharImage } from "src/ts/characters";
    import { MobileSearch } from "src/ts/stores.svelte";
    import { MessageSquareIcon, PlusIcon } from "@lucide/svelte";

    interface Props {
        gridMode?: boolean;
        endGrid?: () => void;
    }

    const agoFormatter = new Intl.RelativeTimeFormat(navigator.languages, { style: 'short' });

    const {gridMode = false, endGrid = () => {}}: Props = $props();

    function makeAgoText(time:number){
        if(time === 0){
            return "Unknown";
        }
        const diff = Date.now() - time;
        if(diff < 3600000){
            const min = Math.floor(diff / 60000);
            return agoFormatter.format(-min, 'minute');
        }
        if(diff < 86400000){
            const hour = Math.floor(diff / 3600000);
            return agoFormatter.format(-hour, 'hour');
        }
        if(diff < 604800000){
            const day = Math.floor(diff / 86400000);
            return agoFormatter.format(-day, 'day');
        }
        if(diff < 2592000000){
            const week = Math.floor(diff / 604800000);
            return agoFormatter.format(-week, 'week');
        }
        if(diff < 31536000000){
            const month = Math.floor(diff / 2592000000);
            return agoFormatter.format(-month, 'month');
        }
        const year = Math.floor(diff / 31536000000);
        return agoFormatter.format(-year, 'year');
    }

    function sortChar(char: (character|groupChat)[]) {
        return char.map((c, i) => {
            return {
                name: c.name || "Unnamed",
                image: c.image,
                chats: c.chats.length,
                i: i,
                interaction: c.lastInteraction || 0,
                agoText: makeAgoText(c.lastInteraction || 0),
            }
        }).sort((a, b) => {
            if (a.interaction === b.interaction) {
                return a.name.localeCompare(b.name);
            }
            return b.interaction - a.interaction;
        });
    }

    const filteredCharacters = $derived.by(() =>
        sortChar(DBState.db.characters).filter((char) =>
            char.name.toLocaleLowerCase().includes($MobileSearch.toLocaleLowerCase()),
        ),
    );
</script>
<div class="ds-mobile-char-list list-shell" data-testid="mobile-char-list">
    {#if filteredCharacters.length === 0}
        <div class="ds-mobile-char-empty empty-state" data-testid="mobile-char-empty">No characters</div>
    {:else}
        {#each filteredCharacters as char, i (char.i)}
            <button type="button" class="ds-mobile-char-row" class:is-separated={i !== 0} title={`Open ${char.name}`} aria-label={`Open ${char.name}`} onclick={() => {
                changeChar(char.i)
                endGrid()
            }}>
                <BarIcon additionalStyle={getCharImage(char.image, 'css')}></BarIcon>
                <div class="ds-mobile-char-info">
                    <span class="ds-mobile-char-name">{char.name}</span>
                    <div class="ds-mobile-char-stats">
                        <span class="ds-mobile-char-stat">{char.chats}</span>
                        <MessageSquareIcon size={14} />
                        <span class="ds-mobile-char-stat-divider">|</span>
                        <span class="ds-mobile-char-stat">{char.agoText}</span>
                    </div>
                </div>
            </button>
        {/each}
    {/if}
</div>

{#if gridMode}
    <button type="button" class="ds-mobile-char-fab icon-btn icon-btn--md icon-btn--bordered" title="Add character" aria-label="Add character" onclick={() => {
        addCharacter()
    }}>
        <PlusIcon size={24} />
    </button>
{/if}
