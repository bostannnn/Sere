import { describe, expect, it } from "vitest";

import { createMemoryHelpers } from "./helpers.cjs";

class MockLLMHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function createTestHelpers(llmOutput: string) {
  return createMemoryHelpers({
    toStringOrEmpty: (value: unknown) => (typeof value === "string" ? value.trim() : ""),
    stripThoughtBlocks: (value: unknown) =>
      String(value ?? "")
        .replace(/<Thoughts>[\s\S]*?<\/Thoughts>\s*/gi, "")
        .replace(/<think>[\s\S]*?<\/think>\s*/gi, "")
        .trim(),
    resolveMemorySettings: () => ({ summarizationModel: "subModel" }),
    resolveGenerateModelSelection: () => ({ provider: "stub-provider", model: "stub-model" }),
    normalizeProvider: () => "stub-provider",
    executeInternalLLMTextCompletion: async () => llmOutput,
    cleanSummaryOutput: (value: unknown) => String(value ?? ""),
    LLMHttpError: MockLLMHttpError,
  });
}

describe("memory helper summary output placeholder replacement", () => {
  it("replaces {{char}}/{{user}} and <char>/<user> using character and bound persona names", async () => {
    const helpers = createTestHelpers("{{char}} <char> <bot> {{user}} <user>");

    const result = await helpers.executeMemorySummaryFromMessages({
      settings: {
        username: "Fallback User",
        personas: [{ id: "persona-1", name: "Bound Persona" }],
      },
      character: { name: "Eva" },
      chat: { bindedPersona: "persona-1" },
      characterId: "char-test",
      chatId: "chat-test",
      promptMessages: [{ role: "user", content: "hello" }],
    });

    expect(result).toBe("Eva Eva Eva Bound Persona Bound Persona");
  });

  it("falls back to settings username when no bound persona is present", async () => {
    const helpers = createTestHelpers("{{char}} with {{user}}");

    const result = await helpers.executeMemorySummaryFromMessages({
      settings: { username: "Fallback User", personas: [] },
      character: { name: "Eva", nickname: "Evie" },
      chat: {},
      characterId: "char-test",
      chatId: "chat-test",
      promptMessages: [{ role: "user", content: "hello" }],
    });

    expect(result).toBe("Evie with Fallback User");
  });

  it("strips assistant thought blocks when converting stored messages for memory summarization", () => {
    const helpers = createTestHelpers("unused");

    const converted = helpers.convertStoredMessageForMemorySummary({
      role: "char",
      data: "<Thoughts>\nhidden\n</Thoughts>\nVisible reply",
      chatId: "m1",
      name: "Eva",
    });

    expect(converted).toEqual({
      role: "assistant",
      content: "Visible reply",
      memo: "m1",
      name: "Eva",
    });
  });
});
