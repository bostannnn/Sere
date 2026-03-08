import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  resolveProxyAuthMock: vi.fn(async () => ""),
  getDatabaseMock: vi.fn(() => ({
    globalRagSettings: {
      model: "MiniLM",
    },
  })),
}));

vi.mock("src/ts/globalApi.svelte", () => ({
  resolveProxyAuth: shared.resolveProxyAuthMock,
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: shared.getDatabaseMock,
  resolveGlobalRagSettings: (value: { model?: string } | undefined) => ({
    model: value?.model || "MiniLM",
  }),
}));

describe("ingestRulebookOnServer", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("normalizes fetch aborts into a canceled error", async () => {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abortError));

    const { ingestRulebookOnServer } = await import("./ingest-stream");

    await expect(
      ingestRulebookOnServer(
        "rules.pdf",
        new Uint8Array([1, 2, 3]),
        "rules.pdf",
        undefined,
        {},
        undefined,
        new AbortController().signal
      )
    ).rejects.toThrow("Ingestion canceled.");
  });
});
