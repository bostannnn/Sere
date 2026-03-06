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

describe("globalFetch external URL routing in server mode", () => {
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

  it("globalFetch routes absolute non-local URLs through /data/proxy even when usePlainFetch is true", async () => {
    const { globalFetch } = await import("src/ts/globalApi.svelte");

    const targetUrl = "https://openrouter.ai/api/v1/chat/completions";
    const result = await globalFetch(targetUrl, { method: "POST", body: { ping: true } });

    expect(result.ok).toBe(true);
    expect(shared.fetchMock).toHaveBeenCalledTimes(1);

    const firstCallUrl = shared.fetchMock.mock.calls[0]?.[0];
    const firstCallInit = shared.fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = (firstCallInit?.headers ?? {}) as Record<string, string>;

    expect(firstCallUrl).toBe("/data/proxy");
    expect(decodeURIComponent(headers["risu-url"])).toBe(targetUrl);
  });
});
