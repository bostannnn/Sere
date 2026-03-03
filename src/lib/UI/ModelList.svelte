<script lang="ts">


    import { DBState } from 'src/ts/stores.svelte';
    import { getHordeModels } from "src/ts/horde/getModels";
    import Accordion from "./Accordion.svelte";
    import Portal from "./GUI/Portal.svelte";
    import { language } from "src/lang";
    import CheckInput from "./GUI/CheckInput.svelte";
    import { getModelInfo, getModelList } from 'src/ts/model/modellist';
    import { ArrowLeft } from "@lucide/svelte";

    interface Props {
        value?: string;
        onChange?: (v:string) => void;
        onclick?: (event: MouseEvent) => unknown
        blankable?: boolean
    }

    let { value = $bindable(), onChange = (_v) => {}, onclick, blankable }: Props = $props();
    let openOptions = $state(false)
    const selectedValue = $derived(typeof value === 'string' ? value : '')

    function changeModel(name:string){
        value = name
        openOptions = false
        onChange(name)
    }

    function close() {
        openOptions = false
    }

    let showUnrec = $state(false)
    const providers = $derived(getModelList({
        recommendedOnly: !showUnrec,
        groupedByProvider: true
    }))
</script>

{#snippet modelListPanel()}
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
{/snippet}

{#if openOptions}
    <Portal>
        <div class="ds-model-list-overlay" role="button" tabindex="0" aria-label="Close model list" onclick={close} onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                close()
            }
        }}>
            <div role="dialog" aria-modal="true" aria-label={language.model} tabindex="-1" onclick={(e) => {
                e.stopPropagation()
                onclick?.(e as unknown as MouseEvent)
            }} onkeydown={(e) => e.stopPropagation()}>
                {@render modelListPanel()}
            </div>
        </div>
    </Portal>
{/if}

<button type="button" onclick={() => {openOptions = true}}
    class="ds-model-list-trigger">
        {getModelInfo(selectedValue)?.fullName || language.none}
</button>
