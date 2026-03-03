import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertError: vi.fn(),
  alertNormal: vi.fn(),
  downloadFile: vi.fn(async () => {}),
  exportRegex: vi.fn(),
  getFileSrc: vi.fn(async () => ""),
  importRegex: vi.fn(async (value: unknown) => value),
  saveAsset: vi.fn(async () => "assets/foo.png"),
  selectMultipleFile: vi.fn(async () => null),
}));

vi.mock(import("uuid"), () => ({
  v4: () => "folder-id",
}));

vi.mock(import("src/lang"), () => ({
  language: {
    basicInfo: "Basic",
    loreBook: "Lorebook",
    regexScript: "Regex",
    triggerScript: "Trigger",
    additionalAssets: "Assets",
    name: "Name",
    description: "Description",
    namespace: "Namespace",
    hideChatIcon: "Hide Chat Icon",
    customPromptTemplateToggle: "Custom Prompt",
    backgroundHTML: "Background HTML",
    lowLevelAccess: "Low Level",
    value: "Value",
    noData: "No data",
    successExport: "Export success",
  },
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      useAdditionalAssetsPreview: false,
    },
  },
}));

vi.mock(import("src/lib/SideBars/LoreBook/LoreBookList.svelte"), async () => ({
  default: (await import("./test-stubs/LoreBookListStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/TextAreaInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/UI/GUI/CheckInput.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Scripts/RegexList.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/SideBars/Scripts/TriggerList.svelte"), async () => ({
  default: (await import("./test-stubs/BindableFieldStub.svelte")).default,
}));

vi.mock(import("src/lib/Others/Help.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/ts/process/lorebook.svelte"), () => ({
  convertExternalLorebook: () => [],
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  getFileSrc: mocks.getFileSrc,
  saveAsset: mocks.saveAsset,
  downloadFile: mocks.downloadFile,
}));

vi.mock(import("src/ts/alert"), () => ({
  alertNormal: mocks.alertNormal,
  alertError: mocks.alertError,
}));

vi.mock(import("src/ts/process/scripts"), () => ({
  exportRegex: mocks.exportRegex,
  importRegex: mocks.importRegex,
}));

vi.mock(import("src/ts/util"), () => ({
  selectMultipleFile: mocks.selectMultipleFile,
}));

import ModuleMenu from "src/lib/Setting/Pages/Module/ModuleMenu.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function getSubTabs() {
  return Array.from(document.querySelectorAll(".ds-settings-tab")) as HTMLButtonElement[];
}

function buildModule() {
  return {
    name: "Test module",
    description: "Module description",
    namespace: "",
    hideIcon: false,
    customModuleToggle: "",
    backgroundEmbedding: "",
    lorebook: [] as unknown[],
    regex: [] as unknown[],
    trigger: [] as unknown[],
    assets: [] as unknown[],
    lowLevelAccess: false,
  };
}

describe("module menu runtime smoke", () => {
  beforeEach(() => {
    mocks.alertError.mockClear();
    mocks.alertNormal.mockClear();
    mocks.downloadFile.mockClear();
    mocks.exportRegex.mockClear();
    mocks.getFileSrc.mockClear();
    mocks.importRegex.mockClear();
    mocks.saveAsset.mockClear();
    mocks.selectMultipleFile.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps lorebook and regex actions on compact icon button primitives", async () => {
    const currentModule = buildModule();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ModuleMenu, { target, props: { currentModule } });
    await flushUi();

    const tabs = getSubTabs();
    expect(tabs.length).toBe(5);

    tabs[1]?.click();
    await flushUi();

    const lorebookActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(lorebookActionRail).not.toBeNull();

    const lorebookActions = Array.from(
      document.querySelectorAll(".ds-settings-inline-actions .ds-settings-icon-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(lorebookActions.length).toBe(4);
    lorebookActions[0]?.click();
    await flushUi();
    expect(currentModule.lorebook.length).toBe(1);

    tabs[2]?.click();
    await flushUi();

    const regexActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(regexActionRail).not.toBeNull();

    const regexActions = Array.from(
      document.querySelectorAll(".ds-settings-inline-actions .ds-settings-icon-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(regexActions.length).toBe(3);
    regexActions[0]?.click();
    await flushUi();
    expect(currentModule.regex.length).toBe(1);

    regexActions[1]?.click();
    await flushUi();
    expect(mocks.exportRegex).toHaveBeenCalledTimes(1);

    regexActions[2]?.click();
    await flushUi();
    expect(mocks.importRegex).toHaveBeenCalledTimes(1);
  });

  it("keeps assets tab empty-state primitive and compact icon actions", async () => {
    const currentModule = buildModule();

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ModuleMenu, { target, props: { currentModule } });
    await flushUi();

    const tabs = getSubTabs();
    tabs[4]?.click();
    await flushUi();

    const emptyState = document.querySelector(".ds-settings-empty-state.empty-state");
    expect(emptyState).not.toBeNull();

    const addAssetButton = document.querySelector(
      ".ds-settings-table-action-head .ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(addAssetButton).not.toBeNull();
    const assetsTableShell = document.querySelector(
      ".ds-settings-card.ds-settings-table-container",
    ) as HTMLElement | null;
    expect(assetsTableShell).not.toBeNull();

    await unmount(app);
    app = undefined;

    const currentModuleWithAsset = buildModule();
    currentModuleWithAsset.assets = [["foo.png", "assets/foo.png", "png"]];
    const secondTarget = document.createElement("div");
    document.body.appendChild(secondTarget);
    app = mount(ModuleMenu, { target: secondTarget, props: { currentModule: currentModuleWithAsset } });
    await flushUi();

    getSubTabs()[4]?.click();
    await flushUi();

    const removeAssetButton = document.querySelector(
      ".ds-settings-table .ds-ui-button--danger.ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(removeAssetButton).not.toBeNull();
    removeAssetButton?.click();
    await flushUi();
    expect(currentModuleWithAsset.assets.length).toBe(0);
  });
});
