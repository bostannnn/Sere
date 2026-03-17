import { getDatabase, type ComfyCommanderState } from "src/ts/storage/database.svelte";
import type { ComfyCommanderTemplate, ComfyCommanderWorkflow } from "./types";
import { createComfyCommanderEntityId } from "./config";

export function getComfyCommanderState(options: { snapshot?: boolean } = {}): ComfyCommanderState {
    return getDatabase({ snapshot: options.snapshot }).comfyCommander;
}

export function findComfyTemplateById(
    state: ComfyCommanderState,
    templateId: string,
): ComfyCommanderTemplate | null {
    if (!templateId) {
        return null;
    }
    return state.templates.find((template) => template.id === templateId) ?? null;
}

export function findComfyWorkflowById(
    state: ComfyCommanderState,
    workflowId: string,
): ComfyCommanderWorkflow | null {
    if (!workflowId) {
        return null;
    }
    return state.workflows.find((workflow) => workflow.id === workflowId) ?? null;
}

export function listComfyChatMenuTemplates(state: ComfyCommanderState): ComfyCommanderTemplate[] {
    return state.templates.filter((template) => template.showInChatMenu);
}

export { createComfyCommanderEntityId };
