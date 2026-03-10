import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  sendChat: vi.fn(async () => {}),
  createEvolutionProposal: vi.fn(async () => ({
    proposal: {
      proposalId: "proposal-1",
      sourceChatId: "chat-1",
      proposedState: {
        relationship: { trustLevel: "higher", dynamic: "warmer after the last exchange" },
        activeThreads: ["new job nerves"],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "close", residue: "supportive" },
        keyMoments: ["user opened up about work"],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      changes: [
        {
          sectionKey: "relationship",
          summary: "The relationship became warmer.",
          evidence: ["Character said they feel closer now."],
        },
      ],
      createdAt: 1,
    },
  })),
  acceptEvolutionProposal: vi.fn(async (_characterId: string, proposedState: unknown) => ({
    version: 1,
    acceptedAt: 1234,
    state: proposedState,
  })),
  rejectEvolutionProposal: vi.fn(async () => ({ ok: true })),
  changeChatTo: vi.fn(),
}));

const platformState = vi.hoisted(() => ({
  isMobile: false,
}));

vi.mock(import("src/lang"), () => ({
  language: {
    newMessage: "New message",
    enterMessageForTranslateToEnglish: "Translate input",
    loadMore: "Load more",
    continueResponse: "Continue response",
    autoTranslateInput: "Auto translate input",
    autoSuggest: "Auto suggest",
    screenshot: "Screenshot",
    postFile: "Post file",
    modules: "Modules",
    reroll: "Reroll",
    chatList: "Chat list",
    autoMode: "Auto mode",
    ttsStop: "Stop TTS",
    hypaMemoryV3Modal: "Hypa memory",
  },
}));

vi.mock(import("uuid"), () => ({
  v4: () => "uuid-stub",
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const makeCharacter = (arg: {
    chaId: string;
    name: string;
    chatId: string;
    proposalId?: string | null;
    trustLevel?: string;
  }) => ({
    chaId: arg.chaId,
    type: "character",
    name: arg.name,
    image: "",
    firstMessage: "Hello",
    alternateGreetings: [],
    creatorNotes: [],
    removedQuotes: false,
    largePortrait: false,
    chatPage: 0,
    chats: [
      {
        id: arg.chatId,
        name: `${arg.name} Chat`,
        fmIndex: -1,
        message: [],
        localLore: [],
        modules: [],
        note: "",
        bindedPersona: "",
      },
    ],
    characterEvolution: {
      enabled: true,
      useGlobalDefaults: false,
      extractionProvider: "openrouter",
      extractionModel: "anthropic/claude-3.5-haiku",
      extractionMaxTokens: 2400,
      extractionPrompt: "prompt",
      sectionConfigs: [
        {
          key: "relationship",
          label: "Relationship",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track trust shifts.",
          kind: "object",
          sensitive: false,
        },
        {
          key: "activeThreads",
          label: "Active Threads",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track open threads.",
          kind: "list",
          sensitive: false,
        },
        {
          key: "lastChatEnded",
          label: "Last Chat Ended",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track ending residue.",
          kind: "object",
          sensitive: false,
        },
        {
          key: "keyMoments",
          label: "Key Moments",
          enabled: true,
          includeInPrompt: true,
          instruction: "Track key moments.",
          kind: "list",
          sensitive: false,
        },
      ],
      privacy: {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
      },
      currentStateVersion: 0,
      currentState: {
        relationship: { trustLevel: "", dynamic: "" },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "", residue: "" },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      pendingProposal: arg.proposalId
        ? {
            proposalId: arg.proposalId,
            sourceChatId: arg.chatId,
            proposedState: {
              relationship: { trustLevel: arg.trustLevel ?? "", dynamic: `${arg.name} dynamic` },
              activeThreads: [`${arg.name} thread`],
              runningJokes: [],
              characterLikes: [],
              characterDislikes: [],
              characterHabits: [],
              characterBoundariesPreferences: [],
              userFacts: [],
              userRead: [],
              userLikes: [],
              userDislikes: [],
              lastChatEnded: { state: `${arg.name} close`, residue: `${arg.name} residue` },
              keyMoments: [`${arg.name} moment`],
              characterIntimatePreferences: [],
              userIntimatePreferences: [],
            },
            changes: [
              {
                sectionKey: "relationship",
                summary: `${arg.name} relationship changed.`,
                evidence: [`${arg.name} evidence`],
              },
            ],
            createdAt: 1,
          }
        : null,
      lastProcessedChatId: null,
      stateVersions: [],
    },
  });
  return {
    selectedCharID: writable(0),
    createSimpleCharacter: (character: unknown) => character,
    hypaV3ModalOpen: writable(false),
    ScrollToMessageStore: { value: -1 },
    comfyProgressStore: writable({
      active: false,
      label: "",
      color: "#64748b",
    }),
    selIdState: { selId: 0 },
    DBState: {
      db: {
        fixedChatTextarea: false,
        useChatSticker: true,
        useAutoTranslateInput: true,
        useAutoSuggestions: false,
        autoSuggestClean: false,
        subModel: "",
        newMessageButtonStyle: "floating-circle",
        sideMenuRerollButton: false,
        screenshotChat: false,
        sideMenuTranslateInput: false,
        sideMenuCreateImagePrompt: false,
        sideMenuContinueButton: false,
        sideMenuRisuCommand: false,
        sideMenuAutoModeButton: false,
        sideMenuGoogleSearchButton: false,
        sideMenuDatabankButton: false,
        sideMenuRagSearchButton: false,
        sideMenuScreenshotButton: false,
        sideMenuHypaMemoryButton: false,
        translator: "enabled",
        sendWithEnter: true,
        playMessage: false,
        username: "User",
        selectedPersona: 0,
        personas: [
          {
            id: "persona-1",
            name: "User Persona",
            icon: "",
            largePortrait: false,
          },
        ],
        characters: [
          makeCharacter({ chaId: "char-1", name: "Character One", chatId: "chat-1" }),
          makeCharacter({ chaId: "char-2", name: "Character Two", chatId: "chat-2" }),
        ],
      },
    },
  };
});

vi.mock(import("src/ts/storage/database.svelte"), async () => {
  const { DBState } = await import("src/ts/stores.svelte");
  return {
    getDatabase: () => ({}),
    getCurrentCharacter: () => DBState.db.characters[0],
    getCurrentChat: () => DBState.db.characters[0].chats[0],
    setCurrentChat: (chat: unknown) => {
      DBState.db.characters[0].chats[0] = chat as (typeof DBState.db.characters)[number]["chats"][number];
    },
  };
});

vi.mock(import("src/ts/characters"), () => ({
  getCharImage: async () => "",
}));

vi.mock(import("src/ts/process/index.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    chatProcessStage: writable(0),
    isDoingChat: writable(false),
    sendChat: mocks.sendChat,
  };
});

vi.mock(import("src/ts/util"), () => ({
  sleep: async () => {},
}));

vi.mock(import("src/ts/translator/translator"), () => ({
  isExpTranslator: () => false,
  translate: async () => "",
}));

vi.mock(import("src/ts/alert"), () => ({
  alertError: () => {},
  alertNormal: () => {},
  alertWait: () => {},
}));

vi.mock(import("src/ts/process/scripts"), () => ({
  processScript: async (_character: unknown, message: string) => message,
}));

vi.mock(import("src/ts/process/tts"), () => ({
  stopTTS: () => {},
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  aiLawApplies: () => true,
  chatFoldedState: { data: null },
  chatFoldedStateMessageIndex: { index: -1 },
  downloadFile: async () => {},
  changeChatTo: mocks.changeChatTo,
}));

vi.mock(import("src/ts/characterEvolution"), () => {
  const ensureState = (char: Record<string, unknown>) => char.characterEvolution as Record<string, unknown>;
  return {
    ensureCharacterEvolution: (char: Record<string, unknown>) => ensureState(char),
    getEffectiveCharacterEvolutionSettings: (_db: unknown, char: Record<string, unknown>) => ensureState(char),
  };
});

vi.mock(import("src/ts/evolution"), async () => {
  const { DBState } = await import("src/ts/stores.svelte");

  return {
    createCharacterEvolutionProposal: mocks.createEvolutionProposal,
    acceptCharacterEvolutionProposal: mocks.acceptEvolutionProposal,
    rejectCharacterEvolutionProposal: mocks.rejectEvolutionProposal,
    getCharacterEvolutionErrorMessage: (error: unknown) => String(error ?? "Unknown error"),
    getPendingCharacterEvolutionProposal: (character: Record<string, unknown> | null | undefined) => character?.characterEvolution?.pendingProposal ?? null,
    createNewChatAfterEvolution: async (charIndex: number) => {
      const character = DBState.db.characters[charIndex];
      character.chats.unshift({
        id: "chat-2",
        name: "New Chat 1",
        fmIndex: -1,
        message: [],
        localLore: [],
        modules: [],
        note: "",
        bindedPersona: "",
      });
      character.chatPage = 0;
      mocks.changeChatTo(0);
    },
  };
});

vi.mock(import("src/ts/process/triggers"), () => ({
  runTrigger: async () => null,
}));

vi.mock(import("src/ts/process/prereroll"), () => ({
  PreUnreroll: () => null,
  Prereroll: () => null,
}));

vi.mock(import("src/ts/process/command"), () => ({
  processMultiCommand: async () => false,
}));

vi.mock(import("src/ts/process/files/multisend"), () => ({
  postChatFile: async () => null,
}));

vi.mock(import("src/ts/process/files/inlays"), () => ({
  getInlayAsset: async () => ({ type: "image", data: "" }),
}));

vi.mock(import("src/ts/sync/multiuser"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ConnectionOpenStore: writable(false),
  };
});

vi.mock(import("src/ts/platform"), async () => {
  const actual = await vi.importActual<typeof import("src/ts/platform")>("src/ts/platform");
  return {
    ...actual,
    get isMobile() {
      return platformState.isMobile;
    },
    isNodeServer: false,
  };
});

vi.mock(import("src/ts/storage/serverDb"), () => ({
  saveServerDatabase: async () => {},
}));

vi.mock(import("src/ts/storage/serverAuth"), () => ({
  resolveServerAuthToken: async () => "token",
}));

vi.mock(import("src/lib/ChatScreens/Suggestion.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/ChatScreens/Chat.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/ChatScreens/CreatorQuote.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/MainMenu.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/ChatScreens/AssetInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/ChatScreens/Chats.svelte"), async () => ({
  default: (await import("./test-stubs/DefaultChatScreenChatsStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/GameStateHUD.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/Evolution/ReviewWorkspace.svelte"), async () => ({
  default: (await import("./test-stubs/DefaultChatScreenReviewWorkspaceStub.svelte")).default,
}));

import DefaultChatScreen from "src/lib/ChatScreens/DefaultChatScreen.svelte";
import { DBState, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("default chat screen runtime smoke", () => {
  beforeEach(() => {
    mocks.sendChat.mockClear();
    mocks.createEvolutionProposal.mockClear();
    mocks.acceptEvolutionProposal.mockClear();
    mocks.rejectEvolutionProposal.mockClear();
    mocks.changeChatTo.mockClear();
    platformState.isMobile = false;
    selectedCharID.set(0);
    DBState.db.fixedChatTextarea = false;
    DBState.db.newMessageButtonStyle = "floating-circle";
    DBState.db.useAutoTranslateInput = true;
    DBState.db.sendWithEnter = true;
    DBState.db.characters[0] = {
      ...DBState.db.characters[0],
      name: "Character One",
      chaId: "char-1",
      chatPage: 0,
      chats: [
        {
          id: "chat-1",
          name: "Character One Chat",
          fmIndex: -1,
          message: [],
          localLore: [],
          modules: [],
          note: "",
          bindedPersona: "",
        },
      ],
      characterEvolution: {
        ...DBState.db.characters[0].characterEvolution,
        currentStateVersion: 0,
        currentState: {
          relationship: { trustLevel: "", dynamic: "" },
          activeThreads: [],
          runningJokes: [],
          characterLikes: [],
          characterDislikes: [],
          characterHabits: [],
          characterBoundariesPreferences: [],
          userFacts: [],
          userRead: [],
          userLikes: [],
          userDislikes: [],
          lastChatEnded: { state: "", residue: "" },
          keyMoments: [],
          characterIntimatePreferences: [],
          userIntimatePreferences: [],
        },
        pendingProposal: null,
        lastProcessedChatId: null,
        stateVersions: [],
      },
    };
    DBState.db.characters[1] = {
      ...DBState.db.characters[1],
      name: "Character Two",
      chaId: "char-2",
      chatPage: 0,
      chats: [
        {
          id: "chat-2",
          name: "Character Two Chat",
          fmIndex: -1,
          message: [],
          localLore: [],
          modules: [],
          note: "",
          bindedPersona: "",
        },
      ],
      characterEvolution: {
        ...DBState.db.characters[1].characterEvolution,
        currentStateVersion: 0,
        currentState: {
          relationship: { trustLevel: "", dynamic: "" },
          activeThreads: [],
          runningJokes: [],
          characterLikes: [],
          characterDislikes: [],
          characterHabits: [],
          characterBoundariesPreferences: [],
          userFacts: [],
          userRead: [],
          userLikes: [],
          userDislikes: [],
          lastChatEnded: { state: "", residue: "" },
          keyMoments: [],
          characterIntimatePreferences: [],
          userIntimatePreferences: [],
        },
        pendingProposal: null,
        lastProcessedChatId: null,
        stateVersions: [],
      },
    };
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);
    window.confirm = confirmMock;
    vi.stubGlobal(
      "safeStructuredClone",
      <T>(value: T) => (typeof structuredClone === "function"
        ? structuredClone(value)
        : JSON.parse(JSON.stringify(value)) as T),
    );
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    vi.unstubAllGlobals();
  });

  it("keeps composer controls on primitive classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const stickerToggle = document.querySelector(
      ".ds-chat-composer-icon-toggle.icon-btn.icon-btn--md",
    ) as HTMLButtonElement | null;
    expect(stickerToggle).not.toBeNull();
    expect(stickerToggle?.getAttribute("type")).toBe("button");
    expect(stickerToggle?.getAttribute("aria-label")).toBe("Toggle stickers");

    const composerInput = document.querySelector(
      ".ds-chat-composer-input.control-field",
    ) as HTMLTextAreaElement | null;
    expect(composerInput).not.toBeNull();

    const translateInput = document.querySelector(
      ".ds-chat-translate-input.control-field",
    ) as HTMLTextAreaElement | null;
    expect(translateInput).not.toBeNull();

    const composerButtons = Array.from(
      document.querySelectorAll(".ds-chat-composer-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(composerButtons.length).toBe(2);
    const menuButton = document.querySelector(
      ".ds-chat-composer-action.ds-chat-composer-action-end.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    expect(menuButton?.getAttribute("type")).toBe("button");
    expect(menuButton?.getAttribute("aria-label")).toBe("Open chat actions");
    expect(menuButton?.getAttribute("aria-haspopup")).toBe("menu");
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
    expect(menuButton?.getAttribute("aria-controls")).toBe("ds-chat-side-menu");
    menuButton?.click();
    await flushUi();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("true");

    const menuRows = Array.from(
      document.querySelectorAll(".ds-chat-side-menu-item.ds-ui-menu-item"),
    ) as HTMLButtonElement[];
    const sideMenuPanel = document.querySelector(
      ".ds-chat-side-menu.ds-chat-side-menu-composer.panel-shell.ds-ui-menu",
    ) as HTMLElement | null;
    expect(sideMenuPanel).not.toBeNull();
    expect(sideMenuPanel?.id).toBe("ds-chat-side-menu");
    expect(sideMenuPanel?.getAttribute("role")).toBe("menu");
    expect(menuRows.length).toBeGreaterThan(0);
    expect(menuRows.every((row) => row.tagName === "BUTTON")).toBe(true);
    expect(menuRows.every((row) => row.getAttribute("type") === "button")).toBe(true);

    const continueButton = menuRows.find(
      (row) => row.getAttribute("aria-label") === "Continue response",
    ) as HTMLButtonElement | undefined;
    expect(continueButton).toBeDefined();
    expect(continueButton?.getAttribute("aria-disabled")).toBe("true");

    const autoTranslateButton = menuRows.find(
      (row) => row.getAttribute("aria-label") === "Auto translate input",
    ) as HTMLButtonElement | undefined;
    expect(autoTranslateButton).toBeDefined();
    expect(autoTranslateButton?.getAttribute("aria-pressed")).toBe("true");

    const floatingJumpButton = document.querySelector(
      ".ds-chat-jump-btn-circle.icon-btn.icon-btn--md",
    ) as HTMLButtonElement | null;
    expect(floatingJumpButton).not.toBeNull();
    expect(floatingJumpButton?.getAttribute("type")).toBe("button");
    expect(floatingJumpButton?.getAttribute("aria-label")).toBe("New message");
  });

  it("renders the main menu when no character is selected", async () => {
    const { selectedCharID } = await import("src/ts/stores.svelte");
    selectedCharID.set(-1);

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    expect(document.querySelector('[data-testid="simple-panel-stub"]')).not.toBeNull();
  });

  it("keeps fixed composer and top-bar jump stable with long input/send flow", async () => {
    DBState.db.fixedChatTextarea = true;
    DBState.db.newMessageButtonStyle = "top-bar";

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const scrollShell = document.querySelector(".ds-chat-scroll-shell.default-chat-screen") as HTMLElement | null;
    expect(scrollShell).not.toBeNull();

    const fixedComposer = document.querySelector(
      ".ds-chat-composer-shell.ds-chat-composer-shell-fixed",
    ) as HTMLElement | null;
    expect(fixedComposer).not.toBeNull();

    const topBarJumpButton = document.querySelector(
      ".ds-chat-jump-btn.ds-chat-jump-btn-top-bar",
    ) as HTMLButtonElement | null;
    expect(topBarJumpButton).not.toBeNull();
    expect(topBarJumpButton?.getAttribute("type")).toBe("button");
    expect(topBarJumpButton?.getAttribute("aria-label")).toBe("New message");
    expect(topBarJumpButton?.getAttribute("title")).toBe("New message");

    const composerInput = document.querySelector(
      ".ds-chat-composer-input.control-field",
    ) as HTMLTextAreaElement | null;
    expect(composerInput).not.toBeNull();

    const longInput = `${"Long runtime content ".repeat(60)}\n${"extra ".repeat(80)}`;
    composerInput!.value = longInput;
    composerInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();
    expect(composerInput!.value).toBe(longInput);

    composerInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(1);
    expect(composerInput!.value).toBe("");

    const menuButton = document.querySelector(
      ".ds-chat-composer-action.ds-chat-composer-action-end.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
    const reopenMenuButton = document.querySelector(
      ".ds-chat-composer-action.ds-chat-composer-action-end.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(reopenMenuButton).not.toBeNull();
    reopenMenuButton!.click();
    await flushUi();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector(".ds-chat-side-menu")).not.toBeNull();

    const root = document.querySelector(".ds-chat-root") as HTMLElement | null;
    root?.click();
    await flushUi();
    expect(document.querySelector(".ds-chat-side-menu")).toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps Enter as button-only send on mobile", async () => {
    platformState.isMobile = true;
    DBState.db.sendWithEnter = true;

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const composerInput = document.querySelector(
      ".ds-chat-composer-input.control-field",
    ) as HTMLTextAreaElement | null;
    const translateInput = document.querySelector(
      ".ds-chat-translate-input.control-field",
    ) as HTMLTextAreaElement | null;
    const sendButton = document.querySelector(
      '.ds-chat-composer-action.icon-btn.icon-btn--sm[aria-label="Send message"]',
    ) as HTMLButtonElement | null;

    expect(composerInput).not.toBeNull();
    expect(translateInput).not.toBeNull();
    expect(sendButton).not.toBeNull();
    expect(composerInput?.getAttribute("enterkeyhint")).toBe("enter");
    expect(translateInput?.getAttribute("enterkeyhint")).toBe("enter");

    composerInput!.value = "mobile composer";
    composerInput!.dispatchEvent(new Event("input", { bubbles: true }));
    composerInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);

    translateInput!.value = "mobile translate";
    translateInput!.dispatchEvent(new Event("input", { bubbles: true }));
    translateInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);

    sendButton!.click();
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(1);
  });

  it("keeps Enter as button-only send on mobile even when sendWithEnter is disabled", async () => {
    platformState.isMobile = true;
    DBState.db.sendWithEnter = false;

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const composerInput = document.querySelector(
      ".ds-chat-composer-input.control-field",
    ) as HTMLTextAreaElement | null;
    const translateInput = document.querySelector(
      ".ds-chat-translate-input.control-field",
    ) as HTMLTextAreaElement | null;
    const sendButton = document.querySelector(
      '.ds-chat-composer-action.icon-btn.icon-btn--sm[aria-label="Send message"]',
    ) as HTMLButtonElement | null;

    expect(composerInput).not.toBeNull();
    expect(translateInput).not.toBeNull();
    expect(sendButton).not.toBeNull();
    expect(composerInput?.getAttribute("enterkeyhint")).toBe("enter");
    expect(translateInput?.getAttribute("enterkeyhint")).toBe("enter");

    composerInput!.value = "mobile composer disabled";
    composerInput!.dispatchEvent(new Event("input", { bubbles: true }));
    composerInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);

    translateInput!.value = "mobile translate disabled";
    translateInput!.dispatchEvent(new Event("input", { bubbles: true }));
    translateInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);

    sendButton!.click();
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(1);
  });

  it("uses Shift+Enter to send on desktop when sendWithEnter is disabled", async () => {
    DBState.db.sendWithEnter = false;

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const composerInput = document.querySelector(
      ".ds-chat-composer-input.control-field",
    ) as HTMLTextAreaElement | null;

    expect(composerInput).not.toBeNull();
    expect(composerInput?.getAttribute("enterkeyhint")).toBe("enter");

    composerInput!.value = "desktop composer";
    composerInput!.dispatchEvent(new Event("input", { bubbles: true }));
    composerInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);

    composerInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(1);
  });

  it("does not send from translate input on desktop when sendWithEnter is disabled", async () => {
    DBState.db.sendWithEnter = false;

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const translateInput = document.querySelector(
      ".ds-chat-translate-input.control-field",
    ) as HTMLTextAreaElement | null;

    expect(translateInput).not.toBeNull();
    expect(translateInput?.getAttribute("enterkeyhint")).toBe("enter");

    translateInput!.value = "desktop translate";
    translateInput!.dispatchEvent(new Event("input", { bubbles: true }));
    translateInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);

    translateInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true }));
    await flushUi();
    expect(mocks.sendChat).toHaveBeenCalledTimes(0);
  });

  it("accepts an evolution proposal and creates a new chat from the review panel", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const menuButton = document.querySelector(
      ".ds-chat-composer-action.ds-chat-composer-action-end.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await flushUi();

    const handoffButton = Array.from(document.querySelectorAll(".ds-chat-side-menu-item")).find(
      (element) => (element as HTMLButtonElement).getAttribute("aria-label") === "Character evolution handoff",
    ) as HTMLButtonElement | undefined;
    expect(handoffButton).toBeDefined();
    handoffButton!.click();
    await flushUi();

    const acceptAndCreateButton = document.querySelector(
      '[data-testid="review-accept-create"]',
    ) as HTMLButtonElement | null;
    expect(acceptAndCreateButton).not.toBeNull();
    acceptAndCreateButton!.click();
    await flushUi();

    expect(mocks.createEvolutionProposal).toHaveBeenCalledTimes(1);
    expect(mocks.acceptEvolutionProposal).toHaveBeenCalledTimes(1);
    expect(DBState.db.characters[0].characterEvolution.currentStateVersion).toBe(1);
    expect(DBState.db.characters[0].characterEvolution.pendingProposal).toBeNull();
    expect(DBState.db.characters[0].characterEvolution.lastProcessedChatId).toBe("chat-1");
    expect(DBState.db.characters[0].characterEvolution.stateVersions).toEqual([
      {
        version: 1,
        chatId: "chat-1",
        acceptedAt: 1234,
      },
    ]);
    expect(DBState.db.characters[0].chats).toHaveLength(2);
    expect(DBState.db.characters[0].chats[0]?.name).toBe("New Chat 1");
    expect(DBState.db.characters[0].chatPage).toBe(0);
    expect(mocks.changeChatTo).toHaveBeenCalledWith(0);
  });

  it("records the accepted chat locally after accepting without creating a new one", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const menuButton = document.querySelector(
      ".ds-chat-composer-action.ds-chat-composer-action-end.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await flushUi();

    const handoffButton = Array.from(document.querySelectorAll(".ds-chat-side-menu-item")).find(
      (element) => (element as HTMLButtonElement).getAttribute("aria-label") === "Character evolution handoff",
    ) as HTMLButtonElement | undefined;
    expect(handoffButton).toBeDefined();
    handoffButton!.click();
    await flushUi();

    const acceptButton = Array.from(document.querySelectorAll("button")).find(
      (element) => (element as HTMLButtonElement).textContent?.trim() === "Accept",
    ) as HTMLButtonElement | undefined;
    expect(acceptButton).toBeDefined();
    acceptButton!.click();
    await flushUi();

    expect(DBState.db.characters[0].characterEvolution.lastProcessedChatId).toBe("chat-1");
  });

  it("replays handoff for an already accepted chat when confirmed", async () => {
    DBState.db.characters[0].characterEvolution.lastProcessedChatId = "chat-1";

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const menuButton = document.querySelector(
      ".ds-chat-composer-action.ds-chat-composer-action-end.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await flushUi();

    const handoffButton = Array.from(document.querySelectorAll(".ds-chat-side-menu-item")).find(
      (element) => (element as HTMLButtonElement).getAttribute("aria-label") === "Character evolution handoff",
    ) as HTMLButtonElement | undefined;
    expect(handoffButton).toBeDefined();
    expect(handoffButton?.textContent).toContain("Replay Accepted Chat");
    handoffButton!.click();
    await flushUi();

    expect(mocks.createEvolutionProposal).toHaveBeenCalledTimes(1);
    expect(mocks.createEvolutionProposal).toHaveBeenCalledWith("char-1", "chat-1", { forceReplay: true });
  });

  it("re-seeds the review draft when switching to a different character proposal", async () => {
    DBState.db.characters[0].characterEvolution.pendingProposal = {
      proposalId: "proposal-char-1",
      sourceChatId: "chat-1",
      proposedState: {
        relationship: { trustLevel: "char-1", dynamic: "Character One dynamic" },
        activeThreads: ["Character One thread"],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "Character One close", residue: "Character One residue" },
        keyMoments: ["Character One moment"],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      changes: [],
      createdAt: 1,
    };

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    DBState.db.characters[1].characterEvolution.pendingProposal = {
      proposalId: "proposal-char-2",
      sourceChatId: "chat-2",
      proposedState: {
        relationship: { trustLevel: "char-2", dynamic: "Character Two dynamic" },
        activeThreads: ["Character Two thread"],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "Character Two close", residue: "Character Two residue" },
        keyMoments: ["Character Two moment"],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      changes: [],
      createdAt: 1,
    };
    selectedCharID.set(1);
    await flushUi();

    const reviewPrompt = Array.from(document.querySelectorAll("button")).find(
      (element) => (element as HTMLButtonElement).textContent?.includes("Pending evolution proposal"),
    ) as HTMLButtonElement | undefined;
    expect(reviewPrompt).toBeDefined();
    reviewPrompt?.click();
    await flushUi();

    const acceptButton = Array.from(document.querySelectorAll("button")).find(
      (element) => (element as HTMLButtonElement).textContent?.trim() === "Accept",
    ) as HTMLButtonElement | undefined;
    expect(acceptButton).toBeDefined();
    acceptButton?.click();
    await flushUi();

    expect(mocks.acceptEvolutionProposal).toHaveBeenCalledTimes(1);
    expect(mocks.acceptEvolutionProposal.mock.calls[0]?.[0]).toBe("char-2");
    expect(mocks.acceptEvolutionProposal.mock.calls[0]?.[1]).toMatchObject({
      relationship: {
        trustLevel: "char-2",
        dynamic: "Character Two dynamic",
      },
    });
  });

  it("keeps async accept-and-create work pinned to the original character", async () => {
    let resolveAccept: ((value: {
      version: number;
      acceptedAt: number;
      state: {
        relationship: { trustLevel: string; dynamic: string };
        activeThreads: string[];
        runningJokes: string[];
        characterLikes: never[];
        characterDislikes: never[];
        characterHabits: never[];
        characterBoundariesPreferences: never[];
        userFacts: never[];
        userRead: string[];
        userLikes: never[];
        userDislikes: never[];
        lastChatEnded: { state: string; residue: string };
        keyMoments: string[];
        characterIntimatePreferences: never[];
        userIntimatePreferences: never[];
      };
    }) => void) | null = null;

    mocks.acceptEvolutionProposal.mockImplementationOnce(async () => {
      return await new Promise((resolve) => {
        resolveAccept = resolve;
      });
    });

    DBState.db.characters[0].characterEvolution.pendingProposal = {
      proposalId: "proposal-char-1",
      sourceChatId: "chat-1",
      proposedState: {
        relationship: { trustLevel: "char-1", dynamic: "Character One dynamic" },
        activeThreads: ["Character One thread"],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "Character One close", residue: "Character One residue" },
        keyMoments: ["Character One moment"],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
      changes: [],
      createdAt: 1,
    };

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
    await flushUi();

    const reviewPrompt = target.querySelector(".ds-chat-evolution-review-prompt") as HTMLButtonElement | null;
    expect(reviewPrompt).not.toBeNull();
    reviewPrompt!.click();
    await flushUi();

    const acceptCreateButton = target.querySelector('[data-testid="review-accept-create"]') as HTMLButtonElement | null;
    expect(acceptCreateButton).not.toBeNull();
    acceptCreateButton!.click();
    await flushUi();

    selectedCharID.set(1);
    await flushUi();

    resolveAccept?.({
      version: 2,
      acceptedAt: 999,
      state: {
        relationship: { trustLevel: "char-1", dynamic: "Character One dynamic" },
        activeThreads: ["Character One thread"],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: { state: "Character One close", residue: "Character One residue" },
        keyMoments: ["Character One moment"],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
      },
    });
    await flushUi();
    await flushUi();

    expect(DBState.db.characters[0].characterEvolution.currentStateVersion).toBe(2);
    expect(DBState.db.characters[0].characterEvolution.lastProcessedChatId).toBe("chat-1");
    expect(DBState.db.characters[0].chats).toHaveLength(2);
    expect(DBState.db.characters[0].chats[0]?.id).toBe("chat-2");
    expect(DBState.db.characters[1].characterEvolution.currentStateVersion).toBe(0);
    expect(DBState.db.characters[1].chats).toHaveLength(1);
  });
});
