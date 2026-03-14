import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  db: {
    characters: [] as Array<Record<string, unknown>>,
    statics: {
      imports: 0,
    },
  },
  downloadFileMock: vi.fn(),
  alertCardExportMock: vi.fn(async () => ({
    format: "json",
    includeChats: true,
    includeMemories: true,
    includeEvolution: true,
    cancelled: false,
  })),
  checkImageTypeMock: vi.fn(() => "PNG"),
  convertImageMock: vi.fn(async (data: Uint8Array) => data),
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
  alertCardExport: shared.alertCardExportMock,
  alertConfirm: vi.fn(),
  alertError: vi.fn(),
  alertInput: vi.fn(),
  alertNormal: vi.fn(),
  alertStore: {
    set: vi.fn(),
  },
  alertWait: vi.fn(),
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: () => shared.db,
  setDatabase: (next: Record<string, unknown>) => {
    shared.db = next as typeof shared.db;
  },
  setDatabaseLite: (next: Record<string, unknown>) => {
    shared.db = next as typeof shared.db;
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
  checkImageType: shared.checkImageTypeMock,
  convertImage: shared.convertImageMock,
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

function createCharacter() {
  return {
    type: "character",
    chaId: "char-original",
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
    chats: [
      {
        id: "chat-1",
        name: "Chat 1",
        note: "",
        localLore: [],
        message: [{ role: "user", data: "Hello", chatId: "msg-1" }],
        memoryData: {
          summaries: [{ text: "Summary 1", chatMemos: ["msg-1"], isImportant: false }],
        },
      },
    ],
    chatFolders: [],
    chatPage: 0,
    depth_prompt: { depth: 0, prompt: "" },
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
    characterEvolution: {
      enabled: true,
      currentStateVersion: 1,
      currentState: {
        relationship: {
          trustLevel: "steady",
          dynamic: "warm",
        },
      },
      stateVersions: [],
    },
  };
}

describe("character export bundle runtime smoke", () => {
  beforeEach(() => {
    globalThis.safeStructuredClone = structuredClone as typeof globalThis.safeStructuredClone;
    shared.downloadFileMock.mockReset();
    shared.checkImageTypeMock.mockReset();
    shared.checkImageTypeMock.mockReturnValue("PNG");
    shared.convertImageMock.mockReset();
    shared.convertImageMock.mockImplementation(async (data: Uint8Array) => data);
    shared.db = {
      characters: [createCharacter()],
      statics: {
        imports: 0,
      },
    };
  });

  it("round-trips a bundled character through exportChar and importCharacterProcess", async () => {
    const { exportChar, importCharacterProcess } = await import("src/ts/characterCards");

    await exportChar(0);
    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    await importCharacterProcess({
      name: "roundtrip.json",
      data: new Uint8Array(Buffer.from(exportedPayload)),
    });

    expect(shared.db.characters).toHaveLength(2);
    const importedChar = shared.db.characters[1] as Record<string, any>;
    expect(importedChar.chaId).not.toBe("char-original");
    expect(importedChar.image).toBe("asset-id");
    expect(importedChar.chats[0].id).toBe("chat-1");
    expect(importedChar.chats[0].message[0].chatId).toBe("msg-1");
    expect(importedChar.chats[0].memoryData).toEqual({
      summaries: [{ text: "Summary 1", chatMemos: ["msg-1"], isImportant: false }],
    });
    expect(importedChar.characterEvolution).toEqual({
      enabled: true,
      currentStateVersion: 1,
      currentState: {
        relationship: {
          trustLevel: "steady",
          dynamic: "warm",
        },
      },
      stateVersions: [],
    });
    expect(importedChar.ccAssets).toEqual([]);
  });

  it("preserves converted JSON asset extensions through export and import", async () => {
    const { exportChar, importCharacterProcess } = await import("src/ts/characterCards");
    shared.convertImageMock.mockResolvedValueOnce(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    shared.checkImageTypeMock.mockReturnValue("JPEG");
    shared.db.characters[0] = {
      ...shared.db.characters[0],
      ccAssets: [
        {
          type: "icon",
          uri: "asset://icon",
          name: "Icon",
          ext: "png",
        },
      ],
    };

    await exportChar(0);
    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));
    expect(exportedCard.data.assets[0].uri).toMatch(/^data:image\/jpeg;base64,/);
    expect(exportedCard.data.assets[0].ext).toBe("jpeg");

    await importCharacterProcess({
      name: "converted-roundtrip.json",
      data: new Uint8Array(Buffer.from(exportedPayload)),
    });

    const importedChar = shared.db.characters[1] as Record<string, any>;
    expect(importedChar.ccAssets[0]?.ext).toBe("jpeg");
  });
});
