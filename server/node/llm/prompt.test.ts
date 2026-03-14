import { describe, expect, it } from "vitest";

import { buildGeneratePromptMessages, buildMessagesFromPromptTemplate } from "./prompt.cjs";

function createMemoryBuilder(summaryItems: string[], content?: string) {
  const renderedContent = content ?? `<Past Events Summary>\n${summaryItems.join("\n\n")}\n</Past Events Summary>`;
  return async () => [
    {
      role: "system",
      content: renderedContent,
      memo: "memory",
      summaryItems,
    },
  ];
}

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
          extractionMaxTokens: 2400,
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
          extractionMaxTokens: 2400,
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

  it("uses global prompt projection policy for characterState rendering", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {
        name: "Chronicle Bot",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: false,
          extractionMaxTokens: 2400,
          currentState: {
            userFacts: [
              { value: "Newest weak fact", confidence: "suspected", status: "active", lastSeenAt: 500, updatedAt: 500, timesSeen: 1 },
              { value: "Older confirmed fact", confidence: "confirmed", status: "active", lastSeenAt: 100, updatedAt: 100, timesSeen: 3 },
            ],
          },
          sectionConfigs: [
            {
              key: "userFacts",
              label: "User Facts",
              enabled: true,
              includeInPrompt: true,
              instruction: "Track user facts",
              kind: "list",
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
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          promptProjection: {
            rankings: {
              fast: ["lastSeenAt", "updatedAt", "timesSeen", "confidence"],
              medium: ["lastSeenAt", "timesSeen", "confidence", "updatedAt"],
              slow: ["lastSeenAt", "confidence", "timesSeen", "updatedAt"],
            },
            limits: {
              generation: {
                activeThreads: 2,
                runningJokes: 2,
                characterLikes: 3,
                characterDislikes: 3,
                characterHabits: 2,
                characterBoundariesPreferences: 2,
                userFacts: 1,
                userRead: 3,
                userLikes: 2,
                userDislikes: 2,
                keyMoments: 2,
                characterIntimatePreferences: 3,
                userIntimatePreferences: 3,
              },
              extraction: {
                activeThreads: 3,
                runningJokes: 3,
                characterLikes: 4,
                characterDislikes: 4,
                characterHabits: 3,
                characterBoundariesPreferences: 3,
                userFacts: 6,
                userRead: 4,
                userLikes: 3,
                userDislikes: 3,
                keyMoments: 3,
                characterIntimatePreferences: 4,
                userIntimatePreferences: 4,
              },
            },
          },
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
        promptTemplate: [
          { type: "characterState", innerFormat: "{{slot}}" },
        ],
      },
      {
        userMessage: "hello",
      },
    );

    const contents = (assembled?.messages ?? []).map((entry: Record<string, unknown>) => String(entry.content || ""));
    expect(contents.some((content) => content.includes("Newest weak fact"))).toBe(true);
    expect(contents.some((content) => content.includes("Older confirmed fact"))).toBe(false);
  });

  it("renders description and characterState through the template-only path", async () => {
    const assembled = await buildGeneratePromptMessages({
      character: {
        name: "Chronicle Bot",
        desc: "A careful archivist.",
        personality: "Dry wit.",
        characterEvolution: {
          enabled: true,
          useGlobalDefaults: false,
          extractionMaxTokens: 2400,
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
      chat: {
        message: [{ role: "user", data: "hello" }],
      },
      settings: {
        characterEvolutionDefaults: {
          extractionProvider: "openrouter",
          extractionModel: "model",
          extractionMaxTokens: 2400,
          extractionPrompt: "prompt",
          sectionConfigs: [],
          privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
          },
        },
        promptTemplate: [
          { type: "plain", type2: "main", role: "system", text: "Main prompt." },
          { type: "description" },
          { type: "characterState", innerFormat: "{{slot}}" },
          { type: "chat", rangeStart: 0, rangeEnd: "end" },
          { type: "plain", type2: "globalNote", role: "system", text: "Global note." },
        ],
      },
      userMessage: "hello",
    });

    const promptBlocks = assembled?.promptBlocks ?? [];
    expect(promptBlocks.some((entry: Record<string, unknown>) => entry.title === "Description")).toBe(true);
    expect(promptBlocks.some((entry: Record<string, unknown>) => entry.title === "Character State")).toBe(true);
    expect(assembled?.messages?.some((entry: Record<string, unknown>) => String(entry.content || "").includes("A careful archivist."))).toBe(true);
    expect(assembled?.messages?.some((entry: Record<string, unknown>) => String(entry.content || "").includes("Trust level: high"))).toBe(true);
  });
  it("keeps slot-only templates message-free", async () => {
    const assembled = await buildGeneratePromptMessages({
      character: {
        name: "Chronicle Bot",
      },
      chat: {
        message: [{ role: "user", data: "hello" }],
      },
      settings: {
        promptTemplate: [
          { type: "rulebookRag", innerFormat: "{{slot}}" },
        ],
      },
      userMessage: "hello",
    });

    expect(assembled?.messages).toEqual([]);
    expect(assembled?.promptBlocks).toEqual([
      expect.objectContaining({
        title: "Rulebook RAG",
        source: "template-slot",
        slot: "rulebookRag",
      }),
    ]);
  });
});

describe("server prompt memory ranges", () => {
  it("supports positive memory ranges", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {},
      {},
      {
        promptTemplate: [
          { type: "memory", innerFormat: "{{slot}}", rangeStart: 1, rangeEnd: 3 },
        ],
      },
      {
        buildServerMemoryMessages: createMemoryBuilder(["Summary 1", "Summary 2", "Summary 3", "Summary 4"]),
      },
    );

    const content = String(assembled?.messages?.[0]?.content || "");
    expect(content).toContain("Summary 2");
    expect(content).toContain("Summary 3");
    expect(content).not.toContain("Summary 1");
    expect(content).not.toContain("Summary 4");
  });

  it("supports negative memory ranges from the end", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {},
      {},
      {
        promptTemplate: [
          { type: "memory", innerFormat: "{{slot}}", rangeStart: 0, rangeEnd: -2 },
        ],
      },
      {
        buildServerMemoryMessages: createMemoryBuilder(["Summary 1", "Summary 2", "Summary 3", "Summary 4"]),
      },
    );

    const content = String(assembled?.messages?.[0]?.content || "");
    expect(content).toContain("Summary 1");
    expect(content).toContain("Summary 2");
    expect(content).not.toContain("Summary 3");
    expect(content).not.toContain("Summary 4");
  });

  it("supports bounded negative memory ranges from the end", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {},
      {},
      {
        promptTemplate: [
          { type: "memory", innerFormat: "{{slot}}", rangeStart: -5, rangeEnd: -2 },
        ],
      },
      {
        buildServerMemoryMessages: createMemoryBuilder(["Summary 1", "Summary 2", "Summary 3", "Summary 4", "Summary 5"]),
      },
    );

    const content = String(assembled?.messages?.[0]?.content || "");
    expect(content).toContain("Summary 1");
    expect(content).toContain("Summary 2");
    expect(content).toContain("Summary 3");
    expect(content).not.toContain("Summary 4");
    expect(content).not.toContain("Summary 5");
  });

  it("supports memory range end markers", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {},
      {},
      {
        promptTemplate: [
          { type: "memory", innerFormat: "{{slot}}", rangeStart: -2, rangeEnd: "end" },
        ],
      },
      {
        buildServerMemoryMessages: createMemoryBuilder(["Summary 1", "Summary 2", "Summary 3", "Summary 4"]),
      },
    );

    const content = String(assembled?.messages?.[0]?.content || "");
    expect(content).toContain("Summary 3");
    expect(content).toContain("Summary 4");
    expect(content).not.toContain("Summary 1");
    expect(content).not.toContain("Summary 2");
  });

  it("skips memory blocks when the configured range is empty", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {},
      {},
      {
        promptTemplate: [
          { type: "memory", innerFormat: "{{slot}}", rangeStart: 10, rangeEnd: "end" },
          { type: "chat", rangeStart: 0, rangeEnd: "end" },
        ],
      },
      {
        userMessage: "hello",
        buildServerMemoryMessages: createMemoryBuilder(["Summary 1", "Summary 2"]),
      },
    );

    expect(assembled?.messages).toEqual([
      expect.objectContaining({ role: "user", content: "hello" }),
    ]);
    expect(assembled?.promptBlocks).toContainEqual(
      expect.objectContaining({
        title: "Memory",
        skipped: true,
        reason: "memory_range_empty",
      }),
    );
  });

  it("keeps backward-compatible memory rendering when no range is configured", async () => {
    const assembled = await buildMessagesFromPromptTemplate(
      {},
      {},
      {
        promptTemplate: [
          { type: "memory", innerFormat: "{{slot}}" },
        ],
      },
      {
        buildServerMemoryMessages: createMemoryBuilder(
          ["Summary 1", "Summary 2"],
          "<Past Events Summary>\nOriginal combined memory block\n</Past Events Summary>",
        ),
      },
    );

    expect(assembled?.messages).toEqual([
      expect.objectContaining({
        role: "system",
        content: "<Past Events Summary>\nOriginal combined memory block\n</Past Events Summary>",
      }),
    ]);
  });
});
