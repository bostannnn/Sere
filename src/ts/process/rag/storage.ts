import { globalFetch } from "src/ts/globalApi.svelte";
import type { RagIndex, RulebookMetadata } from "./types";
const ragStorageLog = (..._args: unknown[]) => {};

/**
 * RulebookStorage manages rulebook metadata strictly on the server.
 * Local browser storage is NOT used to prevent data desync.
 */
export class RulebookStorage {
  public async saveRulebook(_index: RagIndex<RulebookMetadata>): Promise<void> {
    // Rulebooks are saved on the server during /ingest
    return;
  }

  public async getRulebook(_id: string): Promise<RagIndex<RulebookMetadata> | null> {
    // Chunks are searched on the server. We don't download whole books to the client.
    return null;
  }

  public async listRulebooks(): Promise<{ id: string; name: string; chunkCount?: number; thumbnail?: string; metadata?: import("./types").RagIndexMetadata; priority?: number }[]> {
    const res = await globalFetch('/data/rag/rulebooks', { method: 'GET' });
    if (res.ok) {
        return res.data;
    }
    ragStorageLog("[RAG] Failed to list rulebooks from server:", res.data);
    const message = typeof res.data === "string"
      ? res.data
      : (res.data && typeof res.data === "object" && "message" in res.data && typeof (res.data as { message?: unknown }).message === "string")
        ? (res.data as { message: string }).message
        : "Failed to fetch rulebooks.";
    throw new Error(message);
  }

  public async updateRulebookMetadata(id: string, name?: string, metadata?: import("./types").RagIndexMetadata, priority?: number): Promise<{ id: string; name: string; chunkCount?: number; thumbnail?: string; metadata?: import("./types").RagIndexMetadata; priority?: number } | null> {
    const res = await globalFetch(`/data/rag/rulebooks/${id}`, {
        method: 'PATCH',
        body: { name, metadata, priority }
    });
    if (res.ok) {
        return res.data;
    }
    ragStorageLog("[RAG] Failed to update rulebook on server:", res.data);
    return null;
  }

  public async deleteRulebook(id: string): Promise<void> {
    const res = await globalFetch(`/data/rag/rulebooks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
        ragStorageLog("[RAG] Failed to delete rulebook on server:", res.data);
    }
  }
}

export const rulebookStorage = new RulebookStorage();
