<script lang="ts">


    import { DBState } from 'src/ts/stores.svelte';
    import { getHordeModels } from "src/ts/horde/getModels";
    import Accordion from "./Accordion.svelte";
    import { language } from "src/lang";
    import CheckInput from "./GUI/CheckInput.svelte";
    import { getModelInfo, getModelList } from 'src/ts/model/modellist';
    import { ArrowLeft } from "@lucide/svelte";

    interface Props {
        value?: string;
        onChange?: (v:string) => void;
        onclick?: (event: MouseEvent & {
            currentTarget: EventTarget & HTMLDialogElement;
        }) => unknown
        blankable?: boolean
    }

    let { value = $bindable(), onChange = (_v) => {}, onclick, blankable }: Props = $props();
    let openOptions = $state(false)
    let dialogEl = $state<HTMLDialogElement | null>(null)
    const selectedValue = $derived(typeof value === 'string' ? value : '')

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
            if (!dialogEl.open) {
                dialogEl.showModal()
            }
        } else {
            if (dialogEl.open) {
                dialogEl.close()
            }
        }
    })

    let showUnrec = $state(false)
    const providers = $derived(getModelList({
        recommendedOnly: !showUnrec,
        groupedByProvider: true
    }))
</script>

<!-- Native <dialog> provides built-in focus trap, Escape key handling, and
     correct modal semantics. The ::backdrop pseudo-element handles the scrim. -->
<dialog
    bind:this={dialogEl}
    class="ds-model-list-dialog"
    aria-label={language.model}
    onclose={close}
    onclick={(e) => {
        /* Close when clicking the backdrop (the <dialog> element itself, not its content) */
        if (e.target === e.currentTarget) close()
        onclick?.(e as unknown as MouseEvent & { currentTarget: EventTarget & HTMLDialogElement })
    }}
>
    <div class="ds-model-list-panel panel-shell">
        <div class="ds-model-list-header">
            <button
                type="button"
                class="ds-model-list-back icon-btn icon-btn--sm"
                onclick={close}
                title="Back"
                aria-label="Back"
            >
                <ArrowLeft size={20} />
            </button>
            <h1 class="ds-model-list-title">{language.model}</h1>
        </div>
        <div class="ds-model-list-divider"></div>

        {#each providers as provider, providerIndex (`${provider.providerName}:${providerIndex}`)}
            {#if provider.providerName === '@as-is'}
                {#each provider.models as model (model.id)}
                    <button type="button" class="ds-model-list-item" title={model.name} aria-label={model.name} onclick={() => {changeModel(model.id)}}>{model.name}</button>
                {/each}
            {:else}
                <Accordion name={provider.providerName}>
                    {#each provider.models as model (model.id)}
                        <button type="button" class="ds-model-list-item" title={model.name} aria-label={model.name} onclick={() => {changeModel(model.id)}}>{model.name}</button>
                    {/each}
                </Accordion>
            {/if}
        {/each}
        <Accordion name="Horde">
            {#await getHordeModels()}
                <button type="button" class="ds-model-list-item ds-model-list-item-compact" disabled>Loading...</button>
            {:then models}
                <button type="button" onclick={() => {changeModel("horde:::" + 'auto')}} class="ds-model-list-item ds-model-list-item-compact" title="Auto Model" aria-label="Auto Model">
                    Auto Model
                    <br><span class="ds-model-list-item-meta">Performace: Auto</span>
                </button>
                {#each models as model (model.name)}
                    <button type="button" onclick={() => {changeModel("horde:::" + model.name)}} class="ds-model-list-item ds-model-list-item-compact" title={model.name.trim()} aria-label={model.name.trim()}>
                        {model.name.trim()}
                        <br><span class="ds-model-list-item-meta">Performace: {model.performance.toFixed(1)}</span>
                    </button>
                {/each}
            {/await}
        </Accordion>

        {#if DBState?.db.customModels?.length > 0}
            <Accordion name={language.customModels}>
                {#each DBState.db.customModels as model, modelIndex ((model.id ?? model.name ?? '') + ':' + modelIndex)}
                    <button type="button" class="ds-model-list-item" title={model.name ?? "Unnamed"} aria-label={model.name ?? "Unnamed"} onclick={() => {changeModel(model.id)}}>{model.name ?? "Unnamed"}</button>
                {/each}
            </Accordion>
        {/if}

        {#if blankable}
            <button type="button" class="ds-model-list-item" title={language.none} aria-label={language.none} onclick={() => {changeModel('')}}>{language.none}</button>
        {/if}
        <div class="ds-model-list-footer">
            <CheckInput name={language.showUnrecommended} grayText bind:check={showUnrec}/>
        </div>
    </div>
</dialog>

<button type="button" onclick={() => {openOptions = true}}
    class="ds-model-list-trigger">
        {getModelInfo(selectedValue)?.fullName || language.none}
</button>

<style>
    /* <dialog> resets — the global @layer base sets margin: auto, which is what we want.
       Override display so the dialog matches the old overlay layout. */
    .ds-model-list-dialog {
        /* Transparent dialog element itself; the panel-shell inside provides the card */
        background: transparent;
        border: none;
        padding: 0;
        margin: auto;
        max-width: 100%;
        max-height: 100%;
        overflow: visible;
    }

    /* Scrim — replaces the old .ds-model-list-overlay div */
    .ds-model-list-dialog::backdrop {
        background: rgb(0 0 0 / 0.5);
    }
</style>
