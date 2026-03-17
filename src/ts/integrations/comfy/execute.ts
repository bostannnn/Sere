import { get } from "svelte/store";
import { alertError } from "src/ts/alert";
import { readImage } from "src/ts/globalApi.svelte";
import type { OpenAIChat } from "src/ts/process/index.svelte";
import { requestChatData } from "src/ts/process/request/request";
import { postCharacterInlayAsset, postInlayAsset, saveInlayMetadata } from "src/ts/process/files/inlays";
import {
    getDatabase,
    setDatabase,
    type Chat,
    type character,
    type ComfyCommanderTemplate,
    type ComfyCommanderWorkflow,
    type ImageGenerationTrace,
} from "src/ts/storage/database.svelte";
import { isNodeServer } from "src/ts/platform";
import { saveServerCharacterImageFile } from "src/ts/storage/serverStorage";
import { comfyProgressStore, selectedCharID } from "src/ts/stores.svelte";
import { fetchComfyHistory, fetchComfyImageBlob, queueComfyPrompt } from "./proxy";
import { generateRunpodImage } from "./runpod";
import { findComfyTemplateById, findComfyWorkflowById, getComfyCommanderState } from "./store.svelte";
import { parseComfyCommanderImagePromptModel } from "./config";
import {
    applyTemplatePrompt,
    applyWorkflowMacros,
    cleanLLMOutput,
    resolveTemplate,
    stripImageContent,
} from "./template";
import {
    COMFY_PROGRESS_COLOR,
    comfyProgressDefault,
    type ComfyCommanderConfig,
    type ComfyCommanderReferenceStoreConfig,
    type ComfyImageDescriptor,
} from "./types";
import { uploadReferenceImageToYandexDisk } from "./yandexDisk";

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorMessage(error: unknown): string {
    if (typeof error === "string" && error.trim()) {
        return error.trim();
    }
    if (error && typeof error === "object" && "message" in error) {
        const message = String((error as { message?: unknown }).message ?? "").trim();
        if (message) {
            return message;
        }
    }
    return "Unknown error";
}

function resetComfyProgress() {
    comfyProgressStore.set(comfyProgressDefault);
}

function setComfyProgress(label: string) {
    comfyProgressStore.set({
        active: true,
        label,
        color: COMFY_PROGRESS_COLOR,
    });
}

function getActiveCharacterContext() {
    const db = getDatabase();
    const currentCharIndex = get(selectedCharID);
    if (currentCharIndex < 0) {
        throw new Error("No active character/chat.");
    }

    const selected = db.characters[currentCharIndex];
    if (!selected) {
        throw new Error("No active character/chat.");
    }

    const activeChat = selected.chats[selected.chatPage];
    if (!activeChat || !Array.isArray(activeChat.message)) {
        throw new Error("Chat not found.");
    }

    return {
        db,
        selected,
        activeChat,
        currentCharIndex,
    };
}

function findLastMessageText(messages: { role: string; data: string }[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || typeof message.data !== "string") {
            continue;
        }
        const cleaned = stripImageContent(message.data);
        if (cleaned) {
            return cleaned;
        }
    }
    return "";
}

function findLastCharacterMessageText(messages: { role: string; data: string }[]): string {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || message.role !== "char" || typeof message.data !== "string") {
            continue;
        }
        const cleaned = stripImageContent(message.data);
        if (cleaned) {
            return cleaned;
        }
    }
    return "";
}

function buildRecentChatContext(
    messages: Array<{ role: string; data: string }>,
    options: { charName: string; userName: string; limit: number; maxChars: number },
): string {
    const entries: string[] = [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || typeof message.data !== "string") {
            continue;
        }
        const cleaned = stripImageContent(message.data);
        if (!cleaned) {
            continue;
        }
        const roleLabel = message.role === "char"
            ? options.charName
            : (message.role === "user" ? options.userName : message.role);
        entries.push(`${roleLabel}: ${cleaned}`);
        if (entries.length >= options.limit) {
            break;
        }
    }
    const ordered = entries.reverse().join("\n");
    if (ordered.length <= options.maxChars) {
        return ordered;
    }
    return ordered.slice(ordered.length - options.maxChars);
}

function toBase64(input: Uint8Array): string {
    if (!input.length) {
        return "";
    }
    const chunkSize = 0x8000;
    let binary = "";
    for (let i = 0; i < input.length; i += chunkSize) {
        const chunk = input.subarray(i, Math.min(i + chunkSize, input.length));
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}

async function getCharacterPortraitData(charData: character | { type: string; image?: string }) {
    if (charData.type !== "character") {
        return null;
    }
    const imagePath = typeof charData.image === "string" ? charData.image : "";
    if (!imagePath) {
        return null;
    }

    const bytes = await readImage(imagePath);
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        return null;
    }

    const extension = ((imagePath.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "")) || "png";
    const contentType = extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`;

    return {
        bytes,
        extension,
        contentType,
        base64: toBase64(bytes),
    };
}

async function runMainLLMPromptOnly(options: {
    systemPrompt: string;
    userPrompt: string;
    staticModel?: string;
    openrouterModelOverride?: string;
}): Promise<string> {
    const formated: OpenAIChat[] = [];
    if (options.systemPrompt.trim()) {
        formated.push({
            role: "system",
            content: options.systemPrompt,
        });
    }
    formated.push({
        role: "user",
        content: options.userPrompt,
    });

    const response = await requestChatData({
        formated,
        bias: {},
        useStreaming: false,
        noMultiGen: true,
        staticModel: options.staticModel,
        openrouterModelOverride: options.openrouterModelOverride,
    }, "model", null);

    if (response.type === "success") {
        return response.result;
    }
    if (response.type === "fail") {
        throw new Error(response.result);
    }
    throw new Error("Unexpected LLM response type");
}

function extractFirstComfyImageDescriptor(historyItem: unknown): ComfyImageDescriptor {
    const item = historyItem as {
        outputs?: Record<string, { images?: Array<Record<string, unknown>> }>;
    };

    const outputs = item?.outputs;
    if (!outputs || typeof outputs !== "object") {
        throw new Error("No outputs returned from ComfyUI.");
    }

    for (const output of Object.values(outputs)) {
        if (!output || !Array.isArray(output.images) || output.images.length === 0) {
            continue;
        }

        const first = output.images[0] as Record<string, unknown>;
        const filename = typeof first.filename === "string" ? first.filename : "";
        if (!filename) {
            continue;
        }

        return {
            filename,
            subfolder: typeof first.subfolder === "string" ? first.subfolder : "",
            type: typeof first.type === "string" ? first.type : "output",
        };
    }

    throw new Error("No images returned from ComfyUI.");
}

async function waitForComfyHistoryItem(promptId: string) {
    const state = getComfyCommanderState({ snapshot: true });
    const timeoutMs = Math.max(1, state.config.timeoutSec) * 1000;
    const pollIntervalMs = Math.max(100, state.config.pollIntervalMs);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
        await sleep(pollIntervalMs);
        const history = await fetchComfyHistory(state.config);
        const item = history[promptId];
        if (item) {
            return item;
        }
    }

    throw new Error(`Generation timeout (${state.config.timeoutSec}s).`);
}

function resolveWorkflowOrThrow(
    state: ReturnType<typeof getComfyCommanderState>,
    template: ComfyCommanderTemplate,
): ComfyCommanderWorkflow {
    const workflow = findComfyWorkflowById(state, template.workflowId);
    if (!workflow) {
        throw new Error("Workflow not found. Please select a workflow in settings.");
    }
    if (!workflow.workflow.trim()) {
        throw new Error("Workflow is empty. Please select or add a workflow.");
    }
    return workflow;
}

function resolveGenerationProvider(config: ComfyCommanderConfig, template: ComfyCommanderTemplate) {
    if (template.providerOverride === "comfyui" || template.providerOverride === "runpod") {
        return template.providerOverride;
    }
    return config.activeProvider;
}

function resolveRunpodEndpoint(template: ComfyCommanderTemplate, config: ComfyCommanderConfig) {
    if (template.runpodEndpointId.trim()) {
        return {
            modelId: template.runpodEndpointId.trim(),
            schemaPreset: template.runpodSchemaPreset,
        };
    }
    if (template.runpodModelId.trim()) {
        if (template.runpodModelId.trim() === "__custom__") {
            const endpointId = config.runpod.customEndpointId.trim();
            if (!endpointId) {
                throw new Error("Runpod custom endpoint ID is missing.");
            }
            return {
                modelId: endpointId,
                schemaPreset: template.runpodSchemaPreset,
            };
        }
        return {
            modelId: template.runpodModelId.trim(),
            schemaPreset: template.runpodSchemaPreset,
        };
    }
    if (config.runpod.modelId.trim() === "__custom__") {
        const endpointId = config.runpod.customEndpointId.trim();
        if (!endpointId) {
            throw new Error("Runpod custom endpoint ID is missing.");
        }
        return {
            modelId: endpointId,
            schemaPreset: config.runpod.customSchemaPreset,
        };
    }
    return {
        modelId: config.runpod.modelId.trim(),
        schemaPreset: config.runpod.customSchemaPreset,
    };
}

function resolveTemplateImagePromptConfig(
    template: ComfyCommanderTemplate,
    config: ComfyCommanderConfig,
) {
    const modelSelection = parseComfyCommanderImagePromptModel(template.imagePromptModel || config.imagePrompt.model);
    const promptTemplate = (template.prompt || "").trim()
        || (template.imagePromptUserPromptTemplate || config.imagePrompt.userPromptTemplate);
    return {
        model: modelSelection.mode === "native" ? modelSelection.model : "",
        openrouterModel: modelSelection.mode === "openrouter" ? modelSelection.model : "",
        promptTemplate,
        contextMessageCount: Math.max(1, template.imagePromptContextMessageCount || config.imagePrompt.contextMessageCount),
        maxContextChars: Math.max(200, template.imagePromptMaxContextChars || config.imagePrompt.maxContextChars),
    };
}

function resolveTemplateRunpodConfig(
    template: ComfyCommanderTemplate,
    config: ComfyCommanderConfig,
) {
    return {
        ...config.runpod,
        outputFormat: template.runpodOutputFormat || config.runpod.outputFormat,
        width: Math.max(64, template.runpodWidth || config.runpod.width),
        height: Math.max(64, template.runpodHeight || config.runpod.height),
        size: template.runpodSize || config.runpod.size,
        numInferenceSteps: Math.max(1, template.runpodNumInferenceSteps || config.runpod.numInferenceSteps),
        guidance: Number.isFinite(template.runpodGuidance) ? template.runpodGuidance : config.runpod.guidance,
        strength: Number.isFinite(template.runpodStrength) ? template.runpodStrength : config.runpod.strength,
        enableSafetyChecker: typeof template.runpodEnableSafetyChecker === "boolean"
            ? template.runpodEnableSafetyChecker
            : config.runpod.enableSafetyChecker,
    };
}

async function resolveReferenceImageUrls(options: {
    template: ComfyCommanderTemplate;
    referenceStore: ComfyCommanderReferenceStoreConfig;
    selected: character | { type: string; image?: string };
}) {
    if (!options.template.useReferenceImage || options.template.referenceSource === "none") {
        return [];
    }

    if (options.template.referenceSource !== "character-portrait") {
        throw new Error("Unsupported reference image source.");
    }

    const portrait = await getCharacterPortraitData(options.selected);
    if (!portrait) {
        if (options.template.allowReferenceFallbackToText) {
            return [];
        }
        throw new Error("Character portrait is required for this template.");
    }

    if (options.referenceStore.provider !== "yandex-disk") {
        if (options.template.allowReferenceFallbackToText) {
            return [];
        }
        throw new Error("Reference image store is not configured.");
    }

    setComfyProgress("Image Generation: Reference Image");
    const uploaded = await uploadReferenceImageToYandexDisk(options.referenceStore, portrait);
    return [uploaded.downloadHref];
}

async function saveGeneratedImageToChat(options: {
    db: ReturnType<typeof getDatabase>;
    currentCharIndex: number;
    activeChat: Chat;
    selected: character | { type: string; chaId?: string };
    data: Uint8Array;
    fileName: string;
    generationTrace: Omit<ImageGenerationTrace, "outputAssetPath" | "metadataPath">;
}) {
    const charId = typeof options.selected.chaId === "string" ? options.selected.chaId.trim() : "";
    const inlayId = charId
        ? await postCharacterInlayAsset({
            name: options.fileName,
            data: options.data,
            characterId: charId,
        })
        : await postInlayAsset({
            name: options.fileName,
            data: options.data,
        });

    if (!inlayId) {
        throw new Error("Failed to save generated image as inlay asset.");
    }

    let metadataPath = "";
    if (charId) {
        try {
            const normalizedInlayPath = inlayId.replace(/^\/data\//, '').replace(/^data\//, '');
            const imageFile = normalizedInlayPath.split('/').pop() || '';
            const imageId = imageFile.includes('.') ? imageFile.slice(0, imageFile.lastIndexOf('.')) : imageFile;
            if (imageId) {
                const metadata = {
                    version: 1,
                    characterId: charId,
                    chatId: options.activeChat.id || "",
                    messageTime: options.generationTrace.createdAt,
                    ...options.generationTrace,
                    outputAssetPath: normalizedInlayPath,
                };
                if (isNodeServer) {
                    metadataPath = await saveServerCharacterImageFile(
                        charId,
                        new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
                        imageId,
                        `${imageId}.json`,
                    );
                } else {
                    metadataPath = `characters/${charId}/images/${imageId}.json`;
                    await saveInlayMetadata(metadataPath, metadata);
                }
            }
        } catch {
            metadataPath = "";
        }
    }

    options.activeChat.message.push({
        role: "char",
        data: `{{inlayed::${inlayId}}}`,
        time: Date.now(),
        generationInfo: {
            model: options.generationTrace.imageModel || options.generationTrace.provider,
            imageGeneration: {
                ...options.generationTrace,
                outputAssetPath: inlayId,
                metadataPath: metadataPath || undefined,
            },
        },
    });

    options.db.characters[options.currentCharIndex].chats[options.db.characters[options.currentCharIndex].chatPage] = options.activeChat;
    setDatabase(options.db);
}

async function executeComfyUiGeneration(options: {
    state: ReturnType<typeof getComfyCommanderState>;
    template: ComfyCommanderTemplate;
    positivePrompt: string;
    selected: character | { type: string; image?: string };
}): Promise<{
    data: Uint8Array;
    fileName: string;
    imageModel: string;
    mode: "text-to-image" | "image-edit";
    referenceImageUrls: string[];
}> {
    const workflow = resolveWorkflowOrThrow(options.state, options.template);
    setComfyProgress("Image Generation: ComfyUI");

    const portrait = await getCharacterPortraitData(options.selected);
    if (options.template.useReferenceImage && options.template.referenceSource === "character-portrait" && !portrait) {
        if (!options.template.allowReferenceFallbackToText) {
            throw new Error("Character portrait is required for this template.");
        }
    }
    const workflowPayload = applyWorkflowMacros(workflow.workflow, {
        positivePrompt: options.positivePrompt,
        negativePrompt: options.template.negativePrompt || "",
        seed: Math.floor(Math.random() * 1000000000),
        charAvatarBase64: portrait?.base64 || "",
    });

    const promptId = await queueComfyPrompt(options.state.config, workflowPayload);
    const historyItem = await waitForComfyHistoryItem(promptId);
    const descriptor = extractFirstComfyImageDescriptor(historyItem);
    const blob = await fetchComfyImageBlob(options.state.config, descriptor);
    return {
        data: new Uint8Array(await blob.arrayBuffer()),
        fileName: descriptor.filename || `comfy-${Date.now()}.png`,
        imageModel: "comfyui",
        mode: options.template.modeDefault === "image-edit" ? "image-edit" : "text-to-image",
        referenceImageUrls: [] as string[],
    };
}

async function executeRunpodGeneration(options: {
    state: ReturnType<typeof getComfyCommanderState>;
    template: ComfyCommanderTemplate;
    positivePrompt: string;
    selected: character | { type: string; image?: string };
}): Promise<{
    data: Uint8Array;
    fileName: string;
    imageModel: string;
    mode: "text-to-image" | "image-edit";
    referenceImageUrls: string[];
}> {
    const referenceImageUrls = await resolveReferenceImageUrls({
        template: options.template,
        referenceStore: options.state.config.referenceStore,
        selected: options.selected,
    });
    const requestedMode = options.template.modeDefault === "image-edit" ? "image-edit" : "text-to-image";
    const mode = referenceImageUrls.length > 0 ? requestedMode : "text-to-image";
    if (requestedMode === "image-edit" && referenceImageUrls.length === 0 && !options.template.allowReferenceFallbackToText) {
        throw new Error("Reference image is required for this template.");
    }

    setComfyProgress("Image Generation: Runpod");
    const endpoint = resolveRunpodEndpoint(options.template, options.state.config);
    const result = await generateRunpodImage(resolveTemplateRunpodConfig(options.template, options.state.config), {
        modelId: endpoint.modelId,
        customSchemaPreset: endpoint.schemaPreset,
        prompt: options.positivePrompt,
        negativePrompt: options.template.negativePrompt || "",
        mode,
        referenceImageUrls,
        timeoutSec: options.state.config.timeoutSec,
        pollIntervalMs: options.state.config.pollIntervalMs,
    });

    return {
        data: result.bytes,
        fileName: `runpod-${Date.now()}.${result.fileExtension}`,
        imageModel: endpoint.modelId,
        mode,
        referenceImageUrls,
    };
}

async function executeResolvedTemplate(template: ComfyCommanderTemplate, userPrompt: string) {
    const state = getComfyCommanderState({ snapshot: true });
    const { db, selected, activeChat, currentCharIndex } = getActiveCharacterContext();

    const activeMessages = activeChat.message as { role: string; data: string }[];
    const lastMessage = findLastMessageText(activeMessages);
    const lastCharMessage = findLastCharacterMessageText(activeMessages);
    const imagePromptConfig = resolveTemplateImagePromptConfig(template, state.config);
    const llmPrompt = applyTemplatePrompt(imagePromptConfig.promptTemplate, userPrompt, {
        templatePrompt: template.prompt || userPrompt,
        prompt: userPrompt,
        char: selected.name || "Char",
        user: db.username || "User",
        lastMessage,
        lastCharMessage,
        chatContext: buildRecentChatContext(activeMessages, {
            charName: selected.name || "Char",
            userName: db.username || "User",
            limit: Math.max(1, imagePromptConfig.contextMessageCount),
            maxChars: Math.max(200, imagePromptConfig.maxContextChars),
        }),
    });

    setComfyProgress("Image Generation: LLM");
    const llmRaw = await runMainLLMPromptOnly({
        systemPrompt: "Output only the final image prompt. No explanations, no markdown.",
        userPrompt: llmPrompt,
        staticModel: imagePromptConfig.openrouterModel ? "openrouter" : (imagePromptConfig.model || undefined),
        openrouterModelOverride: imagePromptConfig.openrouterModel || undefined,
    });
    const positivePrompt = cleanLLMOutput(llmRaw);
    if (!positivePrompt) {
        throw new Error("LLM returned empty prompt.");
    }

    const provider = resolveGenerationProvider(state.config, template);
    const generated = provider === "runpod"
        ? await executeRunpodGeneration({
            state,
            template,
            positivePrompt,
            selected: selected as character,
        })
        : await executeComfyUiGeneration({
            state,
            template,
            positivePrompt,
            selected: selected as character,
        });

    await saveGeneratedImageToChat({
        db,
        currentCharIndex,
        activeChat: activeChat as Chat,
        selected: selected as character,
        data: generated.data,
        fileName: generated.fileName,
        generationTrace: {
            source: "comfy-commander",
            templateId: template.id,
            templateName: template.buttonName || template.trigger || "Template",
            llmSystemPrompt: "Output only the final image prompt. No explanations, no markdown.",
            llmPromptTemplate: imagePromptConfig.promptTemplate,
            llmInputPrompt: llmPrompt,
            llmRawOutput: llmRaw,
            finalPrompt: positivePrompt,
            userPrompt,
            promptModel: imagePromptConfig.openrouterModel || imagePromptConfig.model || undefined,
            provider,
            imageModel: generated.imageModel,
            mode: generated.mode,
            negativePrompt: template.negativePrompt || "",
            referenceSource: template.referenceSource,
            referenceImageUrls: generated.referenceImageUrls,
            createdAt: Date.now(),
        },
    });
}

export async function runComfyCommand(arg: string): Promise<void> {
    try {
        const state = getComfyCommanderState({ snapshot: true });
        const trimmed = (arg || "").trim();
        if (!trimmed) {
            throw new Error("Usage: /cw <trigger> [prompt]");
        }

        const match = resolveTemplate(state.templates, trimmed);
        if (!match) {
            throw new Error("No template found.");
        }

        await executeResolvedTemplate(match.template, match.userPrompt);
    } catch (error) {
        alertError(`Comfy Error: ${extractErrorMessage(error)}`);
    } finally {
        resetComfyProgress();
    }
}

export async function runComfyTemplateById(templateId: string): Promise<void> {
    try {
        const state = getComfyCommanderState({ snapshot: true });
        const template = findComfyTemplateById(state, templateId);
        if (!template) {
            throw new Error("Template not found.");
        }

        await executeResolvedTemplate(template, "");
    } catch (error) {
        alertError(`Comfy Error: ${extractErrorMessage(error)}`);
    } finally {
        resetComfyProgress();
    }
}
