import { describe, expect, it } from "vitest";

import { normalizeCharacterEvolutionExtractionModel } from "./characterEvolution";

describe("normalizeCharacterEvolutionExtractionModel", () => {
  it("strips the provider prefix when it matches the selected provider", () => {
    expect(
      normalizeCharacterEvolutionExtractionModel("openai", "openai/gpt-4.1-mini"),
    ).toBe("gpt-4.1-mini");
  });

  it("clears a stale foreign-provider prefix after provider changes", () => {
    expect(
      normalizeCharacterEvolutionExtractionModel("openai", "anthropic/claude-3.5-haiku"),
    ).toBe("");
  });
});
