import type {
    ComfyCommanderConfig,
    ComfyCommanderTemplate,
    ComfyCommanderWorkflow,
} from "src/ts/storage/database.svelte";

export type {
    ComfyCommanderConfig,
    ComfyCommanderTemplate,
    ComfyCommanderWorkflow,
};

export interface ComfyTemplateMatch {
    template: ComfyCommanderTemplate;
    userPrompt: string;
}

export interface ComfyPromptVariables {
    prompt: string;
    char: string;
    user: string;
    lastMessage: string;
    lastCharMessage: string;
}

export interface ComfyWorkflowMacroArgs {
    positivePrompt: string;
    negativePrompt: string;
    seed: number;
    charAvatarBase64: string;
}

export interface ComfyImageDescriptor {
    filename: string;
    subfolder: string;
    type: string;
}

export interface ComfyProgressState {
    active: boolean;
    label: string;
    color: string;
}

export const comfyProgressDefault: ComfyProgressState = {
    active: false,
    label: "",
    color: "var(--risu-theme-selected)",
};

export const COMFY_PROGRESS_COLOR = "var(--risu-theme-selected)";

export function normalizeComfyBaseUrl(baseUrl: string): string {
    const trimmed = (baseUrl || "").trim();
    if (!trimmed) {
        return "http://127.0.0.1:8188";
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed.replace(/\/+$/, "");
    }
    return `http://${trimmed}`.replace(/\/+$/, "");
}
