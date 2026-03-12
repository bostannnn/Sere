import type { Message } from "src/ts/storage/database.svelte";

export function replaceMessageTailWithSnapshot(
  messages: Message[],
  rerollSnapshot: Message[],
): Message[] {
  if (!Array.isArray(messages) || !Array.isArray(rerollSnapshot)) {
    return Array.isArray(messages) ? messages : [];
  }
  if (rerollSnapshot.length === 0 || rerollSnapshot.length > messages.length) {
    return messages;
  }

  const nextMessages = [...messages];
  const startIndex = nextMessages.length - rerollSnapshot.length;
  for (let index = 0; index < rerollSnapshot.length; index += 1) {
    nextMessages[startIndex + index] = rerollSnapshot[index];
  }
  return nextMessages;
}

export function trimMessagesForRerollRequest(messages: Message[]): Message[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  const nextMessages = [...messages];
  const lastSpeaker = nextMessages.at(-1)?.saying;
  let sameSpeakerRepliesRemaining = 2;

  while (nextMessages.length > 0 && nextMessages.at(-1)?.role !== "user") {
    if (nextMessages.at(-1)?.saying === lastSpeaker) {
      sameSpeakerRepliesRemaining -= 1;
      if (sameSpeakerRepliesRemaining === 0) {
        break;
      }
    }

    nextMessages.pop();
  }

  return nextMessages;
}

export function createInitialRerollHistory(
  existingSnapshots: Message[][],
  lastMessage: Message | undefined,
): { snapshots: Message[][]; index: number } {
  if (!lastMessage || existingSnapshots.length > 0) {
    return {
      snapshots: existingSnapshots,
      index: existingSnapshots.length > 0 ? existingSnapshots.length - 1 : -1,
    };
  }

  return {
    snapshots: [[lastMessage]],
    index: 0,
  };
}

export function appendRerollSnapshot(
  snapshots: Message[][],
  snapshot: Message[],
): { snapshots: Message[][]; index: number } {
  const nextSnapshots = [...snapshots, snapshot];
  return {
    snapshots: nextSnapshots,
    index: nextSnapshots.length - 1,
  };
}

export function readNextRerollSnapshot(
  snapshots: Message[][],
  index: number,
): { snapshot: Message[] | null; index: number } {
  const nextIndex = index + 1;
  const snapshot = Array.isArray(snapshots[nextIndex]) ? snapshots[nextIndex] : null;
  return {
    snapshot,
    index: snapshot ? nextIndex : index,
  };
}

export function readPreviousRerollSnapshot(
  snapshots: Message[][],
  index: number,
): { snapshot: Message[] | null; index: number } {
  const nextIndex = index - 1;
  const snapshot = Array.isArray(snapshots[nextIndex]) ? snapshots[nextIndex] : null;
  return {
    snapshot,
    index: snapshot ? nextIndex : index,
  };
}
