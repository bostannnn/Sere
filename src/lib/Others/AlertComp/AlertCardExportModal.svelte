<script lang="ts">
    import { XIcon } from "@lucide/svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import { isCharacterHasAssets } from "src/ts/characterCards";
    import { normalizeCardExportSelection, type CardExportScope, type CardExportFormat } from "src/ts/cardExportOptions";
    import { alertStore, DBState, selectedCharID } from "src/ts/stores.svelte";
    import { language } from "src/lang";
    import type { AlertState } from "./types";

    interface Props {
        alert: AlertState;
    }

    const { alert }: Props = $props();

    const scope = $derived<CardExportScope>(alert.submsg === "preset"
        ? "preset"
        : alert.submsg === "module"
            ? "module"
            : "character");
    const isCharacterExport = $derived(scope === "character");

    let format = $state<CardExportFormat>("json");
    let includeChats = $state(false);
    let includeMemories = $state(false);
    let includeEvolution = $state(false);

    function setFormat(nextFormat: CardExportFormat) {
        format = nextFormat;
        if (nextFormat !== "json") {
            includeChats = false;
            includeMemories = false;
            includeEvolution = false;
        }
    }

    function setIncludeChats(nextValue: boolean) {
        includeChats = nextValue;
        if (!nextValue) {
            includeMemories = false;
        }
    }

    function finish(cancelled = false) {
        const selection = normalizeCardExportSelection({
            format,
            includeChats,
            includeMemories,
            includeEvolution,
            cancelled,
        }, scope);
        alertStore.set({
            type: "none",
            msg: JSON.stringify(selection),
        });
    }

    function close() {
        finish(true);
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
        {#if scope === "module"}
            <span class="alert-cardexport-desc">{language.risuMDesc}</span>
        {:else if scope === "preset"}
            <span class="alert-cardexport-desc">{language.risupresetDesc}</span>
            {#if DBState.db.botPresets[DBState.db.botPresetsId].image || DBState.db.botPresets[DBState.db.botPresetsId].regex?.length > 0}
                <span class="alert-note-danger alert-text-sm">Preset with image or regexes cannot be exported for now.</span>
            {/if}
        {:else}
            <span class="alert-cardexport-desc">{language.ccv3Desc}</span>
            {#if format !== "charx" && format !== "charxJpeg" && isCharacterHasAssets(DBState.db.characters[$selectedCharID])}
                <span class="alert-note-danger alert-text-sm">{language.notCharxWarn}</span>
            {/if}
        {/if}

        {#if scope !== "character"}
            <div class="alert-cardexport-type-row">
                {#if scope === "preset"}
                    <button
                        type="button"
                        class="alert-cardexport-type-button alert-cardexport-type-button-active"
                        title="Risupreset"
                        aria-label="Select Risupreset export"
                        aria-pressed={true}
                    >Risupreset</button>
                {:else}
                    <button
                        type="button"
                        class="alert-cardexport-type-button alert-cardexport-type-button-active"
                        title="RisuM"
                        aria-label="Select RisuM export"
                        aria-pressed={true}
                    >RisuM</button>
                {/if}
            </div>
        {/if}

        {#if isCharacterExport}
            <span class="alert-cardexport-subtitle">{language.format}</span>
            <SelectInput
                value={format}
                className="alert-cardexport-select"
                onchange={(event) => {
                    setFormat(event.currentTarget.value as CardExportFormat);
                }}
            >
                <OptionInput value="charx">CHARX</OptionInput>
                <OptionInput value="charxJpeg">CHARX-JPEG</OptionInput>
                <OptionInput value="png">PNG</OptionInput>
                <OptionInput value="json">JSON</OptionInput>
            </SelectInput>
        {/if}

        {#if isCharacterExport && format === "json"}
            <div class="alert-cardexport-options">
                <CheckInput
                    check={includeChats}
                    name="Chats"
                    onChange={(value) => {
                        setIncludeChats(value);
                    }}
                />
                <CheckInput bind:check={includeMemories} name="Memories" disabled={!includeChats} />
                <CheckInput bind:check={includeEvolution} name="Evolution" />
                <span class="alert-cardexport-hint">Memories requires chats.</span>
            </div>
        {:else if isCharacterExport}
            <span class="alert-cardexport-hint">Other formats export the base character card only.</span>
        {/if}

        <Button className="alert-cardexport-submit" onclick={() => finish()}>
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

    .alert-cardexport-options {
        margin-top: var(--ds-space-3);
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
    }

    .alert-cardexport-hint {
        margin-top: var(--ds-space-2);
        color: var(--ds-text-secondary);
        font-size: var(--ds-font-size-sm);
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
