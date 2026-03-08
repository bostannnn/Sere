import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const db = {
    characters: [] as Array<Record<string, unknown>>,
    modules: [] as Array<Record<string, unknown>>,
    personas: [] as Array<Record<string, unknown>>,
    formatversion: 5,
    loreBookToken: 8000,
    characterOrder: [] as string[],
    mainPrompt: "custom-main-prompt",
    jailbreak: "old-jailbreak",
    customBackground: "",
    userIcon: "",
  };

  return {
    db,
    loadedStore: null as { set: (value: boolean) => void } | null,
  };
});

vi.mock("src/ts/storage/database.svelte", () => ({
  setDatabase: vi.fn(),
  getDatabase: vi.fn(() => shared.db),
}));

vi.mock("src/ts/stores.svelte", async () => {
  const { writable } = await import("svelte/store");
  const loadedStore = writable(false);
  shared.loadedStore = loadedStore;
  return {
    MobileGUI: writable(false),
    selectedCharID: writable(-1),
    loadedStore,
    DBState: { db: shared.db },
    LoadingStatusState: { text: "" },
  };
});

vi.mock("src/ts/alert", () => ({
  alertError: vi.fn(),
  alertMd: vi.fn(),
  alertTOS: vi.fn(async () => true),
  waitAlert: vi.fn(async () => {}),
}));

vi.mock("src/ts/storage/defaultPrompts", () => ({
  defaultJailbreak: "default-jailbreak",
  defaultMainPrompt: "default-main",
  oldJailbreak: "old-jailbreak",
  oldMainPrompt: "old-main",
}));

vi.mock("src/ts/gui/animation", () => ({
  updateAnimationSpeed: vi.fn(),
}));

vi.mock("src/ts/gui/colorscheme", () => ({
  updateColorScheme: vi.fn(),
  updateTextThemeAndCSS: vi.fn(),
}));

vi.mock("src/lang", () => ({
  language: {
    nightlyWarning: "nightly warning",
  },
}));

vi.mock("src/ts/observer.svelte", () => ({
  startObserveDom: vi.fn(),
  stopObserveDom: vi.fn(),
}));

vi.mock("src/ts/gui/guisize", () => ({
  updateGuisize: vi.fn(),
}));

vi.mock("src/ts/characters", () => ({
  updateLorebooks: vi.fn((value: unknown) => value),
}));

vi.mock("src/ts/process/modules", () => ({
  moduleUpdate: vi.fn(),
}));

vi.mock("src/ts/globalApi.svelte", () => ({
  saveDb: vi.fn(),
  checkCharOrder: vi.fn(),
}));

vi.mock("src/ts/platform", () => ({
  isNodeServer: true,
  isInStandaloneMode: false,
}));

vi.mock("src/ts/storage/serverDb", () => ({
  loadServerDatabase: vi.fn(async () => {}),
  startServerRealtimeSync: vi.fn(),
}));

describe("bootstrap prompt migration", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.db.mainPrompt = "custom-main-prompt";
    shared.db.jailbreak = "old-jailbreak";
    shared.loadedStore?.set(false);
  });

  it("checkNewFormat migrates old jailbreak into db.jailbreak without mutating db.mainPrompt", async () => {
    const { loadData } = await import("src/ts/bootstrap");

    await loadData();

    expect(shared.db.jailbreak).toBe("default-jailbreak");
    expect(shared.db.mainPrompt).toBe("custom-main-prompt");
  });
});
