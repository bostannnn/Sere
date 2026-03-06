import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const startObserveDomMock = vi.fn();
  const stopObserveDomMock = vi.fn();
  const loadServerDatabaseMock = vi.fn(async () => {});
  const startServerRealtimeSyncMock = vi.fn();
  const db = {
    characters: [] as Array<Record<string, unknown>>,
    modules: [] as Array<Record<string, unknown>>,
    personas: [] as Array<Record<string, unknown>>,
    formatversion: 5,
    loreBookToken: 8000,
    characterOrder: [] as string[],
    mainPrompt: "",
    customBackground: "",
    userIcon: "",
  };

  return {
    startObserveDomMock,
    stopObserveDomMock,
    loadServerDatabaseMock,
    startServerRealtimeSyncMock,
    db,
    loadedStore: null as { set: (value: boolean) => void } | null,
    selectedCharID: null as { set: (value: number) => void } | null,
    mobileGUI: null as { set: (value: boolean) => void } | null,
  };
});

vi.mock("src/ts/storage/database.svelte", () => ({
  setDatabase: vi.fn(),
  getDatabase: vi.fn(() => shared.db),
}));

vi.mock("src/ts/stores.svelte", async () => {
  const { writable } = await import("svelte/store");
  const loadedStore = writable(false);
  const selectedCharID = writable(-1);
  const mobileGUI = writable(false);
  shared.loadedStore = loadedStore;
  shared.selectedCharID = selectedCharID;
  shared.mobileGUI = mobileGUI;
  return {
    MobileGUI: mobileGUI,
    selectedCharID,
    loadedStore,
    DBState: { db: shared.db },
    LoadingStatusState: { text: "" },
  };
});

vi.mock("src/ts/plugins/plugins.svelte", () => ({
  loadPlugins: vi.fn(async () => {}),
}));

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
  startObserveDom: shared.startObserveDomMock,
  stopObserveDom: shared.stopObserveDomMock,
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
  loadServerDatabase: shared.loadServerDatabaseMock,
  startServerRealtimeSync: shared.startServerRealtimeSyncMock,
}));

describe("bootstrap idempotence", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.startObserveDomMock.mockClear();
    shared.stopObserveDomMock.mockClear();
    shared.loadServerDatabaseMock.mockClear();
    shared.startServerRealtimeSyncMock.mockClear();
    shared.loadedStore?.set(false);
  });

  it("loadData registers global error handlers once across repeated calls", async () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const { loadData } = await import("src/ts/bootstrap");

    await loadData();
    shared.loadedStore?.set(false);
    await loadData();

    const errorAdds = addEventListenerSpy.mock.calls.filter(([type]) => type === "error").length;
    const rejectionAdds = addEventListenerSpy.mock.calls.filter(([type]) => type === "unhandledrejection").length;

    expect(errorAdds).toBe(1);
    expect(rejectionAdds).toBe(1);
  });

  it("loadData does not create duplicate DOM observers on re-entry", async () => {
    const { loadData } = await import("src/ts/bootstrap");

    await loadData();
    shared.loadedStore?.set(false);
    await loadData();

    expect(shared.startObserveDomMock).toHaveBeenCalledTimes(1);
  });
});
