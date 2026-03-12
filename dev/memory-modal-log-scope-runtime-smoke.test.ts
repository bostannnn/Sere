import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    memoryModal: {
      titleLabel: "Memory",
      unclassified: "Unclassified",
      noSummariesLabel: "No summaries yet",
      resetConfirmMessage: "Reset?",
      resetConfirmSecondMessage: "Reset again?",
      searchPlaceholder: "Search",
    },
  },
}));

vi.mock(import("src/ts/parser.svelte"), () => ({
  assetRegex: /\{\{asset::.*?\}\}/g,
  risuChatParser: (text: string) => text,
  convertImage: async () => "",
  checkImageType: () => true,
  parseMarkdownSafe: (text: string) => text,
  hasher: async () => "hash",
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  globalFetch: vi.fn(async () => ({ ok: true, data: {} })),
  downloadFile: async () => {},
  saveAsset: async () => "asset-test-id",
  aiWatermarkingLawApplies: () => false,
  getFileSrc: async () => "",
}));

vi.mock(import("src/ts/alert"), () => ({
  alertNormalWait: async () => {},
  alertToast: () => {},
}));

vi.mock(import("src/lib/Others/MemoryModal/utils"), () => ({
  shouldShowSummary: () => true,
  isGuidLike: () => false,
  parseSelectionInput: () => new Set<number>(),
  alertConfirmTwice: async () => false,
}));

vi.mock(import("src/lib/Others/MemoryModal/modal-header.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/MemoryModal/modal-summary-item.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/MemoryModal/bulk-edit-actions.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import MemoryPanel from "src/lib/Others/MemoryPanel.svelte";
import { DBState, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;
let target: HTMLDivElement | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
}

async function switchToLogTab(root: ParentNode) {
  const tabs = Array.from(root.querySelectorAll(".ds-settings-tab")) as HTMLButtonElement[];
  const logTab = tabs.find((button) => button.textContent?.includes("Log"));
  expect(logTab).toBeDefined();
  logTab?.click();
  await flushUi();
}

function createBaseDb() {
  return {
    characters: [
      {
        type: "character",
        chaId: "char-a",
        name: "Character A",
        memoryEnabled: true,
        chatPage: 0,
        memoryPromptOverride: {
          summarizationPrompt: "",
          reSummarizationPrompt: "",
        },
        chats: [
          {
            id: "chat-a",
            name: "Chat A",
            message: [{ role: "user", data: "hello", chatId: "a1" }],
            memoryData: {
              summaries: [],
              categories: [{ id: "", name: "Unclassified" }],
              lastSelectedSummaries: [],
            },
          },
        ],
      },
    ],
    memoryEnabled: true,
    memoryPresetId: 0,
    memoryPresets: [],
  };
}

describe("memory modal log scope runtime smoke", () => {
  beforeEach(() => {
    selectedCharID.set(0);
    document.body.innerHTML = "";
    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
    }
    app = undefined;
    target = undefined;
  });

  it("shows log data when manual debug matches active chat", async () => {
    const db = createBaseDb();
    (db.characters[0].chats[0].memoryData as Record<string, unknown>).lastManualDebug = {
      timestamp: Date.now(),
      model: "stub-model",
      isResummarize: false,
      prompt: "Prompt text",
      input: "Input text",
      formatted: [{ role: "user", content: "hello" }],
      characterId: "char-a",
      chatId: "chat-a",
      start: 1,
      end: 1,
      source: "manual",
      promptSource: "request_override",
    };
    DBState.db = db as never;

    app = mount(MemoryPanel, { target: target! });
    await flushUi();
    await switchToLogTab(target!);

    expect(target?.textContent).toContain("Last summarize log");
    expect(target?.textContent).toContain("stub-model");
    expect(target?.textContent).not.toContain("No summarize logs yet for this chat.");
  });

  it("hides global debug when it belongs to another character/chat", async () => {
    const db = createBaseDb();
    (db as Record<string, unknown>).memoryDebug = {
      timestamp: Date.now(),
      model: "other-model",
      isResummarize: false,
      prompt: "Other prompt",
      input: "Other input",
      formatted: [{ role: "user", content: "other" }],
      characterId: "char-other",
      chatId: "chat-other",
      source: "manual",
      promptSource: "preset_or_default",
    };
    DBState.db = db as never;

    app = mount(MemoryPanel, { target: target! });
    await flushUi();
    await switchToLogTab(target!);

    expect(target?.textContent).toContain("No summarize logs yet for this chat.");
    expect(target?.textContent).not.toContain("Last summarize log");
  });
});
