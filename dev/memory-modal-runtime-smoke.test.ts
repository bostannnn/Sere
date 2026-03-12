import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    memoryModal: {
      titleLabel: "Hypa V3",
    },
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    settingsOpen: writable(false),
    SettingsMenuIndex: writable(-1),
  };
});

import ModalHeader from "src/lib/Others/MemoryModal/modal-header.svelte";
import { settingsOpen, SettingsMenuIndex } from "src/ts/stores.svelte";

let mountedApps: Array<Record<string, unknown>> = [];

async function flushUi() {
  await tick();
  await Promise.resolve();
}

function mountApp(component: unknown, target: HTMLElement, props: Record<string, unknown>) {
  const app = mount(component as never, { target, props });
  mountedApps.push(app);
  return app;
}

describe("memory modal runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    settingsOpen.set(false);
    SettingsMenuIndex.set(-1);
    mountedApps = [];
  });

  afterEach(async () => {
    for (const app of mountedApps) {
      await unmount(app);
    }
    mountedApps = [];
  });

  it("keeps modal-header action controls on shared primitive classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    mountApp(ModalHeader, target, {
      searchState: null,
      dropdownOpen: false,
      filterSelected: false,
      memoryData: { summaries: [] },
    });

    await flushUi();

    const actionRail = target.querySelector(".memory-header-actions.action-rail");
    expect(actionRail).not.toBeNull();

    const actionButtons = [
      ...target.querySelectorAll(".memory-header-actions .memory-header-icon-btn.icon-btn.icon-btn--md"),
    ] as HTMLButtonElement[];
    expect(actionButtons.length).toBe(2);

    const dropdownButton = actionButtons.find((button) => button.getAttribute("title") === "More actions");
    expect(dropdownButton).toBeDefined();
    dropdownButton?.click();
    await flushUi();

    const settingsButton = Array.from(target.querySelectorAll(".memory-header-menu-item")).find(
      (button) => button.textContent?.includes("Memory settings"),
    ) as HTMLButtonElement | undefined;
    expect(settingsButton).toBeDefined();
    settingsButton?.click();
    await flushUi();

    expect(get(settingsOpen)).toBe(true);
    expect(get(SettingsMenuIndex)).toBe(2);
  });

  it("keeps dropdown action surface on shared primitives", async () => {
    const dropdownTarget = document.createElement("div");
    document.body.appendChild(dropdownTarget);

    mountApp(ModalHeader, dropdownTarget, {
      searchState: null,
      dropdownOpen: true,
      filterSelected: true,
      memoryData: { summaries: [] },
    });

    await flushUi();

    expect(
      dropdownTarget.querySelector(".memory-header-menu-panel.panel-shell"),
    ).not.toBeNull();
    expect(
      dropdownTarget.querySelector(".memory-header-menu-actions.action-rail"),
    ).not.toBeNull();
  });

  it("does not reintroduce legacy star/tag/translation actions", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    mountApp(ModalHeader, target, {
      activeTab: "summary",
      searchState: null,
      dropdownOpen: true,
      filterSelected: false,
      memoryData: { summaries: [] },
      bulkEditState: { isEnabled: false, selectedSummaries: new Set(), selectedCategory: "", bulkSelectInput: "" },
    });

    await flushUi();

    const headerText = target.textContent?.toLowerCase() ?? "";
    expect(headerText).not.toContain("star");
    expect(headerText).not.toContain("favorite");
    expect(headerText).not.toContain("tag");
    expect(headerText).not.toContain("translate");
  });
});
