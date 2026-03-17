import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { createDefaultCharacterEvolutionDefaults, createDefaultCharacterEvolutionState } from "../../../src/ts/characterEvolution";

function writeJson(filePath: string, payload: unknown) {
  writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function createFakeEmbeddings(texts: string[]) {
  return Promise.resolve(texts.map((text) => {
    const lower = text.toLowerCase();
    const tokens = lower.split(/[^a-z0-9]+/g).filter(Boolean);
    const count = (...needles: string[]) => needles.reduce((sum, needle) => sum + tokens.filter((token) => token === needle).length, 0);
    return [
      count("berlin", "moscow", "live", "lives", "moved", "move"),
      count("ui", "roleplay", "ai", "product", "manager", "job"),
      count("proust", "novel", "literature", "book", "books"),
      count("coffee", "tea"),
    ];
  }));
}

function createSemanticRecallSettings(overrides: Record<string, unknown> = {}) {
  const defaults = createDefaultCharacterEvolutionDefaults().semanticRecall!;
  return {
    ...defaults,
    enabled: true,
    ...overrides,
    sections: {
      ...defaults.sections,
      ...(typeof overrides.sections === "object" && overrides.sections ? overrides.sections as Record<string, boolean> : {}),
    },
  };
}

function createCharacter(charId: string, evolutionOverrides: Record<string, unknown> = {}) {
  return {
    chaId: charId,
    name: "Eva",
    characterEvolution: {
      enabled: true,
      extractionProvider: "openrouter",
      extractionModel: "model",
      extractionMaxTokens: 2400,
      extractionPrompt: "",
      sectionConfigs: [],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
      currentStateVersion: 0,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [],
      ...evolutionOverrides,
    },
  };
}

describe("character evolution semantic recall service", () => {
  const roots: string[] = [];

  afterEach(() => {
    while (roots.length > 0) {
      rmSync(roots.pop()!, { recursive: true, force: true });
    }
  });

  it("indexes archived items only for the current chat and resolves legacy chat ids in the documented order", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-a");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "legacy-chat",
      acceptedAt: 100,
      state: {
        userFacts: [
          { value: "User used to live in Berlin", status: "archived", confidence: "likely" },
          { value: "Active fact should not be indexed", status: "active" },
        ],
      },
    });
    writeJson(path.join(charDir, "states", "v2.json"), {
      version: 2,
      chatId: null,
      acceptedAt: 200,
      range: {
        chatId: "range-chat",
        startMessageIndex: 0,
        endMessageIndex: 4,
      },
      state: {
        userFacts: [
          { value: "User reads Proust", status: "archived", confidence: "confirmed" },
          { value: "Source chat id beats version chat id", status: "archived", sourceChatId: "legacy-chat" },
          { value: "Range chat fallback still works", status: "archived" },
        ],
      },
    });
    writeJson(path.join(charDir, "states", "v3.json"), {
      version: 3,
      chatId: null,
      acceptedAt: 300,
      state: {
        userFacts: [
          { value: "Unresolved legacy item should be skipped", status: "archived" },
        ],
      },
    });

    const character = createCharacter("char-a", {
      currentStateVersion: 2,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [
        { version: 1, chatId: "legacy-chat", acceptedAt: 100 },
        { version: 2, chatId: null, acceptedAt: 200, range: { chatId: "range-chat", startMessageIndex: 0, endMessageIndex: 4 } },
        { version: 3, chatId: null, acceptedAt: 300 },
      ],
    });

    const settings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: createFakeEmbeddings,
    });

    const rebuilt = await service.rebuildIndex({
      characterId: "char-a",
      chatId: "legacy-chat",
      characterDir: charDir,
      character,
      settings,
    });

    const values = (rebuilt.index.items as Array<{ value: string }>).map((item) => item.value).sort();
    expect(values).toEqual([
      "Source chat id beats version chat id",
      "User used to live in Berlin",
    ]);

    const rangeRebuilt = await service.rebuildIndex({
      characterId: "char-a",
      chatId: "range-chat",
      characterDir: charDir,
      character,
      settings,
    });
    expect((rangeRebuilt.index.items as Array<{ value: string }>).map((item) => item.value).sort()).toEqual([
      "Range chat fallback still works",
      "User reads Proust",
    ]);
  });

  it("suppresses recalled items that duplicate, reinforce, or conflict with active canon before prompt render", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-b");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "chat-current",
      acceptedAt: 100,
      state: {
        userFacts: [
          { value: "user lives in Berlin", status: "archived", confidence: "likely" },
          { value: "worked as a product manager in IT across streaming subscriptions", status: "archived", confidence: "likely" },
          { value: "user lives in Moscow", status: "archived", confidence: "confirmed" },
          { value: "user reads Proust", status: "archived", confidence: "confirmed" },
        ],
      },
    });

    const currentState = createDefaultCharacterEvolutionState();
    currentState.userFacts = [
      { id: "active-berlin", value: "user lives in Berlin", status: "active", confidence: "confirmed" },
      { id: "active-pm", value: "worked as a product manager in IT", status: "active", confidence: "confirmed" },
    ];
    const character = createCharacter("char-b", {
      currentStateVersion: 1,
      currentState,
      stateVersions: [
        { version: 1, chatId: "chat-current", acceptedAt: 100 },
      ],
    });
    const settings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          maxItems: 3,
          minScore: 0.2,
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: createFakeEmbeddings,
    });

    const block = await service.buildPromptBlock({
      characterId: "char-b",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings,
      chat: {
        id: "chat-current",
        message: [
          { role: "user", data: "Do you remember Berlin, my product manager work, the Moscow move, and the Proust thing?" },
          { role: "char", data: "Berlin, the product manager work, Moscow, and Proust all stand out." },
        ],
      },
    });

    expect(block.content).toContain("user reads Proust");
    expect(block.content).not.toContain("user lives in Berlin");
    expect(block.content).not.toContain("user lives in Moscow");

    const outcomes = (block.metadata?.suppressedCandidates as Array<{ outcome: string }>).map((entry) => entry.outcome).sort();
    expect(outcomes).toContain("active_match");
    expect(outcomes).toContain("active_reinforcement");
    expect(outcomes).toContain("active_conflict");
  });

  it("drops archived facts whose latest accepted snapshot is corrected", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-corrected");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "chat-current",
      acceptedAt: 100,
      state: {
        userFacts: [
          { id: "fact-1", value: "User used to live in Berlin", status: "archived", confidence: "confirmed" },
        ],
      },
    });
    writeJson(path.join(charDir, "states", "v2.json"), {
      version: 2,
      chatId: "chat-current",
      acceptedAt: 200,
      state: {
        userFacts: [
          { id: "fact-1", value: "User used to live in Berlin", status: "corrected", confidence: "confirmed" },
        ],
      },
    });

    const character = createCharacter("char-corrected", {
      currentStateVersion: 2,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [
        { version: 1, chatId: "chat-current", acceptedAt: 100 },
        { version: 2, chatId: "chat-current", acceptedAt: 200 },
      ],
    });
    const settings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: createFakeEmbeddings,
    });

    const rebuilt = await service.rebuildIndex({
      characterId: "char-corrected",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings,
    });

    expect(rebuilt.index.items).toEqual([]);
  });

  it("rebuilds lazily when the index is dirty or stale", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-c");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "chat-current",
      acceptedAt: 100,
      state: {
        userFacts: [
          { value: "Building a UI for AI roleplay interactions", status: "archived", confidence: "confirmed" },
        ],
      },
    });

    const character = createCharacter("char-c", {
      currentStateVersion: 1,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [
        { version: 1, chatId: "chat-current", acceptedAt: 100 },
      ],
    });
    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: createFakeEmbeddings,
    });

    const baseSettings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    await service.rebuildIndex({
      characterId: "char-c",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings: baseSettings,
    });

    await service.markDirtyChat({
      characterDir: charDir,
      chatId: "chat-current",
      reason: "test_dirty",
    });

    const dirtyBlock = await service.buildPromptBlock({
      characterId: "char-c",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings: baseSettings,
      chat: {
        id: "chat-current",
        message: [
          { role: "user", data: "I am still building that UI for AI roleplay." },
        ],
      },
    });
    expect(dirtyBlock.metadata?.rebuildReason).toBe("dirty");

    const staleSettings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          embeddingModel: "multiMiniLM",
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    const staleBlock = await service.buildPromptBlock({
      characterId: "char-c",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings: staleSettings,
      chat: {
        id: "chat-current",
        message: [
          { role: "user", data: "I am still building that UI for AI roleplay." },
        ],
      },
    });

    expect(staleBlock.metadata?.rebuildReason).toBe("model_mismatch");
  });

  it("skips safely when lazy rebuild fails", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-rebuild-fail");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "chat-current",
      acceptedAt: 100,
      state: {
        userFacts: [
          { value: "User used to live in Berlin", status: "archived", confidence: "confirmed" },
        ],
      },
    });

    const character = createCharacter("char-rebuild-fail", {
      currentStateVersion: 1,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [
        { version: 1, chatId: "chat-current", acceptedAt: 100 },
      ],
    });
    const settings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: async () => {
        throw new Error("embedding backend offline");
      },
    });

    const block = await service.buildPromptBlock({
      characterId: "char-rebuild-fail",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings,
      chat: {
        id: "chat-current",
        message: [
          { role: "user", data: "Do you remember Berlin?" },
        ],
      },
    });

    expect(block).toMatchObject({
      skippedReason: "rebuild_failed",
      metadata: expect.objectContaining({
        error: "embedding backend offline",
      }),
    });
  });

  it("skips safely when query embedding fails after a successful rebuild", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-query-fail");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "chat-current",
      acceptedAt: 100,
      state: {
        userFacts: [
          { value: "User reads Proust", status: "archived", confidence: "confirmed" },
        ],
      },
    });

    const character = createCharacter("char-query-fail", {
      currentStateVersion: 1,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [
        { version: 1, chatId: "chat-current", acceptedAt: 100 },
      ],
    });
    const settings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          sections: {
            userFacts: true,
          },
        }),
      },
    };

    let embedCallCount = 0;
    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: async (texts: string[]) => {
        embedCallCount += 1;
        if (embedCallCount === 1) {
          return createFakeEmbeddings(texts);
        }
        throw new Error("query embedding failed");
      },
    });

    const block = await service.buildPromptBlock({
      characterId: "char-query-fail",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings,
      chat: {
        id: "chat-current",
        message: [
          { role: "user", data: "Do you remember the Proust thing?" },
        ],
      },
    });

    expect(block).toMatchObject({
      skippedReason: "query_embedding_failed",
      metadata: expect.objectContaining({
        error: "query embedding failed",
        queryText: expect.stringContaining("Proust"),
      }),
    });
  });

  it("honors configured per-section recall limits while keeping the global max", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "risu-semantic-recall-"));
    roots.push(root);
    const charDir = path.join(root, "char-d");
    await fs.mkdir(path.join(charDir, "states"), { recursive: true });

    writeJson(path.join(charDir, "states", "v1.json"), {
      version: 1,
      chatId: "chat-current",
      acceptedAt: 100,
      state: {
        userFacts: [
          { value: "User used to live in Berlin", status: "archived", confidence: "confirmed" },
          { value: "User moved to Moscow later", status: "archived", confidence: "confirmed" },
          { value: "User reads Proust", status: "archived", confidence: "confirmed" },
        ],
        userLikes: [
          { value: "User likes coffee", status: "archived", confidence: "confirmed" },
          { value: "User likes tea", status: "archived", confidence: "confirmed" },
        ],
      },
    });

    const character = createCharacter("char-d", {
      currentStateVersion: 1,
      currentState: createDefaultCharacterEvolutionState(),
      stateVersions: [
        { version: 1, chatId: "chat-current", acceptedAt: 100 },
      ],
    });
    const settings = {
      characterEvolutionDefaults: {
        ...createDefaultCharacterEvolutionDefaults(),
        semanticRecall: createSemanticRecallSettings({
          maxItems: 5,
          minScore: 0.2,
          sections: {
            userFacts: true,
            userLikes: true,
          },
          sectionLimits: {
            userFacts: 1,
            userLikes: 2,
          },
        }),
      },
    };

    const { createCharacterEvolutionSemanticRecallService } = await import("./character_evolution_semantic_recall_indexer.cjs");
    const service = createCharacterEvolutionSemanticRecallService({
      fs,
      existsSync,
      generateEmbeddings: createFakeEmbeddings,
    });

    const block = await service.buildPromptBlock({
      characterId: "char-d",
      chatId: "chat-current",
      characterDir: charDir,
      character,
      settings,
      chat: {
        id: "chat-current",
        message: [
          { role: "user", data: "Do you remember Berlin, Moscow, Proust, coffee, and tea?" },
        ],
      },
    });

    const recalledItems = block.metadata?.recalledItems as Array<{ sectionKey: string }> | undefined;
    expect(recalledItems?.filter((item) => item.sectionKey === "userFacts")).toHaveLength(1);
    expect(recalledItems?.filter((item) => item.sectionKey === "userLikes")).toHaveLength(2);
    expect(block.metadata?.suppressedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ outcome: "section_limit", sectionKey: "userFacts" }),
      ]),
    );
  });
});
