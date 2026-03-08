import { describe, expect, it } from "vitest";

describe("server rag engine", () => {
  it("keeps short structured rule blocks during chunking", async () => {
    const { chunkText } = await import("./engine.cjs");

    const text = [
      "Combat Sequence",
      "",
      "1. Roll initiative",
      "2. Take turns in order",
      "3. Resolve the effect",
    ].join("\n");

    const chunks = chunkText(text, "rules.pdf", 12);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain("Combat Sequence");
    expect(chunks[0]?.content).toContain("1. Roll initiative");
  });

  it("does not expand complete chunks with low-signal neighbors", async () => {
    const { __test } = await import("./engine.cjs");

    const result = {
      index: 1,
      chunk: {
        id: "mid",
        content: "This rule text is already complete.",
        metadata: { page: 4, source_file: "rules.pdf" },
      },
      score: 0.92,
    };
    const allChunks = [
      { id: "prev", content: "12", metadata: { page: 4, source_file: "rules.pdf" } },
      { id: "mid", content: "This rule text is already complete.", metadata: { page: 4, source_file: "rules.pdf" } },
      { id: "next", content: "A", metadata: { page: 4, source_file: "rules.pdf" } },
    ];

    const expanded = __test.expandAndFormat(result, allChunks);

    expect(expanded.chunk.content).toBe("This rule text is already complete.");
  });

  it("keeps overlap between oversized semantic chunks", async () => {
    const { __test } = await import("./engine.cjs");

    const block = `${"The prince decrees silence in elysium and enforces the rule with harsh penalties. ".repeat(18)}`.trim();
    const parts = __test.splitIntoSemanticBlocks(block, 450, 850);

    expect(parts.length).toBeGreaterThan(1);
    const firstTail = parts[0].slice(-120).trim();
    const secondHead = parts[1].slice(0, 120).trim();
    expect(secondHead.length).toBeGreaterThan(0);
    expect(firstTail.includes(secondHead.slice(0, 40)) || secondHead.includes(firstTail.slice(-40))).toBe(true);
  });
});
