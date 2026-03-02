import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    hypaV3Modal: {
      titleLabel: "Hypa V3",
    },
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    hypaV3ModalOpen: writable(false),
    settingsOpen: writable(false),
    SettingsMenuIndex: writable(-1),
  };
});

import ModalHeader from "src/lib/Others/HypaV3Modal/modal-header.svelte";
import { hypaV3ModalOpen, settingsOpen, SettingsMenuIndex } from "src/ts/stores.svelte";

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

describe("hypa modal runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    settingsOpen.set(false);
    SettingsMenuIndex.set(-1);
    hypaV3ModalOpen.set(true);
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
      filterImportant: false,
      dropdownOpen: false,
      filterSelected: false,
      hypaV3Data: { summaries: [] },
    });

    await flushUi();

    const actionRail = target.querySelector(".hypa-modal-actions.action-rail");
    expect(actionRail).not.toBeNull();

    const actionButtons = [
      ...target.querySelectorAll(".hypa-modal-actions .hypa-modal-icon-btn.icon-btn.icon-btn--md"),
    ] as HTMLButtonElement[];
    expect(actionButtons.length).toBeGreaterThanOrEqual(5);

    actionButtons[2]?.click();
    await flushUi();
    expect(get(settingsOpen)).toBe(true);
    expect(get(SettingsMenuIndex)).toBe(2);
    expect(get(hypaV3ModalOpen)).toBe(false);

    hypaV3ModalOpen.set(true);
    actionButtons[actionButtons.length - 1]?.click();
    await flushUi();
    expect(get(hypaV3ModalOpen)).toBe(false);
  });

  it("keeps dropdown action surface on shared primitives", async () => {
    const dropdownTarget = document.createElement("div");
    document.body.appendChild(dropdownTarget);

    mountApp(ModalHeader, dropdownTarget, {
      searchState: null,
      filterImportant: false,
      dropdownOpen: true,
      filterSelected: true,
      hypaV3Data: { summaries: [] },
    });

    await flushUi();

    expect(
      dropdownTarget.querySelector(".hypa-modal-dropdown-panel.panel-shell"),
    ).not.toBeNull();
    expect(
      dropdownTarget.querySelector(".hypa-modal-dropdown-actions.action-rail"),
    ).not.toBeNull();
  });
});
