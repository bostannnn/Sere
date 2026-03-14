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
  AppendableBufferClass: class AppendableBuffer {
    buffer = new Uint8Array();
  },
  checkImageTypeMock: vi.fn(() => "PNG"),
  charXWrites: [] as Array<{ key: string; data: Uint8Array | string; level?: number }>,
  convertImageMock: vi.fn(async (data: Uint8Array) => data),
  readGeneratorMock: vi.fn(),
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
  AppendableBuffer: shared.AppendableBufferClass,
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
    readGenerator: shared.readGeneratorMock,
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
    chats: [{
      id: "chat-1",
      name: "Chat 1",
      note: "",
      localLore: [],
      message: [{ role: "user", data: "Hello", chatId: "msg-1" }],
    }],
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
    ...overrides,
  };
}

describe("character card export/import contracts", () => {
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
    shared.readGeneratorMock.mockReset();
    shared.readImageMock.mockReset();
    shared.readImageMock.mockImplementation(async () => new Uint8Array([1, 2, 3]));
    window.history.replaceState(null, "", "http://localhost:3000/");
  });

  it("imports V3 cards that omit extensions entirely", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "No Extensions",
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
        group_only_greetings: [],
        nickname: "",
        source: [],
        creation_date: 0,
        modification_date: 0,
        assets: [],
      },
    };

    const importedIndex = await importCharacterProcess({
      name: "missing-extensions-card.json",
      data: new TextEncoder().encode(JSON.stringify(card)),
    });

    expect(importedIndex).toBe(0);
    const importedChar = shared.db.characters[0] as Record<string, unknown>;
    expect(importedChar.name).toBe("No Extensions");
    expect(shared.alertErrorMock).not.toHaveBeenCalled();
  });

  it("writes JSON exports to a provided writer instead of forcing a download", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    const char = createCharacter();
    const writer = {
      writes: [] as Uint8Array[],
      write(data: Uint8Array) {
        this.writes.push(data);
      },
      close() {},
    };

    await exportCharacterCard(structuredClone(char) as never, "json", {
      writer: writer as never,
    });

    expect(shared.downloadFileMock).not.toHaveBeenCalled();
    expect(writer.writes).toHaveLength(1);
    const exportedCard = JSON.parse(Buffer.from(writer.writes[0]).toString("utf-8"));
    expect(exportedCard.data.name).toBe("Exporter");
  });

  it("tracks successful uppercase JSON imports in import statistics", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Stats JSON",
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
      name: "stats-card.JSON",
      data: new TextEncoder().encode(JSON.stringify(card)),
    });

    expect(importedIndex).toBe(0);
    expect(shared.db.statics.imports).toBe(1);
  });

  it("handles malformed JSON imports without throwing", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");

    await expect(importCharacterProcess({
      name: "broken.JSON",
      data: new TextEncoder().encode("{bad"),
    })).resolves.toBeUndefined();

    expect(shared.alertErrorMock).toHaveBeenCalledWith("No data");
    expect(shared.db.statics.imports).toBe(0);
  });

  it("does not count failed imports in import statistics", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");

    const importedIndex = await importCharacterProcess({
      name: "not-a-character.txt",
      data: new TextEncoder().encode("not valid character data"),
    });

    expect(importedIndex).toBeUndefined();
    expect(shared.db.statics.imports).toBe(0);
  });

  it("routes extensionless shared JSON imports through the file-handoff path", async () => {
    const { characterURLImport } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v3",
      spec_version: "3.0",
      data: {
        name: "Shared JSON",
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

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(card), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })));
    window.history.replaceState(null, "", "http://localhost:3000/#import=http://localhost:3000/download");

    await characterURLImport();

    expect(shared.db.characters).toHaveLength(1);
    expect((shared.db.characters[0] as Record<string, unknown>).name).toBe("Shared JSON");
    expect(location.hash).toBe("");
  });

  it("keeps prebuiltAssetCommand boolean through V3 export and import", async () => {
    const { createBaseV3, importCharacterProcess } = await import("src/ts/characterCards");
    const exportedCard = createBaseV3(createCharacter({
      prebuiltAssetCommand: false,
    }) as never);

    expect(exportedCard.data.extensions.risuai.prebuiltAssetCommand).toBe(false);

    const importedIndex = await importCharacterProcess({
      name: "prebuilt-asset-flag.json",
      data: new TextEncoder().encode(JSON.stringify(exportedCard)),
    });

    expect(importedIndex).toBe(0);
    expect((shared.db.characters[0] as Record<string, unknown>).prebuiltAssetCommand).toBe(false);
  });

  it("counts successful legacy encrypted PNG imports", async () => {
    const { importCharacterProcess } = await import("src/ts/characterCards");
    const card = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Legacy PNG",
        description: "desc",
        personality: "kind",
        scenario: "scene",
        first_mes: "hello",
        mes_example: "",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "",
        character_version: "",
        extensions: {},
      },
    };
    const encryptedPayload = `rcc||rccv1||${Buffer.from(JSON.stringify(card)).toString("base64")}||hash||${Buffer.from(JSON.stringify({ usePassword: false })).toString("base64")}`;
    shared.readGeneratorMock.mockImplementation(async function* (_data: Uint8Array, options?: { returnTrimed?: boolean }) {
      if (options?.returnTrimed) {
        yield { key: "chara", value: encryptedPayload };
      }
      const imageChunk = new shared.AppendableBufferClass();
      imageChunk.buffer = new Uint8Array([1, 2, 3]);
      yield imageChunk;
    });

    const importedIndex = await importCharacterProcess({
      name: "legacy.png",
      data: new Uint8Array([1]),
    });

    expect(importedIndex).toBe(0);
    expect(shared.db.statics.imports).toBe(1);
  });

  it("updates CHARX asset extensions and paths when conversion changes the format", async () => {
    const { exportCharacterCard } = await import("src/ts/characterCards");
    shared.convertImageMock.mockResolvedValueOnce(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]));
    shared.checkImageTypeMock.mockReturnValue("JPEG");
    const char = createCharacter({
      ccAssets: [{
        type: "icon",
        uri: "asset://icon",
        name: "Icon",
        ext: "png",
      }],
    });

    await exportCharacterCard(structuredClone(char) as never, "charx", { writer: {} as never });

    const cardWrite = shared.charXWrites.find((entry) => entry.key === "card.json");
    expect(cardWrite).toBeDefined();
    const exportedCard = JSON.parse(Buffer.from(cardWrite?.data as Uint8Array).toString("utf-8"));
    expect(exportedCard.data.assets[0].ext).toBe("jpeg");
    expect(exportedCard.data.assets[0].uri).toMatch(/^embeded:\/\/assets\/icon\/image\/Icon\.jpeg$/);
    expect(shared.charXWrites.some((entry) => entry.key.endsWith(".jpeg"))).toBe(true);
  });
});
