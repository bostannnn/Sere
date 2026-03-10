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
  resolveChatBackgroundMode as resolveChatBackgroundModeFromDatabase,
  resolveGlobalRagSettings as resolveGlobalRagSettingsFromDatabase,
  setDatabase,
} from "./database.svelte";
import {
  DEFAULT_OPENROUTER_REQUEST_MODEL,
  ensureComfyCommanderStateShape,
  migrateRemovedProviderSelections,
  normalizeChatBackground,
  resolveChatBackgroundMode,
  resolveGlobalRagSettings,
  stripLegacyProviderFields,
} from "./database.normalizers";
import {
  REMOVED_PROVIDER_MIGRATION_NOTICE,
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
});

describe("legacy provider migration", () => {
  it("migrates removed model providers to OpenRouter and records a notice", () => {
    const db = applySetDatabase({
      characters: [],
      aiModel: "reverse_proxy",
      subModel: "xcustom:::legacy-model",
      openrouterRequestModel: "",
      openrouterSubRequestModel: "",
    });

    expect(db.aiModel).toBe("openrouter");
    expect(db.subModel).toBe("openrouter");
    expect(db.openrouterRequestModel).toBe("openai/gpt-3.5-turbo");
    expect(db.openrouterSubRequestModel).toBe("openai/gpt-3.5-turbo");
    expect(db.removedModelMigrationNotice).toEqual([
      "Legacy removed providers were migrated to OpenRouter. Review Bot Settings and re-save any affected presets.",
    ]);
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

describe("normalizer unit coverage", () => {
  it("normalizes OpenRouter targets with missing request models", () => {
    const target = {
      aiModel: "openrouter",
      subModel: "openrouter",
      openrouterRequestModel: "   ",
      openrouterSubRequestModel: "",
    };

    const changed = migrateRemovedProviderSelections(target);

    expect(changed).toBe(true);
    expect(target.openrouterRequestModel).toBe(DEFAULT_OPENROUTER_REQUEST_MODEL);
    expect(target.openrouterSubRequestModel).toBe(DEFAULT_OPENROUTER_REQUEST_MODEL);
  });

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

  it("strips dead legacy provider fields from persisted payloads", () => {
    const payload = {
      ooba: { top_p: 0.9 },
      ainconfig: { top_p: 0.7 },
      textgenWebUIBlockingURL: "https://legacy.example",
      vertexRegion: "global",
      cohereAPIKey: "secret",
      keep: "value",
    };

    const changed = stripLegacyProviderFields(payload);

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
      removedModelMigrationNotice: [REMOVED_PROVIDER_MIGRATION_NOTICE],
    });

    const beforeSeparateModels = structuredClone(
      db.seperateModels as { memory: string; emotion: string; translate: string; otherAx: string },
    );
    const beforeFallbackModels = structuredClone(
      db.fallbackModels as { memory: string[]; emotion: string[]; translate: string[]; otherAx: string[]; model: string[] },
    );

    const incomingPreset = {
        aiModel: "reverse_proxy",
        subModel: "xcustom:::legacy",
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
    expect(db.removedModelMigrationNotice).toEqual([REMOVED_PROVIDER_MIGRATION_NOTICE]);
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
        },
      ],
    });

    const exported = buildDownloadPresetForExport(db as unknown as Parameters<typeof buildDownloadPresetForExport>[0], 0);

    expect(exported.openAIKey).toBe("");
    expect(exported.proxyKey).toBe("");
    expect(exported.forceReplaceUrl).toBe("");
    expect(exported.forceReplaceUrl2).toBe("");
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
});
