import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  alertSetMock: vi.fn(),
  globalFetchMock: vi.fn(),
  ingestRulebookOnServerMock: vi.fn(),
  extractPdfThumbnailMock: vi.fn(),
  progressState: {
    active: false,
    status: "idle",
    message: "",
    current: 0,
    total: 0,
    currentFileIndex: 0,
    totalFiles: 0,
  },
  ragProgressStore: {
    set: vi.fn((value: Record<string, unknown>) => {
      shared.progressState = { ...shared.progressState, ...value };
    }),
    update: vi.fn((updater: (value: typeof shared.progressState) => typeof shared.progressState) => {
      shared.progressState = updater(shared.progressState);
      return shared.progressState;
    }),
  },
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  getDatabase: () => ({
    globalRagSettings: {
      model: "MiniLM",
    },
  }),
  resolveGlobalRagSettings: (value: { model?: string } | undefined) => ({
    model: value?.model || "MiniLM",
  }),
}));

vi.mock("src/ts/globalApi.svelte", () => ({
  globalFetch: shared.globalFetchMock,
}));

vi.mock("src/ts/alert", () => ({
  alertStore: {
    set: shared.alertSetMock,
  },
}));

vi.mock("src/ts/stores.svelte", () => ({
  ragProgressStore: shared.ragProgressStore,
}));

vi.mock("./ingest-stream", () => ({
  ingestRulebookOnServer: shared.ingestRulebookOnServerMock,
}));

vi.mock("./pdf-thumbnail", () => ({
  extractPdfThumbnail: shared.extractPdfThumbnailMock,
}));

describe("RulebookRag", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    shared.progressState = {
      active: false,
      status: "idle",
      message: "",
      current: 0,
      total: 0,
      currentFileIndex: 0,
      totalFiles: 0,
    };
  });

  it("reports cancellation instead of success when a later file is canceled", async () => {
    const { RulebookRag } = await import("./rag");

    class TestRulebookRag extends RulebookRag {
      private calls = 0;

      override async ingestRulebook(name: string) {
        this.calls += 1;
        if (this.calls === 1) {
          return {
            id: `ok-${name}`,
            name,
            chunks: [],
            chunkCount: 1,
          };
        }
        throw new Error("Ingestion canceled.");
      }
    }

    const rag = new TestRulebookRag();
    await rag.batchIngest([
      { name: "one.txt", data: new Uint8Array([1]), system: "", edition: "" },
      { name: "two.txt", data: new Uint8Array([2]), system: "", edition: "" },
    ]);

    expect(shared.alertSetMock).toHaveBeenLastCalledWith({
      type: "error",
      msg: "Ingestion canceled after 1 rulebook(s) completed.",
    });
    expect(shared.alertSetMock.mock.calls.some(([arg]) => arg?.type === "normal")).toBe(false);
  });

  it("cancels before server ingest when thumbnail extraction is aborted", async () => {
    shared.extractPdfThumbnailMock.mockImplementation(
      async (_data: Uint8Array, signal?: AbortSignal) =>
        await new Promise<string | undefined>((_resolve, reject) => {
          if (signal?.aborted) {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
            return;
          }
          signal?.addEventListener(
            "abort",
            () => {
              const error = new Error("aborted");
              error.name = "AbortError";
              reject(error);
            },
            { once: true }
          );
        })
    );

    const { RulebookRag } = await import("./rag");
    const rag = new RulebookRag();
    const ingestPromise = rag.ingestRulebook("rules.pdf", new Uint8Array([1, 2, 3]), "rules.pdf");

    rag.cancelIngestion();

    await expect(ingestPromise).rejects.toThrow("Ingestion canceled.");
    expect(shared.ingestRulebookOnServerMock).not.toHaveBeenCalled();
    expect(((rag as unknown) as { currentIngestionAbortController: AbortController | null }).currentIngestionAbortController).toBeNull();
  });
});
