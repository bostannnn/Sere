type PromptRole = "function" | "system" | "user" | "assistant";

type PromptChat = {
  role: PromptRole;
  content: string;
  memo?: string;
  name?: string;
  attr?: string[];
  cachePoint?: boolean;
};

export function getPlainPromptLabel(type2?: string): string {
  switch (type2) {
    case "main":
      return "Main Prompt";
    case "globalNote":
      return "Global Note";
    case "jailbreak":
      return "Jailbreak";
    case "normal":
    default:
      return "Plain Prompt";
  }
}

export function systemizePromptChats<T extends PromptChat>(chat: T[]): T[] {
  return chat.map((item) => {
    if (item.role !== "user" && item.role !== "assistant") {
      return item;
    }

    const attr = item.attr ?? [];
    let content = item.content;

    if (item.name?.startsWith("example_")) {
      content = `${item.name}: ${content}`;
    } else if (!attr.includes("nameAdded")) {
      content = `${item.role}: ${content}`;
    }

    return {
      ...item,
      role: "system",
      content,
      memo: undefined,
      name: undefined,
    };
  });
}

export function markRecentUserCachePoints<T extends PromptChat>(
  chats: T[],
  count: number,
): void {
  let pointer = chats.length - 1;
  let depthRemaining = count;

  while (pointer >= 0) {
    if (depthRemaining === 0) {
      break;
    }
    if (chats[pointer].role === "user") {
      chats[pointer].cachePoint = true;
      depthRemaining--;
    }
    pointer--;
  }
}

export function trimPromptChats<T extends PromptChat>(chats: T[]): T[] {
  return chats.map((chat) => ({
    ...chat,
    content: chat.content.trim(),
  }));
}
