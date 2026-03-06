import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const mountMock = vi.fn(() => ({ destroy: vi.fn() }));
  const preLoadCheckMock = vi.fn();
  const hydrateBootColorSchemeMock = vi.fn();
  const initStoresRuntimeMock = vi.fn();
  const disposeStoresRuntimeMock = vi.fn();
  const loadDataMock = vi.fn();
  const initHotkeyMock = vi.fn();
  const initMobileGestureMock = vi.fn();
  const installTouchHardeningMock = vi.fn();

  return {
    mountMock,
    preLoadCheckMock,
    hydrateBootColorSchemeMock,
    initStoresRuntimeMock,
    disposeStoresRuntimeMock,
    loadDataMock,
    initHotkeyMock,
    initMobileGestureMock,
    installTouchHardeningMock,
  };
});

vi.mock("src/ts/polyfill", () => ({}));
vi.mock("core-js/actual", () => ({}));
vi.mock("src/ts/storage/database.svelte", () => ({}));
vi.mock("src/App.svelte", () => ({
  default: {},
}));
vi.mock("src/ts/bootstrap", () => ({
  loadData: shared.loadDataMock,
  installTouchHardening: shared.installTouchHardeningMock,
}));
vi.mock("src/ts/hotkey", () => ({
  initHotkey: shared.initHotkeyMock,
  initMobileGesture: shared.initMobileGestureMock,
}));
vi.mock("src/preload", () => ({
  preLoadCheck: shared.preLoadCheckMock,
}));
vi.mock("svelte", () => ({
  mount: shared.mountMock,
}));
vi.mock("src/ts/gui/colorscheme", () => ({
  hydrateBootColorScheme: shared.hydrateBootColorSchemeMock,
}));
vi.mock("src/ts/stores.svelte", () => ({
  initStoresRuntime: shared.initStoresRuntimeMock,
  disposeStoresRuntime: shared.disposeStoresRuntimeMock,
}));

describe("main HMR dispose", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.mountMock.mockClear();
    shared.preLoadCheckMock.mockClear();
    shared.hydrateBootColorSchemeMock.mockClear();
    shared.initStoresRuntimeMock.mockClear();
    shared.disposeStoresRuntimeMock.mockClear();
    shared.loadDataMock.mockClear();
    shared.initHotkeyMock.mockClear();
    shared.initMobileGestureMock.mockClear();
    shared.installTouchHardeningMock.mockClear();

    document.body.replaceChildren();
    const appRoot = document.createElement("div");
    appRoot.id = "app";
    const preloading = document.createElement("div");
    preloading.id = "preloading";
    document.body.append(appRoot, preloading);
  });

  it("main runtime disposes boot listeners/effects on HMR and re-inits once", async () => {
    const firstMain = await import("src/main");

    firstMain.disposeMainRuntime();
    firstMain.disposeMainRuntime();

    expect(shared.disposeStoresRuntimeMock).toHaveBeenCalledTimes(1);

    vi.resetModules();
    const appRoot = document.getElementById("app") ?? document.createElement("div");
    if (!appRoot.id) {
      appRoot.id = "app";
      document.body.appendChild(appRoot);
    }
    if (!document.getElementById("preloading")) {
      const preloading = document.createElement("div");
      preloading.id = "preloading";
      document.body.appendChild(preloading);
    }

    await import("src/main");

    expect(shared.initStoresRuntimeMock).toHaveBeenCalledTimes(2);
    expect(shared.disposeStoresRuntimeMock).toHaveBeenCalledTimes(1);
  });
});
