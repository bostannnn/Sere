import { describe, expect, it, vi, beforeEach } from "vitest";

const { fetchWithServerAuthMock, getDatabaseMock, setDatabaseMock } = vi.hoisted(() => ({
  fetchWithServerAuthMock: vi.fn(),
  getDatabaseMock: vi.fn(() => ({ characters: [] })),
  setDatabaseMock: vi.fn(),
}));

vi.mock(import("src/ts/platform"), () => ({
  isNodeServer: true,
}));

vi.mock(import("src/ts/storage/serverAuth"), () => ({
  fetchWithServerAuth: fetchWithServerAuthMock,
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  getDatabase: getDatabaseMock,
  setDatabase: setDatabaseMock,
}));

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
  });
}

describe("server db runtime smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchWithServerAuthMock.mockReset();
    getDatabaseMock.mockClear();
    setDatabaseMock.mockClear();
  });

  it("reconciles and deletes removed server characters even when no character id is queued for save", async () => {
    fetchWithServerAuthMock.mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init.method ?? "GET").toUpperCase();

      if (url === "/data/settings" && method === "PUT") {
        return jsonResponse({ ok: true }, 200, { etag: "\"settings-etag\"" });
      }

      if (url === "/data/characters" && method === "GET") {
        return jsonResponse([
          { id: "char-keep" },
          { id: "char-removed" },
        ]);
      }

      if (url === "/data/characters/char-removed" && method === "GET") {
        return jsonResponse({ character: { chaId: "char-removed" } }, 200, { etag: "\"char-removed-etag\"" });
      }

      if (url === "/data/characters/char-removed" && method === "DELETE") {
        const ifMatch = new Headers(init.headers ?? {}).get("if-match");
        expect(ifMatch).toBe("\"char-removed-etag\"");
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { saveServerDatabase } = await import("src/ts/storage/serverDb");
    await saveServerDatabase(
      {
        characters: [
          {
            chaId: "char-keep",
            chats: [],
          },
        ],
      } as never,
      {
        character: [],
        chat: [],
      },
    );

    const deleteRequests = fetchWithServerAuthMock.mock.calls.filter(([input, init]) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = ((init as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return url === "/data/characters/char-removed" && method === "DELETE";
    });
    expect(deleteRequests).toHaveLength(1);
  });
});
