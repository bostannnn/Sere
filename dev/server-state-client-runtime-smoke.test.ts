import { beforeEach, describe, expect, it, vi } from "vitest";

const { fetchWithServerAuthMock } = vi.hoisted(() => ({
  fetchWithServerAuthMock: vi.fn(),
}));

vi.mock(import("src/ts/storage/serverAuth"), () => ({
  fetchWithServerAuth: fetchWithServerAuthMock,
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

describe("server state client runtime smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchWithServerAuthMock.mockReset();
  });

  it("keeps pending mutation tracking bounded", async () => {
    fetchWithServerAuthMock.mockImplementation(async (url: string) => {
      if (url === "/data/state/commands") {
        return jsonResponse({
          ok: true,
          lastEventId: 1,
          applied: [],
          conflicts: [],
        }, 200);
      }
      throw new Error(`Unexpected request URL: ${url}`);
    });

    const client = await import("src/ts/storage/serverStateClient");
    client.__debugResetServerStateClientForTests();

    for (let i = 0; i < 1400; i += 1) {
      await client.enqueueCommand({
        clientMutationId: `mut-${i}`,
        baseEventId: 0,
        commands: [],
      });
    }

    expect(client.__debugPendingMutationCountForTests()).toBeLessThanOrEqual(1024);
  });

  it("prunes stale pending mutation tracking by ttl", async () => {
    vi.useFakeTimers();
    try {
      fetchWithServerAuthMock.mockImplementation(async (url: string) => {
        if (url === "/data/state/commands") {
          return jsonResponse({
            ok: true,
            lastEventId: 1,
            applied: [],
            conflicts: [],
          }, 200);
        }
        throw new Error(`Unexpected request URL: ${url}`);
      });

      const client = await import("src/ts/storage/serverStateClient");
      client.__debugResetServerStateClientForTests();

      await client.enqueueCommand({
        clientMutationId: "old-mutation",
        baseEventId: 0,
        commands: [],
      });
      expect(client.__debugPendingMutationCountForTests()).toBe(1);

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000 + 2000);

      await client.enqueueCommand({
        clientMutationId: "new-mutation",
        baseEventId: 0,
        commands: [],
      });

      // old entry should expire; only new one remains pending
      expect(client.__debugPendingMutationCountForTests()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
