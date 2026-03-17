<script lang="ts">
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import {
        createComfyCommanderTemplateDefaults,
        createDefaultComfyCommanderConfig,
        createDefaultComfyCommanderImagePromptConfig,
        createDefaultComfyCommanderReferenceStoreConfig,
        createDefaultComfyCommanderRunpodConfig,
        createEmptyComfyCommanderTemplate,
        createEmptyComfyCommanderWorkflow,
    } from "src/ts/integrations/comfy/config";
    import { DBState } from "src/ts/stores.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";
    import Help from "src/lib/Others/Help.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import ComfyCommanderTemplateEditor from "./ComfyCommanderTemplateEditor.svelte";

    function ensureComfyCommanderState() {
        const defaultConfig = createDefaultComfyCommanderConfig(DBState.db.comfyUiUrl || "http://127.0.0.1:8188");
        DBState.db.comfyCommander ??= {
            version: 1,
            config: defaultConfig,
            workflows: [],
            templates: [],
        };
        DBState.db.comfyCommander.version = 1;
        DBState.db.comfyCommander.config ??= defaultConfig;
        DBState.db.comfyCommander.config.imagePrompt ??= createDefaultComfyCommanderImagePromptConfig();
        DBState.db.comfyCommander.config.runpod ??= createDefaultComfyCommanderRunpodConfig();
        DBState.db.comfyCommander.config.referenceStore ??= createDefaultComfyCommanderReferenceStoreConfig();
        DBState.db.comfyCommander.workflows ??= [];
        DBState.db.comfyCommander.templates ??= [];
        DBState.db.comfyCommander.templates = DBState.db.comfyCommander.templates.map((template) => ({
            ...createComfyCommanderTemplateDefaults(),
            ...template,
        }));
    }

    function addWorkflow() {
        ensureComfyCommanderState();
        DBState.db.comfyCommander.workflows = [
            ...DBState.db.comfyCommander.workflows,
            createEmptyComfyCommanderWorkflow(),
        ];
    }

    function removeWorkflow(workflowId: string) {
        ensureComfyCommanderState();
        DBState.db.comfyCommander.workflows = DBState.db.comfyCommander.workflows.filter(
            (workflow) => workflow.id !== workflowId,
        );
        DBState.db.comfyCommander.templates = DBState.db.comfyCommander.templates.map((template) => {
            if (template.workflowId !== workflowId) {
                return template;
            }
            return {
                ...template,
                workflowId: "",
            };
        });
    }

    function addTemplate() {
        ensureComfyCommanderState();
        DBState.db.comfyCommander.templates = [
            ...DBState.db.comfyCommander.templates,
            createEmptyComfyCommanderTemplate(),
        ];
    }

    function removeTemplate(templateId: string) {
        ensureComfyCommanderState();
        DBState.db.comfyCommander.templates = DBState.db.comfyCommander.templates.filter(
            (template) => template.id !== templateId,
        );
    }

    ensureComfyCommanderState();
</script>

{#snippet commanderContent()}
    <div class="ds-settings-stack-col ds-comfy-commander-settings">
        <Accordion name="Infrastructure" styled={true} initialOpen={false} className="ds-comfy-accordion-panel">
        <div class="ds-comfy-panel">
            <div class="ds-comfy-panel-section">
                <div class="ds-comfy-grid">
                    <label class="ds-comfy-field ds-comfy-field--wide">
                        <span class="ds-settings-label">ComfyUI Base URL</span>
                        <TextInput size="sm" bind:value={DBState.db.comfyCommander.config.baseUrl} />
                    </label>

                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Timeout (seconds)</span>
                        <NumberInput size="sm" min={1} bind:value={DBState.db.comfyCommander.config.timeoutSec} />
                    </label>

                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Poll Interval (ms)</span>
                        <NumberInput size="sm" min={100} bind:value={DBState.db.comfyCommander.config.pollIntervalMs} />
                    </label>

                </div>
            </div>

            <div class="ds-comfy-panel-section">
                <div class="ds-settings-inline-actions action-rail ds-comfy-section-header">
                    <span class="ds-settings-label">Runpod Transport</span>
                </div>

                <div class="ds-comfy-grid">
                    <label class="ds-comfy-field ds-comfy-field--wide">
                        <span class="ds-settings-label">API Key</span>
                        <TextInput size="sm" hideText={!!DBState.db.hideApiKey} bind:value={DBState.db.comfyCommander.config.runpod.apiKey} />
                    </label>

                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Request Mode</span>
                        <SelectInput size="sm" bind:value={DBState.db.comfyCommander.config.runpod.requestMode}>
                            <OptionInput value="runsync">runsync</OptionInput>
                            <OptionInput value="run">run</OptionInput>
                        </SelectInput>
                    </label>
                </div>
            </div>

            <div class="ds-comfy-panel-section">
                <div class="ds-settings-inline-actions action-rail ds-comfy-section-header">
                    <span class="ds-settings-label">Reference Images</span>
                </div>

                <div class="ds-comfy-grid">
                    <label class="ds-comfy-field">
                        <span class="ds-settings-label">Store</span>
                        <SelectInput size="sm" bind:value={DBState.db.comfyCommander.config.referenceStore.provider}>
                            <OptionInput value="none">None</OptionInput>
                            <OptionInput value="yandex-disk">Yandex Disk</OptionInput>
                        </SelectInput>
                    </label>

                    {#if DBState.db.comfyCommander.config.referenceStore.provider === "yandex-disk"}
                        <label class="ds-comfy-field ds-comfy-field--wide">
                            <span class="ds-settings-label">Yandex OAuth Token</span>
                            <TextInput size="sm" hideText={!!DBState.db.hideApiKey} bind:value={DBState.db.comfyCommander.config.referenceStore.yandexDiskToken} />
                        </label>

                        <label class="ds-comfy-field ds-comfy-field--wide">
                            <span class="ds-settings-label">Yandex Temp Folder</span>
                            <TextInput size="sm" bind:value={DBState.db.comfyCommander.config.referenceStore.yandexDiskFolder} />
                        </label>
                    {/if}
                </div>
            </div>
        </div>
        </Accordion>

        <Accordion
            name={DBState.db.comfyCommander.config.activeProvider === "runpod" ? "Scene Presets" : "Templates"}
            styled={true}
            initialOpen={false}
            className="ds-comfy-accordion-panel"
        >
        <div class="ds-comfy-panel">
            <div class="ds-settings-stack-col ds-comfy-stack">
                {#if DBState.db.comfyCommander.templates.length === 0}
                    <div class="ds-settings-empty-state empty-state">No templates yet.</div>
                {/if}
                {#each DBState.db.comfyCommander.templates as template, index (template.id)}
                    <ComfyCommanderTemplateEditor
                        {template}
                        {index}
                        workflows={DBState.db.comfyCommander.workflows}
                        activeProvider={DBState.db.comfyCommander.config.activeProvider}
                        runpodConfig={DBState.db.comfyCommander.config.runpod}
                        onRemove={() => removeTemplate(template.id)}
                    />
                {/each}

                <Button size="sm" styled="outlined" className="action-rail" onclick={addTemplate}>
                    <PlusIcon />
                    Add Template
                </Button>
            </div>
        </div>
        </Accordion>

        {#if DBState.db.comfyCommander.config.activeProvider === "comfyui"}
            <Accordion name="Workflows" styled={true} initialOpen={false} help="comfyWorkflow" className="ds-comfy-accordion-panel">
            <div class="ds-comfy-panel">
                <div class="ds-settings-stack-col ds-comfy-stack">
                    {#if DBState.db.comfyCommander.workflows.length === 0}
                        <div class="ds-settings-empty-state empty-state">No workflows yet.</div>
                    {/if}
                    {#each DBState.db.comfyCommander.workflows as workflow, index (workflow.id)}
                        <Accordion
                            name={`Workflow ${index + 1}${workflow.name?.trim() ? ` · ${workflow.name.trim()}` : ""}`}
                            styled={true}
                            initialOpen={false}
                            className="ds-comfy-accordion-panel"
                        >
                        <div class="ds-comfy-entity">
                            <div class="ds-settings-inline-actions action-rail ds-comfy-entity-header">
                                <span class="ds-settings-label">Workflow JSON</span>
                                <Button
                                    size="sm"
                                    className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
                                    styled="outlined"
                                    onclick={() => removeWorkflow(workflow.id)}
                                >
                                    <TrashIcon />
                                </Button>
                            </div>

                            <span class="ds-settings-label">Name</span>
                            <TextInput size="sm" bind:value={workflow.name} />

                            <span class="ds-settings-label">Workflow JSON</span>
                            <TextAreaInput size="sm" height="24" margin="bottom" bind:value={workflow.workflow} />
                        </div>
                        </Accordion>
                    {/each}

                    <Button size="sm" styled="outlined" className="action-rail" onclick={addWorkflow}>
                        <PlusIcon />
                        Add Workflow
                    </Button>
                </div>
            </div>
            </Accordion>
        {/if}
    </div>
{/snippet}

{@render commanderContent()}

<style>
    .ds-comfy-commander-settings {
        gap: var(--ds-space-3);
    }

    .ds-comfy-panel {
        padding: var(--ds-space-1) 0;
    }

    .ds-comfy-stack {
        gap: var(--ds-space-3);
    }

    .ds-comfy-panel-section + .ds-comfy-panel-section {
        margin-top: var(--ds-space-4);
        padding-top: var(--ds-space-4);
        border-top: 1px solid var(--ds-border-subtle);
    }

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

    .ds-comfy-section-header {
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--ds-space-3);
    }

    :global(.ds-comfy-accordion-panel) {
        background: color-mix(in srgb, var(--ds-surface-2) 88%, transparent);
    }
</style>
