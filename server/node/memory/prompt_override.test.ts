import { describe, expect, it } from "vitest";

import {
  applyPromptOverride,
  normalizePromptOverride,
  resolveManualPromptSource,
} from "./prompt_override.cjs";

describe("memory prompt override helpers", () => {
  it("normalizes non-object payload to null", () => {
    expect(normalizePromptOverride(null)).toBeNull();
    expect(normalizePromptOverride("x")).toBeNull();
    expect(normalizePromptOverride([])).toBeNull();
  });

  it("applies override onto character snapshot", () => {
    const character = {
      name: "A",
      memoryPromptOverride: {
        summarizationPrompt: "old",
      },
    };
    const next = applyPromptOverride(character, {
      summarizationPrompt: "new",
    });
    expect(next).toMatchObject({
      name: "A",
      memoryPromptOverride: {
        summarizationPrompt: "new",
      },
    });
  });

  it("resolves prompt source priority request > character > preset", () => {
    expect(
      resolveManualPromptSource(
        { summarizationPrompt: "  req  " },
        { memoryPromptOverride: { summarizationPrompt: "char" } },
      ),
    ).toBe("request_override");

    expect(
      resolveManualPromptSource(
        { summarizationPrompt: "" },
        { memoryPromptOverride: { summarizationPrompt: "char" } },
      ),
    ).toBe("character_override");

    expect(
      resolveManualPromptSource(
        { summarizationPrompt: "" },
        { memoryPromptOverride: { summarizationPrompt: "" } },
      ),
    ).toBe("preset_or_default");
  });
});
