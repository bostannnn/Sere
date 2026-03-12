import { alertToast } from "src/ts/alert";
import { globalFetch } from "src/ts/globalApi.svelte";
import type {
  SerializableMemoryData,
  SummarizeDebugLog,
} from "src/ts/process/memory/memory";
import {
  getCharacterMemoryPromptOverride,
  setCharacterMemoryPromptOverride,
  setChatMemoryData,
} from "src/ts/process/memory/storage";
import type { ManualState } from "./types";

export interface ManualSummarizeTarget {
  characterId: string;
  chatId: string;
}

interface MemoryModalChatLike {
  id?: string;
  message?: Array<{ chatId?: string }>;
  memoryData?: SerializableMemoryData & { lastManualDebug?: SummarizeDebugLog };
}

interface MemoryModalCharacterLike {
  chaId?: string;
  chats?: MemoryModalChatLike[];
}

export function createEmptyMemoryData(
  uncategorizedLabel: string,
): SerializableMemoryData {
  return {
    summaries: [],
    categories: [{ id: "", name: uncategorizedLabel }],
    lastSelectedSummaries: [],
  };
}

export function normalizePromptOverrideCharacter(
  char: {
    memoryPromptOverride?: {
      summarizationPrompt?: unknown;
    };
  } | null,
): void {
  if (!char) return;
  const promptOverride = getCharacterMemoryPromptOverride(char) ?? {
    summarizationPrompt: "",
  };
  promptOverride.summarizationPrompt =
    typeof promptOverride.summarizationPrompt === "string"
      ? promptOverride.summarizationPrompt
      : "";
  setCharacterMemoryPromptOverride(char, promptOverride);
}

export async function callMemoryServer(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await globalFetch(path, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    const payload = response.data as { message?: string; error?: string } | undefined;
    throw new Error(
      payload?.message || payload?.error || String(response.data || "Request failed"),
    );
  }
  return (response.data ?? {}) as Record<string, unknown>;
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown error");
  }
  return String(error ?? "Unknown error");
}

function findManualSummarizeTargetIndices(
  characters: MemoryModalCharacterLike[],
  target: ManualSummarizeTarget,
) {
  const characterIndex = characters.findIndex(
    (item) => item?.chaId === target.characterId,
  );
  if (characterIndex < 0) return null;
  const chats = characters[characterIndex]?.chats ?? [];
  const chatIndex = chats.findIndex((item) => item?.id === target.chatId);
  if (chatIndex < 0) return null;
  return { characterIndex, chatIndex };
}

function syncMemoryDataFromServer(args: {
  data: SerializableMemoryData;
  target?: ManualSummarizeTarget;
  setMemoryData: (data: SerializableMemoryData) => void;
  isTargetActive: (target: ManualSummarizeTarget) => boolean;
  getCharacters: () => MemoryModalCharacterLike[];
}): void {
  const { data, target, setMemoryData, isTargetActive, getCharacters } = args;
  if (!target) return;
  const characters = getCharacters();
  const targetIndices = findManualSummarizeTargetIndices(characters, target);
  if (!targetIndices) return;
  const targetCharacter = characters[targetIndices.characterIndex];
  const targetChat = targetCharacter?.chats?.[targetIndices.chatIndex];
  if (!targetCharacter || !targetChat) return;
  setChatMemoryData(targetChat, data);
  if (isTargetActive(target)) {
    setMemoryData(data);
  }
  targetCharacter.chats![targetIndices.chatIndex] = { ...targetChat };
  targetCharacter.chats = [...targetCharacter.chats!];
}

function persistManualDebugForActiveChat(args: {
  debug: SummarizeDebugLog;
  target?: ManualSummarizeTarget;
  uncategorizedLabel: string;
  setMemoryData: (data: SerializableMemoryData) => void;
  isTargetActive: (target: ManualSummarizeTarget) => boolean;
  getCharacters: () => MemoryModalCharacterLike[];
}): void {
  const {
    debug,
    target,
    uncategorizedLabel,
    setMemoryData,
    isTargetActive,
    getCharacters,
  } = args;
  if (!target) return;
  const characters = getCharacters();
  const targetIndices = findManualSummarizeTargetIndices(characters, target);
  if (!targetIndices) return;
  const targetCharacter = characters[targetIndices.characterIndex];
  const targetChat = targetCharacter?.chats?.[targetIndices.chatIndex];
  if (!targetCharacter || !targetChat) return;
  const nextData = targetChat.memoryData ?? createEmptyMemoryData(uncategorizedLabel);
  nextData.lastManualDebug = debug;
  setChatMemoryData(targetChat, nextData);
  if (isTargetActive(target)) {
    setMemoryData(nextData as SerializableMemoryData);
  }
  targetCharacter.chats![targetIndices.chatIndex] = { ...targetChat };
  targetCharacter.chats = [...targetCharacter.chats!];
}

export async function manualSummarizeRange(args: {
  manualState: ManualState;
  currentChar: { chaId?: string } | null;
  promptOverrideCharacter: {
    memoryPromptOverride?: {
      summarizationPrompt?: string;
    };
  } | null;
  chatList: MemoryModalChatLike[];
  effectiveChatIndex: number;
  uncategorizedLabel: string;
  setGlobalDebug: (debug: SummarizeDebugLog) => void;
  setMemoryData: (data: SerializableMemoryData) => void;
  isTargetActive: (target: ManualSummarizeTarget) => boolean;
  getCharacters: () => MemoryModalCharacterLike[];
  refreshCollapsedSummaries: () => void;
  onError: (error: unknown) => void;
}): Promise<void> {
  const {
    manualState,
    currentChar,
    promptOverrideCharacter,
    chatList,
    effectiveChatIndex,
    uncategorizedLabel,
    setGlobalDebug,
    setMemoryData,
    isTargetActive,
    getCharacters,
    refreshCollapsedSummaries,
    onError,
  } = args;
  if (manualState.processing) return;
  manualState.feedbackMessage = "";
  manualState.feedbackTone = null;
  const characterId = currentChar?.chaId;
  const chat = chatList[effectiveChatIndex] as
    | {
        id?: string;
        message?: Array<{ role?: string; data?: unknown; disabled?: boolean }>;
      }
    | undefined;
  if (!chat || !characterId || !chat.id) return;
  const requestTarget = { characterId, chatId: chat.id };
  const messages = (chat.message ?? []).filter((m) => m && !m.disabled);
  const maxCount = messages.length;
  if (maxCount === 0) {
    manualState.feedbackTone = "error";
    manualState.feedbackMessage = "No messages available in this chat to summarize.";
    return;
  }
  const startNum = Math.max(1, Math.trunc(Number(manualState.start || 1)));
  const endNum = Math.min(maxCount, Math.trunc(Number(manualState.end || maxCount)));
  if (!Number.isFinite(startNum) || !Number.isFinite(endNum) || startNum > endNum) {
    manualState.feedbackTone = "error";
    manualState.feedbackMessage = `Invalid range. Use values between 1 and ${maxCount}, and keep Start less than or equal to End.`;
    return;
  }

  try {
    manualState.processing = true;
    const promptOverride = {
      summarizationPrompt:
        getCharacterMemoryPromptOverride(promptOverrideCharacter)?.summarizationPrompt ?? "",
    };
    const requestPayload = {
      characterId,
      chatId: chat.id,
      start: startNum,
      end: endNum,
      promptOverride,
    };
    const result = await callMemoryServer(
      "/data/memory/manual-summarize",
      requestPayload,
    );
    const resultMemoryData = result.memoryData as SerializableMemoryData | undefined;
    if (resultMemoryData) {
      syncMemoryDataFromServer({
        data: resultMemoryData,
        target: requestTarget,
        setMemoryData,
        isTargetActive,
        getCharacters,
      });
    }
    if (result.debug && typeof result.debug === "object") {
      const debugData = result.debug as SummarizeDebugLog;
      setGlobalDebug(debugData);
      persistManualDebugForActiveChat({
        debug: debugData,
        target: requestTarget,
        uncategorizedLabel,
        setMemoryData,
        isTargetActive,
        getCharacters,
      });
    } else {
      let fallbackDebug: SummarizeDebugLog = {
        timestamp: Date.now(),
        model: "-",
        prompt: promptOverride.summarizationPrompt,
        input: messages
          .slice(startNum - 1, endNum)
          .map((m) => `${m.role}: ${String(m.data ?? "")}`)
          .join("\n"),
        formatted: [],
        characterId,
        chatId: chat.id,
        start: startNum,
        end: endNum,
        source: "manual",
        promptSource: promptOverride.summarizationPrompt.trim()
          ? "request_override"
          : "preset_or_default",
      };
      try {
        const traceResult = await callMemoryServer(
          "/data/memory/manual-summarize/trace",
          requestPayload,
        );
        const promptMessages = Array.isArray(traceResult.promptMessages)
          ? (traceResult.promptMessages as Array<{ role?: string; content?: string }>)
          : [];
        const systemPrompt =
          promptMessages.find((item) => item?.role === "system")?.content ?? "";
        const slotPrompt =
          promptMessages.length === 1 && promptMessages[0]?.role === "user"
            ? (promptMessages[0]?.content ?? "")
            : "";
        fallbackDebug = {
          ...fallbackDebug,
          model: String(traceResult.model ?? "-"),
          formatted: promptMessages
            .filter(
              (item) =>
                typeof item?.role === "string" &&
                typeof item?.content === "string",
            )
            .map((item) => ({ role: String(item.role), content: String(item.content) })),
          prompt: systemPrompt || slotPrompt || fallbackDebug.prompt,
          promptSource:
            String(traceResult.endpoint ?? "").includes("_manual_summarize_trace") &&
            promptOverride.summarizationPrompt.trim() &&
            !(systemPrompt || slotPrompt).includes(promptOverride.summarizationPrompt.trim())
              ? "preset_or_default"
              : fallbackDebug.promptSource,
        };
        if (
          promptOverride.summarizationPrompt.trim() &&
          !fallbackDebug.prompt.includes(promptOverride.summarizationPrompt.trim())
        ) {
          alertToast(
            "Prompt override was not used by the running server. Restart runserver.",
          );
        }
      } catch {
        // Keep the fallback debug built from local state.
      }
      setGlobalDebug(fallbackDebug);
      persistManualDebugForActiveChat({
        debug: fallbackDebug,
        target: requestTarget,
        uncategorizedLabel,
        setMemoryData,
        isTargetActive,
        getCharacters,
      });
    }
    refreshCollapsedSummaries();
    manualState.feedbackTone = "success";
    manualState.feedbackMessage = "Summary added.";
  } catch (error) {
    onError(error);
    manualState.feedbackTone = "error";
    manualState.feedbackMessage = `Manual summarize failed: ${toErrorMessage(error)}`;
  }
  manualState.processing = false;
}
