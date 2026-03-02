import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertConfirm: vi.fn(async () => true),
  alertError: vi.fn(),
  alertMd: vi.fn(),
  alertSelect: vi.fn(async () => "0"),
  checkPluginUpdate: vi.fn(async () => false),
  importPlugin: vi.fn(),
  loadPlugins: vi.fn(),
  removePluginFromServerStorage: vi.fn(async () => {}),
  updatePlugin: vi.fn(),
  hotReloadPluginFiles: vi.fn(async () => {}),
}));

vi.mock(import("src/lang"), () => ({
  language: {
    plugin: "Plugin",
    pluginWarn: "Plugin warning",
    noPlugins: "No plugins",
    pluginV2Warning: "v2 warning",
    pluginUpdateFoundInstallIt: "Update plugin?",
    removeConfirm: "Remove ",
    cancel: "Cancel",
  },
}));

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
  alertError: mocks.alertError,
  alertMd: mocks.alertMd,
  alertSelect: mocks.alertSelect,
}));

vi.mock(import("src/ts/plugins/plugins.svelte"), () => ({
  checkPluginUpdate: mocks.checkPluginUpdate,
  importPlugin: mocks.importPlugin,
  loadPlugins: mocks.loadPlugins,
  removePluginFromServerStorage: mocks.removePluginFromServerStorage,
  updatePlugin: mocks.updatePlugin,
}));

vi.mock(import("src/ts/plugins/apiV3/developMode"), () => ({
  hotReloadPluginFiles: mocks.hotReloadPluginFiles,
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  hotReloading: ["plugin-a"],
  DBState: {
    db: {
      currentPluginProvider: "",
      plugins: [
        {
          name: "plugin-a",
          displayName: "Plugin A",
          version: 3,
          customLink: [{ link: "https://example.com/docs", hoverText: "Docs" }],
          updateURL: "",
          enabled: true,
          arguments: {},
          realArg: {},
          argMeta: {},
        },
      ],
    },
  },
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/NumberInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/SelectInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/OptionInput.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

import PluginSettings from "src/lib/Setting/Pages/PluginSettings.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("plugin settings runtime smoke", () => {
  beforeEach(() => {
    mocks.alertConfirm.mockClear();
    mocks.alertError.mockClear();
    mocks.alertMd.mockClear();
    mocks.alertSelect.mockClear();
    mocks.checkPluginUpdate.mockClear();
    mocks.importPlugin.mockClear();
    mocks.loadPlugins.mockClear();
    mocks.removePluginFromServerStorage.mockClear();
    mocks.updatePlugin.mockClear();
    mocks.hotReloadPluginFiles.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps custom plugin links on icon-btn primitive classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(PluginSettings, { target });
    await flushUi();

    const rowActionRail = document.querySelector(
      ".ds-settings-inline-actions.ds-settings-inline-actions-nowrap.ds-settings-shrink-0.action-rail",
    ) as HTMLElement | null;
    expect(rowActionRail).not.toBeNull();
    const cardShell = document.querySelector(
      ".ds-settings-section.ds-settings-card.panel-shell",
    ) as HTMLElement | null;
    expect(cardShell).not.toBeNull();
    const hotChip = document.querySelector(
      ".ds-settings-status-badge.control-chip.ds-settings-status-badge--warning",
    ) as HTMLElement | null;
    expect(hotChip).not.toBeNull();
    const footerActionRail = document.querySelector(
      ".ds-settings-label-muted.ds-settings-inline-actions.ds-settings-inline-actions-nowrap.action-rail",
    ) as HTMLElement | null;
    expect(footerActionRail).not.toBeNull();

    const docsLink = document.querySelector('a[title="Docs"]') as HTMLAnchorElement | null;
    expect(docsLink).not.toBeNull();
    expect(docsLink?.classList.contains("icon-btn")).toBe(true);
    expect(docsLink?.classList.contains("icon-btn--sm")).toBe(true);

    const actionButtons = Array.from(
      document.querySelectorAll("button.ds-ui-button.ds-settings-icon-action"),
    ) as HTMLButtonElement[];
    expect(actionButtons.length).toBeGreaterThan(0);
    actionButtons[0]?.click();
    await flushUi();
    expect(mocks.loadPlugins).toHaveBeenCalledTimes(1);
  });
});
