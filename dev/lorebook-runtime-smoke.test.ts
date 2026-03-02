import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const DBState = {
    db: {
      bulkEnabling: false,
      characters: [
        {
          type: "character",
          lorePlus: false,
          globalLore: [],
          chatPage: 0,
          chats: [
            {
              localLore: [],
            },
          ],
        },
      ],
    },
  };

  return {
    DBState,
    selectedCharID,
  };
});

vi.mock(import("src/lang"), () => ({
  language: {
    group: "Group",
    character: "Character",
    Chat: "Chat",
    settings: "Settings",
    groupLoreInfo: "group lore info",
    globalLoreInfo: "global lore info",
    localLoreInfo: "local lore info",
    useGlobalSettings: "Use Global Settings",
    recursiveScanning: "Recursive Scanning",
    fullWordMatching: "Full Word Matching",
    loreBookDepth: "Lorebook Depth",
    loreBookToken: "Lorebook Token",
    lorePlus: "Lore Plus",
    folderRemoveConfirm: "Remove folder children?",
    removeConfirm: "Remove ",
    childLoreDesc: "Child lore description",
    folderName: "Folder Name",
    name: "Name",
    activationKeys: "Activation Keys",
    activationKeysInfo: "Activation keys info",
    SecondaryKeys: "Secondary Keys",
    activationProbability: "Activation Probability",
    insertOrder: "Insert Order",
    prompt: "Prompt",
    tokens: "Tokens",
    alwaysActive: "Always Active",
    alwaysActiveInChat: "Always Active in Chat",
    selective: "Selective",
    useRegexLorebook: "Use Regex",
  },
}));

vi.mock(import("src/ts/process/lorebook.svelte"), () => ({
  addLorebook: () => {},
  addLorebookFolder: () => {},
  exportLoreBook: () => {},
  importLoreBook: () => {},
}));

vi.mock(import("src/lib/SideBars/LoreBook/LoreBookList.svelte"), async () => ({
  default: (await import("./test-stubs/LoreBookListStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/LoreBook/RulebookRagSetting.svelte"), async () => ({
  default: (await import("./test-stubs/RulebookRagSettingStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
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
vi.mock(import("src/ts/storage/database.svelte"), () => ({
  getCurrentCharacter: () => ({ globalLore: [] }),
  getCurrentChat: () => ({ localLore: [] }),
}));
vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: async () => true,
  alertMd: () => {},
}));
vi.mock(import("src/ts/tokenizer"), () => ({
  tokenizeAccurate: async () => 0,
}));

import LoreBookSetting from "src/lib/SideBars/LoreBook/LoreBookSetting.svelte";
import LoreBookData from "src/lib/SideBars/LoreBook/LoreBookData.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("lorebook runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("hides rulebook tab when includeRulebookTab is false", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LoreBookSetting, { target, props: { includeRulebookTab: false } });
    await flushUi();

    const tabRoot = document.querySelector(".lorebook-setting-tabs") as HTMLElement | null;
    expect(tabRoot).not.toBeNull();
    expect(tabRoot?.classList.contains("seg-tabs")).toBe(true);

    const tabs = [...document.querySelectorAll(".lorebook-setting-tab")] as HTMLButtonElement[];
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.every((tab) => tab.classList.contains("seg-tab"))).toBe(true);
    expect(tabs.every((tab) => tab.type === "button")).toBe(true);
    expect(tabs.filter((tab) => tab.getAttribute("aria-pressed") === "true").length).toBe(1);
    expect(tabs.filter((tab) => tab.classList.contains("active")).length).toBe(1);

    const actionButtons = [...document.querySelectorAll(".lorebook-setting-action-btn")] as HTMLButtonElement[];
    expect(actionButtons.length).toBeGreaterThan(0);
    expect(actionButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(actionButtons.every((button) => button.classList.contains("icon-btn--md"))).toBe(true);
    expect(actionButtons.every((button) => button.type === "button")).toBe(true);
    expect(actionButtons[0]?.title).toBe("Add lorebook entry");
    expect(actionButtons[0]?.getAttribute("aria-label")).toBe("Add lorebook entry");
    const actionRail = document.querySelector(".lorebook-setting-actions.action-rail") as HTMLElement | null;
    expect(actionRail).not.toBeNull();

    const tabLabels = [...document.querySelectorAll(".lorebook-setting-tab span")]
      .map((node) => node.textContent ?? "");
    expect(tabLabels.some((text) => text.includes("Rulebooks"))).toBe(false);

    expect(document.querySelector('[data-testid="rulebook-rag-setting-stub"]')).toBeNull();
    expect(document.querySelector('[data-testid="lorebook-list-stub"]')).not.toBeNull();
  });

  it("renders rulebook tab and panel when includeRulebookTab is true", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LoreBookSetting, { target, props: { includeRulebookTab: true } });
    await flushUi();

    const rulebooksTab = [...document.querySelectorAll(".lorebook-setting-tab span")]
      .find((node) => (node.textContent ?? "").includes("Rulebooks"));

    expect(rulebooksTab).toBeDefined();
    expect((rulebooksTab!.closest("button") as HTMLButtonElement).title).toBe("Rulebooks");
    expect((rulebooksTab!.closest("button") as HTMLButtonElement).getAttribute("aria-label")).toBe("Rulebooks");
    (rulebooksTab!.closest("button") as HTMLButtonElement).click();
    await flushUi();
    expect((rulebooksTab!.closest("button") as HTMLButtonElement).classList.contains("active")).toBe(true);

    expect(document.querySelector('[data-testid="rulebook-rag-setting-stub"]')).not.toBeNull();
  });

  it("applies icon button primitives to lorebook row actions", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LoreBookData, {
      target,
      props: {
        value: {
          key: "lore-key",
          comment: "Lore entry",
          content: "Lore content",
          mode: "normal",
          insertorder: 100,
          alwaysActive: true,
          secondkey: "",
          selective: false,
          useRegex: false,
        },
        idx: 0,
        idgroup: "group-a",
        externalLoreBooks: [],
        isOpen: false,
      },
    });
    await flushUi();

    const mainBtn = document.querySelector(".lorebook-data-main-btn") as HTMLButtonElement | null;
    const toggleBtn = document.querySelector('[data-testid="lorebook-data-toggle-btn"]') as HTMLButtonElement | null;
    const removeBtn = document.querySelector('[data-testid="lorebook-data-remove-btn"]') as HTMLButtonElement | null;
    expect(mainBtn).not.toBeNull();
    expect(toggleBtn).not.toBeNull();
    expect(removeBtn).not.toBeNull();
    expect(mainBtn?.type).toBe("button");
    expect(mainBtn?.title).toBe("Toggle lorebook entry");
    expect(mainBtn?.getAttribute("aria-label")).toBe("Toggle lorebook entry");
    expect(toggleBtn?.classList.contains("icon-btn")).toBe(true);
    expect(toggleBtn?.classList.contains("icon-btn--sm")).toBe(true);
    expect(toggleBtn?.type).toBe("button");
    expect(toggleBtn?.title).toBe("Toggle active state");
    expect(toggleBtn?.getAttribute("aria-label")).toBe("Toggle active state");
    expect(toggleBtn?.getAttribute("aria-pressed")).toBe("true");
    expect(removeBtn?.classList.contains("icon-btn")).toBe(true);
    expect(removeBtn?.classList.contains("icon-btn--sm")).toBe(true);
    expect(removeBtn?.type).toBe("button");
    expect(removeBtn?.title).toBe("Remove lorebook entry");
    expect(removeBtn?.getAttribute("aria-label")).toBe("Remove lorebook entry");
  });

  it("keeps folder actions on action-rail primitive", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LoreBookData, {
      target,
      props: {
        value: {
          key: "folder-key",
          comment: "Folder A",
          content: "",
          mode: "folder",
          insertorder: 100,
          alwaysActive: true,
          secondkey: "",
          selective: false,
          useRegex: false,
        },
        idx: 0,
        idgroup: "group-b",
        externalLoreBooks: [],
        isOpen: true,
      },
    });
    await flushUi();

    const folderPanel = document.querySelector(".lorebook-data-panel.panel-shell") as HTMLElement | null;
    expect(folderPanel).not.toBeNull();
    const nestedList = document.querySelector(".lorebook-data-nested-list.list-shell") as HTMLElement | null;
    expect(nestedList).not.toBeNull();

    const folderActions = document.querySelector(".lorebook-data-folder-actions.action-rail") as HTMLElement | null;
    expect(folderActions).not.toBeNull();
    const addInFolderButton = document.querySelector(
      '[data-testid="lorebook-data-add-in-folder-btn"]',
    ) as HTMLButtonElement | null;
    expect(addInFolderButton).not.toBeNull();
    expect(addInFolderButton?.classList.contains("icon-btn")).toBe(true);
    expect(addInFolderButton?.classList.contains("icon-btn--sm")).toBe(true);
    expect(addInFolderButton?.type).toBe("button");
    expect(addInFolderButton?.title).toBe("Add lore entry in folder");
    expect(addInFolderButton?.getAttribute("aria-label")).toBe("Add lore entry in folder");
  });

});
