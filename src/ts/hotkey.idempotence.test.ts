import { beforeEach, describe, expect, it, vi } from "vitest";
import { writable } from "svelte/store";

vi.mock("src/ts/alert", () => ({
  alertMd: vi.fn(),
  alertSelect: vi.fn(async () => "0"),
  alertToast: vi.fn(),
  alertWait: vi.fn(),
  doingAlert: vi.fn(() => false),
  alertRequestLogs: vi.fn(),
  alertError: vi.fn(),
}));

vi.mock("src/ts/storage/database.svelte", () => ({
  changeToPreset: vi.fn(),
  getDatabase: vi.fn(() => ({
    hotkeys: [],
    characters: [],
    botPresets: [],
    enableScrollToActiveChar: false,
  })),
}));

vi.mock("src/ts/stores.svelte", () => ({
  alertStore: writable({ type: "none", msg: "n" }),
  openPersonaList: writable(false),
  openPresetList: writable(false),
  PlaygroundStore: writable(0),
  QuickSettings: { open: false, index: 0 },
  SafeModeStore: writable(false),
  selectedCharID: writable(-1),
  settingsOpen: writable(false),
}));

vi.mock("src/lang", () => ({
  language: {
    presets: "Presets",
    persona: "Persona",
    cancel: "Cancel",
  },
}));

vi.mock("src/ts/gui/colorscheme", () => ({
  updateTextThemeAndCSS: vi.fn(),
}));

vi.mock("src/ts/defaulthotkeys", () => ({
  defaultHotkeys: [],
}));

vi.mock("src/ts/process/index.svelte", () => ({
  isDoingChat: writable(false),
  previewBody: "",
  sendChat: vi.fn(async () => {}),
}));

vi.mock("src/ts/mobileGestureGuard", () => ({
  isEditableTouchTarget: vi.fn(() => false),
  shouldPreventHorizontalSwipe: vi.fn(() => false),
}));

describe("hotkey idempotence", () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import("src/ts/hotkey");
    module.resetHotkeyInitForTests();
  });

  it("initHotkey is idempotent and does not duplicate keydown handlers", async () => {
    const addListenerSpy = vi.spyOn(document, "addEventListener");
    const { initHotkey } = await import("src/ts/hotkey");

    initHotkey();
    initHotkey();

    const keydownRegistrations = addListenerSpy.mock.calls.filter(([type]) => type === "keydown").length;
    expect(keydownRegistrations).toBe(1);
  });
});
