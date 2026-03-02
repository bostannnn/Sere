import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertCardExport: vi.fn(async () => ({ type: "" })),
  alertConfirm: vi.fn(async () => true),
  alertError: vi.fn(),
  changeToPreset: vi.fn(),
  copyPreset: vi.fn(),
  downloadPreset: vi.fn(),
  importPreset: vi.fn(),
  changeUserPersona: vi.fn(),
}));

vi.mock(import("src/lang"), () => ({
  language: {
    presets: "Presets",
    quickPreset: "Quick preset",
    removeConfirm: "Remove ",
    errors: { onlyOneChat: "Only one preset" },
    loreBook: "Lorebook",
    persona: "Persona",
  },
}));

vi.mock(import("src/ts/alert"), () => ({
  alertCardExport: mocks.alertCardExport,
  alertConfirm: mocks.alertConfirm,
  alertError: mocks.alertError,
}));

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  changeToPreset: mocks.changeToPreset,
  copyPreset: mocks.copyPreset,
  downloadPreset: mocks.downloadPreset,
  importPreset: mocks.importPreset,
}));

vi.mock(import("src/ts/process/templates/templates"), () => ({
  prebuiltPresets: {
    OAI2: {
      name: "Template Preset",
      image: "",
    },
  },
}));

vi.mock(import("src/ts/persona"), () => ({
  changeUserPersona: mocks.changeUserPersona,
}));

vi.mock(import("src/lib/Others/PromptDiffModal.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

vi.mock(import("src/ts/stores.svelte"), () => ({
  DBState: {
    db: {
      botPresets: [],
      botPresetsId: 0,
      showPromptComparison: false,
      loreBook: [],
      loreBookPage: 0,
      personas: [],
      selectedPersona: 0,
    },
  },
}));

import botpreset from "src/lib/Setting/botpreset.svelte";
import lorepreset from "src/lib/Setting/lorepreset.svelte";
import listedPersona from "src/lib/Setting/listedPersona.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("settings preset modal runtime smoke", () => {
  beforeEach(() => {
    mocks.alertCardExport.mockClear();
    mocks.alertConfirm.mockClear();
    mocks.alertError.mockClear();
    mocks.changeToPreset.mockClear();
    mocks.copyPreset.mockClear();
    mocks.downloadPreset.mockClear();
    mocks.importPreset.mockClear();
    mocks.changeUserPersona.mockClear();

    DBState.db.botPresets = [
      { name: "Preset A", image: "" },
      { name: "Preset B", image: "" },
    ];
    DBState.db.botPresetsId = 0;
    DBState.db.showPromptComparison = false;
    DBState.db.loreBook = [
      { name: "Lore A", data: [] },
      { name: "Lore B", data: [] },
    ];
    DBState.db.loreBookPage = 0;
    DBState.db.personas = [
      { id: "persona-1", name: "Persona A", note: "A" },
      { id: "persona-2", name: "Persona B", note: "B" },
    ];
    DBState.db.selectedPersona = 0;
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("keeps bot preset modal actions with icon-btn primitives", async () => {
    const close = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(botpreset, { target, props: { close } });
    await flushUi();

    const closeButton = document.querySelector(
      ".ds-settings-modal-header .ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    const headerActionRail = document.querySelector(
      ".ds-settings-grow-min.ds-settings-inline-actions.ds-settings-inline-actions-end.action-rail",
    ) as HTMLElement | null;
    expect(headerActionRail).not.toBeNull();

    const rowActionButtons = Array.from(
      document.querySelectorAll(".ds-settings-modal-list-row .ds-settings-icon-link.icon-btn.icon-btn--sm"),
    ) as HTMLElement[];
    expect(rowActionButtons.length).toBe(6);
    const indexChips = Array.from(
      document.querySelectorAll(".ds-settings-index-badge.control-chip"),
    ) as HTMLElement[];
    expect(indexChips.length).toBeGreaterThan(0);
    expect(indexChips[0]?.textContent?.trim()).toBe("1");

    rowActionButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushUi();
    expect(mocks.copyPreset).toHaveBeenCalledWith(0);

    rowActionButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushUi();
    expect(mocks.alertCardExport).toHaveBeenCalledTimes(1);
    expect(mocks.downloadPreset).toHaveBeenCalledWith(0, "risupreset");

    const allActionButtons = Array.from(
      document.querySelectorAll(".ds-settings-icon-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    const footerButtons = allActionButtons.slice(-3);
    expect(footerButtons.length).toBe(3);
    const footerActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(footerActionRail).not.toBeNull();

    const beforePresetCount = DBState.db.botPresets.length;
    footerButtons[0]?.click();
    await flushUi();
    expect(DBState.db.botPresets.length).toBe(beforePresetCount + 1);

    footerButtons[1]?.click();
    await flushUi();
    expect(mocks.importPreset).toHaveBeenCalledTimes(1);

    closeButton?.click();
    await flushUi();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("keeps lore preset modal icon actions and add/remove behavior", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(lorepreset, { target });
    await flushUi();

    const closeButton = document.querySelector(
      ".ds-settings-modal-header .ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    const headerActionRail = document.querySelector(
      ".ds-settings-grow-min.ds-settings-inline-actions.ds-settings-inline-actions-end.action-rail",
    ) as HTMLElement | null;
    expect(headerActionRail).not.toBeNull();

    const deleteButton = document.querySelector(
      ".ds-settings-modal-list-row .ds-settings-icon-link.icon-btn.icon-btn--sm",
    ) as HTMLElement | null;
    expect(deleteButton).not.toBeNull();
    deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushUi();
    expect(DBState.db.loreBook.length).toBe(1);

    const allActionButtons = Array.from(
      document.querySelectorAll(".ds-settings-icon-action.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    const footerButtons = allActionButtons.slice(-2);
    expect(footerButtons.length).toBe(2);
    const footerActionRail = document.querySelector(
      ".ds-settings-inline-actions.action-rail",
    ) as HTMLElement | null;
    expect(footerActionRail).not.toBeNull();
    footerButtons[0]?.click();
    await flushUi();
    expect(DBState.db.loreBook.length).toBe(2);
  });

  it("keeps listed persona modal close and selection behavior", async () => {
    const close = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(listedPersona, { target, props: { close } });
    await flushUi();

    const closeButton = document.querySelector(
      ".ds-settings-modal-header .ds-settings-icon-action.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    const headerActionRail = document.querySelector(
      ".ds-settings-grow-min.ds-settings-inline-actions.ds-settings-inline-actions-end.action-rail",
    ) as HTMLElement | null;
    expect(headerActionRail).not.toBeNull();

    const rows = Array.from(
      document.querySelectorAll(".ds-settings-modal-list-row"),
    ) as HTMLButtonElement[];
    expect(rows.length).toBe(2);
    rows[1]?.click();
    await flushUi();

    expect(mocks.changeUserPersona).toHaveBeenCalledWith(1);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
