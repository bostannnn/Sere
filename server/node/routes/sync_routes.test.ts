import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { registerSyncRoutes } from "./sync_routes.cjs";

class MockReq extends EventEmitter {
  query: Record<string, string>;

  constructor(since: number) {
    super();
    this.query = { since: String(since) };
  }
}

class MockRes extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  writes: string[] = [];
  writableEnded = false;
  destroyed = false;
  headersSent = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = String(value);
  }

  write(chunk: Buffer | string) {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    this.writes.push(text);
    this.headersSent = true;
    return true;
  }

  send(payload: unknown) {
    this.headersSent = true;
    this.writableEnded = true;
    this.writes.push(typeof payload === "string" ? payload : JSON.stringify(payload));
  }
}

function parseStateEventIds(raw: string) {
  const frames = raw
    .split("\n\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const ids: number[] = [];
  for (const frame of frames) {
    if (!frame.includes("event: state-event")) continue;
    const dataLine = frame
      .split("\n")
      .find((line) => line.startsWith("data:"));
    if (!dataLine) continue;
    const payload = JSON.parse(dataLine.slice(5).trim());
    if (Number.isFinite(Number(payload?.id))) {
      ids.push(Number(payload.id));
    }
  }
  return ids;
}

describe("sync routes", () => {
  it("serializes polling flushes to avoid duplicate event delivery", async () => {
    vi.useFakeTimers();
    try {
      let handler: ((req: MockReq, res: MockRes, next?: (err?: unknown) => void) => Promise<void>) | null = null;
      const app = {
        get(route: string, routeHandler: typeof handler) {
          if (route === "/data/sync/events") {
            handler = routeHandler;
          }
        },
      };

      let inFlightReads = 0;
      let maxInFlightReads = 0;
      const eventJournal = {
        readEventsSince: vi.fn(async (sinceArg: number) => {
          const since = Number(sinceArg);
          inFlightReads += 1;
          maxInFlightReads = Math.max(maxInFlightReads, inFlightReads);
          try {
            if (since < 1) {
              return [{
                id: 1,
                ts: Date.now(),
                kind: "chat.created",
                resource: { type: "chat", charId: "char-a", chatId: "chat-a" },
                revision: 1,
                delta: {},
              }];
            }
            if (since < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1500));
              return [{
                id: 2,
                ts: Date.now(),
                kind: "chat.message.appended",
                resource: { type: "chat", charId: "char-a", chatId: "chat-a" },
                revision: 2,
                delta: {},
              }];
            }
            return [];
          } finally {
            inFlightReads -= 1;
          }
        }),
      };

      registerSyncRoutes({
        app,
        eventJournal,
      });

      if (!handler) {
        throw new Error("sync route handler not registered");
      }

      const req = new MockReq(0);
      const res = new MockRes();
      await handler(req, res, () => {});

      // Let multiple poll windows pass; if flushes overlap, id=2 can be emitted twice.
      await vi.advanceTimersByTimeAsync(3500);

      req.emit("close");
      res.emit("close");

      const emittedIds = parseStateEventIds(res.writes.join(""));
      const id2Count = emittedIds.filter((id) => id === 2).length;

      expect(maxInFlightReads).toBe(1);
      expect(id2Count).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
