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

  it("does not persist chat selection-only changes (chatPage) to server commands", async () => {
    let postedCommandsCount = 0;
    let postedCommandsRequest: {
      commands?: Array<{ type?: string; character?: Record<string, unknown> }>;
    } | null = null;

    fetchWithServerAuthMock.mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init.method ?? "GET").toUpperCase();

      if (url === "/data/state/snapshot" && method === "GET") {
        return jsonResponse({
          serverTime: Date.now(),
          lastEventId: 12,
          settings: {},
          characters: [
            { chaId: "char-keep", chatPage: 1, chatFolders: [], chatOrder: ["chat-a", "chat-b"] },
          ],
          chatsByCharacter: {
            "char-keep": [
              { id: "chat-a", name: "A", message: [] },
              { id: "chat-b", name: "B", message: [] },
            ],
          },
          revisions: {
            settings: 1,
            characters: { "char-keep": 1 },
            chats: { "char-keep": { "chat-a": 1, "chat-b": 1 } },
          },
        });
      }

      if (url === "/data/state/commands" && method === "POST") {
        postedCommandsCount += 1;
        postedCommandsRequest = JSON.parse(String(init.body ?? "{}"));
        return jsonResponse({
          ok: true,
          lastEventId: 13,
          applied: [],
          conflicts: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { loadServerDatabase, saveServerDatabase } = await import("src/ts/storage/serverDb");
    await loadServerDatabase();

    await saveServerDatabase(
      {
        characters: [
          {
            chaId: "char-keep",
            chats: [
              { id: "chat-a", name: "A", message: [] },
              { id: "chat-b", name: "B", message: [] },
            ],
            chatPage: 0, // selection-only difference from server snapshot
            chatFolders: [],
          },
        ],
      } as never,
      {
        character: [],
        chat: [],
      },
    );

    expect(postedCommandsCount).toBeLessThanOrEqual(1);
    const postedCommands = Array.isArray(postedCommandsRequest?.commands) ? postedCommandsRequest.commands : [];
    const characterReplace = postedCommands.find((entry) => entry?.type === "character.replace");
    if (characterReplace?.character && typeof characterReplace.character === "object") {
      expect("chatPage" in characterReplace.character).toBe(false);
    }
  });

  it("does not persist memory debug-only changes as settings.replace", async () => {
    let postedCommandsCount = 0;
    let postedCommandsRequest: {
      commands?: Array<{ type?: string }>;
    } | null = null;

    const localDb: any = {
      memoryPresetId: 0,
      memoryPresets: [
        {
          name: "Default",
          settings: {
            summarizationModel: "subModel",
            summarizationPrompt: "",
            memoryTokensRatio: 0.12,
            maxChatsPerSummary: 24,
            maxSelectedSummaries: 4,
            periodicSummarizationEnabled: true,
            periodicSummarizationInterval: 24,
            recentSummarySlots: 3,
            similarSummarySlots: 1,
            recentMemoryRatio: 0.75,
            similarMemoryRatio: 0.25,
            processRegexScript: false,
            doNotSummarizeUserMessage: false,
          },
        },
      ],
      characters: [],
    };
    getDatabaseMock.mockImplementation(() => localDb);

    fetchWithServerAuthMock.mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init.method ?? "GET").toUpperCase();

      if (url === "/data/state/snapshot" && method === "GET") {
        return jsonResponse({
          serverTime: Date.now(),
          lastEventId: 30,
          settings: {
            memoryPresetId: 0,
            memoryPresets: localDb.memoryPresets,
          },
          characters: [],
          chatsByCharacter: {},
          revisions: {
            settings: 1,
            characters: {},
            chats: {},
          },
        });
      }

      if (url === "/data/state/commands" && method === "POST") {
        postedCommandsCount += 1;
        postedCommandsRequest = JSON.parse(String(init.body ?? "{}"));
        return jsonResponse({
          ok: true,
          lastEventId: 31,
          applied: [],
          conflicts: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { loadServerDatabase, saveServerDatabase } = await import("src/ts/storage/serverDb");
    await loadServerDatabase();

    localDb.memoryDebug = {
      timestamp: Date.now(),
      model: "openrouter/deepseek",
      prompt: "debug only",
      input: "",
      formatted: [],
    };

    await saveServerDatabase(localDb, {
      character: [],
      chat: [],
    });

    expect(postedCommandsCount).toBe(0);
    const postedCommands = Array.isArray(postedCommandsRequest?.commands) ? postedCommandsRequest.commands : [];
    expect(postedCommands.some((entry) => entry?.type === "settings.replace")).toBe(false);
  });

  it("does not lose queued chat creates when local db mutates during an in-flight save", async () => {
    const localDb: any = {
      characters: [
        {
          chaId: "char-keep",
          chats: [
            { id: "chat-a", name: "A", message: [] },
          ],
          chatPage: 0,
          chatFolders: [],
        },
      ],
    };
    getDatabaseMock.mockImplementation(() => localDb);

    const postedRequests: Array<{ commands?: Array<{ type?: string; charId?: string; chatId?: string }> }> = [];

    fetchWithServerAuthMock.mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init.method ?? "GET").toUpperCase();

      if (url === "/data/state/snapshot" && method === "GET") {
        return jsonResponse({
          serverTime: Date.now(),
          lastEventId: 20,
          settings: {},
          characters: [
            { chaId: "char-keep", chatPage: 0, chatFolders: [], chatOrder: ["chat-a"] },
          ],
          chatsByCharacter: {
            "char-keep": [
              { id: "chat-a", name: "A", message: [] },
            ],
          },
          revisions: {
            settings: 1,
            characters: { "char-keep": 1 },
            chats: { "char-keep": { "chat-a": 1 } },
          },
        });
      }

      if (url === "/data/state/commands" && method === "POST") {
        const body = JSON.parse(String(init.body ?? "{}"));
        postedRequests.push(body);

        if (postedRequests.length === 1) {
          // Simulate user action while request #1 is still in-flight.
          localDb.characters[0].chats.unshift({ id: "chat-c", name: "C", message: [] });
        }

        return jsonResponse({
          ok: true,
          lastEventId: 20 + postedRequests.length,
          applied: [],
          conflicts: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { saveServerDatabase } = await import("src/ts/storage/serverDb");

    // First mutation.
    localDb.characters[0].chats.unshift({ id: "chat-b", name: "B", message: [] });
    await saveServerDatabase(localDb, {
      character: [],
      chat: [],
    });

    // Flush the mutation created during request #1.
    await saveServerDatabase(localDb, {
      character: [],
      chat: [],
    });

    const firstCommands = postedRequests[0]?.commands ?? [];
    const secondCommands = postedRequests[1]?.commands ?? [];

    expect(firstCommands.some((entry) => entry?.type === "chat.create" && entry?.chatId === "chat-b")).toBe(true);
    expect(secondCommands.some((entry) => entry?.type === "chat.create" && entry?.chatId === "chat-c")).toBe(true);
  });

  it("includes character.replace when chat structure changes to persist chatOrder", async () => {
    let postedRequest: { commands?: Array<{ type?: string; charId?: string; chatId?: string }> } | null = null;

    fetchWithServerAuthMock.mockImplementation(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init.method ?? "GET").toUpperCase();

      if (url === "/data/state/snapshot" && method === "GET") {
        return jsonResponse({
          serverTime: Date.now(),
          lastEventId: 30,
          settings: {},
          characters: [
            { chaId: "char-keep", chatPage: 0, chatFolders: [], chatOrder: ["chat-a"] },
          ],
          chatsByCharacter: {
            "char-keep": [
              { id: "chat-a", name: "A", message: [] },
            ],
          },
          revisions: {
            settings: 1,
            characters: { "char-keep": 1 },
            chats: { "char-keep": { "chat-a": 1 } },
          },
        });
      }

      if (url === "/data/state/commands" && method === "POST") {
        postedRequest = JSON.parse(String(init.body ?? "{}"));
        return jsonResponse({
          ok: true,
          lastEventId: 31,
          applied: [],
          conflicts: [],
        });
      }

      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const { loadServerDatabase, saveServerDatabase } = await import("src/ts/storage/serverDb");
    await loadServerDatabase();

    await saveServerDatabase(
      {
        characters: [
          {
            chaId: "char-keep",
            chats: [
              { id: "chat-b", name: "B", message: [] },
              { id: "chat-a", name: "A", message: [] },
            ],
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

    const commands = Array.isArray(postedRequest?.commands) ? postedRequest.commands : [];
    const createChatB = commands.find((entry) => entry?.type === "chat.create" && entry?.chatId === "chat-b");
    const replaceCharacter = commands.find((entry) => entry?.type === "character.replace" && entry?.charId === "char-keep");

    expect(createChatB).toBeTruthy();
    expect(replaceCharacter).toBeTruthy();
  });
});
