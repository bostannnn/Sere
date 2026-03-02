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

    app = mount(RulebookRagSetting, { target });
    await flushUi();

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

    app = mount(RulebookRagSetting, { target });
    await flushUi();

    const actions = document.querySelector('[data-testid="rulebook-rag-actions"]') as HTMLElement | null;
    expect(actions).not.toBeNull();
    expect(actions?.classList.contains("action-rail")).toBe(true);

    const toggleButton = actions?.querySelector("button") as HTMLButtonElement | null;
    expect(toggleButton).not.toBeNull();
    expect(toggleButton?.classList.contains("icon-btn")).toBe(true);
    expect(toggleButton?.classList.contains("icon-btn--sm")).toBe(true);

    const rulebookCard = document.querySelector(
      ".ds-settings-card.panel-shell.rag-rulebook-item",
    ) as HTMLElement | null;
    expect(rulebookCard).not.toBeNull();

    toggleButton?.click();
    await flushUi();

    expect(hoisted.shared.DBState.db.characters[0].ragSettings.enabledRulebooks).toContain("rb-1");
  });
});
