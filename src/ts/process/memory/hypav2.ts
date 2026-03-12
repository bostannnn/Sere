import type { SerializableMemoryData } from "./memory.types";

export interface HypaV2Data {
  lastMainChunkID: number;
  mainChunks: {
    id: number;
    text: string;
    chatMemos: Set<string>;
    lastChatMemo: string;
  }[];
  chunks: {
    mainChunkID: number;
    text: string;
  }[];
}

export interface SerializableHypaV2Data
  extends Omit<HypaV2Data, "mainChunks"> {
  mainChunks: Array<{
    id: number;
    text: string;
    chatMemos: string[];
    lastChatMemo: string;
  }>;
}

export interface OldHypaV2Data {
  chunks: Array<{
    text: string;
    targetId: string;
  }>;
  mainChunks: Array<{
    text: string;
    targetId: string;
  }>;
}

type HypaV2ChatMemoLike = {
  memo?: string;
};

function isOldHypaV2ChunkLike(
  value: unknown,
): value is { text: string; targetId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string" &&
    typeof (value as { targetId?: unknown }).targetId === "string"
  );
}

export function isOldHypaV2Data(value: unknown): value is OldHypaV2Data {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as {
    chunks?: unknown;
    mainChunks?: unknown;
  };
  return (
    Array.isArray(candidate.chunks) &&
    Array.isArray(candidate.mainChunks) &&
    candidate.chunks.every(isOldHypaV2ChunkLike) &&
    candidate.mainChunks.every(isOldHypaV2ChunkLike)
  );
}

function toHypaV2Data(data: SerializableHypaV2Data): HypaV2Data {
  return {
    ...data,
    mainChunks: data.mainChunks.map((mainChunk) => ({
      ...mainChunk,
      chatMemos: new Set(
        Array.isArray(mainChunk.chatMemos) ? mainChunk.chatMemos : [],
      ),
    })),
  };
}

function toSerializableHypaV2Data(data: HypaV2Data): SerializableHypaV2Data {
  return {
    ...data,
    mainChunks: data.mainChunks.map((mainChunk) => ({
      ...mainChunk,
      chatMemos: Array.from(mainChunk.chatMemos),
    })),
  };
}

export function convertOldToNewHypaV2Data(
  oldData: OldHypaV2Data,
  chats: HypaV2ChatMemoLike[],
): HypaV2Data {
  const oldMainChunks = oldData.mainChunks.slice().reverse();
  const oldChunks = oldData.chunks.slice();
  const newData: HypaV2Data = {
    lastMainChunkID: 0,
    mainChunks: [],
    chunks: [],
  };

  const chatMemoToIndex = new Map<string, number>();
  chats.forEach((chat, index) => {
    if (typeof chat.memo === "string" && chat.memo.length > 0) {
      chatMemoToIndex.set(chat.memo, index);
    }
  });

  for (let i = 0; i < oldMainChunks.length; i++) {
    const oldMainChunk = oldMainChunks[i];
    const previousMainChunk = i > 0 ? oldMainChunks[i - 1] : null;
    const targetIndex = chatMemoToIndex.get(oldMainChunk.targetId) ?? -1;

    if (targetIndex < 0) {
      continue;
    }

    const startIndex = previousMainChunk
      ? (chatMemoToIndex.get(previousMainChunk.targetId) ?? -1)
      : 0;
    const lowerIndex = Math.min(
      startIndex >= 0 ? startIndex : targetIndex,
      targetIndex,
    );
    const upperIndex = Math.max(
      startIndex >= 0 ? startIndex : targetIndex,
      targetIndex,
    );
    const chatMemos = new Set<string>();

    for (let j = lowerIndex; j <= upperIndex; j++) {
      const memo = chats[j]?.memo;
      if (typeof memo === "string" && memo.length > 0) {
        chatMemos.add(memo);
      }
    }

    if (chatMemos.size === 0) {
      continue;
    }

    const nextMainChunk = {
      id: newData.lastMainChunkID,
      text: oldMainChunk.text,
      chatMemos,
      lastChatMemo: oldMainChunk.targetId,
    };
    newData.mainChunks.push(nextMainChunk);
    newData.lastMainChunkID++;

    const matchingOldChunks = oldChunks.filter(
      (oldChunk) => oldChunk.targetId === oldMainChunk.targetId,
    );
    for (const oldChunk of matchingOldChunks) {
      newData.chunks.push({
        mainChunkID: nextMainChunk.id,
        text: oldChunk.text,
      });
    }
  }

  return newData;
}

export function normalizeSerializableHypaV2Data(args: {
  data: OldHypaV2Data | SerializableHypaV2Data | null | undefined;
  chats: HypaV2ChatMemoLike[];
}): SerializableHypaV2Data | null {
  const { data, chats } = args;
  if (!data) {
    return null;
  }
  if (isOldHypaV2Data(data)) {
    return toSerializableHypaV2Data(convertOldToNewHypaV2Data(data, chats));
  }
  return toSerializableHypaV2Data(toHypaV2Data(data));
}

export function convertHypaV2DataToMemoryData(args: {
  data: OldHypaV2Data | SerializableHypaV2Data | null | undefined;
  chats: HypaV2ChatMemoLike[];
  uncategorizedLabel: string;
}): SerializableMemoryData | null {
  const normalized = normalizeSerializableHypaV2Data(args);
  if (!normalized || normalized.mainChunks.length === 0) {
    return null;
  }

  return {
    summaries: normalized.mainChunks.map((mainChunk) => ({
      text: mainChunk.text,
      chatMemos: [...mainChunk.chatMemos],
      isImportant: false,
    })),
    categories: [{ id: "", name: args.uncategorizedLabel }],
    lastSelectedSummaries: [],
  };
}
