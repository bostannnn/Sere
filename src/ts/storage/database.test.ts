import { describe, expect, it, vi } from "vitest";
import { LLMFormat } from "../model/modellist";

const { changeLanguageMock } = vi.hoisted(() => ({
  changeLanguageMock: vi.fn(),
}));

vi.mock("src/lang", () => ({
  changeLanguage: changeLanguageMock,
  language: {},
}));

vi.mock("../stores.svelte", async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: { db: {} },
    selIdState: { selId: 0 },
    selectedCharID: writable(0),
  };
});

vi.mock("../globalApi.svelte", () => ({
  downloadFile: vi.fn(),
  saveAsset: vi.fn(),
}));

import {
  DEFAULT_GLOBAL_RAG_SETTINGS,
  presetTemplate as presetTemplateFromDatabase,
  repairCharacterChatPage,
  resolveChatBackgroundMode as resolveChatBackgroundModeFromDatabase,
  resolveGlobalRagSettings as resolveGlobalRagSettingsFromDatabase,
  resolveSafeChatIndex,
  resolveSelectedCharacter,
  resolveSelectedChat,
  resolveSelectedChatMessages,
  setDatabase,
} from "./database.svelte";
import {
  ensureComfyCommanderStateShape,
  normalizeChatBackground,
  resolveChatBackgroundMode,
  resolveGlobalRagSettings,
  stripRemovedProviderFields,
} from "./database.normalizers";
import {
  applyImportedPresetToDatabase,
  buildDownloadPresetForExport,
  changeToPresetInDatabase,
  presetTemplate,
  setPresetOnDatabase,
} from "./database.presets";

type TestDb = {
  characters: unknown[];
  [key: string]: unknown;
};

function applySetDatabase(db: TestDb): TestDb {
  setDatabase(db as unknown as Parameters<typeof setDatabase>[0]);
  return db;
}

describe("database chatReadingMode normalization", () => {
  it("defaults to normal when unset", () => {
    const db = applySetDatabase({ characters: [] });
    expect(db.chatReadingMode).toBe("normal");
  });

  it("keeps focus value when explicitly set", () => {
    const db = applySetDatabase({ characters: [], chatReadingMode: "focus" });
    expect(db.chatReadingMode).toBe("focus");
  });

  it("falls back to normal for unknown values", () => {
    const db = applySetDatabase({ characters: [], chatReadingMode: "unknown" });
    expect(db.chatReadingMode).toBe("normal");
  });

  it("normalizes missing prompt templates into the default template", () => {
    const db = applySetDatabase({ characters: [], formatversion: 5, promptTemplate: null });

    expect(Array.isArray(db.promptTemplate)).toBe(true);
    expect((db.promptTemplate as Array<{ type?: string }>).some((item) => item.type === "characterState")).toBe(true);
  });

  it("normalizes empty prompt templates into the default template", () => {
    const db = applySetDatabase({ characters: [], formatversion: 5, promptTemplate: [] });

    expect(Array.isArray(db.promptTemplate)).toBe(true);
    expect((db.promptTemplate as Array<{ type?: string }>).length).toBeGreaterThan(0);
    expect((db.promptTemplate as Array<{ type?: string }>).some((item) => item.type === "characterState")).toBe(true);
  });

  it("clones the default preset when seeding missing bot presets", () => {
    const db = applySetDatabase({ characters: [], botPresets: null });
    const seededPreset = (db.botPresets as Array<{ promptTemplate?: Array<{ type?: string }> }>)[0];

    expect(seededPreset).toBeTruthy();
    expect(seededPreset).not.toBe(presetTemplateFromDatabase);
    expect(seededPreset.promptTemplate).not.toBe(presetTemplateFromDatabase.promptTemplate);
  });

  it("normalizes stored preset prompt templates when loading an existing database", () => {
    const db = applySetDatabase({
      characters: [],
      botPresets: [
        {
          ...presetTemplate,
          promptTemplate: [],
        },
      ],
    });

    const storedPreset = (db.botPresets as Array<{ promptTemplate?: Array<{ type?: string }> }>)[0];
    expect(Array.isArray(storedPreset.promptTemplate)).toBe(true);
    expect(storedPreset.promptTemplate?.length).toBeGreaterThan(0);
    expect(storedPreset.promptTemplate?.some((item) => item.type === "characterState")).toBe(true);
  });

  it("strips removed provider fields from loaded database and presets", () => {
    const db = applySetDatabase({
      characters: [],
      vertexRegion: "global",
      cohereAPIKey: "secret",
      botPresets: [
        {
          ...presetTemplate,
          vertexClientEmail: "legacy@example.com",
          ooba: { top_p: 0.9 },
        },
      ],
    });

    expect(db).not.toHaveProperty("vertexRegion");
    expect(db).not.toHaveProperty("cohereAPIKey");
    expect(db.botPresets[0]).not.toHaveProperty("vertexClientEmail");
    expect(db.botPresets[0]).not.toHaveProperty("ooba");
  });

});

describe("character evolution model normalization", () => {
  it("normalizes provider-prefixed character evolution models for non-openrouter runtimes", () => {
    const db = applySetDatabase({
      characters: [
        {
          characterEvolution: {
            enabled: true,
            useGlobalDefaults: false,
            extractionProvider: "anthropic",
            extractionModel: "anthropic/claude-3-5-haiku-latest",
            extractionMaxTokens: 1200,
            extractionPrompt: "prompt",
            currentStateVersion: 0,
            currentState: {},
            stateVersions: [],
          },
        },
      ],
      characterEvolutionDefaults: {
        extractionProvider: "openai",
        extractionModel: "openai/gpt-4.1-mini",
        extractionMaxTokens: 1200,
        extractionPrompt: "prompt",
        sectionConfigs: [],
        privacy: {},
      },
    });

    expect((db.characterEvolutionDefaults as { extractionModel?: string }).extractionModel).toBe("gpt-4.1-mini");
    expect(((db.characters[0] as { characterEvolution?: { extractionModel?: string } }).characterEvolution?.extractionModel)).toBe("claude-3-5-haiku-latest");
  });
});

describe("global rag defaults", () => {
  it("initializes the locked baseline for new databases", () => {
    const db = applySetDatabase({ characters: [] });

    expect(db.globalRagSettings).toEqual(DEFAULT_GLOBAL_RAG_SETTINGS);
  });

  it("fills missing global rag fields from the locked baseline", () => {
    const db = applySetDatabase({
      characters: [],
      globalRagSettings: {
        enabled: true,
        topK: 9,
      },
    });

    expect(db.globalRagSettings).toEqual({
      ...DEFAULT_GLOBAL_RAG_SETTINGS,
      enabled: true,
      topK: 9,
    });
  });
});

describe("chat background normalization", () => {
  it("keeps valid custom chat backgrounds", () => {
    const db = applySetDatabase({
      characters: [
        {
          chats: [
            {
              message: [],
              note: "",
              name: "Chat 1",
              localLore: [],
              backgroundMode: "custom",
              backgroundImage: "assets/example.png",
            },
          ],
        },
      ],
    });

    const chat = (db.characters[0] as { chats: Array<{ backgroundMode?: string; backgroundImage?: string }> }).chats[0];

    expect(chat.backgroundMode).toBe("custom");
    expect(chat.backgroundImage).toBe("assets/example.png");
  });

  it("falls back to inherit when custom mode has no image", () => {
    const db = applySetDatabase({
      characters: [
        {
          chats: [
            {
              message: [],
              note: "",
              name: "Chat 1",
              localLore: [],
              backgroundMode: "custom",
              backgroundImage: "",
            },
          ],
        },
      ],
    });

    const chat = (db.characters[0] as { chats: Array<{ backgroundMode?: string; backgroundImage?: string }> }).chats[0];

    expect(chat.backgroundMode).toBe("inherit");
    expect(chat.backgroundImage).toBe("");
  });
});

describe("database module re-export contract", () => {
  it("re-exports split helper values and functions", () => {
    expect(presetTemplateFromDatabase).toBe(presetTemplate);
    expect(resolveGlobalRagSettingsFromDatabase).toBe(resolveGlobalRagSettings);
    expect(resolveChatBackgroundModeFromDatabase).toBe(resolveChatBackgroundMode);
  });
});

describe("selected chat helpers", () => {
  const makeChat = (name: string) => ({
    name,
    note: `${name} note`,
    message: [{ role: "user" as const, data: `${name} message` }],
    localLore: [],
    id: `${name}-id`,
  });

  it("returns null state when no selected character exists", () => {
    expect(resolveSelectedCharacter([], -1)).toBeNull();
    expect(resolveSelectedChat(null)).toBeNull();
    expect(resolveSelectedChatMessages(null)).toEqual([]);
  });

  it("returns no chat when the selected character has no chats", () => {
    const character = {
      name: "No chats",
      type: "character" as const,
      chats: [],
      chatPage: 4,
    };

    expect(resolveSafeChatIndex(character.chats, character.chatPage)).toBe(-1);
    expect(resolveSelectedChat(character as never)).toBeNull();
    expect(resolveSelectedChatMessages(character as never)).toEqual([]);
    expect(repairCharacterChatPage(character as never)).toBe(-1);
    expect(character.chatPage).toBe(0);
  });

  it("falls back to the first chat for out-of-range chatPage values", () => {
    const chats = [makeChat("chat-1"), makeChat("chat-2")];
    const character = {
      name: "Has chats",
      type: "character" as const,
      chats,
      chatPage: 99,
    };

    expect(resolveSafeChatIndex(chats as never, character.chatPage)).toBe(0);
    expect(resolveSelectedChat(character as never)).toBe(chats[0]);
    expect(resolveSelectedChatMessages(character as never)).toEqual(chats[0].message);
    expect(repairCharacterChatPage(character as never)).toBe(0);
    expect(character.chatPage).toBe(0);
  });

  it("defaults missing or negative chatPage values to the first chat", () => {
    const chats = [makeChat("chat-1"), makeChat("chat-2")];

    expect(resolveSafeChatIndex(chats as never, undefined)).toBe(0);
    expect(resolveSafeChatIndex(chats as never, -4)).toBe(0);
  });
});

describe("normalizer unit coverage", () => {
  it("trims chat background image and falls back to inherit", () => {
    const chat: Parameters<typeof normalizeChatBackground>[0] = {
      backgroundMode: "custom",
      backgroundImage: "   ",
    };

    normalizeChatBackground(chat);

    expect(chat.backgroundMode).toBe("inherit");
    expect(chat.backgroundImage).toBe("");
  });

  it("returns an isolated global rag object clone", () => {
    const resolved = resolveGlobalRagSettings(undefined);
    resolved.enabledRulebooks.push("ruleset-a");

    expect(DEFAULT_GLOBAL_RAG_SETTINGS.enabledRulebooks).toEqual([]);
  });

  it("strips removed provider fields from persisted payloads", () => {
    const payload = {
      ooba: { top_p: 0.9 },
      ainconfig: { top_p: 0.7 },
      textgenWebUIBlockingURL: "https://legacy.example",
      vertexRegion: "global",
      cohereAPIKey: "secret",
      keep: "value",
    };

    const changed = stripRemovedProviderFields(payload);

    expect(changed).toBe(true);
    expect(payload).toEqual({ keep: "value" });
  });

  it("sanitizes invalid comfy commander state shape", () => {
    const db = {
      comfyUiUrl: "http://legacy-host:8188",
      comfyCommander: {
        version: 2,
        config: {
          baseUrl: "   ",
          debug: "yes",
          timeoutSec: 0,
          pollIntervalMs: -1,
        },
        workflows: [{ id: "wf-empty", workflow: "  " }],
        templates: [{ id: "tpl-empty", trigger: "  " }],
      },
    } as unknown as Parameters<typeof ensureComfyCommanderStateShape>[0];

    ensureComfyCommanderStateShape(db);

    expect(db.comfyCommander.version).toBe(1);
    expect(db.comfyCommander.config.baseUrl).toBe("http://legacy-host:8188");
    expect(db.comfyCommander.config.timeoutSec).toBe(120);
    expect(db.comfyCommander.config.pollIntervalMs).toBe(1000);
    expect(db.comfyCommander.workflows).toEqual([]);
    expect(db.comfyCommander.templates).toEqual([]);
  });
});

describe("preset helper unit coverage", () => {
  it("does not overwrite guarded separate/fallback models", () => {
    const db = applySetDatabase({
      characters: [],
      doNotChangeSeperateModels: true,
      doNotChangeFallbackModels: true,
      seperateModelsForAxModels: true,
      seperateModels: { memory: "keep-m", emotion: "keep-e", translate: "keep-t", otherAx: "keep-o" },
      fallbackModels: { memory: ["m"], emotion: ["e"], translate: ["t"], otherAx: ["o"], model: ["all"] },
      fallbackWhenBlankResponse: true,
    });

    const beforeSeparateModels = structuredClone(
      db.seperateModels as { memory: string; emotion: string; translate: string; otherAx: string },
    );
    const beforeFallbackModels = structuredClone(
      db.fallbackModels as { memory: string[]; emotion: string[]; translate: string[]; otherAx: string[]; model: string[] },
    );

    const incomingPreset = {
        aiModel: "openrouter",
        subModel: "openrouter",
        reverseProxyOobaArgs: { mode: "instruct" },
        promptSettings: {
          assistantPrefill: "",
          postEndInnerFormat: "",
          sendChatAsSystem: false,
          sendName: false,
          utilOverride: false,
        },
        customAPIFormat: LLMFormat.OpenAICompatible,
        customFlags: [],
        seperateModelsForAxModels: false,
        seperateModels: { memory: "new-m", emotion: "new-e", translate: "new-t", otherAx: "new-o" },
        fallbackModels: { memory: ["nm"], emotion: ["ne"], translate: ["nt"], otherAx: ["no"], model: ["nall"] },
        fallbackWhenBlankResponse: false,
      } as unknown as Parameters<typeof setPresetOnDatabase>[1];

    setPresetOnDatabase(db as unknown as Parameters<typeof setPresetOnDatabase>[0], incomingPreset);

    expect(db.aiModel).toBe("openrouter");
    expect(db.subModel).toBe("openrouter");
    expect(db.seperateModels).toEqual(beforeSeparateModels);
    expect(db.fallbackModels).toEqual(beforeFallbackModels);
    expect(db.fallbackWhenBlankResponse).toBe(true);
  });

  it("scrubs sensitive fields from downloadable preset export", () => {
    const db = applySetDatabase({
      characters: [],
      botPresetsId: 0,
      botPresets: [
        {
          ...presetTemplate,
          name: "Sensitive Preset",
          openAIKey: "secret-openai",
          proxyKey: "secret-proxy",
          forceReplaceUrl: "https://proxy.example",
          forceReplaceUrl2: "https://proxy2.example",
          vertexAccessToken: "legacy-token",
        },
      ],
    });

    const exported = buildDownloadPresetForExport(db as unknown as Parameters<typeof buildDownloadPresetForExport>[0], 0);

    expect(exported.openAIKey).toBe("");
    expect(exported.proxyKey).toBe("");
    expect(exported.forceReplaceUrl).toBe("");
    expect(exported.forceReplaceUrl2).toBe("");
    expect(exported).not.toHaveProperty("vertexAccessToken");
  });

  it("changes preset without implicitly appending current preset when saveCurrent is false", () => {
    const db = applySetDatabase({ characters: [] });
    const presetBase = {
      reverseProxyOobaArgs: structuredClone(db.reverseProxyOobaArgs),
      promptSettings: structuredClone(db.promptSettings),
      customAPIFormat: structuredClone(db.customAPIFormat),
      customFlags: [],
    };
    db.botPresetsId = 0;
    db.doNotChangeSeperateModels = true;
    db.doNotChangeFallbackModels = true;
    db.botPresets = [
      { ...presetTemplate, ...presetBase, name: "Preset A", temperature: 33 },
      { ...presetTemplate, ...presetBase, name: "Preset B", temperature: 77 },
    ];

    const beforeCount = (db.botPresets as unknown[]).length;
    changeToPresetInDatabase(db as unknown as Parameters<typeof changeToPresetInDatabase>[0], 1, false);

    expect((db.botPresets as unknown[]).length).toBe(beforeCount);
    expect(db.botPresetsId).toBe(1);
    expect(db.temperature).toBe(77);
  });

  it("repairs empty preset prompt templates back to the default template", () => {
    const db = applySetDatabase({ characters: [] });
    const presetBase = {
      reverseProxyOobaArgs: structuredClone(db.reverseProxyOobaArgs),
      promptSettings: structuredClone(db.promptSettings),
      customAPIFormat: structuredClone(db.customAPIFormat),
      customFlags: [],
    };

    setPresetOnDatabase(
      db as unknown as Parameters<typeof setPresetOnDatabase>[0],
      {
        ...presetTemplate,
        ...presetBase,
        promptTemplate: [],
      } as unknown as Parameters<typeof setPresetOnDatabase>[1],
    );

    expect(Array.isArray(db.promptTemplate)).toBe(true);
    expect((db.promptTemplate as Array<{ type?: string }>).length).toBeGreaterThan(0);
    expect((db.promptTemplate as Array<{ type?: string }>).some((item) => item.type === "characterState")).toBe(true);
  });

  it("converts ST-style imports into internal prompt template preset", () => {
    const db = applySetDatabase({
      characters: [],
      botPresets: [],
    });
    const log = vi.fn();

    applyImportedPresetToDatabase(
      db as unknown as Parameters<typeof applyImportedPresetToDatabase>[0],
      {
        prompt_order: [
          {
            order: [
              { enabled: true, identifier: "main" },
              { enabled: true, identifier: "chatHistory" },
              { enabled: true, identifier: "worldInfoBefore" },
            ],
          },
        ],
        prompts: [
          { identifier: "main", content: "System main", role: "system" },
          { identifier: "chatHistory", content: "" },
          { identifier: "worldInfoBefore", content: "" },
        ],
        assistant_prefill: "Prefill answer",
        temperature: 0.95,
        frequency_penalty: 0.2,
        presence_penalty: 0.3,
        top_p: 0.8,
      },
      log,
    );

    const imported = (db.botPresets as Array<{ name?: string; top_p?: number; temperature?: number; promptTemplate?: Array<{ type: string }> }>)[0];
    expect(imported.name).toBe("Imported ST Preset");
    expect(imported.top_p).toBe(0.8);
    expect(imported.temperature).toBe(95);
    expect(imported.promptTemplate?.some((item) => item.type === "chat")).toBe(true);
    expect(imported.promptTemplate?.some((item) => item.type === "lorebook")).toBe(true);
    expect(imported.promptTemplate?.some((item) => item.type === "postEverything")).toBe(true);
    expect(log).not.toHaveBeenCalled();
  });

  it("scrubs removed provider fields from imported generic presets", () => {
    const db = applySetDatabase({
      characters: [],
      botPresets: [],
    });

    applyImportedPresetToDatabase(
      db as unknown as Parameters<typeof applyImportedPresetToDatabase>[0],
      {
        name: "Imported",
        aiModel: "openrouter",
        vertexPrivateKey: "secret",
        hordeConfig: { apiKey: "legacy" },
      },
      () => {},
    );

    expect(db.botPresets).toHaveLength(1);
    expect(db.botPresets[0]).not.toHaveProperty("vertexPrivateKey");
    expect(db.botPresets[0]).not.toHaveProperty("hordeConfig");
  });
});
