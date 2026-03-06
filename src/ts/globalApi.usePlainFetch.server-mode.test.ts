import { beforeEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";

const shared = vi.hoisted(() => {
  const fetchMock = vi.fn();
  const resolveServerAuthTokenMock = vi.fn(async () => "digest-token");
  const getServerAuthClientIdMock = vi.fn(() => "client-id-1");
  const getDatabaseMock = vi.fn(() => ({
    usePlainFetch: true,
    requestLocation: "",
    characters: [],
    modules: [],
    personas: [],
    characterOrder: [],
    botPresets: [],
  }));

  return {
    fetchMock,
    resolveServerAuthTokenMock,
    getServerAuthClientIdMock,
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
  getServerAuthClientId: shared.getServerAuthClientIdMock,
  resolveServerAuthToken: shared.resolveServerAuthTokenMock,
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  setDatabase: vi.fn(),
  getDatabase: shared.getDatabaseMock,
  appVer: "test",
  getCurrentCharacter: vi.fn(() => null),
}));

vi.mock("src/ts/stores.svelte", () => ({
  selectedCharID: writable(-1),
  DBState: { db: { requestLocation: "", characters: [] } },
  selIdState: { selId: -1 },
  ReloadGUIPointer: writable(0),
}));

vi.mock("src/ts/storage/serverStateClient", () => ({
  isApplyingServerSnapshot: () => false,
}));

vi.mock("src/ts/storage/serverDb", () => ({
  saveServerDatabase: vi.fn(async () => {}),
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

describe("globalFetch in server mode with usePlainFetch=true", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.fetchMock.mockReset();
    shared.getDatabaseMock.mockClear();
    shared.fetchMock.mockResolvedValue(
      new Response('{"ok":true}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", shared.fetchMock);
  });

  it("globalFetch does not hard-fail local /data routes when usePlainFetch is true in server mode", async () => {
    const { globalFetch } = await import("src/ts/globalApi.svelte");

    const result = await globalFetch("/data/settings", { method: "GET" });

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(shared.fetchMock).toHaveBeenCalledTimes(1);
  });
});
