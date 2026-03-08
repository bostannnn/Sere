import { describe, expect, it } from "vitest";

import { buildCharacterRagPayload, buildGlobalRagPayload } from "./ragPayload";

describe("rag payload builders", () => {
  it("serializes only character enablement and selected rulebooks", () => {
    const payload = buildCharacterRagPayload({
      enabled: true,
      enabledRulebooks: ["book-a", "book-b", 42, null],
      topK: 3,
      minScore: 0.2,
      budget: 800,
      model: "bgeLargeEnGPU",
    } as unknown as { enabled?: unknown; enabledRulebooks?: unknown; });

    expect(payload).toEqual({
      enabled: true,
      enabledRulebooks: ["book-a", "book-b"],
    });
  });

  it("serializes global retrieval tuning separately", () => {
    const payload = buildGlobalRagPayload({
      topK: 7,
      minScore: 0.6,
      budget: 1500,
      model: "bgeLargeEnGPU",
      enabledRulebooks: ["book-a"],
    } as unknown as { topK?: unknown; minScore?: unknown; budget?: unknown; model?: unknown; });

    expect(payload).toEqual({
      topK: 7,
      minScore: 0.6,
      budget: 1500,
      model: "bgeLargeEnGPU",
    });
  });

  it("returns undefined for missing rag config objects", () => {
    expect(buildCharacterRagPayload(undefined)).toBeUndefined();
    expect(buildGlobalRagPayload(undefined)).toBeUndefined();
  });
});
