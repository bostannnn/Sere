import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const shared = vi.hoisted(() => {
  const makeCharacter = () => ({
    type: "character" as const,
    chaId: "char-int-1",
    name: "Integration Character",
    image: "",
    desc: "desc",
    firstMessage: "hello",
    personality: "persona",
    scenario: "scenario",
    replaceGlobalNote: "",
    emotionImages: [["neutral", "neutral.png"]] as [string, string][],
    chatFolders: [] as Array<{ id: string; name: string; folded?: boolean; color?: string }>,
    chats: [
      {
        id: "chat-1",
        name: "New Chat 1",
        message: [],
        note: "",
        localLore: [],
        fmIndex: -1,
      },
    ],
    chatPage: 0,
    alternateGreetings: [] as string[],
    additionalAssets: [] as [string, string, string?][],
    ccAssets: [] as unknown[],
    bias: [] as unknown[],
    license: "",
  });

  const makeGroupCharacter = () => {
    const base = makeCharacter();
    return {
      ...base,
      type: "group" as const,
      chaId: "group-int-1",
      name: "Integration Group",
      viewScreen: "none",
      characters: ["char-int-1"],
      characterTalks: [0],
      characterActive: [true],
      orderByOrder: false,
    };
  };

  return {
    DBState: {
      db: {
        theme: "classic",
        fishSpeechKey: "",
        useAdditionalAssetsPreview: false,
        characters: [makeCharacter()],
      },
    },
    makeCharacter,
    makeGroupCharacter,
    changeChatTo: vi.fn(),
    chatCopyName: vi.fn(() => "Chat copy"),
  };
});

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: shared.DBState,
    selectedCharID: writable(0),
    ReloadGUIPointer: writable(0),
    bookmarkListOpen: writable(false),
    CharConfigSubMenu: writable(0),
    MobileGUI: writable(false),
    hypaV3ModalOpen: writable(false),
  };
});

vi.mock(import("src/lang"), () => ({
  language: new Proxy({}, {
    get: (_target, prop) => String(prop),
  }),
}));

vi.mock(import("uuid"), () => ({
  v4: () => "chat-generated-id",
}));

vi.mock(import("sortablejs/modular/sortable.core.esm.js"), () => {
  class SortableMock {
    destroy() {}
    static create() {
      return {
        destroy() {},
      };
    }
  }
  return {
    default: SortableMock,
  };
});

vi.mock(import("src/ts/characters"), () => ({
  exportChat: async () => {},
  importChat: async () => {},
  exportAllChats: async () => {},
  addCharEmotion: async () => {},
  addingEmotion: () => false,
  getCharImage: async () => "",
  rmCharEmotion: async () => {},
  selectCharImg: async () => {},
  makeGroupImage: async () => "",
  removeChar: async () => {},
  changeCharImage: async () => {},
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

vi.mock(import("src/ts/util"), () => ({
  findCharacterbyId: () => ({ firstMessage: "hello" }),
  sleep: async () => {},
  sortableOptions: {},
  getAuthorNoteDefaultText: () => "",
  selectMultipleFile: async () => [],
  selectSingleFile: async () => null,
}));

vi.mock(import("src/ts/sync/multiuser"), async () => {
  const { writable } = await import("svelte/store");
  return {
    createMultiuserRoom: async () => {},
    ConnectionOpenStore: writable(false),
  };
});

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  changeChatTo: shared.changeChatTo,
  createChatCopyName: shared.chatCopyName,
  getFileSrc: async () => "",
}));

vi.mock(import("src/ts/tokenizer"), () => ({
  tokenizeAccurate: async (value: string) => value.length,
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  saveImage: async () => "asset-id",
}));

vi.mock(import("src/ts/process/tts"), () => ({
  getElevenTTSVoices: async () => [],
  getWebSpeechTTSVoices: async () => [],
  getVOICEVOXVoices: async () => [],
  oaiVoices: [],
  getNovelAIVoices: async () => [],
}));

vi.mock(import("src/ts/process/group"), () => ({
  addGroupChar: () => {},
  rmCharFromGroup: () => {},
}));

vi.mock(import("src/ts/process/inlayScreen"), () => ({
  updateInlayScreen: () => {},
}));

vi.mock(import("src/ts/process/transformers"), () => ({
  registerOnnxModel: async () => {},
}));

vi.mock(import("src/ts/process/modules"), () => ({
  applyModule: () => {},
}));

vi.mock(import("src/ts/process/scripts"), () => ({
  exportRegex: async () => {},
  importRegex: async () => {},
}));

vi.mock(import("src/ts/characterCards"), () => ({
  exportChar: async () => {},
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/MultiLangInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/SliderInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/LoreBook/LoreBookSetting.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/LoreBook/RulebookRagSetting.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/BarIcon.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/Scripts/RegexList.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/Scripts/TriggerList.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/Toggles.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/GameStateEditor.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import { CharConfigSubMenu, DBState } from "src/ts/stores.svelte";
import { changeChatTo } from "src/ts/globalApi.svelte";
import ChatRightSidebarHostHarness from "./test-stubs/ChatRightSidebarHostHarness.svelte";

let app: Record<string, unknown> | undefined;
let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chat sidebar integration runtime smoke", () => {
  beforeEach(() => {
    shared.DBState.db.characters = [shared.makeCharacter()];
    shared.changeChatTo.mockClear();
    CharConfigSubMenu.set(0);
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation((...args) => {
      const message = args.map((entry) => String(entry)).join(" ");
      if (message.includes("binding_property_non_reactive")) {
        return;
      }
    });
    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatRightSidebarHostHarness, { target });
  });

  afterEach(async () => {
    consoleWarnSpy?.mockRestore();
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("renders real SideChatList and supports new chat action", async () => {
    await flushUi();

    expect(document.querySelector(".side-chat-list-root")).not.toBeNull();
    const listShell = document.querySelector('[data-testid="side-chat-list-shell"]') as HTMLElement | null;
    expect(listShell).not.toBeNull();
    expect(listShell?.classList.contains("list-shell")).toBe(true);
    expect(document.querySelector(".side-row-actions.action-rail")).not.toBeNull();
    expect(document.querySelector(".side-footer-actions.action-rail")).not.toBeNull();
    const firstActionButton = document.querySelector(".side-action-btn") as HTMLElement | null;
    expect(firstActionButton).not.toBeNull();
    expect(firstActionButton?.classList.contains("icon-btn")).toBe(true);
    expect(firstActionButton?.classList.contains("icon-btn--sm")).toBe(true);
    expect(document.querySelector(".char-config-root")).toBeNull();

    const beforeCount = shared.DBState.db.characters[0].chats.length;
    const newChatButton = document.querySelector(".side-new-chat-button") as HTMLButtonElement | null;
    expect(newChatButton).not.toBeNull();

    newChatButton!.click();
    await flushUi();

    expect(shared.DBState.db.characters[0].chats.length).toBe(beforeCount + 1);
    expect(changeChatTo).toHaveBeenCalledWith(0);
    expect(DBState.db.characters[0].chats[0].id).toBe("chat-generated-id");
  });

  it("keeps side chat buttons explicit with type=button semantics", async () => {
    await flushUi();

    const newChatButton = document.querySelector(".side-new-chat-button") as HTMLButtonElement | null;
    expect(newChatButton).not.toBeNull();
    expect(newChatButton?.getAttribute("type")).toBe("button");

    const chatRowButtons = Array.from(document.querySelectorAll('.side-chat-list-root button[data-risu-chat-idx]')) as HTMLButtonElement[];
    expect(chatRowButtons.length).toBeGreaterThan(0);
    expect(chatRowButtons.every((button) => button.getAttribute("type") === "button")).toBe(true);

    const footerActionButtons = Array.from(document.querySelectorAll(".side-footer-actions > button")) as HTMLButtonElement[];
    expect(footerActionButtons.length).toBeGreaterThan(0);
    expect(footerActionButtons.every((button) => button.getAttribute("type") === "button")).toBe(true);
  });

  it("renders empty folder row with empty-state primitive", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    const characterWithEmptyFolder = shared.makeCharacter();
    characterWithEmptyFolder.chatFolders = [{
      id: "folder-empty-1",
      name: "Folder 1",
      folded: false,
    }];
    shared.DBState.db.characters = [characterWithEmptyFolder];
    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatRightSidebarHostHarness, { target });
    await flushUi();

    const emptyState = document.querySelector('[data-testid="side-chat-empty"]') as HTMLElement | null;
    expect(emptyState).not.toBeNull();
    expect(emptyState?.classList.contains("empty-state")).toBe(true);
    const folderCard = document.querySelector('[data-testid="side-folder-card"]') as HTMLElement | null;
    expect(folderCard).not.toBeNull();
    expect(folderCard?.classList.contains("panel-shell")).toBe(true);
    const addFolderButton = document.querySelector(".side-action-btn-end") as HTMLElement | null;
    expect(addFolderButton).not.toBeNull();
    expect(addFolderButton?.classList.contains("icon-btn")).toBe(true);
    expect(addFolderButton?.classList.contains("icon-btn--sm")).toBe(true);
  });

  it("renders global empty state when no unfoldered chats exist", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    const emptyCharacter = shared.makeCharacter();
    emptyCharacter.chats = [];
    emptyCharacter.chatFolders = [];
    shared.DBState.db.characters = [emptyCharacter];

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatRightSidebarHostHarness, { target });
    await flushUi();

    const globalEmptyState = document.querySelector('[data-testid="side-chat-empty-global"]') as HTMLElement | null;
    expect(globalEmptyState).not.toBeNull();
    expect(globalEmptyState?.classList.contains("empty-state")).toBe(true);
    expect(globalEmptyState?.textContent).toContain("No chats yet");
  });

  it("renders 100+ chats without empty-state regressions and preserves dense-row selection/click behavior", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    const denseCharacter = shared.makeCharacter();
    denseCharacter.chats = Array.from({ length: 120 }, (_, index) => ({
      id: `dense-chat-${index + 1}`,
      name: `Dense Chat ${index + 1}`,
      message: [],
      note: "",
      localLore: [],
      fmIndex: -1,
    }));
    denseCharacter.chatPage = 87;
    denseCharacter.chatFolders = [];
    shared.changeChatTo.mockClear();
    shared.DBState.db.characters = [denseCharacter];

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatRightSidebarHostHarness, { target });
    await flushUi();

    const listShell = document.querySelector('[data-testid="side-chat-list-shell"]') as HTMLElement | null;
    expect(listShell).not.toBeNull();
    expect(listShell?.classList.contains("list-shell")).toBe(true);
    expect(document.querySelector('[data-testid="side-chat-empty-global"]')).toBeNull();

    const chatRows = Array.from(document.querySelectorAll('[data-risu-chat-idx]')) as HTMLButtonElement[];
    expect(chatRows.length).toBe(120);
    expect(chatRows[0]?.textContent).toContain("Dense Chat 1");
    expect(chatRows[119]?.textContent).toContain("Dense Chat 120");

    const selectedRows = document.querySelectorAll(".side-row.side-chat-row.side-row-selected");
    expect(selectedRows.length).toBe(1);
    expect((selectedRows[0] as HTMLElement | undefined)?.getAttribute("data-risu-chat-idx")).toBe("87");

    chatRows[119]?.click();
    await flushUi();
    expect(changeChatTo).toHaveBeenCalledWith(119);
  });

  it("supports Space-key activation for folder action controls without folding the folder", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    const characterWithFolder = shared.makeCharacter();
    characterWithFolder.chatFolders = [{
      id: "folder-keyboard-1",
      name: "Folder Keyboard",
      folded: false,
    }];
    shared.DBState.db.characters = [characterWithFolder];

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatRightSidebarHostHarness, { target });
    await flushUi();

    const folderAction = document.querySelector(
      '.side-folder-card [aria-label="Folder actions"]',
    ) as HTMLElement | null;
    expect(folderAction).not.toBeNull();

    const keyEvent = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    const notCanceled = folderAction!.dispatchEvent(keyEvent);
    await flushUi();

    expect(notCanceled).toBe(false);
    expect(shared.DBState.db.characters[0].chatFolders[0]?.color).toBe("red");
    expect(shared.DBState.db.characters[0].chatFolders[0]?.folded).toBe(false);
  });

  it("renders real CharConfig when switching to character tab", async () => {
    await flushUi();

    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    expect(document.querySelector(".char-config-root")).not.toBeNull();
    const topTabs = document.querySelector(".char-config-tabs") as HTMLElement | null;
    expect(topTabs).not.toBeNull();
    expect(topTabs?.classList.contains("seg-tabs")).toBe(true);
    const topTab = document.querySelector(".char-config-tab") as HTMLElement | null;
    expect(topTab).not.toBeNull();
    expect(topTab?.classList.contains("seg-tab")).toBe(true);
    const topTabIds = Array.from(document.querySelectorAll(".char-config-tab")).map((tab) => (tab as HTMLElement).id);
    expect(topTabIds).toEqual([
      "char-config-tab-0",
      "char-config-tab-1",
      "char-config-tab-3",
      "char-config-tab-8",
      "char-config-tab-5",
      "char-config-tab-4",
      "char-config-tab-2",
      "char-config-tab-7",
      "char-config-tab-6",
    ]);

    const displayTab = document.querySelector('[data-testid="char-config-subtab-1"]') as HTMLButtonElement | null;
    expect(displayTab).not.toBeNull();
    displayTab?.click();
    await flushUi();

    const displaySubTabs = document.querySelector(".char-config-subtabs") as HTMLElement | null;
    expect(displaySubTabs).not.toBeNull();
    expect(displaySubTabs?.classList.contains("seg-tabs")).toBe(true);
    const displaySubTab = document.querySelector(".char-config-subtab") as HTMLElement | null;
    expect(displaySubTab).not.toBeNull();
    expect(displaySubTab?.classList.contains("seg-tab")).toBe(true);
    const displaySubTabButtons = Array.from(document.querySelectorAll(".char-config-subtab")) as HTMLButtonElement[];
    expect(displaySubTabButtons.length).toBe(3);
    expect(displaySubTabButtons[0]?.getAttribute("type")).toBe("button");
    expect(displaySubTabButtons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(displaySubTabButtons[1]?.getAttribute("aria-label")).toBe("viewScreen");
    expect(displaySubTabButtons[2]?.getAttribute("aria-label")).toBe("additionalAssets");
    const addIconButton = document.querySelector('[aria-label="Add icon asset"]') as HTMLButtonElement | null;
    expect(addIconButton).not.toBeNull();
    expect(addIconButton?.getAttribute("type")).toBe("button");
    const iconGallery = document.querySelector(".char-config-icon-gallery") as HTMLElement | null;
    expect(iconGallery).not.toBeNull();
    expect(iconGallery?.classList.contains("panel-shell")).toBe(true);
    const removeButton = document.querySelector(".char-config-icon-remove-button") as HTMLElement | null;
    expect(removeButton).not.toBeNull();
    expect(removeButton?.classList.contains("icon-btn")).toBe(true);
    expect(removeButton?.classList.contains("icon-btn--sm")).toBe(true);
    expect(removeButton?.getAttribute("aria-label")).toBe("Toggle icon remove mode");
    const displayAssetsTab = document.querySelectorAll(".char-config-subtab")[2] as HTMLButtonElement | undefined;
    expect(displayAssetsTab).toBeDefined();
    displayAssetsTab?.click();
    await flushUi();
    const refreshedDisplaySubTabButtons = Array.from(document.querySelectorAll(".char-config-subtab")) as HTMLButtonElement[];
    expect(refreshedDisplaySubTabButtons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(refreshedDisplaySubTabButtons[2]?.getAttribute("aria-pressed")).toBe("true");

    const iconAction = document.querySelector(".char-config-icon-action") as HTMLElement | null;
    expect(iconAction).not.toBeNull();
    expect(iconAction?.classList.contains("icon-btn")).toBe(true);
    expect(iconAction?.classList.contains("icon-btn--sm")).toBe(true);
    expect(iconAction?.getAttribute("aria-label")).toBe("Add additional assets");

    const scriptsTab = document.querySelector('[data-testid="char-config-subtab-4"]') as HTMLButtonElement | null;
    expect(scriptsTab).not.toBeNull();
    scriptsTab?.click();
    await flushUi();
    expect(document.querySelector('[aria-label="Add regex script row"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Export regex scripts"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Import regex scripts"]')).not.toBeNull();

    expect(document.querySelector(".side-chat-list-root")).toBeNull();
    expect((document.querySelector('[data-testid="host-right-tab-state"]') as HTMLElement | null)?.dataset.tab).toBe("character");
  });

  it("keeps per-tab CharConfig section mapping complete for character mode", async () => {
    await flushUi();

    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    const assertPanel = (panelId: string, labelledBy: string) => {
      const panel = document.querySelector(`#${panelId}`) as HTMLElement | null;
      expect(panel, `missing panel ${panelId}`).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("aria-labelledby")).toBe(labelledBy);
      return panel;
    };

    const clickConfigTab = async (tabId: string, panelId: string) => {
      const tab = document.querySelector(`#${tabId}`) as HTMLButtonElement | null;
      expect(tab, `missing tab ${tabId}`).not.toBeNull();
      expect(tab?.getAttribute("role")).toBe("tab");
      expect(tab?.getAttribute("aria-controls")).toBe(panelId);
      tab?.click();
      await flushUi();
      const panel = assertPanel(panelId, tabId);
      expect(tab?.getAttribute("aria-selected")).toBe("true");
      return panel;
    };

    const basicsPanel = await clickConfigTab("char-config-tab-0", "char-config-panel-0");
    expect(basicsPanel.textContent).toContain("description");

    const displayPanel = await clickConfigTab("char-config-tab-1", "char-config-panel-1");
    expect(displayPanel.querySelector(".char-config-subtabs.seg-tabs")).not.toBeNull();

    const lorebookPanel = await clickConfigTab("char-config-tab-3", "char-config-panel-3");
    expect(lorebookPanel.textContent).toContain("loreBook");
    expect(lorebookPanel.querySelector('[data-testid="simple-panel-stub"]')).not.toBeNull();

    const rulebookPanel = await clickConfigTab("char-config-tab-8", "char-config-panel-8");
    expect(rulebookPanel.textContent).toContain("Rulebooks");
    expect(rulebookPanel.querySelector('[data-testid="simple-panel-stub"]')).not.toBeNull();

    const ttsPanel = await clickConfigTab("char-config-tab-5", "char-config-panel-5");
    expect(ttsPanel.textContent).toContain("TTS");
    expect(ttsPanel.textContent).toContain("provider");

    const scriptsPanel = await clickConfigTab("char-config-tab-4", "char-config-panel-4");
    expect(scriptsPanel.textContent).toContain("scripts");
    expect(scriptsPanel.querySelector('[aria-label="Add regex script row"]')).not.toBeNull();

    const advancedPanel = await clickConfigTab("char-config-tab-2", "char-config-panel-2");
    expect(advancedPanel.textContent).toContain("advancedSettings");
    expect(advancedPanel.querySelector('[aria-label="Add bias row"]')).not.toBeNull();

    const gameStatePanel = await clickConfigTab("char-config-tab-7", "char-config-panel-7");
    expect(gameStatePanel.textContent).toContain("Game State");
    expect(gameStatePanel.querySelector('[data-testid="simple-panel-stub"]')).not.toBeNull();

    const sharePanel = await clickConfigTab("char-config-tab-6", "char-config-panel-6");
    expect(sharePanel.textContent).toContain("exportCharacter");
    expect(sharePanel.textContent).toContain("removeCharacter");
  });

  it("limits character config tabs for group characters and labels group controls", async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    shared.DBState.db.characters = [shared.makeGroupCharacter()];
    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatRightSidebarHostHarness, { target });
    await flushUi();

    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    const topTabIds = Array.from(document.querySelectorAll(".char-config-tab")).map((tab) => (tab as HTMLElement).id);
    expect(topTabIds).toEqual([
      "char-config-tab-0",
      "char-config-tab-1",
      "char-config-tab-3",
      "char-config-tab-2",
      "char-config-tab-7",
    ]);
    expect(document.querySelector("#char-config-tab-8")).toBeNull();
    expect(document.querySelector("#char-config-tab-5")).toBeNull();
    expect(document.querySelector("#char-config-tab-4")).toBeNull();
    expect(document.querySelector("#char-config-tab-6")).toBeNull();

    const groupAddButton = document.querySelector(".char-config-group-add-button") as HTMLButtonElement | null;
    expect(groupAddButton).not.toBeNull();
    expect(groupAddButton?.getAttribute("aria-label")).toBe("Add character to group");
    expect(groupAddButton?.getAttribute("title")).toBe("Add character to group");

    const talkSegment = document.querySelector(".char-config-group-talk-segment") as HTMLButtonElement | null;
    expect(talkSegment).not.toBeNull();
    expect(talkSegment?.getAttribute("aria-label")).toContain("Set talk weight to");
  });

  it("keeps host tab state in sync with keyboard navigation", async () => {
    await flushUi();
    const chatTab = document.querySelector('[data-testid="chat-sidebar-tab-chat"]') as HTMLButtonElement | null;
    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    const tablist = document.querySelector('[role="tablist"]') as HTMLElement | null;
    expect(chatTab).not.toBeNull();
    expect(characterTab).not.toBeNull();
    expect(tablist).not.toBeNull();
    expect(tablist?.classList.contains("seg-tabs")).toBe(true);
    expect(chatTab?.classList.contains("seg-tab")).toBe(true);
    expect(characterTab?.classList.contains("seg-tab")).toBe(true);
    expect(chatTab?.classList.contains("active")).toBe(true);
    expect(characterTab?.classList.contains("active")).toBe(false);

    chatTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushUi();
    expect((document.querySelector('[data-testid="host-right-tab-state"]') as HTMLElement | null)?.dataset.tab).toBe("character");
    expect(document.activeElement).toBe(characterTab);
    expect(characterTab?.classList.contains("active")).toBe(true);
    expect(chatTab?.classList.contains("active")).toBe(false);

    characterTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await flushUi();
    expect((document.querySelector('[data-testid="host-right-tab-state"]') as HTMLElement | null)?.dataset.tab).toBe("chat");
    expect(document.activeElement).toBe(chatTab);
    expect(chatTab?.classList.contains("active")).toBe(true);
    expect(characterTab?.classList.contains("active")).toBe(false);

    tablist!.dispatchEvent(new KeyboardEvent("keydown", { key: "Right", bubbles: true }));
    await flushUi();
    expect((document.querySelector('[data-testid="host-right-tab-state"]') as HTMLElement | null)?.dataset.tab).toBe("character");
    expect(document.activeElement).toBe(characterTab);

    const characterPane = document.querySelector('[data-testid="chat-sidebar-pane-character"]') as HTMLElement | null;
    expect(characterPane).not.toBeNull();
    characterPane?.focus();
    characterPane?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await flushUi();
    expect((document.querySelector('[data-testid="host-right-tab-state"]') as HTMLElement | null)?.dataset.tab).toBe("chat");
    expect(document.activeElement).toBe(chatTab);
  });

  it("supports character subtab keyboard navigation and top-tab Tab handoff", async () => {
    await flushUi();

    const characterTab = document.querySelector('[data-testid="chat-sidebar-tab-character"]') as HTMLButtonElement | null;
    expect(characterTab).not.toBeNull();
    characterTab!.click();
    await flushUi();

    characterTab!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    await flushUi();

    const activeSubTabAfterTab = document.activeElement as HTMLElement | null;
    expect(activeSubTabAfterTab?.classList.contains("char-config-tab")).toBe(true);
    expect(activeSubTabAfterTab?.id).toBe("char-config-tab-0");

    activeSubTabAfterTab?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await flushUi();

    const activeSubTabAfterArrow = document.querySelector(".char-config-tab.active") as HTMLElement | null;
    expect(activeSubTabAfterArrow?.id).toBe("char-config-tab-1");
    expect(document.activeElement?.id).toBe("char-config-tab-1");

    activeSubTabAfterArrow?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await flushUi();
    expect((document.querySelector(".char-config-tab.active") as HTMLElement | null)?.id).toBe("char-config-tab-6");

    const activeSubTabAfterEnd = document.querySelector(".char-config-tab.active") as HTMLElement | null;
    activeSubTabAfterEnd?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await flushUi();
    expect((document.querySelector(".char-config-tab.active") as HTMLElement | null)?.id).toBe("char-config-tab-0");
  });
});
