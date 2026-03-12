import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const shared = vi.hoisted(() => {
  const fetchCalls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const globalFetchMock = vi.fn(async (path: string, args: { body: Record<string, unknown> }) => {
    fetchCalls.push({ path, body: args.body });
    return {
      ok: true,
      data: {
        memoryData: {
          summaries: [],
          categories: [{ id: "", name: "Unclassified" }],
          lastSelectedSummaries: [],
        },
        debug: {
          timestamp: Date.now(),
          model: "test-model",
          isResummarize: false,
          prompt: "Prompt",
          input: "Input",
          formatted: [{ role: "user", content: "hello" }],
          characterId: String(args.body.characterId ?? ""),
          chatId: String(args.body.chatId ?? ""),
          start: Number(args.body.start ?? 0),
          end: Number(args.body.end ?? 0),
          source: "manual",
          promptSource: "preset_or_default",
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

vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import MemoryPanel from "src/lib/Others/MemoryPanel.svelte";
import { DBState, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;
let target: HTMLDivElement | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
}

describe("memory modal manual async race runtime smoke", () => {
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
          memoryPromptOverride: {
            summarizationPrompt: "",
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
            {
              id: "chat-b",
              name: "Chat B",
              message: [{ role: "user", data: "world", chatId: "b1" }],
              memoryData: {
                summaries: [],
                categories: [{ id: "", name: "Unclassified" }],
                lastSelectedSummaries: [],
              },
            },
          ],
        },
      ],
      supaModelType: "none",
      memoryPresetId: 0,
      memoryPresets: [],
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

  it("keeps manual summarize writes scoped to request target when active chat changes mid-request", async () => {
    let resolveFetch:
      | ((value: { ok: boolean; data: Record<string, unknown> }) => void)
      | null = null;
    shared.globalFetchMock.mockImplementationOnce(async () =>
      await new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    app = mount(MemoryPanel, { target: target! });
    await flushUi();

    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(summarizeButton).not.toBeNull();
    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(1);
    const firstRequest = shared.globalFetchMock.mock.calls[0]?.[1] as { body?: { chatId?: string } } | undefined;
    expect(firstRequest?.body?.chatId).toBe("chat-a");

    DBState.db.characters[0].chatPage = 1;
    await flushUi();

    resolveFetch?.({
      ok: true,
      data: {
        memoryData: {
          summaries: [{ text: "summary-for-chat-a", chatMemos: [], isImportant: false }],
          categories: [{ id: "", name: "Unclassified" }],
          lastSelectedSummaries: [],
        },
        debug: {
          timestamp: Date.now(),
          model: "test-model",
          isResummarize: false,
          prompt: "Prompt",
          input: "Input",
          formatted: [{ role: "user", content: "hello" }],
          characterId: "char-embedded",
          chatId: "chat-a",
          start: 1,
          end: 1,
          source: "manual",
          promptSource: "preset_or_default",
        },
      },
    });
    await flushUi();
    await flushUi();

    const chatAData = DBState.db.characters[0].chats[0].memoryData as { summaries?: Array<{ text?: string }> };
    const chatBData = DBState.db.characters[0].chats[1].memoryData as
      | { summaries?: Array<{ text?: string }>; lastManualDebug?: unknown }
      | undefined;
    expect(chatAData.summaries?.[0]?.text).toBe("summary-for-chat-a");
    expect(chatBData?.summaries ?? []).toEqual([]);
    expect(chatBData?.lastManualDebug).toBeUndefined();
    expect(target?.textContent).toContain("No summaries yet");
  });

  it("does not expose the removed standalone chat selector while requests are in flight", async () => {
    app = mount(MemoryPanel, { target: target! });
    await flushUi();

    expect(target?.querySelector(".ds-memory-modal-chat-select")).toBeNull();
  });

  it("persists manual summarize result into live character store after characters array replacement", async () => {
    let resolveFetch:
      | ((value: { ok: boolean; data: Record<string, unknown> }) => void)
      | null = null;
    shared.globalFetchMock.mockImplementationOnce(async () =>
      await new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    app = mount(MemoryPanel, { target: target! });
    await flushUi();

    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(summarizeButton).not.toBeNull();
    summarizeButton?.click();
    await flushUi();

    DBState.db.characters = DBState.db.characters.map((character) => ({
      ...character,
      chats: character.chats.map((chat) => ({
        ...chat,
        memoryData: chat.memoryData
          ? {
              ...chat.memoryData,
              summaries: [...(chat.memoryData?.summaries ?? [])],
              categories: [...(chat.memoryData?.categories ?? [])],
              lastSelectedSummaries: [...(chat.memoryData?.lastSelectedSummaries ?? [])],
            }
          : undefined,
      })),
    })) as never;
    await flushUi();

    resolveFetch?.({
      ok: true,
      data: {
        memoryData: {
          summaries: [{ text: "summary-after-store-replace", chatMemos: [], isImportant: false }],
          categories: [{ id: "", name: "Unclassified" }],
          lastSelectedSummaries: [],
        },
        debug: {
          timestamp: Date.now(),
          model: "test-model",
          isResummarize: false,
          prompt: "Prompt",
          input: "Input",
          formatted: [{ role: "user", content: "hello" }],
          characterId: "char-embedded",
          chatId: "chat-a",
          start: 1,
          end: 1,
          source: "manual",
          promptSource: "preset_or_default",
        },
      },
    });
    await flushUi();
    await flushUi();

    const chatAData = DBState.db.characters[0].chats[0].memoryData as {
      summaries?: Array<{ text?: string }>;
      lastManualDebug?: { chatId?: string };
    };
    expect(chatAData.summaries?.[0]?.text).toBe("summary-after-store-replace");
    expect(chatAData.lastManualDebug?.chatId).toBe("chat-a");
    expect(target?.textContent).not.toContain("No summaries yet");
  });
});
