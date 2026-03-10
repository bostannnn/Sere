<script lang="ts">

    import Accordion from "./Accordion.svelte";
    import Portal from "./GUI/Portal.svelte";
    import { language } from "src/lang";
    import { getModelInfo, getModelList } from 'src/ts/model/modellist';
    import { LLMFormat, LLMProvider, ProviderNames } from "src/ts/model/types";
    import { ArrowLeft } from "@lucide/svelte";

    interface Props {
        value?: string;
        onChange?: (v:string) => void;
        onclick?: (event: MouseEvent) => unknown
        blankable?: boolean
        mode?: 'model' | 'provider'
        disabled?: boolean
    }

    interface ProviderOption {
        id: string;
        label: string;
    }

    let { value = $bindable(), onChange = (_v) => {}, onclick, blankable, mode = 'model', disabled = false }: Props = $props();
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

    const providers = $derived(getModelList({
        groupedByProvider: true
    }))

    function getProviderId(modelId: string) {
        const model = getModelInfo(modelId)
        if (model.id === 'openrouter') return 'openrouter'
        if (model.format === LLMFormat.Kobold) return 'kobold'
        if (model.format === LLMFormat.Ollama) return 'ollama'
        if (model.format === LLMFormat.NovelAI) return 'novelai'
        if (model.provider === LLMProvider.OpenAI) return 'openai'
        if (model.provider === LLMProvider.DeepSeek) return 'deepseek'
        if (model.provider === LLMProvider.Anthropic) return 'anthropic'
        if (model.provider === LLMProvider.GoogleCloud) return 'google'
        return ''
    }

    function getProviderLabel(providerId: string) {
        if (providerId === 'openrouter') return 'OpenRouter'
        if (providerId === 'kobold') return 'Kobold'
        if (providerId === 'ollama') return 'Ollama'
        if (providerId === 'novelai') return 'NovelAI'
        if (providerId === 'openai') return ProviderNames.get(LLMProvider.OpenAI) || 'OpenAI'
        if (providerId === 'deepseek') return ProviderNames.get(LLMProvider.DeepSeek) || 'DeepSeek'
        if (providerId === 'anthropic') return ProviderNames.get(LLMProvider.Anthropic) || 'Anthropic'
        if (providerId === 'google') return ProviderNames.get(LLMProvider.GoogleCloud) || 'Google Cloud'
        return providerId
    }

    const providerOptions = $derived.by(() => {
        const next: ProviderOption[] = []
        const seen = new Set<string>()
        const flatModels = getModelList({
            groupedByProvider: false
        })
        for (const model of flatModels) {
            const providerId = getProviderId(model.id)
            if (!providerId || seen.has(providerId)) continue
            seen.add(providerId)
            next.push({
                id: providerId,
                label: getProviderLabel(providerId),
            })
        }
        return next
    })

    const triggerLabel = $derived(
        mode === 'provider'
            ? (getProviderLabel(selectedValue) || language.none)
            : (getModelInfo(selectedValue)?.fullName || language.none)
    )
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

        {#if mode === 'provider'}
            {#each providerOptions as provider (provider.id)}
                <button
                    type="button"
                    class="ds-model-list-item"
                    title={provider.label}
                    aria-label={provider.label}
                    onclick={() => {changeModel(provider.id)}}
                >{provider.label}</button>
            {/each}
        {:else}
            {#each providers as provider, providerIndex (`${provider.providerName}:${providerIndex}`)}
                {#if provider.providerName === '@as-is'}
                    {#each provider.models as model (model.id)}
                        <button type="button" class="ds-model-list-item" title={model.name} aria-label={model.name} onclick={() => {changeModel(model.id)}}>{model.name}</button>
                    {/each}
                {:else}
                    <Accordion name={provider.providerName}>
                        {#each provider.models as model (model.id)}
                            <button type="button" class="ds-model-list-item ds-model-list-item--child" title={model.name} aria-label={model.name} onclick={() => {changeModel(model.id)}}>{model.name}</button>
                        {/each}
                    </Accordion>
                {/if}
            {/each}
        {/if}
        {#if blankable}
            <button type="button" class="ds-model-list-item" title={language.none} aria-label={language.none} onclick={() => {changeModel('')}}>{language.none}</button>
        {/if}
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
            <div class="ds-model-list-dialog" role="dialog" aria-modal="true" aria-label={language.model} tabindex="-1" onclick={(e) => {
                e.stopPropagation()
                onclick?.(e as unknown as MouseEvent)
            }} onkeydown={(e) => e.stopPropagation()}>
                {@render modelListPanel()}
            </div>
        </div>
    </Portal>
{/if}

<button type="button" onclick={() => {openOptions = true}}
    {disabled}
    class="ds-model-list-trigger">
        {triggerLabel}
</button>
