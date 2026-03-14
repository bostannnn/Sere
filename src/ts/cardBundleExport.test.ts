import { describe, expect, it } from "vitest";
import { buildCharacterExportBundle } from "./cardBundleExport";

function createCharacter(overrides: Record<string, unknown> = {}) {
  return {
    name: "Exporter",
    chats: [
      {
        id: "chat-1",
        name: "Chat 1",
        note: "",
        localLore: [],
        message: [],
        memoryData: {
          summaries: [{ text: "Summary", chatMemos: ["memo-1"], isImportant: false }],
        },
      },
      {
        id: "chat-2",
        name: "Chat 2",
        note: "",
        localLore: [],
        message: [],
      },
    ],
    chatFolders: [{ id: "folder-1", folded: false, name: "Folder" }],
    chatPage: 1,
    characterEvolution: {
      enabled: true,
      currentStateVersion: 1,
      currentState: {
        relationship: { trustLevel: "high", dynamic: "warm" },
      },
    },
    ...overrides,
  };
}

describe("buildCharacterExportBundle", () => {
  it("omits the bundle when no JSON bundle options are selected", () => {
    const bundle = buildCharacterExportBundle(createCharacter() as never, {
      format: "charxJpeg",
      includeChats: true,
      includeMemories: true,
      includeEvolution: true,
      cancelled: false,
    });

    expect(bundle).toBeUndefined();
  });

  it("exports chats without memory data when memories are disabled", () => {
    const bundle = buildCharacterExportBundle(createCharacter() as never, {
      format: "json",
      includeChats: true,
      includeMemories: false,
      includeEvolution: false,
      cancelled: false,
    });

    expect(bundle?.version).toBe(1);
    expect(bundle?.selectedChatId).toBe("chat-2");
    expect(bundle?.chatFolders).toEqual([{ id: "folder-1", folded: false, name: "Folder" }]);
    expect(bundle?.chats?.[0]).toEqual(expect.objectContaining({ id: "chat-1" }));
    expect(bundle?.chats?.[0]).not.toHaveProperty("memoryData");
    expect(bundle?.chats?.[1]).toEqual(expect.objectContaining({ id: "chat-2" }));
  });

  it("exports chats with memory and evolution when enabled", () => {
    const bundle = buildCharacterExportBundle(createCharacter() as never, {
      format: "json",
      includeChats: true,
      includeMemories: true,
      includeEvolution: true,
      cancelled: false,
    });

    expect(bundle?.chats?.[0]?.memoryData).toEqual({
      summaries: [{ text: "Summary", chatMemos: ["memo-1"], isImportant: false }],
    });
    expect(bundle?.characterEvolution).toEqual({
      enabled: true,
      currentStateVersion: 1,
      currentState: {
        relationship: { trustLevel: "high", dynamic: "warm" },
      },
    });
  });
});
