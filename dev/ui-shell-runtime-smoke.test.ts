import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

const { addCharacterMock } = vi.hoisted(() => ({
  addCharacterMock: vi.fn(async () => {}),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");

  const settingsOpen = writable(false);
  const openPresetList = writable(false);
  const openPersonaList = writable(false);
  const MobileGUI = writable(false);
  const SettingsMenuIndex = writable(-1);
  const CustomGUISettingMenuStore = writable(false);
  const loadedStore = writable(true);
  const alertStore = writable({ type: "none", msg: "" });
  const bookmarkListOpen = writable(false);
  const selectedCharID = writable(-1);
  const PlaygroundStore = writable(0);
  const uiShellV2Enabled = writable(true);
  const openRulebookManager = writable(false);
  const additionalHamburgerMenu: Array<{ name: string; icon: string; iconType: "html" | "img" | "none"; callback: () => void; id: string }> = [];
  const hypaV3ModalOpen = writable(false);
  const hypaV3ProgressStore = writable({
    open: false,
    miniMsg: "",
    msg: "",
    subMsg: "",
  });
  const appRouteStore = writable({
    workspace: "home",
    selectedCharacterId: null,
    selectedChatId: null,
    inspector: "none",
  });

  const DBState = {
    db: {
      characters: [
        {
          chaId: "char-1",
          name: "Character One",
          chatPage: 0,
          chats: [{ id: "chat-1" }],
        },
        {
          chaId: "char-2",
          name: "Character Two",
          chatPage: 1,
          chats: [{ id: "chat-2-a" }, { id: "chat-2-b" }],
        },
      ],
      modules: [],
    },
  };

  const popupStore = { children: null };
  const LoadingStatusState = { text: "" };
  const selIdState = { selId: -1 };

  return {
    settingsOpen,
    openPresetList,
    openPersonaList,
    MobileGUI,
    SettingsMenuIndex,
    CustomGUISettingMenuStore,
    loadedStore,
    alertStore,
    LoadingStatusState,
    bookmarkListOpen,
    popupStore,
    selectedCharID,
    PlaygroundStore,
    DBState,
    uiShellV2Enabled,
    appRouteStore,
    openRulebookManager,
    additionalHamburgerMenu,
    hypaV3ModalOpen,
    hypaV3ProgressStore,
    selIdState,
  };
});

vi.mock(import("src/lib/ChatScreens/ChatScreen.svelte"), async () => ({
  default: (await import("./test-stubs/AppChatScreenStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Settings.svelte"), async () => ({
  default: (await import("./test-stubs/AppSettingsStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/RulebookManager/RulebookLibrary.svelte"), async () => ({
  default: (await import("./test-stubs/AppRulebookStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/AlertComp.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/BookmarkList.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/botpreset.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/listedPersona.svelte"), async () => ({
  default: (await import("./test-stubs/OverlayCloseStub.svelte")).default,
}));
vi.mock(import("src/lib/Mobile/MobileHeader.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Mobile/MobileBody.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Mobile/MobileFooter.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/CustomGUISettingMenu.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/HypaV3Modal.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/HypaV3Progress.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/PluginAlertModal.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/PopupList.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/SavePopupIcon.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/HomeCharacterDirectory.svelte"), async () => ({
  default: (await import("./test-stubs/AppHomeGridStub.svelte")).default,
}));

vi.mock(import("src/ts/characterCards"), () => ({
  importCharacterProcess: async () => {},
}));
vi.mock(import("src/ts/storage/database.svelte"), () => ({
  importPreset: async () => {},
  getDatabase: () => ({ modules: [] }),
  setDatabase: () => {},
}));
vi.mock(import("src/ts/process/modules"), () => ({
  readModule: async () => null,
}));
vi.mock(import("src/ts/alert"), () => ({
  alertNormal: () => {},
  alertSelect: async () => "-1",
}));
vi.mock(import("src/lang"), () => ({
  language: {
    successImport: "imported",
  },
}));
vi.mock(import("src/ts/globalApi.svelte"), () => ({
  checkCharOrder: () => {},
}));
vi.mock(import("src/ts/platform"), () => ({
  isNodeServer: true,
  isTauri: false,
}));
vi.mock(import("src/ts/characters"), () => ({
  addCharacter: addCharacterMock,
}));

import {
  DBState,
  MobileGUI,
  SettingsMenuIndex,
  appRouteStore,
  bookmarkListOpen,
  hypaV3ModalOpen,
  openPersonaList,
  openPresetList,
  openRulebookManager,
  selectedCharID,
  settingsOpen,
  uiShellV2Enabled,
} from "src/ts/stores.svelte";
import AppComponent from "src/App.svelte";

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

describe("ui shell runtime smoke", () => {
  beforeEach(async () => {
    addCharacterMock.mockClear();
    runtimeMessages = [];
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((...args) => {
      runtimeMessages.push(args.map((value) => String(value)).join(" "));
    });

    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    MobileGUI.set(false);
    SettingsMenuIndex.set(-1);
    uiShellV2Enabled.set(true);
    openPresetList.set(false);
    openPersonaList.set(false);
    bookmarkListOpen.set(false);
    hypaV3ModalOpen.set(false);
    DBState.db.characters = [
      {
        chaId: "char-1",
        name: "Character One",
        chatPage: 0,
        chats: [{ id: "chat-1" }],
      },
      {
        chaId: "char-2",
        name: "Character Two",
        chatPage: 1,
        chats: [{ id: "chat-2-a" }, { id: "chat-2-b" }],
      },
    ];
    window.localStorage.setItem("risu:desktop-char-config-open", "1");
    window.localStorage.setItem("risu:desktop-library-sidebar-open", "1");
    window.localStorage.setItem("risu:desktop-library-sidebar-tab", "library");
    window.localStorage.removeItem("risu:desktop-right-panel-tab");

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(AppComponent as never, { target });
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

  it("keeps topbar mounted for settings and library workspaces", async () => {
    await flushUi();
    expect(document.querySelector(".ds-app-v2-topbar")).not.toBeNull();
    expect(document.querySelector('[data-testid="app-home-grid-stub"]')).not.toBeNull();

    const railToggle = document.getElementById("globalMenuBtn") as HTMLButtonElement | null;
    expect(railToggle).not.toBeNull();
    expect(railToggle?.getAttribute("type")).toBe("button");
    expect(railToggle?.disabled).toBe(false);
    expect(railToggle?.getAttribute("aria-pressed")).toBe("true");
    expect(railToggle?.getAttribute("aria-expanded")).toBeNull();
    expect(railToggle?.getAttribute("aria-controls")).toBeNull();

    settingsOpen.set(true);
    selectedCharID.set(-1);
    openRulebookManager.set(false);
    await flushUi();

    expect(document.querySelector(".ds-app-v2-topbar")).not.toBeNull();
    expect(document.querySelector('[data-testid="app-settings-stub"]')).not.toBeNull();
    expect((document.getElementById("globalMenuBtn") as HTMLButtonElement | null)?.disabled).toBe(false);
    expect((document.querySelector('[data-testid="topbar-nav-settings"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");

    settingsOpen.set(false);
    openRulebookManager.set(true);
    await flushUi();

    expect(document.querySelector(".ds-app-v2-topbar")).not.toBeNull();
    expect(document.querySelector('[data-testid="app-rulebook-stub"]')).not.toBeNull();
    expect((document.getElementById("globalMenuBtn") as HTMLButtonElement | null)?.disabled).toBe(false);
    expect((document.querySelector('[data-testid="topbar-nav-rulebooks"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
  });

  it("uses AppShellV2 on mobile when ui shell v2 is enabled", async () => {
    MobileGUI.set(true);
    uiShellV2Enabled.set(true);
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    await flushUi();

    expect(document.querySelector(".ds-app-v2-topbar")).not.toBeNull();
    expect(document.querySelector(".ds-app-v2-mobile-nav-shell")).not.toBeNull();
    expect(document.querySelector('.ds-app-v2-mobile-nav-shell [data-testid="topbar-nav-home"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="app-home-grid-stub"]')).not.toBeNull();
    expect(document.querySelector(".ds-app-mobile-shell")).toBeNull();
  });

  it("keeps ShellV2 active for mobile chats when ui shell v2 is enabled", async () => {
    MobileGUI.set(true);
    uiShellV2Enabled.set(true);
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    expect(document.querySelector(".ds-app-mobile-shell")).toBeNull();
    expect(document.querySelector(".ds-app-v2-topbar")).not.toBeNull();
    expect(document.querySelector('[data-testid="app-chat-screen-stub"]')).not.toBeNull();
  });

  it("uses chat-style mobile back button in topbar and returns to home", async () => {
    MobileGUI.set(true);
    uiShellV2Enabled.set(true);
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    const backBtn = document.querySelector('[data-testid="topbar-mobile-back-to-menu"]') as HTMLButtonElement | null;
    expect(backBtn).not.toBeNull();
    expect(backBtn?.getAttribute("title")).toBe("Back");
    expect(backBtn?.getAttribute("aria-label")).toBe("Back");

    backBtn?.click();
    await flushUi();
    expect(get(selectedCharID)).toBe(-1);
    expect(document.querySelector('[data-testid="app-home-grid-stub"]')).not.toBeNull();
  });

  it("shows mobile settings back button in title bar for settings subpages", async () => {
    MobileGUI.set(true);
    uiShellV2Enabled.set(true);
    settingsOpen.set(true);
    selectedCharID.set(-1);
    SettingsMenuIndex.set(1);
    await flushUi();

    const backBtn = document.querySelector('[data-testid="topbar-mobile-back-to-menu"]') as HTMLButtonElement | null;
    expect(backBtn).not.toBeNull();
    expect(backBtn?.getAttribute("title")).toBe("Back");
    expect(backBtn?.getAttribute("aria-label")).toBe("Back");

    backBtn?.click();
    await flushUi();
    expect(get(SettingsMenuIndex)).toBe(-1);
  });

  it("renders mobile rulebook filter controls in topbar and hides desktop drawer toggle", async () => {
    MobileGUI.set(true);
    uiShellV2Enabled.set(true);
    settingsOpen.set(false);
    openRulebookManager.set(true);
    selectedCharID.set(-1);
    await flushUi();

    expect(document.querySelector('[data-testid="topbar-library-mobile-system"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="topbar-library-mobile-edition"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="topbar-library-mobile-reset"]')).not.toBeNull();
    expect(document.getElementById("workspaceSidebarBtn")).toBeNull();
  });

  it("renders home grid in characters workspace and syncs topbar search binding", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    await flushUi();

    const homeGrid = document.querySelector('[data-testid="app-home-grid-stub"]') as HTMLElement | null;
    expect(homeGrid).not.toBeNull();

    const shellSearchInput = document.getElementById("shellSearchInput") as HTMLInputElement | null;
    expect(shellSearchInput).not.toBeNull();
    expect(shellSearchInput?.placeholder).toContain("characters");
    expect(shellSearchInput?.classList.contains("control-field")).toBe(true);

    const globalMenuBtn = document.getElementById("globalMenuBtn") as HTMLButtonElement | null;
    expect(globalMenuBtn).not.toBeNull();
    expect(globalMenuBtn?.getAttribute("type")).toBe("button");
    expect(globalMenuBtn?.classList.contains("icon-btn")).toBe(true);
    expect(globalMenuBtn?.classList.contains("icon-btn--md")).toBe(true);
    expect(globalMenuBtn?.classList.contains("icon-btn--bordered")).toBe(true);

    shellSearchInput!.value = "hero";
    shellSearchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    expect((document.querySelector('[data-testid="app-home-grid-stub"]') as HTMLElement | null)?.dataset.shellSearch).toBe("hero");
  });

  it("hosts character directory controls in topbar and syncs trash mode/add action", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    await flushUi();

    const activeTab = document.querySelector('[data-testid="topbar-characters-active"]') as HTMLButtonElement | null;
    const trashTab = document.querySelector('[data-testid="topbar-characters-trash"]') as HTMLButtonElement | null;
    const addButton = document.querySelector('[data-testid="topbar-characters-add"]') as HTMLButtonElement | null;
    const segment = document.querySelector(".ds-app-v2-topbar-segment") as HTMLElement | null;
    expect(activeTab).not.toBeNull();
    expect(trashTab).not.toBeNull();
    expect(addButton).not.toBeNull();
    expect(segment).not.toBeNull();
    expect(segment?.classList.contains("seg-tabs")).toBe(true);
    expect(activeTab?.classList.contains("seg-tab")).toBe(true);
    expect(trashTab?.classList.contains("seg-tab")).toBe(true);
    expect(activeTab?.getAttribute("type")).toBe("button");
    expect(trashTab?.getAttribute("type")).toBe("button");
    expect(activeTab?.getAttribute("aria-label")).toBe("Show active characters");
    expect(trashTab?.getAttribute("aria-label")).toBe("Show trashed characters");
    expect(addButton?.getAttribute("type")).toBe("button");

    expect((document.querySelector('[data-testid="app-home-grid-stub"]') as HTMLElement | null)?.dataset.showTrash).toBe("0");
    trashTab!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-home-grid-stub"]') as HTMLElement | null)?.dataset.showTrash).toBe("1");

    activeTab!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-home-grid-stub"]') as HTMLElement | null)?.dataset.showTrash).toBe("0");

    addButton!.click();
    await flushUi();
    expect(addCharacterMock).toHaveBeenCalledTimes(1);
  });

  it("enters chats with remembered chat when selecting a character from home", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    await flushUi();

    const selectCharacterButton = document.querySelector('[data-testid="app-home-select-char-2"]') as HTMLButtonElement | null;
    expect(selectCharacterButton).not.toBeNull();
    selectCharacterButton!.click();
    await flushUi();

    expect(get(appRouteStore)).toMatchObject({
      workspace: "chats",
      selectedCharacterId: "char-2",
      selectedChatId: "chat-2-b",
      inspector: "chat",
    });
    expect(document.querySelector('[data-testid="app-chat-screen-stub"]')).not.toBeNull();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("1");
  });

  it("preserves a closed right sidebar when returning from home into chats", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    const characterTab = document.querySelector('[data-testid="app-chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    const rightSidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    expect(rightSidebarBtn).not.toBeNull();
    rightSidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");

    selectedCharID.set(-1);
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("characters");

    const selectCharacterButton = document.querySelector('[data-testid="app-home-select-char-2"]') as HTMLButtonElement | null;
    expect(selectCharacterButton).not.toBeNull();
    selectCharacterButton!.click();
    await flushUi();

    expect(get(appRouteStore)).toMatchObject({
      workspace: "chats",
      selectedCharacterId: "char-2",
      selectedChatId: "chat-2-b",
      inspector: "none",
    });
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarTab).toBe("character");
    expect(window.localStorage.getItem("risu:desktop-char-config-open")).toBe("0");
  });

  it("falls back to first chat when the remembered chat index is missing", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    DBState.db.characters[1].chatPage = 99;
    await flushUi();

    const selectCharacterButton = document.querySelector('[data-testid="app-home-select-char-2"]') as HTMLButtonElement | null;
    expect(selectCharacterButton).not.toBeNull();
    selectCharacterButton!.click();
    await flushUi();

    expect(get(appRouteStore)).toMatchObject({
      workspace: "chats",
      selectedCharacterId: "char-2",
      selectedChatId: "chat-2-a",
      inspector: "chat",
    });
    expect(DBState.db.characters[1].chatPage).toBe(0);
  });

  it("controls chat right sidebar from the topbar button", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    const rightSidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    expect(rightSidebarBtn).not.toBeNull();
    expect(rightSidebarBtn?.getAttribute("type")).toBe("button");
    expect(rightSidebarBtn?.dataset.pressed).toBe("1");
    expect(rightSidebarBtn?.getAttribute("aria-pressed")).toBe("true");
    expect(rightSidebarBtn?.getAttribute("aria-expanded")).toBe("true");
    expect(rightSidebarBtn?.getAttribute("aria-controls")).toBe("chat-right-sidebar-drawer");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("1");

    rightSidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.getAttribute("aria-pressed")).toBe("false");
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.getAttribute("aria-expanded")).toBe("false");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");

    rightSidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.getAttribute("aria-pressed")).toBe("true");
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.getAttribute("aria-expanded")).toBe("true");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("1");
  });

  it("syncs appRoute inspector with the right sidebar tab", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    expect(get(appRouteStore).inspector).toBe("chat");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarTab).toBe("chat");

    const characterTab = document.querySelector('[data-testid="app-chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();
    expect(get(appRouteStore).inspector).toBe("character");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarTab).toBe("character");

    const memoryTab = document.querySelector('[data-testid="app-chat-sidebar-tab-memory"]') as HTMLButtonElement | null;
    expect(memoryTab).not.toBeNull();
    memoryTab!.click();
    await flushUi();
    expect(get(appRouteStore).inspector).toBe("memory");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarTab).toBe("memory");

    const chatTab = document.querySelector('[data-testid="app-chat-sidebar-tab-chat"]') as HTMLButtonElement | null;
    expect(chatTab).not.toBeNull();
    chatTab!.click();
    await flushUi();
    expect(get(appRouteStore).inspector).toBe("chat");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarTab).toBe("chat");

    const rightSidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    expect(rightSidebarBtn).not.toBeNull();
    rightSidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect(get(appRouteStore).inspector).toBe("none");

    rightSidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect(get(appRouteStore).inspector).toBe("chat");

    const hideVisible = document.querySelector('[data-testid="app-chat-sidebar-visible-hide"]') as HTMLButtonElement | null;
    expect(hideVisible).not.toBeNull();
    hideVisible!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarVisible).toBe("0");
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect(get(appRouteStore).inspector).toBe("none");

    const showVisible = document.querySelector('[data-testid="app-chat-sidebar-visible-show"]') as HTMLButtonElement | null;
    expect(showVisible).not.toBeNull();
    showVisible!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarVisible).toBe("1");
    expect(get(appRouteStore).inspector).toBe("chat");
  });

  it("shows workspace sidebar toggle in chats and library and preserves workspace-specific state", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(-1);
    await flushUi();
    expect(document.getElementById("workspaceSidebarBtn")).toBeNull();

    selectedCharID.set(0);
    await flushUi();
    const rightSidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    expect(rightSidebarBtn).not.toBeNull();
    expect(rightSidebarBtn?.dataset.pressed).toBe("1");

    rightSidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");

    selectedCharID.set(-1);
    openRulebookManager.set(true);
    await flushUi();
    const librarySidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    expect(librarySidebarBtn).not.toBeNull();
    expect(librarySidebarBtn?.dataset.pressed).toBe("1");
    expect(librarySidebarBtn?.getAttribute("aria-controls")).toBe("rulebook-right-sidebar-drawer");
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("1");

    librarySidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");
    expect(window.localStorage.getItem("risu:desktop-library-sidebar-open")).toBe("0");

    selectedCharID.set(-1);
    openRulebookManager.set(false);
    await flushUi();
    expect(document.getElementById("workspaceSidebarBtn")).toBeNull();

    selectedCharID.set(0);
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="app-chat-screen-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");

    settingsOpen.set(true);
    selectedCharID.set(-1);
    await flushUi();
    expect(document.getElementById("workspaceSidebarBtn")).toBeNull();

    settingsOpen.set(false);
    openRulebookManager.set(true);
    selectedCharID.set(-1);
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");

    settingsOpen.set(true);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();
    expect(document.getElementById("workspaceSidebarBtn")).toBeNull();
  });

  it("routes workspaces from topbar navigation buttons", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    const homeBtn = document.querySelector('[data-testid="topbar-nav-home"]') as HTMLButtonElement | null;
    const rulebooksBtn = document.querySelector('[data-testid="topbar-nav-rulebooks"]') as HTMLButtonElement | null;
    const settingsBtn = document.querySelector('[data-testid="topbar-nav-settings"]') as HTMLButtonElement | null;
    const moreBtn = document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null;

    expect(homeBtn).not.toBeNull();
    expect(rulebooksBtn).not.toBeNull();
    expect(settingsBtn).not.toBeNull();
    expect(moreBtn).not.toBeNull();

    moreBtn!.click();
    await flushUi();
    const playgroundOverflowBtn = document.querySelector('[data-testid="topbar-nav-overflow-playground"]') as HTMLButtonElement | null;
    expect(playgroundOverflowBtn).not.toBeNull();
    playgroundOverflowBtn!.click();
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("playground");
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).toBeNull();

    settingsBtn!.click();
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("settings");
    expect((document.querySelector('[data-testid="topbar-nav-settings"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");

    rulebooksBtn!.click();
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("library");
    expect((document.querySelector('[data-testid="topbar-nav-rulebooks"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");

    homeBtn!.click();
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("characters");
    expect((document.getElementById("globalMenuBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
  });

  it("syncs appRoute and clears transient overlays on workspace change", async () => {
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("characters");

    selectedCharID.set(0);
    await flushUi();
    expect(get(appRouteStore)).toMatchObject({
      workspace: "chats",
      selectedCharacterId: "char-1",
      selectedChatId: "chat-1",
      inspector: "chat",
    });

    openPresetList.set(true);
    openPersonaList.set(true);
    bookmarkListOpen.set(true);
    hypaV3ModalOpen.set(true);

    settingsOpen.set(true);
    selectedCharID.set(-1);
    openRulebookManager.set(false);
    await flushUi();

    expect(get(appRouteStore).workspace).toBe("settings");
    expect(get(openPresetList)).toBe(false);
    expect(get(openPersonaList)).toBe(false);
    expect(get(bookmarkListOpen)).toBe(false);
    expect(get(hypaV3ModalOpen)).toBe(true);

    settingsOpen.set(false);
    openRulebookManager.set(true);
    await flushUi();
    expect(get(appRouteStore).workspace).toBe("library");

    expect(
      hasRuntimeStateError(runtimeMessages),
      `runtime state errors detected: ${runtimeMessages.join("\n")}`,
    ).toBe(false);
  });

  it("binds topbar search to the library search surface", async () => {
    settingsOpen.set(false);
    selectedCharID.set(-1);
    openRulebookManager.set(true);
    await flushUi();

    const shellSearchInput = document.getElementById("shellSearchInput") as HTMLInputElement | null;
    expect(shellSearchInput).not.toBeNull();
    expect(shellSearchInput?.placeholder).toContain("library");

    shellSearchInput!.value = "vampire";
    shellSearchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const libraryStub = document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null;
    expect(libraryStub).not.toBeNull();
    expect(libraryStub?.dataset.shellSearch).toBe("vampire");
  });

  it("renders library topbar controls and wires them to shell state/actions", async () => {
    settingsOpen.set(false);
    selectedCharID.set(-1);
    openRulebookManager.set(true);
    await flushUi();

    const gridBtn = document.querySelector('[data-testid="topbar-library-view-grid"]') as HTMLButtonElement | null;
    const listBtn = document.querySelector('[data-testid="topbar-library-view-list"]') as HTMLButtonElement | null;
    const addDocsBtn = document.querySelector('[data-testid="topbar-library-add-documents"]') as HTMLButtonElement | null;
    const sidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    const libraryStub = document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null;

    expect(gridBtn).not.toBeNull();
    expect(listBtn).not.toBeNull();
    expect(addDocsBtn).not.toBeNull();
    expect(sidebarBtn).not.toBeNull();
    expect(sidebarBtn?.getAttribute("aria-controls")).toBe("rulebook-right-sidebar-drawer");
    expect(libraryStub).not.toBeNull();
    expect(libraryStub?.dataset.viewMode).toBe("grid");
    expect(libraryStub?.dataset.rightSidebarOpen).toBe("1");
    expect(get(appRouteStore).inspector).toBe("details");

    listBtn!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.viewMode).toBe("list");

    gridBtn!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.viewMode).toBe("grid");

    addDocsBtn!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.selectFilesCalls).toBe("1");

    sidebarBtn!.click();
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="app-rulebook-stub"]') as HTMLElement | null)?.dataset.rightSidebarOpen).toBe("0");
    expect(get(appRouteStore).inspector).toBe("none");
  });

  it("closes active overlays and topbar overflow on Escape", async () => {
    await flushUi();

    openPresetList.set(true);
    await flushUi();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect(get(openPresetList)).toBe(false);

    openPersonaList.set(true);
    await flushUi();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect(get(openPersonaList)).toBe(false);

    bookmarkListOpen.set(true);
    await flushUi();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect(get(bookmarkListOpen)).toBe(false);

    hypaV3ModalOpen.set(true);
    await flushUi();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect(get(hypaV3ModalOpen)).toBe(true);

    const moreBtn = document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null;
    expect(moreBtn).not.toBeNull();
    moreBtn!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).not.toBeNull();
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).toBeNull();
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
  });

  it("handles Escape even when another listener preventDefault's the event", async () => {
    await flushUi();

    const moreBtn = document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null;
    expect(moreBtn).not.toBeNull();
    moreBtn!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).not.toBeNull();

    const blocker = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
      }
    };

    document.addEventListener("keydown", blocker);
    try {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      await flushUi();
      expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
      expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).toBeNull();
    } finally {
      document.removeEventListener("keydown", blocker);
    }
  });

  it("closes right sidebar on Escape before closing topbar overflow", async () => {
    settingsOpen.set(false);
    openRulebookManager.set(false);
    selectedCharID.set(0);
    await flushUi();

    const moreBtn = document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null;
    const rightSidebarBtn = document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null;
    expect(moreBtn).not.toBeNull();
    expect(rightSidebarBtn?.dataset.pressed).toBe("1");
    moreBtn!.click();
    await flushUi();
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect((document.getElementById("workspaceSidebarBtn") as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("1");
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushUi();
    expect((document.querySelector('[data-testid="topbar-nav-more"]') as HTMLButtonElement | null)?.dataset.pressed).toBe("0");
    expect((document.querySelector('[data-testid="topbar-nav-more-menu"]') as HTMLElement | null)).toBeNull();
  });
});
