import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/lang"), () => ({
  language: {
    Chat: "Chat",
    character: "Character",
  },
}));

vi.mock(import("src/ts/lite"), async () => {
  const { writable } = await import("svelte/store");
  return { isLite: writable(false) };
});

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        characters: [{ name: "Richard" }],
      },
    },
    MobileGUIStack: writable(0),
    MobileSideBar: writable(1),
    selectedCharID: writable(0),
  };
});

vi.mock(import("src/lib/Setting/Settings.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/Mobile/MobileCharacters.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/ChatScreens/ChatScreen.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/CharConfig.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/SideChatList.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));
vi.mock(import("src/lib/SideBars/DevTool.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import MobileBody from "src/lib/Mobile/MobileBody.svelte";
import { isLite } from "src/ts/lite";
import { MobileGUIStack, MobileSideBar, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mobile body runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    selectedCharID.set(0);
    MobileSideBar.set(1);
    MobileGUIStack.set(0);
    isLite.set(false);

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MobileBody, { target });
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("uses segmented topbar primitives and keeps sidebar mode toggles", async () => {
    await flushUi();

    const topbar = document.querySelector(".ds-mobile-topbar.seg-tabs") as HTMLElement | null;
    expect(topbar).not.toBeNull();

    const buttons = Array.from(
      document.querySelectorAll(".ds-mobile-topbar .ds-mobile-topbar-btn.seg-tab"),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(3);
    expect(buttons[2]?.classList.contains("icon-btn")).toBe(true);
    expect(buttons.every((button) => button.type === "button")).toBe(true);
    expect(buttons[0]?.title).toBe("Chat");
    expect(buttons[0]?.getAttribute("aria-label")).toBe("Chat");
    expect(buttons[0]?.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[2]?.title).toBe("Developer tools");
    expect(buttons[2]?.getAttribute("aria-label")).toBe("Developer tools");

    buttons[1]?.click();
    await flushUi();
    expect(get(MobileSideBar)).toBe(2);
    expect(buttons[1]?.getAttribute("aria-pressed")).toBe("true");

    buttons[2]?.click();
    await flushUi();
    expect(get(MobileSideBar)).toBe(3);
    expect(buttons[2]?.getAttribute("aria-pressed")).toBe("true");

    buttons[0]?.click();
    await flushUi();
    expect(get(MobileSideBar)).toBe(1);
  });

  it("hides the sidepanel topbar when lite mode is enabled", async () => {
    await flushUi();
    isLite.set(true);
    await flushUi();

    const topbar = document.querySelector(".ds-mobile-topbar.seg-tabs");
    expect(topbar).toBeNull();
  });
});
