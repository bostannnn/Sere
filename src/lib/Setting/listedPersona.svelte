<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { language } from "../../lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { changeUserPersona } from "src/ts/persona";


    interface Props {
        close?: () => void;
    }

    const { close = () => {} }: Props = $props();

</script>

<div class="ds-settings-modal-overlay">
    <div class="ds-settings-modal ds-settings-modal--md ds-settings-break-any">
        <div class="ds-settings-modal-header">
            <h2 class="ds-settings-modal-title">{language.persona}</h2>
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
        {#each DBState.db.personas as persona, i (persona.id ?? i)}
            <button onclick={() => {
                changeUserPersona(i)
                close()
            }} class="ds-settings-modal-list-row" class:ds-settings-modal-list-row-selected={i === DBState.db.selectedPersona}>
                <span class="ds-settings-modal-list-text">
                    <span class="ds-settings-text-medium">{persona.name}</span>
                    {#if persona.note}
                        <span class="ds-settings-modal-note-muted"> / {persona.note}</span>
                    {/if}
                </span>
            </button>
        {/each}
    </div>
</div>
