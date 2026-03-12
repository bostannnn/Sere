import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const MobileGUI = writable(false);
  const CharEmotion = writable<Record<string, [string, string, number][]>>({});
  const ReloadGUIPointer = writable(0);
  const CharConfigSubMenu = writable(0);
  const bookmarkListOpen = writable(false);
  const selIdState = { selId: 0 };
  const DBState = {
    db: {
      theme: "waifu",
      customBackground: "",
      textScreenColor: "",
      textBorder: false,
      textScreenRounded: false,
      textScreenBorder: "",
      waifuWidth2: 100,
      waifuWidth: 100,
      classicMaxWidth: false,
      customPromptTemplateToggle: "",
      globalChatVariables: {},
      selectedPersona: 0,
      personas: [{ id: "persona-1" }],
      username: "tester",
      characters: [
        {
          name: "Test Character",
          chaId: "test-char",
          type: "character",
          viewScreen: "emotion",
          inlayViewScreen: false,
          chats: [{ id: "chat-1", name: "Chat 1", message: [], note: "", localLore: [] }],
          chatPage: 0,
          emotionImages: [["neutral", "neutral.png"]],
          chatFolders: [],
        },
      ],
    },
  };

  return {
    DBState,
    selectedCharID,
    MobileGUI,
    CharEmotion,
    ReloadGUIPointer,
    CharConfigSubMenu,
    bookmarkListOpen,
    selIdState,
  };
});

vi.mock(import("src/lang"), () => ({
  language: {
    Chat: "Chat",
    character: "Character",
    newChat: "New Chat",
    errors: { onlyOneChat: "Only one chat" },
    removeConfirm: "Remove ",
    orderByOrder: "Order by order",
    ToggleMemory: "Toggle HypaMemory",
    changeFolderColor: "Change folder color",
    cancel: "Cancel",
    doYouWantToUnbindCurrentPersona: "Unbind persona?",
    personaUnbindedSuccess: "Persona unbound",
    doYouWantToBindCurrentPersona: "Bind persona?",
    personaBindedSuccess: "Persona bound",
  },
}));

vi.mock(import("src/ts/util"), () => ({
  getCustomBackground: async () => "",
  getEmotion: async () => ["normal", "/emotion-a.png", "/emotion-b.png"],
  sleep: async (_ms = 0) => {},
  sortableOptions: {},
  findCharacterbyId: () => ({ firstMessage: "Hello" }),
  parseToggleSyntax: () => [],
}));

vi.mock(import("src/ts/process/modules"), () => ({
  getModuleToggles: () => "",
  getModuleAssets: () => [],
  moduleUpdate: () => {},
}));

vi.mock(import("src/ts/characters"), () => ({
  exportChat: () => {},
  importChat: () => {},
  exportAllChats: () => {},
}));

vi.mock(import("src/ts/alert"), async () => {
  const { writable } = await import("svelte/store");
  return {
    alertChatOptions: async () => 0,
    alertConfirm: async () => false,
    alertError: () => {},
    alertNormal: () => {},
    alertSelect: async () => 0,
    alertStore: writable({ type: "none", msg: "" }),
  };
});

vi.mock(import("src/ts/sync/multiuser"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ConnectionOpenStore: writable(false),
    createMultiuserRoom: () => {},
  };
});

vi.mock(import("src/ts/globalApi.svelte"), async (importOriginal) => {
  const actual = await importOriginal<typeof import("src/ts/globalApi.svelte")>();
  return {
    ...actual,
    changeChatTo: () => {},
    createChatCopyName: (name: string, suffix: string) =>
      `${name ?? "Chat"} ${suffix}`,
  };
});

vi.mock(import("sortablejs/modular/sortable.core.esm.js"), () => {
  const fakeSortable = class {
    static create() {
      return { destroy() {} };
    }
    constructor() {}
    destroy() {}
  };
  return { default: fakeSortable };
});

vi.mock(import("src/lib/ChatScreens/DefaultChatScreen.svelte"), async () => ({
  default: (await import("./test-stubs/DefaultChatScreenStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/ChatList.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/Module/ModuleChatMenu.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/ResizeBox.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/BackgroundDom.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/CharConfig.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import ChatScreen from "src/lib/ChatScreens/ChatScreen.svelte";
import { CharEmotion, DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;
let runtimeMessages: string[] = [];
let consoleErrorSpy: ReturnType<typeof vi.spyOn> | undefined;

const onError = (event: Event) => {
  const errEvent = event as ErrorEvent;
  runtimeMessages.push(String(errEvent.error ?? errEvent.message ?? event));
};

const onUnhandledRejection = (event: Event) => {
  const promiseEvent = event as PromiseRejectionEvent;
  runtimeMessages.push(String(promiseEvent.reason ?? event));
};

function hasRuntimeStateError(messages: string[]) {
  return messages.some((message) =>
    message.includes("state_unsafe_mutation") ||
    message.includes("effect_update_depth_exceeded"),
  );
}

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chat runtime smoke", () => {
  beforeEach(() => {
    runtimeMessages = [];
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      runtimeMessages.push(args.map((value) => String(value)).join(" "));
    });

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatScreen, { target });
  });

  afterEach(async () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    consoleErrorSpy?.mockRestore();
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("opens/close overlays and updates emotion without runtime state errors", async () => {
    await flushUi();

    for (let i = 0; i < 4; i += 1) {
      CharEmotion.set({
        "test-char": [["neutral", `emotion-${i}.png`, Date.now() + i]],
      });
      await flushUi();
    }

    const openChat = document.querySelector('[data-testid="default-open-chat"]') as HTMLButtonElement | null;
    openChat?.click();
    await flushUi();

    const closeOverlay = document.querySelector('[data-testid="overlay-close"]') as HTMLButtonElement | null;
    closeOverlay?.click();
    await flushUi();

    const openModule = document.querySelector('[data-testid="default-open-module"]') as HTMLButtonElement | null;
    openModule?.click();
    await flushUi();

    const closeOverlay3 = document.querySelector('[data-testid="overlay-close"]') as HTMLButtonElement | null;
    closeOverlay3?.click();
    await flushUi();

    expect(
      hasRuntimeStateError(runtimeMessages),
      `runtime state errors detected: ${runtimeMessages.join("\n")}`,
    ).toBe(false);
  });

  it("applies focus reading mode only on supported themes and viewport widths", async () => {
    const mountChatScreen = async (theme: string, mode: "normal" | "focus", width: number) => {
      if (app) {
        await unmount(app);
      }
      DBState.db.theme = theme;
      DBState.db.chatReadingMode = mode;
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: width,
      });
      const target = document.createElement("div");
      document.body.innerHTML = "";
      document.body.appendChild(target);
      app = mount(ChatScreen, { target });
      window.dispatchEvent(new Event("resize"));
      await flushUi();
      return document.querySelector(".ds-chat-screen-shell") as HTMLElement | null;
    };

    const focusShell = await mountChatScreen("cardboard", "focus", 1366);
    expect(focusShell?.dataset.readingMode).toBe("focus");
    expect(focusShell?.dataset.chatTheme).toBe("cardboard");

    const narrowShell = await mountChatScreen("cardboard", "focus", 900);
    expect(narrowShell?.dataset.readingMode).toBe("normal");

    const unsupportedThemeShell = await mountChatScreen("waifuMobile", "focus", 1366);
    expect(unsupportedThemeShell?.dataset.readingMode).toBe("normal");
    expect(unsupportedThemeShell?.dataset.chatTheme).toBe("mobilechat");
  });
});
