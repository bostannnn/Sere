import { describe, expect, it } from "vitest";
import { estimateTextTokens } from "./tokenizer.cjs";

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

  it("does not leak oversized content through very small budgets", async () => {
    const { __test } = await import("./engine.cjs");

    const results = [
      {
        chunk: {
          content: "Sentence one. ".repeat(120),
          metadata: { source_file: "Core Book", system: "VtM", edition: "5e", page: 22 },
        },
      },
    ];

    const budget = 20;
    const kept = __test.applyRagBudget(results, budget);

    if (kept.length === 0) {
        expect(kept).toEqual([]);
        return;
    }

    const totalTokens = estimateTextTokens(`<Rules Context>\n${__test.buildRuleContextBlock(kept[0])}</Rules Context>\n`);
    expect(totalTokens).toBeLessThanOrEqual(budget);
  });

  it("uses only character enablement and selected rulebooks while keeping tuning global", async () => {
    const { __test } = await import("./engine.cjs");

    const effective = __test.resolveEffectiveRagSettings(
      {
        enabled: true,
        enabledRulebooks: ["book-a"],
        topK: 3,
        minScore: 0.2,
        budget: 800,
        model: "bgeLargeEnGPU",
      },
      {
        enabled: false,
        topK: 7,
        minScore: 0.6,
        budget: 1500,
        model: "MiniLM",
      },
    );

    expect(effective).toMatchObject({
      enabled: true,
      enabledRulebooks: ["book-a"],
      topK: 7,
      minScore: 0.6,
      budget: 1500,
      model: "MiniLM",
    });
  });

  it("injects rulebook context into a template slot instead of prepending it", async () => {
    const { __test } = await import("./engine.cjs");

    const messages = [
      { role: "system", content: "Main prompt." },
      { role: "user", content: "Tell me what is needed to play." },
    ];
    const promptBlocks = [
      { index: 0, role: "system", title: "Main Prompt", source: "template" },
      { index: 1, role: "system", title: "Rulebook RAG", source: "template-slot", slot: "rulebookRag" },
      { index: 1, role: "user", title: "Chat History", source: "chat" },
    ];

    __test.injectServerContexts(
      messages,
      promptBlocks,
      "<Rules Context>\n[Source: TYOV, p. 12]\nPlay the game.\n</Rules Context>\n",
      "",
    );

    expect(messages[0]?.content).toBe("Main prompt.");
    expect(messages[1]?.content).toContain("<Rules Context>");
    expect(messages[2]?.content).toBe("Tell me what is needed to play.");

    const ragBlock = promptBlocks.find((block: Record<string, unknown>) => block.title === "Rulebook RAG");
    expect(ragBlock).toMatchObject({
      index: 1,
      role: "system",
      source: "server-rag",
    });
    expect(promptBlocks.some((block: Record<string, unknown>) => block.mergedInto === "first-system")).toBe(false);
  });

  it("does not hard-prepend rag when a prompt template is active but no rulebook slot exists", async () => {
    const { __test } = await import("./engine.cjs");

    const messages = [
      { role: "system", content: "Main prompt." },
      { role: "user", content: "Tell me what is needed to play." },
    ];
    const promptBlocks = [
      { index: 0, role: "system", title: "Main Prompt", source: "template" },
      { index: 1, role: "user", title: "Chat History", source: "chat" },
    ];

    __test.injectServerContexts(
      messages,
      promptBlocks,
      "<Rules Context>\n[Source: TYOV, p. 12]\nPlay the game.\n</Rules Context>\n",
      "",
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.content).toBe("Main prompt.");
    expect(messages[0]?.content).not.toContain("<Rules Context>");

    const skippedRag = promptBlocks.find((block: Record<string, unknown>) => block.title === "Rulebook RAG" && block.skipped === true);
    expect(skippedRag).toMatchObject({
      source: "server-rag",
      skipped: true,
      reason: "no_template_slot",
    });
    expect(promptBlocks.some((block: Record<string, unknown>) => block.mergedInto === "first-system")).toBe(false);
  });

  it("injects game state into its own template slot and skips fallback prepend", async () => {
    const { __test } = await import("./engine.cjs");

    const messages = [
      { role: "system", content: "Main prompt." },
      { role: "user", content: "Continue the scene." },
    ];
    const promptBlocks = [
      { index: 0, role: "system", title: "Main Prompt", source: "template" },
      { index: 1, role: "system", title: "Game State", source: "template-slot", slot: "gameState" },
      { index: 1, role: "user", title: "Chat History", source: "chat" },
    ];

    __test.injectServerContexts(
      messages,
      promptBlocks,
      "",
      "[Active Game State]\n[candles: 6]\n[brink: The radio goes silent]\n",
    );

    expect(messages).toHaveLength(3);
    expect(messages[0]?.content).toBe("Main prompt.");
    expect(messages[1]?.content).toContain("[Active Game State]");
    expect(messages[2]?.content).toBe("Continue the scene.");

    const gameStateBlock = promptBlocks.find((block: Record<string, unknown>) => block.title === "Game State");
    expect(gameStateBlock).toMatchObject({
      index: 1,
      role: "system",
      source: "server-gamestate",
    });
    expect(promptBlocks.some((block: Record<string, unknown>) => block.mergedInto === "first-system")).toBe(false);
  });
});
