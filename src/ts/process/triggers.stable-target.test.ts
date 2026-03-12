import { beforeEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";
import type { Chat, character } from "../storage/database.types";

const mockState = vi.hoisted(() => ({
  db: {
    characters: [] as character[],
    templateDefaultVariables: "",
  },
  setDatabase: vi.fn(),
}));

vi.mock("../parser/chatML", () => ({
  parseChatML: () => [],
}));

vi.mock("../parser.svelte", () => ({
  risuChatParser: (value: string) => value,
}));

vi.mock("../storage/database.svelte", () => ({
  getDatabase: () => mockState.db,
  resolveCharacterEntryById: (
    characters: character[],
    characterId: string,
  ) => characters.find((candidate) => candidate.chaId === characterId) ?? null,
  resolveChatStateByCharacterAndChatId: (
    characters: character[],
    characterId: string,
    chatId: string,
  ) => {
    const characterIndex = characters.findIndex((candidate) => candidate.chaId === characterId);
    const character = characterIndex >= 0 ? characters[characterIndex] : null;
    const chatIndex = Array.isArray(character?.chats)
      ? character.chats.findIndex((chat) => chat.id === chatId)
      : -1;
    const chat = chatIndex >= 0 && Array.isArray(character?.chats) ? character.chats[chatIndex] : null;
    return {
      character,
      characterIndex,
      chat,
      chatIndex,
      messages: Array.isArray(chat?.message) ? chat.message : [],
    };
  },
  setDatabase: (...args: unknown[]) => mockState.setDatabase(...args),
}));

vi.mock("../tokenizer", () => ({
  tokenize: async () => 0,
}));

vi.mock("./modules", () => ({
  getModuleTriggers: () => [],
}));

vi.mock("../stores.svelte", () => ({
  ReloadChatPointer: writable({}),
  ReloadGUIPointer: writable(0),
  CurrentTriggerIdStore: writable<string | null>(null),
}));

vi.mock("./command", () => ({
  processMultiCommand: async () => null,
}));

vi.mock("../util", () => ({
  parseKeyValue: () => [],
  sleep: async () => {},
}));

vi.mock("../alert", () => ({
  alertError: () => {},
  alertInput: async () => "",
  alertNormal: () => {},
  alertSelect: async () => "",
}));

vi.mock("./memory/embeddings", () => ({
  EmbeddingProcessor: class {
    async addText() {}
    async similaritySearch() {
      return [];
    }
  },
}));

vi.mock("./request/request", () => ({
  requestChatData: async () => ({
    type: "success",
    result: "",
  }),
}));

vi.mock("./scriptings", () => ({
  runScripted: async () => ({
    stopSending: false,
    chat: { message: [] },
  }),
}));

vi.mock("./infunctions", () => ({
  calcString: () => 0,
}));

import { runTrigger } from "./triggers";

function createCharacter(overrides: Partial<character> = {}): character {
  return {
    chaId: "char-1",
    type: "character",
    name: "Char One",
    image: "",
    firstMessage: "",
    desc: "Original description",
    notes: "",
    replaceGlobalNote: "",
    globalLore: [],
    chatFolders: [],
    viewScreen: "none",
    bias: [],
    emotionImages: [],
    customscript: [],
    defaultVariables: "",
    triggerscript: [],
    utilityBot: false,
    exampleMessage: "",
    creatorNotes: "",
    systemPrompt: "",
    postHistoryInstructions: "",
    alternateGreetings: [],
    tags: [],
    creator: "",
    characterVersion: "",
    personality: "",
    scenario: "",
    firstMsgIndex: 0,
    chats: [],
    chatPage: 0,
    additionalText: "",
    lowLevelAccess: false,
    ...overrides,
  };
}

function createChat(overrides: Partial<Chat> = {}): Chat {
  return {
    id: "chat-1",
    name: "Chat One",
    message: [],
    note: "",
    localLore: [],
    scriptstate: {},
    ...overrides,
  };
}

describe("runTrigger stable target writes", () => {
  beforeEach(() => {
    mockState.setDatabase.mockReset();
    mockState.db.characters = [];
    mockState.db.templateDefaultVariables = "";
  });

  it("writes chat-scoped effects back to the targeted chat by ids", async () => {
    const targetChat = createChat();
    const otherChat = createChat({ id: "chat-2", note: "other note" });
    const targetCharacter = createCharacter({
      triggerscript: [
        {
          comment: "set-author-note",
          type: "manual",
          conditions: [],
          effect: [
            { type: "v2Header", indent: 0 },
            {
              type: "v2SetAuthorNote",
              valueType: "value",
              value: "stable note",
              indent: 0,
            },
          ],
        },
      ],
      chats: [targetChat],
    });
    const otherCharacter = createCharacter({
      chaId: "char-2",
      name: "Char Two",
      chats: [otherChat],
    });

    mockState.db.characters = [targetCharacter, otherCharacter];

    const result = await runTrigger(
      structuredClone(targetCharacter),
      "manual",
      {
        chat: structuredClone(targetChat),
        manualName: "set-author-note",
      },
    );

    expect(result?.chat.note).toBe("stable note");
    expect(mockState.db.characters[0].chats[0].note).toBe("stable note");
    expect(mockState.db.characters[1].chats[0].note).toBe("other note");
  });

  it("writes character-scoped effects back to the originating character", async () => {
    const targetCharacter = createCharacter({
      triggerscript: [
        {
          comment: "set-character-desc",
          type: "manual",
          conditions: [],
          effect: [
            { type: "v2Header", indent: 0 },
            {
              type: "v2SetCharacterDesc",
              valueType: "value",
              value: "Updated description",
              indent: 0,
            },
          ],
        },
      ],
      chats: [createChat()],
    });
    const otherCharacter = createCharacter({
      chaId: "char-2",
      name: "Char Two",
      desc: "Other description",
      chats: [createChat({ id: "chat-2" })],
    });

    mockState.db.characters = [targetCharacter, otherCharacter];

    await runTrigger(
      structuredClone(targetCharacter),
      "manual",
      {
        chat: structuredClone(targetCharacter.chats[0]),
        manualName: "set-character-desc",
      },
    );

    expect(mockState.db.characters[0].desc).toBe("Updated description");
    expect(mockState.db.characters[1].desc).toBe("Other description");
  });
});
