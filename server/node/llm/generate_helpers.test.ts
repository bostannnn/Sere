import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGenerateHelpers } from "./generate_helpers.cjs";
import {
  applyPeriodicMemorySummary,
  planPeriodicMemorySummarization,
} from "../memory/memory.cjs";

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
        memoryData: {
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
  estimatePromptTokens?: (messages: unknown[]) => number | Promise<number>;
  applyStateCommands?: (...args: unknown[]) => Promise<unknown>;
  readStateLastEventId?: () => Promise<number>;
  parseLLMExecutionInput?: (payload: unknown) => unknown;
  executeLLM?: (...args: unknown[]) => Promise<unknown>;
  planPeriodicMemorySummarization?: (payload: Record<string, unknown>) => Record<string, unknown>;
  applyPeriodicMemorySummary?: (payload: Record<string, unknown>) => Record<string, unknown>;
  generateSummaryEmbedding?: (summaryText: string, settings: unknown) => Promise<unknown>;
}) {
  return createGenerateHelpers({
    toStringOrEmpty: (value: unknown) => (typeof value === "string" ? value : ""),
    promptPipeline: {
      extractLatestUserMessage: arg.extractLatestUserMessage ?? (() => ""),
      buildGeneratePromptMessages: arg.buildGeneratePromptMessages ?? (async () => ({
        messages: [{ role: "user", content: "hello" }],
        promptBlocks: [],
      })),
      buildGenerateProviderRequest: (_provider: string, model: string, messages: unknown[], maxTokens: number, streaming: boolean) => ({
        model,
        messages,
        maxTokens,
        requestBody: {
          model,
          messages,
          stream: streaming,
        },
      }),
      estimatePromptTokens: arg.estimatePromptTokens ?? ((messages: unknown[]) => {
        if (!Array.isArray(messages)) return 0;
        return messages.reduce((sum, msg) => {
          const content = (msg && typeof msg === "object" && typeof (msg as { content?: unknown }).content === "string")
            ? (msg as { content: string }).content
            : "";
          return sum + content.length;
        }, 0);
      }),
    },
    parseLLMExecutionInput: arg.parseLLMExecutionInput ?? vi.fn(() => ({})),
    executeLLM: arg.executeLLM ?? vi.fn(async () => ({ type: "success", result: "ok" })),
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
    planPeriodicMemorySummarization: arg.planPeriodicMemorySummarization ?? (() => ({ shouldRun: false, reason: "not_planned" })),
    applyPeriodicMemorySummary: arg.applyPeriodicMemorySummary ?? (() => ({ updated: false, reason: "not_applied" })),
    generateSummaryEmbedding: arg.generateSummaryEmbedding ?? (async () => null),
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

    expect(applyStateCommands).toHaveBeenCalledTimes(1);
    expect(order[0]).toBe("persist");
    expect(order[1]).toBe("prompt");
  });

  it("uses periodic interval as the effective summary window even if legacy maxChatsPerSummary differs", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);

    const settingsPath = path.join(dataRoot, "settings.json");
    const characterPath = path.join(dataRoot, "characters", characterId, "character.json");
    const chatPath = path.join(dataRoot, "characters", characterId, "chats", `${chatId}.json`);

    await writeFile(
      settingsPath,
      JSON.stringify({
        data: {
          aiModel: "openrouter",
          openrouterRequestModel: "openrouter/auto",
          maxResponse: 300,
          memoryEnabled: true,
          memoryPresetId: 0,
          memoryPresets: [
            {
              name: "Default",
              settings: {
                summarizationPrompt: "",
                doNotSummarizeUserMessage: false,
                periodicSummarizationInterval: 4,
                maxChatsPerSummary: 2,
                maxSelectedSummaries: 4,
              },
            },
          ],
        },
      }),
      "utf-8",
    );

    await writeFile(
      characterPath,
      JSON.stringify({
        character: {
          chaId: characterId,
          name: "Character A",
          memoryEnabled: true,
        },
      }),
      "utf-8",
    );

    await writeFile(
      chatPath,
      JSON.stringify({
        chat: {
          id: chatId,
          name: "Chat A",
          message: [
            { role: "user", data: "u1", chatId: "m1" },
            { role: "char", data: "a1", chatId: "m2" },
            { role: "user", data: "u2", chatId: "m3" },
            { role: "char", data: "a2", chatId: "m4" },
          ],
          memoryData: {
            summaries: [],
            metrics: {},
            lastSummarizedMessageIndex: 0,
          },
        },
      }),
      "utf-8",
    );

    let summaryCount = 0;
    const chat = {
      id: chatId,
      name: "Chat A",
      message: [
        { role: "user", data: "u1", chatId: "m1" },
        { role: "char", data: "a1", chatId: "m2" },
        { role: "user", data: "u2", chatId: "m3" },
        { role: "char", data: "a2", chatId: "m4" },
      ],
      memoryData: {
        summaries: [],
        metrics: {},
        lastSummarizedMessageIndex: 0,
      },
    };

    const helpers = createHelpersHarness({
      dataRoot,
      parseLLMExecutionInput: (payload) => payload,
      executeLLM: vi.fn(async () => {
        summaryCount += 1;
        return { type: "success", result: `summary-${summaryCount}` };
      }),
      planPeriodicMemorySummarization,
      applyPeriodicMemorySummary,
      generateSummaryEmbedding: async () => null,
    });

    const periodicResult = await helpers.maybeRunServerPeriodicMemorySummarization({
      character: {
        chaId: characterId,
        name: "Character A",
        memoryEnabled: true,
      },
      chat,
      settings: {
        memoryEnabled: true,
        maxResponse: 300,
        memoryPresetId: 0,
        memoryPresets: [
          {
            name: "Default",
            settings: {
              summarizationPrompt: "",
              doNotSummarizeUserMessage: false,
              periodicSummarizationInterval: 4,
              maxChatsPerSummary: 2,
              maxSelectedSummaries: 4,
            },
          },
        ],
      },
      characterId,
      chatId,
    });

    expect(periodicResult.updated).toBe(true);
    expect(summaryCount).toBe(1);
    expect(chat.memoryData.lastSummarizedMessageIndex).toBe(4);
    expect(chat.memoryData.summaries).toHaveLength(1);
  });

  it("retries memory persistence once on STALE_BASE_EVENT and merges latest chat snapshot", async () => {
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
              memoryData: {
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
      buildGeneratePromptMessages: async (payload) => {
        const buildMemory = payload.buildServerMemoryMessages as ((arg: Record<string, unknown>) => Promise<unknown[]>);
        await buildMemory({
          character: payload.character,
          chat: payload.chat,
          settings: payload.settings,
        });
        return {
          messages: [{ role: "user", content: "hello" }],
          promptBlocks: [],
        };
      },
      buildServerMemoryMessages: async ({ chat }) => {
        const target = chat as { memoryData?: Record<string, unknown> };
        target.memoryData = {
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
    const memoryData = (secondPayload?.memoryData || {}) as { summaries?: Array<{ text?: string }>; metrics?: unknown };
    expect(Array.isArray(memoryData.summaries)).toBe(true);
    expect(memoryData.summaries?.[0]?.text).toBe("s1");
    expect(memoryData.metrics && typeof memoryData.metrics === "object").toBe(true);
  });

  it("fails generate when target chat is missing", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    await rm(path.join(dataRoot, "characters", characterId, "chats", `${chatId}.json`), { force: true });

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "hello",
      applyStateCommands: vi.fn(async () => ({ ok: true, lastEventId: 12, applied: [], conflicts: [] })),
    });

    await expect(
      helpers.buildGenerateExecutionPayload({
        characterId,
        chatId,
        userMessage: "hello",
        streaming: false,
        request: { requestBody: {} },
      }),
    ).rejects.toMatchObject({
      code: "CHAT_NOT_FOUND",
    });
  });

  it("does not retry append when stale conflict already contains the same tail user message", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    const chatPath = path.join(dataRoot, "characters", characterId, "chats", `${chatId}.json`);
    let appendAttempts = 0;
    const applyStateCommands = vi.fn(async (commands: Record<string, unknown>[]) => {
      const command = commands[0] || {};
      if (command.type !== "chat.message.append") {
        return { ok: true, lastEventId: 13, applied: [], conflicts: [] };
      }
      appendAttempts += 1;
      if (appendAttempts === 1) {
        await writeFile(
          chatPath,
          JSON.stringify({
            chat: {
              id: chatId,
              name: "Chat A",
              message: [
                { role: "assistant", data: "older response" },
                { role: "user", data: "fresh user message" },
              ],
              memoryData: {
                summaries: [{ text: "s1", chatMemos: [] }],
                metrics: {},
                lastSummarizedMessageIndex: 0,
              },
            },
          }),
          "utf-8",
        );
        const staleError = new Error("stale");
        (staleError as Error & { result?: unknown }).result = {
          ok: false,
          conflicts: [{ code: "STALE_BASE_EVENT" }],
        };
        throw staleError;
      }
      return { ok: true, lastEventId: 14, applied: [], conflicts: [] };
    });

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "fresh user message",
      applyStateCommands,
      readStateLastEventId: async () => 9,
    });

    await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      userMessage: "fresh user message",
      streaming: false,
      request: { requestBody: {} },
    });

    expect(appendAttempts).toBe(1);
    expect(applyStateCommands.mock.calls.filter((entry) => entry?.[0]?.[0]?.type === "chat.message.append").length).toBe(1);
  });

  it("refreshes the latest chat snapshot after stale duplicate user-message conflict before prompt assembly", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    const chatPath = path.join(dataRoot, "characters", characterId, "chats", `${chatId}.json`);
    let appendAttempts = 0;
    const applyStateCommands = vi.fn(async (commands: Record<string, unknown>[]) => {
      const command = commands[0] || {};
      if (command.type !== "chat.message.append") {
        return { ok: true, lastEventId: 16, applied: [], conflicts: [] };
      }
      appendAttempts += 1;
      if (appendAttempts === 1) {
        await writeFile(
          chatPath,
          JSON.stringify({
            chat: {
              id: chatId,
              name: "Chat A",
              message: [
                { role: "assistant", data: "other device context" },
                { role: "user", data: "fresh user message" },
              ],
              memoryData: {
                summaries: [{ text: "s1", chatMemos: [] }],
                metrics: { concurrent: true },
                lastSummarizedMessageIndex: 0,
              },
            },
          }),
          "utf-8",
        );
        const staleError = new Error("stale");
        (staleError as Error & { result?: unknown }).result = {
          ok: false,
          conflicts: [{ code: "STALE_BASE_EVENT" }],
        };
        throw staleError;
      }
      return { ok: true, lastEventId: 17, applied: [], conflicts: [] };
    });

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "fresh user message",
      buildGeneratePromptMessages: async (payload) => {
        const chat = (payload.chat || {}) as { message?: Array<Record<string, unknown>>; memoryData?: Record<string, unknown> };
        expect(Array.isArray(chat.message)).toBe(true);
        expect(chat.message?.[0]?.data).toBe("other device context");
        expect(chat.message?.[1]?.data).toBe("fresh user message");
        expect((chat.memoryData || {}).metrics).toMatchObject({ concurrent: true });
        return {
          messages: [{ role: "user", content: "fresh user message" }],
          promptBlocks: [],
        };
      },
      applyStateCommands,
      readStateLastEventId: async () => 18,
    });

    await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      userMessage: "fresh user message",
      streaming: false,
      request: { requestBody: {} },
    });

    expect(appendAttempts).toBe(1);
  });

  it("skips memory chat.replace when memory data is unchanged", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    const applyStateCommands = vi.fn(async () => ({ ok: true, lastEventId: 15, applied: [], conflicts: [] }));

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "",
      buildGeneratePromptMessages: async () => ({
        messages: [{ role: "assistant", content: "existing" }],
        promptBlocks: [],
      }),
      buildServerMemoryMessages: async () => [],
      applyStateCommands,
    });

    await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      continue: true,
      streaming: false,
      request: { requestBody: {} },
    });

    expect(applyStateCommands).not.toHaveBeenCalled();
  });

  it("trims oldest chat history first when assembled prompt exceeds max context", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    await writeFile(
      path.join(dataRoot, "settings.json"),
      JSON.stringify({
        data: {
          aiModel: "openrouter",
          openrouterRequestModel: "openrouter/auto",
          maxResponse: 40,
          maxContext: 260,
        },
      }),
      "utf-8",
    );

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "",
      estimatePromptTokens: (messages) => {
        const costs: Record<string, number> = {
          system: 60,
          old1: 120,
          old2: 120,
          newest: 120,
        };
        return (messages as Array<Record<string, unknown>>).reduce((sum, msg) => {
          const key = String(msg.content || "");
          return sum + (costs[key] || 0);
        }, 0);
      },
      buildGeneratePromptMessages: async () => ({
        messages: [
          { role: "system", content: "system" },
          { role: "user", content: "old1" },
          { role: "assistant", content: "old2" },
          { role: "user", content: "newest" },
        ],
        promptBlocks: [
          { index: 0, role: "system", title: "Main Prompt", source: "template" },
          { index: 1, role: "user", title: "Chat History", source: "chat" },
          { index: 2, role: "assistant", title: "Chat History", source: "chat" },
          { index: 3, role: "user", title: "Chat History", source: "chat" },
        ],
      }),
    });

    const result = await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      continue: true,
      streaming: false,
      request: { requestBody: {}, maxTokens: 4 },
    });

    expect((result.request?.messages || []).map((msg: Record<string, unknown>) => msg.content)).toEqual([
      "system",
      "newest",
    ]);
    expect((result.promptBlocks || []).map((block: Record<string, unknown>) => [block.index, block.source])).toEqual([
      [0, "template"],
      [1, "chat"],
    ]);
    expect(result.request?.maxTokens).toBe(4);
  });

  it("trims chat history to preserve the requested output budget", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    await writeFile(
      path.join(dataRoot, "settings.json"),
      JSON.stringify({
        data: {
          aiModel: "openrouter",
          openrouterRequestModel: "openrouter/auto",
          maxResponse: 100,
          maxContext: 300,
        },
      }),
      "utf-8",
    );

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "",
      estimatePromptTokens: (messages) => {
        const costs: Record<string, number> = {
          "system-large": 60,
          "older-chat": 70,
          "recent-chat": 70,
          "newest-chat": 70,
        };
        return (messages as Array<Record<string, unknown>>).reduce((sum, msg) => {
          const key = String(msg.content || "");
          return sum + (costs[key] || 0);
        }, 0);
      },
      buildGeneratePromptMessages: async () => ({
        messages: [
          { role: "system", content: "system-large" },
          { role: "user", content: "older-chat" },
          { role: "assistant", content: "recent-chat" },
          { role: "user", content: "newest-chat" },
        ],
        promptBlocks: [
          { index: 0, role: "system", title: "Main Prompt", source: "template" },
          { index: 1, role: "user", title: "Chat History", source: "chat" },
          { index: 2, role: "assistant", title: "Chat History", source: "chat" },
          { index: 3, role: "user", title: "Chat History", source: "chat" },
        ],
      }),
    });

    const result = await helpers.buildGenerateExecutionPayload({
      characterId,
      chatId,
      continue: true,
      streaming: false,
      request: { requestBody: {}, maxTokens: 100 },
    });

    expect((result.request?.messages || []).map((msg: Record<string, unknown>) => msg.content)).toEqual([
      "system-large",
      "recent-chat",
      "newest-chat",
    ]);
    expect(result.request?.maxTokens).toBe(100);
  });

  it("fails when prompt exceeds the reserved-output budget and no chat history can be trimmed", async () => {
    const { dataRoot, characterId, chatId } = await createDataRoot();
    cleanup.push(dataRoot);
    await writeFile(
      path.join(dataRoot, "settings.json"),
      JSON.stringify({
        data: {
          aiModel: "openrouter",
          openrouterRequestModel: "openrouter/auto",
          maxResponse: 10,
          maxContext: 300,
        },
      }),
      "utf-8",
    );

    const helpers = createHelpersHarness({
      dataRoot,
      extractLatestUserMessage: () => "",
      estimatePromptTokens: () => 320,
      buildGeneratePromptMessages: async () => ({
        messages: [{ role: "system", content: "system-only" }],
        promptBlocks: [{ index: 0, role: "system", title: "Main Prompt", source: "template" }],
      }),
    });

    await expect(
      helpers.buildGenerateExecutionPayload({
        characterId,
        chatId,
        continue: true,
        streaming: false,
        request: { requestBody: {}, maxTokens: 100 },
      }),
    ).rejects.toMatchObject({
      code: "MAX_CONTEXT_EXCEEDED",
    });
  });
});
