import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ButtonStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/CheckInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
  default: (await import("./test-stubs/NumberInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OpenRouterModelSelect.svelte"), async () => ({
  default: (await import("./test-stubs/BindableTextInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableTextAreaStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableTextInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/ModelList.svelte"), async () => ({
  default: (await import("./test-stubs/BindableTextInputStub.svelte")).default,
}));

import EvolutionSetupPanel from "src/lib/SideBars/Evolution/EvolutionSetupPanel.svelte";
import type {
  CharacterEvolutionProcessedRange,
  CharacterEvolutionSettings,
  character,
} from "src/ts/storage/database.types";

let app: Record<string, unknown> | undefined;

function createEvolutionSettings(): CharacterEvolutionSettings {
  return {
    enabled: true,
    useGlobalDefaults: true,
    extractionProvider: "openrouter",
    extractionModel: "",
    extractionMaxTokens: 2400,
    extractionPrompt: "",
    sectionConfigs: [],
    privacy: {
      allowCharacterIntimatePreferences: false,
      allowUserIntimatePreferences: false,
    },
    currentStateVersion: 0,
    currentState: {
      relationship: { trustLevel: "", dynamic: "" },
      activeThreads: [],
      runningJokes: [],
      characterLikes: [],
      characterDislikes: [],
      characterHabits: [],
      characterBoundariesPreferences: [],
      userFacts: [],
      userRead: [],
      userLikes: [],
      userDislikes: [],
      lastInteractionEnded: { state: "", residue: "" },
      keyMoments: [],
      characterIntimatePreferences: [],
      userIntimatePreferences: [],
    },
    stateVersions: [],
    processedRanges: [],
  };
}

function createCharacterEntry(): character {
  return {
    type: "character",
    name: "Test Character",
    firstMessage: "",
    desc: "",
    notes: "",
    chats: [],
    chatFolders: [],
    chatPage: 0,
    viewScreen: "none",
    bias: [],
    emotionImages: [],
    globalLore: [],
    chaId: "char-test",
    customscript: [],
    triggerscript: [],
    characterEvolution: createEvolutionSettings(),
  } as character;
}

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("evolution setup panel runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("shows accepted coverage for the current chat using 1-based message numbers", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const processedRanges: CharacterEvolutionProcessedRange[] = [
      {
        version: 1,
        acceptedAt: 1710000000000,
        range: {
          chatId: "chat-1",
          startMessageIndex: 0,
          endMessageIndex: 11,
        },
      },
      {
        version: 2,
        acceptedAt: 1710000300000,
        range: {
          chatId: "chat-1",
          startMessageIndex: 12,
          endMessageIndex: 23,
        },
      },
      {
        version: 3,
        acceptedAt: 1710000600000,
        range: {
          chatId: "chat-2",
          startMessageIndex: 0,
          endMessageIndex: 4,
        },
      },
    ];

    app = mount(EvolutionSetupPanel, {
      target,
      props: {
        characterEntry: createCharacterEntry(),
        evolutionSettings: createEvolutionSettings(),
        usingGlobalDefaults: true,
        effectiveProvider: "openrouter",
        effectiveModel: "",
        hasTemplateSlot: true,
        activeChatId: "chat-1",
        activeChatMessageCount: 30,
        revealCharacterOverrides: false,
        onToggleRevealCharacterOverrides: () => {},
        onOpenGlobalDefaults: () => {},
        manualRangeAvailable: true,
        manualRangeBlockedReason: "",
        manualRangeBusy: false,
        onRunManualRange: () => {},
        replayCurrentChatAvailable: false,
        replayCurrentChatBusy: false,
        onReplayCurrentChat: () => {},
        processedRanges,
      },
    });

    await flushUi();

    expect(target.textContent).toContain("Accepted Coverage");
    expect(target.textContent).toContain("Messages 1-12");
    expect(target.textContent).toContain("Messages 13-24");
    expect(target.textContent).toContain("Next unprocessed message: 25");
    expect(target.textContent).not.toContain("Messages 1-5");
  });

  it("derives the next unprocessed message from the first uncovered gap", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionSetupPanel, {
      target,
      props: {
        characterEntry: createCharacterEntry(),
        evolutionSettings: createEvolutionSettings(),
        usingGlobalDefaults: true,
        effectiveProvider: "openrouter",
        effectiveModel: "",
        hasTemplateSlot: true,
        activeChatId: "chat-1",
        activeChatMessageCount: 30,
        revealCharacterOverrides: false,
        onToggleRevealCharacterOverrides: () => {},
        onOpenGlobalDefaults: () => {},
        manualRangeAvailable: true,
        manualRangeBlockedReason: "",
        manualRangeBusy: false,
        onRunManualRange: () => {},
        replayCurrentChatAvailable: false,
        replayCurrentChatBusy: false,
        onReplayCurrentChat: () => {},
        processedRanges: [
          {
            version: 1,
            acceptedAt: 1710000000000,
            range: {
              chatId: "chat-1",
              startMessageIndex: 0,
              endMessageIndex: 11,
            },
          },
          {
            version: 2,
            acceptedAt: 1710000300000,
            range: {
              chatId: "chat-1",
              startMessageIndex: 20,
              endMessageIndex: 23,
            },
          },
        ],
      },
    });

    await flushUi();

    expect(target.textContent).toContain("Messages 1-12");
    expect(target.textContent).toContain("Messages 21-24");
    expect(target.textContent).toContain("Next unprocessed message: 13");
  });

  it("shows cursor-based fallback coverage when detailed range history is unavailable", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const evolutionSettings = createEvolutionSettings();
    evolutionSettings.lastProcessedMessageIndexByChat = {
      "chat-1": 167,
    };

    app = mount(EvolutionSetupPanel, {
      target,
      props: {
        characterEntry: createCharacterEntry(),
        evolutionSettings,
        usingGlobalDefaults: true,
        effectiveProvider: "openrouter",
        effectiveModel: "",
        hasTemplateSlot: true,
        activeChatId: "chat-1",
        activeChatMessageCount: 30,
        revealCharacterOverrides: false,
        onToggleRevealCharacterOverrides: () => {},
        onOpenGlobalDefaults: () => {},
        manualRangeAvailable: true,
        manualRangeBlockedReason: "",
        manualRangeBusy: false,
        onRunManualRange: () => {},
        replayCurrentChatAvailable: false,
        replayCurrentChatBusy: false,
        onReplayCurrentChat: () => {},
        processedRanges: [],
      },
    });

    await flushUi();

    expect(target.textContent).toContain("Accepted coverage exists through message 168");
    expect(target.textContent).toContain("Next unprocessed message: 169");
  });
});
