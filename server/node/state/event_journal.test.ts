import * as fsp from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createEventJournal } from "./event_journal.cjs";

describe("event journal", () => {
  it("reconciles stale meta before append to avoid duplicate ids", async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), "risu-event-journal-"));
    const logs = join(root, "logs");
    await fsp.mkdir(logs, { recursive: true });
    await fsp.writeFile(join(root, "logs", "state-events.ndjson"), "{\"id\":1,\"kind\":\"seed\"}\n", "utf-8");
    await fsp.writeFile(
      join(root, "logs", "state-events.meta.json"),
      `${JSON.stringify({ nextEventId: 1, updatedAt: Date.now() }, null, 2)}\n`,
      "utf-8",
    );

    try {
      const journal = createEventJournal({
        fs: fsp,
        existsSync,
        dataDirs: { logs },
      });

      const appended = await journal.appendEvent({
        kind: "chat.message.appended",
        resource: { type: "chat", charId: "char-a", chatId: "chat-a" },
        revision: 2,
        delta: {},
      });

      expect(appended.id).toBe(2);
      expect(await journal.readLastEventId()).toBe(2);

      const metaRaw = await fsp.readFile(join(logs, "state-events.meta.json"), "utf-8");
      const meta = JSON.parse(metaRaw);
      expect(meta.nextEventId).toBe(3);
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });

  it("recovers last event id from log when meta is stale", async () => {
    const root = await fsp.mkdtemp(join(tmpdir(), "risu-event-journal-"));
    const logs = join(root, "logs");
    await fsp.mkdir(logs, { recursive: true });
    await fsp.writeFile(
      join(root, "logs", "state-events.ndjson"),
      "{\"id\":3,\"kind\":\"seed\"}\n{\"id\":4,\"kind\":\"seed\"}\n",
      "utf-8",
    );
    await fsp.writeFile(
      join(root, "logs", "state-events.meta.json"),
      `${JSON.stringify({ nextEventId: 2, updatedAt: Date.now() }, null, 2)}\n`,
      "utf-8",
    );

    try {
      const journal = createEventJournal({
        fs: fsp,
        existsSync,
        dataDirs: { logs },
      });

      const lastEventId = await journal.readLastEventId();
      expect(lastEventId).toBe(4);
    } finally {
      await fsp.rm(root, { recursive: true, force: true });
    }
  });
});
