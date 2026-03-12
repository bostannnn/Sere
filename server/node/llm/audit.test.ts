import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appendExecutionLog, readExecutionLogs } from "./audit.cjs";

const originalLogMode = process.env.RISU_LLM_LOG_MODE;
const cleanupRoots: string[] = [];

beforeEach(() => {
    vi.useRealTimers();
});

afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

        const writtenPath = await appendExecutionLog(dataRoot, {
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

        expect(writtenPath).toContain(`${path.sep}logs${path.sep}llm-execution${path.sep}`);
        expect(writtenPath).toContain("__generate__req-generate-1.json");
        const raw = await fs.readFile(writtenPath, "utf-8");
        const entry = JSON.parse(raw.trim());

        expect(entry.request.messageCount).toBe(3);
        expect(entry.request.model).toBe("openrouter/auto");
        expect(entry.request.requestBodyKeys).toEqual(["model", "messages", "stream"]);
        expect(entry.request.promptChars).toBe(128);
        expect(entry.request.toolsCount).toBe(2);
    });

    it("reads new entry-file logs in reverse chronological order", async () => {
        const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "risu-audit-test-"));
        cleanupRoots.push(dataRoot);

        await appendExecutionLog(dataRoot, {
            requestId: "req-1",
            endpoint: "generate",
            chatId: "chat-a",
            status: 200,
        });
        await new Promise((resolve) => setTimeout(resolve, 5));
        await appendExecutionLog(dataRoot, {
            requestId: "req-2",
            endpoint: "rag",
            mode: "list",
            chatId: "chat-a",
            status: 200,
        });

        const logs = await readExecutionLogs(dataRoot, { limit: 2, chatId: "chat-a" });

        expect(logs).toHaveLength(2);
        expect(logs[0]?.requestId).toBe("req-2");
        expect(logs[1]?.requestId).toBe("req-1");
    });

    it("does not overwrite logs emitted in the same millisecond", async () => {
        const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "risu-audit-test-"));
        cleanupRoots.push(dataRoot);
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-03-11T10:00:00.123Z"));

        const firstPath = await appendExecutionLog(dataRoot, {
            requestId: "req-same-ms",
            endpoint: "rag",
            mode: "list",
            status: 200,
        });
        const secondPath = await appendExecutionLog(dataRoot, {
            requestId: "req-same-ms",
            endpoint: "rag",
            mode: "list",
            status: 201,
        });

        expect(firstPath).not.toBe(secondPath);
        const logs = await readExecutionLogs(dataRoot, { limit: 10, requestId: "req-same-ms" });
        expect(logs).toHaveLength(2);
        expect(logs.map((entry) => entry.status).sort()).toEqual([200, 201]);
    });

    it("stops reading older entry directories once limit is satisfied", async () => {
        const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "risu-audit-test-"));
        cleanupRoots.push(dataRoot);

        const newestDir = path.join(dataRoot, "logs", "llm-execution", "2026-03-11");
        const olderDir = path.join(dataRoot, "logs", "llm-execution", "2026-03-10");
        await fs.mkdir(newestDir, { recursive: true });
        await fs.mkdir(olderDir, { recursive: true });
        await fs.writeFile(
            path.join(newestDir, "2026-03-11T10-00-00.000Z__generate__req-new.json"),
            JSON.stringify({
                timestamp: "2026-03-11T10:00:00.000Z",
                requestId: "req-new",
                endpoint: "generate",
                status: 200,
            }),
            "utf-8",
        );
        await fs.writeFile(
            path.join(olderDir, "2026-03-10T09-00-00.000Z__generate__req-old.json"),
            JSON.stringify({
                timestamp: "2026-03-10T09:00:00.000Z",
                requestId: "req-old",
                endpoint: "generate",
                status: 200,
            }),
            "utf-8",
        );

        const readdirSpy = vi.spyOn(fs, "readdir");
        const readFileSpy = vi.spyOn(fs, "readFile");

        const logs = await readExecutionLogs(dataRoot, { limit: 1 });

        expect(logs).toHaveLength(1);
        expect(logs[0]?.requestId).toBe("req-new");
        expect(readFileSpy).toHaveBeenCalledTimes(1);
        expect(
            readdirSpy.mock.calls.some((call) => String(call[0]).includes(`${path.sep}2026-03-10`)),
        ).toBe(false);
    });
});
