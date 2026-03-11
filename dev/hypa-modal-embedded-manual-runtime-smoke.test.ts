import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const shared = vi.hoisted(() => {
  const fetchCalls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const globalFetchMock = vi.fn(async (path: string, args: { body: Record<string, unknown> }) => {
    fetchCalls.push({ path, body: args.body });
    const requestPrompt = String((args.body.promptOverride as { summarizationPrompt?: unknown } | undefined)?.summarizationPrompt ?? "");
    const resolvedPrompt = requestPrompt.trim().length > 0 ? requestPrompt : "Preset prompt";
    const promptSource = requestPrompt.trim().length > 0 ? "request_override" : "preset_or_default";
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
          prompt: resolvedPrompt,
          input: "test input",
          formatted: [{ role: "user", content: "x" }],
          characterId: String(args.body.characterId ?? ""),
          chatId: String(args.body.chatId ?? ""),
          start: Number(args.body.start ?? 0),
          end: Number(args.body.end ?? 0),
          source: "manual",
          promptSource,
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
import { DBState, memoryModalOpen, selectedCharID } from "src/ts/stores.svelte";

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
    memoryModalOpen.set(true);

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
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(summarizeButton).not.toBeNull();

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(1);
    expect(shared.fetchCalls[0]?.path).toBe("/data/memory/manual-summarize");
    expect(shared.fetchCalls[0]?.body.chatId).toBe("chat-a");

    DBState.db.characters[0].chatPage = 1;
    await flushUi();

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(2);
    expect(shared.fetchCalls[1]?.body.chatId).toBe("chat-b");
  });

  it("uses selected modal chat in non-embedded mode manual summarize", async () => {
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: false },
    });
    await flushUi();

    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(summarizeButton).not.toBeNull();

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(1);
    const firstRequest = shared.globalFetchMock.mock.calls[0]?.[1] as { body?: { chatId?: string } } | undefined;
    expect(firstRequest?.body?.chatId).toBe("chat-a");

    const chatSelectValueInput = target?.querySelector(
      ".ds-memory-modal-chat-select [data-testid='bindable-field-value']",
    ) as HTMLInputElement | null;
    expect(chatSelectValueInput).not.toBeNull();
    chatSelectValueInput!.value = "1";
    chatSelectValueInput!.dispatchEvent(new Event("change", { bubbles: true }));
    await flushUi();

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(2);
    expect(shared.fetchCalls[1]?.body.chatId).toBe("chat-b");
  });

  it("renders inline range validation error for invalid manual summarize range", async () => {
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    const startInput = target?.querySelector("#memory-manual-range-start") as HTMLInputElement | null;
    const endInput = target?.querySelector("#memory-manual-range-end") as HTMLInputElement | null;
    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(summarizeButton).not.toBeNull();

    startInput!.value = "2";
    startInput!.dispatchEvent(new Event("input", { bubbles: true }));
    endInput!.value = "1";
    endInput!.dispatchEvent(new Event("input", { bubbles: true }));

    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(0);
    expect(target?.textContent).toContain("Invalid range. Use values between 1 and 1, and keep Start less than or equal to End.");
  });

  it("clears manual feedback when active chat scope changes", async () => {
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    const startInput = target?.querySelector("#memory-manual-range-start") as HTMLInputElement | null;
    const endInput = target?.querySelector("#memory-manual-range-end") as HTMLInputElement | null;
    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(summarizeButton).not.toBeNull();

    startInput!.value = "2";
    startInput!.dispatchEvent(new Event("input", { bubbles: true }));
    endInput!.value = "1";
    endInput!.dispatchEvent(new Event("input", { bubbles: true }));
    summarizeButton?.click();
    await flushUi();

    expect(target?.textContent).toContain("Invalid range. Use values between 1 and 1, and keep Start less than or equal to End.");

    DBState.db.characters[0].chatPage = 1;
    await flushUi();

    expect(target?.textContent).not.toContain("Invalid range. Use values between 1 and 1, and keep Start less than or equal to End.");
  });

  it("renders summary/settings/log tabs and settings prompt override without legacy title", async () => {
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    expect(target?.textContent).not.toContain("Memory");

    const tabs = Array.from(target?.querySelectorAll(".ds-settings-tab") ?? []) as HTMLButtonElement[];
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(["Summary", "Settings", "Log"]);

    const startInput = target?.querySelector("#memory-manual-range-start");
    const endInput = target?.querySelector("#memory-manual-range-end");
    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit");
    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(summarizeButton).not.toBeNull();
    expect(target?.textContent).not.toContain("Memory will summarize");
    expect(target?.textContent).not.toContain("Tip: Memory begins summarization when input tokens exceed the maximum context size.");
    expect(target?.textContent).not.toContain("WARN: Selected first message is empty");

    const settingsTab = tabs.find((tab) => tab.textContent?.includes("Settings"));
    expect(settingsTab).toBeDefined();
    settingsTab?.click();
    await flushUi();

    expect(target?.textContent).toContain("Per-character memory prompt override");
    expect(target?.textContent).toContain("Summarization Prompt");
    expect(target?.textContent).not.toContain("Re-summarization Prompt");
  });

  it("uses latest prompt override immediately and keeps override scoped per character", async () => {
    DBState.db = {
      ...DBState.db,
      characters: [
        {
          ...DBState.db.characters[0],
          chaId: "char-a",
          hypaV3PromptOverride: {
            summarizationPrompt: "TRACKER_A",
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
          chatPage: 0,
        },
        {
          ...DBState.db.characters[0],
          chaId: "char-c",
          name: "Character C",
          hypaV3PromptOverride: {
            summarizationPrompt: "TRACKER_C",
            reSummarizationPrompt: "",
          },
          chats: [
            {
              id: "chat-c",
              name: "Chat C",
              message: [{ role: "user", data: "hola", chatId: "c1" }],
              hypaV3Data: {
                summaries: [],
                categories: [{ id: "", name: "Unclassified" }],
                lastSelectedSummaries: [],
              },
            },
          ],
          chatPage: 0,
        },
      ],
    } as never;
    selectedCharID.set(0);
    shared.fetchCalls.length = 0;
    shared.globalFetchMock.mockClear();

    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    const tabs = Array.from(target?.querySelectorAll(".ds-settings-tab") ?? []) as HTMLButtonElement[];
    tabs.find((tab) => tab.textContent?.includes("Settings"))?.click();
    await flushUi();

    const promptInput = target?.querySelector(
      ".ds-memory-modal-prompt-override-input [data-testid='bindable-field-value']",
    ) as HTMLInputElement | null;
    expect(promptInput).not.toBeNull();
    promptInput!.value = "TRACKER_A_LATEST";
    promptInput!.dispatchEvent(new Event("input", { bubbles: true }));

    tabs.find((tab) => tab.textContent?.includes("Summary"))?.click();
    await flushUi();

    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(summarizeButton).not.toBeNull();
    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(1);
    expect(shared.fetchCalls[0]?.body.characterId).toBe("char-a");
    expect(shared.fetchCalls[0]?.body.chatId).toBe("chat-a");
    expect((shared.fetchCalls[0]?.body.promptOverride as { summarizationPrompt?: string } | undefined)?.summarizationPrompt).toBe("TRACKER_A_LATEST");

    selectedCharID.set(1);
    await flushUi();
    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(2);
    expect(shared.fetchCalls[1]?.body.characterId).toBe("char-c");
    expect(shared.fetchCalls[1]?.body.chatId).toBe("chat-c");
    expect((shared.fetchCalls[1]?.body.promptOverride as { summarizationPrompt?: string } | undefined)?.summarizationPrompt).toBe("TRACKER_C");
  });

  it("uses provided range and shows scoped log without legacy runtime rows", async () => {
    app = mount(MemoryPanel, {
      target: target!,
      props: { embedded: true },
    });
    await flushUi();

    const startInput = target?.querySelector("#memory-manual-range-start") as HTMLInputElement | null;
    const endInput = target?.querySelector("#memory-manual-range-end") as HTMLInputElement | null;
    const summarizeButton = target?.querySelector(".ds-memory-modal-manual-submit") as HTMLButtonElement | null;
    expect(startInput).not.toBeNull();
    expect(endInput).not.toBeNull();
    expect(summarizeButton).not.toBeNull();

    startInput!.value = "1";
    startInput!.dispatchEvent(new Event("input", { bubbles: true }));
    endInput!.value = "1";
    endInput!.dispatchEvent(new Event("input", { bubbles: true }));
    summarizeButton?.click();
    await flushUi();

    expect(shared.globalFetchMock).toHaveBeenCalledTimes(1);
    expect(shared.fetchCalls[0]?.body.start).toBe(1);
    expect(shared.fetchCalls[0]?.body.end).toBe(1);

    const tabs = Array.from(target?.querySelectorAll(".ds-settings-tab") ?? []) as HTMLButtonElement[];
    tabs.find((tab) => tab.textContent?.includes("Log"))?.click();
    await flushUi();

    expect(target?.textContent).toContain("Last summarize log");
    expect(target?.textContent).toContain("Range:");
    expect(target?.textContent).not.toContain("HypaV2 enabled");
    expect(target?.textContent).not.toContain("Hanurai enabled");
    expect(target?.textContent).not.toContain("SupaModelType");
    expect(target?.textContent).not.toContain("Memory algorithm");
    expect(target?.textContent).not.toContain("Periodic:");
    expect(target?.textContent).not.toContain("Interval:");
    expect(target?.textContent).not.toContain("Last index:");
    expect(target?.textContent).not.toContain("Chat messages:");
  });

});
