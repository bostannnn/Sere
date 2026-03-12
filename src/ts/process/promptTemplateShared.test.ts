import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import * as promptTemplateShared from "./promptTemplateShared";

const require = createRequire(import.meta.url);
const promptTemplateSharedCjs = require("./promptTemplateShared.cjs");

const {
  MEMORY_PROMPT_TAG,
  hasTemplateRangeConfig,
  normalizeTemplateRange,
  renderPromptMemoryContent,
} = promptTemplateShared as {
  MEMORY_PROMPT_TAG: string;
  hasTemplateRangeConfig: (rangeStart?: number, rangeEnd?: number | "end") => boolean;
  normalizeTemplateRange: <T>(items: T[], rangeStart?: number, rangeEnd?: number | "end") => T[];
  renderPromptMemoryContent: (summaryItems: string[]) => string;
};

describe("promptTemplateShared", () => {
  it("normalizes negative template ranges from the end", () => {
    expect(normalizeTemplateRange(["a", "b", "c", "d"], -2, "end")).toEqual(["c", "d"]);
    expect(normalizeTemplateRange(["a", "b", "c", "d"], 0, -1)).toEqual(["a", "b", "c"]);
  });

  it("detects explicit range configuration", () => {
    expect(hasTemplateRangeConfig()).toBe(false);
    expect(hasTemplateRangeConfig(0, undefined)).toBe(true);
    expect(hasTemplateRangeConfig(undefined, "end")).toBe(true);
  });

  it("renders canonical memory XML with blank summaries removed", () => {
    expect(renderPromptMemoryContent(["Summary 1", " ", "", "Summary 2"])).toBe(
      `<${MEMORY_PROMPT_TAG}>\nSummary 1\n\nSummary 2\n</${MEMORY_PROMPT_TAG}>`,
    );
  });

  it("keeps the CJS server wrapper in parity with the browser implementation", () => {
    expect(promptTemplateSharedCjs.MEMORY_PROMPT_TAG).toBe(MEMORY_PROMPT_TAG);
    expect(promptTemplateSharedCjs.normalizeTemplateRange(["a", "b", "c"], -2, "end")).toEqual(
      normalizeTemplateRange(["a", "b", "c"], -2, "end"),
    );
    expect(promptTemplateSharedCjs.hasTemplateRangeConfig(undefined, "end")).toBe(
      hasTemplateRangeConfig(undefined, "end"),
    );
    expect(promptTemplateSharedCjs.renderPromptMemoryContent(["A", "", "B"])).toBe(
      renderPromptMemoryContent(["A", "", "B"]),
    );
  });
});
