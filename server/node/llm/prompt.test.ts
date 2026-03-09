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

  it("renders characterState blocks from current evolution state when enabled", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {
        name: "Chronicle Bot",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: false,
          currentState: {
            relationship: {
              trustLevel: "high",
              dynamic: "warm and teasing",
            },
          },
          sectionConfigs: [
            {
              key: "relationship",
              label: "Relationship",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track relationship",
              kind: "object",
              sensitive: false,
            },
          ],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
      },
      {
        message: [{ role: "user", data: "hello" }],
      },
      {
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "model",
          extractionPrompt: "prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
        promptTemplate: [
          { type: "plain", type2: "main", role: "system", text: "Main prompt." },
          { type: "characterState", innerFormat: "{{slot}}" },
          { type: "chat", rangeStart: 0, rangeEnd: "end" },
        ],
      },
      {
        userMessage: "hello",
      },
    );

    expect(assembled?.messages?.some((entry: Record<string, unknown>) => String(entry.content || "").includes("Trust level: high"))).toBe(true);
    expect(assembled?.promptBlocks?.some((entry: Record<string, unknown>) => entry.title === "Character State")).toBe(true);
  });
});
