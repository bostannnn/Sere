import type { ChatTokenizer } from "src/ts/tokenizer";
import type {
  Chat,
  Database,
  character,
  groupChat,
} from "src/ts/storage/database.types";
import type { OpenAIChat } from "./index.svelte";
import { buildMemoryContext, type SerializableMemoryData } from "./memory/memory";
import {
  getCharacterMemoryEnabled,
  getDbMemoryEnabled,
} from "./memory/storage";

export async function applyPromptMemoryContext(args: {
  isNodeServer: boolean;
  database: Pick<Database, "memoryEnabled">;
  room: Chat;
  character: character | groupChat;
  promptChats: OpenAIChat[];
  currentTokens: number;
  maxContextTokens: number;
  tokenizer: ChatTokenizer;
}): Promise<{
  applied: boolean;
  chats: OpenAIChat[];
  currentTokens: number;
  selectedSummaryTexts: string[];
  memory: SerializableMemoryData | undefined;
  error?: string;
}> {
  const {
    isNodeServer,
    database,
    room,
    character,
    promptChats,
    currentTokens,
    maxContextTokens,
    tokenizer,
  } = args;

  if (
    isNodeServer
    || !getDbMemoryEnabled(database)
    || !getCharacterMemoryEnabled(character)
  ) {
    return {
      applied: false,
      chats: promptChats,
      currentTokens,
      selectedSummaryTexts: [],
      memory: undefined,
    };
  }

  const result = await buildMemoryContext(
    promptChats,
    currentTokens,
    maxContextTokens,
    room,
    character,
    tokenizer,
  );

  return {
    applied: true,
    chats: result.chats,
    currentTokens: result.currentTokens,
    selectedSummaryTexts: Array.isArray(result.selectedSummaryTexts)
      ? result.selectedSummaryTexts.filter(
          (item): item is string => typeof item === "string" && item.trim().length > 0,
        )
      : [],
    memory: result.memory,
    error: result.error,
  };
}
