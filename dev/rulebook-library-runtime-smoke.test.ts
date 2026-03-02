import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { mount, tick, unmount } from "svelte";

type MockRulebook = {
  id: string;
  name: string;
  chunkCount?: number;
  priority?: number;
  metadata?: {
    system?: string;
    edition?: string;
  };
};

const mocks = vi.hoisted(() => ({
  rulebooks: [] as MockRulebook[],
  updateRulebookMetadata: vi.fn(async () => null as MockRulebook | null),
  deleteRulebook: vi.fn(async () => {}),
  batchIngest: vi.fn(async () => {}),
  cancelIngestion: vi.fn(),
  openRulebookManager: null as {
    set: (value: boolean) => void;
    subscribe: (run: (value: boolean) => void) => () => void;
  } | null,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const openRulebookManager = writable(true);
  mocks.openRulebookManager = openRulebookManager;

  return {
    DBState: {
      db: {
        globalRagSettings: {
          model: "nomic-embed-text",
          topK: 3,
          minScore: 0.4,
          budget: 1200,
        },
        characters: [
          {
            ragSettings: {
              enabledRulebooks: [] as string[],
            },
          },
        ],
      },
    },
    openRulebookManager,
    ragProgressStore: writable({
      active: false,
      status: "idle",
      file: "",
      percent: 0,
      current: 0,
      total: 0,
      currentFileIndex: 0,
      totalFiles: 0,
    }),
  };
});

vi.mock(import("src/ts/process/rag/rag"), () => ({
  rulebookRag: {
    batchIngest: mocks.batchIngest,
    cancelIngestion: mocks.cancelIngestion,
  },
}));

vi.mock(import("src/ts/process/rag/storage"), () => ({
  rulebookStorage: {
    listRulebooks: async () => mocks.rulebooks.map((book) => ({ ...book })),
    deleteRulebook: mocks.deleteRulebook,
    updateRulebookMetadata: async (
      id: string,
      name?: string,
      metadata?: { system?: string; edition?: string },
      priority?: number,
    ) => {
      mocks.updateRulebookMetadata(id, name, metadata, priority);
      const index = mocks.rulebooks.findIndex((book) => book.id === id);
      if (index === -1) {
        return null;
      }
      const current = mocks.rulebooks[index];
      const next: MockRulebook = {
        ...current,
        name: name ?? current.name,
        metadata: metadata ? { ...current.metadata, ...metadata } : current.metadata,
        priority: typeof priority === "number" ? priority : current.priority,
      };
      mocks.rulebooks[index] = next;
      return { ...next };
    },
  },
}));

vi.mock(import("src/ts/util"), () => ({
  selectMultipleFile: async () => [],
}));

vi.mock(import("src/ts/alert"), async () => {
  const { writable } = await import("svelte/store");
  return {
    alertStore: writable({ type: "none", msg: "" }),
  };
});

import RulebookLibrary from "src/lib/Others/RulebookManager/RulebookLibrary.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("rulebook library runtime smoke", () => {
  beforeEach(() => {
    if (!("animate" in Element.prototype)) {
      Object.defineProperty(Element.prototype, "animate", {
        writable: true,
        configurable: true,
        value: () => ({
          finished: Promise.resolve(),
          cancel: () => {},
          play: () => {},
          onfinish: null,
        }),
      });
    }
    mocks.rulebooks = [];
    mocks.updateRulebookMetadata.mockClear();
    mocks.deleteRulebook.mockClear();
    mocks.batchIngest.mockClear();
    mocks.cancelIngestion.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps library shell controls on shared list/tab/action/panel primitives", async () => {
    mocks.rulebooks = [
      {
        id: "rb-1",
        name: "Vampire Core",
        chunkCount: 12,
        metadata: { system: "VtM", edition: "5e" },
      },
    ];

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, { target });
    await flushUi();

    const systemList = target.querySelector('[data-testid="rulebook-library-system-list"]') as HTMLElement | null;
    expect(systemList).not.toBeNull();
    expect(systemList?.classList.contains("list-shell")).toBe(true);

    const toolbarActions = target.querySelector(
      '[data-testid="rulebook-library-toolbar-actions"]',
    ) as HTMLElement | null;
    expect(toolbarActions).not.toBeNull();
    expect(toolbarActions?.classList.contains("action-rail")).toBe(true);

    const viewToggle = target.querySelector('[data-testid="rulebook-library-view-toggle"]') as HTMLElement | null;
    expect(viewToggle).not.toBeNull();
    expect(viewToggle?.classList.contains("seg-tabs")).toBe(true);

    const toggleButtons = Array.from(
      target.querySelectorAll(".rag-view-toggle-btn.seg-tab"),
    ) as HTMLButtonElement[];
    expect(toggleButtons.length).toBe(2);
    expect(toggleButtons[0]?.getAttribute("aria-label")).toBe("Grid view");
    expect(toggleButtons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(toggleButtons[1]?.getAttribute("aria-label")).toBe("List view");
    expect(toggleButtons[1]?.getAttribute("aria-pressed")).toBe("false");
    toggleButtons[1]?.click();
    await flushUi();
    expect(toggleButtons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(toggleButtons[1]?.getAttribute("aria-pressed")).toBe("true");

    const systemToggle = target.querySelector(".rag-tree-toggle.icon-btn.icon-btn--sm") as HTMLButtonElement | null;
    expect(systemToggle).not.toBeNull();
    expect(systemToggle?.getAttribute("aria-expanded")).toBe("false");
    systemToggle?.click();
    await flushUi();
    expect(systemToggle?.getAttribute("aria-expanded")).toBe("true");

    const contentArea = target.querySelector(".rag-content-area") as HTMLElement | null;
    expect(contentArea?.classList.contains("is-list")).toBe(true);
    expect(contentArea?.classList.contains("list-shell")).toBe(true);

    const card = target.querySelector(".ds-settings-card.panel-shell.rag-book-card") as HTMLElement | null;
    expect(card).not.toBeNull();

    const actions = target.querySelector('[data-testid="rulebook-library-book-actions"]') as HTMLElement | null;
    expect(actions).not.toBeNull();
    expect(actions?.classList.contains("action-rail")).toBe(true);

    const priorityButton = target.querySelector(
      ".rag-book-action-btn",
    ) as HTMLButtonElement | null;
    expect(priorityButton).not.toBeNull();
    priorityButton?.click();
    await flushUi();
    expect(mocks.updateRulebookMetadata).toHaveBeenCalled();
  });

  it("keeps empty-state primitive and close behavior stable", async () => {
    mocks.rulebooks = [];

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, { target });
    await flushUi();

    const empty = target.querySelector('[data-testid="rulebook-library-empty-state"]') as HTMLElement | null;
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains("panel-shell")).toBe(true);
    expect(empty?.classList.contains("empty-state")).toBe(true);

    const closeButton = target.querySelector("#rulebook-library-close") as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    expect(closeButton?.getAttribute("aria-label")).toBe("Close rulebook library");
    expect(closeButton?.getAttribute("title")).toBe("Close rulebook library");
    closeButton?.click();
    await flushUi();

    expect(mocks.openRulebookManager).not.toBeNull();
    expect(get(mocks.openRulebookManager!)).toBe(false);
  });
});
