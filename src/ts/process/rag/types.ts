import type { EmbeddingVector } from "../memory/embedding";

export interface RagChunk<TMetadata = unknown> {
  id: string;
  content: string;
  embedding?: EmbeddingVector;
  metadata: TMetadata;
}

export interface RulebookMetadata {
  source_file: string;
  book_title?: string;
  system?: string;
  edition?: string;
  section?: string;
  page?: number;
  chapter?: string;
  is_table?: boolean;
}

export interface RagIndexMetadata {
  system?: string;
  edition?: string;
}

export interface RagIndex<TMetadata = RulebookMetadata> {
  id: string;
  name: string;
  chunks: RagChunk<TMetadata>[];
  metadata?: RagIndexMetadata;
  chunkCount?: number;
  thumbnail?: string;
  updatedAt?: number;
  priority?: number; // Higher number = higher priority
}

export interface RagResult<TMetadata = unknown> {
  chunk: RagChunk<TMetadata>;
  score: number;
}
