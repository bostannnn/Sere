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
  },
  readImage: shared.readImageMock,
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

describe("character card import and bundle compatibility", () => {
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
    shared.convertImageMock.mockReset();
    shared.convertImageMock.mockImplementation(async (data: Uint8Array) => data);
    shared.readImageMock.mockReset();
    shared.readImageMock.mockImplementation(async () => new Uint8Array([1, 2, 3]));
  });

  it("exports JSON asset data URIs with an extension-based mime fallback", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    shared.checkImageTypeMock.mockReturnValue("Unknown");
    const char = createCharacter({
      ccAssets: [
        {
          type: "other",
          uri: "asset://audio",
          name: "Voice",
          ext: "ogg",
        },
      ],
    });

    await exportCharacterCard(structuredClone(char) as never, "json");

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));

    expect(exportedCard.data.assets[0].uri).toMatch(/^data:audio\/ogg;base64,/);
    expect(exportedCard.data.assets[0].ext).toBe("ogg");
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

  it("exports JSON bundles without memory data when memories are disabled", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter();

    await exportCharacterCard(structuredClone(char) as never, "json", {
      selection: {
        format: "json",
        includeChats: true,
        includeMemories: false,
        includeEvolution: true,
        cancelled: false,
      },
    });

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const exportedCard = JSON.parse(Buffer.from(exportedPayload).toString("utf-8"));
    const bundle = exportedCard.data.extensions.risuai.exportBundleV1;

    expect(bundle.selectedChatId).toBe("chat-2");
    expect(bundle.chats[0].memoryData).toBeUndefined();
    expect(bundle.chatFolders).toEqual([{ id: "folder-1", name: "Folder", folded: false }]);
    expect(bundle.characterEvolution).toEqual(char.characterEvolution);
  });

  it("round-trips bundled chats, memories, and evolution through JSON import", async () => {
    const { exportCharacterCard, importCharacterProcess } = await import("src/ts/characterCards");
    const char = createCharacter();

    await exportCharacterCard(structuredClone(char) as never, "json", {
      selection: {
        format: "json",
        includeChats: true,
        includeMemories: true,
        includeEvolution: true,
        cancelled: false,
      },
    });

    const exportedPayload = shared.downloadFileMock.mock.calls[0]?.[1];
    const importedIndex = await importCharacterProcess({
      name: "bundle-card.json",
      data: new Uint8Array(Buffer.from(exportedPayload)),
    });

    expect(importedIndex).toBe(0);
    expect(shared.db.characters).toHaveLength(1);

    const importedChar = shared.db.characters[0] as {
      chaId: string;
      image: string;
      chats: Array<{
        id: string;
        message: Array<{ chatId: string }>;
        memoryData: unknown;
      }>;
      chatPage: number;
      characterEvolution: unknown;
    };
    expect(importedChar.chaId).not.toBe("char-original");
    expect(importedChar.image).toBe("asset-id");
    expect(importedChar.chats[0].id).toBe("chat-1");
    expect(importedChar.chats[0].message[0].chatId).toBe("msg-1");
    expect(importedChar.chats[0].memoryData).toEqual({
      summaries: [{ text: "Summary 1", chatMemos: ["msg-1"], isImportant: false }],
    });
    expect(importedChar.chatPage).toBe(1);
    expect(importedChar.characterEvolution).toEqual(char.characterEvolution);
  });

  it("falls back to a default chat when bundle version is unknown", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Invalid Bundle",
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
            exportBundleV1: {
              version: 2,
              chats: [
                {
                  id: "chat-bad",
                  name: "Bad Chat",
                  note: "",
                  localLore: [],
                  message: [],
                },
              ],
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

    await importCharacterProcess({
      name: "invalid-bundle-card.json",
      data: new TextEncoder().encode(JSON.stringify(card)),
    });

    const importedChar = shared.db.characters[0] as {
      chats: Array<{
        message: unknown[];
        note: string;
        name: string;
        localLore: unknown[];
      }>;
    };
    expect(importedChar.chats).toEqual([
      {
        message: [],
        note: "",
        name: "Chat 1",
        localLore: [],
      },
    ]);
  });
});
