import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("reconciles removed server characters through state command API", async () => {
    let commandsRequest: {
      clientMutationId?: string;
      baseEventId?: number;
      commands?: Array<{ type?: string; charId?: string }>;
    } | null = null;

    fetchWithServerAuthMock.mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init.method ?? "GET").toUpperCase();

      if (url === "/data/state/snapshot" && method === "GET") {
        return jsonResponse({
          serverTime: Date.now(),
          lastEventId: 5,
          settings: {},
          characters: [
            { chaId: "char-keep", chatPage: 0, chatFolders: [] },
            { chaId: "char-removed", chatPage: 0, chatFolders: [] },
          ],
          chatsByCharacter: {
            "char-keep": [],
            "char-removed": [],
          },
          revisions: {
            settings: 1,
            characters: {
              "char-keep": 1,
              "char-removed": 1,
            },
            chats: {
              "char-keep": {},
              "char-removed": {},
            },
          },
        });
      }

      if (url === "/data/state/commands" && method === "POST") {
        commandsRequest = JSON.parse(String(init.body ?? "{}"));
        return jsonResponse({
          ok: true,
          lastEventId: 6,
          applied: [
            {
              index: 0,
              type: "character.delete",
              resource: { type: "character", charId: "char-removed" },
              revision: 0,
              eventId: 6,
            },
          ],
          conflicts: [],
        });
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
            chatPage: 0,
            chatFolders: [],
          },
        ],
      } as never,
      {
        character: [],
        chat: [],
      },
    );

    const postedCommands = Array.isArray(commandsRequest?.commands) ? commandsRequest.commands : [];
    expect(postedCommands.some((entry) => entry?.type === "character.delete" && entry?.charId === "char-removed")).toBe(true);
  });
});
