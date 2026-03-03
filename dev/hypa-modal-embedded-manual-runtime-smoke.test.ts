import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const shared = vi.hoisted(() => {
  const fetchCalls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const globalFetchMock = vi.fn(async (path: string, args: { body: Record<string, unknown> }) => {
    fetchCalls.push({ path, body: args.body });
    return {
      ok: true,
      data: {
        hypaV3Data: {
          summaries: [],
          categories: [{ id: "", name: "Unclassified" }],
          lastSelectedSummaries: [],
        },
        debug: {
          timestamp: Date.now(),
          model: "test-model",
          isResummarize: false,
          prompt: "test prompt",
          input: "test input",
          formatted: [{ role: "user", content: "x" }],
          characterId: String(args.body.characterId ?? ""),
          chatId: String(args.body.chatId ?? ""),
          start: Number(args.body.start ?? 0),
          end: Number(args.body.end ?? 0),
          source: "manual",
        },
      },
    };
  });

  return {
    fetchCalls,
    globalFetchMock,
  };
});

vi.mock(import("src/lang"), () => ({
  language: {
    hypaV3Modal: {
      titleLabel: "HypaV3",
      unclassified: "Unclassified",
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
  globalFetch: shared.globalFetchMock,
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

vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/SettingsSubTabs.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import HypaV3Modal from "src/lib/Others/HypaV3Modal.svelte";
import { DBState, hypaV3ModalOpen, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;
let target: HTMLDivElement | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
}

describe("hypa modal embedded manual summarize runtime smoke", () => {
  beforeEach(() => {
    shared.fetchCalls.length = 0;
    shared.globalFetchMock.mockClear();

    DBState.db = {
      characters: [
        {
          type: "character",
          chaId: "char-embedded",
          name: "Embedded Character",
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
            },
            {
              id: "chat-b",
              name: "Chat B",
              message: [{ role: "user", data: "world", chatId: "b1" }],
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
    hypaV3ModalOpen.set(true);

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

  it("uses active chatPage chatId for manual summarize while embedded and mounted", async () => {
    app = mount(HypaV3Modal, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    const summarizeButton = target?.querySelector(".ds-hypa-modal-manual-submit") as HTMLButtonElement | null;
    expect(summarizeButton).not.toBeNull();

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(1);
    expect(shared.fetchCalls[0]?.path).toBe("/data/memory/hypav3/manual-summarize");
    expect(shared.fetchCalls[0]?.body.chatId).toBe("chat-a");

    DBState.db.characters[0].chatPage = 1;
    await flushUi();

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(2);
    expect(shared.fetchCalls[1]?.body.chatId).toBe("chat-b");
  });
});
