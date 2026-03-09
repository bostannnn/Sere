import { alertToast } from "src/ts/alert";
import { globalFetch } from "src/ts/globalApi.svelte";
import type {
  SerializableHypaV3Data,
  SummarizeDebugLog,
} from "src/ts/process/memory/hypav3";
import type { ManualState } from "./types";

export interface ManualSummarizeTarget {
  characterId: string;
  chatId: string;
}

interface HypaModalChatLike extends Record<string, unknown> {
  id?: string;
  hypaV3Data?: SerializableHypaV3Data & { lastManualDebug?: SummarizeDebugLog };
  hypaV2Data?: {
    mainChunks: Array<{ text: string; chatMemos: string[] }>;
  } | null;
}

interface HypaModalCharacterLike extends Record<string, unknown> {
  chaId?: string;
  chats?: HypaModalChatLike[];
}

export function createEmptyHypaV3Data(
  uncategorizedLabel: string,
): SerializableHypaV3Data {
  return {
    summaries: [],
    categories: [{ id: "", name: uncategorizedLabel }],
    lastSelectedSummaries: [],
  };
}

export function normalizePromptOverrideCharacter(
  char: {
    hypaV3PromptOverride?: {
      summarizationPrompt?: unknown;
      reSummarizationPrompt?: unknown;
    };
  } | null,
): void {
  if (!char) return;
  char.hypaV3PromptOverride ??= {
    summarizationPrompt: "",
    reSummarizationPrompt: "",
  };
  char.hypaV3PromptOverride.summarizationPrompt =
    typeof char.hypaV3PromptOverride.summarizationPrompt === "string"
      ? char.hypaV3PromptOverride.summarizationPrompt
      : "";
  char.hypaV3PromptOverride.reSummarizationPrompt =
    typeof char.hypaV3PromptOverride.reSummarizationPrompt === "string"
      ? char.hypaV3PromptOverride.reSummarizationPrompt
      : "";
}

export async function callHypaV3Server(
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
  characters: HypaModalCharacterLike[],
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

function syncHypaV3DataFromServer(args: {
  data: SerializableHypaV3Data;
  target?: ManualSummarizeTarget;
  setHypaV3Data: (data: SerializableHypaV3Data) => void;
  isTargetActive: (target: ManualSummarizeTarget) => boolean;
  getCharacters: () => HypaModalCharacterLike[];
}): void {
  const { data, target, setHypaV3Data, isTargetActive, getCharacters } = args;
  if (!target) return;
  const characters = getCharacters();
  const targetIndices = findManualSummarizeTargetIndices(characters, target);
  if (!targetIndices) return;
  const targetCharacter = characters[targetIndices.characterIndex];
  const targetChat = targetCharacter?.chats?.[targetIndices.chatIndex];
  if (!targetCharacter || !targetChat) return;
  targetChat.hypaV3Data = data;
  if (isTargetActive(target)) {
    setHypaV3Data(data);
  }
  targetCharacter.chats![targetIndices.chatIndex] = { ...targetChat };
  targetCharacter.chats = [...targetCharacter.chats!];
}

function persistManualDebugForActiveChat(args: {
  debug: SummarizeDebugLog;
  target?: ManualSummarizeTarget;
  uncategorizedLabel: string;
  setHypaV3Data: (data: SerializableHypaV3Data) => void;
  isTargetActive: (target: ManualSummarizeTarget) => boolean;
  getCharacters: () => HypaModalCharacterLike[];
}): void {
  const {
    debug,
    target,
    uncategorizedLabel,
    setHypaV3Data,
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
  targetChat.hypaV3Data ??= createEmptyHypaV3Data(uncategorizedLabel);
  targetChat.hypaV3Data.lastManualDebug = debug;
  if (isTargetActive(target)) {
    setHypaV3Data(targetChat.hypaV3Data as SerializableHypaV3Data);
  }
  targetCharacter.chats![targetIndices.chatIndex] = { ...targetChat };
  targetCharacter.chats = [...targetCharacter.chats!];
}

export async function manualSummarizeRange(args: {
  manualState: ManualState;
  currentChar: { chaId?: string } | null;
  promptOverrideCharacter: {
    hypaV3PromptOverride?: {
      summarizationPrompt?: string;
      reSummarizationPrompt?: string;
    };
  } | null;
  chatList: HypaModalChatLike[];
  effectiveChatIndex: number;
  uncategorizedLabel: string;
  setGlobalDebug: (debug: SummarizeDebugLog) => void;
  setHypaV3Data: (data: SerializableHypaV3Data) => void;
  isTargetActive: (target: ManualSummarizeTarget) => boolean;
  getCharacters: () => HypaModalCharacterLike[];
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
    setHypaV3Data,
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
        promptOverrideCharacter?.hypaV3PromptOverride?.summarizationPrompt ?? "",
      reSummarizationPrompt:
        promptOverrideCharacter?.hypaV3PromptOverride?.reSummarizationPrompt ?? "",
    };
    const requestPayload = {
      characterId,
      chatId: chat.id,
      start: startNum,
      end: endNum,
      promptOverride,
    };
    const result = await callHypaV3Server(
      "/data/memory/hypav3/manual-summarize",
      requestPayload,
    );
    if (result.hypaV3Data) {
      syncHypaV3DataFromServer({
        data: result.hypaV3Data as SerializableHypaV3Data,
        target: requestTarget,
        setHypaV3Data,
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
        setHypaV3Data,
        isTargetActive,
        getCharacters,
      });
    } else {
      let fallbackDebug: SummarizeDebugLog = {
        timestamp: Date.now(),
        model: "-",
        isResummarize: false,
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
        const traceResult = await callHypaV3Server(
          "/data/memory/hypav3/manual-summarize/trace",
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
        setHypaV3Data,
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

export function isHypaV2ConversionPossible(args: {
  characters: HypaModalCharacterLike[] | undefined;
  selectedCharIndex: number;
  effectiveChatIndex: number;
}): boolean {
  const chat = args.characters?.[args.selectedCharIndex]?.chats?.[args.effectiveChatIndex];
  return (
    (chat?.hypaV3Data?.summaries?.length ?? 0) === 0 &&
    chat?.hypaV2Data != null
  );
}

export function convertHypaV2ToV3(args: {
  characters: HypaModalCharacterLike[] | undefined;
  selectedCharIndex: number;
  effectiveChatIndex: number;
  uncategorizedLabel: string;
}): { success: boolean; error?: string } {
  try {
    const chat = args.characters?.[args.selectedCharIndex]?.chats?.[args.effectiveChatIndex];
    const hypaV2Data = chat?.hypaV2Data ?? undefined;
    if (!chat) return { success: false, error: "Chat not found." };
    if ((chat.hypaV3Data?.summaries?.length ?? 0) > 0) {
      return { success: false, error: "HypaV3 data already exists." };
    }
    if (!hypaV2Data) return { success: false, error: "HypaV2 data not found." };
    if (hypaV2Data.mainChunks.length === 0) {
      return { success: false, error: "No main chunks found." };
    }
    for (const [index, mainChunk] of hypaV2Data.mainChunks.entries()) {
      if (!Array.isArray(mainChunk.chatMemos)) {
        return { success: false, error: `Chunk ${index}'s chatMemos is not an array.` };
      }
      if (mainChunk.chatMemos.length === 0) {
        return { success: false, error: `Chunk ${index}'s chatMemos is empty.` };
      }
    }
    chat.hypaV3Data = {
      summaries: hypaV2Data.mainChunks.map((mainChunk) => ({
        text: mainChunk.text,
        chatMemos: [...mainChunk.chatMemos],
        isImportant: false,
      })),
      categories: [{ id: "", name: args.uncategorizedLabel }],
      lastSelectedSummaries: [],
    };
    return { success: true };
  } catch (error) {
    return { success: false, error: `Error occurred: ${toErrorMessage(error)}` };
  }
}
