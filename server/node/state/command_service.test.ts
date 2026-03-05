import { describe, expect, it, vi } from "vitest";

import { createCommandService } from "./command_service.cjs";

describe("command service", () => {
  it("rejects reused clientMutationId when payload differs", async () => {
    let lastEventId = 0;
    const appendEvent = vi.fn(async (event: Record<string, unknown>) => {
      lastEventId += 1;
      return {
        id: lastEventId,
        ...event,
      };
    });

    const service = createCommandService({
      fs: {
        rm: vi.fn(async () => {}),
      },
      existsSync: () => false,
      dataDirs: {
        root: "/tmp/risu-test",
        characters: "/tmp/risu-test/characters",
      },
      readJsonWithEtag: vi.fn(async () => ({ json: {} })),
      writeJsonWithEtag: vi.fn(async () => ({})),
      ensureDir: vi.fn(async () => {}),
      isSafePathSegment: (value: string) => /^[a-zA-Z0-9._-]+$/.test(value),
      resourceLocks: {
        withKey: async (_key: string, task: () => Promise<unknown>) => await task(),
      },
      eventJournal: {
        readLastEventId: async () => lastEventId,
        appendEvent,
      },
    });

    const first = await service.applyCommands({
      clientMutationId: "dup-id",
      baseEventId: 0,
      commands: [
        {
          type: "character.create",
          charId: "char-a",
          character: {
            chaId: "char-a",
            name: "A",
          },
        },
      ],
    });

    expect(first.ok).toBe(true);
    expect(appendEvent).toHaveBeenCalledTimes(1);

    const second = await service.applyCommands({
      clientMutationId: "dup-id",
      baseEventId: 0,
      commands: [
        {
          type: "settings.replace",
          settings: {
            theme: "dark",
          },
        },
      ],
    });

    expect(second.ok).toBe(false);
    expect(Array.isArray(second.conflicts)).toBe(true);
    expect(second.conflicts[0]?.code).toBe("CLIENT_MUTATION_ID_REUSED");
    expect(appendEvent).toHaveBeenCalledTimes(1);
  });

  it("preserves existing chatOrder when character.replace omits it", async () => {
    const files = new Map<string, unknown>([
      [
        "/tmp/risu-test/characters/char-a/character.json",
        {
          revision: 3,
          character: {
            chaId: "char-a",
            name: "A",
            chatOrder: ["chat-b", "chat-a"],
          },
        },
      ],
      [
        "/tmp/risu-test/characters/char-a/chats/chat-a.json",
        {
          revision: 1,
          chat: { id: "chat-a", name: "A" },
        },
      ],
      [
        "/tmp/risu-test/characters/char-a/chats/chat-b.json",
        {
          revision: 1,
          chat: { id: "chat-b", name: "B" },
        },
      ],
    ]);

    const directories = new Set<string>([
      "/tmp/risu-test/characters",
      "/tmp/risu-test/characters/char-a",
      "/tmp/risu-test/characters/char-a/chats",
    ]);

    const writeJsonWithEtag = vi.fn(async (filePath: string, payload: unknown) => {
      files.set(filePath, payload);
      return {};
    });

    const service = createCommandService({
      fs: {
        rm: vi.fn(async () => {}),
        readdir: vi.fn(async (dirPath: string, _opts?: unknown) => {
          if (dirPath !== "/tmp/risu-test/characters/char-a/chats") return [];
          return [
            { name: "chat-a.json", isFile: () => true },
            { name: "chat-b.json", isFile: () => true },
          ];
        }),
      },
      existsSync: (filePath: string) => files.has(filePath) || directories.has(filePath),
      dataDirs: {
        root: "/tmp/risu-test",
        characters: "/tmp/risu-test/characters",
      },
      readJsonWithEtag: vi.fn(async (filePath: string) => ({
        json: files.get(filePath) || {},
      })),
      writeJsonWithEtag,
      ensureDir: vi.fn(async () => {}),
      isSafePathSegment: (value: string) => /^[a-zA-Z0-9._-]+$/.test(value),
      resourceLocks: {
        withKey: async (_key: string, task: () => Promise<unknown>) => await task(),
      },
      eventJournal: {
        readLastEventId: async () => 0,
        appendEvent: vi.fn(async (event: Record<string, unknown>) => ({
          id: 1,
          ...event,
        })),
      },
    });

    const result = await service.applyCommands({
      clientMutationId: "replace-no-chat-order",
      commands: [
        {
          type: "character.replace",
          charId: "char-a",
          character: {
            chaId: "char-a",
            name: "A renamed",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    const persistedCharacterEnvelope = files.get("/tmp/risu-test/characters/char-a/character.json") as {
      character?: { chatOrder?: string[] };
    };
    expect(persistedCharacterEnvelope?.character?.chatOrder).toEqual(["chat-b", "chat-a"]);
  });
});
