<script lang="ts">
    import { User } from "@lucide/svelte";
    import BarIcon from "../../SideBars/BarIcon.svelte";
    import { getCharImage } from "src/ts/characters";
    import { DBState, alertStore } from "src/ts/stores.svelte";

    function selectCharacter(charId: string) {
        alertStore.set({
            type: "none",
            msg: charId,
        });
    }
</script>

<div class="alert-overlay">
    <div class="alert-modal-base break-any">
        <h2 class="alert-heading">Select</h2>
        <div class="alert-select-char-grid">
            {#each DBState.db.characters as char, index (char.chaId ?? index)}
                {#if char.type !== "group"}
                    {#if char.image}
                        {#await getCharImage(DBState.db.characters[index].image, "css")}
                            <BarIcon onClick={() => selectCharacter(char.chaId)}>
                                <User />
                            </BarIcon>
                        {:then imageStyle}
                            <BarIcon onClick={() => selectCharacter(char.chaId)} additionalStyle={imageStyle} />
                        {/await}
                    {:else}
                        <BarIcon onClick={() => selectCharacter(char.chaId)}>
                            <User />
                        </BarIcon>
                    {/if}
                {/if}
            {/each}
        </div>
    </div>
</div>

<style>
    .alert-overlay {
        position: absolute;
        inset: 0;
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, #000 50%, transparent);
    }

    .alert-modal-base {
        display: flex;
        flex-direction: column;
        max-width: 48rem;
        max-height: 100%;
        overflow-y: auto;
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-heading {
        margin: 0 0 0.5rem;
        width: 10rem;
        max-width: 100%;
        color: var(--risu-theme-success-500);
    }

    .alert-select-char-grid {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        align-items: flex-start;
        justify-content: flex-start;
        gap: var(--ds-space-2);
    }

    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
