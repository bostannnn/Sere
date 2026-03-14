import { describe, expect, it } from "vitest";
import {
  applyCharacterExportBundle,
  readCharacterExportBundle,
  resolveImportedChatPage,
} from "./cardBundleImport";

function createCharacter(overrides: Record<string, unknown> = {}) {
  return {
    chats: [
      {
        id: "default-chat",
        name: "Chat 1",
        note: "",
        localLore: [],
        message: [],
      },
    ],
    chatFolders: [],
    chatPage: 0,
    characterEvolution: undefined,
    ...overrides,
  };
}

describe("card bundle import helpers", () => {
  it("rejects malformed bundle versions", () => {
    expect(readCharacterExportBundle({ version: 2, chats: [] })).toBeUndefined();
  });

  it("resolves imported chat page from selected chat id", () => {
    expect(resolveImportedChatPage([
      { id: "chat-1" },
      { id: "chat-2" },
    ] as never, "chat-2")).toBe(1);
    expect(resolveImportedChatPage([
      { id: "chat-1" },
    ] as never, "missing")).toBe(0);
  });

  it("applies bundled chats, folders, and evolution while preserving ids", () => {
    const char = createCharacter();
    applyCharacterExportBundle(char as never, {
      version: 1,
      chats: [
        {
          id: "chat-1",
          name: "Imported",
          note: "",
          localLore: [],
          message: [{ role: "user", data: "Hello", chatId: "msg-1" }],
          memoryData: {
            summaries: [{ text: "Summary", chatMemos: ["msg-1"], isImportant: false }],
          },
        },
      ],
      chatFolders: [{ id: "folder-1", folded: false, name: "Folder" }],
      selectedChatId: "chat-1",
      characterEvolution: {
        enabled: true,
      },
    });

    expect(char.chats).toHaveLength(1);
    expect(char.chats[0]?.id).toBe("chat-1");
    expect(char.chats[0]?.message?.[0]?.chatId).toBe("msg-1");
    expect(char.chatFolders).toEqual([{ id: "folder-1", folded: false, name: "Folder" }]);
    expect(char.chatPage).toBe(0);
    expect(char.characterEvolution).toEqual({ enabled: true });
  });
});
