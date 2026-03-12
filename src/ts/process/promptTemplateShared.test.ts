import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import * as promptTemplateShared from "./promptTemplateShared";

const require = createRequire(import.meta.url);
const promptTemplateSharedCjs = require("./promptTemplateShared.cjs");

const {
  MEMORY_MESSAGE_MEMO,
  MEMORY_PROMPT_TAG,
  hasTemplateRangeConfig,
  normalizeTemplateRange,
  renderPromptMemoryContent,
  resolveMemoryTemplateMessages,
} = promptTemplateShared as {
  MEMORY_MESSAGE_MEMO: string;
  MEMORY_PROMPT_TAG: string;
  hasTemplateRangeConfig: (rangeStart?: number, rangeEnd?: number | "end") => boolean;
  normalizeTemplateRange: <T>(items: T[], rangeStart?: number, rangeEnd?: number | "end") => T[];
  renderPromptMemoryContent: (summaryItems: string[]) => string;
  resolveMemoryTemplateMessages: (
    sourceMessages: Array<Record<string, unknown>>,
    summaryItems?: string[],
    rangeStart?: number,
    rangeEnd?: number | "end",
  ) => { messages: Array<Record<string, unknown>>; skippedReason?: string };
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

  it("resolves template memory ranges through one canonical helper", () => {
    expect(
      resolveMemoryTemplateMessages(
        [{ role: "system", content: "Original memory block", memo: "old" }],
        ["Summary 1", "Summary 2", "Summary 3"],
        1,
        "end",
      ),
    ).toEqual({
      messages: [
        {
          role: "system",
          content: `<${MEMORY_PROMPT_TAG}>\nSummary 2\n\nSummary 3\n</${MEMORY_PROMPT_TAG}>`,
          memo: MEMORY_MESSAGE_MEMO,
        },
      ],
    });
    expect(
      resolveMemoryTemplateMessages(
        [{ role: "system", content: "Original memory block" }],
        ["Summary 1"],
        4,
        "end",
      ),
    ).toEqual({
      messages: [],
      skippedReason: "memory_range_empty",
    });
  });

  it("keeps the CJS server wrapper in parity with the browser implementation", () => {
    expect(promptTemplateSharedCjs.MEMORY_MESSAGE_MEMO).toBe(MEMORY_MESSAGE_MEMO);
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
    expect(
      promptTemplateSharedCjs.resolveMemoryTemplateMessages(
        [{ role: "system", content: "Combined" }],
        ["A", "B"],
        -1,
        "end",
      ),
    ).toEqual(
      resolveMemoryTemplateMessages(
        [{ role: "system", content: "Combined" }],
        ["A", "B"],
        -1,
        "end",
      ),
    );
  });
});
