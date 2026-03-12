import { type DisplayMode as ModalDisplayMode } from "src/lib/Others/MemoryModal/types";
import { type OpenAIChat } from "../index.svelte";

export interface MemoryPreset {
  name: string;
  settings: MemorySettings;
}

export interface MemorySettings {
  summarizationModel: string;
  summarizationPrompt: string;
  memoryTokensRatio: number;
  maxChatsPerSummary: number;
  maxSelectedSummaries: number;
  periodicSummarizationEnabled: boolean;
  periodicSummarizationInterval: number;
  recentSummarySlots: number;
  similarSummarySlots: number;
  recentMemoryRatio: number;
  similarMemoryRatio: number;
  processRegexScript: boolean;
  doNotSummarizeUserMessage: boolean;
}

export interface SummarizeDebugLog {
  timestamp: number;
  model: string;
  prompt: string;
  input: string;
  formatted: { role: string; content: string }[];
  rawResponse?: string;
  characterId?: string;
  chatId?: string;
  start?: number;
  end?: number;
  source?: "manual" | "periodic";
  promptSource?: "request_override" | "character_override" | "preset_or_default";
  periodic?: {
    totalChats: number;
    lastIndex: number;
    newMessages: number;
    interval: number;
    toSummarizeCount: number;
    skippedReason?: string;
    chatName?: string;
  };
}

export interface Summary {
  text: string;
  chatMemos: Set<string>;
  isImportant: boolean;
  categoryId?: string;
  tags?: string[];
}

export interface SerializableSummary extends Omit<Summary, "chatMemos"> {
  chatMemos: string[];
}

export interface MemoryData {
  summaries: Summary[];
  lastManualDebug?: SummarizeDebugLog;
  lastPeriodicDebug?: SummarizeDebugLog;
  categories?: { id: string; name: string }[];
  lastSelectedSummaries?: number[];
  lastSummarizedMessageIndex?: number;
  metrics?: {
    lastImportantSummaries: number[];
    lastRecentSummaries: number[];
    lastSimilarSummaries: number[];
    lastRandomSummaries: number[];
  };
  modalSettings?: {
    displayMode: ModalDisplayMode;
    displayRangeFrom: number;
    displayRangeTo: number;
    displayRecentCount: number;
    displayImportant: boolean;
    displaySelected: boolean;
  };
}

export interface SerializableMemoryData extends Omit<MemoryData, "summaries"> {
  summaries: SerializableSummary[];
}

export interface SummaryChunk {
  text: string;
  summary: Summary;
}

export interface MemoryResult {
  currentTokens: number;
  chats: OpenAIChat[];
  error?: string;
  memory?: SerializableMemoryData;
  selectedSummaryTexts?: string[];
}
