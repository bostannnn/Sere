import type { ComfyCommanderRunpodConfig, ComfyCommanderRunpodSchemaPreset } from "./types";
import { resolveRunpodModelDefinition } from "./runpodModels";

const RUNPOD_API_BASE = "https://api.runpod.ai/v2";

export interface RunpodGenerationRequest {
    modelId: string;
    customSchemaPreset: ComfyCommanderRunpodSchemaPreset;
    prompt: string;
    negativePrompt: string;
    mode: "text-to-image" | "image-edit";
    referenceImageUrls: string[];
    timeoutSec: number;
    pollIntervalMs: number;
}

function responseJsonOrNull(response: Response) {
    return response.json().catch(() => null);
}

async function parseRunpodError(response: Response) {
    const parsed = await responseJsonOrNull(response) as Record<string, unknown> | null;
    const nested = parsed?.error;
    if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
    }
    const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";
    if (message) {
        return message;
    }
    return `Runpod request failed (${response.status})`;
}

async function fetchRunpod(
    config: ComfyCommanderRunpodConfig,
    path: string,
    init: RequestInit = {},
): Promise<Response> {
    const apiKey = (config.apiKey || "").trim();
    if (!apiKey) {
        throw new Error("Runpod API key is missing.");
    }

    const response = await fetch(`${RUNPOD_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {}),
        },
    });

    if (!response.ok) {
        throw new Error(await parseRunpodError(response));
    }

    return response;
}

function buildRunpodInput(
    config: ComfyCommanderRunpodConfig,
    arg: RunpodGenerationRequest,
) {
    const model = resolveRunpodModelDefinition(arg.modelId, arg.customSchemaPreset);
    if (!model.id) {
        throw new Error("Runpod model is not configured.");
    }
    if (!model.modes.includes(arg.mode)) {
        throw new Error(`${model.label} does not support ${arg.mode}.`);
    }
    if (arg.mode === "image-edit" && model.referenceField === "none") {
        throw new Error(`${model.label} does not accept reference images.`);
    }

    const input: Record<string, unknown> = {
        prompt: arg.prompt,
        seed: -1,
    };

    if (model.supportsNegativePrompt) {
        input.negative_prompt = arg.negativePrompt || "";
    }
    if (model.supportsSteps) {
        input.num_inference_steps = config.numInferenceSteps;
    }
    if (model.supportsGuidance) {
        input.guidance = config.guidance;
    }
    if (model.supportsStrength) {
        input.strength = config.strength;
    }
    if (model.supportsSafetyChecker) {
        input.enable_safety_checker = config.enableSafetyChecker;
    }

    if (model.usesSizeString) {
        input.size = config.size || `${config.width}*${config.height}`;
    } else {
        input.width = config.width;
        input.height = config.height;
    }

    input[model.outputFormatField] = config.outputFormat;

    if (model.referenceField === "image") {
        const firstReference = arg.referenceImageUrls[0];
        if (arg.mode === "image-edit" && !firstReference) {
            throw new Error(`${model.label} requires a reference image.`);
        }
        if (firstReference) {
            input.image = firstReference;
        }
    }

    if (model.referenceField === "images") {
        const references = arg.referenceImageUrls.filter(Boolean);
        if (arg.mode === "image-edit" && references.length === 0) {
            throw new Error(`${model.label} requires at least one reference image.`);
        }
        if (references.length > 0) {
            input.images = references;
        }
    }

    return {
        endpointId: model.id,
        input,
    };
}

function extractImageUrl(value: unknown): string {
    if (!value) {
        return "";
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
            return trimmed;
        }
        return "";
    }
    if (Array.isArray(value)) {
        for (const entry of value) {
            const found = extractImageUrl(entry);
            if (found) {
                return found;
            }
        }
        return "";
    }
    if (typeof value !== "object") {
        return "";
    }

    const record = value as Record<string, unknown>;
    const preferredKeys = [
        "image_url",
        "imageUrl",
        "download_url",
        "downloadUrl",
        "url",
        "href",
        "image",
    ];
    for (const key of preferredKeys) {
        const found = extractImageUrl(record[key]);
        if (found) {
            return found;
        }
    }
    for (const nested of Object.values(record)) {
        const found = extractImageUrl(nested);
        if (found) {
            return found;
        }
    }
    return "";
}

function decodeDataUrl(url: string): Uint8Array | null {
    const match = url.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (!match) {
        return null;
    }
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

async function fetchImageBytes(imageUrl: string): Promise<Uint8Array> {
    const dataUrlBytes = decodeDataUrl(imageUrl);
    if (dataUrlBytes) {
        return dataUrlBytes;
    }

    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to download generated image (${response.status}).`);
    }
    return new Uint8Array(await response.arrayBuffer());
}

async function pollRunpodStatus(
    config: ComfyCommanderRunpodConfig,
    endpointId: string,
    jobId: string,
    timeoutSec: number,
    pollIntervalMs: number,
) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutSec * 1000) {
        await new Promise((resolve) => setTimeout(resolve, Math.max(500, pollIntervalMs)));
        const response = await fetchRunpod(config, `/${endpointId}/status/${jobId}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
        const payload = await response.json() as Record<string, unknown>;
        const status = String(payload.status || payload.state || "").toUpperCase();
        if (status === "COMPLETED") {
            return payload;
        }
        if (status === "FAILED" || status === "CANCELLED") {
            throw new Error(String(payload.error || payload.message || "Runpod job failed."));
        }
    }
    throw new Error(`Runpod generation timeout (${timeoutSec}s).`);
}

export async function generateRunpodImage(
    config: ComfyCommanderRunpodConfig,
    arg: RunpodGenerationRequest,
): Promise<{ bytes: Uint8Array; fileExtension: string }> {
    const { endpointId, input } = buildRunpodInput(config, arg);
    const requestMode = config.requestMode === "run" ? "run" : "runsync";
    const response = await fetchRunpod(config, `/${endpointId}/${requestMode}`, {
        method: "POST",
        body: JSON.stringify({ input }),
    });
    const payload = await response.json() as Record<string, unknown>;
    const completed = requestMode === "run"
        ? await pollRunpodStatus(
            config,
            endpointId,
            String(payload.id || payload.jobId || ""),
            arg.timeoutSec,
            arg.pollIntervalMs,
        )
        : payload;

    const output = completed.output ?? completed.result ?? completed;
    const imageUrl = extractImageUrl(output);
    if (!imageUrl) {
        throw new Error("Runpod did not return an image URL.");
    }

    const bytes = await fetchImageBytes(imageUrl);
    const normalizedFormat = (config.outputFormat || "png").trim().toLowerCase();
    const fileExtension = normalizedFormat === "jpeg" ? "jpg" : normalizedFormat;

    return {
        bytes,
        fileExtension,
    };
}
