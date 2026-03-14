import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const shared = vi.hoisted(() => ({
  dbState: {
    db: {} as Record<string, unknown>,
  },
}));

function createMemoryPresetSettings() {
  return {
    summarizationPrompt: "summary prompt",
    reSummarizationPrompt: "resummary prompt",
    summarizationAllowThinking: false,
    memoryTokensRatio: 0.5,
    extraSummarizationRatio: 0.1,
    periodicSummarizationInterval: 2,
    recentMemoryRatio: 0.3,
    similarMemoryRatio: 0.3,
    preserveOrphanedMemory: false,
    processRegexScript: false,
    doNotSummarizeUserMessage: false,
    useExperimentalImpl: false,
    alwaysToggleOn: false,
    summarizationRequestsPerMinute: 20,
    summarizationMaxConcurrent: 2,
    embeddingRequestsPerMinute: 20,
    embeddingMaxConcurrent: 2,
    enableSimilarityCorrection: true,
  };
}

function createDbState() {
  return {
    characters: [
      {
        chaId: "char-trash",
        name: "assistant",
        type: "character",
        trashTime: 12345,
        chats: [],
        chatPage: 0,
        emotionImages: [],
      },
      {
        chaId: "char-visible-1",
        name: "Yuki",
        type: "character",
        chats: [],
        chatPage: 0,
        emotionImages: [["smile", "assets/emotion-smile.png"]],
      },
      {
        chaId: "char-visible-2",
        name: "   ",
        type: "character",
        chats: [],
        chatPage: 0,
        emotionImages: [],
      },
    ],
    emotionProcesser: "submodel",
    emotionPrompt2: "",
    embeddingModel: "MiniLM",
    hideApiKey: true,
    ttsAutoSpeech: false,
    elevenLabKey: "",
    voicevoxUrl: "",
    openAIKey: "",
    novelai: { token: "" },
    huggingfaceKey: "",
    fishSpeechKey: "",
    memoryApiKey: "",
    customEmbeddingSettings: {
      url: "",
      key: "",
      model: "",
    },
    memoryPresetId: 0,
    memoryPresets: [
      {
        name: "Default Preset",
        settings: createMemoryPresetSettings(),
      },
    ],
    promptTemplate: [],
    loreBookToken: 8000,
    maxResponse: 300,
    maxContext: 4000,
  };
}

vi.mock(import("src/lang"), () => ({
  changeLanguage: vi.fn(),
  language: {
    otherBots: "Other Bots",
    longTermMemory: "Long Term Memory",
    emotionImage: "Emotion Images",
    emotionMethod: "Emotion Method",
    emotionPrompt: "Emotion Prompt",
    embedding: "Embedding",
    summarizationPrompt: "Summarization Prompt",
    reSummarizationPrompt: "Re-Summarization Prompt",
    removeConfirm: "Remove ",
    successExport: "Exported",
    successImport: "Imported",
    memorySettings: {
      descriptionLabel: "Description",
      memoryPromptPlaceholder: "Prompt placeholder",
      maxMemoryTokensRatioLabel: "Max ratio",
      maxMemoryTokensRatioError: "Max ratio error",
      memoryTokensRatioLabel: "Memory ratio",
      extraSummarizationRatioLabel: "Extra ratio",
      recentMemoryRatioLabel: "Recent ratio",
      similarMemoryRatioLabel: "Similar ratio",
      randomMemoryRatioLabel: "Random ratio",
      preserveOrphanedMemoryLabel: "Preserve orphaned",
      applyRegexScriptWhenRerollingLabel: "Apply regex",
      doNotSummarizeUserMessageLabel: "Do not summarize user",
      enableSimilarityCorrectionLabel: "Similarity correction",
    },
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: shared.dbState,
    EvolutionDefaultsSettingsTabIndex: writable<number | null>(null),
    OtherBotSettingsSubMenuIndex: writable<number | null>(null),
    selectedCharID: writable(0),
  };
});

vi.mock(import("src/ts/process/prompt"), () => ({
  tokenizePreset: async () => 0,
}));

vi.mock(import("src/ts/tokenizer"), () => ({
  getCharToken: async () => ({ persistant: 0, dynamic: 0 }),
}));

vi.mock(import("src/ts/alert"), () => ({
  alertError: vi.fn(),
  alertInput: vi.fn(async () => ""),
  alertConfirm: vi.fn(async () => true),
  alertNormal: vi.fn(),
}));

vi.mock(import("src/ts/process/memory/memory"), () => ({
  createMemoryPreset: (name = "Generated", settings: Record<string, unknown> = {}) => ({
    name,
    settings: {
      ...createMemoryPresetSettings(),
      ...settings,
    },
  }),
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  downloadFile: async () => {},
  saveAsset: async () => "assets/mock-asset.png",
}));

vi.mock(import("src/ts/util"), () => ({
  selectSingleFile: async () => null,
  checkNullish: (value: unknown) => value === null || value === undefined,
}));

vi.mock(import("src/ts/process/emotion/defaultPrompt"), () => ({
  DEFAULT_EMOTION_PROMPT: "default emotion prompt",
}));

vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/Accordion.svelte"), async () => ({
  default: (await import("./test-stubs/AccordionOpenStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/EmbeddingModelSelect.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/ModelList.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OpenRouterModelSelect.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));

import OtherBotSettings from "src/lib/Setting/Pages/OtherBotSettings.svelte";
import { createDefaultCharacterEvolutionDefaults } from "src/ts/characterEvolution";
import { EvolutionDefaultsSettingsTabIndex, OtherBotSettingsSubMenuIndex, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("other bots settings runtime smoke", () => {
  function getInputFollowingLabel(
    labelText: string,
    selector = 'input[type="text"], input[type="number"], input[type="range"]',
  ): HTMLInputElement | null {
    const labels = Array.from(document.querySelectorAll(".ds-settings-label"));
    const label = labels.find((node) => {
      const text = (node.textContent ?? "").trim();
      return text === labelText || text.includes(labelText);
    });
    if (!label) return null;

    let next: Element | null = label.nextElementSibling;
    while (next) {
      if (next instanceof HTMLInputElement && next.matches(selector)) {
        return next;
      }

      const nested = next.querySelector?.(selector);
      if (nested instanceof HTMLInputElement) {
        return nested;
      }
      next = next.nextElementSibling;
    }

    return null;
  }

  beforeEach(() => {
    shared.dbState.db = createDbState();
    shared.dbState.db.characterEvolutionDefaults = createDefaultCharacterEvolutionDefaults();
    selectedCharID.set(0);
    EvolutionDefaultsSettingsTabIndex.set(null);
    OtherBotSettingsSubMenuIndex.set(null);
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("filters Emotion List Character to active characters and falls back from trashed active selection", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OtherBotSettings, { target });
    await flushUi();

    const emotionTab = document.querySelector(
      'button.ds-settings-tab[title="Emotion Images"]',
    ) as HTMLButtonElement | null;
    expect(emotionTab).not.toBeNull();
    emotionTab?.click();
    await flushUi();

    const selects = Array.from(document.querySelectorAll("select")) as HTMLSelectElement[];
    const charSelect = selects.find((select) => {
      const values = Array.from(select.options).map((option) => option.value);
      return values.includes("char-visible-1") && values.includes("char-visible-2");
    });

    expect(charSelect).toBeDefined();
    const options = Array.from(charSelect!.options).map((option) => ({
      value: option.value,
      label: (option.textContent ?? "").trim(),
    }));

    expect(options).toEqual([
      { value: "char-visible-1", label: "Yuki" },
      { value: "char-visible-2", label: "Unnamed" },
    ]);
    expect(charSelect?.value).toBe("char-visible-1");
  });

  it("keeps runtime memory settings aligned to the selected preset", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OtherBotSettings, { target });
    await flushUi();

    const messagesPerSummaryInput = getInputFollowingLabel("Messages Per Summary");
    expect(messagesPerSummaryInput).not.toBeNull();

    messagesPerSummaryInput!.value = "24";
    messagesPerSummaryInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const presetSettings = shared.dbState.db.memoryPresets?.[0]?.settings as Record<string, unknown> | undefined;
    expect(presetSettings?.periodicSummarizationInterval).toBe(24);
    expect(presetSettings?.maxChatsPerSummary).toBe(24);
  });

  it("writes the summarization prompt into the selected memory preset", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OtherBotSettings, { target });
    await flushUi();

    const promptInput = getInputFollowingLabel("Summarization Prompt");
    expect(promptInput).not.toBeNull();

    promptInput!.value = "Prompt from settings UI";
    promptInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const presetSettings = shared.dbState.db.memoryPresets?.[0]?.settings as Record<string, unknown> | undefined;
    expect(presetSettings?.summarizationPrompt).toBe("Prompt from settings UI");
  });

  it("keeps temporary empty number edits stable while slider updates commit through the selected preset", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OtherBotSettings, { target });
    await flushUi();

    const messagesPerSummaryInput = getInputFollowingLabel(
      "Messages Per Summary",
      'input[type="number"]',
    );
    const memoryRatioInput = getInputFollowingLabel("Memory ratio", 'input[type="range"]');

    expect(messagesPerSummaryInput).not.toBeNull();
    expect(memoryRatioInput).not.toBeNull();

    messagesPerSummaryInput!.value = "";
    messagesPerSummaryInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    expect(messagesPerSummaryInput!.value).toBe("");

    memoryRatioInput!.value = "0.72";
    memoryRatioInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const presetSettingsAfterSlider = shared.dbState.db.memoryPresets?.[0]?.settings as Record<
      string,
      unknown
    > | undefined;

    expect(messagesPerSummaryInput!.value).toBe("");
    expect(presetSettingsAfterSlider?.memoryTokensRatio).toBe(0.72);

    messagesPerSummaryInput!.value = "24";
    messagesPerSummaryInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const presetSettings = shared.dbState.db.memoryPresets?.[0]?.settings as Record<string, unknown> | undefined;
    expect(presetSettings?.periodicSummarizationInterval).toBe(24);
    expect(presetSettings?.maxChatsPerSummary).toBe(24);
  });

  it("shows Evolution as its own Other Bots page with separate defaults and prompt projection tabs", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OtherBotSettings, { target });
    await flushUi();

    const evolutionTab = document.querySelector(
      'button.ds-settings-tab[title="Evolution"]',
    ) as HTMLButtonElement | null;
    expect(evolutionTab).not.toBeNull();
    evolutionTab?.click();
    await flushUi();
    await flushUi();

    expect(document.body.textContent).toContain("Character Evolution Defaults");

    const innerTabs = Array.from(document.querySelectorAll('button.ds-settings-tab')) as HTMLButtonElement[];
    const globalDefaultsTab = innerTabs.find((button) => button.title === "Global Defaults");
    const promptProjectionTab = innerTabs.find((button) => button.title === "Prompt Projection");

    expect(globalDefaultsTab).toBeDefined();
    expect(promptProjectionTab).toBeDefined();
    expect(document.body.textContent).toContain("Extraction Runtime");
    expect(document.body.textContent).toContain("Default Sections");

    promptProjectionTab?.click();
    await flushUi();

    expect(document.body.textContent).toContain("Prompt Projection Policy");
    expect(document.body.textContent).toContain("Per-Section Limits");
    expect(document.body.textContent).not.toContain("Extraction Runtime");
    expect(document.body.textContent).not.toContain("Default Sections");
  });

  it("returns Evolution to the Global Defaults tab when the sidebar deep link requests it", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(OtherBotSettings, { target });
    await flushUi();

    const evolutionTab = document.querySelector(
      'button.ds-settings-tab[title="Evolution"]',
    ) as HTMLButtonElement | null;
    expect(evolutionTab).not.toBeNull();
    evolutionTab?.click();
    await flushUi();

    const promptProjectionTab = Array.from(
      document.querySelectorAll('button.ds-settings-tab'),
    ).find((button) => (button as HTMLButtonElement).title === "Prompt Projection") as
      | HTMLButtonElement
      | undefined;
    expect(promptProjectionTab).toBeDefined();

    promptProjectionTab?.click();
    await flushUi();

    expect(document.body.textContent).toContain("Prompt Projection Policy");
    expect(document.body.textContent).not.toContain("Extraction Runtime");

    EvolutionDefaultsSettingsTabIndex.set(0);
    await flushUi();

    expect(document.body.textContent).toContain("Extraction Runtime");
    expect(document.body.textContent).toContain("Default Sections");
    expect(document.body.textContent).not.toContain("Prompt Projection Policy");
  });
});
