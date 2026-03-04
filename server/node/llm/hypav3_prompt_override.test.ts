import { describe, expect, it } from "vitest";

import {
  applyPromptOverride,
  normalizePromptOverride,
  resolveManualPromptSource,
} from "./hypav3_prompt_override.cjs";

describe("hypav3 prompt override helpers", () => {
  it("normalizes non-object payload to null", () => {
    expect(normalizePromptOverride(null)).toBeNull();
    expect(normalizePromptOverride("x")).toBeNull();
    expect(normalizePromptOverride([])).toBeNull();
  });

  it("applies override onto character snapshot", () => {
    const character = {
      name: "A",
      hypaV3PromptOverride: {
        summarizationPrompt: "old",
        reSummarizationPrompt: "old2",
      },
    };
    const next = applyPromptOverride(character, {
      summarizationPrompt: "new",
      reSummarizationPrompt: "new2",
    });
    expect(next).toMatchObject({
      name: "A",
      hypaV3PromptOverride: {
        summarizationPrompt: "new",
        reSummarizationPrompt: "new2",
      },
    });
  });

  it("resolves prompt source priority request > character > preset", () => {
    expect(
      resolveManualPromptSource(
        { summarizationPrompt: "  req  ", reSummarizationPrompt: "" },
        { hypaV3PromptOverride: { summarizationPrompt: "char" } },
      ),
    ).toBe("request_override");

    expect(
      resolveManualPromptSource(
        { summarizationPrompt: "", reSummarizationPrompt: "" },
        { hypaV3PromptOverride: { summarizationPrompt: "char" } },
      ),
    ).toBe("character_override");

    expect(
      resolveManualPromptSource(
        { summarizationPrompt: "", reSummarizationPrompt: "" },
        { hypaV3PromptOverride: { summarizationPrompt: "" } },
      ),
    ).toBe("preset_or_default");
  });
});
