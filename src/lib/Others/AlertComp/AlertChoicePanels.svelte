<script lang="ts">
    import { ChevronRightIcon } from "@lucide/svelte";
    import { alertStore } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import type { AlertState } from "./types";

    interface Props {
        alert: AlertState;
    }

    const { alert }: Props = $props();

    function choose(message: string) {
        alertStore.set({
            type: "none",
            msg: message,
        });
    }
</script>

<div class="alert-overlay">
    <div class="alert-modal-base break-any">
        <div class="alert-wide-panel">
            {#if alert.type === "chatOptions"}
                <h1 class="alert-panel-title">{language.chatOptions}</h1>
            {/if}

            {#if alert.type === "addchar"}
                <button
                    type="button"
                    class="alert-choice-button"
                    title={language.importCharacter}
                    aria-label={language.importCharacter}
                    onclick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        choose("importCharacter");
                    }}
                >
                    <div class="alert-choice-content"><span>{language.importCharacter}</span></div>
                    <div class="alert-choice-arrow"><ChevronRightIcon /></div>
                </button>
                <button
                    type="button"
                    class="alert-choice-button"
                    title={language.createfromScratch}
                    aria-label={language.createfromScratch}
                    onclick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        choose("createfromScratch");
                    }}
                >
                    <div class="alert-choice-content"><span>{language.createfromScratch}</span></div>
                    <div class="alert-choice-arrow"><ChevronRightIcon /></div>
                </button>
                <button
                    type="button"
                    class="alert-choice-button"
                    title={language.createGroup}
                    aria-label={language.createGroup}
                    onclick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        choose("createGroup");
                    }}
                >
                    <div class="alert-choice-content"><span>{language.createGroup}</span></div>
                    <div class="alert-choice-arrow"><ChevronRightIcon /></div>
                </button>
            {:else}
                <button
                    type="button"
                    class="alert-choice-button"
                    title={language.createCopy}
                    aria-label={language.createCopy}
                    onclick={() => choose("0")}
                >
                    <div class="alert-choice-content"><span>{language.createCopy}</span></div>
                    <div class="alert-choice-arrow"><ChevronRightIcon /></div>
                </button>
                <button
                    type="button"
                    class="alert-choice-button"
                    title={language.bindPersona}
                    aria-label={language.bindPersona}
                    onclick={() => choose("1")}
                >
                    <div class="alert-choice-content"><span>{language.bindPersona}</span></div>
                    <div class="alert-choice-arrow"><ChevronRightIcon /></div>
                </button>
            {/if}

            <button
                type="button"
                class="alert-choice-button"
                title={language.cancel}
                aria-label={language.cancel}
                onclick={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    choose("cancel");
                }}
            >
                <div class="alert-choice-content"><span>{language.cancel}</span></div>
            </button>
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

    .alert-wide-panel {
        width: min(32rem, 100%);
        max-width: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .alert-choice-button {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        padding: var(--ds-space-2) var(--ds-space-6);
        background: var(--ds-surface-1);
        color: var(--ds-text-primary);
        transition: box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            border-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-choice-button:hover {
        border-color: var(--ds-border-strong);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 35%, transparent);
    }

    .alert-choice-content {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        gap: var(--ds-space-1);
        min-width: 0;
        text-align: left;
    }

    .alert-choice-arrow {
        margin-left: var(--ds-space-4);
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--ds-text-secondary);
    }

    .alert-panel-title {
        margin: 0 0 var(--ds-space-4);
        color: var(--ds-text-primary);
        font-size: var(--ds-font-size-lg);
        font-weight: var(--ds-font-weight-semibold);
    }

    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }
</style>
