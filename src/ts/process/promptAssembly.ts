import { systemizePromptChats } from "./promptPostProcess";
import {
  normalizeTemplateRange,
  resolveMemoryTemplateMessages,
} from "./promptTemplateShared";

type PromptAssemblyMessage = {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  memo?: string;
  name?: string;
  removable?: boolean;
  multimodals?: unknown[];
  cachePoint?: boolean;
};

export function resolveChatTemplateMessages<T extends PromptAssemblyMessage>(args: {
  chats: T[];
  rangeStart?: number;
  rangeEnd?: number | "end";
  sendChatAsSystem: boolean;
  chatAsOriginalOnSystem?: boolean;
}): T[] {
  const { chats, rangeStart, rangeEnd, sendChatAsSystem, chatAsOriginalOnSystem } = args;
  const rangedChats = normalizeTemplateRange(chats, rangeStart, rangeEnd);
  if (!sendChatAsSystem || chatAsOriginalOnSystem) {
    return rangedChats;
  }
  return systemizePromptChats(rangedChats) as T[];
}

export function resolveMemoryTemplateCardMessages<T extends PromptAssemblyMessage>(args: {
  memoryMessages: T[];
  selectedSummaryTexts: string[];
  rangeStart?: number;
  rangeEnd?: number | "end";
}): { messages: T[]; skippedReason?: string } {
  const { memoryMessages, selectedSummaryTexts, rangeStart, rangeEnd } = args;
  return resolveMemoryTemplateMessages(
    memoryMessages,
    selectedSummaryTexts,
    rangeStart,
    rangeEnd,
  ) as { messages: T[]; skippedReason?: string };
}

export function applyPromptInnerFormat<T extends PromptAssemblyMessage>(
  messages: T[],
  innerFormat: string | undefined,
  formatSlot: (innerFormat: string, slotContent: string) => string,
): T[] {
  if (!innerFormat || messages.length === 0) {
    return messages;
  }

  return messages.map((message) => ({
    ...message,
    content: formatSlot(innerFormat, message.content),
  }));
}
