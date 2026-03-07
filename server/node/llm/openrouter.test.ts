import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const originalFetch = global.fetch;

async function createDataRootWithSettings() {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "risu-openrouter-test-"));
    const settingsPath = path.join(dataRoot, "settings.json");
    await fs.writeFile(settingsPath, JSON.stringify({
        data: {
            openrouterKey: "test-key",
            openrouterRequestModel: "deepseek/deepseek-v3.2-speciale",
            openrouterSubRequestModel: "deepseek/deepseek-v3.2-speciale",
        },
    }), "utf-8");
    return dataRoot;
}

function buildInput(allowReasoningOnly: boolean) {
    return {
        mode: "model",
        streaming: false,
        request: {
            model: "deepseek/deepseek-v3.2-speciale",
            allowReasoningOnlyForDeepSeekV32Speciale: allowReasoningOnly,
            requestBody: {
                model: "deepseek/deepseek-v3.2-speciale",
                messages: [{ role: "user", content: "hello" }],
                stream: false,
            },
        },
    };
}

describe("openrouter execute response shaping", () => {
    afterEach(async () => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it("merges reasoning and content as normal text for DeepSeek-V3.2-Speciale when flag is enabled", async () => {
        const dataRoot = await createDataRootWithSettings();
        global.fetch = vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({
                choices: [
                    {
                        message: {
                            content: "internal step and visible",
                            reasoning: "internal step",
                        },
                    },
                ],
            }),
        })) as unknown as typeof fetch;

        const { executeOpenRouter } = await import("./openrouter.cjs");
        const result = await executeOpenRouter(buildInput(true), { dataRoot });

        expect(result?.type).toBe("success");
        expect(result?.result).toBe("internal step and visible");
        expect(result?.result).not.toContain("<Thoughts>");
    });

    it("keeps Thoughts wrapper behavior when flag is disabled", async () => {
        const dataRoot = await createDataRootWithSettings();
        global.fetch = vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({
                choices: [
                    {
                        message: {
                            content: "visible",
                            reasoning: "internal",
                        },
                    },
                ],
            }),
        })) as unknown as typeof fetch;

        const { executeOpenRouter } = await import("./openrouter.cjs");
        const result = await executeOpenRouter(buildInput(false), { dataRoot });

        expect(result?.type).toBe("success");
        expect(result?.result).toContain("<Thoughts>");
        expect(result?.result).toContain("visible");
    });

    it("returns upstream models even when local cache write fails", async () => {
        const dataRoot = await createDataRootWithSettings();
        const originalWriteFile = fs.writeFile;
        global.fetch = vi.fn(async () => ({
            ok: true,
            text: async () => JSON.stringify({
                data: [
                    {
                        id: "openai/gpt-4o-mini",
                        name: "GPT-4o Mini",
                        pricing: { prompt: 0.000001, completion: 0.000002 },
                        context_length: 128000,
                    },
                ],
            }),
        })) as unknown as typeof fetch;
        vi.spyOn(fs, "writeFile").mockImplementation(async (...args: Parameters<typeof fs.writeFile>) => {
            const [filePath] = args;
            if (String(filePath).includes("openrouter-models-cache.json")) {
                throw new Error("disk full");
            }
            return originalWriteFile(...args);
        });

        try {
            const { listOpenRouterModels } = await import("./openrouter.cjs");
            const models = await listOpenRouterModels({ dataRoot, forceRefresh: true });
            expect(Array.isArray(models?.models)).toBe(true);
            expect(models?.stale).toBe(false);
            expect(models?.source).toBe("upstream");
            expect(models?.models?.[0]?.id).toBe("openai/gpt-4o-mini");
        } finally {
            await fs.rm(dataRoot, { recursive: true, force: true });
        }
    });

    it("serves stale cached models when the OpenRouter key is missing", async () => {
        const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "risu-openrouter-cache-test-"));
        const settingsPath = path.join(dataRoot, "settings.json");
        const cachePath = path.join(dataRoot, "logs", "openrouter-models-cache.json");
        await fs.writeFile(settingsPath, JSON.stringify({ data: {} }), "utf-8");
        await fs.mkdir(path.dirname(cachePath), { recursive: true });
        await fs.writeFile(cachePath, JSON.stringify({
            models: [{ id: "openai/gpt-4o-mini", name: "GPT-4o Mini - Free", price: 0, context_length: 128000 }],
            updatedAt: "2026-03-01T00:00:00.000Z",
        }), "utf-8");

        try {
            const { listOpenRouterModels } = await import("./openrouter.cjs");
            const models = await listOpenRouterModels({ dataRoot, forceRefresh: true });
            expect(Array.isArray(models?.models)).toBe(true);
            expect(models?.stale).toBe(true);
            expect(models?.source).toBe("cache");
            expect(models?.error).toMatchObject({
                code: "OPENROUTER_KEY_MISSING",
                status: 400,
            });
            expect(models?.models?.[0]?.id).toBe("openai/gpt-4o-mini");
        } finally {
            await fs.rm(dataRoot, { recursive: true, force: true });
        }
    });
});
