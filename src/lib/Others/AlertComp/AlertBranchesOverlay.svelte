<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import { getChatBranches } from "src/ts/gui/branches";
    import { getCurrentCharacter } from "src/ts/storage/database.svelte";
    import { alertStore } from "src/ts/stores.svelte";
    import type { BranchHover } from "./types";

    let branchHover: BranchHover | null = $state(null);

    function clearHover() {
        branchHover = null;
    }

    function closeModal() {
        alertStore.set({
            type: "none",
            msg: "",
        });
    }

    function showHover(chatId: number, x: number, y: number) {
        if (branchHover !== null) {
            return;
        }
        const char = getCurrentCharacter();
        branchHover = {
            x,
            y,
            content: char.chats[chatId].message[y - 1].data,
        };
    }
</script>

<div class="alert-branches-overlay">
    {#if branchHover !== null}
        <div class="alert-branch-tooltip" style="top: {branchHover.y * 80 + 24}px; left: {(branchHover.x + 1) * 80 + 24}px">
            {branchHover.content}
        </div>
    {/if}

    <div class="alert-branch-close-anchor">
        <button
            type="button"
            class="alert-branch-close-button"
            title="Close branches"
            aria-label="Close branches"
            onclick={closeModal}
        >
            <XIcon />
        </button>
    </div>

    {#each getChatBranches() as obj, index (index)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
            role="table"
            class="alert-branch-node"
            style="top: {obj.y * 80 + 24}px; left: {obj.x * 80 + 24}px"
            onmouseenter={() => showHover(obj.chatId, obj.x, obj.y)}
            onclick={() => showHover(obj.chatId, obj.x, obj.y)}
            onmouseleave={clearHover}
        ></div>
        {#if obj.connectX === obj.x}
            <div
                class="alert-branch-line-vertical alert-branch-line-tall"
                class:alert-branch-line-danger={obj.multiChild}
                class:alert-branch-line-primary={!obj.multiChild}
                style="top: {(obj.y - 1) * 80 + 24}px; left: {obj.x * 80 + 45}px"
            ></div>
        {:else if obj.connectX !== -1}
            <div
                class="alert-branch-line-vertical alert-branch-line-short alert-branch-line-danger"
                style="top: {obj.y * 80}px; left: {obj.x * 80 + 45}px"
            ></div>
            <div
                class="alert-branch-line-horizontal alert-branch-line-danger"
                style="top: {obj.y * 80}px; left: {obj.connectX * 80 + 46}px"
                style:width={Math.abs((obj.x - obj.connectX) * 80) + "px"}
            ></div>
        {/if}
    {/each}
</div>

<style>
    .alert-branches-overlay {
        position: absolute;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-x: auto;
        overflow-y: auto;
        background: color-mix(in srgb, #000 80%, transparent);
    }

    .alert-branch-tooltip {
        position: absolute;
        z-index: 30;
        white-space: pre-wrap;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-branch-close-anchor {
        position: absolute;
        top: var(--ds-space-2);
        right: var(--ds-space-2);
    }

    .alert-branch-close-button {
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-2);
        color: var(--ds-text-primary);
    }

    .alert-branch-node {
        position: absolute;
        width: 3rem;
        height: 3rem;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow-y: auto;
        border: 1px solid var(--ds-border-subtle);
        border-radius: 9999px;
        background: var(--ds-surface-1);
    }

    .alert-branch-line-vertical {
        position: absolute;
        width: 0;
        border-left-width: 1px;
        border-right-width: 1px;
    }

    .alert-branch-line-horizontal {
        position: absolute;
        height: 0;
        border-top-width: 1px;
        border-bottom-width: 1px;
    }

    .alert-branch-line-tall {
        height: 5rem;
    }

    .alert-branch-line-short {
        height: 2.5rem;
    }

    .alert-branch-line-danger {
        border-color: color-mix(in srgb, var(--ds-text-danger, var(--risu-theme-danger-500)) 72%, var(--ds-text-primary) 28%);
    }

    .alert-branch-line-primary {
        border-color: color-mix(in srgb, var(--risu-theme-primary-500) 72%, var(--ds-text-primary) 28%);
    }
</style>
