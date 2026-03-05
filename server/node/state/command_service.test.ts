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
});
