import type {
    ComfyCommanderConfig,
    ComfyCommanderImagePromptConfig,
    ComfyCommanderReferenceStoreConfig,
    ComfyCommanderRunpodConfig,
    ComfyCommanderRunpodSchemaPreset,
    ComfyCommanderTemplate,
    ComfyCommanderWorkflow,
} from "./types";
import type { ComfyCommanderState } from "src/ts/storage/database.types";
import { resolveRunpodModelDefinition, type RunpodModelDefinition } from "./runpodModels";
import { normalizeComfyBaseUrl } from "./types";

export const COMFY_COMMANDER_DEFAULT_BASE_URL = "http://127.0.0.1:8188";

export const COMFY_COMMANDER_DEFAULT_IMAGE_PROMPT_TEMPLATE = `You are a scene-to-image prompt translator. Read the recent roleplay chat and produce a single image generation prompt for the Qwen image model.

Analyze:
- what the character is doing or just finished doing
- her emotional state
- her appearance, clothing, and visible details
- the setting
- the lighting

Rules:
- output only the final image prompt
- frame the image as a selfie taken by the character herself
- only one person in frame
- if another person is involved, imply them off-camera or just out of frame
- style: polaroid photo, slightly washed-out warm tones, soft natural grain, candid feel, slightly overexposed highlights, vintage analog look
- expression and body language should match the scene
- keep the prompt under 120 words

Character: {{char}}
User request: {{prompt}}
Last message: {{lastMessage}}
Last character message: {{lastCharMessage}}
Recent chat context:
{{chatContext}}`;

export const COMFY_COMMANDER_RUNPOD_SCHEMA_PRESET_OPTIONS: { value: ComfyCommanderRunpodSchemaPreset; label: string }[] = [
    { value: "generic-text", label: "Generic Text" },
    { value: "generic-edit", label: "Generic Edit" },
    { value: "flux", label: "Flux" },
    { value: "z-image", label: "Z Image" },
    { value: "qwen-edit", label: "Qwen Edit" },
    { value: "qwen-edit-2511", label: "Qwen Edit 2511" },
];

export function createComfyCommanderEntityId(prefix: "wf" | "tpl") {
    return `cc-${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultComfyCommanderImagePromptConfig(): ComfyCommanderImagePromptConfig {
    return {
        model: "",
        systemPrompt: "",
        userPromptTemplate: COMFY_COMMANDER_DEFAULT_IMAGE_PROMPT_TEMPLATE,
        contextMessageCount: 4,
        maxContextChars: 1400,
    };
}

export function createDefaultComfyCommanderRunpodConfig(): ComfyCommanderRunpodConfig {
    return {
        apiKey: "",
        modelId: "z-image-turbo",
        requestMode: "runsync",
        outputFormat: "png",
        width: 1024,
        height: 1024,
        size: "1024*1024",
        numInferenceSteps: 28,
        guidance: 7,
        strength: 0.8,
        enableSafetyChecker: true,
        customEndpointId: "",
        customSchemaPreset: "generic-text",
    };
}

export function createDefaultComfyCommanderReferenceStoreConfig(): ComfyCommanderReferenceStoreConfig {
    return {
        provider: "none",
        yandexDiskToken: "",
        yandexDiskFolder: "/Apps/RisuAI/runpod-temp",
    };
}

export function createDefaultComfyCommanderConfig(baseUrl: string): ComfyCommanderConfig {
    return {
        baseUrl: normalizeComfyBaseUrl(baseUrl || COMFY_COMMANDER_DEFAULT_BASE_URL),
        timeoutSec: 120,
        pollIntervalMs: 1000,
        activeProvider: "comfyui",
        imagePrompt: createDefaultComfyCommanderImagePromptConfig(),
        runpod: createDefaultComfyCommanderRunpodConfig(),
        referenceStore: createDefaultComfyCommanderReferenceStoreConfig(),
    };
}

export function createDefaultComfyCommanderState(baseUrl: string): ComfyCommanderState {
    return {
        version: 1,
        config: createDefaultComfyCommanderConfig(baseUrl),
        workflows: [],
        templates: [],
    };
}

export function createComfyCommanderTemplateDefaults() {
    const imagePrompt = createDefaultComfyCommanderImagePromptConfig();
    const runpod = createDefaultComfyCommanderRunpodConfig();
    return {
        imagePromptModel: imagePrompt.model,
        imagePromptSystemPrompt: imagePrompt.systemPrompt,
        imagePromptUserPromptTemplate: imagePrompt.userPromptTemplate,
        imagePromptContextMessageCount: imagePrompt.contextMessageCount,
        imagePromptMaxContextChars: imagePrompt.maxContextChars,
        runpodOutputFormat: runpod.outputFormat,
        runpodWidth: runpod.width,
        runpodHeight: runpod.height,
        runpodSize: runpod.size,
        runpodNumInferenceSteps: runpod.numInferenceSteps,
        runpodGuidance: runpod.guidance,
        runpodStrength: runpod.strength,
        runpodEnableSafetyChecker: runpod.enableSafetyChecker,
    };
}

export function createEmptyComfyCommanderTemplate(): ComfyCommanderTemplate {
    return {
        id: createComfyCommanderEntityId("tpl"),
        trigger: "new",
        prompt: COMFY_COMMANDER_DEFAULT_IMAGE_PROMPT_TEMPLATE,
        negativePrompt: "",
        ...createComfyCommanderTemplateDefaults(),
        workflowId: "",
        showInChatMenu: false,
        buttonName: "",
        providerOverride: "none",
        runpodModelId: "",
        runpodEndpointId: "",
        runpodSchemaPreset: "generic-text",
        modeDefault: "text-to-image",
        useReferenceImage: false,
        referenceSource: "none",
        allowReferenceFallbackToText: false,
    };
}

export function createEmptyComfyCommanderWorkflow(): ComfyCommanderWorkflow {
    return {
        id: createComfyCommanderEntityId("wf"),
        name: "Workflow",
        workflow: "",
    };
}

export function resolveRunpodEndpointId(modelId: string, customEndpointId: string) {
    return modelId === "__custom__" ? customEndpointId.trim() : modelId.trim();
}

export function templateUsesProvider(
    template: ComfyCommanderTemplate,
    activeProvider: "comfyui" | "runpod",
    provider: "comfyui" | "runpod",
) {
    if (template.providerOverride === provider) {
        return true;
    }
    if (template.providerOverride !== "none") {
        return false;
    }
    return activeProvider === provider;
}

export function resolveTemplateRunpodModel(
    template: ComfyCommanderTemplate,
    runpod: ComfyCommanderRunpodConfig,
): RunpodModelDefinition {
    const modelId = template.runpodModelId || runpod.modelId;
    const endpointId = template.runpodEndpointId || runpod.customEndpointId;
    const schemaPreset = modelId === "__custom__" ? template.runpodSchemaPreset : runpod.customSchemaPreset;
    return resolveRunpodModelDefinition(
        resolveRunpodEndpointId(modelId, endpointId),
        schemaPreset,
    );
}
