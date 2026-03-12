import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertConfirm: vi.fn(async () => true),
  openURL: vi.fn(),
  sortableCreate: vi.fn(() => ({
    destroy: vi.fn(),
  })),
}));

vi.mock(import("src/lang"), () => {
  const language = new Proxy(
    {
      edit: "Edit",
      copy: "Copy",
      paste: "Paste",
      remove: "Remove",
      triggerV1Warning: "Trigger V1 Warning",
      triggerSwitchWarn: "Switch trigger mode?",
      helpBlock: "Help",
      showDeprecatedTriggerV1: "Show Deprecated Trigger V1",
      showDeprecatedTriggerV2: "Show deprecated",
    } as Record<string, unknown>,
    {
      get(target, key) {
        if (typeof key === "string" && key in target) {
          return target[key];
        }
        return String(key);
      },
    },
  );
  return { language };
});

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  openURL: mocks.openURL,
  saveAsset: async () => "",
  downloadFile: async () => {},
}));

vi.mock(import("src/ts/characterCards"), () => ({
  hubURL: "https://example.invalid",
}));

vi.mock(import("sortablejs"), () => ({
  default: {
    create: mocks.sortableCreate,
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    selectedCharID: writable(0),
    selIdState: {
      selId: 0,
    },
    DBState: {
      db: {
        showDeprecatedTriggerV1: false,
        showDeprecatedTriggerV2: false,
        characters: [],
      },
    },
  };
});

vi.mock(import("src/ts/util"), () => ({
  sleep: async () => {},
  sortableOptions: {},
}));

vi.mock(import("src/ts/process/triggers"), () => ({
  displayAllowList: [],
  requestAllowList: [],
}));

vi.mock(import("src/ts/process/triggerModeGuards"), () => ({
  isTriggerLuaEffect: (effect: { type?: string } | null | undefined) => effect?.type === "triggerlua",
  isTriggerV2HeaderEffect: (effect: { type?: string } | null | undefined) => effect?.type === "v2Header",
}));

vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/Portal.svelte"), async () => ({
  default: (await import("./test-stubs/PortalStub.svelte")).default,
}));
vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/Scripts/RegexData.svelte"), async () => ({
  default: (await import("./test-stubs/RegexDataStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/Scripts/TriggerV1Data.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import RegexList from "src/lib/SideBars/Scripts/RegexList.svelte";
import TriggerList from "src/lib/SideBars/Scripts/TriggerList.svelte";
import TriggerV1List from "src/lib/SideBars/Scripts/TriggerV1List.svelte";
import TriggerV2List from "src/lib/SideBars/Scripts/TriggerV2List.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("script trigger lists runtime smoke", () => {
  beforeEach(() => {
    mocks.alertConfirm.mockClear();
    mocks.openURL.mockClear();
    mocks.sortableCreate.mockClear();
    DBState.db.showDeprecatedTriggerV1 = false;
    DBState.db.showDeprecatedTriggerV2 = false;
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps regex list container/actions on list/action/icon primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(RegexList, {
      target,
      props: {
        value: [],
        buttons: true,
      },
    });
    await flushUi();

    const listContainer = document.querySelector(".regex-list-container.list-shell") as HTMLElement | null;
    expect(listContainer).not.toBeNull();

    const emptyState = document.querySelector(".regex-list-empty.empty-state") as HTMLElement | null;
    expect(emptyState).not.toBeNull();

    const actionRail = document.querySelector(".regex-list-actions.action-rail") as HTMLElement | null;
    expect(actionRail).not.toBeNull();

    const actionButtons = Array.from(
      document.querySelectorAll(".regex-list-action-btn.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(actionButtons.length).toBe(3);
    expect(actionButtons.every((button) => button.type === "button")).toBe(true);
    expect(actionButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Add script",
      "Export scripts",
      "Import scripts",
    ]);
  });

  it("keeps trigger list mode switch on segmented tab primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TriggerList, {
      target,
      props: {
        value: [
          {
            comment: "",
            type: "start",
            conditions: [],
            effect: [
              {
                type: "triggerlua",
                code: "",
              },
            ],
          },
        ],
      },
    });
    await flushUi();

    const modeRow = document.querySelector(".trigger-list-mode-row.seg-tabs") as HTMLElement | null;
    expect(modeRow).not.toBeNull();

    const modeButtons = Array.from(
      document.querySelectorAll(".trigger-list-mode-btn.seg-tab"),
    ) as HTMLButtonElement[];
    expect(modeButtons.length).toBe(3);
    expect(modeButtons.some((button) => button.classList.contains("is-active"))).toBe(true);
    expect(modeButtons.every((button) => button.type === "button")).toBe(true);
    expect(modeButtons[0]?.title).toBe("Trigger V1 mode");
    expect(modeButtons[0]?.getAttribute("aria-label")).toBe("Trigger V1 mode");
    expect(modeButtons[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(modeButtons[2]?.getAttribute("aria-pressed")).toBe("true");
  });

  it("keeps legacy trigger v1 editing behind an explicit opt-in path", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TriggerList, {
      target,
      props: {
        value: [
          {
            comment: "",
            type: "start",
            conditions: [],
            effect: [],
          },
        ],
      },
    });
    await flushUi();

    expect(document.querySelector(".trigger-list-warning")?.textContent).toContain("Trigger V1 Warning");
    expect(document.querySelector(".trigger-v1-list-container")).toBeNull();

    const revealButton = Array.from(document.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes("Show Deprecated Trigger V1"),
    ) as HTMLButtonElement | undefined;
    expect(revealButton).toBeDefined();
    revealButton?.click();
    await flushUi();

    expect(document.querySelector(".trigger-v1-list-container.list-shell")).not.toBeNull();
  });

  it("disables creating fresh trigger v1 lists from an empty trigger set", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TriggerList, {
      target,
      props: {
        value: [],
      },
    });
    await flushUi();

    const modeButtons = Array.from(
      document.querySelectorAll(".trigger-list-mode-btn.seg-tab"),
    ) as HTMLButtonElement[];
    expect(modeButtons[0]?.disabled).toBe(true);
    expect(document.querySelector(".trigger-v1-list-container")).toBeNull();
  });

  it("keeps trigger v1 list surfaces on list/empty/action/icon primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TriggerV1List, {
      target,
      props: {
        value: [],
      },
    });
    await flushUi();

    const listContainer = document.querySelector(".trigger-v1-list-container.list-shell") as HTMLElement | null;
    expect(listContainer).not.toBeNull();

    const emptyState = document.querySelector(".trigger-v1-list-empty.empty-state") as HTMLElement | null;
    expect(emptyState).not.toBeNull();

    const actions = document.querySelector(".trigger-v1-list-actions.action-rail") as HTMLElement | null;
    expect(actions).not.toBeNull();

    const addButton = document.querySelector(
      ".trigger-v1-list-add-btn.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
  });

  it("keeps trigger v2 menu/toolbar actions on menu/action/icon primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(TriggerV2List, {
      target,
      props: {
        value: [
          {
            comment: "",
            type: "manual",
            conditions: [],
            effect: [
              {
                type: "v2Header",
                code: "",
                indent: 0,
              },
            ],
          },
          {
            comment: "Event 1",
            type: "manual",
            conditions: [],
            effect: [
              {
                type: "v2Header",
                code: "",
                indent: 0,
              },
            ],
          },
        ],
      },
    });
    await flushUi();

    const editButton = Array.from(document.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").toLowerCase().includes("edit"),
    ) as HTMLButtonElement | undefined;
    expect(editButton).toBeDefined();
    editButton?.click();
    await flushUi();

    const panel = document.querySelector(".trigger-v2-panel.panel-shell") as HTMLElement | null;
    expect(panel).not.toBeNull();

    const triggerList = document.querySelector(
      ".trigger-v2-trigger-scroll.list-shell",
    ) as HTMLElement | null;
    expect(triggerList).not.toBeNull();

    const effectList = document.querySelector(".trigger-v2-effect-list.list-shell") as HTMLElement | null;
    expect(effectList).not.toBeNull();

    const firstEffectButton = document.querySelector(".trigger-v2-effect-button") as HTMLButtonElement | null;
    expect(firstEffectButton).not.toBeNull();
    expect(firstEffectButton?.type).toBe("button");
    expect(firstEffectButton?.title).toBe("Select effect");
    expect(firstEffectButton?.getAttribute("aria-label")).toBe("Select effect");

    const toolbar = document.querySelector(
      ".trigger-v2-toolbar.action-rail.ds-ui-action-rail",
    ) as HTMLElement | null;
    expect(toolbar).not.toBeNull();
    const toolbarButtons = Array.from(
      document.querySelectorAll(".trigger-v2-toolbar-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(toolbarButtons.length).toBe(3);
    expect(toolbarButtons.every((button) => button.type === "button")).toBe(true);
    expect(toolbarButtons.every((button) => (button.title ?? "").length > 0)).toBe(true);
    expect(
      toolbarButtons.every((button) => (button.getAttribute("aria-label") ?? "").length > 0),
    ).toBe(true);

    const triggerButton = document.querySelector(".trigger-v2-trigger-button") as HTMLButtonElement | null;
    expect(triggerButton).not.toBeNull();
    expect(triggerButton?.type).toBe("button");
    expect((triggerButton?.title ?? "").length).toBeGreaterThan(0);
    expect((triggerButton?.getAttribute("aria-label") ?? "").length).toBeGreaterThan(0);
    triggerButton?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: 64,
        clientY: 64,
      }),
    );
    await flushUi();

    const menu = document.querySelector(".trigger-v2-context-menu.ds-ui-menu") as HTMLElement | null;
    expect(menu).not.toBeNull();
    const menuItems = Array.from(
      document.querySelectorAll(".trigger-v2-context-action.ds-ui-menu-item"),
    ) as HTMLButtonElement[];
    expect(menuItems.length).toBeGreaterThan(0);
    expect(menuItems.every((button) => button.type === "button")).toBe(true);
    expect(menuItems.every((button) => (button.title ?? "").length > 0)).toBe(true);
    expect(
      menuItems.every((button) => (button.getAttribute("aria-label") ?? "").length > 0),
    ).toBe(true);
    const dangerMenuItem = document.querySelector(
      ".trigger-v2-context-action.ds-ui-menu-item.ds-ui-menu-item--danger",
    ) as HTMLElement | null;
    expect(dangerMenuItem).not.toBeNull();

    const addEffect = document.querySelector(".trigger-v2-add-effect") as HTMLButtonElement | null;
    expect(addEffect).not.toBeNull();
    expect(addEffect?.type).toBe("button");
    expect(addEffect?.title).toBe("Add effect");
    expect(addEffect?.getAttribute("aria-label")).toBe("Add effect");
    addEffect?.click();
    addEffect?.click();
    await flushUi();

    const triggerTypeButton = document.querySelector(".trigger-v2-type-item") as HTMLButtonElement | null;
    expect(triggerTypeButton).not.toBeNull();
    triggerTypeButton?.click();
    await flushUi();

    const editPanel = document.querySelector(".trigger-v2-edit-panel.panel-shell") as HTMLElement | null;
    expect(editPanel).not.toBeNull();

    const backButton = document.querySelector(
      ".trigger-v2-back-btn.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();
    expect(backButton?.type).toBe("button");
  });
});
