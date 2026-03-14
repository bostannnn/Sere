import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/TextInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/TextAreaInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/SelectInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/OptionInputStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ButtonStub.svelte")).default,
}));

import EvolutionStatePanel from "src/lib/SideBars/Evolution/EvolutionStatePanel.svelte";
import EvolutionHistoryPanel from "src/lib/SideBars/Evolution/EvolutionHistoryPanel.svelte";
import EvolutionStatePanelHarness from "./test-stubs/EvolutionStatePanelHarness.svelte";
import type {
  CharacterEvolutionSectionConfig,
  CharacterEvolutionState,
  CharacterEvolutionVersionMeta,
} from "src/ts/storage/database.types";

let app: Record<string, unknown> | undefined;

function createState(overrides: Partial<CharacterEvolutionState> = {}): CharacterEvolutionState {
  return {
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
    ...overrides,
  };
}

function createSection(
  key: CharacterEvolutionSectionConfig["key"],
  label: string,
  kind: CharacterEvolutionSectionConfig["kind"],
): CharacterEvolutionSectionConfig {
  return {
    key,
    label,
    kind,
    enabled: true,
    includeInPrompt: true,
    instruction: "",
    sensitive: false,
  };
}

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("evolution state panel runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("shows only active items in the main current-state view", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionStatePanel, {
      target,
      props: {
        hasPendingProposal: false,
        currentStateDraft: createState({
          activeThreads: [
            {
              value: "keep the live lead",
              status: "active",
              confidence: "likely",
              note: "Still unresolved",
            },
            {
              value: "old archived thread",
              status: "archived",
              confidence: "suspected",
              note: "Should stay hidden",
            },
            {
              value: "old corrected thread",
              status: "corrected",
              confidence: "confirmed",
              note: "Should stay hidden too",
            },
          ],
        }),
        sectionConfigs: [
          createSection("activeThreads", "Active Threads", "list"),
        ],
        privacy: {
          allowCharacterIntimatePreferences: false,
          allowUserIntimatePreferences: false,
        },
        onPersist: () => {},
      },
    });

    await flushUi();

    const renderedValues = Array.from(target.querySelectorAll("input, textarea"))
      .map((element) => (element as HTMLInputElement | HTMLTextAreaElement).value);

    expect(renderedValues).toContain("keep the live lead");
    expect(renderedValues).not.toContain("old archived thread");
    expect(renderedValues).not.toContain("old corrected thread");
  });

  it("preserves hidden archived and corrected items when editing a visible active row", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(EvolutionStatePanelHarness, {
      target,
      props: {
        initialState: createState({
          activeThreads: [
            {
              value: "keep the live lead",
              status: "active",
              confidence: "likely",
              note: "Still unresolved",
            },
            {
              value: "old archived thread",
              status: "archived",
              confidence: "suspected",
              note: "Should stay hidden",
            },
            {
              value: "old corrected thread",
              status: "corrected",
              confidence: "confirmed",
              note: "Should stay hidden too",
            },
          ],
        }),
        sectionConfigs: [
          createSection("activeThreads", "Active Threads", "list"),
        ],
      },
    });

    await flushUi();

    const noteField = target.querySelector('textarea[placeholder="Note"]') as HTMLTextAreaElement | null;
    expect(noteField).not.toBeNull();
    noteField!.value = "Updated active note";
    noteField!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const stateJson = target.querySelector('[data-testid="current-state-json"]')?.textContent;
    expect(stateJson).toBeTruthy();

    const nextState = JSON.parse(stateJson!) as CharacterEvolutionState;
    expect(nextState.activeThreads).toEqual([
      {
        value: "keep the live lead",
        status: "active",
        confidence: "likely",
        note: "Updated active note",
      },
      {
        value: "old archived thread",
        status: "archived",
        confidence: "suspected",
        note: "Should stay hidden",
      },
      {
        value: "old corrected thread",
        status: "corrected",
        confidence: "confirmed",
        note: "Should stay hidden too",
      },
    ]);
  });

  it("shows archived and corrected items in the mounted history version view", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const stateVersions: CharacterEvolutionVersionMeta[] = [
      {
        version: 3,
        chatId: "chat-1",
        acceptedAt: 1234,
        range: {
          chatId: "chat-1",
          startMessageIndex: 144,
          endMessageIndex: 167,
        },
      },
    ];

    app = mount(EvolutionHistoryPanel, {
      target,
      props: {
        stateVersions,
        loadingVersions: false,
        selectedVersion: 3,
        selectedVersionState: createState({
          activeThreads: [
            {
              value: "still active thread",
              status: "active",
              confidence: "likely",
              note: "Current",
            },
            {
              value: "resolved archived thread",
              status: "archived",
              confidence: "confirmed",
              note: "History only",
            },
            {
              value: "replaced corrected thread",
              status: "corrected",
              confidence: "confirmed",
              note: "Superseded",
            },
          ],
        }),
        selectedVersionSectionConfigs: [
          createSection("activeThreads", "Active Threads", "list"),
        ],
        selectedVersionPrivacy: {
          allowCharacterIntimatePreferences: false,
          allowUserIntimatePreferences: false,
        },
        onRefresh: () => {},
        onLoadVersion: () => {},
      },
    });

    await flushUi();

    expect(target.textContent).toContain("Messages 145-168");

    const renderedValues = Array.from(target.querySelectorAll("input, textarea"))
      .map((element) => (element as HTMLInputElement | HTMLTextAreaElement).value);

    expect(renderedValues).toContain("still active thread");
    expect(renderedValues).toContain("resolved archived thread");
    expect(renderedValues).toContain("replaced corrected thread");
  });
});
