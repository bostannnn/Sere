import type {
  CharacterEvolutionSettings,
  Chat,
  ChatFolder,
  character,
} from "./storage/database.types";
import type { CardExportSelection } from "./cardExportOptions";

export type RisuCharacterExportBundleV1 = {
  version: 1;
  chats?: Chat[];
  chatFolders?: ChatFolder[];
  selectedChatId?: string | null;
  characterEvolution?: CharacterEvolutionSettings;
};

export function buildCharacterExportBundle(
  char: character,
  selection?: CardExportSelection,
): RisuCharacterExportBundleV1 | undefined {
  if (
    !selection
    || selection.cancelled
    || selection.format !== "json"
    || (!selection.includeChats && !selection.includeEvolution)
  ) {
    return undefined;
  }

  const bundle: RisuCharacterExportBundleV1 = {
    version: 1,
  };

  if (selection.includeChats) {
    const chats = cloneChatsForBundle(char.chats, selection.includeMemories);
    if (chats.length > 0) {
      bundle.chats = chats;
      bundle.chatFolders = safeStructuredClone(char.chatFolders ?? []);
      bundle.selectedChatId = chats[resolveSelectedChatIndex(char)]?.id ?? null;
    }
  }

  if (selection.includeEvolution && char.characterEvolution) {
    bundle.characterEvolution = safeStructuredClone(char.characterEvolution);
  }

  return Object.keys(bundle).length > 1 ? bundle : undefined;
}

function cloneChatsForBundle(chats: Chat[] | undefined, includeMemories: boolean): Chat[] {
  if (!Array.isArray(chats)) {
    return [];
  }

  return chats.map((chat) => {
    const cloned = safeStructuredClone(chat);
    if (!includeMemories) {
      delete cloned.memoryData;
    }
    return cloned;
  });
}

function resolveSelectedChatIndex(char: Pick<character, "chats" | "chatPage">): number {
  if (!Array.isArray(char.chats) || char.chats.length === 0) {
    return -1;
  }
  if (!Number.isInteger(char.chatPage) || char.chatPage < 0 || char.chatPage >= char.chats.length) {
    return 0;
  }
  return char.chatPage;
}
