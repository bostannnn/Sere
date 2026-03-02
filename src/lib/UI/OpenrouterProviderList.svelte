<script lang="ts">

    import { language } from "src/lang";
    import TextInput from "./GUI/TextInput.svelte";
    import { ArrowLeft } from "@lucide/svelte";
    import Button from "./GUI/Button.svelte";

    interface Props {
        value?: string;
        options?: string[];
        onChange?: (v:string) => void;
        onclick?: (event: MouseEvent & {
            currentTarget: EventTarget & HTMLDialogElement;
        }) => unknown
    }

    let { value = $bindable(""), options = [], onChange = (_v) => {}, onclick }: Props = $props();
    let openOptions = $state(false)
    let dialogEl = $state<HTMLDialogElement | null>(null)

    function changeModel(name:string){
        value = name
        openOptions = false
        onChange(name)
    }

    function close() {
        openOptions = false
    }

    $effect(() => {
        if (!dialogEl) return
        if (openOptions) {
            if (dialogEl.open) return
            try {
                dialogEl.showModal()
            } catch {
                // Safari can throw when dialog APIs are unavailable or state is invalid.
                openOptions = false
            }
        } else if (dialogEl.open) {
            dialogEl.close()
        }
    })

    let custom = $state('')
    const providers = $derived(options)
</script>

<!-- Native <dialog> provides built-in focus trap, Escape-to-close, and correct modal semantics. -->
<dialog
    bind:this={dialogEl}
    class="ds-provider-list-dialog"
    aria-label={language.provider}
    onclose={close}
    onclick={(e) => {
        if (e.target === e.currentTarget) close()
        onclick?.(e as unknown as MouseEvent & { currentTarget: EventTarget & HTMLDialogElement })
    }}
>
    <div class="ds-settings-modal ds-settings-modal--md ds-settings-section">
        <div class="ds-settings-inline-actions action-rail">
            <Button
                size="sm"
                styled="outlined"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-shrink-0"
                onclick={close}
            >
                <ArrowLeft size={20} />
            </Button>
            <h1 class="ds-settings-modal-title ds-settings-grow-min">{language.provider}</h1>
        </div>
        <div class="ds-settings-divider"></div>

        {#each providers as provider (provider)}
            <Button
                size="sm"
                styled="outlined"
                className="ds-settings-provider-option"
                onclick={() => {changeModel(provider)}}
            >
                {provider}
            </Button>
        {/each}

        <TextInput bind:value={custom} onchange={() => {changeModel(custom)}}/>
    </div>
</dialog>

<Button
    size="sm"
    styled="outlined"
    className="ds-settings-provider-trigger"
    onclick={() => {openOptions = true}}
>
    {value}
</Button>

<style>
    .ds-provider-list-dialog {
        background: transparent;
        border: none;
        padding: 0;
        margin: auto;
        max-width: 100%;
        max-height: 100%;
        overflow: visible;
    }

    .ds-provider-list-dialog::backdrop {
        background: rgb(0 0 0 / 0.5);
    }
</style>
