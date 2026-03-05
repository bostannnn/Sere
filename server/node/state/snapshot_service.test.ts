import * as fsp from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createSnapshotService } from "./snapshot_service.cjs";

describe("snapshot service", () => {
  it("applies stored chatOrder when building chatsByCharacter", async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), "risu-snapshot-service-"));
    const charactersDir = join(root, "characters");
    const logsDir = join(root, "logs");
    const charId = "char-a";

    await fsp.mkdir(join(charactersDir, charId, "chats"), { recursive: true });
    await fsp.mkdir(logsDir, { recursive: true });

    await fsp.writeFile(
      join(charactersDir, charId, "character.json"),
      `${JSON.stringify({
        character: {
          chaId: charId,
          name: "A",
          chatOrder: ["chat-b", "chat-a"],
          chatPage: 0,
        },
        revision: 1,
      }, null, 2)}\n`,
      "utf-8",
    );

    await fsp.writeFile(
      join(charactersDir, charId, "chats", "chat-a.json"),
      `${JSON.stringify({ chat: { id: "chat-a", name: "A chat" }, revision: 1 }, null, 2)}\n`,
      "utf-8",
    );
    await fsp.writeFile(
      join(charactersDir, charId, "chats", "chat-b.json"),
      `${JSON.stringify({ chat: { id: "chat-b", name: "B chat" }, revision: 1 }, null, 2)}\n`,
      "utf-8",
    );
    await fsp.writeFile(
      join(charactersDir, charId, "chats", "chat-c.json"),
      `${JSON.stringify({ chat: { name: "C chat" }, revision: 1 }, null, 2)}\n`,
      "utf-8",
    );

    try {
      const snapshotService = createSnapshotService({
        fs: fsp,
        existsSync,
        dataDirs: {
          root,
          characters: charactersDir,
          logs: logsDir,
        },
        readJsonWithEtag: async (filePath: string) => {
          const raw = await fsp.readFile(filePath, "utf-8");
          return { json: JSON.parse(raw) };
        },
        eventJournal: {
          readLastEventId: async () => 0,
        },
      });

      const snapshot = await snapshotService.buildSnapshot();
      const chatsUnknown = Array.isArray(snapshot.chatsByCharacter?.[charId]) ? snapshot.chatsByCharacter[charId] : [];
      const chats = chatsUnknown as Array<{ id?: unknown; name?: unknown }>;
      const ids = chats.map((entry) => entry?.id).filter((id): id is string => typeof id === "string");

      expect(ids).toEqual(["chat-b", "chat-a", "chat-c"]);
      expect(chats[2]?.id).toBe("chat-c");
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
