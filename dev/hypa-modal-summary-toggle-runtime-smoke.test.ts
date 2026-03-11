import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    ToggleMemory: "Toggle HypaMemory",
    memoryModal: {
      titleLabel: "Memory",
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
vi.mock(import("src/lib/Others/MemoryModal/bulk-resummary-result.svelte"), async () => ({
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

describe("hypa modal summary toggle runtime smoke", () => {
  beforeEach(() => {
    DBState.db = {
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
                summaries: [{ text: "summary", chatMemos: [], isImportant: false }],
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
    } as never;
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

  it("shows the HypaMemory toggle on Summary and removes it from Settings", async () => {
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    expect(target?.textContent).toContain("Toggle HypaMemory");

    const tabs = Array.from(target?.querySelectorAll(".ds-settings-tab") ?? []) as HTMLButtonElement[];
    tabs.find((tab) => tab.textContent?.includes("Settings"))?.click();
    await flushUi();

    expect(target?.textContent).not.toContain("Toggle HypaMemory");
    expect(target?.textContent).toContain("Per-character memory prompt override");
  });
});
