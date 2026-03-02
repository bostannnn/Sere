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

import { setDatabase } from "./database.svelte";

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
