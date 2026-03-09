<script lang="ts">
    import { ChevronRightIcon, XIcon } from "@lucide/svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import { ParseMarkdown } from "src/ts/parser.svelte";
    import { DBState, alertStore } from "src/ts/stores.svelte";
    import { ColorSchemeTypeStore } from "src/ts/gui/colorscheme";
    import { openURL } from "src/ts/globalApi.svelte";
    import { translateStackTrace } from "src/ts/sourcemap";
    import { language } from "src/lang";
    import type { AlertState } from "./types";

    interface Props {
        alert: AlertState;
    }

    const { alert }: Props = $props();

    let showDetails = $state(false);
    let translatedStackTrace = $state("");
    let isTranslated = $state(false);
    let isTranslating = $state(false);

    $effect(() => {
        if (alert.type !== "error" || !showDetails) {
            return;
        }

        const shouldAutoTranslate = DBState.db.sourcemapTranslate;
        isTranslated = shouldAutoTranslate;
        if (shouldAutoTranslate && !translatedStackTrace && !isTranslating) {
            void loadTranslatedTrace();
        }
    });

    async function loadTranslatedTrace() {
        if (isTranslating || translatedStackTrace || !alert.stackTrace) {
            return;
        }
        isTranslating = true;
        try {
            translatedStackTrace = await translateStackTrace(alert.stackTrace);
        } catch {
            isTranslated = false;
        } finally {
            isTranslating = false;
        }
    }

    async function toggleDetails() {
        showDetails = !showDetails;
        if (!showDetails || alert.type !== "error") {
            return;
        }

        const shouldAutoTranslate = DBState.db.sourcemapTranslate;
        isTranslated = shouldAutoTranslate;
        if (shouldAutoTranslate && !translatedStackTrace) {
            await loadTranslatedTrace();
        }
    }

    async function handleToggleTranslate() {
        if (!isTranslated && !translatedStackTrace) {
            await loadTranslatedTrace();
        }
        isTranslated = !isTranslated;
    }

    function clearAlert(msg = "") {
        alertStore.set({
            type: "none",
            msg,
        });
    }

    function getHeading() {
        if (alert.type === "error") return "Error";
        if (alert.type === "ask") return "Confirm";
        if (alert.type === "input") return "Input";
        if (alert.type === "pukmakkurit") return language.preview;
        return "";
    }

    function getOptions() {
        if (!alert.msg.startsWith("__DISPLAY__")) {
            return {
                display: "",
                options: alert.msg.split("||"),
            };
        }

        const parts = alert.msg.substring(11).split("||");
        return {
            display: parts[0] ?? "",
            options: parts.slice(1),
        };
    }
</script>

<div
    class="alert-overlay"
    class:alert-overlay-passive={alert.type === "wait"}
    class:vis={alert.type === "wait2"}
>
    <div class="alert-modal-base break-any">
        {#if getHeading()}
            <h2 class="alert-heading" class:alert-heading-error={alert.type === "error"}>{getHeading()}</h2>
        {/if}

        {#if alert.type === "markdown"}
            <div class="alert-scroll-y">
                <span class="alert-markdown chattext prose chattext2" class:prose-invert={$ColorSchemeTypeStore}>
                    {#await ParseMarkdown(alert.msg) then msg}
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html msg}
                    {/await}
                </span>
            </div>
        {:else if alert.type === "tos"}
            <div class="alert-text-primary">
                You should accept
                <a
                    href="https://sv.risuai.xyz/hub/tos"
                    class="alert-tos-link"
                    onclick={(event) => {
                        event.preventDefault();
                        openURL("https://sv.risuai.xyz/hub/tos");
                    }}
                >Terms of Service</a>
                to continue
            </div>
        {:else if alert.type !== "select" && alert.type !== "ask" && alert.type !== "pukmakkurit"}
            <span class="alert-body-message alert-prewrap">{alert.msg}</span>
            {#if alert.submsg && alert.type !== "progress"}
                <span class="alert-body-submessage alert-text-sm">{alert.submsg}</span>
            {/if}

            {#if alert.type === "error" && alert.stackTrace}
                <div class="alert-section-gap-top">
                    <Button styled="outlined" size="sm" onclick={toggleDetails}>
                        {showDetails ? language.hideErrorDetails : language.showErrorDetails}
                        {#if showDetails}
                            <XIcon class="alert-inline-icon" />
                        {:else}
                            <ChevronRightIcon class="alert-inline-icon" />
                        {/if}
                    </Button>
                    {#if showDetails}
                        <Button
                            styled="outlined"
                            size="sm"
                            onclick={handleToggleTranslate}
                            disabled={isTranslating}
                            className="alert-inline-button-gap"
                        >
                            {#if isTranslating}
                                {language.translating}
                            {:else if isTranslated}
                                {language.showOriginal}
                            {:else}
                                {language.translateCode}
                            {/if}
                        </Button>
                        <pre class="stack-trace">{isTranslated ? translatedStackTrace : alert.stackTrace}</pre>
                    {/if}
                </div>
            {/if}
        {/if}

        {#if alert.type === "progress"}
            <div class="alert-progress-track">
                <div class="alert-progress-indicator alert-progress-fill saving-animation" style:width={alert.submsg + "%"}></div>
            </div>
            <div class="alert-progress-row">
                <span class="alert-progress-value alert-text-sm">{alert.submsg + "%"}</span>
            </div>
        {/if}

        {#if alert.type === "ask"}
            <div class="alert-action-row">
                <Button className="alert-action-button" onclick={() => clearAlert("yes")}>YES</Button>
                <Button className="alert-action-button" onclick={() => clearAlert("no")}>NO</Button>
            </div>
        {:else if alert.type === "tos"}
            <div class="alert-action-row">
                <Button className="alert-action-button" onclick={() => clearAlert("yes")}>Accept</Button>
                <Button styled="outlined" className="alert-action-button" onclick={() => clearAlert("no")}>Do not Accept</Button>
            </div>
        {:else if alert.type === "select"}
            {@const selection = getOptions()}
            {#if selection.display}
                <div class="alert-display-message">{selection.display}</div>
            {/if}
            {#each selection.options as option, index (index)}
                <Button className="alert-option-button" onclick={() => clearAlert(index.toString())}>{option}</Button>
            {/each}
        {:else if alert.type === "error" || alert.type === "normal" || alert.type === "markdown"}
            <Button className="alert-option-button" onclick={() => clearAlert()}>OK</Button>
        {:else if alert.type === "input"}
            <TextInput value={alert.defaultValue} id="alert-input" autocomplete="off" marginTop list="alert-input-list" />
            <Button
                className="alert-option-button"
                onclick={() => {
                    alertStore.set({
                        type: "none",
                        // @ts-expect-error value is read from the input element created above.
                        msg: document.querySelector("#alert-input")?.value,
                    });
                }}
            >OK</Button>
            {#if alert.datalist}
                <datalist id="alert-input-list">
                    {#each alert.datalist as item (item[0])}
                        <option value={item[0]} label={item[1] ? item[1] : item[0]}>
                            {item[1] ? item[1] : item[0]}
                        </option>
                    {/each}
                </datalist>
            {/if}
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

    .alert-overlay-passive {
        pointer-events: none;
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

    .alert-scroll-y {
        overflow-y: auto;
    }

    .alert-text-primary,
    .alert-markdown,
    .alert-body-message {
        color: var(--ds-text-primary);
    }

    .alert-prewrap,
    .stack-trace {
        white-space: pre-wrap;
    }

    .alert-text-sm {
        font-size: var(--ds-font-size-sm);
    }

    .alert-tos-link {
        color: var(--risu-theme-success-500);
        cursor: pointer;
        transition: color var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-tos-link:hover {
        color: color-mix(in srgb, var(--risu-theme-success-500) 82%, var(--ds-text-primary) 18%);
    }

    .alert-section-gap-top {
        margin-top: var(--ds-space-4);
    }

    :global(.alert-inline-icon) {
        display: inline;
        margin-left: var(--ds-space-2);
    }

    :global(.alert-inline-button-gap) {
        margin-left: var(--ds-space-2);
    }

    .alert-progress-track {
        width: 100%;
        min-width: 16rem;
        max-width: 34.5rem;
        height: 0.5rem;
        margin-top: var(--ds-space-6);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: var(--ds-surface-1);
    }

    .alert-progress-indicator {
        height: 100%;
        transition: width var(--ds-motion-fast) var(--ds-ease-standard);
    }

    .alert-progress-fill {
        background: linear-gradient(
            to right,
            var(--risu-theme-primary-500),
            color-mix(in srgb, var(--risu-theme-primary-500) 55%, var(--ds-border-strong) 45%)
        );
    }

    .alert-progress-row {
        width: 100%;
        margin-top: var(--ds-space-6);
        display: flex;
        justify-content: center;
    }

    .alert-progress-value,
    .alert-body-submessage {
        color: var(--ds-text-secondary);
    }

    .alert-action-row {
        width: 100%;
        display: flex;
        gap: var(--ds-space-2);
    }

    :global(.alert-action-button) {
        margin-top: var(--ds-space-4);
        flex: 1 1 0;
    }

    .alert-display-message {
        margin-bottom: var(--ds-space-4);
        color: var(--ds-text-primary);
    }

    :global(.alert-option-button) {
        margin-top: var(--ds-space-4);
    }

    .alert-heading {
        margin: 0 0 0.5rem;
        width: 10rem;
        max-width: 100%;
        color: var(--risu-theme-success-500);
    }

    .alert-heading-error {
        color: var(--ds-text-danger, var(--risu-theme-danger-500));
    }

    .break-any {
        word-break: normal;
        overflow-wrap: anywhere;
    }

    .vis {
        opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
    }

    .stack-trace {
        background-color: var(--risu-theme-bgcolor);
        color: var(--risu-theme-textcolor2);
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.25rem;
        padding: 0.5rem;
        margin-top: 0.5rem;
        font-family: monospace;
        font-size: 0.75rem;
        word-break: break-all;
        max-height: 200px;
        overflow-y: auto;
    }
</style>
