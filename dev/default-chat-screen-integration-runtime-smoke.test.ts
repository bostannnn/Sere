import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  longModelLabel: "Openrouter-moonshotai/kim-k2.5",
  floatingActionCallback: vi.fn(),
  sendChat: vi.fn(async () => {}),
}));

vi.mock(import("src/lang"), () => {
  const base = {
    newMessage: "New message",
    enterMessageForTranslateToEnglish: "Translate input",
    loadMore: "Load more",
    continueResponse: "Continue response",
    autoTranslateInput: "Auto translate input",
    autoSuggest: "Auto suggest",
    screenshot: "Screenshot",
    screenshotSaved: "Screenshot saved",
    postFile: "Post file",
    modules: "Modules",
    reroll: "Reroll",
    chatList: "Chat list",
    autoMode: "Auto mode",
    ttsStop: "Stop TTS",
    hypaMemoryV3Modal: "Hypa memory",
    branchedText: "Branched from {}",
    noMessage: "No message",
    copy: "Copy",
    remove: "Remove",
    translate: "Translate",
    edit: "Edit",
    bookmark: "Bookmark",
    branch: "Branch",
    disableMessage: "Disable message",
    disableAbove: "Disable above",
    bookmarkAskNameOrDefault: "Name",
    copied: "Copied",
    loading: "Loading",
    removeChat: "Remove chat",
    instantRemoveConfirm: "Confirm remove",
    retranslate: "Retranslate",
  } as const;

  return {
    language: new Proxy(base, {
      get: (target, prop) => {
        if (typeof prop === "string" && prop in target) {
          return target[prop as keyof typeof target];
        }
        return String(prop);
      },
    }),
  };
});

vi.mock(import("uuid"), () => ({
  v4: () => "uuid-stub",
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    selectedCharID: writable(0),
    SizeStore: writable({ w: 1280, h: 900 }),
    PlaygroundStore: writable(0),
    createSimpleCharacter: (character: unknown) => character,
    hypaV3ModalOpen: writable(false),
    ScrollToMessageStore: { value: -1 },
    additionalChatMenu: [],
    additionalFloatingActionButtons: [
      {
        name: "Plugin Action",
        callback: mocks.floatingActionCallback,
      },
    ],
    pluginProgressStore: writable({
      active: false,
      label: "",
      color: "#64748b",
    }),
    comfyProgressStore: writable({
      active: false,
      label: "",
      color: "#64748b",
    }),
    ReloadChatPointer: writable({}),
    ReloadGUIPointer: writable(0),
    CurrentTriggerIdStore: writable(null),
    HideIconStore: writable(false),
    selIdState: { selId: 0 },
    DBState: {
      db: {
        fixedChatTextarea: true,
        useChatSticker: false,
        useAutoTranslateInput: true,
        useAutoSuggestions: false,
        autoSuggestClean: false,
        subModel: "",
        useSayNothing: false,
        newMessageButtonStyle: "top-bar",
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
        requestInfoInsideChat: true,
        translator: "enabled",
        translatorType: "none",
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
        memoryLimitThickness: 1,
        theme: "standard",
        guiHTML: "",
        roundIcons: true,
        useChatCopy: true,
        enableBookmark: true,
        swipe: false,
        showFirstMessagePages: false,
        createFolderOnBranch: false,
        clickToEdit: false,
        askRemoval: false,
        instantRemove: false,
        iconsize: 100,
        zoomsize: 100,
        lineHeight: 1.25,
        autoScrollToNewMessage: true,
        alwaysScrollToNewMessage: false,
        characters: [
          {
            chaId: "char-1",
            type: "character",
            name: "Integration Character",
            image: "",
            firstMessage: "Hello",
            alternateGreetings: [],
            creatorNotes: [],
            removedQuotes: false,
            largePortrait: false,
            chatPage: 0,
            chats: [
              {
                id: "chat-1",
                name: "Chat One",
                fmIndex: -1,
                message: [],
                localLore: [],
                modules: [],
                note: "",
                bindedPersona: "",
                bookmarks: [],
                bookmarkNames: {},
              },
            ],
          },
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

vi.mock(import("src/ts/gui/colorscheme"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ColorSchemeTypeStore: writable(false),
  };
});

vi.mock(import("src/ts/gui/longtouch"), () => ({
  longpress: () => ({
    destroy: () => {},
  }),
}));

vi.mock(import("src/ts/model/modellist"), () => ({
  getModelInfo: (_model: string) => ({
    shortName: mocks.longModelLabel,
  }),
}));

vi.mock(import("src/ts/process/scriptings"), () => ({
  runLuaButtonTrigger: async () => null,
}));

vi.mock(import("src/ts/process/scripts"), () => ({
  processScript: async (_character: unknown, message: string) => message,
  risuChatParser: (message: string) => message,
}));

vi.mock(import("src/ts/process/triggers"), () => ({
  runTrigger: async () => null,
}));

vi.mock(import("src/ts/process/tts"), () => ({
  stopTTS: () => {},
  sayTTS: () => {},
}));

vi.mock(import("src/ts/util"), () => ({
  sleep: async () => {},
  capitalize: (value: string) => value,
  getUserIcon: () => "",
  getUserName: () => "User",
}));

vi.mock(import("src/ts/translator/translator"), () => ({
  isExpTranslator: () => false,
  translate: async () => "",
}));

vi.mock(import("src/ts/alert"), () => ({
  alertError: () => {},
  alertNormal: () => {},
  alertWait: () => {},
  alertClear: () => {},
  alertConfirm: async () => false,
  alertInput: async () => "",
  alertRequestData: async () => {},
}));

vi.mock(import("src/ts/parser.svelte"), () => ({
  ParseMarkdown: async (message: string) => `<p>${message}</p>`,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  aiLawApplies: () => true,
  chatFoldedState: { data: null },
  chatFoldedStateMessageIndex: { index: -1 },
  downloadFile: async () => {},
  changeChatTo: () => {},
  foldChatToMessage: () => {},
  getFileSrc: async () => "",
  createChatCopyName: (name: string, suffix: string) => `${name} ${suffix}`,
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

vi.mock(import("src/ts/platform"), () => ({
  isNodeServer: false,
}));

vi.mock(import("src/ts/storage/serverDb"), () => ({
  saveServerDatabase: async () => {},
}));

vi.mock(import("src/ts/storage/serverAuth"), () => ({
  resolveServerAuthToken: async () => "token",
}));

vi.mock(import("src/lib/ChatScreens/ChatBody.svelte"), async () => ({
  default: (await import("./test-stubs/ChatBodyStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/PopupButton.svelte"), async () => ({
  default: (await import("./test-stubs/PopupButtonStub.svelte")).default,
}));

vi.mock(import("src/lib/ChatScreens/Suggestion.svelte"), async () => ({
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

vi.mock(import("src/lib/Others/PluginDefinedIcon.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/GameStateHUD.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import DefaultChatScreen from "src/lib/ChatScreens/DefaultChatScreen.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createLongMessage(seed: string) {
  return `${seed} ${"long content ".repeat(80)}\n${"detail ".repeat(100)}`;
}

describe("default chat screen integration runtime smoke", () => {
  beforeEach(() => {
    mocks.floatingActionCallback.mockClear();
    mocks.sendChat.mockClear();
    DBState.db.fixedChatTextarea = true;
    DBState.db.newMessageButtonStyle = "top-bar";
    DBState.db.useAutoTranslateInput = true;
    DBState.db.sendWithEnter = true;
    DBState.db.characters[0].chatPage = 0;
    DBState.db.characters[0].chats[0].message = [
      {
        role: "char",
        data: createLongMessage("Assistant baseline"),
        chatId: "msg-char-1",
        disabled: false,
        generationInfo: { model: "provider:model-a" },
      },
      {
        role: "user",
        data: createLongMessage("User baseline"),
        chatId: "msg-user-1",
        disabled: false,
      },
      {
        role: "char",
        data: createLongMessage("Assistant followup"),
        chatId: "msg-char-2",
        disabled: false,
        generationInfo: { model: "provider:model-a" },
      },
    ];

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(DefaultChatScreen, { target });
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps real chats/message header actions and fixed composer stable with long-content send flow", async () => {
    await flushUi();

    const scrollShell = document.querySelector(".ds-chat-scroll-shell.default-chat-screen") as HTMLElement | null;
    expect(scrollShell).not.toBeNull();

    const fixedComposer = document.querySelector(
      ".ds-chat-composer-shell.ds-chat-composer-shell-fixed",
    ) as HTMLElement | null;
    expect(fixedComposer).not.toBeNull();

    const chatRows = Array.from(document.querySelectorAll(".chat-message-container .ds-chat-row"));
    expect(chatRows.length).toBeGreaterThan(0);
    expect(document.querySelector(".ds-chat-message-action-inner")).not.toBeNull();
    const chatStack = document.querySelector(".ds-chat-list-stack") as HTMLElement | null;
    expect(chatStack).not.toBeNull();
    expect(chatStack?.classList.contains("list-shell")).toBe(false);
    const firstRenderedMessage = chatStack?.firstElementChild as HTMLElement | null;
    const lastRenderedMessage = chatStack?.lastElementChild as HTMLElement | null;
    expect(firstRenderedMessage?.textContent ?? "").toContain("Assistant followup");
    expect(lastRenderedMessage?.textContent ?? "").toContain("Assistant baseline");

    const titleText = document.querySelector(
      '.ds-chat-message-title-text[title="Integration Character"]',
    ) as HTMLSpanElement | null;
    expect(titleText).not.toBeNull();

    const iconOnlyActions = Array.from(
      document.querySelectorAll(".ds-chat-icon-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(iconOnlyActions.length).toBeGreaterThan(0);
    expect(iconOnlyActions.every((button) => button.type === "button")).toBe(true);

    const genInfoLabels = Array.from(document.querySelectorAll(".ds-chat-geninfo-label")) as HTMLSpanElement[];
    const longModelLabel = genInfoLabels.find(
      (label) => label.getAttribute("title") === mocks.longModelLabel,
    );
    expect(longModelLabel).toBeDefined();
    expect(longModelLabel?.textContent?.trim()).toBe(mocks.longModelLabel);

    const composerInput = document.querySelector(
      ".ds-chat-composer-input.control-field",
    ) as HTMLTextAreaElement | null;
    expect(composerInput).not.toBeNull();

    const longInput = `${"Composer runtime payload ".repeat(60)}\n${"segment ".repeat(80)}`;
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
    menuButton!.click();
    await flushUi();

    expect(menuButton?.getAttribute("aria-expanded")).toBe("true");
    const sideMenuPanel = document.querySelector(".ds-chat-side-menu.panel-shell.ds-ui-menu") as HTMLElement | null;
    expect(sideMenuPanel).not.toBeNull();
    expect(sideMenuPanel?.id).toBe("ds-chat-side-menu");
    expect(sideMenuPanel?.getAttribute("role")).toBe("menu");

    const menuRows = Array.from(
      document.querySelectorAll(".ds-chat-side-menu-item.ds-ui-menu-item"),
    ) as HTMLButtonElement[];
    expect(menuRows.length).toBeGreaterThan(0);
    expect(menuRows.every((row) => row.type === "button")).toBe(true);

    const root = document.querySelector(".ds-chat-root") as HTMLElement | null;
    root?.click();
    await flushUi();
    expect(document.querySelector(".ds-chat-side-menu")).toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
  });
});
