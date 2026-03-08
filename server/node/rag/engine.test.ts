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

  it("prefers instructional setup chunks for learn-to-play queries", async () => {
    const { __test } = await import("./engine.cjs");

    const query = "Tell me what is needed to play a thousand year old vampire?";
    const introChunk = {
      content: [
        "Playing the Game",
        "To play Thousand Year Old Vampire, you answer a series of Prompts.",
        "Once you have finished creating your vampire, they will have three Skills, three Resources, at least three Mortals, one Immortal, and one Experience in each of their five Memories.",
      ].join("\n"),
    };
    const noisyPromptChunk = {
      content: [
        "HUNTERS",
        "119. A group of self-described vampire hunters invade your home while they presume you asleep.",
        "What other trick is up their sleeve? How do you escape? Check a Skill. Lose a Resource.",
      ].join("\n"),
    };

    const introScore = __test.scoreChunkForQuery(query, introChunk, 0.76, 0);
    const noisyScore = __test.scoreChunkForQuery(query, noisyPromptChunk, 0.82, 0);

    expect(introScore).toBeGreaterThan(noisyScore);
  });

  it("penalizes appendix and interview chunks for setup-style queries", async () => {
    const { __test } = await import("./engine.cjs");

    const query = "What do I need to play Thousand Year Old Vampire?";
    const appendixChunk = {
      content: [
        "Appendix Five",
        "Suggestions for Group Play",
        "TH : I am a quick player.",
        "SH : Do you foresee this as something players compare notes about?",
      ].join("\n"),
    };

    expect(__test.computeIntentAdjustment(query, appendixChunk.content)).toBeLessThan(0);
  });
});
