import type {
  CharacterEvolutionSettings,
  Chat,
  ChatFolder,
  character,
} from "./storage/database.types";
import type { RisuCharacterExportBundleV1 } from "./cardBundleExport";

export function applyCharacterExportBundle(char: character, raw: unknown): void {
  const bundle = readCharacterExportBundle(raw);
  if (!bundle) {
    return;
  }

  if (Array.isArray(bundle.chats) && bundle.chats.length > 0) {
    char.chats = safeStructuredClone(bundle.chats);
    char.chatFolders = Array.isArray(bundle.chatFolders) ? safeStructuredClone(bundle.chatFolders) : [];
    char.chatPage = resolveImportedChatPage(char.chats, bundle.selectedChatId);
  } else if (!Array.isArray(char.chats) || char.chats.length === 0) {
    char.chats = [createDefaultImportedChat()];
    char.chatPage = 0;
  }

  if (bundle.characterEvolution && typeof bundle.characterEvolution === "object") {
    char.characterEvolution = safeStructuredClone(bundle.characterEvolution);
  }
}

export function readCharacterExportBundle(raw: unknown): RisuCharacterExportBundleV1 | undefined {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }

  const bundle = raw as Record<string, unknown>;
  if (bundle.version !== 1) {
    return undefined;
  }

  return {
    version: 1,
    chats: Array.isArray(bundle.chats) ? (bundle.chats as Chat[]) : undefined,
    chatFolders: Array.isArray(bundle.chatFolders) ? (bundle.chatFolders as ChatFolder[]) : undefined,
    selectedChatId: typeof bundle.selectedChatId === "string" || bundle.selectedChatId === null
      ? (bundle.selectedChatId as string | null)
      : undefined,
    characterEvolution: bundle.characterEvolution as CharacterEvolutionSettings | undefined,
  };
}

export function resolveImportedChatPage(chats: Chat[] | undefined, selectedChatId: string | null | undefined): number {
  if (!Array.isArray(chats) || chats.length === 0) {
    return 0;
  }
  if (!selectedChatId) {
    return 0;
  }
  const chatIndex = chats.findIndex((chat) => chat?.id === selectedChatId);
  return chatIndex >= 0 ? chatIndex : 0;
}

function createDefaultImportedChat(): Chat {
  return {
    message: [],
    note: "",
    name: "Chat 1",
    localLore: [],
  };
}
