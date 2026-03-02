import type { EmbeddingText } from "../memory/hypamemoryv2";
import type { RulebookMetadata } from "./types";
import { v4 as uuidv4 } from "uuid";

/**
 * Chunks text into overlapping windows for RAG indexing.
 *
 * Target chunk size: 600–900 chars.
 * Overlap: ~100 chars.
 * Prefers natural break points (newlines, sentence ends) within the window.
 */
export function chunkText(
  input: string | { text: string; page?: number }[],
  source_file: string,
  metadata: { system?: string; edition?: string } = {}
): EmbeddingText<RulebookMetadata>[] {
  const chunks: EmbeddingText<RulebookMetadata>[] = [];
  const minChunkSize = 600;
  const maxChunkSize = 900;
  const overlap = 100;

  const sections = typeof input === "string" ? [{ text: input }] : input;

  for (const section of sections) {
    const text = section.text;
    const page = section.page;
    let start = 0;

    while (start < text.length) {
      let end = start + maxChunkSize;
      if (end > text.length) {
        end = text.length;
      } else {
        // Prefer a natural break point within the window
        const lastNewline = text.lastIndexOf("\n", end);
        if (lastNewline > start + minChunkSize) {
          end = lastNewline;
        } else {
          const lastPeriod = text.lastIndexOf(". ", end);
          if (lastPeriod > start + minChunkSize) {
            end = lastPeriod + 1;
          }
        }
      }

      const content = text.slice(start, end).trim();
      if (content) {
        // If the chunk starts mid-table-row, align to the first pipe
        let adjustedContent = content;
        if (content.includes("|") && !content.startsWith("|")) {
          const firstPipe = content.indexOf("|");
          if (firstPipe < 50) adjustedContent = content.slice(firstPipe);
        }

        chunks.push({
          id: uuidv4(),
          content: adjustedContent,
          metadata: {
            source_file,
            page,
            system: metadata.system,
            edition: metadata.edition,
            is_table:
              adjustedContent.includes("|") &&
              adjustedContent.split("\n").some((l) => l.startsWith("|")),
          },
        });
      }

      if (end === text.length) break;
      start = end - overlap;
    }
  }

  return chunks;
}
