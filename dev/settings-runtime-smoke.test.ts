import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: { db: { settingsCloseButtonSize: 24 } },
    MobileGUI: writable(false),
    SettingsMenuIndex: writable(1),
    SizeStore: writable({ w: 1280, h: 900 }),
    additionalSettingsMenu: [],
    settingsOpen: writable(true),
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

const NAV_SHELL_SELECTOR = ".ds-settings-nav-shell.ds-settings-nav-panel";
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

function getContentNode() {
  return document.querySelector(CONTENT_SHELL_SELECTOR) as HTMLElement | null;
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

function assertDesktopCloseButtonPrimitive(context: string) {
  const closeButton = document.querySelector(
    ".ds-settings-panel-close-button",
  ) as HTMLButtonElement | null;
  expect(closeButton, `${context}: missing close button`).not.toBeNull();
  expect(
    closeButton?.classList.contains("icon-btn"),
    `${context}: close button missing icon-btn`,
  ).toBe(true);
  expect(
    closeButton?.classList.contains("icon-btn--sm"),
    `${context}: close button missing icon-btn--sm`,
  ).toBe(true);
}

async function pressNavKey(
  sourceIndex: number,
  key: "ArrowDown" | "ArrowUp" | "Home" | "End",
  expectedIndex: number,
  context: string,
) {
  const buttons = navButtons();
  expect(
    buttons.length,
    `${context}: expected nav buttons before keyboard nav`,
  ).toBeGreaterThan(0);

  const source = buttons[sourceIndex];
  expect(source, `${context}: missing source button ${sourceIndex}`).toBeDefined();
  source?.focus();
  source?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  await assertSettingsContentVisible(`${context}: after ${key}`);

  const nextButtons = navButtons();
  const activeIndex = nextButtons.findIndex((button) =>
    button.classList.contains("is-active"),
  );
  expect(activeIndex, `${context}: active nav index after ${key}`).toBe(
    expectedIndex,
  );
}

async function runSubTabFlow(menuIndex: number, label: string) {
  SettingsMenuIndex.set(menuIndex);
  await flushUi();

  const tabs = Array.from(
    document.querySelectorAll(".ds-settings-tab"),
  ) as HTMLButtonElement[];
  expect(tabs.length, `${label}: expected local subtabs`).toBeGreaterThan(0);
  expect(
    tabs.every((tab) => tab.getAttribute("type") === "button"),
    `${label}: local subtabs missing explicit button type`,
  ).toBe(true);
  expect(
    tabs.every((tab) => (tab.getAttribute("title") ?? "").length > 0),
    `${label}: local subtabs missing title`,
  ).toBe(true);
  expect(
    tabs.every((tab) => (tab.getAttribute("aria-label") ?? "").length > 0),
    `${label}: local subtabs missing aria-label`,
  ).toBe(true);
  expect(
    tabs.every((tab) => tab.getAttribute("role") === "tab"),
    `${label}: local subtabs missing tab role`,
  ).toBe(true);
  expect(
    tabs.some((tab) => tab.getAttribute("aria-selected") === "true"),
    `${label}: local subtabs missing selected state`,
  ).toBe(true);

  for (const [tabIndex, tab] of tabs.entries()) {
    tab.click();
    await assertSettingsContentVisible(`${label} tab ${tabIndex} first click`);
    tab.click();
    await assertSettingsContentVisible(`${label} tab ${tabIndex} second click`);
  }

  tabs[0]?.click();
  await assertSettingsContentVisible(`${label} return first tab`);
}

describe("settings runtime smoke", () => {
  beforeEach(() => {
    runtimeErrors = [];
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    DBState.db = { settingsCloseButtonSize: 24 };
    additionalSettingsMenu.length = 0;
    MobileGUI.set(false);
    settingsOpen.set(true);
    SizeStore.set({ w: 1280, h: 900 });
    SettingsMenuIndex.set(1);

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

  it("clicks every top-level settings nav item twice without blank content", async () => {
    await assertSettingsContentVisible("initial render");
    assertDesktopCloseButtonPrimitive("desktop nav run");
    assertNavButtonSemantics("desktop nav run");
    expect(navButtonLabels()).toEqual([
      "Chat Bot",
      "Other Bots",
      "Persona",
      "Display",
      "Language",
      "Accessibility",
      "Modules",
      "Plugin",
      "Hotkey",
      "Advanced Settings",
    ]);
    const buttons = navButtons();
    expect(buttons.length).toBeGreaterThan(0);

    for (const [buttonIndex, button] of buttons.entries()) {
      button.click();
      await assertSettingsContentVisible(`nav ${buttonIndex} first click`);
      button.click();
      await assertSettingsContentVisible(`nav ${buttonIndex} second click`);
    }
  });

  it("supports keyboard roving on top-level settings nav", async () => {
    await assertSettingsContentVisible("keyboard nav initial");
    assertNavButtonSemantics("keyboard nav initial");
    const buttons = navButtons();
    expect(buttons.length).toBeGreaterThan(2);
    const lastIndex = buttons.length - 1;

    await pressNavKey(0, "ArrowDown", 1, "keyboard nav down");
    await pressNavKey(lastIndex, "ArrowUp", lastIndex - 1, "keyboard nav up");
    await pressNavKey(2, "Home", 0, "keyboard nav home");
    await pressNavKey(1, "End", lastIndex, "keyboard nav end");
  });

  it("clicks local subtabs for Chat Bot, Other Bots, and Display", async () => {
    await runSubTabFlow(1, "chat-bot");
    await runSubTabFlow(2, "other-bots");
    await runSubTabFlow(3, "display");
  });

  it("normalizes desktop menu index when entering with back-state sentinel", async () => {
    SettingsMenuIndex.set(-1);
    await assertSettingsContentVisible("desktop back-state sentinel");
    expect(get(SettingsMenuIndex)).toBe(1);
  });
});
