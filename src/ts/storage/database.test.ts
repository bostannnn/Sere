import { describe, expect, it, vi } from "vitest";

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

import { DEFAULT_GLOBAL_RAG_SETTINGS, setDatabase } from "./database.svelte";

type TestDb = {
  characters: unknown[];
  [key: string]: unknown;
};

function applySetDatabase(db: TestDb): TestDb {
  setDatabase(db as unknown as Parameters<typeof setDatabase>[0]);
  return db;
}

function makePlugin(name: string, enabled = true) {
  return {
    name,
    enabled,
    arguments: {},
    realArg: {},
    customLink: [],
    argMeta: {},
  };
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

  it("treats focusPlus as unsupported and falls back to normal", () => {
    const db = applySetDatabase({ characters: [], chatReadingMode: "focusPlus" });
    expect(db.chatReadingMode).toBe("normal");
  });

  it("falls back to normal for unknown values", () => {
    const db = applySetDatabase({ characters: [], chatReadingMode: "unknown" });
    expect(db.chatReadingMode).toBe("normal");
  });
});

describe("comfy commander migration", () => {
  it("migrates valid plugin storage into core comfyCommander state", () => {
    const db = applySetDatabase({
      characters: [],
      plugins: [makePlugin("Comfy Commander", true)],
      comfyUiUrl: "http://localhost:8188",
      pluginCustomStorage: {
        config: JSON.stringify({
          comfy_url: "http://127.0.0.1:9000",
          debug: true,
        }),
        workflows: JSON.stringify([
          {
            id: "wf-1",
            name: "Portrait",
            workflow: '{"1":{"inputs":{"text":"%prompt%"}}}',
          },
        ]),
        templates: JSON.stringify([
          {
            id: "tpl-1",
            trigger: "portrait",
            prompt: "prompt {{prompt}}",
            negativePrompt: "bad anatomy",
            workflowId: "wf-1",
            showInMenu: true,
            buttonName: "Portrait",
          },
        ]),
      },
    });

    const comfyCommander = db.comfyCommander as {
      migratedFromPlugin: boolean;
      migratedAt?: number;
      config: { baseUrl: string; debug: boolean };
      workflows: unknown[];
      templates: Array<{ showInChatMenu: boolean }>;
    };
    const plugins = db.plugins as Array<{ enabled?: boolean }>;

    expect(comfyCommander.migratedFromPlugin).toBe(true);
    expect(typeof comfyCommander.migratedAt).toBe("number");
    expect(comfyCommander.config.baseUrl).toBe("http://127.0.0.1:9000");
    expect(comfyCommander.config.debug).toBe(true);
    expect(comfyCommander.workflows).toHaveLength(1);
    expect(comfyCommander.templates).toHaveLength(1);
    expect(comfyCommander.templates[0].showInChatMenu).toBe(true);
    expect(plugins[0].enabled).toBe(false);
  });

  it("falls back safely when plugin storage is malformed", () => {
    const db = applySetDatabase({
      characters: [],
      plugins: [makePlugin("Comfy Commander", true)],
      comfyUiUrl: "http://legacy-host:8188",
      comfyConfig: {
        workflow: '{"10":{"inputs":{"text":"{{risu_prompt}}"}}}',
        posNodeID: "",
        posInputName: "text",
        negNodeID: "",
        negInputName: "text",
        timeout: 30,
      },
      pluginCustomStorage: {
        config: "{not-json}",
        workflows: "[]",
        templates: "not-json",
      },
    });

    const comfyCommander = db.comfyCommander as {
      migratedFromPlugin: boolean;
      config: { baseUrl: string };
      templates: unknown[];
      workflows: Array<{ name: string }>;
    };
    const plugins = db.plugins as Array<{ enabled?: boolean }>;

    expect(comfyCommander.migratedFromPlugin).toBe(true);
    expect(comfyCommander.config.baseUrl).toBe("http://legacy-host:8188");
    expect(comfyCommander.templates).toHaveLength(0);
    expect(comfyCommander.workflows).toHaveLength(1);
    expect(comfyCommander.workflows[0].name).toBe("Legacy Workflow");
    expect(plugins[0].enabled).toBe(false);
  });

  it("disables plugin after migration when plugin was enabled", () => {
    const db = applySetDatabase({
      characters: [],
      plugins: [makePlugin("Comfy Commander", true)],
      pluginCustomStorage: {
        templates: JSON.stringify([]),
        workflows: JSON.stringify([]),
        config: JSON.stringify({}),
      },
    });

    const comfyCommander = db.comfyCommander as { migratedFromPlugin: boolean };
    const plugins = db.plugins as Array<{ enabled?: boolean }>;

    expect(comfyCommander.migratedFromPlugin).toBe(true);
    expect(plugins[0].enabled).toBe(false);
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
