import { resolveProxyAuth } from "src/ts/globalApi.svelte";
import { getDatabase } from "src/ts/storage/database.svelte";
import type { RagIndex } from "./types";
const ragIngestLog = (..._args: unknown[]) => {};

/** Progress event emitted by the server during NDJSON streaming ingest. */
export interface IngestProgressEvent {
  status: string;
  message: string;
  current?: number;
  total?: number;
  /** Download progress (0–100) for multi-step reporting. */
  progress?: number;
  file?: string;
}

/**
 * Sends a rulebook file to `/data/rag/ingest` and streams back progress
 * events over NDJSON until the server emits `{ status: "done" }`.
 *
 * @param name         Display name / file name of the rulebook.
 * @param fileData     Raw file bytes (PDF or plain text).
 * @param source_file  Source file identifier stored in chunk metadata.
 * @param thumbnail    Optional base64 PNG thumbnail extracted on the client.
 * @param metadata     Optional system/edition tags.
 * @param onProgress   Callback invoked for each intermediate progress line.
 * @returns            Partial RagIndex (chunks array is empty – server stores them).
 */
export async function ingestRulebookOnServer(
  name: string,
  fileData: Uint8Array,
  source_file: string,
  thumbnail: string | undefined,
  metadata: { system?: string; edition?: string },
  onProgress?: (event: IngestProgressEvent) => void
): Promise<RagIndex> {
  const db = getDatabase();
  const base64 = Buffer.from(fileData).toString("base64");
  ragIngestLog(`[RAG] Uploading rulebook: ${name}, base64 size: ${base64.length} bytes`);

  const auth = await resolveProxyAuth();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["risu-auth"] = auth;

  const response = await fetch(new URL("/data/rag/ingest", window.location.origin), {
    method: "POST",
    headers,
    body: JSON.stringify({
      name,
      base64,
      source_file,
      model: db.globalRagSettings.model || "MiniLM",
      metadata,
      thumbnail,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let err = "Ingestion failed";
    try {
      err = JSON.parse(text).error || err;
    } catch {}
    throw new Error(err);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Ingestion stream is unavailable (empty response body).");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let finalId = "";
  let finalChunkCount = 0;
  let streamErrorMessage = "";

  const processLine = (rawLine: string): void => {
    const line = rawLine.trim();
    if (!line) return;

    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch (e) {
      ragIngestLog("[RAG] Failed to parse progress chunk", e, { linePreview: line.slice(0, 200) });
      return;
    }

    const parsed =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)
        : {};

    if (parsed.status === "done") {
      finalId = typeof parsed.id === "string" ? parsed.id : "";
      finalChunkCount = Number.isFinite(Number(parsed.chunkCount)) ? Number(parsed.chunkCount) : 0;
      return;
    }

    if (parsed.status === "error") {
      streamErrorMessage =
        typeof parsed.error === "string" ? parsed.error : "Server ingestion failed.";
      return;
    }

    if (onProgress) {
      const nextCurrent = Number(parsed.current);
      const nextTotal = Number(parsed.total);
      const nextProgress = Number(parsed.progress);
      onProgress({
        status: typeof parsed.status === "string" ? parsed.status : "processing",
        message: typeof parsed.message === "string" ? parsed.message : "",
        current: Number.isFinite(nextCurrent) ? nextCurrent : undefined,
        total: Number.isFinite(nextTotal) ? nextTotal : undefined,
        progress: Number.isFinite(nextProgress) ? nextProgress : undefined,
        file: typeof parsed.file === "string" ? parsed.file : undefined,
      });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      processLine(line);
    }

    if (streamErrorMessage) throw new Error(streamErrorMessage);
  }

  // Process any trailing line when the stream closes without a final newline
  if (buffer.trim()) processLine(buffer);
  if (streamErrorMessage) throw new Error(streamErrorMessage);

  if (!finalId) {
    throw new Error(
      "Ingestion stream ended before completion. Please retry (connection may have closed early)."
    );
  }

  return {
    id: finalId,
    name,
    chunks: [], // Server stores chunks; client only receives metadata
    metadata,
    chunkCount: finalChunkCount,
    thumbnail,
    updatedAt: Date.now(),
  };
}
