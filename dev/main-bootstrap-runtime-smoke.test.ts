import { beforeEach, describe, expect, it, vi } from "vitest";

const shared = vi.hoisted(() => {
  const calls: string[] = [];
  const mountMock = vi.fn(() => ({ mounted: true }));
  const preLoadCheckMock = vi.fn(() => {
    calls.push("preLoadCheck");
  });
  const hydrateBootColorSchemeMock = vi.fn(() => {
    calls.push("hydrateBootColorScheme");
  });
  const initStoresRuntimeMock = vi.fn(() => {
    calls.push("initStoresRuntime");
  });
  const loadDataMock = vi.fn(() => {
    calls.push("loadData");
  });
  const initHotkeyMock = vi.fn(() => {
    calls.push("initHotkey");
  });
  const initMobileGestureMock = vi.fn(() => {
    calls.push("initMobileGesture");
  });
  const installTouchHardeningMock = vi.fn(() => {
    calls.push("installTouchHardening");
  });

  return {
    calls,
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

vi.mock("core-js/actual", () => ({}));
vi.mock("src/ts/polyfill", () => ({}));
vi.mock("src/ts/storage/database.svelte", () => ({}));
vi.mock("src/App.svelte", () => ({
  default: { __name: "AppStub" },
}));

vi.mock("src/preload", () => ({
  preLoadCheck: shared.preLoadCheckMock,
}));

vi.mock("src/ts/gui/colorscheme", () => ({
  hydrateBootColorScheme: shared.hydrateBootColorSchemeMock,
}));

vi.mock("src/ts/stores.svelte", () => ({
  initStoresRuntime: shared.initStoresRuntimeMock,
}));

vi.mock("src/ts/bootstrap", () => ({
  loadData: shared.loadDataMock,
  installTouchHardening: shared.installTouchHardeningMock,
}));

vi.mock("src/ts/hotkey", () => ({
  initHotkey: shared.initHotkeyMock,
  initMobileGesture: shared.initMobileGestureMock,
}));

vi.mock("svelte", () => ({
  mount: shared.mountMock,
}));

describe("main bootstrap runtime smoke", () => {
  beforeEach(() => {
    vi.resetModules();
    shared.calls.length = 0;
    shared.mountMock.mockClear();
    shared.preLoadCheckMock.mockClear();
    shared.hydrateBootColorSchemeMock.mockClear();
    shared.initStoresRuntimeMock.mockClear();
    shared.loadDataMock.mockClear();
    shared.initHotkeyMock.mockClear();
    shared.initMobileGestureMock.mockClear();
    shared.installTouchHardeningMock.mockClear();

    document.body.innerHTML = `
      <div id="preloading">loading</div>
      <div id="app"></div>
    `;
    shared.mountMock.mockImplementation(() => {
      shared.calls.push("mount");
      return { mounted: true };
    });
  });

  it("main bootstrap mounts once and preserves deterministic startup side-effects", async () => {
    const mod = await import("src/main.ts");

    expect(shared.mountMock).toHaveBeenCalledTimes(1);
    expect(shared.preLoadCheckMock).toHaveBeenCalledTimes(1);
    expect(shared.hydrateBootColorSchemeMock).toHaveBeenCalledTimes(1);
    expect(shared.initStoresRuntimeMock).toHaveBeenCalledTimes(1);
    expect(shared.loadDataMock).toHaveBeenCalledTimes(1);
    expect(shared.initHotkeyMock).toHaveBeenCalledTimes(1);
    expect(shared.initMobileGestureMock).toHaveBeenCalledTimes(1);
    expect(shared.installTouchHardeningMock).toHaveBeenCalledTimes(1);
    expect(document.getElementById("preloading")).toBeNull();
    expect(mod.default).toEqual({ mounted: true });
    expect(shared.calls).toEqual([
      "preLoadCheck",
      "hydrateBootColorScheme",
      "initStoresRuntime",
      "mount",
      "loadData",
      "initHotkey",
      "initMobileGesture",
      "installTouchHardening",
    ]);
  });
});
