import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    home: "Home",
    character: "Characters",
    settings: "Settings",
    basicInfo: "Basic Info",
    characterDisplay: "Display",
    loreBook: "Lorebook",
    scripts: "Scripts",
    advanced: "Advanced",
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    CharConfigSubMenu: writable(0),
    MobileGUIStack: writable(0),
    MobileSideBar: writable(0),
    PlaygroundStore: writable(0),
    selectedCharID: writable(-1),
  };
});

import MobileFooter from "src/lib/Mobile/MobileFooter.svelte";
import {
  CharConfigSubMenu,
  MobileGUIStack,
  MobileSideBar,
  selectedCharID,
} from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mobile footer runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    selectedCharID.set(-1);
    MobileGUIStack.set(0);
    MobileSideBar.set(1);
    CharConfigSubMenu.set(0);

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MobileFooter, { target });
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("uses segmented primitives for root mobile nav and preserves workspace switching", async () => {
    await flushUi();

    const rootTrack = document.querySelector(".ds-mobile-nav-track-root.action-rail") as HTMLElement | null;
    expect(rootTrack).not.toBeNull();

    const rootButtons = Array.from(
      document.querySelectorAll(".ds-mobile-nav-track-root .ds-mobile-nav-btn.ds-mobile-nav-btn-root"),
    ) as HTMLButtonElement[];
    expect(rootButtons.length).toBe(4);
    expect(rootButtons.every((button) => button.type === "button")).toBe(true);
    expect(rootButtons[0]?.title).toBe("Home");
    expect(rootButtons[0]?.getAttribute("aria-label")).toBe("Go to Home");
    expect(rootButtons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(rootButtons[3]?.title).toBe("More");

    rootButtons[1]?.click();
    await flushUi();
    expect(get(MobileGUIStack)).toBe(1);
    expect(get(MobileSideBar)).toBe(0);
    expect(rootButtons[1]?.getAttribute("aria-pressed")).toBe("true");

    rootButtons[2]?.click();
    await flushUi();
    expect(get(MobileGUIStack)).toBe(2);
    expect(get(MobileSideBar)).toBe(0);
  });

  it("keeps character submenu switching intact when character sidebar nav is open", async () => {
    selectedCharID.set(0);
    MobileSideBar.set(2);
    CharConfigSubMenu.set(0);
    await flushUi();

    const rootTrack = document.querySelector(".ds-mobile-nav-track-root.seg-tabs");
    expect(rootTrack).toBeNull();

    const charButtons = Array.from(
      document.querySelectorAll(".ds-mobile-nav-track-char .ds-mobile-nav-btn"),
    ) as HTMLButtonElement[];
    expect(charButtons.length).toBeGreaterThanOrEqual(7);
    expect(charButtons.every((button) => button.type === "button")).toBe(true);
    expect(charButtons[0]?.title).toBe("Basic Info");
    expect(charButtons[0]?.getAttribute("aria-pressed")).toBe("true");

    charButtons[2]?.click();
    await flushUi();
    expect(get(CharConfigSubMenu)).toBe(3);
    expect(charButtons[2]?.getAttribute("aria-pressed")).toBe("true");

    charButtons[3]?.click();
    await flushUi();
    expect(get(CharConfigSubMenu)).toBe(8);
    expect(charButtons[3]?.title).toBe("Rulebooks");
    expect(charButtons[3]?.getAttribute("aria-label")).toBe("Rulebooks");
    expect(charButtons[3]?.getAttribute("aria-pressed")).toBe("true");

    charButtons[5]?.click();
    await flushUi();
    expect(get(CharConfigSubMenu)).toBe(4);
  });
});
