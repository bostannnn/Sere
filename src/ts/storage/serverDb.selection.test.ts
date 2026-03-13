import { beforeEach, describe, expect, it, vi } from "vitest";

type MockDb = {
  characters: Array<{
    chaId: string;
    type?: string;
    name?: string;
    note?: string;
    chats: Array<{
      id: string;
      name: string;
      note: string;
      message: Array<{ role: "user" | "char"; data: string }>;
    }>;
  }>;
  username: string;
  modules: unknown[];
  personas: unknown[];
  characterOrder: string[];
  botPresets: unknown[];
  memoryDebug?: boolean;
};

const shared = vi.hoisted(() => {
  let currentDb: MockDb | null = null;
  const enqueueCommandMock = vi.fn(async () => ({
    ok: true,
    lastEventId: 7,
    conflicts: [],
  }));
  const fetchServerStateSnapshotMock = vi.fn(async () => ({
    settings: {
      username: "User",
      modules: [],
      personas: [],
      characterOrder: ["char-1", "char-2"],
      botPresets: [],
    },
    characters: [
      {
        chaId: "char-1",
        type: "character",
        name: "Alpha",
        chats: [],
      },
      {
        chaId: "char-2",
        type: "character",
        name: "Beta",
        chats: [],
      },
    ],
    chatsByCharacter: {
      "char-1": [
        {
          id: "chat-1",
          name: "Chat One",
          note: "",
          message: [{ role: "user", data: "hello" }],
        },
      ],
      "char-2": [
        {
          id: "chat-2",
          name: "Chat Two",
          note: "",
          message: [{ role: "user", data: "world" }],
        },
      ],
    },
    lastEventId: 3,
  }));
  const getDatabaseMock = vi.fn(() => currentDb);
  const setDatabaseMock = vi.fn((db: MockDb) => {
    currentDb = db;
  });

  const setCurrentDb = (db: MockDb) => {
    currentDb = db;
  };

  return {
    enqueueCommandMock,
    fetchServerStateSnapshotMock,
    getDatabaseMock,
    setDatabaseMock,
    setCurrentDb,
  };
});

function getFirstCommandBatch() {
  expect(shared.enqueueCommandMock).toHaveBeenCalledTimes(1);
  const call = shared.enqueueCommandMock.mock.calls[0] as unknown as [{ commands?: unknown[] }] | undefined;
  return Array.isArray(call?.[0]?.commands) ? call[0].commands : [];
}

vi.mock("src/ts/platform", () => ({
  isNodeServer: true,
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: shared.getDatabaseMock,
  setDatabase: shared.setDatabaseMock,
}));

vi.mock("src/ts/storage/serverStateClient", () => ({
  enqueueCommand: shared.enqueueCommandMock,
  fetchServerStateSnapshot: shared.fetchServerStateSnapshotMock,
  getServerStateLastEventId: vi.fn(() => 0),
  setServerStateLastEventId: vi.fn(),
  startServerStateEventStream: vi.fn(),
  withApplyingServerSnapshot: vi.fn(async (run: () => Promise<unknown>) => await run()),
}));

function createLocalDb(): MockDb {
  return {
    username: "User",
    modules: [],
    personas: [],
    characterOrder: ["char-1", "char-2"],
    botPresets: [],
    characters: [
      {
        chaId: "char-1",
        type: "character",
        name: "Alpha",
        chats: [
          {
            id: "chat-1",
            name: "Chat One",
            note: "",
            message: [{ role: "user", data: "hello" }],
          },
        ],
      },
      {
        chaId: "char-2",
        type: "character",
        name: "Beta",
        chats: [
          {
            id: "chat-2",
            name: "Chat Two",
            note: "",
            message: [{ role: "user", data: "world" }],
          },
        ],
      },
    ],
  };
}

describe("saveServerDatabase partial selection", () => {
  beforeEach(async () => {
    vi.resetModules();
    shared.enqueueCommandMock.mockClear();
    shared.fetchServerStateSnapshotMock.mockClear();
    shared.getDatabaseMock.mockClear();
    shared.setDatabaseMock.mockClear();
    shared.setCurrentDb(createLocalDb());
    const mod = await import("src/ts/storage/serverDb");
    mod.resetServerBaseline();
  });

  it("sends only the targeted chat replacement for chat-scoped saves", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();
    const db = createLocalDb();
    db.characters[0].chats[0].message = [{ role: "user", data: "changed" }];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      settings: false,
      character: [],
      chat: [["char-1", "chat-1"]],
    });

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "chat.replace",
        charId: "char-1",
        chatId: "chat-1",
      }),
    );
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "settings.replace",
      }),
    );
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        charId: "char-2",
      }),
    );
  });

  it("supports settings-only partial saves without diffing characters", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();
    const db = createLocalDb();
    db.username = "Updated User";
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      settings: true,
      character: [],
      chat: [],
    });

    const commands = getFirstCommandBatch();
    expect(commands).toEqual([
      expect.objectContaining({
        type: "settings.replace",
      }),
    ]);
  });

  it("can delete a targeted character without forcing a full save", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();
    const db = createLocalDb();
    db.characters = db.characters.filter((entry) => entry.chaId !== "char-1");
    db.characterOrder = ["char-2"];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      settings: false,
      character: ["char-1"],
      chat: [],
    });

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "character.delete",
        charId: "char-1",
      }),
    );
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "settings.replace",
      }),
    );
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "character.order.replace",
      }),
    );
  });
});
