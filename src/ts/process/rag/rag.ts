import { HypaProcessorV2, type EmbeddingText } from "../memory/hypamemoryv2";
import { isNodeServer } from "src/ts/platform";
import { getDatabase } from "src/ts/storage/database.svelte";
import { globalFetch } from "src/ts/globalApi.svelte";
import type { RagChunk, RagResult, RulebookMetadata } from "./types";
import { ragProgressStore } from "../../stores.svelte";
import { alertStore } from "../../alert";
import { chunkText } from "./chunker";
import { ingestRulebookOnServer } from "./ingest-stream";
const ragLog = (..._args: unknown[]) => {};

export class RulebookRag {
  private processors: Map<string, HypaProcessorV2<RulebookMetadata>> = new Map();
  private currentIngestionProcessor: HypaProcessorV2<RulebookMetadata> | null = null;

  private getProcessor(rulebookId: string): HypaProcessorV2<RulebookMetadata> {
    let processor = this.processors.get(rulebookId);
    if (!processor) {
      processor = new HypaProcessorV2<RulebookMetadata>({});
      this.processors.set(rulebookId, processor);
    }
    return processor;
  }

  /** Cancels the current ingestion process. */
  public cancelIngestion(): void {
    if (this.currentIngestionProcessor) {
      this.currentIngestionProcessor.cancel();
    }
  }

  /** Batch ingests multiple files in the background. */
  public async batchIngest(
    files: { name: string; data: Uint8Array; system: string; edition: string }[]
  ): Promise<void> {
    if (files.length === 0) return;

    ragProgressStore.set({
      active: true,
      status: "processing",
      message: "Preparing files...",
      current: 0,
      total: 1,
      currentFileIndex: 0,
      totalFiles: files.length,
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      ragProgressStore.update((p) => ({
        ...p,
        status: "processing",
        message: `Ingesting ${file.name}...`,
        currentFileIndex: i + 1,
        file: file.name,
      }));

      try {
        await this.ingestRulebook(
          file.name,
          file.data,
          file.name,
          (p) => {
            ragProgressStore.update((prev) => ({
              ...prev,
              active: true,
              status: p.status,
              message: p.message,
              current: p.current ?? 0,
              total: p.total ?? 1,
              file: file.name,
              percent: p.progress,
            }));
          },
          { system: file.system, edition: file.edition }
        );
        successCount++;
      } catch (e) {
        ragLog(`Failed to ingest ${file.name}:`, e);
        if (e.message?.includes("canceled") || e.message?.includes("interrupted")) {
          alertStore.set({ type: "error", msg: "Ingestion canceled." });
          break;
        }
        failCount++;
      }
    }

    if (successCount > 0) {
      alertStore.set({
        type: "normal",
        msg: `Successfully ingested ${successCount} rulebook(s)${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      });
    } else if (failCount > 0) {
      alertStore.set({ type: "error", msg: `Failed to ingest ${failCount} rulebook(s).` });
    }

    ragProgressStore.update((p) => ({ ...p, active: false }));
  }

  /** Returns true if the rulebook is already loaded into the in-memory processor. */
  public isLoaded(rulebookId: string): boolean {
    const processor = this.processors.get(rulebookId);
    return !!(processor && processor.vectors.size > 0);
  }

  // Re-export chunker as a public method so existing call-sites in index.svelte.ts
  // don't need updating. The real logic lives in chunker.ts.
  public chunkText(
    input: string | { text: string; page?: number }[],
    source_file: string,
    metadata: { system?: string; edition?: string } = {}
  ): EmbeddingText<RulebookMetadata>[] {
    return chunkText(input, source_file, metadata);
  }

  /**
   * Ingests pre-chunked texts into the client-side in-memory processor.
   * No-op when running on the Node server (server handles this via /ingest).
   */
  public async ingestChunks(
    rulebookId: string,
    chunks: EmbeddingText<RulebookMetadata>[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    if (isNodeServer) return; // Server handles this via /ingest
    const processor = this.getProcessor(rulebookId);
    if (onProgress) {
      processor.progressCallback = (current, total) => onProgress(current, total);
    }
    await processor.addTexts(chunks);
  }

  /**
   * Loads a rulebook from raw chunks into the client-side in-memory processor,
   * embedding any chunks that are missing vectors.
   * No-op when running on the Node server.
   */
  public async loadRulebook(
    rulebookId: string,
    chunks: RagChunk<RulebookMetadata>[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    if (isNodeServer) return; // Server handles this internally
    if (this.isLoaded(rulebookId)) return;
    const processor = this.getProcessor(rulebookId);
    const toEmbed: EmbeddingText<RulebookMetadata>[] = [];

    for (const chunk of chunks) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        processor.vectors.set(chunk.id, {
          id: chunk.id,
          content: chunk.content,
          embedding: chunk.embedding,
          metadata: chunk.metadata,
        });
      } else {
        toEmbed.push({ id: chunk.id, content: chunk.content, metadata: chunk.metadata });
      }
    }

    if (toEmbed.length > 0) {
      if (onProgress) {
        processor.progressCallback = (current, total) => onProgress(current, total);
      }
      await processor.addTexts(toEmbed);
      // Back-fill embeddings onto the original chunk objects
      for (const te of toEmbed) {
        const result = processor.vectors.get(te.id);
        const original = chunks.find((c) => c.id === te.id);
        if (result && original) original.embedding = result.embedding;
      }
    }
  }

  /**
   * Searches one or more rulebooks for chunks relevant to `query`.
   * On the Node server, delegates to `/data/rag/search`.
   * In local mode, runs cosine similarity against in-memory processors.
   */
  public async search(
    rulebookIdOrIds: string | string[],
    query: string,
    topK: number = 3,
    minScore: number = 0.1
  ): Promise<RagResult<RulebookMetadata>[]> {
    if (isNodeServer) {
      const db = getDatabase();
      const res = await globalFetch("/data/rag/search", {
        method: "POST",
        body: {
          query,
          bookIds: Array.isArray(rulebookIdOrIds) ? rulebookIdOrIds : [rulebookIdOrIds],
          topK,
          minScore,
          model: db.globalRagSettings.model || "MiniLM",
        },
      });
      return res.ok ? res.data : [];
    }

    const bookIds = Array.isArray(rulebookIdOrIds) ? rulebookIdOrIds : [rulebookIdOrIds];
    const allResults: [import("../memory/hypamemoryv2").EmbeddingResult<RulebookMetadata>, number][] =
      [];

    for (const bookId of bookIds) {
      const processor = this.getProcessor(bookId);
      const scoredResults = await processor.similaritySearchScored(query);
      allResults.push(...scoredResults);
    }

    allResults.sort((a, b) => b[1] - a[1]);

    return allResults
      .filter(([, score]) => score >= minScore)
      .slice(0, topK)
      .map(([result, score]) => ({
        chunk: {
          id: result.id,
          content: result.content,
          embedding: result.embedding,
          metadata: result.metadata,
        },
        score,
      }));
  }

  /** Formats retrieved chunks as a `<Rules Context>` block for prompt injection. */
  public formatForPrompt(results: RagResult<RulebookMetadata>[]): string {
    if (results.length === 0) return "";

    let prompt = "<Rules Context>\n";
    for (const result of results) {
      const meta = result.chunk.metadata;
      let citation = meta.source_file;
      if (meta.system) citation = `${meta.system} - ${citation}`;
      if (meta.edition) citation = `${citation} (${meta.edition})`;
      if (meta.page) citation = `${citation}, p. ${meta.page}`;
      prompt += `[Source: ${citation}]\n${result.chunk.content}\n\n`;
    }
    prompt += "</Rules Context>";
    return prompt;
  }

  /** Returns the system instruction for the model on how to use RAG context. */
  public getInstruction(): string {
    return `[RAG Instruction]
Utilize the provided <Rules Context> to inform your response.
When you use information from a rulebook chunk, you MUST cite it at the end of the relevant sentence or paragraph using the exact source format provided (e.g., [Source: System - BookName (Edition), p. 42]).
If multiple chunks provide conflicting rules, prioritize the ones that best match the current game state or explicitly state the contradiction.
If the retrieved chunks do not contain the answer, or if you are unsure, state your uncertainty rather than inventing a rule.
Prioritize the rulebook context over your general knowledge if there is a conflict.`;
  }

  /**
   * High-level entry point: ingests a rulebook from raw file bytes.
   *
   * - On Node server: uploads to `/data/rag/ingest` and streams NDJSON progress.
   * - In local mode: extracts text, chunks, embeds, and saves to browser storage.
   */
  public async ingestRulebook(
    name: string,
    fileData: Uint8Array,
    source_file: string,
    onProgress?: (data: {
      status: string;
      message: string;
      current?: number;
      total?: number;
      progress?: number;
      file?: string;
    }) => void,
    metadata: { system?: string; edition?: string } = {}
  ): Promise<import("./types").RagIndex> {
    let thumbnail: string | undefined;
    let extractedPages: import("./pdf").PdfPageContent[] | undefined;

    // Extract thumbnail on the client even in server mode — server has no canvas
    if (name.toLowerCase().endsWith(".pdf")) {
      try {
        const pdfUtil = await import("./pdf");
        const dataCopy = fileData.slice(0);
        const pdfRes = await pdfUtil.extractPdfData(dataCopy);
        thumbnail = pdfRes.thumbnail;
        extractedPages = pdfRes.pages;
      } catch (e) {
        ragLog("[RAG] Client thumbnail extraction failed", e);
      }
    }

    if (isNodeServer) {
      return ingestRulebookOnServer(name, fileData, source_file, thumbnail, metadata, onProgress);
    }

    // ── Local mode (Tauri / browser fallback) ────────────────────────────────
    let input: string | { text: string; page?: number }[] = "";
    if (name.toLowerCase().endsWith(".pdf")) {
      if (extractedPages) {
        input = extractedPages;
      } else {
        const pdfUtil = await import("./pdf");
        const pdfRes = await pdfUtil.extractPdfData(fileData);
        input = pdfRes.pages;
      }
    } else {
      input = Buffer.from(fileData).toString("utf-8");
    }

    const { v4: uuidv4 } = await import("uuid");
    const id = uuidv4();
    const chunks = chunkText(input, source_file, metadata);

    const ragChunks: RagChunk<RulebookMetadata>[] = chunks.map((c) => ({
      id: c.id,
      content: c.content,
      metadata: c.metadata,
    }));

    const processor = this.getProcessor(id);
    this.currentIngestionProcessor = processor;
    try {
      await this.loadRulebook(id, ragChunks, (current, total) => {
        onProgress?.({ status: "embedding", message: "Embedding chunks...", current, total });
      });
    } finally {
      this.currentIngestionProcessor = null;
    }

    const finalChunks: RagChunk<RulebookMetadata>[] = [];
    for (const chunk of ragChunks) {
      const processed = processor.vectors.get(chunk.id);
      if (processed?.embedding) {
        finalChunks.push({
          id: chunk.id,
          content: chunk.content,
          embedding: processed.embedding,
          metadata: chunk.metadata,
        });
      }
    }

    if (finalChunks.length < ragChunks.length) {
      throw new Error("Ingestion was interrupted or incomplete. Rulebook not saved.");
    }

    const rulebookData: import("./types").RagIndex = {
      id,
      name,
      chunks: finalChunks,
      metadata,
      chunkCount: finalChunks.length,
      thumbnail,
      updatedAt: Date.now(),
    };

    const { rulebookStorage } = await import("./storage");
    await rulebookStorage.saveRulebook(rulebookData);

    return rulebookData;
  }
}

export const rulebookRag = new RulebookRag();
