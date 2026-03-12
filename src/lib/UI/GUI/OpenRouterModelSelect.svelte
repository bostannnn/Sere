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

    interface ModelOption {
        id: string;
        name: string;
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
    let modelState: OpenRouterModelsState = $state({
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
    const autoOptions = [
        { id: "risu/free", name: "Free Auto" },
        { id: "openrouter/auto", name: "Openrouter Auto" },
    ] as const;

    const models = $derived(modelState.models ?? []);
    const fallbackOptions = $derived(fallbackModels.map(([id, name]) => ({ id, name } satisfies ModelOption)));
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
    const displayedOptions = $derived.by(() => {
        const next: ModelOption[] = [];
        const seenIds: string[] = [];

        const pushOption = (option: ModelOption | null | undefined) => {
            if (!option || !option.id || seenIds.includes(option.id)) {
                return;
            }
            seenIds.push(option.id);
            next.push(option);
        };

        if (includeAutoOptions) {
            for (const option of autoOptions) {
                pushOption(option);
            }
        }

        const baseOptions = models.length === 0
            ? fallbackOptions
            : filteredModels.map((model) => ({
                id: model.id,
                name: model.name,
            }));
        for (const option of baseOptions) {
            pushOption(option);
        }

        if (value && !seenIds.includes(value)) {
            const knownModel = models.find((model) => model.id === value);
            const fallbackOption = fallbackOptions.find((option) => option.id === value);
            const autoOption = autoOptions.find((option) => option.id === value);
            pushOption({
                id: value,
                name: knownModel?.name ?? fallbackOption?.name ?? autoOption?.name ?? value,
            });
        }

        return next;
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
            modelState = await openRouterModelsWithState({ forceRefresh });
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
            {:else if modelState.stale}
                <span class="ds-settings-label-muted-sm">
                    Using cached model list{modelState.updatedAt ? ` (updated ${formatUpdatedAt(modelState.updatedAt)})` : ""}.
                    {modelState.error ? ` Last refresh failed: ${modelState.error}` : ""}
                </span>
            {:else if modelState.error}
                <span class="ds-settings-note-danger">{modelState.error}</span>
            {:else if modelState.updatedAt}
                <span class="ds-settings-label-muted-sm">
                    Model list updated {formatUpdatedAt(modelState.updatedAt)} ({modelState.source}).
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
        {#each displayedOptions as option (option.id)}
            <OptionInput value={option.id}>{option.name}</OptionInput>
        {/each}
    </SelectInput>
</div>
