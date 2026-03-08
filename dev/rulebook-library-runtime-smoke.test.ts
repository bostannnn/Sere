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
  selectMultipleFile: vi.fn(async () => [] as Array<{ name: string; data: Uint8Array }>),
  updateRulebookMetadata: vi.fn(async () => null as MockRulebook | null),
  deleteRulebook: vi.fn(async () => {}),
  batchIngest: vi.fn(async () => {}),
  cancelIngestion: vi.fn(),
  ragProgressStore: null as {
    set: (value: {
      active: boolean;
      status: string;
      file: string;
      percent: number;
      current: number;
      total: number;
      currentFileIndex: number;
      totalFiles: number;
    }) => void;
    subscribe: (run: (value: unknown) => void) => () => void;
  } | null,
  openRulebookManager: null as {
    set: (value: boolean) => void;
    subscribe: (run: (value: boolean) => void) => () => void;
  } | null,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const openRulebookManager = writable(true);
  const ragProgressStore = writable({
    active: false,
    status: "idle",
    file: "",
    percent: 0,
    current: 0,
    total: 0,
    currentFileIndex: 0,
    totalFiles: 0,
  });
  mocks.openRulebookManager = openRulebookManager;
  mocks.ragProgressStore = ragProgressStore;

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
    ragProgressStore,
    selIdState: { selId: 0 },
    selectedCharID: writable(0),
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
  selectMultipleFile: mocks.selectMultipleFile,
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
    mocks.selectMultipleFile.mockClear();
    mocks.updateRulebookMetadata.mockClear();
    mocks.deleteRulebook.mockClear();
    mocks.batchIngest.mockClear();
    mocks.cancelIngestion.mockClear();
    mocks.ragProgressStore?.set({
      active: false,
      status: "idle",
      file: "",
      percent: 0,
      current: 0,
      total: 0,
      currentFileIndex: 0,
      totalFiles: 0,
    });
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps legacy library controls and list/tab/action primitives stable", async () => {
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

  it("uses shell mode with no internal header/toolbar and drawer tabs", async () => {
    mocks.rulebooks = [
      {
        id: "rb-1",
        name: "Vampire Core",
        chunkCount: 12,
        metadata: { system: "VtM", edition: "5e" },
      },
    ];

    let shellActions: {
      selectFiles: () => Promise<void>;
      setSystemFilter: (system: string) => void;
      setEditionFilter: (system: string, edition: string) => void;
      clearFilters: () => void;
      getFilterSnapshot: () => {
        systems: string[];
        editionsBySystem: Record<string, string[]>;
        selectedSystem: string;
        selectedEdition: string;
      };
    } | null = null;
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, {
      target,
      props: {
        useShellChrome: true,
        rightSidebarOpen: true,
        rightSidebarTab: "library",
        registerShellActions: (actions) => {
          shellActions = actions;
        },
      },
    });
    await flushUi();

    expect(target.querySelector(".rag-dashboard-header")).toBeNull();
    expect(target.querySelector('[data-testid="rulebook-library-toolbar-actions"]')).toBeNull();
    expect(target.querySelector("#rulebook-library-close")).toBeNull();

    const drawer = target.querySelector('[data-testid="rulebook-right-sidebar-drawer"]') as HTMLElement | null;
    expect(drawer).not.toBeNull();
    expect(drawer?.classList.contains("drawer-elevation--right")).toBe(true);

    const tabs = target.querySelector(".ds-chat-right-panel-tabs.seg-tabs") as HTMLElement | null;
    expect(tabs).not.toBeNull();
    const libraryTab = target.querySelector('[data-testid="rulebook-sidebar-tab-library"]') as HTMLButtonElement | null;
    const settingsTab = target.querySelector('[data-testid="rulebook-sidebar-tab-settings"]') as HTMLButtonElement | null;
    expect(libraryTab).not.toBeNull();
    expect(settingsTab).not.toBeNull();
    expect(libraryTab?.getAttribute("aria-selected")).toBe("true");

    const libraryPane = target.querySelector('[data-testid="rulebook-sidebar-pane-library"]') as HTMLElement | null;
    expect(libraryPane).not.toBeNull();
    expect(libraryPane?.querySelector('[data-testid="rulebook-library-system-list"]')).not.toBeNull();

    settingsTab!.click();
    await flushUi();
    const settingsPane = target.querySelector('[data-testid="rulebook-sidebar-pane-settings"]') as HTMLElement | null;
    expect(settingsPane).not.toBeNull();

    expect(shellActions).not.toBeNull();
    await shellActions!.selectFiles();
    expect(mocks.selectMultipleFile).toHaveBeenCalledTimes(1);
  });

  it("supports mobile shell filter actions and disables drawer-only desktop affordances", async () => {
    mocks.rulebooks = [
      {
        id: "rb-1",
        name: "Vampire Core",
        thumbnail: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9xWJ5+wAAAABJRU5ErkJggg==",
        chunkCount: 12,
        metadata: { system: "VtM", edition: "5e" },
      },
      {
        id: "rb-2",
        name: "D&D Core",
        chunkCount: 8,
        metadata: { system: "DnD", edition: "2024" },
      },
    ];

    let shellActions: {
      selectFiles: () => Promise<void>;
      setSystemFilter: (system: string) => void;
      setEditionFilter: (system: string, edition: string) => void;
      clearFilters: () => void;
      getFilterSnapshot: () => {
        systems: string[];
        editionsBySystem: Record<string, string[]>;
        selectedSystem: string;
        selectedEdition: string;
      };
    } | null = null;

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, {
      target,
      props: {
        useShellChrome: true,
        isMobileShell: true,
        viewMode: "grid",
        registerShellActions: (actions) => {
          shellActions = actions;
        },
      },
    });
    await flushUi();

    expect(target.querySelector('[data-testid="rulebook-right-sidebar-drawer"]')).toBeNull();
    expect(target.querySelector(".rag-content-area.is-grid")).not.toBeNull();

    const thumb = target.querySelector(".rag-book-thumb") as Element | null;
    expect(thumb).not.toBeNull();
    expect(thumb?.getAttribute("draggable")).toBe("false");

    expect(shellActions).not.toBeNull();
    const initial = shellActions!.getFilterSnapshot();
    expect(initial.selectedSystem).toBe("All");
    expect(initial.selectedEdition).toBe("All");
    expect(initial.systems.length).toBeGreaterThan(0);

    shellActions!.setSystemFilter("VtM");
    await flushUi();
    const systemFiltered = shellActions!.getFilterSnapshot();
    expect(systemFiltered.selectedSystem).toBe("VtM");
    expect(systemFiltered.selectedEdition).toBe("All");

    shellActions!.setEditionFilter("VtM", "5e");
    await flushUi();
    const editionFiltered = shellActions!.getFilterSnapshot();
    expect(editionFiltered.selectedSystem).toBe("VtM");
    expect(editionFiltered.selectedEdition).toBe("5e");

    shellActions!.clearFilters();
    await flushUi();
    const reset = shellActions!.getFilterSnapshot();
    expect(reset.selectedSystem).toBe("All");
    expect(reset.selectedEdition).toBe("All");
  });

  it("shows loading state on initial render and avoids empty-state flash", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, { target });

    const loading = target.querySelector('[data-testid="rulebook-library-loading-state"]') as HTMLElement | null;
    const empty = target.querySelector('[data-testid="rulebook-library-empty-state"]') as HTMLElement | null;
    expect(loading).not.toBeNull();
    expect(empty).toBeNull();
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

  it("stages selected files and starts server-side ingestion from the drawer", async () => {
    mocks.selectMultipleFile.mockResolvedValueOnce([
      { name: "alpha.pdf", data: new Uint8Array([1, 2, 3]) },
      { name: "beta.md", data: new Uint8Array([4, 5]) },
    ]);

    let shellActions: {
      selectFiles: () => Promise<void>;
      setSystemFilter: (system: string) => void;
      setEditionFilter: (system: string, edition: string) => void;
      clearFilters: () => void;
      getFilterSnapshot: () => {
        systems: string[];
        editionsBySystem: Record<string, string[]>;
        selectedSystem: string;
        selectedEdition: string;
      };
    } | null = null;

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, {
      target,
      props: {
        useShellChrome: true,
        registerShellActions: (actions) => {
          shellActions = actions;
        },
      },
    });
    await flushUi();

    expect(shellActions).not.toBeNull();
    await shellActions!.selectFiles();
    await flushUi();

    const stagingDrawer = target.querySelector(".rag-staging-drawer") as HTMLElement | null;
    expect(stagingDrawer).not.toBeNull();
    expect(stagingDrawer?.textContent).toContain("2 files pending");
    expect(stagingDrawer?.textContent).toContain("alpha.pdf");
    expect(stagingDrawer?.textContent).toContain("beta.md");

    const startButton = Array.from(stagingDrawer?.querySelectorAll("button") ?? []).find((button) =>
      button.textContent?.includes("Start Ingestion"),
    ) as HTMLButtonElement | undefined;
    expect(startButton).toBeDefined();

    startButton?.click();
    await flushUi();

    expect(mocks.batchIngest).toHaveBeenCalledTimes(1);
    expect(mocks.batchIngest).toHaveBeenCalledWith([
      { name: "alpha.pdf", data: new Uint8Array([1, 2, 3]), system: "", edition: "" },
      { name: "beta.md", data: new Uint8Array([4, 5]), system: "", edition: "" },
    ]);
    const closingDrawer = target.querySelector(".rag-staging-drawer") as HTMLElement | null;
    expect(closingDrawer?.getAttribute("inert")).toBe("");
  });

  it("routes the progress toast cancel action to rulebookRag.cancelIngestion", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RulebookLibrary, { target });
    await flushUi();

    mocks.ragProgressStore?.set({
      active: true,
      status: "embedding",
      file: "rules.pdf",
      percent: 0,
      current: 3,
      total: 10,
      currentFileIndex: 1,
      totalFiles: 2,
    });
    await flushUi();

    const cancelButton = target.querySelector(".rag-status-cancel") as HTMLButtonElement | null;
    expect(cancelButton).not.toBeNull();

    cancelButton?.click();
    await flushUi();

    expect(mocks.cancelIngestion).toHaveBeenCalledTimes(1);
  });
});
