import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  getModelInfo: vi.fn(() => ({
    shortName: "stub-model",
  })),
}));

vi.mock(import("src/lang"), () => ({
  language: {
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
  },
}));

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
  getModelInfo: (model: string) => mocks.getModelInfo(model),
}));

vi.mock(import("src/ts/process/scriptings"), () => ({
  runLuaButtonTrigger: async () => null,
}));

vi.mock(import("src/ts/process/scripts"), () => ({
  risuChatParser: (message: string) => message,
}));

vi.mock(import("src/ts/process/triggers"), () => ({
  runTrigger: async () => null,
}));

vi.mock(import("src/ts/process/tts"), () => ({
  sayTTS: () => {},
}));

vi.mock(import("src/ts/sync/multiuser"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ConnectionOpenStore: writable(false),
  };
});

vi.mock(import("src/ts/util"), () => ({
  capitalize: (value: string) => value,
  getUserIcon: () => "",
  getUserName: () => "User",
  sleep: async () => {},
}));

vi.mock(import("src/ts/alert"), () => ({
  alertClear: () => {},
  alertConfirm: async () => false,
  alertInput: async () => "",
  alertNormal: () => {},
  alertRequestData: async () => {},
  alertWait: () => {},
}));

vi.mock(import("src/ts/parser.svelte"), () => ({
  ParseMarkdown: async (message: string) => `<p>${message}</p>`,
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  resolveSelectedChatState: (characters: Array<Record<string, unknown>>, selectedCharacterIndex: number) => {
    const character = characters[selectedCharacterIndex] ?? null;
    const chatIndex = typeof character?.chatPage === "number" ? character.chatPage : 0;
    const chat = Array.isArray(character?.chats) ? character.chats[chatIndex] ?? null : null;
    return {
      character,
      characterIndex: character ? selectedCharacterIndex : -1,
      chat,
      chatIndex: chat ? chatIndex : -1,
      messages: Array.isArray(chat?.message) ? chat.message : [],
    };
  },
  setChatByCharacterAndChatId: () => true,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  aiLawApplies: () => true,
  changeChatTo: () => {},
  foldChatToMessage: () => {},
  getFileSrc: async () => "",
  createChatCopyName: (name: string, suffix: string) => `${name} ${suffix}`,
}));

vi.mock(import("src/lib/ChatScreens/ChatBody.svelte"), async () => ({
  default: (await import("./test-stubs/ChatBodyStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/PopupButton.svelte"), async () => ({
  default: (await import("./test-stubs/PopupButtonStub.svelte")).default,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        memoryLimitThickness: 1,
        theme: "standard",
        guiHTML: "",
        roundIcons: true,
        useChatCopy: true,
        enableBookmark: true,
        translator: "enabled",
        swipe: false,
        showFirstMessagePages: false,
        createFolderOnBranch: false,
        clickToEdit: false,
        askRemoval: false,
        instantRemove: false,
        characters: [
          {
            chaId: "char-1",
            name: "Char One",
            type: "character",
            image: "",
            ttsMode: "none",
            chatPage: 0,
            chatFolders: [],
            chats: [
              {
                id: "chat-1",
                name: "Chat One",
                folderId: "",
                message: [
                  {
                    role: "char",
                    data: "hello world",
                    chatId: "msg-1",
                    disabled: false,
                  },
                ],
                bookmarks: [],
                bookmarkNames: {},
              },
            ],
          },
        ],
      },
    },
    selectedCharID: writable(0),
    SizeStore: writable({ w: 1280, h: 900 }),
    HideIconStore: writable(false),
    ReloadGUIPointer: writable(0),
    ReloadChatPointer: writable({}),
    CurrentTriggerIdStore: writable(null),
    selIdState: { selId: 0 },
  };
});

import Chat from "src/lib/ChatScreens/Chat.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chat message actions runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    DBState.db.theme = "standard";
    mocks.getModelInfo.mockReset();
    mocks.getModelInfo.mockReturnValue({
      shortName: "stub-model",
    });
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies icon-btn primitives for icon-only chat actions and keeps menu rows text-compatible", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Chat, {
      target,
      props: {
        message: "hello world",
        name: "Assistant",
        isLastMemory: false,
        idx: -1,
      },
    });
    await flushUi();

    const iconOnlyButtons = Array.from(
      document.querySelectorAll(".ds-chat-icon-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(iconOnlyButtons.length).toBeGreaterThanOrEqual(2);
    expect(iconOnlyButtons.every((button) => button.getAttribute("type") === "button")).toBe(true);
    expect(iconOnlyButtons.some((button) => button.getAttribute("aria-label") === "Copy")).toBe(true);

    const menuRows = Array.from(
      document.querySelectorAll(".ds-chat-icon-action.ds-ui-menu-item"),
    ) as HTMLButtonElement[];
    expect(menuRows.length).toBeGreaterThan(0);
    expect(menuRows.every((row) => !row.classList.contains("icon-btn"))).toBe(true);
    expect(menuRows.every((row) => row.getAttribute("type") === "button")).toBe(true);
  });

  it("keeps comment-delete action on icon-btn primitive", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Chat, {
      target,
      props: {
        message: "{{specialcomment::branchedfrom::chat-a::Chat A::msg-a::}}",
        name: "Assistant",
        isLastMemory: false,
        idx: 0,
        isComment: true,
      },
    });
    await flushUi();

    const commentDeleteButton = document.querySelector(
      ".ds-chat-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(commentDeleteButton).not.toBeNull();
    expect(commentDeleteButton?.getAttribute("type")).toBe("button");
    expect(commentDeleteButton?.getAttribute("aria-label")).toBe("Remove");
  });

  it("keeps generation info actions on icon-btn primitive", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Chat, {
      target,
      props: {
        message: "hello world",
        name: "Assistant",
        isLastMemory: false,
        idx: -1,
        messageGenerationInfo: {
          model: "provider:model-a",
        },
      },
    });
    await flushUi();

    const genInfoButtons = Array.from(
      document.querySelectorAll(".ds-chat-geninfo-button.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(genInfoButtons.length).toBeGreaterThan(0);
    expect(genInfoButtons.every((button) => button.getAttribute("type") === "button")).toBe(true);
    expect(genInfoButtons[0]?.getAttribute("aria-label")).toBe("View generation info");
  });

  it("keeps long generation model labels constrained while preserving semantics", async () => {
    const longModelLabel = "Openrouter-moonshotai/kim-k2.5-preview-build";
    mocks.getModelInfo.mockReturnValue({
      shortName: longModelLabel,
    });

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Chat, {
      target,
      props: {
        message: "hello world",
        name: "Assistant with a very long display name for runtime verification",
        isLastMemory: false,
        idx: -1,
        messageGenerationInfo: {
          model: "provider:model-a",
        },
      },
    });
    await flushUi();

    const titleText = document.querySelector(".ds-chat-message-title-text") as HTMLSpanElement | null;
    expect(titleText).not.toBeNull();
    expect(titleText?.getAttribute("title")).toBe(
      "Assistant with a very long display name for runtime verification",
    );

    const genInfoLabel = document.querySelector(".ds-chat-geninfo-label") as HTMLSpanElement | null;
    expect(genInfoLabel).not.toBeNull();
    expect(genInfoLabel?.textContent?.trim()).toBe(longModelLabel);
    expect(genInfoLabel?.getAttribute("title")).toBe(longModelLabel);

    const actionRail = document.querySelector(
      ".ds-ui-grow.action-rail.ds-ui-action-rail.ds-ui-action-rail-end.ds-chat-message-action-rail",
    ) as HTMLElement | null;
    expect(actionRail).not.toBeNull();
    const actionInnerRail = actionRail?.querySelector(
      ".action-rail.ds-ui-action-rail.ds-ui-action-rail-offset.ds-chat-message-action-inner",
    ) as HTMLElement | null;
    expect(actionInnerRail).not.toBeNull();
  });

  it("keeps cardboard chat actions on action-rail primitive", async () => {
    DBState.db.theme = "cardboard";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Chat, {
      target,
      props: {
        message: "hello world",
        name: "Assistant",
        isLastMemory: false,
        idx: -1,
      },
    });
    await flushUi();

    const cardboardActions = document.querySelector(".ds-chat-cardboard-actions.action-rail") as HTMLElement | null;
    expect(cardboardActions).not.toBeNull();
    const iconRail = cardboardActions?.querySelector(".ds-ui-grow.action-rail.ds-ui-action-rail") as HTMLElement | null;
    expect(iconRail).not.toBeNull();
  });
});
