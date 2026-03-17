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
  let lastEventId = 0;
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

  const getLastEventId = () => lastEventId;
  const setLastEventId = (next: number) => {
    lastEventId = next;
  };

  return {
    enqueueCommandMock,
    fetchServerStateSnapshotMock,
    getDatabaseMock,
    setDatabaseMock,
    setCurrentDb,
    getLastEventId,
    setLastEventId,
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
  getServerStateLastEventId: vi.fn(() => shared.getLastEventId()),
  setServerStateLastEventId: vi.fn((next: number) => shared.setLastEventId(next)),
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
    shared.setLastEventId(0);
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

  it("does not infer chat.delete from a targeted save when the local chat is missing", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();
    const db = createLocalDb();
    db.characters[0].chats = [];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      settings: false,
      character: [],
      chat: [["char-1", "chat-1"]],
    });

    const commands = getFirstCommandBatch();
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "chat.delete",
        charId: "char-1",
        chatId: "chat-1",
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
      deleteCharacter: ["char-1"],
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

  it("does not infer character.delete from a targeted save when the local character is missing", async () => {
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

    expect(shared.enqueueCommandMock).toHaveBeenCalledTimes(0);
  });

  it("uses the db snapshot passed to saveServerDatabase instead of later global state", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const intendedDb = createLocalDb();
    intendedDb.characters[0].name = "Updated Alpha";

    const unrelatedDb = createLocalDb();
    unrelatedDb.characters = unrelatedDb.characters.filter((entry) => entry.chaId !== "char-1");
    unrelatedDb.characterOrder = ["char-2"];
    shared.setCurrentDb(unrelatedDb);

    await mod.saveServerDatabase(intendedDb as never, {
      settings: false,
      character: ["char-1"],
      chat: [],
    });

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "character.replace",
        charId: "char-1",
      }),
    );
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "character.delete",
        charId: "char-1",
      }),
    );
  });

  it("does not infer character.delete during full saves when the local character is missing", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const db = createLocalDb();
    db.characters = db.characters.filter((entry) => entry.chaId !== "char-1");
    db.characterOrder = ["char-2"];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      full: true,
      character: [],
      chat: [],
    });

    const commands = getFirstCommandBatch();
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "character.delete",
        charId: "char-1",
      }),
    );
  });

  it("allows explicit character.delete during full saves when requested", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const db = createLocalDb();
    db.characters = db.characters.filter((entry) => entry.chaId !== "char-1");
    db.characterOrder = ["char-2"];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      full: true,
      character: [],
      chat: [],
      deleteCharacter: ["char-1"],
    });

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "character.delete",
        charId: "char-1",
      }),
    );
  });

  it("does not infer chat.delete during full saves when the local chat is missing", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const db = createLocalDb();
    db.characters[0].chats = [];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      full: true,
      character: [],
      chat: [],
    });

    const commands = getFirstCommandBatch();
    expect(commands).not.toContainEqual(
      expect.objectContaining({
        type: "chat.delete",
        charId: "char-1",
        chatId: "chat-1",
      }),
    );
  });

  it("allows explicit chat.delete when requested", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const db = createLocalDb();
    db.characters[0].chats = [];
    shared.setCurrentDb(db);

    await mod.saveServerDatabase(db as never, {
      character: ["char-1"],
      chat: [],
      deleteChat: [["char-1", "chat-1"]],
    });

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "chat.delete",
        charId: "char-1",
        chatId: "chat-1",
      }),
    );
  });

  it("exportServerStorage includes explicit deletes for characters missing locally", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const db = createLocalDb();
    db.characters = db.characters.filter((entry) => entry.chaId !== "char-1");
    db.characterOrder = ["char-2"];
    shared.setCurrentDb(db);

    await mod.exportServerStorage();

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "character.delete",
        charId: "char-1",
      }),
    );
  });

  it("exportServerStorage includes explicit deletes for chats missing locally", async () => {
    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();

    const db = createLocalDb();
    db.characters[0].chats = [];
    shared.setCurrentDb(db);

    await mod.exportServerStorage();

    const commands = getFirstCommandBatch();
    expect(commands).toContainEqual(
      expect.objectContaining({
        type: "chat.delete",
        charId: "char-1",
        chatId: "chat-1",
      }),
    );
  });

  it("throws a structured conflict error with the rejected command batch", async () => {
    shared.enqueueCommandMock.mockReset();
    shared.enqueueCommandMock.mockImplementation(async () => ({
      ok: false,
      lastEventId: 9,
      applied: [],
      conflicts: [
        {
          index: -1,
          code: "STALE_BASE_EVENT",
          details: {
            baseEventId: 3,
            currentLastEventId: 9,
          },
        },
      ],
    }));

    const mod = await import("src/ts/storage/serverDb");
    await mod.loadServerDatabase();
    const db = createLocalDb();
    db.characters = db.characters.filter((entry) => entry.chaId !== "char-1");
    db.characterOrder = ["char-2"];
    shared.setCurrentDb(db);

    let thrown: unknown = null;
    try {
      await mod.saveServerDatabase(db as never, {
        settings: true,
        character: ["char-1"],
        chat: [],
        deleteCharacter: ["char-1"],
      });
    } catch (error) {
      thrown = error;
    }

    expect(shared.enqueueCommandMock).toHaveBeenCalledTimes(3);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain("STALE_BASE_EVENT");
    expect((thrown as { status?: number }).status).toBe(409);
    expect((thrown as { result?: { baseEventId?: number } }).result?.baseEventId).toBe(3);
    expect((thrown as { result?: { commands?: Array<{ type?: string; charId?: string }> } }).result?.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "settings.replace" }),
        expect.objectContaining({ type: "character.delete", charId: "char-1" }),
      ]),
    );
  });
});
