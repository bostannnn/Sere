import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

type MockRulebook = {
  id: string;
  name: string;
  chunkCount?: number;
};

const hoisted = vi.hoisted(() => ({
  mockRulebooks: [] as MockRulebook[],
  shared: {
    DBState: {
      db: {
        characters: [
          {
            ragSettings: {
              enabled: false,
              enabledRulebooks: [] as string[],
            },
          },
        ],
      },
    },
    selIdState: { selId: 0 },
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: hoisted.shared.DBState,
    selIdState: hoisted.shared.selIdState,
    ragLastResult: writable({
      query: "last query",
      results: [],
    }),
    alertStore: writable({ type: "none", msg: "" }),
  };
});

vi.mock(import("src/ts/process/rag/storage"), () => ({
  rulebookStorage: {
    listRulebooks: async () => hoisted.mockRulebooks,
  },
}));

import RulebookRagSetting from "src/lib/SideBars/LoreBook/RulebookRagSetting.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function remountRulebookRagSetting(target: HTMLElement) {
  if (app) {
    await unmount(app);
  }
  target.innerHTML = "";
  app = mount(RulebookRagSetting, { target });
  await flushUi();
}

describe("rulebook rag setting runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    hoisted.mockRulebooks = [];
    const ragSettings = hoisted.shared.DBState.db.characters[0].ragSettings;
    ragSettings.enabled = false;
    ragSettings.enabledRulebooks = [];
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("uses list and empty-state primitives for rulebooks and retrieval results", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    await remountRulebookRagSetting(target);

    const list = document.querySelector('[data-testid="rulebook-rag-list"]') as HTMLElement | null;
    const empty = document.querySelector('[data-testid="rulebook-rag-empty"]') as HTMLElement | null;
    const results = document.querySelector('[data-testid="rulebook-rag-result-list"]') as HTMLElement | null;
    const resultEmpty = document.querySelector('[data-testid="rulebook-rag-result-empty"]') as HTMLElement | null;

    expect(list).not.toBeNull();
    expect(list?.classList.contains("list-shell")).toBe(true);
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains("empty-state")).toBe(true);

    expect(results).not.toBeNull();
    expect(results?.classList.contains("list-shell")).toBe(true);
    expect(resultEmpty).not.toBeNull();
    expect(resultEmpty?.classList.contains("empty-state")).toBe(true);
  });

  it("uses action rail primitive and toggles a rulebook", async () => {
    hoisted.mockRulebooks = [{ id: "rb-1", name: "Rulebook One", chunkCount: 12 }];

    const target = document.createElement("div");
    document.body.appendChild(target);

    await remountRulebookRagSetting(target);

    const actions = document.querySelector('[data-testid="rulebook-rag-actions"]') as HTMLElement | null;
    expect(actions).not.toBeNull();
    expect(actions?.classList.contains("action-rail")).toBe(true);

    const toggleButton = actions?.querySelector("button") as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.classList.contains("icon-btn")).toBe(true);
    expect(toggleButton?.classList.contains("icon-btn--sm")).toBe(true);
    expect(toggleButton?.getAttribute("aria-pressed")).toBe("false");
    expect(toggleButton?.textContent?.trim()).not.toContain("Select");

    const rulebookCard = document.querySelector(
      ".ds-settings-card.panel-shell.rag-rulebook-item",
    ) as HTMLElement | null;
    expect(rulebookCard).not.toBeNull();
    expect(rulebookCard?.textContent).not.toContain("chunks");
    expect(rulebookCard?.textContent).not.toContain("Tap to include this book");

    toggleButton?.click();
    await flushUi();

    expect(hoisted.shared.DBState.db.characters[0].ragSettings.enabledRulebooks).toContain("rb-1");
    await remountRulebookRagSetting(target);

    const remountedToggleButton = document.querySelector('[data-testid="rulebook-rag-actions"] button') as HTMLButtonElement | null;
    const remountedRulebookCard = document.querySelector(
      ".ds-settings-card.panel-shell.rag-rulebook-item",
    ) as HTMLElement | null;
    expect(remountedToggleButton?.getAttribute("aria-pressed")).toBe("true");
    expect(remountedToggleButton?.textContent?.trim()).not.toContain("Selected");
    expect(remountedRulebookCard?.getAttribute("data-selected")).toBe("1");
    expect(remountedRulebookCard?.textContent).toContain("Included in chat");

    remountedToggleButton?.click();
    await flushUi();

    expect(hoisted.shared.DBState.db.characters[0].ragSettings.enabledRulebooks).toEqual([]);
    await remountRulebookRagSetting(target);

    const resetToggleButton = document.querySelector('[data-testid="rulebook-rag-actions"] button') as HTMLButtonElement | null;
    const resetRulebookCard = document.querySelector(
      ".ds-settings-card.panel-shell.rag-rulebook-item",
    ) as HTMLElement | null;
    expect(resetToggleButton?.getAttribute("aria-pressed")).toBe("false");
    expect(resetRulebookCard?.getAttribute("data-selected")).toBe("0");
  });

  it("prunes stale selections and clears the list", async () => {
    hoisted.mockRulebooks = [
      { id: "rb-1", name: "Rulebook One", chunkCount: 12 },
      { id: "rb-2", name: "Rulebook Two", chunkCount: 24 },
    ];
    hoisted.shared.DBState.db.characters[0].ragSettings.enabled = false;
    hoisted.shared.DBState.db.characters[0].ragSettings.enabledRulebooks = ["rb-1", "missing-book"];

    const target = document.createElement("div");
    document.body.appendChild(target);

    await remountRulebookRagSetting(target);

    expect(hoisted.shared.DBState.db.characters[0].ragSettings.enabledRulebooks).toEqual(["rb-1"]);

    await remountRulebookRagSetting(target);

    const summary = document.querySelector('[data-testid="rulebook-rag-summary"]') as HTMLElement | null;
    expect(summary?.textContent).toContain("1 of 2 selected");

    const clearButton = target.querySelector(".rag-summary-action") as HTMLButtonElement | null;
    expect(clearButton?.textContent).toContain("Clear all");

    clearButton?.click();
    await flushUi();

    expect(hoisted.shared.DBState.db.characters[0].ragSettings.enabledRulebooks).toEqual([]);
    await remountRulebookRagSetting(target);
    const resetSummary = document.querySelector('[data-testid="rulebook-rag-summary"]') as HTMLElement | null;
    expect(resetSummary?.textContent).toContain("0 of 2 selected");
  });
});
