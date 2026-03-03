<script lang="ts">
    import { PlusIcon, TrashIcon } from "@lucide/svelte";
    import { DBState } from "src/ts/stores.svelte";
    import { createComfyCommanderEntityId } from "src/ts/integrations/comfy/store.svelte";
    import Accordion from "src/lib/UI/Accordion.svelte";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import Check from "src/lib/UI/GUI/CheckInput.svelte";
    import NumberInput from "src/lib/UI/GUI/NumberInput.svelte";
    import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
    import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
    import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
    import TextInput from "src/lib/UI/GUI/TextInput.svelte";

    function ensureComfyCommanderState() {
        DBState.db.comfyCommander ??= {
            version: 1,
            config: {
                baseUrl: DBState.db.comfyUiUrl || "http://127.0.0.1:8188",
                debug: false,
                timeoutSec: 120,
                pollIntervalMs: 1000,
            },
            workflows: [],
            templates: [],
            migratedFromPlugin: false,
        };
        DBState.db.comfyCommander.version = 1;
        DBState.db.comfyCommander.config ??= {
            baseUrl: DBState.db.comfyUiUrl || "http://127.0.0.1:8188",
            debug: false,
            timeoutSec: 120,
            pollIntervalMs: 1000,
        };
        DBState.db.comfyCommander.workflows ??= [];
        DBState.db.comfyCommander.templates ??= [];
    }

    function addWorkflow() {
        ensureComfyCommanderState();
        DBState.db.comfyCommander.workflows = [
            ...DBState.db.comfyCommander.workflows,
            {
                id: createComfyCommanderEntityId("wf"),
                name: "Workflow",
                workflow: "",
            },
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
            {
                id: createComfyCommanderEntityId("tpl"),
                trigger: "new",
                prompt: "",
                negativePrompt: "",
                workflowId: "",
                showInChatMenu: false,
                buttonName: "",
            },
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

<Accordion
    styled
    name="Comfy Commander"
    className="ds-settings-section"
>
    <div class="ds-settings-stack-col ds-comfy-commander-settings">
        <span class="ds-settings-label">Base URL</span>
        <TextInput size="sm" bind:value={DBState.db.comfyCommander.config.baseUrl} />

        <div class="ds-settings-renderer-check-row ds-settings-renderer-offset-sm">
            <Check bind:check={DBState.db.comfyCommander.config.debug} name="Debug" />
        </div>

        <span class="ds-settings-label">Timeout (seconds)</span>
        <NumberInput size="sm" min={1} bind:value={DBState.db.comfyCommander.config.timeoutSec} />

        <span class="ds-settings-label">Poll Interval (ms)</span>
        <NumberInput size="sm" min={100} bind:value={DBState.db.comfyCommander.config.pollIntervalMs} />

        <Accordion styled name="Workflows" help="comfyWorkflow" className="ds-settings-section">
            <div class="ds-settings-stack-col">
                {#each DBState.db.comfyCommander.workflows as workflow, index (workflow.id)}
                    <div class="ds-comfy-entity">
                        <div class="ds-settings-inline-actions action-rail ds-comfy-entity-header">
                            <span class="ds-settings-label">Workflow {index + 1}</span>
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
                        <TextAreaInput
                            size="sm"
                            height="24"
                            margin="bottom"
                            bind:value={workflow.workflow}
                        />
                    </div>
                {/each}

                <Button size="sm" styled="outlined" className="action-rail" onclick={addWorkflow}>
                    <PlusIcon />
                    Add Workflow
                </Button>
            </div>
        </Accordion>

        <Accordion styled name="Templates" className="ds-settings-section">
            <div class="ds-settings-stack-col">
                {#each DBState.db.comfyCommander.templates as template, index (template.id)}
                    <div class="ds-comfy-entity">
                        <div class="ds-settings-inline-actions action-rail ds-comfy-entity-header">
                            <span class="ds-settings-label">Template {index + 1}</span>
                            <Button
                                size="sm"
                                className="ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm"
                                styled="outlined"
                                onclick={() => removeTemplate(template.id)}
                            >
                                <TrashIcon />
                            </Button>
                        </div>

                        <span class="ds-settings-label">Trigger</span>
                        <TextInput size="sm" bind:value={template.trigger} />

                        <span class="ds-settings-label">Prompt</span>
                        <TextAreaInput
                            size="sm"
                            height="20"
                            margin="bottom"
                            bind:value={template.prompt}
                        />

                        <span class="ds-settings-label">Negative Prompt</span>
                        <TextAreaInput
                            size="sm"
                            height="20"
                            margin="bottom"
                            bind:value={template.negativePrompt}
                        />

                        <span class="ds-settings-label">Workflow</span>
                        <SelectInput size="sm" bind:value={template.workflowId}>
                            <OptionInput value="">Select workflow</OptionInput>
                            {#each DBState.db.comfyCommander.workflows as workflowOption (workflowOption.id)}
                                <OptionInput value={workflowOption.id}>{workflowOption.name || "Workflow"}</OptionInput>
                            {/each}
                        </SelectInput>

                        <div class="ds-settings-renderer-check-row ds-settings-renderer-offset-sm">
                            <Check bind:check={template.showInChatMenu} name="Show in Chat Menu" />
                        </div>

                        <span class="ds-settings-label">Button Name</span>
                        <TextInput size="sm" bind:value={template.buttonName} />
                    </div>
                {/each}

                <Button size="sm" styled="outlined" className="action-rail" onclick={addTemplate}>
                    <PlusIcon />
                    Add Template
                </Button>
            </div>
        </Accordion>

        {#if DBState.db.comfyCommander.migratedFromPlugin}
            <span class="ds-settings-renderer-warning">
                Migrated from plugin{DBState.db.comfyCommander.migratedAt ? ` (${new Date(DBState.db.comfyCommander.migratedAt).toLocaleString()})` : ""}.
            </span>
        {/if}
    </div>
</Accordion>

<style>
    .ds-comfy-commander-settings {
        gap: var(--ds-space-2);
    }

    .ds-comfy-entity {
        display: flex;
        flex-direction: column;
        gap: var(--ds-space-2);
        padding: var(--ds-space-2);
        margin-bottom: var(--ds-space-2);
    }

    .ds-comfy-entity-header {
        justify-content: space-between;
        align-items: center;
    }
</style>
