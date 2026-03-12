import { MEMORY_MESSAGE_MEMO } from "./promptTemplateShared";

type PromptMemoryMessage = {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  memo?: string;
  removable?: boolean;
  multimodals?: unknown[];
};

export function splitPromptMessagesForMemoryTemplate<T extends PromptMemoryMessage>(
  chats: T[],
  hasMemoryTemplateCard: boolean,
): {
  chatMessages: T[];
  memoryMessages: T[];
} {
  const memoryMessages: T[] = [];
  const chatMessages = chats.map((chat) => {
    if (chat.memo !== MEMORY_MESSAGE_MEMO) {
      return {
        ...chat,
        removable: true,
      };
    }

    if (hasMemoryTemplateCard) {
      memoryMessages.push(chat);
      return {
        role: "system",
        content: "",
      } as T;
    }

    return {
      ...chat,
      content: `<Previous Conversation>${chat.content}</Previous Conversation>`,
    };
  }).filter((chat) => {
    return chat.content.trim() !== "" || !!(chat.multimodals && chat.multimodals.length > 0);
  });

  return {
    chatMessages,
    memoryMessages,
  };
}
