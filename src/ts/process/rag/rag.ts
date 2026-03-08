import { getDatabase, resolveGlobalRagSettings } from "src/ts/storage/database.svelte";
import { globalFetch } from "src/ts/globalApi.svelte";
import type { RagIndex, RagResult, RulebookMetadata } from "./types";
import { ragProgressStore } from "../../stores.svelte";
import { alertStore } from "../../alert";
import { ingestRulebookOnServer } from "./ingest-stream";
const ragLog = (..._args: unknown[]) => {};

type RulebookUpload = {
  name: string;
  data: Uint8Array;
  system: string;
  edition: string;
};

type IngestProgress = {
  status: string;
  message: string;
  current?: number;
  total?: number;
  progress?: number;
  file?: string;
};

export class RulebookRag {
  private currentIngestionAbortController: AbortController | null = null;

  public cancelIngestion(): void {
    this.currentIngestionAbortController?.abort();
  }

  public async batchIngest(files: RulebookUpload[]): Promise<void> {
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
    let canceled = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      ragProgressStore.update((progress) => ({
        ...progress,
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
          (progress) => {
            ragProgressStore.update((previous) => ({
              ...previous,
              active: true,
              status: progress.status,
              message: progress.message,
              current: progress.current ?? 0,
              total: progress.total ?? 1,
              file: file.name,
              percent: progress.progress,
            }));
          },
          { system: file.system, edition: file.edition }
        );
        successCount++;
      } catch (error) {
        ragLog(`Failed to ingest ${file.name}:`, error);
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("canceled") || message.toLowerCase().includes("interrupted")) {
          canceled = true;
          break;
        }
        failCount++;
      }
    }

    if (canceled) {
      alertStore.set({
        type: "error",
        msg: successCount > 0
          ? `Ingestion canceled after ${successCount} rulebook(s) completed.`
          : "Ingestion canceled.",
      });
    } else if (successCount > 0) {
      alertStore.set({
        type: "normal",
        msg: `Successfully ingested ${successCount} rulebook(s)${failCount > 0 ? `, ${failCount} failed` : ""}.`,
      });
    } else if (failCount > 0) {
      alertStore.set({ type: "error", msg: `Failed to ingest ${failCount} rulebook(s).` });
    }

    ragProgressStore.update((progress) => ({ ...progress, active: false }));
  }

  public async search(
    rulebookIdOrIds: string | string[],
    query: string,
    topK: number = 3,
    minScore: number = 0.1
  ): Promise<RagResult<RulebookMetadata>[]> {
    const globalRagSettings = resolveGlobalRagSettings(getDatabase().globalRagSettings);
    const response = await globalFetch("/data/rag/search", {
      method: "POST",
      body: {
        query,
        bookIds: Array.isArray(rulebookIdOrIds) ? rulebookIdOrIds : [rulebookIdOrIds],
        topK,
        minScore,
        model: globalRagSettings.model,
      },
    });
    return response.ok ? response.data : [];
  }

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

  public getInstruction(): string {
    return `[RAG Instruction]
Utilize the provided <Rules Context> to inform your response.
When you use information from a rulebook chunk, you MUST cite it at the end of the relevant sentence or paragraph using the exact source format provided (e.g., [Source: System - BookName (Edition), p. 42]).
If multiple chunks provide conflicting rules, prioritize the ones that best match the current game state or explicitly state the contradiction.
If the retrieved chunks do not contain the answer, or if you are unsure, state your uncertainty rather than inventing a rule.
Prioritize the rulebook context over your general knowledge if there is a conflict.`;
  }

  public async ingestRulebook(
    name: string,
    fileData: Uint8Array,
    source_file: string,
    onProgress?: (data: IngestProgress) => void,
    metadata: { system?: string; edition?: string } = {}
  ): Promise<RagIndex> {
    const abortController = new AbortController();
    this.currentIngestionAbortController = abortController;
    try {
      let thumbnail: string | undefined;
      if (name.toLowerCase().endsWith(".pdf")) {
        try {
          const { extractPdfThumbnail } = await import("./pdf-thumbnail");
          thumbnail = await extractPdfThumbnail(fileData.slice(0), abortController.signal);
        } catch (error) {
          if ((error instanceof Error && error.name === "AbortError") || abortController.signal.aborted) {
            throw new Error("Ingestion canceled.");
          }
          ragLog("[RAG] Client thumbnail extraction failed", error);
        }
      }

      if (abortController.signal.aborted) {
        throw new Error("Ingestion canceled.");
      }
      return await ingestRulebookOnServer(
        name,
        fileData,
        source_file,
        thumbnail,
        metadata,
        onProgress,
        abortController.signal
      );
    } finally {
      if (this.currentIngestionAbortController === abortController) {
        this.currentIngestionAbortController = null;
      }
    }
  }
}

export const rulebookRag = new RulebookRag();
