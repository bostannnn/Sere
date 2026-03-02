import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

vi.mock(import("src/lang"), () => ({
  language: {
    menu: "Menu",
    search: "Search",
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        characters: [{ name: "Richard" }, { name: "Eva" }],
      },
    },
    MobileGUIStack: writable(0),
    MobileSearch: writable(""),
    selectedCharID: writable(-1),
    SettingsMenuIndex: writable(-1),
    MobileSideBar: writable(0),
  };
});

import MobileHeader from "src/lib/Mobile/MobileHeader.svelte";
import {
  MobileGUIStack,
  MobileSearch,
  MobileSideBar,
  selectedCharID,
  SettingsMenuIndex,
} from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mobile header runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    selectedCharID.set(-1);
    MobileSideBar.set(0);
    MobileGUIStack.set(0);
    SettingsMenuIndex.set(-1);
    MobileSearch.set("");

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MobileHeader, { target });
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies icon-btn primitive and preserves character/sidebar header actions", async () => {
    selectedCharID.set(0);
    MobileSideBar.set(0);
    MobileGUIStack.set(0);
    await flushUi();

    const characterBackButton = document.querySelector('button[aria-label="Back"]') as HTMLButtonElement | null;
    expect(characterBackButton).not.toBeNull();
    expect(characterBackButton?.classList.contains("icon-btn")).toBe(true);
    expect(characterBackButton?.type).toBe("button");
    expect(characterBackButton?.title).toBe("Back");

    const openMenuButton = document.querySelector('button[aria-label="Open menu"]') as HTMLButtonElement | null;
    expect(openMenuButton).not.toBeNull();
    expect(openMenuButton?.classList.contains("icon-btn")).toBe(true);
    expect(openMenuButton?.type).toBe("button");
    expect(openMenuButton?.title).toBe("Open menu");

    const headerActionRail = document.querySelector(".ds-mobile-header-actions.action-rail") as HTMLElement | null;
    expect(headerActionRail).not.toBeNull();

    openMenuButton?.click();
    await flushUi();
    expect(get(MobileSideBar)).toBe(1);

    const sidebarBackButton = document.querySelector('button[aria-label="Back"]') as HTMLButtonElement | null;
    expect(sidebarBackButton).not.toBeNull();
    expect(sidebarBackButton?.textContent ?? "").not.toContain("Open menu");
    expect(sidebarBackButton?.type).toBe("button");
    expect(sidebarBackButton?.title).toBe("Back");
    sidebarBackButton?.click();
    await flushUi();
    expect(get(MobileSideBar)).toBe(0);

    const finalBackButton = document.querySelector('button[aria-label="Back"]') as HTMLButtonElement | null;
    finalBackButton?.click();
    await flushUi();
    expect(get(selectedCharID)).toBe(-1);
  });

  it("applies control-field to mobile search and keeps settings-back behavior", async () => {
    selectedCharID.set(-1);
    MobileGUIStack.set(2);
    SettingsMenuIndex.set(3);
    await flushUi();

    const settingsBackButton = document.querySelector('button[aria-label="Back"]') as HTMLButtonElement | null;
    expect(settingsBackButton).not.toBeNull();
    expect(settingsBackButton?.classList.contains("icon-btn")).toBe(true);
    expect(settingsBackButton?.type).toBe("button");
    expect(settingsBackButton?.title).toBe("Back");

    settingsBackButton?.click();
    await flushUi();
    expect(get(SettingsMenuIndex)).toBe(-1);

    MobileGUIStack.set(1);
    await flushUi();
    const searchInput = document.querySelector('input[placeholder="Search..."]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    expect(searchInput?.classList.contains("control-field")).toBe(true);

    searchInput!.value = "eva";
    searchInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();
    expect(get(MobileSearch)).toBe("eva");
  });
});
