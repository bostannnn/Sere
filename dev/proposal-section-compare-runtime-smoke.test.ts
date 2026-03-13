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

  it("keeps discarded item additions visible with dismissed row styling for migrated sections", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-1",
        section: createSection("activeThreads", "Active Threads", "list"),
        currentState: createState(),
        proposedState: createState({
          activeThreads: [
            {
              value: "Fresh lead",
              confidence: "likely",
              status: "active",
              note: "Carries into the next chat",
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

  it("keeps omitted archived items out of the main review diff while preserving changed active rows", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-3",
        section: createSection("characterLikes", "Character Likes", "facts"),
        currentState: createState({
          characterLikes: [
            {
              value: "Stalker",
              confidence: "confirmed",
              status: "active",
              note: "favorite",
            },
            {
              value: "Dead Man",
              confidence: "confirmed",
              status: "archived",
              note: "archived item",
            },
            {
              value: "Texas Chain Saw",
              confidence: "confirmed",
              status: "active",
              note: "still active",
            },
          ],
        }),
        proposedState: createState({
          characterLikes: [
            {
              value: "Stalker",
              confidence: "confirmed",
              status: "active",
              note: "favorite",
            },
            {
              value: "Texas Chain Saw",
              confidence: "confirmed",
              status: "active",
              note: "updated note",
            },
          ],
        }),
      },
    });

    await flushUi();

    const rows = Array.from(target.querySelectorAll(".proposal-diff-row")) as HTMLElement[];
    const texasRow = rows.find(
      (row) =>
        Array.from(row.querySelectorAll("input")).filter(
          (input) => (input as HTMLInputElement).value === "Texas Chain Saw",
        ).length === 2,
    );

    expect(texasRow).toBeDefined();
    expect(target.textContent).not.toContain("Dead Man");
    expect(target.textContent).not.toContain("Removed");
    expect(texasRow?.textContent).toContain("Changed");
    expect(
      Array.from(texasRow?.querySelectorAll("input") ?? []).map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["Texas Chain Saw", "Texas Chain Saw"]);
    expect(target.textContent).toContain("Show 1 unchanged");
  });

  it("keeps value edits on an existing fact item as a changed row instead of remove plus add", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-4",
        section: createSection("characterLikes", "Character Likes", "facts"),
        currentState: createState({
          characterLikes: [
            {
              value: "Coffee",
              confidence: "likely",
              status: "active",
              note: "old note",
            },
          ],
        }),
        proposedState: createState({
          characterLikes: [
            {
              value: "Dark coffee",
              confidence: "likely",
              status: "active",
              note: "new note",
            },
          ],
        }),
      },
    });

    await flushUi();

    const rows = Array.from(target.querySelectorAll(".proposal-diff-row")) as HTMLElement[];

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Changed");
    expect(rows[0]?.textContent).not.toContain("Removed");
    expect(rows[0]?.textContent).not.toContain("Added");
    expect(
      Array.from(rows[0]?.querySelectorAll("input") ?? []).map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["Coffee", "Dark coffee"]);
  });

  it("keeps omitted corrected items out of the main review diff while preserving changed active rows", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-5",
        section: createSection("activeThreads", "Active Threads", "list"),
        currentState: createState({
          activeThreads: [
            {
              value: "old corrected thread",
              confidence: "confirmed",
              status: "corrected",
              note: "superseded reading",
            },
            {
              value: "current active thread",
              confidence: "confirmed",
              status: "active",
              note: "still live",
            },
          ],
        }),
        proposedState: createState({
          activeThreads: [
            {
              value: "current active thread",
              confidence: "confirmed",
              status: "active",
              note: "updated live note",
            },
          ],
        }),
      },
    });

    await flushUi();

    const rows = Array.from(target.querySelectorAll(".proposal-diff-row")) as HTMLElement[];
    const activeRow = rows.find(
      (row) =>
        Array.from(row.querySelectorAll("input")).filter(
          (input) => (input as HTMLInputElement).value === "current active thread",
        ).length === 2,
    );

    expect(activeRow).toBeDefined();
    expect(target.textContent).not.toContain("old corrected thread");
    expect(target.textContent).not.toContain("Removed");
    expect(activeRow?.textContent).toContain("Changed");
    expect(target.textContent).not.toContain("Show");
  });

  it("pairs same-value coexistence cases against the active row and keeps archived history out of the main diff", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-6",
        section: createSection("characterLikes", "Character Likes", "facts"),
        currentState: createState({
          characterLikes: [
            {
              value: "Dead Man",
              confidence: "confirmed",
              status: "archived",
              note: "older archived formulation",
            },
            {
              value: "Dead Man",
              confidence: "confirmed",
              status: "active",
              note: "current live formulation",
            },
          ],
        }),
        proposedState: createState({
          characterLikes: [
            {
              value: "Dead Man",
              confidence: "confirmed",
              status: "active",
              note: "current live formulation updated",
            },
          ],
        }),
      },
    });

    await flushUi();

    const rows = Array.from(target.querySelectorAll(".proposal-diff-row")) as HTMLElement[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Changed");
    expect(rows[0]?.textContent).not.toContain("Removed");
    expect(
      Array.from(rows[0]?.querySelectorAll("input") ?? []).map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["Dead Man", "Dead Man"]);
    expect(target.textContent).not.toContain("older archived formulation");
  });

  it("pairs same-value coexistence cases against the active row and keeps corrected history out of the main diff", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(ProposalSectionCompare, {
      target,
      props: {
        proposalId: "proposal-7",
        section: createSection("activeThreads", "Active Threads", "list"),
        currentState: createState({
          activeThreads: [
            {
              value: "user hates ferries",
              confidence: "confirmed",
              status: "corrected",
              note: "older corrected formulation",
            },
            {
              value: "user hates ferries",
              confidence: "confirmed",
              status: "active",
              note: "current live formulation",
            },
          ],
        }),
        proposedState: createState({
          activeThreads: [
            {
              value: "user hates ferries",
              confidence: "confirmed",
              status: "active",
              note: "current live formulation updated",
            },
          ],
        }),
      },
    });

    await flushUi();

    const rows = Array.from(target.querySelectorAll(".proposal-diff-row")) as HTMLElement[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Changed");
    expect(rows[0]?.textContent).not.toContain("Removed");
    expect(
      Array.from(rows[0]?.querySelectorAll("input") ?? []).map(
        (input) => (input as HTMLInputElement).value,
      ),
    ).toEqual(["user hates ferries", "user hates ferries"]);
    expect(target.textContent).not.toContain("older corrected formulation");
  });
});
