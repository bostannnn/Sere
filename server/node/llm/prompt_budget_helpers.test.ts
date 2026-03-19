import { describe, expect, it } from "vitest";

import {
  getOldestChatMessageIndex,
  normalizeMaxContextTokens,
  removePromptMessageAtIndex,
  trimPromptMessagesToContext,
} from "./prompt_budget_helpers.cjs";

class TestLLMHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

describe("prompt_budget_helpers", () => {
  it("normalizes max context tokens with request precedence and minimum floor", () => {
    expect(
      normalizeMaxContextTokens(
        { maxContext: "128", request: { maxContext: "600.9" } },
        { maxContext: 1024 },
      ),
    ).toBe(256);

    expect(
      normalizeMaxContextTokens(
        { request: { maxContext: "600.9" } },
        { maxContext: 1024 },
      ),
    ).toBe(600);

    expect(normalizeMaxContextTokens({}, { maxContext: "900" })).toBe(900);
    expect(normalizeMaxContextTokens({}, {})).toBe(0);
  });

  it("finds and removes the oldest chat message while keeping prompt block indexes aligned", () => {
    const messages = [
      { role: "system", content: "system" },
      { role: "user", content: "oldest" },
      { role: "assistant", content: "middle" },
      { role: "user", content: "newest" },
    ];
    const promptBlocks = [
      { index: 0, source: "template", title: "main" },
      { index: 1, source: "chat", title: "history" },
      { index: 2, source: "chat", title: "history" },
      { index: 3, source: "chat", title: "history" },
      { index: 9, source: "chat", title: "ignored" },
    ];

    expect(getOldestChatMessageIndex(promptBlocks, messages.length)).toBe(1);

    removePromptMessageAtIndex(messages, promptBlocks, 1);

    expect(messages.map((message) => message.content)).toEqual([
      "system",
      "middle",
      "newest",
    ]);
    expect(promptBlocks.map((block) => [block.index, block.source])).toEqual([
      [0, "template"],
      [1, "chat"],
      [2, "chat"],
      [8, "chat"],
    ]);
  });

  it("fails fast when required injected dependencies are missing", async () => {
    await expect(
      trimPromptMessagesToContext(
        [],
        [],
        1,
        {},
      ),
    ).resolves.toBe(0);

    await expect(
      trimPromptMessagesToContext(
        [{ role: "user", content: "x" }],
        [],
        1,
        {},
      ),
    ).rejects.toThrow(
      "trimPromptMessagesToContext requires options.estimatePromptTokens.",
    );

    await expect(
      trimPromptMessagesToContext(
        [{ role: "user", content: "x" }],
        [],
        1,
        { estimatePromptTokens: () => 1 },
      ),
    ).rejects.toThrow(
      "trimPromptMessagesToContext requires options.LLMHttpError.",
    );
  });

  it("trims chat history to fit budget and preserves the no-removable-history error message", async () => {
    const messages = [
      { role: "system", content: "system" },
      { role: "user", content: "old1" },
      { role: "assistant", content: "old2" },
      { role: "user", content: "newest" },
    ];
    const promptBlocks = [
      { index: 0, role: "system", source: "template" },
      { index: 1, role: "user", source: "chat" },
      { index: 2, role: "assistant", source: "chat" },
      { index: 3, role: "user", source: "chat" },
    ];

    const costs: Record<string, number> = {
      system: 60,
      old1: 120,
      old2: 120,
      newest: 120,
      "system-only": 320,
    };
    const estimatePromptTokens = (rows: Array<Record<string, unknown>>) => rows.reduce((sum, row) => {
      const key = String(row.content || "");
      return sum + (costs[key] || 0);
    }, 0);

    const remainingTokens = await trimPromptMessagesToContext(
      messages,
      promptBlocks,
      180,
      {
        estimatePromptTokens,
        LLMHttpError: TestLLMHttpError,
        maxContextTokens: 260,
        reservedOutputTokens: 80,
      },
    );

    expect(remainingTokens).toBe(180);
    expect(messages.map((message) => message.content)).toEqual(["system", "newest"]);
    expect(promptBlocks.map((block) => [block.index, block.source])).toEqual([
      [0, "template"],
      [1, "chat"],
    ]);

    await expect(
      trimPromptMessagesToContext(
        [{ role: "system", content: "system-only" }],
        [{ index: 0, role: "system", source: "template" }],
        200,
        {
          estimatePromptTokens,
          LLMHttpError: TestLLMHttpError,
          maxContextTokens: 300,
          reservedOutputTokens: 100,
        },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: "MAX_CONTEXT_EXCEEDED",
      message:
        "Input token count (320) exceeds allowed prompt budget (200) within max context size (300) after reserving 100 output tokens, but no removable chat history remains.",
    });
  });
});
