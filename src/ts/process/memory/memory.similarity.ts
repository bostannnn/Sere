import { type memoryVector, HypaProcesser, similarity } from "./hypamemory";
import type { SummaryChunk } from "./memory.types";

export function simpleCC<T>(
  scoredLists: [T, number][][],
  weightFunc?: (listIndex: number, totalLists: number) => number
): T[] {
  const scores = new Map<T, number>();

  for (let listIndex = 0; listIndex < scoredLists.length; listIndex++) {
    const list = scoredLists[listIndex];
    const weight = weightFunc
      ? weightFunc(listIndex, scoredLists.length)
      : 1 / scoredLists.length;

    for (const [item, score] of list) {
      scores.set(item, (scores.get(item) || 0) + score * weight);
    }
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);
}

export function childToParentRRF<C, P>(
  rankedChildren: C[],
  parentFunc: (child: C) => P,
  k: number = 60
): P[] {
  const scores = new Map<P, number>();

  for (let childIndex = 0; childIndex < rankedChildren.length; childIndex++) {
    const child = rankedChildren[childIndex];
    const parent = parentFunc(child);
    const rank = childIndex + 1;
    const rrfTerm = 1 / (k + rank);

    scores.set(parent, (scores.get(parent) || 0) + rrfTerm);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([parent]) => parent);
}

interface SummaryChunkVector {
  chunk: SummaryChunk;
  vector: memoryVector;
}

export class HypaProcesserEx extends HypaProcesser {
  summaryChunkVectors: SummaryChunkVector[] = [];

  async addSummaryChunks(chunks: SummaryChunk[]): Promise<void> {
    const texts = chunks.map((chunk) => chunk.text);
    await this.addText(texts);

    const newSummaryChunkVectors: SummaryChunkVector[] = [];
    for (const chunk of chunks) {
      const vector = this.vectors.find((v) => v.content === chunk.text);

      if (!vector) {
        throw new Error(`Failed to create vector for summary chunk:\n${chunk.text}`);
      }

      newSummaryChunkVectors.push({
        chunk,
        vector,
      });
    }

    this.summaryChunkVectors.push(...newSummaryChunkVectors);
  }

  async similaritySearchScoredEx(
    query: string
  ): Promise<[SummaryChunk, number][]> {
    const queryVector = (await this.getEmbeds(query))[0];

    return this.summaryChunkVectors
      .map((scv) => ({
        chunk: scv.chunk,
        similarity: similarity(queryVector, scv.vector.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .map((result) => [result.chunk, result.similarity]);
  }
}
