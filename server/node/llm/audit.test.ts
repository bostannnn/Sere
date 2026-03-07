import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { appendExecutionLog, getLogFilePath } from "./audit.cjs";

const originalLogMode = process.env.RISU_LLM_LOG_MODE;
const cleanupRoots: string[] = [];

afterEach(async () => {
    if (originalLogMode === undefined) {
        delete process.env.RISU_LLM_LOG_MODE;
    } else {
        process.env.RISU_LLM_LOG_MODE = originalLogMode;
    }
    while (cleanupRoots.length > 0) {
        const root = cleanupRoots.pop();
        if (!root) continue;
        await fs.rm(root, { recursive: true, force: true });
    }
});

describe("audit compact log shaping", () => {
    it("preserves generate request messageCount in compact log mode", async () => {
        const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "risu-audit-test-"));
        cleanupRoots.push(dataRoot);
        process.env.RISU_LLM_LOG_MODE = "compact";

        await appendExecutionLog(dataRoot, {
            requestId: "req-generate-1",
            endpoint: "generate",
            request: {
                mode: "model",
                provider: "openrouter",
                request: {
                    model: "openrouter/auto",
                    maxTokens: 512,
                    messagesCount: 3,
                    estimatedPromptTokens: 321,
                    promptChars: 128,
                    toolsCount: 2,
                    requestBodyKeys: ["model", "messages", "stream"],
                },
            },
            response: {
                type: "success",
                result: "hello world",
            },
        });

        const logPath = getLogFilePath(dataRoot);
        const raw = await fs.readFile(logPath, "utf-8");
        const entry = JSON.parse(raw.trim());

        expect(entry.request.messageCount).toBe(3);
        expect(entry.request.model).toBe("openrouter/auto");
        expect(entry.request.requestBodyKeys).toEqual(["model", "messages", "stream"]);
        expect(entry.request.promptChars).toBe(128);
        expect(entry.request.toolsCount).toBe(2);
    });
});
