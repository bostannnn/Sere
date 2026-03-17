import type { ComfyCommanderRunpodSchemaPreset } from "src/ts/storage/database.svelte";

export type RunpodModelMode = "text-to-image" | "image-edit";

export interface RunpodModelDefinition {
    id: string;
    label: string;
    schemaPreset: ComfyCommanderRunpodSchemaPreset;
    modes: RunpodModelMode[];
    referenceField: "none" | "image" | "images";
    usesSizeString: boolean;
    supportsNegativePrompt: boolean;
    supportsSteps: boolean;
    supportsGuidance: boolean;
    supportsStrength: boolean;
    supportsSafetyChecker: boolean;
    outputFormatField: "output_format" | "image_format";
}

export const RUNPOD_MODELS: RunpodModelDefinition[] = [
    {
        id: "black-forest-labs-flux-1-dev",
        label: "Flux 1 Dev",
        schemaPreset: "flux",
        modes: ["text-to-image"],
        referenceField: "none",
        usesSizeString: false,
        supportsNegativePrompt: true,
        supportsSteps: true,
        supportsGuidance: true,
        supportsStrength: false,
        supportsSafetyChecker: false,
        outputFormatField: "image_format",
    },
    {
        id: "black-forest-labs-flux-1-schnell",
        label: "Flux 1 Schnell",
        schemaPreset: "flux",
        modes: ["text-to-image"],
        referenceField: "none",
        usesSizeString: false,
        supportsNegativePrompt: true,
        supportsSteps: true,
        supportsGuidance: true,
        supportsStrength: false,
        supportsSafetyChecker: false,
        outputFormatField: "image_format",
    },
    {
        id: "z-image-turbo",
        label: "Z Image Turbo",
        schemaPreset: "z-image",
        modes: ["text-to-image", "image-edit"],
        referenceField: "image",
        usesSizeString: true,
        supportsNegativePrompt: false,
        supportsSteps: false,
        supportsGuidance: false,
        supportsStrength: true,
        supportsSafetyChecker: true,
        outputFormatField: "output_format",
    },
    {
        id: "qwen-image-t2i",
        label: "Qwen Image T2I",
        schemaPreset: "generic-text",
        modes: ["text-to-image"],
        referenceField: "none",
        usesSizeString: true,
        supportsNegativePrompt: false,
        supportsSteps: false,
        supportsGuidance: false,
        supportsStrength: false,
        supportsSafetyChecker: false,
        outputFormatField: "output_format",
    },
    {
        id: "qwen-image-edit",
        label: "Qwen Image Edit",
        schemaPreset: "qwen-edit",
        modes: ["image-edit"],
        referenceField: "image",
        usesSizeString: true,
        supportsNegativePrompt: false,
        supportsSteps: false,
        supportsGuidance: false,
        supportsStrength: false,
        supportsSafetyChecker: false,
        outputFormatField: "output_format",
    },
    {
        id: "qwen-image-edit-2511",
        label: "Qwen Image Edit 2511",
        schemaPreset: "qwen-edit-2511",
        modes: ["image-edit"],
        referenceField: "images",
        usesSizeString: true,
        supportsNegativePrompt: false,
        supportsSteps: false,
        supportsGuidance: false,
        supportsStrength: false,
        supportsSafetyChecker: false,
        outputFormatField: "output_format",
    },
    {
        id: "qwen-image-edit-2511-lora",
        label: "Qwen Image Edit 2511 LoRA",
        schemaPreset: "qwen-edit-2511",
        modes: ["image-edit"],
        referenceField: "images",
        usesSizeString: true,
        supportsNegativePrompt: false,
        supportsSteps: false,
        supportsGuidance: false,
        supportsStrength: false,
        supportsSafetyChecker: false,
        outputFormatField: "output_format",
    },
];

export function resolveRunpodModelDefinition(
    modelId: string,
    customSchemaPreset: ComfyCommanderRunpodSchemaPreset,
): RunpodModelDefinition {
    const matched = RUNPOD_MODELS.find((model) => model.id === modelId.trim());
    if (matched) {
        return matched;
    }

    const usesSizeString = customSchemaPreset !== "flux";
    const referenceField = customSchemaPreset === "generic-edit" || customSchemaPreset === "qwen-edit"
        ? "image"
        : (customSchemaPreset === "qwen-edit-2511" ? "images" : "none");
    const modes: RunpodModelMode[] = referenceField === "none"
        ? ["text-to-image"]
        : ["text-to-image", "image-edit"];

    return {
        id: modelId.trim(),
        label: modelId.trim() || "Custom Runpod Endpoint",
        schemaPreset: customSchemaPreset,
        modes,
        referenceField,
        usesSizeString,
        supportsNegativePrompt: customSchemaPreset === "flux" || customSchemaPreset === "generic-text",
        supportsSteps: customSchemaPreset === "flux",
        supportsGuidance: customSchemaPreset === "flux",
        supportsStrength: customSchemaPreset === "z-image",
        supportsSafetyChecker: customSchemaPreset === "z-image",
        outputFormatField: customSchemaPreset === "flux" ? "image_format" : "output_format",
    };
}
