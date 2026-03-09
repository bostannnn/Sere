<script lang="ts">
    import Button from "src/lib/UI/GUI/Button.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import { XIcon } from "@lucide/svelte";
    import { DBState, alertStore, selectedCharID } from "src/ts/stores.svelte";

    let selectedTab = $state(0);

    function closeModal() {
        alertStore.set({
            type: "none",
            msg: "",
        });
    }
</script>

<div class="alert-overlay">
    <div class="alert-modal-base break-any">
        <div class="alert-hypav2-toolbar">
            <Button selected={selectedTab === 0} size="sm" onclick={() => selectedTab = 0}>Chunks</Button>
            <Button selected={selectedTab === 1} size="sm" onclick={() => selectedTab = 1}>Summarized</Button>
            <button
                type="button"
                class="alert-toolbar-close"
                title="Close HypaV2 details"
                aria-label="Close HypaV2 details"
                onclick={closeModal}
            >
                <XIcon />
            </button>
        </div>

        {#if selectedTab === 0}
            <div class="alert-stack-col">
                {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.chunks as chunk, index (index)}
                    <TextAreaInput bind:value={chunk.text} />
                {/each}
            </div>
        {:else}
            {#each DBState.db.characters[$selectedCharID].chats[DBState.db.characters[$selectedCharID].chatPage].hypaV2Data.mainChunks as chunk, index (index)}
                <div class="alert-summary-card">
                    {#if index === 0}
                        <span class="alert-info-success">Active</span>
                    {:else}
                        <span>Inactive</span>
                    {/if}
                    <TextAreaInput bind:value={chunk.text} />
                </div>
            {/each}
        {/if}
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

    .alert-hypav2-toolbar {
        width: min(31rem, 100%);
        max-width: 100%;
        margin-bottom: var(--ds-space-4);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-toolbar-close {
        margin-left: auto;
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-toolbar-close:hover {
        color: var(--ds-text-primary);
    }

    .alert-stack-col {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .alert-summary-card {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2);
        background: color-mix(in srgb, var(--ds-surface-2) 85%, var(--ds-surface-1) 15%);
    }

    .alert-info-success {
        color: var(--risu-theme-success-500);
    }

    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
