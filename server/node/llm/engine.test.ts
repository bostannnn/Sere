import { describe, expect, it } from "vitest";

describe("server llm rag assembly helpers", () => {
  it("builds a retrieval query from user turns only", async () => {
    const { __test } = await import("./engine.cjs");

    const query = __test.buildUserOnlyRagQuery([
      { role: "user", content: "Core vampire rules about hunger and feeding." },
      { role: "assistant", content: "Use the invented blood surge ladder." },
      { role: "user", content: "What causes frenzy?" },
    ]);

    expect(query).toContain("Core vampire rules about hunger and feeding.");
    expect(query).toContain("What causes frenzy?");
    expect(query).not.toContain("invented blood surge ladder");
  });

  it("applies the configured rag budget before prompt injection", async () => {
    const { __test } = await import("./engine.cjs");

    const results = [
      {
        chunk: {
          content: "A".repeat(220),
          metadata: { source_file: "Core Book", system: "VtM", edition: "5e", page: 10 },
        },
      },
      {
        chunk: {
          content: "B".repeat(220),
          metadata: { source_file: "Core Book", system: "VtM", edition: "5e", page: 11 },
        },
      },
    ];

    const kept = __test.applyRagBudget(results, 90);

    expect(kept).toHaveLength(1);
    expect(__test.buildRuleContextBlock(kept[0])).toContain("[Source: VtM - Core Book (5e), p. 10]");
  });

  it("trims an oversized first result to fit within the budget", async () => {
    const { __test } = await import("./engine.cjs");

    const results = [
      {
        chunk: {
          content: "Sentence one. ".repeat(120),
          metadata: { source_file: "Core Book", system: "VtM", edition: "5e", page: 22 },
        },
      },
    ];

    const kept = __test.applyRagBudget(results, 90);

    expect(kept).toHaveLength(1);
    expect(kept[0].chunk.content.length).toBeLessThan(results[0].chunk.content.length);
    expect(kept[0].chunk.content).toContain("[Context truncated to fit budget]");
  });
});
