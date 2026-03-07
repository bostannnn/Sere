import { describe, expect, it } from "vitest";

import { createHypaHelpers } from "./hypa_helpers.cjs";

class MockLLMHttpError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function createHelpers() {
  return createHypaHelpers({
    toStringOrEmpty: (value: unknown) => (typeof value === "string" ? value.trim() : ""),
    resolveHypaV3Settings: () => ({ summarizationModel: "subModel" }),
    resolveGenerateModelSelection: () => ({ provider: "stub-provider", model: "stub-model" }),
    normalizeProvider: () => "stub-provider",
    executeInternalLLMTextCompletion: async () => "stub",
    cleanSummaryOutput: (value: unknown) => (typeof value === "string" ? value : ""),
    LLMHttpError: MockLLMHttpError,
  });
}

describe("hypa helpers prompt var mapping", () => {
  it("resolves {{char}}/{{user}} in summarization prompt template", () => {
    const { buildHypaSummarizationPromptMessages } = createHelpers();
    const messages = [{ role: "user", content: "hello" }];
    const promptMessages = buildHypaSummarizationPromptMessages(
      messages,
      "Narrate {{char}} and {{user}}.",
      false,
      {
        character: { name: "Eva", nickname: "" },
        settings: { username: "Andrew" },
        chat: {},
      },
    );

    expect(promptMessages).toEqual([
      { role: "user", content: "user: hello" },
      { role: "system", content: "Narrate Eva and Andrew." },
    ]);
  });

  it("prefers bound persona name over settings.username for {{user}}", () => {
    const { buildHypaSummarizationPromptMessages } = createHelpers();
    const messages = [{ role: "assistant", content: "hi" }];
    const promptMessages = buildHypaSummarizationPromptMessages(
      messages,
      "{{char}} remembers {{user}}",
      false,
      {
        character: { name: "Eva" },
        settings: {
          username: "FallbackUser",
          personas: [{ id: "persona-1", name: "Bound Persona" }],
        },
        chat: { bindedPersona: "persona-1" },
      },
    );
    expect(promptMessages?.[1]?.content).toBe("Eva remembers Bound Persona");
  });
});
