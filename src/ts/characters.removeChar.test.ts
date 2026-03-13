import { beforeEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";

const mocks = vi.hoisted(() => {
  const state = {
    db: {
      characters: [
        {
          chaId: "char-1",
          name: "Alpha",
          chats: [],
        },
      ] as Array<Record<string, unknown>>,
    },
  };

  return {
    state,
    setDatabase: vi.fn((nextDb: Record<string, unknown>) => {
      state.db = nextDb as typeof state.db;
    }),
    saveServerDatabase: vi.fn(async () => {}),
    alertConfirm: vi.fn(async () => true),
    alertError: vi.fn(),
    selectedCharIDSet: vi.fn(),
    checkCharOrder: vi.fn(),
  };
});

vi.mock("./storage/database.svelte", () => ({
  saveImage: vi.fn(),
  setDatabase: mocks.setDatabase,
  getDatabase: () => mocks.state.db,
  getCharacterByIndex: vi.fn(),
  setCharacterByIndex: vi.fn(),
}));

vi.mock("./alert", () => ({
  alertAddCharacter: vi.fn(),
  alertConfirm: mocks.alertConfirm,
  alertError: mocks.alertError,
  alertNormal: vi.fn(),
  alertSelect: vi.fn(),
  alertStore: writable(null),
  alertWait: vi.fn(),
}));

vi.mock("../lang", () => ({
  language: {
    removeConfirm: "Remove ",
    removeConfirm2: "Really remove ",
  },
}));

vi.mock("./util", () => ({
  checkNullish: vi.fn(),
  findCharacterbyId: vi.fn(),
  getUserName: vi.fn(),
  selectMultipleFile: vi.fn(),
  selectSingleFile: vi.fn(),
  sleep: vi.fn(async () => {}),
}));

vi.mock("./stores.svelte", () => ({
  selectedCharID: {
    set: mocks.selectedCharIDSet,
  },
}));

vi.mock("./globalApi.svelte", () => ({
  AppendableBuffer: class {},
  changeChatTo: vi.fn(),
  checkCharOrder: mocks.checkCharOrder,
  downloadFile: vi.fn(),
  getFileSrc: vi.fn(),
  requiresFullEncoderReload: { state: false },
}));

vi.mock("./process/inlayScreen", () => ({
  updateInlayScreen: vi.fn((value: unknown) => value),
}));

vi.mock("./parser.svelte", () => ({
  checkImageType: vi.fn(),
  parseMarkdownSafe: vi.fn((value: string) => value),
}));

vi.mock("./translator/translator", () => ({
  translateHTML: vi.fn(),
}));

vi.mock("./process/index.svelte", () => ({
  isDoingChat: writable(false),
}));

vi.mock("./platform", () => ({
  isNodeServer: true,
}));

vi.mock("./storage/serverDb", () => ({
  saveServerDatabase: mocks.saveServerDatabase,
}));

vi.mock("./characterCards", () => ({
  importCharacter: vi.fn(),
}));

vi.mock("./newChatFirstMessage", () => ({
  getNewChatFirstMessageIndex: vi.fn(() => -1),
}));

vi.mock("./pngChunk", () => ({
  PngChunk: {
    readGenerator: vi.fn(),
  },
}));

vi.mock("./process/memory/storage", () => ({
  getCharacterMemoryPromptOverride: vi.fn(),
  setCharacterMemoryPromptOverride: vi.fn(),
}));

describe("removeChar", () => {
  beforeEach(() => {
    mocks.setDatabase.mockClear();
    mocks.saveServerDatabase.mockReset();
    mocks.saveServerDatabase.mockResolvedValue(undefined);
    mocks.alertConfirm.mockClear();
    mocks.alertError.mockClear();
    mocks.selectedCharIDSet.mockClear();
    mocks.checkCharOrder.mockClear();
    mocks.state.db = {
      characters: [
        {
          chaId: "char-1",
          name: "Alpha",
          chats: [],
        },
      ],
    };
  });

  it("keeps the deleted character id in the permanent server save payload", async () => {
    const mod = await import("./characters");

    await mod.removeChar(0, "Alpha", "permanent");

    expect(mocks.saveServerDatabase).toHaveBeenCalledWith(
      expect.objectContaining({
        characters: [],
      }),
      expect.objectContaining({
        settings: true,
        character: ["char-1"],
        chat: [],
      }),
    );
  });
});
