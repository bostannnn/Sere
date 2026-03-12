import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  db: {
    characters: [] as Array<Record<string, unknown>>,
    statics: {
      imports: 0,
    },
  },
  downloadFileMock: vi.fn(),
  setDatabaseMock: vi.fn(),
  setDatabaseLiteMock: vi.fn(),
  alertNormalMock: vi.fn(),
}));

vi.mock("src/lang", () => ({
  language: {
    importedCharacter: "Imported",
    successExport: "Exported",
    errors: {
      noData: "No data",
    },
  },
}));

vi.mock("src/ts/alert", () => ({
  alertCardExport: vi.fn(),
  alertConfirm: vi.fn(),
  alertError: vi.fn(),
  alertInput: vi.fn(),
  alertNormal: shared.alertNormalMock,
  alertStore: {
    set: vi.fn(),
  },
  alertWait: vi.fn(),
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: () => shared.db,
  setDatabase: (next: Record<string, unknown>) => {
    shared.db = next as typeof shared.db;
    shared.setDatabaseMock(next);
  },
  setDatabaseLite: (next: Record<string, unknown>) => {
    shared.db = next as typeof shared.db;
    shared.setDatabaseLiteMock(next);
  },
  importPreset: vi.fn(),
}));

vi.mock("src/ts/util", () => ({
  checkNullish: (value: unknown) => value === null || value === undefined,
  decryptBuffer: async (value: Uint8Array) => value,
  isKnownUri: () => false,
  selectFileByDom: async () => null,
  sleep: async () => {},
}));

vi.mock("src/ts/globalApi.svelte", () => ({
  AppendableBuffer: class AppendableBuffer {},
  BlankWriter: class BlankWriter {
    async init() {}
    async end() {}
  },
  checkCharOrder: vi.fn(),
  downloadFile: shared.downloadFileMock,
  loadAsset: async () => new Uint8Array(),
  LocalWriter: class LocalWriter {
    async init() {}
  },
  readImage: async () => new Uint8Array([1, 2, 3]),
  saveAsset: async () => "asset-id",
  VirtualWriter: class VirtualWriter {},
}));

vi.mock("src/ts/stores.svelte", async () => {
  const { writable } = await import("svelte/store");
  return {
    SettingsMenuIndex: writable(-1),
    settingsOpen: writable(false),
  };
});

vi.mock("src/ts/parser.svelte", () => ({
  checkImageType: () => "PNG",
  convertImage: async (data: Uint8Array) => data,
  hasher: async () => "hash",
}));

vi.mock("src/ts/process/files/inlays", () => ({
  reencodeImage: async (data: Uint8Array) => data,
}));

vi.mock("src/ts/pngChunk", () => ({
  PngChunk: {
    streamWriter: class StreamWriter {
      async init() {}
      async write() {}
      async end() {}
    },
  },
}));

vi.mock("src/ts/process/processzip", () => ({
  CharXImporter: class CharXImporter {},
  CharXSkippableChecker: async () => ({ success: false, hash: "" }),
  CharXWriter: class CharXWriter {
    async init() {}
    async write() {}
    async end() {}
  },
}));

vi.mock("src/ts/process/modules", () => ({
  exportModule: async () => new Uint8Array(),
  readModule: async () => ({}),
}));

function createCharacter(overrides: Record<string, unknown> = {}) {
  return {
    type: "character",
    name: "Exporter",
    desc: "desc",
    personality: "kind",
    scenario: "scene",
    firstMessage: "hello",
    exampleMessage: "example",
    creatorNotes: "",
    systemPrompt: "",
    replaceGlobalNote: "",
    alternateGreetings: [],
    tags: [],
    additionalData: {
      creator: "",
      character_version: "",
    },
    bias: [],
    viewScreen: "none",
    customscript: [],
    utilityBot: false,
    backgroundHTML: "",
    license: "",
    triggerscript: [],
    additionalText: "",
    randomAltFirstMessageOnNewChat: false,
    memoryPromptOverride: {
      summarizationPrompt: "Export prompt",
    },
    largePortrait: false,
    lorePlus: false,
    inlayViewScreen: false,
    newGenData: undefined,
    lowLevelAccess: false,
    defaultVariables: "",
    prebuiltAssetCommand: "",
    prebuiltAssetExclude: [],
    prebuiltAssetStyle: "",
    depth_prompt: {
      depth: 0,
      prompt: "",
    },
    group_only_greetings: [],
    nickname: "",
    source: [],
    creation_date: 0,
    ccAssets: [],
    additionalAssets: [],
    emotionImages: [],
    globalLore: [],
    loreSettings: {
      scanDepth: 0,
      tokenBudget: 0,
      recursiveScanning: false,
      fullWordMatching: false,
    },
    loreExt: {},
    extentions: {},
    image: "asset-id",
    ...overrides,
  };
}

describe("character card memory compatibility", () => {
  beforeEach(() => {
    globalThis.safeStructuredClone = structuredClone as typeof globalThis.safeStructuredClone;
    shared.db = {
      characters: [],
      statics: {
        imports: 0,
      },
    };
    shared.downloadFileMock.mockReset();
    shared.setDatabaseMock.mockReset();
    shared.setDatabaseLiteMock.mockReset();
    shared.alertNormalMock.mockReset();
  });

  it("exports canonical memory prompt override without legacy hypaV3 prompt fields", async () => {
    const { createBaseV3, exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter();

    const v3Card = createBaseV3(structuredClone(char) as never);
    expect(v3Card.data.extensions.risuai?.memoryPromptOverride).toEqual({
      summarizationPrompt: "Export prompt",
    });

    await exportCharacterCard(structuredClone(char) as never, "json", { spec: "v2" });
    expect(shared.downloadFileMock).toHaveBeenCalledTimes(1);

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));
    expect(exportedCard.data.extensions.risuai.memoryPromptOverride).toEqual({
      summarizationPrompt: "Export prompt",
    });
  });

  it("imports canonical memory prompt override", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Legacy Import",
        description: "desc",
        personality: "kind",
        scenario: "scene",
        first_mes: "hello",
        mes_example: "example",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: [],
        character_book: {
          scan_depth: 0,
          token_budget: 0,
          recursive_scanning: false,
          extensions: {},
          entries: [],
        },
        tags: [],
        creator: "",
        character_version: "",
        extensions: {
          risuai: {
            memoryPromptOverride: {
              summarizationPrompt: "Canonical prompt",
            },
          },
        },
        group_only_greetings: [],
        nickname: "",
        source: [],
        creation_date: 0,
        modification_date: 0,
        assets: [],
      },
    };

    const importedIndex = await importCharacterProcess({
      name: "canonical-card.json",
      data: new TextEncoder().encode(JSON.stringify(card)),
    });

    expect(importedIndex).toBe(0);
    expect(shared.setDatabaseMock).toHaveBeenCalledTimes(1);
    expect(shared.db.characters).toHaveLength(1);
    expect(
      (shared.db.characters[0]?.memoryPromptOverride as { summarizationPrompt?: string } | undefined)
        ?.summarizationPrompt,
    ).toBe("Canonical prompt");
  });
});
