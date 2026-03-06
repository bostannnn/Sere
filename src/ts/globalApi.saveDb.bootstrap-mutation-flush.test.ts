import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";
import { resetSaveDbRuntimeForTests } from "src/ts/globalApi.test-utils";

const shared = vi.hoisted(() => {
  const saveServerDatabaseMock = vi.fn(async () => {});
  const getDatabaseMock = vi.fn(() => ({
    usePlainFetch: false,
    requestLocation: "",
    characters: [
      {
        chaId: "boot-assigned-char-id",
        chats: [{ id: "boot-assigned-chat-id" }],
      },
    ],
    modules: [],
    personas: [],
    characterOrder: [],
    botPresets: [],
  }));

  return {
    saveServerDatabaseMock,
    getDatabaseMock,
  };
});

vi.mock("src/ts/platform", () => ({
  isNodeServer: true,
  isTauri: false,
  isIOS: () => false,
}));

vi.mock("src/ts/storage/serverAuth", () => ({
  fetchWithServerAuth: vi.fn(),
  getServerAuthClientId: vi.fn(() => "client-id-1"),
  resolveServerAuthToken: vi.fn(async () => "digest-token"),
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  setDatabase: vi.fn(),
  getDatabase: shared.getDatabaseMock,
  appVer: "test",
  getCurrentCharacter: vi.fn(() => null),
}));

vi.mock("src/ts/stores.svelte", () => ({
  DBState: {
    db: {
      requestLocation: "",
      characters: [
        {
          chaId: "boot-assigned-char-id",
          chats: [{ id: "boot-assigned-chat-id" }],
        },
      ],
      modules: [],
      personas: [],
      characterOrder: [],
      botPresets: [],
    },
  },
  selIdState: { selId: -1 },
  ReloadGUIPointer: writable(0),
}));

vi.mock("src/ts/storage/serverStateClient", () => ({
  isApplyingServerSnapshot: () => false,
}));

vi.mock("src/ts/storage/serverDb", () => ({
  saveServerDatabase: shared.saveServerDatabaseMock,
}));

vi.mock("src/ts/storage/serverStorage", () => ({
  loadServerAsset: vi.fn(async () => new Uint8Array()),
  saveServerAsset: vi.fn(async () => "assets/x.png"),
}));

vi.mock("src/ts/storage/autoStorage", () => ({
  AutoStorage: class {
    isAccount = false;
    async getItem() {
      return new Uint8Array();
    }
    async setItem(key: string) {
      return key;
    }
    async removeItem() {}
    async keys() {
      return [];
    }
  },
}));

vi.mock("src/ts/alert", () => ({
  alertError: vi.fn(),
  alertNormal: vi.fn(),
  alertSelect: vi.fn(async () => "0"),
}));

vi.mock("src/ts/parser.svelte", () => ({
  hasher: vi.fn(async () => "hash"),
  ParseMarkdown: () => "",
  checkImageType: () => true,
  convertImage: async () => "",
  parseMarkdownSafe: (value: string) => value,
  risuChatParser: {
    parse: (value: string) => value,
  },
}));

vi.mock("src/ts/characterCards", () => ({
  hubURL: "https://hub.invalid",
}));

describe("saveDb bootstrap mutation flush", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    shared.saveServerDatabaseMock.mockClear();
    shared.getDatabaseMock.mockClear();
  });

  afterEach(async () => {
    await import("src/ts/globalApi.svelte");
    resetSaveDbRuntimeForTests();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("saveDb flushes boot-time assignIds mutations without waiting for a second user mutation", async () => {
    const mod = await import("src/ts/globalApi.svelte");

    await mod.saveDb();
    await vi.advanceTimersByTimeAsync(260);

    expect(shared.saveServerDatabaseMock).toHaveBeenCalledTimes(1);
  });
});
