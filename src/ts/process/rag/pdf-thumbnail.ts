import * as pdfjs from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?worker&url";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

function createAbortError() {
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError();
  }
}

export async function extractPdfThumbnail(
  data: Uint8Array,
  signal?: AbortSignal
): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;
  throwIfAborted(signal);

  const loadingTask = pdfjs.getDocument({
    data,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
  });
  const abortLoad = () => {
    try {
      void loadingTask.destroy();
    } catch {
    }
  };

  try {
    if (signal) {
      signal.addEventListener("abort", abortLoad, { once: true });
      if (signal.aborted) {
        abortLoad();
        throw createAbortError();
      }
    }

    const pdf = await loadingTask.promise;
    throwIfAborted(signal);
    if (pdf.numPages < 1) return undefined;

    const page = await pdf.getPage(1);
    throwIfAborted(signal);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderTask = page.render({
      canvasContext: context,
      viewport,
    });
    const abortRender = () => {
      try {
        renderTask.cancel();
      } catch {
      }
    };
    if (signal) {
      signal.addEventListener("abort", abortRender, { once: true });
    }
    try {
      await renderTask.promise;
    } finally {
      if (signal) {
        signal.removeEventListener("abort", abortRender);
      }
    }

    throwIfAborted(signal);
    return canvas.toDataURL("image/webp", 0.7);
  } catch (error) {
    if ((error instanceof Error && error.name === "AbortError") || signal?.aborted) {
      throw createAbortError();
    }
    throw error;
  } finally {
    if (signal) {
      signal.removeEventListener("abort", abortLoad);
    }
  }
}
