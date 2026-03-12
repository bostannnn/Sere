import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    db: {
      characters: [] as Array<Record<string, unknown>>,
    },
  };

  return {
    state,
    setDatabase: vi.fn((nextDb: Record<string, unknown>) => {
      state.db = nextDb as typeof state.db;
    }),
    saveServerDatabase: vi.fn(async () => {}),
    changeChatTo: vi.fn(),
  };
});

vi.mock("uuid", () => ({
  v4: () => "chat-new",
}));

vi.mock("./storage/database.svelte", () => ({
  getDatabase: () => mocks.state.db,
  setDatabase: mocks.setDatabase,
}));

vi.mock("./storage/serverDb", () => ({
  saveServerDatabase: mocks.saveServerDatabase,
}));

vi.mock("./globalApi.svelte", () => ({
  globalFetch: vi.fn(),
  changeChatTo: mocks.changeChatTo,
}));

import { createNewChatAfterEvolution } from "./evolution";

describe("createNewChatAfterEvolution", () => {
  beforeEach(() => {
    mocks.setDatabase.mockClear();
    mocks.saveServerDatabase.mockReset();
    mocks.saveServerDatabase.mockResolvedValue(undefined);
    mocks.changeChatTo.mockClear();
    mocks.state.db = {
      characters: [
        {
          chaId: "char-1",
          type: "character",
          name: "Eva",
          firstMsgIndex: -1,
          randomAltFirstMessageOnNewChat: false,
          alternateGreetings: [],
          chatPage: 0,
          chats: [
            {
              id: "chat-1",
              name: "Existing Chat",
              message: [],
              note: "",
              localLore: [],
              fmIndex: -1,
            },
          ],
        },
      ],
    };
  });

  it("rolls back the local chat when persistence fails", async () => {
    mocks.saveServerDatabase.mockRejectedValueOnce(new Error("save failed"));

    await expect(createNewChatAfterEvolution(0)).rejects.toThrow("save failed");

    expect(mocks.state.db.characters[0]?.chats).toEqual([
      {
        id: "chat-1",
        name: "Existing Chat",
        message: [],
        note: "",
        localLore: [],
        fmIndex: -1,
      },
    ]);
    expect(mocks.state.db.characters[0]?.chatPage).toBe(0);
    expect(mocks.changeChatTo).toHaveBeenLastCalledWith(0);
  });
});
