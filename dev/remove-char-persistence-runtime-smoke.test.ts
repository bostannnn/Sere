import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const db = {
    characters: [] as Array<{
      chaId: string;
      name: string;
      trashTime?: number;
      chats: Array<{ id: string; name: string; message: unknown[] }>;
    }>,
  };

  return {
    db,
    isDoingChatValue: false,
    isDoingChatStore: {
      subscribe(run: (value: boolean) => void) {
        run(mocks.isDoingChatValue);
        return () => {};
      },
      set(value: boolean) {
        mocks.isDoingChatValue = value;
      },
    },
    setDatabaseMock: vi.fn((nextDb: typeof db) => {
      mocks.db.characters = nextDb.characters;
    }),
    getDatabaseMock: vi.fn(() => ({
      characters: mocks.db.characters,
    })),
    checkCharOrderMock: vi.fn(),
    alertConfirmMock: vi.fn(async () => true),
    alertErrorMock: vi.fn(),
    saveServerDatabaseMock: vi.fn(async () => {}),
    selectedCharSetMock: vi.fn(),
  };
});

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  saveImage: vi.fn(),
  setDatabase: mocks.setDatabaseMock,
  getDatabase: mocks.getDatabaseMock,
  getCharacterByIndex: vi.fn(),
  setCharacterByIndex: vi.fn(),
}));

vi.mock(import("src/ts/alert"), () => ({
  alertAddCharacter: vi.fn(),
  alertConfirm: mocks.alertConfirmMock,
  alertError: mocks.alertErrorMock,
  alertNormal: vi.fn(),
  alertSelect: vi.fn(),
  alertStore: { set: vi.fn() },
  alertWait: vi.fn(),
}));

vi.mock(import("src/lang"), () => ({
  language: {
    removeConfirm: "remove ",
    removeConfirm2: "confirm ",
  },
}));

vi.mock(import("src/ts/util"), () => ({
  checkNullish: vi.fn(),
  findCharacterbyId: vi.fn(),
  getUserName: vi.fn(),
  selectMultipleFile: vi.fn(),
  selectSingleFile: vi.fn(),
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
}));

vi.mock("uuid", () => ({
  v4: () => "uuid",
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  MobileGUIStack: { set: vi.fn() },
  selectedCharID: { set: mocks.selectedCharSetMock },
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  AppendableBuffer: class AppendableBuffer {},
  changeChatTo: vi.fn(),
  checkCharOrder: mocks.checkCharOrderMock,
  downloadFile: vi.fn(),
  getFileSrc: vi.fn(),
  requiresFullEncoderReload: { state: false },
}));

vi.mock(import("src/ts/process/inlayScreen"), () => ({
  updateInlayScreen: vi.fn(),
}));

vi.mock(import("src/ts/parser.svelte"), () => ({
  checkImageType: vi.fn(),
  parseMarkdownSafe: vi.fn(),
}));

vi.mock(import("src/ts/translator/translator"), () => ({
  translateHTML: vi.fn(),
}));

vi.mock(import("src/ts/process/index.svelte"), () => ({
  isDoingChat: mocks.isDoingChatStore,
}));

vi.mock(import("src/ts/platform"), () => ({
  isNodeServer: true,
}));

vi.mock(import("src/ts/storage/serverDb"), () => ({
  saveServerDatabase: mocks.saveServerDatabaseMock,
}));

vi.mock(import("src/ts/characterCards"), () => ({
  importCharacter: vi.fn(),
}));

vi.mock(import("src/ts/pngChunk"), () => ({
  PngChunk: {},
}));

describe("removeChar persistence runtime smoke", () => {
  beforeEach(() => {
    mocks.db.characters = [
      {
        chaId: "char-1",
        name: "Alpha",
        trashTime: undefined,
        chats: [{ id: "chat-1", name: "Chat 1", message: [] }],
      },
      {
        chaId: "char-2",
        name: "Beta",
        trashTime: undefined,
        chats: [{ id: "chat-2", name: "Chat 2", message: [] }],
      },
    ];
    mocks.setDatabaseMock.mockClear();
    mocks.getDatabaseMock.mockClear();
    mocks.checkCharOrderMock.mockClear();
    mocks.alertConfirmMock.mockClear();
    mocks.alertErrorMock.mockClear();
    mocks.saveServerDatabaseMock.mockClear();
    mocks.selectedCharSetMock.mockClear();
    mocks.isDoingChatStore.set(false);
  });

  it("persists trash operation to server immediately", async () => {
    const { removeChar } = await import("src/ts/characters");

    await removeChar(0, "Alpha", "normal");

    expect(typeof mocks.db.characters[0]?.trashTime).toBe("number");
    expect(mocks.saveServerDatabaseMock).toHaveBeenCalledTimes(1);
    expect(mocks.saveServerDatabaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        characters: expect.arrayContaining([expect.objectContaining({ chaId: "char-1" })]),
      }),
      { character: ["char-1"], chat: [] },
    );
  });

  it("persists permanent delete reconciliation to server immediately", async () => {
    const { removeChar } = await import("src/ts/characters");

    await removeChar(0, "Alpha", "permanent");

    expect(mocks.db.characters.some((char) => char.chaId === "char-1")).toBe(false);
    expect(mocks.saveServerDatabaseMock).toHaveBeenCalledTimes(1);
    expect(mocks.saveServerDatabaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        characters: expect.arrayContaining([expect.objectContaining({ chaId: "char-2" })]),
      }),
      { character: [], chat: [] },
    );
  });

  it("defers forced server save while generation is active", async () => {
    vi.useFakeTimers();
    try {
      mocks.isDoingChatStore.set(true);
      const { removeChar } = await import("src/ts/characters");

      await removeChar(0, "Alpha", "permanent");
      expect(mocks.saveServerDatabaseMock).toHaveBeenCalledTimes(0);

      mocks.isDoingChatStore.set(false);
      await vi.advanceTimersByTimeAsync(300);
      expect(mocks.saveServerDatabaseMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
