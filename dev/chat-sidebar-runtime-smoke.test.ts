import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const MobileGUI = writable(false);
  const CharEmotion = writable<Record<string, [string, string, number][]>>({});
  const ReloadGUIPointer = writable(0);
  const CharConfigSubMenu = writable(0);
  const hypaV3ModalOpen = writable(false);
  const bookmarkListOpen = writable(false);
  const selIdState = { selId: 0 };
  const DBState = {
    db: {
      theme: "classic",
      customBackground: "",
      textScreenColor: "",
      textBorder: false,
      textScreenRounded: false,
      textScreenBorder: "",
      waifuWidth2: 100,
      waifuWidth: 100,
      classicMaxWidth: false,
      characters: [
        {
          name: "Test Character",
          chaId: "test-char",
          type: "character",
          viewScreen: "none",
          inlayViewScreen: false,
          chats: [{ id: "chat-1", name: "Chat 1", message: [], note: "", localLore: [] }],
          chatPage: 0,
          emotionImages: [["neutral", "neutral.png"]],
          chatFolders: [],
        },
        {
          name: "Test Group",
          chaId: "group-1",
          type: "group",
          viewScreen: "none",
          inlayViewScreen: false,
          chats: [{ id: "group-chat-1", name: "Group Chat 1", message: [], note: "", localLore: [] }],
          chatPage: 0,
          emotionImages: [],
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
    hypaV3ModalOpen,
    bookmarkListOpen,
    selIdState,
  };
});

vi.mock(import("src/lang"), () => ({
  language: {
    Chat: "Chat",
    character: "Character",
    group: "Group",
  },
}));

vi.mock(import("src/ts/util"), () => ({
  getCustomBackground: async () => "",
  getEmotion: async () => [],
}));

vi.mock(import("src/ts/sync/multiuser"), async () => {
  const { writable } = await import("svelte/store");
  return {
    ConnectionOpenStore: writable(false),
  };
});

vi.mock(import("src/lib/UI/GlobalLauncher.svelte"), async () => ({
  default: (await import("./test-stubs/GlobalLauncherStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/DefaultChatScreen.svelte"), async () => ({
  default: (await import("./test-stubs/DefaultChatScreenStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/ChatList.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/Module/ModuleChatMenu.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/GridCatalog.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/ResizeBox.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/BackgroundDom.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/TransitionImage.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/SideChatList.svelte"), async () => ({
  default: (await import("./test-stubs/SideChatListStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/CharConfig.svelte"), async () => ({
  default: (await import("./test-stubs/CharConfigStub.svelte")).default,
}));

import ChatScreen from "src/lib/ChatScreens/ChatScreen.svelte";
import { selectedCharID } from "src/ts/stores.svelte";
import ChatScreenVisibilityProbe from "./test-stubs/ChatScreenVisibilityProbe.svelte";

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
    message.includes("state_unsafe_mutation")
    || message.includes("effect_update_depth_exceeded"),
  );
}

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chat sidebar runtime smoke", () => {
  beforeEach(() => {
    runtimeMessages = [];
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      runtimeMessages.push(args.map((value) => String(value)).join(" "));
    });

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1360,
    });

    window.localStorage.removeItem("risu:desktop-char-config-open");
    window.localStorage.removeItem("risu:desktop-right-panel-tab");
    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatScreen, { target, props: { showGlobalLauncher: true, rightSidebarOpen: true } });
    window.dispatchEvent(new Event("resize"));
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

  it("switches sidebar tabs while sidebar is open", async () => {
    await flushUi();

    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).not.toBeNull();
    const globalRail = document.getElementById("global-navigation-rail") as HTMLElement | null;
    expect(globalRail).not.toBeNull();
    const rightDrawer = document.querySelector(".ds-chat-right-drawer") as HTMLElement | null;
    expect(rightDrawer).not.toBeNull();
    expect(rightDrawer?.id).toBe("chat-right-sidebar-drawer");
    expect(rightDrawer?.dataset.testid).toBe("chat-right-sidebar-drawer");
    expect(rightDrawer?.classList.contains("drawer-elevation--right")).toBe(true);
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="side-chat-list-stub"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="chat-sidebar-close"]')).toBeNull();
    expect(document.querySelector('[data-testid="chat-sidebar-toggle"]')).toBeNull();

    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="char-config-stub"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).toBeNull();

    const chatTab = document.querySelector('[data-testid="chat-sidebar-tab-chat"]') as HTMLButtonElement | null;
    expect(chatTab).not.toBeNull();
    chatTab!.click();
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).not.toBeNull();
    expect((document.querySelector('[data-testid="side-chat-list-stub"]') as HTMLElement | null)?.dataset.charId).toBe("test-char");

    expect(
      hasRuntimeStateError(runtimeMessages),
      `runtime state errors detected: ${runtimeMessages.join("\n")}`,
    ).toBe(false);
  });

  it("supports keyboard tab switching on right sidebar tab strip", async () => {
    await flushUi();

    const tablist = document.querySelector('[role="tablist"]') as HTMLElement | null;
    expect(tablist).not.toBeNull();

    const chatTab = document.querySelector('[data-testid="chat-sidebar-tab-chat"]') as HTMLButtonElement | null;
    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(chatTab).not.toBeNull();
    expect(characterTab).not.toBeNull();
    expect(chatTab?.getAttribute("role")).toBe("tab");
    expect(characterTab?.getAttribute("role")).toBe("tab");
    expect(chatTab?.id).toBe("chat-sidebar-tab-chat");
    expect(characterTab?.id).toBe("chat-sidebar-tab-character");
    expect(chatTab?.getAttribute("aria-controls")).toBe("chat-sidebar-panel-chat");
    expect(characterTab?.getAttribute("aria-controls")).toBe("chat-sidebar-panel-character");
    expect(chatTab?.tabIndex).toBe(0);
    expect(characterTab?.tabIndex).toBe(-1);

    chatTab?.focus();
    expect(document.activeElement).toBe(chatTab);

    chatTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushUi();
    const characterPane = document.querySelector('[data-testid="chat-sidebar-pane-character"]') as HTMLElement | null;
    expect(characterPane).not.toBeNull();
    expect(characterPane?.getAttribute("role")).toBe("tabpanel");
    expect(characterPane?.id).toBe("chat-sidebar-panel-character");
    expect(characterPane?.getAttribute("aria-labelledby")).toBe("chat-sidebar-tab-character");
    expect(document.activeElement).toBe(characterTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("character");
    expect(characterTab?.tabIndex).toBe(0);
    expect(chatTab?.tabIndex).toBe(-1);

    characterTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await flushUi();
    const chatPaneAfterHome = document.querySelector('[data-testid="chat-sidebar-pane-chat"]') as HTMLElement | null;
    expect(chatPaneAfterHome).not.toBeNull();
    expect(chatPaneAfterHome?.getAttribute("role")).toBe("tabpanel");
    expect(chatPaneAfterHome?.id).toBe("chat-sidebar-panel-chat");
    expect(chatPaneAfterHome?.getAttribute("aria-labelledby")).toBe("chat-sidebar-tab-chat");
    expect(document.activeElement).toBe(chatTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("chat");

    chatTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();
    expect(document.activeElement).toBe(characterTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("character");

    characterTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).not.toBeNull();
    expect(document.activeElement).toBe(chatTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("chat");

    tablist!.dispatchEvent(new KeyboardEvent("keydown", { key: "Right", bubbles: true }));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();
    expect(document.activeElement).toBe(characterTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("character");

    tablist!.dispatchEvent(new KeyboardEvent("keydown", { key: "Left", bubbles: true }));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).not.toBeNull();
    expect(document.activeElement).toBe(chatTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("chat");

    const chatPane = document.querySelector('[data-testid="chat-sidebar-pane-chat"]') as HTMLElement | null;
    expect(chatPane).not.toBeNull();
    chatPane?.focus();
    chatPane?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();
    expect(document.activeElement).toBe(characterTab);
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("character");
  });

  it("temporarily hides sidebar while chat overlay is open", async () => {
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).not.toBeNull();

    const openChat = document.querySelector('[data-testid="launcher-open-chat"]') as HTMLButtonElement | null;
    expect(openChat).not.toBeNull();
    openChat!.click();
    await flushUi();

    expect(document.querySelector('[data-testid="overlay-close-stub"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).toBeNull();

    const closeOverlay = document.querySelector('[data-testid="overlay-close"]') as HTMLButtonElement | null;
    expect(closeOverlay).not.toBeNull();
    closeOverlay!.click();
    await flushUi();

    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).not.toBeNull();
  });

  it("keeps sidebar closed when rightSidebarOpen prop is false", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatScreen, { target, props: { showGlobalLauncher: true, rightSidebarOpen: false } });
    window.dispatchEvent(new Event("resize"));
    await flushUi();

    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).toBeNull();
  });

  it("uses group label when selected chat target is a group", async () => {
    selectedCharID.set(1);
    await flushUi();

    const configTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(configTab).not.toBeNull();
    expect(configTab?.textContent).toContain("Group");
  });

  it("persists selected sidebar tab across remount", async () => {
    await flushUi();

    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("character");
    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();

    if (app) {
      await unmount(app);
      app = undefined;
    }

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatScreen, { target, props: { showGlobalLauncher: true, rightSidebarOpen: true } });
    window.dispatchEvent(new Event("resize"));
    await flushUi();

    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).toBeNull();
  });

  it("handles rapid sidebar tab switching without runtime state errors", async () => {
    await flushUi();

    const chatTab = document.querySelector('[data-testid="chat-sidebar-tab-chat"]') as HTMLButtonElement | null;
    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(chatTab).not.toBeNull();
    expect(characterTab).not.toBeNull();

    for (let i = 0; i < 12; i += 1) {
      characterTab!.click();
      chatTab!.click();
    }
    characterTab!.click();
    await flushUi();

    expect(document.querySelector('[data-testid="chat-sidebar-pane-character"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="char-config-stub"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="chat-sidebar-pane-chat"]')).toBeNull();
    expect(window.localStorage.getItem("risu:desktop-right-panel-tab")).toBe("character");
    expect(
      hasRuntimeStateError(runtimeMessages),
      `runtime state errors detected: ${runtimeMessages.join("\n")}`,
    ).toBe(false);
  });

  it("reports effective sidebar visibility when overlays or viewport hide the inspector", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatScreenVisibilityProbe, { target, props: { showGlobalLauncher: true, rightSidebarOpen: true } });
    window.dispatchEvent(new Event("resize"));
    await flushUi();

    const visibleProbe = document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null;
    expect(visibleProbe).not.toBeNull();
    expect(visibleProbe?.dataset.visible).toBe("1");

    const openChat = document.querySelector('[data-testid="launcher-open-chat"]') as HTMLButtonElement | null;
    expect(openChat).not.toBeNull();
    openChat!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("0");

    const closeOverlay = document.querySelector('[data-testid="overlay-close"]') as HTMLButtonElement | null;
    expect(closeOverlay).not.toBeNull();
    closeOverlay!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("1");

    const openModule = document.querySelector('[data-testid="default-open-module"]') as HTMLButtonElement | null;
    expect(openModule).not.toBeNull();
    openModule!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("0");

    const closeModuleOverlay = document.querySelector('[data-testid="overlay-close"]') as HTMLButtonElement | null;
    expect(closeModuleOverlay).not.toBeNull();
    closeModuleOverlay!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("1");

    const openCharacters = document.querySelector('[data-testid="launcher-open-characters"]') as HTMLButtonElement | null;
    expect(openCharacters).not.toBeNull();
    openCharacters!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("0");

    const closeCharacterOverlay = document.querySelector('[data-testid="overlay-close"]') as HTMLButtonElement | null;
    expect(closeCharacterOverlay).not.toBeNull();
    closeCharacterOverlay!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("1");

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 900,
    });
    window.dispatchEvent(new Event("resize"));
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("0");
  });

  it("keeps inspector closed after tablet-width collapse until explicitly reopened", async () => {
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).not.toBeNull();

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 900,
    });
    window.dispatchEvent(new Event("resize"));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).toBeNull();

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1360,
    });
    window.dispatchEvent(new Event("resize"));
    await flushUi();
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).toBeNull();
  });

  it("reopens inspector only after explicit desktop reopen following tablet collapse", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatScreenVisibilityProbe, { target, props: { showGlobalLauncher: true, rightSidebarOpen: true } });
    window.dispatchEvent(new Event("resize"));
    await flushUi();

    expect((document.querySelector('[data-testid="chat-sidebar-open-probe"]') as HTMLElement | null)?.dataset.open).toBe("1");
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("1");
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).not.toBeNull();

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 900,
    });
    window.dispatchEvent(new Event("resize"));
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-open-probe"]') as HTMLElement | null)?.dataset.open).toBe("0");
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("0");
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).toBeNull();

    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1360,
    });
    window.dispatchEvent(new Event("resize"));
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-open-probe"]') as HTMLElement | null)?.dataset.open).toBe("0");
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("0");
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).toBeNull();

    const reopenButton = document.querySelector('[data-testid="chat-sidebar-open-true"]') as HTMLButtonElement | null;
    expect(reopenButton).not.toBeNull();
    reopenButton!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="chat-sidebar-open-probe"]') as HTMLElement | null)?.dataset.open).toBe("1");
    expect((document.querySelector('[data-testid="chat-sidebar-visible-probe"]') as HTMLElement | null)?.dataset.visible).toBe("1");
    expect(document.querySelector('[data-testid="chat-sidebar-host"]')).not.toBeNull();
  });
});
