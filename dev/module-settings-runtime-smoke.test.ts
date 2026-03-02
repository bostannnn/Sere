import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

const mocks = vi.hoisted(() => ({
  refreshModules: vi.fn(),
  exportModule: vi.fn(),
  importModule: vi.fn(),
  importMCPModule: vi.fn(),
  alertConfirm: vi.fn(async () => true),
}));

vi.mock(import("uuid"), () => ({
  v4: () => "module-id-generated",
}));

vi.mock(import("src/ts/gui/tooltip"), () => ({
  tooltip: () => ({
    destroy: () => {},
  }),
}));

vi.mock(import("src/ts/process/modules"), () => ({
  exportModule: mocks.exportModule,
  importModule: mocks.importModule,
  refreshModules: mocks.refreshModules,
}));

vi.mock(import("src/ts/process/mcp/mcp"), () => ({
  importMCPModule: mocks.importMCPModule,
}));

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
}));

vi.mock(import("src/lang"), () => ({
  language: {
    modules: "Modules",
    noModules: "No modules",
    search: "Search",
    enableGlobal: "Enable global",
    download: "Download",
    edit: "Edit",
    remove: "Remove",
    removeConfirm: "Remove ",
    createModule: "Create Module",
    editModule: "Edit Module",
    chatModulesInfo: "Chat modules info",
  },
}));

vi.mock(import("src/lib/Setting/Pages/Module/ModuleMenu.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        modules: [
          {
            id: "module-alpha",
            name: "Alpha Module",
            description: "alpha",
          },
          {
            id: "module-beta",
            name: "Beta Module",
            description: "beta",
          },
        ],
        enabledModules: [],
        moduleIntergration: "",
        characters: [
          {
            chatPage: 0,
            chats: [
              {
                modules: [],
              },
            ],
            modules: [],
          },
        ],
      },
    },
    selectedCharID: writable(0),
    ReloadGUIPointer: writable(0),
    SettingsMenuIndex: writable(0),
    settingsOpen: writable(false),
  };
});

import ModuleSettings from "src/lib/Setting/Pages/Module/ModuleSettings.svelte";
import ModuleChatMenu from "src/lib/Setting/Pages/Module/ModuleChatMenu.svelte";
import { DBState, SettingsMenuIndex, settingsOpen } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("module settings runtime smoke", () => {
  beforeEach(() => {
    mocks.refreshModules.mockClear();
    mocks.exportModule.mockClear();
    mocks.importModule.mockClear();
    mocks.importMCPModule.mockClear();
    mocks.alertConfirm.mockClear();

    DBState.db.modules = [
      {
        id: "module-alpha",
        name: "Alpha Module",
        description: "alpha",
      },
      {
        id: "module-beta",
        name: "Beta Module",
        description: "beta",
      },
    ];
    DBState.db.enabledModules = [];
    DBState.db.moduleIntergration = "";
    DBState.db.characters = [
      {
        chatPage: 0,
        chats: [
          {
            modules: [],
          },
        ],
        modules: [],
      },
    ];

    SettingsMenuIndex.set(0);
    settingsOpen.set(false);
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies control-field to module settings search and keeps filtering", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ModuleSettings, { target });
    await flushUi();

    const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    expect(searchInput?.classList.contains("control-field")).toBe(true);

    searchInput!.value = "beta";
    searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const moduleNames = [...document.querySelectorAll(".ds-settings-text-lg")].map(
      (node) => (node.textContent ?? "").trim(),
    );
    expect(moduleNames).toEqual(["Beta Module"]);

    const rowActionRail = document.querySelector(
      ".ds-settings-grow-min.ds-settings-inline-actions.ds-settings-inline-actions-end.action-rail",
    ) as HTMLElement | null;
    expect(rowActionRail).not.toBeNull();

    const footerActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(footerActionRail).not.toBeNull();

    const iconActionButton = document.querySelector(
      ".ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(iconActionButton).not.toBeNull();

    await unmount(app);
    app = undefined;
    expect(mocks.refreshModules).toHaveBeenCalledTimes(1);
  });

  it("applies control-field to module chat search and keeps toggle behavior", async () => {
    const close = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ModuleChatMenu, { target, props: { close } });
    await flushUi();

    const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    expect(searchInput?.classList.contains("control-field")).toBe(true);

    const closeActionRail = document.querySelector(
      ".ds-settings-grow-min.ds-settings-inline-actions.ds-settings-inline-actions-end.action-rail",
    ) as HTMLElement | null;
    expect(closeActionRail).not.toBeNull();

    const firstRow = document.querySelector(".ds-settings-list-row.ds-settings-list-row-inset") as HTMLElement | null;
    expect(firstRow).not.toBeNull();
    const firstRowActionRail = firstRow?.querySelector(
      ".ds-settings-grow-min.ds-settings-inline-actions.ds-settings-inline-actions-end.action-rail",
    ) as HTMLElement | null;
    expect(firstRowActionRail).not.toBeNull();
    const firstRowButton = firstRow?.querySelector("button.ds-ui-button") as HTMLButtonElement | null;
    expect(firstRowButton).not.toBeNull();
    expect(firstRowButton?.classList.contains("icon-btn")).toBe(true);
    expect(firstRowButton?.classList.contains("icon-btn--sm")).toBe(true);

    firstRowButton?.click();
    await flushUi();
    expect(DBState.db.characters[0].chats[0].modules).toContain("module-alpha");

    firstRowButton?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    await flushUi();
    expect(DBState.db.characters[0].modules).toContain("module-alpha");

    searchInput!.value = "beta";
    searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();
    const filteredRows = [...document.querySelectorAll(".ds-settings-list-row.ds-settings-list-row-inset")];
    expect(filteredRows.length).toBe(1);
    expect((filteredRows[0]?.textContent ?? "").includes("Beta Module")).toBe(true);

    const editButton = [...document.querySelectorAll("button.ds-ui-button")]
      .find((button) => (button.textContent ?? "").trim() === "Edit") as HTMLButtonElement | undefined;
    expect(editButton).toBeDefined();
    editButton?.click();
    await flushUi();
    expect(get(SettingsMenuIndex)).toBe(14);
    expect(get(settingsOpen)).toBe(true);
    expect(close).toHaveBeenCalledWith("");

    const closeButton = [...document.querySelectorAll("button.ds-ui-button")]
      .find((button) =>
        button.classList.contains("ds-settings-icon-action")
        && button.classList.contains("icon-btn")
        && button.classList.contains("icon-btn--sm"),
      ) as HTMLButtonElement | undefined;
    expect(closeButton).toBeDefined();

    const footerActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(footerActionRail).not.toBeNull();
  });
});
