<script lang="ts">
    import { TrashIcon } from "@lucide/svelte";
    import { RUNPOD_MODELS } from "src/ts/integrations/comfy/runpodModels";
    import {
        COMFY_COMMANDER_RUNPOD_SCHEMA_PRESET_OPTIONS,
        formatComfyCommanderImagePromptModel,
        parseComfyCommanderImagePromptModel,
        resolveTemplateRunpodModel,
        templateUsesProvider,
    } from "src/ts/integrations/comfy/config";
    import type {
        ComfyCommanderRunpodConfig,
        ComfyCommanderTemplate,
        ComfyCommanderWorkflow,
    } from "src/ts/storage/database.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import OpenRouterModelSelect from "src/lib/UI/GUI/OpenRouterModelSelect.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";

    interface Props {
        template: ComfyCommanderTemplate;
        index: number;
        workflows: ComfyCommanderWorkflow[];
        activeProvider: "comfyui" | "runpod";
        runpodConfig: ComfyCommanderRunpodConfig;
        onRemove: () => void;
    }

    let {
        template,
        index,
        workflows,
        activeProvider,
        runpodConfig,
        onRemove,
    }: Props = $props();

    const usesComfy = $derived(templateUsesProvider(template, activeProvider, "comfyui"));
    const usesRunpod = $derived(templateUsesProvider(template, activeProvider, "runpod"));
    const runpodModel = $derived(resolveTemplateRunpodModel(template, runpodConfig));
    const openrouterPromptModel = $derived.by(() => {
        const parsed = parseComfyCommanderImagePromptModel(template.imagePromptModel);
        return parsed.mode === "openrouter"
            ? parsed.model
            : parsed.mode === "current"
                ? ""
                : (template.imagePromptModel || "");
    });

    function handlePromptModelChange(value: string) {
        const trimmed = value.trim();
        template.imagePromptModel = trimmed
            ? formatComfyCommanderImagePromptModel("openrouter", trimmed)
            : "";
    }
</script>

<Accordion
    name={`Template ${index + 1}${template.buttonName?.trim() ? ` · ${template.buttonName.trim()}` : ""}`}
    styled={true}
    initialOpen={false}
    className="ds-comfy-accordion-panel"
>
    <div class="ds-comfy-entity">
        <div class="ds-settings-inline-actions action-rail ds-comfy-entity-header">
            <div class="ds-comfy-entity-meta">
                <span class="ds-settings-label">Trigger: {template.trigger || "new"}</span>
            </div>
            <Button
                size="sm"
                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
                styled="outlined"
                onclick={onRemove}
            >
                <TrashIcon />
            </Button>
        </div>

        <div class="ds-comfy-grid">
            <label class="ds-comfy-field">
                <span class="ds-settings-label">Trigger</span>
                <TextInput size="sm" bind:value={template.trigger} />
            </label>

            <label class="ds-comfy-field">
                <span class="ds-settings-label">Button Name</span>
                <TextInput size="sm" bind:value={template.buttonName} />
            </label>

            <label class="ds-comfy-field">
                <span class="ds-settings-label">Provider</span>
                <SelectInput size="sm" bind:value={template.providerOverride}>
                    <OptionInput value="none">Use runtime dropdown</OptionInput>
                    <OptionInput value="comfyui">Force ComfyUI</OptionInput>
                    <OptionInput value="runpod">Force Runpod</OptionInput>
                </SelectInput>
            </label>

            <label class="ds-comfy-field">
                <span class="ds-settings-label">Default Mode</span>
                <SelectInput size="sm" bind:value={template.modeDefault}>
                    <OptionInput value="text-to-image">Text to Image</OptionInput>
                    <OptionInput value="image-edit">Image Edit</OptionInput>
                </SelectInput>
            </label>

            <div class="ds-comfy-field ds-comfy-field--wide">
                <OpenRouterModelSelect
                    value={openrouterPromptModel}
                    label="Prompt Model"
                    blankLabel="Use current chat model"
                    showMeta={true}
                    onchange={handlePromptModelChange}
                />
            </div>

            <label class="ds-comfy-field">
                <span class="ds-settings-label">Context Message Count</span>
                <NumberInput size="sm" min={1} bind:value={template.imagePromptContextMessageCount} />
            </label>

            <label class="ds-comfy-field">
                <span class="ds-settings-label">Max Context Chars</span>
                <NumberInput size="sm" min={200} bind:value={template.imagePromptMaxContextChars} />
            </label>

            {#if usesComfy}
                <label class="ds-comfy-field ds-comfy-field--wide">
                    <span class="ds-settings-label">ComfyUI Workflow</span>
                    <SelectInput size="sm" bind:value={template.workflowId}>
                        <OptionInput value="">Select workflow</OptionInput>
                        {#each workflows as workflowOption (workflowOption.id)}
                            <OptionInput value={workflowOption.id}>{workflowOption.name || "Workflow"}</OptionInput>
                        {/each}
                    </SelectInput>
                </label>
            {/if}

            {#if usesRunpod}
                <label class="ds-comfy-field">
                    <span class="ds-settings-label">Runpod Model</span>
                    <SelectInput size="sm" bind:value={template.runpodModelId}>
                        <OptionInput value="">Use Runpod default</OptionInput>
                        {#each RUNPOD_MODELS as model (model.id)}
                            <OptionInput value={model.id}>{model.label}</OptionInput>
                        {/each}
                        <OptionInput value="__custom__">Custom Endpoint</OptionInput>
                    </SelectInput>
                </label>

                {#if template.runpodModelId === "__custom__"}
                    <label class="ds-comfy-field ds-comfy-field--wide">
                        <span class="ds-settings-label">Runpod Endpoint Override</span>
                        <TextInput size="sm" bind:value={template.runpodEndpointId} />
                    </label>

                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Runpod Schema Preset</span>
                        <SelectInput size="sm" bind:value={template.runpodSchemaPreset}>
                            {#each COMFY_COMMANDER_RUNPOD_SCHEMA_PRESET_OPTIONS as schema (schema.value)}
                                <OptionInput value={schema.value}>{schema.label}</OptionInput>
                            {/each}
                        </SelectInput>
                    </label>
                {/if}

                <label class="ds-comfy-field">
                    <span class="ds-settings-label">Output Format</span>
                    <SelectInput size="sm" bind:value={template.runpodOutputFormat}>
                        <OptionInput value="png">png</OptionInput>
                        <OptionInput value="jpeg">jpeg</OptionInput>
                        <OptionInput value="webp">webp</OptionInput>
                    </SelectInput>
                </label>

                {#if runpodModel.usesSizeString}
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Size</span>
                        <TextInput size="sm" bind:value={template.runpodSize} />
                    </label>
                {:else}
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Width</span>
                        <NumberInput size="sm" min={64} bind:value={template.runpodWidth} />
                    </label>

                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Height</span>
                        <NumberInput size="sm" min={64} bind:value={template.runpodHeight} />
                    </label>
                {/if}

                {#if runpodModel.supportsSteps}
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Inference Steps</span>
                        <NumberInput size="sm" min={1} bind:value={template.runpodNumInferenceSteps} />
                    </label>
                {/if}

                {#if runpodModel.supportsGuidance}
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Guidance</span>
                        <NumberInput size="sm" min={0} bind:value={template.runpodGuidance} />
                    </label>
                {/if}

                {#if runpodModel.supportsStrength}
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Strength</span>
                        <NumberInput size="sm" min={0} bind:value={template.runpodStrength} />
                    </label>
                {/if}

                {#if runpodModel.supportsSafetyChecker}
                    <div class="ds-comfy-field ds-comfy-field--wide ds-settings-renderer-check-row ds-settings-renderer-offset-sm">
                        <Check bind:check={template.runpodEnableSafetyChecker} name="Enable Safety Checker" />
                    </div>
                {/if}
            {/if}

            <div class="ds-comfy-field ds-comfy-field--wide ds-settings-renderer-check-row ds-settings-renderer-offset-sm">
                <Check bind:check={template.showInChatMenu} name="Show in Chat Menu" />
            </div>

            {#if usesRunpod && runpodModel.referenceField === "none"}
                <div class="ds-comfy-field ds-comfy-field--wide ds-comfy-note">
                    Selected Runpod model does not accept reference images.
                </div>
            {:else}
                <div class="ds-comfy-field ds-comfy-field--wide ds-settings-renderer-check-row ds-settings-renderer-offset-sm">
                    <Check bind:check={template.useReferenceImage} name="Use Character Portrait" />
                </div>

                {#if template.useReferenceImage}
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Reference Source</span>
                        <SelectInput size="sm" bind:value={template.referenceSource}>
                            <OptionInput value="none">None</OptionInput>
                            <OptionInput value="character-portrait">Character Portrait</OptionInput>
                        </SelectInput>
                    </label>

                    <div class="ds-comfy-field ds-comfy-field--wide ds-settings-renderer-check-row ds-settings-renderer-offset-sm">
                        <Check bind:check={template.allowReferenceFallbackToText} name="Allow Fallback to Text-to-Image" />
                    </div>
                {/if}
            {/if}

            <label class="ds-comfy-field ds-comfy-field--wide">
                <span class="ds-settings-label">Prompt Template</span>
                <TextAreaInput size="sm" height="24" margin="bottom" bind:value={template.prompt} />
            </label>

            {#if usesComfy || (usesRunpod && runpodModel.supportsNegativePrompt)}
                <label class="ds-comfy-field ds-comfy-field--wide">
                    <span class="ds-settings-label">Negative Prompt</span>
                    <TextAreaInput size="sm" height="20" margin="bottom" bind:value={template.negativePrompt} />
                </label>
            {/if}
        </div>
    </div>
</Accordion>

<style>
    .ds-comfy-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        gap: var(--ds-space-3);
        align-items: start;
    }

    .ds-comfy-field {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        min-width: 0;
    }

    .ds-comfy-field--wide {
        grid-column: 1 / -1;
    }

    .ds-comfy-note {
        color: var(--ds-text-muted);
        font-size: 0.92rem;
    }

    .ds-comfy-entity {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-3);
        padding: var(--ds-space-3);
        margin-bottom: var(--ds-space-2);
        border: 1px solid var(--ds-border-subtle);
        border-radius: var(--ds-radius-md);
        background: color-mix(in srgb, var(--ds-surface-2) 88%, transparent);
    }

    .ds-comfy-entity-header {
        justify-content: space-between;
        align-items: center;
    }

    .ds-comfy-entity-meta {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-1);
        min-width: 0;
    }

    :global(.ds-comfy-field .ds-settings-section) {
        margin: 0;
        min-width: 0;
    }
</style>
