import { describe, expect, it } from "vitest";

import { buildMessagesFromPromptTemplate } from "./prompt.cjs";

describe("server prompt template slots", () => {
  it("emits rulebook and game state slot markers without inserting placeholder messages", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {
        name: "Chronicle Bot",
      },
      {
        message: [{ role: "user", data: "What is needed to play?" }],
      },
      {
        promptTemplate: [
          { type: "plain", type2: "main", role: "system", text: "Main prompt." },
          { type: "rulebookRag" },
          { type: "gameState" },
          { type: "chat", rangeStart: 0, rangeEnd: "end" },
        ],
      },
      {
        userMessage: "What is needed to play?",
      },
    );

    expect(assembled?.messages).toHaveLength(2);
    expect(assembled?.messages?.[0]).toMatchObject({ role: "system", content: "Main prompt." });
    expect(assembled?.messages?.[1]).toMatchObject({ role: "user", content: "What is needed to play?" });

    const promptBlocks = assembled?.promptBlocks ?? [];
    const ragSlot = promptBlocks.find((block: Record<string, unknown>) => block.slot === "rulebookRag");
    const gameStateSlot = promptBlocks.find((block: Record<string, unknown>) => block.slot === "gameState");

    expect(ragSlot).toMatchObject({
      index: 1,
      role: "system",
      title: "Rulebook RAG",
      source: "template-slot",
      slot: "rulebookRag",
    });
    expect(gameStateSlot).toMatchObject({
      index: 1,
      role: "system",
      title: "Game State",
      source: "template-slot",
      slot: "gameState",
    });
  });
});
