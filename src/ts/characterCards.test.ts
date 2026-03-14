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
  alertErrorMock: vi.fn(),
  alertNormalMock: vi.fn(),
  checkImageTypeMock: vi.fn(() => "PNG"),
  charXWrites: [] as Array<{ key: string; data: Uint8Array | string; level?: number }>,
  convertImageMock: vi.fn(async (data: Uint8Array) => data),
  readImageMock: vi.fn(async () => new Uint8Array([1, 2, 3])),
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
  alertError: shared.alertErrorMock,
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
    async write() {}
    async close() {}
  },
  readImage: shared.readImageMock,
  saveAsset: async () => "asset-id",
  VirtualWriter: class VirtualWriter {
    writes: Uint8Array[] = [];
    write(data: Uint8Array) {
      this.writes.push(data);
    }
    close() {}
  },
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
    async write(key: string, data: Uint8Array | string, level?: number) {
      shared.charXWrites.push({ key, data, level });
    }
    async end() {}
    async writeJpeg() {}
  },
}));

vi.mock("src/ts/process/modules", () => ({
  exportModule: async () => new Uint8Array(),
  readModule: async () => ({}),
}));

function createCharacter(overrides: Record<string, unknown> = {}) {
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
        message: [
          {
            role: "user",
            data: "Hello",
            chatId: "msg-1",
          },
        ],
        memoryData: {
          summaries: [{ text: "Summary 1", chatMemos: ["msg-1"], isImportant: false }],
        },
      },
      {
        id: "chat-2",
        name: "Chat 2",
        note: "",
        localLore: [],
        message: [
          {
            role: "char",
            data: "Reply",
            chatId: "msg-2",
          },
        ],
      },
    ],
    chatFolders: [
      {
        id: "folder-1",
        name: "Folder",
        folded: false,
      },
    ],
    chatPage: 1,
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
    shared.alertErrorMock.mockReset();
    shared.alertNormalMock.mockReset();
    shared.checkImageTypeMock.mockReset();
    shared.checkImageTypeMock.mockReturnValue("PNG");
    shared.charXWrites = [];
    shared.convertImageMock.mockReset();
    shared.convertImageMock.mockImplementation(async (data: Uint8Array) => data);
    shared.readImageMock.mockReset();
    shared.readImageMock.mockImplementation(async () => new Uint8Array([1, 2, 3]));
  });

  it("exports canonical memory prompt override without legacy prompt fields", async () => {
    const { createBaseV3, exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter();

    const v3Card = createBaseV3(structuredClone(char) as never);
    expect(v3Card.data.extensions.risuai?.memoryPromptOverride).toEqual({
      summarizationPrompt: "Export prompt",
    });

    await exportCharacterCard(structuredClone(char) as never, "json");
    expect(shared.downloadFileMock).toHaveBeenCalledTimes(1);

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));
    expect(exportedCard.data.extensions.risuai.memoryPromptOverride).toEqual({
      summarizationPrompt: "Export prompt",
    });
  });

  it("exports an empty character version when additional data is missing", async () => {
    const { createBaseV3 } = await import("src/ts/characterCards");
    const char = createCharacter({
      additionalData: undefined,
    });

    const v3Card = createBaseV3(structuredClone(char) as never);

    expect(v3Card.data.character_version).toBe("");
  });

  it("includes the main icon asset for avatar-only V3 exports", async () => {
    const { createBaseV3 } = await import("src/ts/characterCards");
    const char = createCharacter({
      ccAssets: [],
      emotionImages: [],
      image: "asset-id",
    });

    const v3Card = createBaseV3(structuredClone(char) as never);

    expect(v3Card.data.assets).toContainEqual({
      type: "icon",
      uri: "ccdefault:",
      name: "main",
      ext: "png",
    });
  });

  it("does not mutate lore extensions when creating a V3 card", async () => {
    const { createBaseV3 } = await import("src/ts/characterCards");
    const char = createCharacter({
      loreExt: undefined,
      loreSettings: {
        scanDepth: 0,
        tokenBudget: 0,
        recursiveScanning: false,
        fullWordMatching: true,
      },
    });

    const v3Card = createBaseV3(char as never);

    expect(char.loreExt).toBeUndefined();
    expect(v3Card.data.character_book?.extensions?.risu_fullWordMatching).toBe(true);
  });

  it("does not mutate the source character image during export", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter({
      image: "asset-id",
    });

    await exportCharacterCard(char as never, "json");

    expect(char.image).toBe("asset-id");
  });

  it("reports invalid image reads via alertError instead of throwing", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter({
      image: "broken-asset-id",
    });
    const imageError = new Error("Missing image");
    shared.readImageMock.mockRejectedValueOnce(imageError);

    await expect(exportCharacterCard(char as never, "json")).resolves.toBeUndefined();

    expect(shared.alertErrorMock).toHaveBeenCalledTimes(1);
    expect(shared.alertErrorMock).toHaveBeenCalledWith(imageError);
    expect(shared.downloadFileMock).not.toHaveBeenCalled();
  });

  it("shows the JSON export success alert only once", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter();

    await exportCharacterCard(structuredClone(char) as never, "json");

    expect(shared.downloadFileMock).toHaveBeenCalledTimes(1);
    expect(shared.alertNormalMock).toHaveBeenCalledTimes(1);
    expect(shared.alertNormalMock).toHaveBeenCalledWith("Exported");
  });

  it("imports an empty character version when the card omits it", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "No Version",
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
        extensions: {
          risuai: {},
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
      name: "missing-version-card.json",
      data: new TextEncoder().encode(JSON.stringify(card)),
    });

    expect(importedIndex).toBe(0);
    const importedChar = shared.db.characters[0] as Record<string, any>;
    expect(importedChar.characterVersion).toBe("");
    expect(importedChar.additionalData.character_version).toBe("");
  });

  it("exports JSON asset data URIs with a detected image mime type", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter({
      ccAssets: [
        {
          type: "icon",
          uri: "asset://icon",
          name: "Icon",
          ext: "png",
        },
      ],
    });

    await exportCharacterCard(structuredClone(char) as never, "json");

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));

    expect(exportedCard.data.assets[0].uri).toMatch(/^data:image\/png;base64,/);
    expect(exportedCard.data.assets[0].ext).toBe("png");
  });

  it("exports JSON asset metadata using the converted asset format when it changes", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    shared.convertImageMock.mockResolvedValueOnce(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    shared.checkImageTypeMock.mockReturnValue("JPEG");
    const char = createCharacter({
      ccAssets: [
        {
          type: "icon",
          uri: "asset://icon",
          name: "Icon",
          ext: "png",
        },
      ],
    });

    await exportCharacterCard(structuredClone(char) as never, "json");

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));

    expect(exportedCard.data.assets[0].uri).toMatch(/^data:image\/jpeg;base64,/);
    expect(exportedCard.data.assets[0].ext).toBe("jpeg");
  });

});
