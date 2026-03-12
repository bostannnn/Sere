import { beforeEach, describe, expect, it, vi } from "vitest";

const generateEmbeddingsMock = vi.hoisted(() => vi.fn());

vi.mock("../rag/embedding.cjs", () => ({
  generateEmbeddings: generateEmbeddingsMock,
}));

import {
  buildServerMemoryMessages,
  planPeriodicMemorySummarization,
  resolveMemorySettings,
} from "../memory/memory.cjs";

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
    memoryEnabled: true,
    maxContext: 8000,
    memoryPresetId: 0,
    memoryPresets: [
      {
        name: "Default",
        settings: {
          summarizationPrompt: "",
          doNotSummarizeUserMessage: false,
          periodicSummarizationInterval: 10,
          maxChatsPerSummary: 10,
          maxSelectedSummaries: 4,
          recentSummarySlots: 3,
          similarSummarySlots: 1,
          memoryTokensRatio: 0.2,
          recentMemoryRatio: 0.75,
          similarMemoryRatio: 0.25,
          ...overrides,
        },
      },
    ],
  };
}

describe("server memory controls", () => {
  beforeEach(() => {
    generateEmbeddingsMock.mockReset();
    generateEmbeddingsMock.mockResolvedValue([[1, 0, 0]]);
  });

  it("uses one effective setting for cadence and summary chunk size", () => {
    const settings = createSettings({
      periodicSummarizationInterval: 4,
      maxChatsPerSummary: 2,
    });

    const plan = planPeriodicMemorySummarization({
      character: { supaMemory: true },
      settings,
      chat: {
        message: [
          { role: "user", data: "u1", chatId: "m1" },
          { role: "char", data: "a1", chatId: "m2" },
          { role: "user", data: "u2", chatId: "m3" },
          { role: "char", data: "a2", chatId: "m4" },
        ],
        memoryData: {
          summaries: [],
          lastSummarizedMessageIndex: 0,
        },
      },
    });

    expect(plan.shouldRun).toBe(true);
    expect(plan.reason).toBe("ready");
    expect(plan.summarizable).toHaveLength(4);
    expect(plan.summarizable[0]?.content).toBe("u1");
    expect(plan.summarizable[3]?.content).toBe("a2");
  });

  it("uses maxSelectedSummaries instead of periodic interval for prompt injection", async () => {
    const settings = createSettings({
      periodicSummarizationInterval: 24,
      maxSelectedSummaries: 2,
      recentSummarySlots: 2,
      similarSummarySlots: 0,
      memoryTokensRatio: 1,
    });
    const chat = {
      message: [
        { role: "user", data: "latest topic", chatId: "live-1" },
      ],
      memoryData: {
        summaries: [
          { text: "Summary 1", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 2", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 3", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 4", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 5", isImportant: false, embedding: [1, 0, 0] },
        ],
        metrics: {
          lastImportantSummaries: [],
          lastRecentSummaries: [],
          lastSimilarSummaries: [],
          lastRandomSummaries: [],
        },
      },
    };

    const memory = await buildServerMemoryMessages({
      character: { supaMemory: true },
      settings,
      chat,
      maxMemoryTokens: 1000,
      maxPromptChars: 1000,
    });

    expect(memory).toHaveLength(1);
    const content = String(memory[0]?.content || "");
    expect(content).toContain("Summary 4");
    expect(content).toContain("Summary 5");
    expect(content).not.toContain("Summary 3");
    expect(chat.memoryData.metrics.lastRecentSummaries).toEqual([3, 4]);
  });

  it("exposes the full summary list for template range slicing even when prompt injection selects fewer summaries", async () => {
    const settings = createSettings({
      periodicSummarizationInterval: 24,
      maxSelectedSummaries: 2,
      recentSummarySlots: 2,
      similarSummarySlots: 0,
      memoryTokensRatio: 1,
    });
    const chat = {
      message: [
        { role: "user", data: "latest topic", chatId: "live-1" },
      ],
      memoryData: {
        summaries: [
          { text: "Summary 1", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 2", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 3", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 4", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 5", isImportant: false, embedding: [1, 0, 0] },
        ],
        metrics: {
          lastImportantSummaries: [],
          lastRecentSummaries: [],
          lastSimilarSummaries: [],
          lastRandomSummaries: [],
        },
      },
    };

    const memory = await buildServerMemoryMessages({
      character: { supaMemory: true },
      settings,
      chat,
      maxMemoryTokens: 1000,
      maxPromptChars: 1000,
    });

    expect(memory).toHaveLength(1);
    expect(memory[0]?.summaryItems).toEqual([
      "Summary 1",
      "Summary 2",
      "Summary 3",
      "Summary 4",
      "Summary 5",
    ]);
    const content = String(memory[0]?.content || "");
    expect(content).toContain("Summary 4");
    expect(content).toContain("Summary 5");
    expect(content).not.toContain("Summary 3");
  });

  it("keeps token-budget trimming after retrieval", async () => {
    const settings = createSettings({
      maxSelectedSummaries: 3,
      recentSummarySlots: 3,
      similarSummarySlots: 0,
      memoryTokensRatio: 1,
    });
    const chat = {
      message: [],
      memoryData: {
        summaries: [
          { text: "A".repeat(200), isImportant: false, embedding: [1, 0, 0] },
          { text: "B".repeat(200), isImportant: false, embedding: [1, 0, 0] },
          { text: "C".repeat(200), isImportant: false, embedding: [1, 0, 0] },
        ],
        metrics: {
          lastImportantSummaries: [],
          lastRecentSummaries: [],
          lastSimilarSummaries: [],
          lastRandomSummaries: [],
        },
      },
    };

    const memory = await buildServerMemoryMessages({
      character: { supaMemory: true },
      settings,
      chat,
      maxMemoryTokens: 60,
      maxPromptChars: 1000,
    });

    expect(memory).toHaveLength(1);
    const content = String(memory[0]?.content || "");
    const includedCount = [
      "A".repeat(200),
      "B".repeat(200),
      "C".repeat(200),
    ].filter((text) => content.includes(text)).length;
    expect(includedCount).toBe(1);
    const metrics = chat.memoryData.metrics;
    const totalMetricCount = [
      ...(metrics.lastRecentSummaries || []),
      ...(metrics.lastSimilarSummaries || []),
      ...(metrics.lastRandomSummaries || []),
    ].length;
    expect(totalMetricCount).toBe(1);
  });

  it("tracks recent and similar metrics separately", async () => {
    generateEmbeddingsMock.mockResolvedValue([[0, 1, 0]]);

    const settings = createSettings({
      maxSelectedSummaries: 2,
      recentSummarySlots: 1,
      similarSummarySlots: 1,
      memoryTokensRatio: 1,
    });
    const chat = {
      message: [
        { role: "user", data: "needle topic", chatId: "live-1" },
      ],
      memoryData: {
        summaries: [
          { text: "old unrelated", isImportant: false, embedding: [1, 0, 0] },
          { text: "recent related", isImportant: false, embedding: [0, 1, 0] },
        ],
        metrics: {
          lastImportantSummaries: [],
          lastRecentSummaries: [],
          lastSimilarSummaries: [],
          lastRandomSummaries: [],
        },
      },
    };

    await buildServerMemoryMessages({
      character: { supaMemory: true },
      settings,
      chat,
      maxMemoryTokens: 1000,
      maxPromptChars: 1000,
    });

    expect(chat.memoryData.metrics.lastRecentSummaries).toEqual([1]);
    expect(chat.memoryData.metrics.lastSimilarSummaries).toEqual([0]);
  });

  it("fills leftover prompt slots with recent summaries instead of random ones", async () => {
    generateEmbeddingsMock.mockResolvedValue([[0, 1, 0]]);

    const settings = createSettings({
      maxSelectedSummaries: 4,
      recentSummarySlots: 1,
      similarSummarySlots: 1,
      memoryTokensRatio: 1,
    });
    const chat = {
      message: [
        { role: "user", data: "needle topic", chatId: "live-1" },
      ],
      memoryData: {
        summaries: [
          { text: "older unrelated", isImportant: false, embedding: [1, 0, 0] },
          { text: "middle related", isImportant: false, embedding: [0, 1, 0] },
          { text: "recent one", isImportant: false, embedding: [1, 0, 0] },
          { text: "recent two", isImportant: false, embedding: [1, 0, 0] },
        ],
        metrics: {
          lastImportantSummaries: [],
          lastRecentSummaries: [],
          lastSimilarSummaries: [],
          lastRandomSummaries: [],
        },
      },
    };

    const memory = await buildServerMemoryMessages({
      character: { supaMemory: true },
      settings,
      chat,
      maxMemoryTokens: 1000,
      maxPromptChars: 1000,
    });

    const content = String(memory[0]?.content || "");
    expect(content).toContain("middle related");
    expect(content).toContain("recent one");
    expect(content).toContain("recent two");
    expect(chat.memoryData.metrics.lastRecentSummaries).toEqual([1, 2, 3]);
    expect(chat.memoryData.metrics.lastSimilarSummaries).toEqual([0]);
    expect(chat.memoryData.metrics.lastRandomSummaries).toEqual([]);
  });

  it("resolves new summary controls from presets", () => {
    const settings = createSettings({
      periodicSummarizationInterval: 24,
      maxChatsPerSummary: 18,
      maxSelectedSummaries: 3,
      recentSummarySlots: 2,
      similarSummarySlots: 1,
    });

    const resolved = resolveMemorySettings(settings, { supaMemory: true });

    expect(resolved.periodicSummarizationInterval).toBe(24);
    expect(resolved.maxChatsPerSummary).toBe(24);
    expect(resolved.maxSelectedSummaries).toBe(3);
    expect(resolved.recentSummarySlots).toBe(2);
    expect(resolved.similarSummarySlots).toBe(1);
  });

  it("derives slot counts from legacy ratios when explicit slots are missing", async () => {
    const settings = createSettings({
      maxSelectedSummaries: 4,
      recentMemoryRatio: 0.5,
      similarMemoryRatio: 0.25,
      memoryTokensRatio: 1,
    });
    delete settings.memoryPresets[0].settings.recentSummarySlots;
    delete settings.memoryPresets[0].settings.similarSummarySlots;
    const chat = {
      message: [],
      memoryData: {
        summaries: [
          { text: "Summary 1", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 2", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 3", isImportant: false, embedding: [1, 0, 0] },
          { text: "Summary 4", isImportant: false, embedding: [1, 0, 0] },
        ],
        metrics: {
          lastImportantSummaries: [],
          lastRecentSummaries: [],
          lastSimilarSummaries: [],
          lastRandomSummaries: [],
        },
      },
    };

    await buildServerMemoryMessages({
      character: { supaMemory: true },
      settings,
      chat,
      maxMemoryTokens: 1000,
      maxPromptChars: 1000,
    });

    expect(chat.memoryData.metrics.lastRecentSummaries).toEqual([0, 1, 2, 3]);
    expect(chat.memoryData.metrics.lastSimilarSummaries).toEqual([]);
  });
});
