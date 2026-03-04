import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    hypaV3Modal: {
      titleLabel: "HypaV3",
      unclassified: "Unclassified",
      noSummariesLabel: "No summaries yet",
      resetConfirmMessage: "Reset?",
      resetConfirmSecondMessage: "Reset again?",
      searchPlaceholder: "Search",
      convertLabel: "Convert",
      convertButton: "Convert",
      convertSuccessMessage: "Converted",
      convertErrorMessage: "Error: {0}",
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

vi.mock(import("src/lib/Others/HypaV3Modal/utils"), () => ({
  shouldShowSummary: () => true,
  isGuidLike: () => false,
  parseSelectionInput: () => new Set<number>(),
  alertConfirmTwice: async () => false,
}));

vi.mock(import("src/lib/Others/HypaV3Modal/modal-header.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/HypaV3Modal/modal-summary-item.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/HypaV3Modal/modal-footer.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/HypaV3Modal/bulk-edit-actions.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/HypaV3Modal/bulk-resummary-result.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import HypaV3Modal from "src/lib/Others/HypaV3Modal.svelte";
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
        supaMemory: true,
        chatPage: 0,
        hypaV3PromptOverride: {
          summarizationPrompt: "",
          reSummarizationPrompt: "",
        },
        chats: [
          {
            id: "chat-a",
            name: "Chat A",
            message: [{ role: "user", data: "hello", chatId: "a1" }],
            hypaV3Data: {
              summaries: [],
              categories: [{ id: "", name: "Unclassified" }],
              lastSelectedSummaries: [],
            },
          },
        ],
      },
    ],
    hypaV3: true,
    hypav2: false,
    hanuraiEnable: false,
    supaModelType: "none",
    memoryAlgorithmType: "hypaMemoryV3",
    hypaV3PresetId: 0,
    hypaV3Presets: [],
  };
}

describe("hypa modal log scope runtime smoke", () => {
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
    (db.characters[0].chats[0].hypaV3Data as Record<string, unknown>).lastManualDebug = {
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

    app = mount(HypaV3Modal, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();
    await switchToLogTab(target!);

    expect(target?.textContent).toContain("Last summarize log");
    expect(target?.textContent).toContain("stub-model");
    expect(target?.textContent).not.toContain("No summarize logs yet for this chat.");
  });

  it("hides global debug when it belongs to another character/chat", async () => {
    const db = createBaseDb();
    (db as Record<string, unknown>).hypaV3Debug = {
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

    app = mount(HypaV3Modal, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();
    await switchToLogTab(target!);

    expect(target?.textContent).toContain("No summarize logs yet for this chat.");
    expect(target?.textContent).not.toContain("Last summarize log");
  });
});
