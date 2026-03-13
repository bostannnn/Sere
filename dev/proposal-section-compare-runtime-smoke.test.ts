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

import ProposalSectionCompare from "src/lib/Evolution/ProposalSectionCompare.svelte";
import type {
  CharacterEvolutionSectionConfig,
  CharacterEvolutionState,
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

describe("proposal section compare runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps discarded string additions visible with dismissed row styling", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-1",
        section: createSection("activeThreads", "Active Threads", "list"),
        currentState: createState(),
        proposedState: createState({
          activeThreads: ["Fresh lead"],
        }),
      },
    });

    await flushUi();

    const discardButton = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Discard addition"),
    ) as HTMLButtonElement | undefined;

    expect(discardButton).toBeDefined();
    discardButton?.click();
    await flushUi();

    const row = target.querySelector(".proposal-diff-row") as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.className).toContain("proposal-diff-row--dismissed");
    expect(row?.className).not.toContain("proposal-diff-row--added");
    expect(target.textContent).toContain("Addition discarded.");
  });

  it("keeps discarded fact additions visible with dismissed row styling", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-2",
        section: createSection("characterLikes", "Character Likes", "facts"),
        currentState: createState(),
        proposedState: createState({
          characterLikes: [
            {
              value: "Coffee",
              confidence: "likely",
              status: "active",
              note: "Mentioned repeatedly",
            },
          ],
        }),
      },
    });

    await flushUi();

    const discardButton = Array.from(target.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Discard addition"),
    ) as HTMLButtonElement | undefined;

    expect(discardButton).toBeDefined();
    discardButton?.click();
    await flushUi();

    const row = target.querySelector(".proposal-diff-row") as HTMLElement | null;
    expect(row).not.toBeNull();
    expect(row?.className).toContain("proposal-diff-row--dismissed");
    expect(row?.className).not.toContain("proposal-diff-row--added");
    expect(target.textContent).toContain("Addition discarded.");
  });
});
