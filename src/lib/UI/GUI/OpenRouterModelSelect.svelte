<script lang="ts">
    import { onMount } from "svelte";
    import { openRouterModelsWithState, type OpenRouterModelsState } from "src/ts/model/openrouter";
    import Button from "./Button.svelte";
    import OptionInput from "./OptionInput.svelte";
    import SelectInput from "./SelectInput.svelte";
    import TextInput from "./TextInput.svelte";

    interface Props {
        value?: string;
        label?: string;
        disabled?: boolean;
        includeAutoOptions?: boolean;
        showMeta?: boolean;
    }

    let {
        value = $bindable(""),
        label = "OpenRouter Model",
        disabled = false,
        includeAutoOptions = true,
        showMeta = false,
    }: Props = $props();

    let searchQuery = $state("");
    let loading = $state(false);
    let state = $state<OpenRouterModelsState>({
        models: [],
        status: 0,
        source: "server",
        stale: false,
        updatedAt: null,
        error: "",
    });

    const fallbackModels = [
        ["openai/gpt-3.5-turbo", "GPT 3.5"],
        ["openai/gpt-3.5-turbo-16k", "GPT 3.5 16k"],
        ["openai/gpt-4", "GPT-4"],
        ["openai/gpt-4-32k", "GPT-4 32k"],
        ["anthropic/claude-2", "Claude 2"],
        ["anthropic/claude-instant-v1", "Claude Instant v1"],
        ["anthropic/claude-instant-v1-100k", "Claude Instant v1 100k"],
        ["anthropic/claude-v1", "Claude v1"],
        ["anthropic/claude-v1-100k", "Claude v1 100k"],
        ["anthropic/claude-1.2", "Claude v1.2"],
    ] as const;

    const models = $derived(state.models ?? []);
    const filteredModels = $derived.by(() => {
        if (searchQuery === "") {
            return models;
        }
        const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/);
        return models.filter((model) => {
            const modelText = `${model.name} ${model.id}`.toLowerCase();
            return searchTerms.every((term) => modelText.includes(term));
        });
    });

    function formatUpdatedAt(value: string | null): string {
        if (!value) {
            return "";
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString();
    }

    async function refreshModels(forceRefresh = false) {
        loading = true;
        try {
            state = await openRouterModelsWithState({ forceRefresh });
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        void refreshModels();
    });
</script>

<div class="ds-settings-section">
    <span class="ds-settings-label">{label}</span>
    {#if showMeta}
        <div class="ds-settings-openrouter-status-row">
            {#if loading}
                <span class="ds-settings-label-muted-sm">Loading OpenRouter model list...</span>
            {:else if state.stale}
                <span class="ds-settings-label-muted-sm">
                    Using cached model list{state.updatedAt ? ` (updated ${formatUpdatedAt(state.updatedAt)})` : ""}.
                    {state.error ? ` Last refresh failed: ${state.error}` : ""}
                </span>
            {:else if state.error}
                <span class="ds-settings-note-danger">{state.error}</span>
            {:else if state.updatedAt}
                <span class="ds-settings-label-muted-sm">
                    Model list updated {formatUpdatedAt(state.updatedAt)} ({state.source}).
                </span>
            {/if}
            <Button
                size="sm"
                styled="outlined"
                disabled={loading || disabled}
                onclick={() => {
                    void refreshModels(true);
                }}
            >
                Refresh Models
            </Button>
        </div>
    {/if}
    {#if models.length > 0}
        <TextInput
            bind:value={searchQuery}
            placeholder="Search models..."
            size="sm"
            {disabled}
        />
    {/if}
    <SelectInput bind:value {disabled}>
        {#if models.length === 0}
            {#each fallbackModels as [modelId, modelName] (modelId)}
                <OptionInput value={modelId}>{modelName}</OptionInput>
            {/each}
        {:else}
            {#if includeAutoOptions}
                <OptionInput value="risu/free">Free Auto</OptionInput>
                <OptionInput value="openrouter/auto">Openrouter Auto</OptionInput>
            {/if}
            {#each filteredModels as model (model.id)}
                <OptionInput value={model.id}>{model.name}</OptionInput>
            {/each}
        {/if}
    </SelectInput>
</div>
