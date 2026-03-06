import { beforeEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";

const shared = vi.hoisted(() => {
  const fetchMock = vi.fn();
  const resolveServerAuthTokenMock = vi.fn(async () => "digest-token");
  const getServerAuthClientIdMock = vi.fn(() => "client-id-1");
  const getDatabaseMock = vi.fn(() => ({
    usePlainFetch: false,
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
  DBState: { db: { requestLocation: "" } },
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

vi.mock("src/ts/tauriCompat/plugin-fs", () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(async () => new Uint8Array()),
  readDir: vi.fn(async () => []),
  remove: vi.fn(),
  BaseDirectory: {
    AppData: "AppData",
    Download: "Download",
  },
}));

vi.mock("src/ts/tauriCompat/api-core", () => ({
  convertFileSrc: (value: string) => value,
  invoke: vi.fn(),
}));

vi.mock("src/ts/tauriCompat/api-path", () => ({
  appDataDir: vi.fn(async () => "/tmp"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

vi.mock("src/ts/tauriCompat/plugin-shell", () => ({
  open: vi.fn(),
}));

vi.mock("src/ts/storage/risuSave", () => ({
  decodeRisuSave: vi.fn(async () => ({})),
  RisuSaveEncoder: class {
    async init() {}
    async set() {}
    encode() {
      return new Uint8Array([1]);
    }
  },
}));

vi.mock("src/ts/tauriCompat/plugin-dialog", () => ({
  save: vi.fn(async () => "/tmp/file"),
}));

vi.mock("src/ts/tauriCompat/api-event", () => ({
  listen: vi.fn(async () => {}),
}));

vi.mock("src/ts/alert", () => ({
  alertError: vi.fn(),
  alertNormal: vi.fn(),
  alertNormalWait: vi.fn(async () => {}),
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

vi.mock("src/lang", () => ({
  language: {
    activeTabChange: "active tab changed",
  },
}));

describe("globalApi auth scope", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.fetchMock.mockReset();
    shared.resolveServerAuthTokenMock.mockClear();
    shared.getServerAuthClientIdMock.mockClear();
    shared.getDatabaseMock.mockClear();
    shared.fetchMock.mockResolvedValue(
      new Response("{\"ok\":true}", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", shared.fetchMock);
  });

  it("globalFetch adds risu-auth only for local /data routes", async () => {
    const { globalFetch } = await import("src/ts/globalApi.svelte");

    await globalFetch("/data/state/snapshot", { method: "GET" });
    await globalFetch("/settings", { method: "GET" });

    const firstHeaders = (shared.fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
    const secondHeaders = (shared.fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;

    expect(firstHeaders["risu-auth"]).toBe("digest-token");
    expect(firstHeaders["x-risu-client-id"]).toBe("client-id-1");
    expect(secondHeaders["risu-auth"]).toBeUndefined();
    expect(secondHeaders["x-risu-client-id"]).toBeUndefined();
  });

  it("fetchNative mirrors /data-only auth header policy", async () => {
    const { fetchNative } = await import("src/ts/globalApi.svelte");

    await fetchNative("/data/llm/generate", { method: "GET" });
    await fetchNative("/llm/generate", { method: "GET" });

    const firstHeaders = (shared.fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
    const secondHeaders = (shared.fetchMock.mock.calls[1]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;

    expect(firstHeaders["risu-auth"]).toBe("digest-token");
    expect(firstHeaders["x-risu-client-id"]).toBe("client-id-1");
    expect(secondHeaders["risu-auth"]).toBeUndefined();
    expect(secondHeaders["x-risu-client-id"]).toBeUndefined();
  });

  it("globalFetch does not forward local auth headers for absolute non-local /data-like URLs", async () => {
    const { globalFetch } = await import("src/ts/globalApi.svelte");

    await globalFetch("https://example.com/data/state/snapshot", { method: "GET" });

    const proxyHeaders = (shared.fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as Record<string, string>;
    const forwardedHeaders = JSON.parse(decodeURIComponent(proxyHeaders["risu-header"] ?? "{}")) as Record<string, string>;

    expect(forwardedHeaders["risu-auth"]).toBeUndefined();
    expect(forwardedHeaders["x-risu-client-id"]).toBeUndefined();
  });

  it("globalFetch with usePlainFetch=true does not direct-fetch external OpenRouter URL in server mode", async () => {
    shared.getDatabaseMock.mockImplementation(() => ({
      usePlainFetch: true,
      requestLocation: "",
      characters: [],
      modules: [],
      personas: [],
      characterOrder: [],
      botPresets: [],
    }));
    const { globalFetch } = await import("src/ts/globalApi.svelte");

    const targetUrl = "https://openrouter.ai/api/v1/chat/completions";
    await globalFetch(targetUrl, { method: "POST", body: { ping: true } });

    const firstCallUrl = shared.fetchMock.mock.calls[0]?.[0];
    const firstCallInit = shared.fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const proxyHeaders = (firstCallInit?.headers ?? {}) as Record<string, string>;

    expect(firstCallUrl).toBe("/data/proxy");
    expect(decodeURIComponent(proxyHeaders["risu-url"])).toBe(targetUrl);
  });
});
