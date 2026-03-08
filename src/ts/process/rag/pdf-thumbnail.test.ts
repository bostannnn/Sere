import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => ({
  destroyMock: vi.fn(async () => {}),
  getDocumentMock: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  default: {
    version: "test-version",
    GlobalWorkerOptions: {
      workerSrc: "",
    },
    getDocument: shared.getDocumentMock,
  },
  version: "test-version",
  GlobalWorkerOptions: {
    workerSrc: "",
  },
  getDocument: shared.getDocumentMock,
}));

vi.mock("pdfjs-dist/build/pdf.worker?worker&url", () => ({
  default: "/mock-pdf-worker.js",
}));

describe("extractPdfThumbnail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    shared.destroyMock = vi.fn(async () => {});
    shared.getDocumentMock.mockReturnValue({
      promise: new Promise(() => {}),
      destroy: shared.destroyMock,
    });
  });

  it("destroys the loading task when called with an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    const { extractPdfThumbnail } = await import("./pdf-thumbnail");

    await expect(extractPdfThumbnail(new Uint8Array([1, 2, 3]), controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(shared.getDocumentMock).not.toHaveBeenCalled();
    expect(shared.destroyMock).not.toHaveBeenCalled();
  });

  it("destroys the loading task and removes the abort listener when canceled in flight", async () => {
    const controller = new AbortController();
    const addEventListenerSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(controller.signal, "removeEventListener");

    let rejectPromise: ((reason?: unknown) => void) | null = null;
    const loadingPromise = new Promise<never>((_resolve, reject) => {
      rejectPromise = reject;
    });
    shared.destroyMock = vi.fn(async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      rejectPromise?.(error);
    });
    shared.getDocumentMock.mockReturnValue({
      promise: loadingPromise,
      destroy: shared.destroyMock,
    });

    const { extractPdfThumbnail } = await import("./pdf-thumbnail");
    const thumbnailPromise = extractPdfThumbnail(new Uint8Array([1, 2, 3]), controller.signal);

    controller.abort();

    await expect(thumbnailPromise).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(shared.getDocumentMock).toHaveBeenCalledTimes(1);
    expect(shared.destroyMock).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
    expect(removeEventListenerSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
