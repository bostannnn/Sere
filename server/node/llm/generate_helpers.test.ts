import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGenerateHelpers } from "./generate_helpers.cjs";

async function createDataRoot() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "risu-generate-helpers-"));
  const characterId = "charA";
  const chatId = "chatA";
  const charDir = path.join(dataRoot, "characters", characterId);
  const chatDir = path.join(charDir, "chats");
  await mkdir(chatDir, { recursive: true });
  await writeFile(
    path.join(dataRoot, "settings.json"),
    JSON.stringify({
      data: {
        aiModel: "openrouter",
        openrouterRequestModel: "openrouter/auto",
        maxResponse: 300,
      },
    }),
    "utf-8",
  );
  await writeFile(
    path.join(charDir, "character.json"),
    JSON.stringify({
      character: {
        chaId: characterId,
        name: "Character A",
      },
    }),
    "utf-8",
  );
  await writeFile(
    path.join(chatDir, `${chatId}.json`),
    JSON.stringify({
      chat: {
        id: chatId,
        name: "Chat A",
        message: [{ role: "assistant", data: "older response" }],
        hypaV3Data: {
          summaries: [{ text: "s1", chatMemos: [] }],
          metrics: {},
          lastSummarizedMessageIndex: 0,
        },
      },
    }),
    "utf-8",
  );
  return { dataRoot, characterId, chatId };
}

function createHelpersHarness(arg: {
  dataRoot: string;
  extractLatestUserMessage?: (raw: unknown) => string;
  buildGeneratePromptMessages?: (payload: Record<string, unknown>) => Promise<{ messages: unknown[]; promptBlocks: unknown[] }>;
  buildServerMemoryMessages?: (payload: Record<string, unknown>) => Promise<unknown[]>;
  applyStateCommands?: (...args: unknown[]) => Promise<unknown>;
  readStateLastEventId?: () => Promise<number>;
}) {
  return createGenerateHelpers({
    toStringOrEmpty: (value: unknown) => (typeof value === "string" ? value : ""),
    promptPipeline: {
      extractLatestUserMessage: arg.extractLatestUserMessage ?? (() => ""),
      buildGeneratePromptMessages: arg.buildGeneratePromptMessages ?? (async () => ({
        messages: [{ role: "user", content: "hello" }],
        promptBlocks: [],
      })),
      buildGenerateProviderRequest: (_provider: string, model: string, messages: unknown[], _maxTokens: number, streaming: boolean) => ({
        model,
        messages,
        requestBody: {
          model,
          messages,
          stream: streaming,
        },
      }),
    },
    parseLLMExecutionInput: vi.fn(() => ({})),
    executeLLM: vi.fn(async () => ({ type: "success", result: "ok" })),
    dataRoot: arg.dataRoot,
    LLMHttpError: class extends Error {
      status: number;
      code: string;
      details: unknown;
      constructor(status: number, code: string, message: string, details: unknown = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
      }
    },
    getGenerateMode: () => "model",
    isSafePathSegment: (segment: string) => /^[a-zA-Z0-9._-]+$/.test(segment),
    path,
    fs,
    existsSync,
    dataDirs: {
      root: arg.dataRoot,
      characters: path.join(arg.dataRoot, "characters"),
    },
    safeJsonClone: (value: unknown, fallback: unknown) => {
      try {
        if (value === undefined) return fallback;
        return JSON.parse(JSON.stringify(value));
      } catch {
        return fallback;
      }
    },
    resolveGenerateModelSelection: () => ({
      provider: "openrouter",
      model: "openrouter/auto",
      selectedModelId: "openrouter",
    }),
    normalizeProvider: () => "openrouter",
    planPeriodicHypaV3Summarization: () => ({ shouldRun: false, reason: "not_planned" }),
    applyPeriodicHypaV3Summary: () => ({ updated: false, reason: "not_applied" }),
    generateSummaryEmbedding: async () => null,
    buildServerMemoryMessages: arg.buildServerMemoryMessages ?? (async () => []),
    applyStateCommands: arg.applyStateCommands,
    readStateLastEventId: arg.readStateLastEventId ?? (async () => 0),
  });
}

describe("generate_helpers", () => {
  const cleanup: string[] = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      const dir = cleanup.pop();
      if (!dir) continue;
      await rm(dir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("persists user message before prompt assembly", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    const order: string[] = [];
    const applyStateCommands = vi.fn(async (commands: Record<string, unknown>[]) => {
      const command = commands[0] || {};
      if (command.type === "chat.message.append") {
        order.push("persist");
        expect((command.message as Record<string, unknown>)?.data).toBe("fresh user message");
      }
      return { ok: true, lastEventId: 11, applied: [], conflicts: [] };
    });

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "fresh user message",
      buildGeneratePromptMessages: async (payload) => {
        order.push("prompt");
        const chat = (payload.chat || {}) as { message?: Array<Record<string, unknown>> };
        const tail = Array.isArray(chat.message) ? chat.message[chat.message.length - 1] : null;
        expect(tail?.role).toBe("user");
        expect(tail?.data).toBe("fresh user message");
        return {
          messages: [{ role: "user", content: "fresh user message" }],
          promptBlocks: [],
        };
      },
      applyStateCommands,
      readStateLastEventId: async () => 10,
    });

    await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      userMessage: "fresh user message",
      streaming: false,
      request: { requestBody: {} },
    });

    expect(applyStateCommands).toHaveBeenCalledTimes(2);
    expect(order[0]).toBe("persist");
    expect(order[1]).toBe("prompt");
  });

  it("retries hypa persistence once on STALE_BASE_EVENT and merges latest chat snapshot", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    const chatPath = path.join(dataRoot, "characters", characterId, "chats", `${chatId}.json`);
    let applyCalls = 0;
    const applyStateCommands = vi.fn(async (commands: Record<string, unknown>[]) => {
      const command = commands[0] || {};
      if (command.type !== "chat.replace") {
        return { ok: true, lastEventId: 21, applied: [], conflicts: [] };
      }
      applyCalls += 1;
      if (applyCalls === 1) {
        await writeFile(
          chatPath,
          JSON.stringify({
            chat: {
              id: chatId,
              name: "Latest from other device",
              message: [
                { role: "assistant", data: "older response" },
                { role: "user", data: "concurrent write" },
              ],
              hypaV3Data: {
                summaries: [{ text: "s-concurrent", chatMemos: [] }],
                metrics: {},
                lastSummarizedMessageIndex: 1,
              },
            },
          }),
          "utf-8",
        );
        const staleError = new Error("stale");
        (staleError as Error & { code?: string; result?: unknown }).code = "INTERNAL_STATE_COMMAND_FAILED";
        (staleError as Error & { code?: string; result?: unknown }).result = {
          ok: false,
          conflicts: [{ code: "STALE_BASE_EVENT" }],
        };
        throw staleError;
      }
      return { ok: true, lastEventId: 22, applied: [], conflicts: [] };
    });

    let cursor = 100;
    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "",
      buildServerMemoryMessages: async ({ chat }) => {
        const target = chat as { hypaV3Data?: Record<string, unknown> };
        target.hypaV3Data = {
          summaries: [{ text: "s1", chatMemos: [] }],
          metrics: { lastRecentSummaries: [0] },
          lastSummarizedMessageIndex: 0,
        };
        return [];
      },
      applyStateCommands,
      readStateLastEventId: async () => {
        cursor += 1;
        return cursor;
      },
    });

    await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      streaming: false,
      continue: true,
      request: { requestBody: {} },
    });

    const replaceCalls = applyStateCommands.mock.calls.filter((entry) => entry?.[0]?.[0]?.type === "chat.replace");
    expect(replaceCalls.length).toBe(2);
    const secondPayload = replaceCalls[1]?.[0]?.[0]?.chat as Record<string, unknown>;
    expect(secondPayload?.name).toBe("Latest from other device");
    expect(Array.isArray(secondPayload?.message)).toBe(true);
    expect((secondPayload?.message as Array<Record<string, unknown>>).some((msg) => msg.data === "concurrent write")).toBe(true);
    const hypa = (secondPayload?.hypaV3Data || {}) as { summaries?: Array<{ text?: string }>; metrics?: unknown };
    expect(Array.isArray(hypa.summaries)).toBe(true);
    expect(hypa.summaries?.[0]?.text).toBe("s1");
    expect(hypa.metrics && typeof hypa.metrics === "object").toBe(true);
  });
});
