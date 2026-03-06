import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const order: string[] = [];
  const mountMock = vi.fn(() => ({ destroy: vi.fn() }));
  const preLoadCheckMock = vi.fn(() => {
    shared.order.push("preLoadCheck");
  });
  const hydrateBootColorSchemeMock = vi.fn(() => {
    shared.order.push("hydrateBootColorScheme");
  });
  const initStoresRuntimeMock = vi.fn(() => {
    shared.order.push("initStoresRuntime");
  });
  const loadDataMock = vi.fn(() => {
    shared.order.push("loadData");
  });
  const initHotkeyMock = vi.fn(() => {
    shared.order.push("initHotkey");
  });
  const initMobileGestureMock = vi.fn(() => {
    shared.order.push("initMobileGesture");
  });
  const installTouchHardeningMock = vi.fn(() => {
    shared.order.push("installTouchHardening");
  });

  return {
    order,
    mountMock,
    preLoadCheckMock,
    hydrateBootColorSchemeMock,
    initStoresRuntimeMock,
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
}));

describe("main boot order", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.order.length = 0;
    shared.mountMock.mockClear();
    shared.preLoadCheckMock.mockClear();
    shared.hydrateBootColorSchemeMock.mockClear();
    shared.initStoresRuntimeMock.mockClear();
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

  it("main boot sequence remains deterministic and one-time on module re-import", async () => {
    await import("src/main");
    await import("src/main");

    expect(shared.order).toEqual([
      "preLoadCheck",
      "hydrateBootColorScheme",
      "initStoresRuntime",
      "loadData",
      "initHotkey",
      "initMobileGesture",
      "installTouchHardening",
    ]);
    expect(shared.mountMock).toHaveBeenCalledTimes(1);
    expect(shared.loadDataMock).toHaveBeenCalledTimes(1);
    expect(document.getElementById("preloading")).toBeNull();
  });
});
