import { get } from "svelte/store";
import { alertError } from "src/ts/alert";
import { readImage } from "src/ts/globalApi.svelte";
import type { OpenAIChat } from "src/ts/process/index.svelte";
import { requestChatData } from "src/ts/process/request/request";
import { postInlayAsset } from "src/ts/process/files/inlays";
import {
    getDatabase,
    setDatabase,
    type character,
    type ComfyCommanderTemplate,
    type ComfyCommanderWorkflow,
} from "src/ts/storage/database.svelte";
import { comfyProgressStore, selectedCharID } from "src/ts/stores.svelte";
import { fetchComfyHistory, fetchComfyImageBlob, queueComfyPrompt } from "./proxy";
import { findComfyTemplateById, findComfyWorkflowById, getComfyCommanderState } from "./store.svelte";
import {
    applyTemplatePrompt,
    applyWorkflowMacros,
    cleanLLMOutput,
    resolveTemplate,
    stripImageContent,
} from "./template";
import { COMFY_PROGRESS_COLOR, comfyProgressDefault, type ComfyImageDescriptor } from "./types";

const comfyExecuteLog = (..._args: unknown[]) => {};

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

async function getCharacterAvatarBase64(charData: character | { type: string; image?: string }): Promise<string> {
    if (charData.type !== "character") {
        return "";
    }
    const imagePath = typeof charData.image === "string" ? charData.image : "";
    if (!imagePath) {
        return "";
    }

    try {
        const bytes = await readImage(imagePath);
        if (!(bytes instanceof Uint8Array)) {
            return "";
        }
        return toBase64(bytes);
    } catch {
        return "";
    }
}

async function runMainLLMPromptOnly(prompt: string): Promise<string> {
    const currentChar = getDatabase().characters[get(selectedCharID)] as character;

    const formated: OpenAIChat[] = [{
        role: "user",
        content: prompt,
    }];

    const response = await requestChatData({
        formated,
        bias: {},
        currentChar,
        useStreaming: false,
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

async function executeResolvedTemplate(template: ComfyCommanderTemplate, userPrompt: string) {
    const state = getComfyCommanderState({ snapshot: true });
    const workflow = resolveWorkflowOrThrow(state, template);
    const { db, selected, activeChat, currentCharIndex } = getActiveCharacterContext();

    const lastMessage = findLastMessageText(activeChat.message as { role: string; data: string }[]);
    const lastCharMessage = findLastCharacterMessageText(activeChat.message as { role: string; data: string }[]);

    const llmPrompt = applyTemplatePrompt(template.prompt, userPrompt, {
        prompt: userPrompt,
        char: selected.name || "Char",
        user: db.username || "User",
        lastMessage,
        lastCharMessage,
    });

    setComfyProgress("Comfy Commander: LLM");
    if (state.config.debug) {
        comfyExecuteLog("[Comfy] Prompt", llmPrompt);
    }

    const llmRaw = await runMainLLMPromptOnly(llmPrompt);
    const positivePrompt = cleanLLMOutput(llmRaw);
    if (!positivePrompt) {
        throw new Error("LLM returned empty prompt.");
    }

    setComfyProgress("Comfy Commander: ComfyUI");
    const charAvatarBase64 = await getCharacterAvatarBase64(selected as character);
    const workflowPayload = applyWorkflowMacros(workflow.workflow, {
        positivePrompt,
        negativePrompt: template.negativePrompt || "",
        seed: Math.floor(Math.random() * 1000000000),
        charAvatarBase64,
    });

    const promptId = await queueComfyPrompt(state.config, workflowPayload);
    const historyItem = await waitForComfyHistoryItem(promptId);
    const descriptor = extractFirstComfyImageDescriptor(historyItem);
    const blob = await fetchComfyImageBlob(state.config, descriptor);
    const data = new Uint8Array(await blob.arrayBuffer());

    const fallbackName = `comfy-${Date.now()}.png`;
    const inlayId = await postInlayAsset({
        name: descriptor.filename || fallbackName,
        data,
    });

    if (!inlayId) {
        throw new Error("Failed to save generated image as inlay asset.");
    }

    activeChat.message.push({
        role: "char",
        data: `{{inlayed::${inlayId}}}`,
        time: Date.now(),
    });

    db.characters[currentCharIndex].chats[db.characters[currentCharIndex].chatPage] = activeChat;
    setDatabase(db);
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
