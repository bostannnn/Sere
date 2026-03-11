import { type Chat } from "src/ts/storage/database.svelte";
import { type OpenAIChat } from "../index.svelte";
import type { MemoryData, SerializableMemoryData } from "./memory.types";

export function toMemoryData(serialData: SerializableMemoryData): MemoryData {
  const { lastSelectedSummaries, ...restData } = serialData;
  void lastSelectedSummaries;

  return {
    ...restData,
    summaries: serialData.summaries.map((summary) => ({
      ...summary,
      chatMemos: new Set(
        summary.chatMemos.map((memo) => (memo === null ? undefined : memo))
      ),
    })),
  };
}

export function toSerializableMemoryData(data: MemoryData): SerializableMemoryData {
  return {
    ...data,
    summaries: data.summaries.map((summary) => ({
      ...summary,
      chatMemos: [...summary.chatMemos],
    })),
  };
}

export function cleanOrphanedSummary(
  chats: OpenAIChat[],
  data: MemoryData,
  room: Chat | undefined,
  log: (...args: unknown[]) => void
): void {
  const roomMemos =
    room?.message
      ?.map((msg) => msg.chatId)
      .filter((memo): memo is string => typeof memo === "string") ?? [];
  const currentChatMemos = new Set(
    roomMemos.length > 0 ? roomMemos : chats.map((chat) => chat.memo)
  );
  const originalLength = data.summaries.length;

  data.summaries = data.summaries.filter((summary) => {
    return isSubset(summary.chatMemos, currentChatMemos);
  });

  const removedCount = originalLength - data.summaries.length;
  if (removedCount > 0) {
    log(`Cleaned ${removedCount} orphaned summaries.`);
  }
}

function isSubset(subset: Set<string>, superset: Set<string>): boolean {
  for (const elem of subset) {
    if (!superset.has(elem)) {
      return false;
    }
  }

  return true;
}
