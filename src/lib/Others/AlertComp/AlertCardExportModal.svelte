<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import { isCharacterHasAssets } from "src/ts/characterCards";
    import { alertStore, DBState, selectedCharID } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import type { AlertState } from "./types";

    interface Props {
        alert: AlertState;
    }

    const { alert }: Props = $props();

    let cardExportType = $state("");
    let cardExportType2 = $state("");

    function finish(type: string, type2: string) {
        alertStore.set({
            type: "none",
            msg: JSON.stringify({ type, type2 }),
        });
    }

    function close() {
        finish("cancel", cardExportType2);
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
    class="alert-cardexport-overlay"
    role="button"
    tabindex="0"
    aria-label="Close export dialog"
    onclick={close}
    onkeydown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            close();
        }
    }}
>
    <div
        class="alert-cardexport-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Export options"
        tabindex="-1"
        onclick={(event) => event.stopPropagation()}
    >
        <h1 class="alert-cardexport-title">
            <span>{language.shareExport}</span>
            <button
                type="button"
                class="alert-close-button"
                title="Close export modal"
                aria-label="Close export modal"
                onclick={close}
            >
                <XIcon />
            </button>
        </h1>
        <span class="alert-cardexport-subtitle">{language.type}</span>
        {#if cardExportType === ""}
            {#if alert.submsg === "module"}
                <span class="alert-cardexport-desc">{language.risuMDesc}</span>
            {:else if alert.submsg === "preset"}
                <span class="alert-cardexport-desc">{language.risupresetDesc}</span>
                {#if cardExportType2 === "preset" && (DBState.db.botPresets[DBState.db.botPresetsId].image || DBState.db.botPresets[DBState.db.botPresetsId].regex?.length > 0)}
                    <span class="alert-note-danger alert-text-sm">Preset with image or regexes cannot be exported for now.</span>
                {/if}
            {:else}
                <span class="alert-cardexport-desc">{language.ccv3Desc}</span>
                {#if cardExportType2 !== "charx" && cardExportType2 !== "charxJpeg" && isCharacterHasAssets(DBState.db.characters[$selectedCharID])}
                    <span class="alert-note-danger alert-text-sm">{language.notCharxWarn}</span>
                {/if}
            {/if}
        {:else if cardExportType === "json"}
            <span class="alert-cardexport-desc">{language.jsonDesc}</span>
        {:else if cardExportType === "ccv2"}
            <span class="alert-cardexport-desc">{language.ccv2Desc}</span>
            <span class="alert-note-danger alert-text-sm">{language.v2Warning}</span>
        {/if}

        <div class="alert-cardexport-type-row">
            {#if alert.submsg === "preset"}
                <button
                    type="button"
                    class="alert-cardexport-type-button"
                    class:alert-cardexport-type-button-active={cardExportType === ""}
                    title="Risupreset"
                    aria-label="Select Risupreset export"
                    aria-pressed={cardExportType === ""}
                    onclick={() => cardExportType = ""}
                >Risupreset</button>
            {:else if alert.submsg === "module"}
                <button
                    type="button"
                    class="alert-cardexport-type-button"
                    class:alert-cardexport-type-button-active={cardExportType === ""}
                    title="RisuM"
                    aria-label="Select RisuM export"
                    aria-pressed={cardExportType === ""}
                    onclick={() => cardExportType = ""}
                >RisuM</button>
            {:else}
                <button
                    type="button"
                    class="alert-cardexport-type-button"
                    class:alert-cardexport-type-button-active={cardExportType === ""}
                    title="Character Card V3"
                    aria-label="Select Character Card V3 export"
                    aria-pressed={cardExportType === ""}
                    onclick={() => {
                        cardExportType = "";
                        cardExportType2 = "charxJpeg";
                    }}
                >Character Card V3</button>
                <button
                    type="button"
                    class="alert-cardexport-type-button"
                    class:alert-cardexport-type-button-active={cardExportType === "ccv2"}
                    title="Character Card V2"
                    aria-label="Select Character Card V2 export"
                    aria-pressed={cardExportType === "ccv2"}
                    onclick={() => cardExportType = "ccv2"}
                >Character Card V2</button>
            {/if}
        </div>

        {#if alert.submsg === "" && cardExportType === ""}
            <span class="alert-cardexport-subtitle">{language.format}</span>
            <SelectInput bind:value={cardExportType2} className="alert-cardexport-select">
                <OptionInput value="charx">CHARX</OptionInput>
                <OptionInput value="charxJpeg">CHARX-JPEG</OptionInput>
                <OptionInput value="">PNG</OptionInput>
                <OptionInput value="json">JSON</OptionInput>
            </SelectInput>
        {/if}

        <Button className="alert-cardexport-submit" onclick={() => finish(cardExportType, cardExportType2)}>
            {language.export}
        </Button>
    </div>
</div>

<style>
    .alert-cardexport-overlay {
        position: fixed;
        inset: 0;
        z-index: 2000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: color-mix(in srgb, #000 50%, transparent);
    }

    .alert-cardexport-modal {
        width: min(42rem, 100%);
        max-width: 100%;
        display: flex;
        flex-direction: column;
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-2);
        padding: var(--ds-space-4);
    }

    .alert-cardexport-title {
        margin: 0;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--ds-space-2);
        font-size: var(--ds-font-size-xl);
        font-weight: var(--ds-font-weight-bold);
        color: var(--ds-text-primary);
    }

    .alert-cardexport-subtitle {
        margin-top: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    .alert-cardexport-desc {
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
    }

    .alert-cardexport-type-row {
        margin-top: var(--ds-space-2);
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--ds-space-2);
    }

    .alert-cardexport-type-button {
        flex: 1 1 0;
        min-width: 0;
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
        padding: var(--ds-space-2);
        color: var(--ds-text-primary);
        transition: border-color var(--ds-motion-fast) var(--ds-ease-standard),
            box-shadow var(--ds-motion-fast) var(--ds-ease-standard),
            background-color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-cardexport-type-button-active {
        border-color: var(--ds-border-strong);
        background: color-mix(in srgb, var(--ds-surface-active) 35%, var(--ds-surface-1) 65%);
        box-shadow: 0 0 0 1px color-mix(in srgb, var(--ds-border-strong) 35%, transparent);
    }

    :global(.alert-cardexport-select) {
        margin-top: var(--ds-space-2);
    }

    :global(.alert-cardexport-submit) {
        margin-top: var(--ds-space-4);
    }

    .alert-close-button {
        color: var(--ds-text-secondary);
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-close-button:hover {
        color: var(--risu-theme-success-500);
    }

    .alert-note-danger {
        color: var(--ds-text-danger, var(--risu-theme-danger-500));
    }

    .alert-text-sm {
        font-size: var(--ds-font-size-sm);
    }
</style>
