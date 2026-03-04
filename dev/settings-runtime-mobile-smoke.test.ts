import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: { db: { settingsCloseButtonSize: 24 } },
    MobileGUI: writable(true),
    SettingsMenuIndex: writable(-1),
    SizeStore: writable({ w: 390, h: 844 }),
    additionalSettingsMenu: [],
    settingsOpen: writable(false),
  };
});

vi.mock(import("src/lang"), () => ({
  language: {
    chatBot: "Chat Bot",
    persona: "Persona",
    otherBots: "Other Bots",
    display: "Display",
    language: "Language",
    accessibility: "Accessibility",
    modules: "Modules",
    plugin: "Plugin",
    hotkey: "Hotkey",
    advancedSettings: "Advanced Settings",
    comfyCommander: "Comfy Commander",
    logs: "Logs",
  },
}));

vi.mock(import("src/ts/lite"), async () => {
  const { writable } = await import("svelte/store");
  return { isLite: writable(false) };
});

vi.mock(import("src/ts/platform"), () => ({ isWebKit: false }));

vi.mock(import("src/lib/Setting/Pages/BotSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsTabbedStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/OtherBotSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsTabbedStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/DisplaySettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsTabbedStub.svelte")).default,
}));

vi.mock(import("src/lib/Setting/Pages/PluginSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/AdvancedSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/LanguageSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(
  import("src/lib/Setting/Pages/AccessibilitySettings.svelte"),
  async () => ({
    default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
  }),
);
vi.mock(import("src/lib/Setting/Pages/PersonaSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/PromptSettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(
  import("src/lib/Setting/Pages/Module/ModuleSettings.svelte"),
  async () => ({
    default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
  }),
);
vi.mock(import("src/lib/Setting/Pages/HotkeySettings.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/ComfyCommanderPage.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(import("src/lib/Setting/Pages/LogsSettingsPage.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/PluginDefinedIcon.svelte"), async () => ({
  default: (await import("./test-stubs/SettingsPageStub.svelte")).default,
}));

import Settings from "src/lib/Setting/Settings.svelte";
import {
  DBState,
  MobileGUI,
  SettingsMenuIndex,
  SizeStore,
  additionalSettingsMenu,
  settingsOpen,
} from "src/ts/stores.svelte";

const NAV_SHELL_SELECTOR =
  ".ds-settings-nav-shell.ds-settings-nav-panel.ds-settings-nav-shell-force-single-column";
const CONTENT_SHELL_SELECTOR =
  ".ds-settings-content-shell.ds-settings-content-panel";

let app: Record<string, unknown> | undefined;
let runtimeErrors: unknown[] = [];

const onError = (event: Event) => {
  const errEvent = event as ErrorEvent;
  runtimeErrors.push(errEvent.error ?? errEvent.message ?? event);
};

const onUnhandledRejection = (event: Event) => {
  const promiseEvent = event as PromiseRejectionEvent;
  runtimeErrors.push(promiseEvent.reason ?? event);
};

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function navButtons() {
  return Array.from(
    document.querySelectorAll(`${NAV_SHELL_SELECTOR} > button.ds-settings-nav-item`),
  ) as HTMLButtonElement[];
}

function navButtonLabels() {
  return navButtons().map((button) => (button.textContent ?? "").trim());
}

function assertNavButtonSemantics(context: string) {
  const buttons = navButtons();
  expect(buttons.length, `${context}: expected nav buttons`).toBeGreaterThan(0);
  expect(
    buttons.every((button) => button.getAttribute("type") === "button"),
    `${context}: nav buttons missing explicit button type`,
  ).toBe(true);
  expect(
    buttons.every((button) => (button.getAttribute("title") ?? "").length > 0),
    `${context}: nav buttons missing title`,
  ).toBe(true);
  expect(
    buttons.every((button) => (button.getAttribute("aria-label") ?? "").length > 0),
    `${context}: nav buttons missing aria-label`,
  ).toBe(true);
}

function getContentNode() {
  return document.querySelector(CONTENT_SHELL_SELECTOR) as HTMLElement | null;
}

function assertSingleRowNavLayout(context: string) {
  const nav = document.querySelector(NAV_SHELL_SELECTOR) as HTMLElement | null;
  expect(nav, `${context}: nav missing`).not.toBeNull();
  expect(
    nav?.classList.contains("ds-settings-nav-shell-force-single-column"),
    `${context}: missing single-column nav class`,
  ).toBe(true);

  const buttons = navButtons();
  expect(buttons.length, `${context}: expected nav buttons`).toBeGreaterThan(0);
  for (const [index, button] of buttons.entries()) {
    expect(
      button.classList.contains("ds-settings-nav-item"),
      `${context}: nav button ${index} class`,
    ).toBe(true);
  }
}

async function assertNavVisible(context: string) {
  await flushUi();
  const nav = document.querySelector(NAV_SHELL_SELECTOR) as HTMLElement | null;
  expect(nav, `${context}: nav missing`).not.toBeNull();
  assertSingleRowNavLayout(context);
  assertNavButtonSemantics(context);
  expect(runtimeErrors, `${context}: runtime errors detected`).toEqual([]);
}

async function assertSettingsContentVisible(context: string) {
  await flushUi();
  const contentNode = getContentNode();
  expect(contentNode, `${context}: missing settings content node`).not.toBeNull();
  expect(
    contentNode?.textContent?.trim().length ?? 0,
    `${context}: settings content is blank`,
  ).toBeGreaterThan(0);
  expect(runtimeErrors, `${context}: runtime errors detected`).toEqual([]);
}

async function clickNavLabel(label: string, context: string) {
  await assertNavVisible(`${context}: before nav click`);
  const button = navButtons().find((item) => item.textContent?.trim() === label);
  expect(button, `${context}: nav button not found: ${label}`).not.toBeUndefined();
  button?.click();
  await assertSettingsContentVisible(`${context}: open ${label}`);
}

async function runSubTabFlow(menuIndex: number, label: string) {
  SettingsMenuIndex.set(menuIndex);
  await flushUi();

  const tabs = Array.from(
    document.querySelectorAll(".ds-settings-tab"),
  ) as HTMLButtonElement[];
  expect(tabs.length, `${label}: expected local subtabs`).toBeGreaterThan(0);

  for (const [tabIndex, tab] of tabs.entries()) {
    tab.click();
    await assertSettingsContentVisible(`${label} tab ${tabIndex} first click`);
    tab.click();
    await assertSettingsContentVisible(`${label} tab ${tabIndex} second click`);
  }

  tabs[0]?.click();
  await assertSettingsContentVisible(`${label} return first tab`);
}

describe("settings runtime mobile smoke", () => {
  beforeEach(() => {
    runtimeErrors = [];
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    DBState.db = { settingsCloseButtonSize: 24 };
    additionalSettingsMenu.length = 0;
    MobileGUI.set(true);
    settingsOpen.set(false);
    SizeStore.set({ w: 390, h: 844 });
    SettingsMenuIndex.set(-1);

    document.body.innerHTML = "";
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(Settings, { target });
  });

  afterEach(async () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps hotkey and close-x hidden in mobile settings shell", async () => {
    await assertNavVisible("mobile shell initial");
    const nav = document.querySelector(NAV_SHELL_SELECTOR) as HTMLElement | null;
    expect(nav?.classList.contains("ds-settings-nav-shell-stacked")).toBe(true);
    expect(navButtonLabels()).toEqual([
      "Chat Bot",
      "Other Bots",
      "Persona",
      "Display",
      "Language",
      "Accessibility",
      "Modules",
      "Plugin",
      "Advanced Settings",
      "Comfy Commander",
      "Logs",
    ]);
    const hasHotkey = navButtons().some(
      (button) => button.textContent?.trim() === "Hotkey",
    );
    expect(hasHotkey).toBe(false);

    const mobileClose = document.querySelector(
      `${NAV_SHELL_SELECTOR} .ds-settings-panel-close`,
    );
    expect(mobileClose).toBeNull();
  });

  it("clicks each top-level mobile settings nav item twice without blank content", async () => {
    const labels = [
      "Chat Bot",
      "Other Bots",
      "Persona",
      "Display",
      "Language",
      "Accessibility",
      "Modules",
      "Plugin",
      "Advanced Settings",
      "Comfy Commander",
      "Logs",
    ];

    for (const label of labels) {
      await clickNavLabel(label, `mobile nav first click ${label}`);
      SettingsMenuIndex.set(-1);
      await assertNavVisible(`mobile nav back ${label}`);

      await clickNavLabel(label, `mobile nav second click ${label}`);
      SettingsMenuIndex.set(-1);
      await assertNavVisible(`mobile nav second back ${label}`);
    }
  });

  it("clicks local subtabs for Chat Bot, Other Bots, and Display in mobile mode", async () => {
    await runSubTabFlow(1, "mobile chat-bot");
    await runSubTabFlow(2, "mobile other-bots");
    await runSubTabFlow(3, "mobile display");
    SettingsMenuIndex.set(-1);
    await assertNavVisible("mobile final nav");
  });
});
