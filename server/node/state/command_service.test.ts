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
        readdir: vi.fn(async (dirPath: string) => {
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

  it("does not reintroduce deleted chats into chatOrder when replacing character", async () => {
    const files = new Map<string, unknown>([
      [
        "/tmp/risu-test/characters/char-a/character.json",
        {
          revision: 3,
          character: {
            chaId: "char-a",
            name: "A",
            chatOrder: ["chat-a", "chat-b"],
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

    const fsRm = vi.fn(async (filePath: string) => {
      files.delete(filePath);
    });

    const service = createCommandService({
      fs: {
        rm: fsRm,
        readdir: vi.fn(async (dirPath: string) => {
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
      clientMutationId: "delete-and-replace-order",
      commands: [
        {
          type: "chat.delete",
          charId: "char-a",
          chatId: "chat-b",
        },
        {
          type: "character.replace",
          charId: "char-a",
          character: {
            chaId: "char-a",
            name: "A renamed",
            chatOrder: ["chat-a"],
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    const persistedCharacterEnvelope = files.get("/tmp/risu-test/characters/char-a/character.json") as {
      character?: { chatOrder?: string[] };
    };
    expect(persistedCharacterEnvelope?.character?.chatOrder).toEqual(["chat-a"]);
    expect(fsRm).toHaveBeenCalledWith("/tmp/risu-test/characters/char-a/chats/chat-b.json", { force: true });
  });

  it("canonicalizes legacy hypaV3 memory settings to memory fields on settings.replace", async () => {
    const files = new Map<string, unknown>([
      [
        "/tmp/risu-test/settings.json",
        {
          revision: 2,
          data: {
            theme: "dark",
            hypaV3Presets: [
              {
                name: "Legacy",
                settings: {
                  summarizationPrompt: "old",
                },
              },
            ],
            hypaV3PresetId: 0,
            hypaV3: true,
          },
        },
      ],
    ]);

    const writeJsonWithEtag = vi.fn(async (filePath: string, payload: unknown) => {
      files.set(filePath, payload);
      return {};
    });

    const service = createCommandService({
      fs: {
        rm: vi.fn(async () => {}),
      },
      existsSync: (filePath: string) => files.has(filePath),
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
      clientMutationId: "settings-memory-canonical",
      commands: [
        {
          type: "settings.replace",
          settings: {
            theme: "light",
            hypaV3Presets: [
              {
                name: "Legacy",
                settings: {
                  summarizationPrompt: "new prompt",
                },
              },
            ],
            hypaV3PresetId: 0,
            hypaV3: true,
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
    const persistedEnvelope = files.get("/tmp/risu-test/settings.json") as {
      data?: Record<string, unknown>;
    };
    expect(persistedEnvelope?.data?.memoryPresets).toEqual([
      {
        name: "Legacy",
        settings: {
          summarizationPrompt: "new prompt",
        },
      },
    ]);
    expect(persistedEnvelope?.data?.memoryPresetId).toBe(0);
    expect(persistedEnvelope?.data?.memoryEnabled).toBe(true);
    expect("hypaV3Presets" in (persistedEnvelope?.data || {})).toBe(false);
    expect("hypaV3PresetId" in (persistedEnvelope?.data || {})).toBe(false);
    expect("hypaV3" in (persistedEnvelope?.data || {})).toBe(false);
  });
});
