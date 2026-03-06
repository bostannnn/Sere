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
});
