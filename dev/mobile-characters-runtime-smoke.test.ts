import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  addCharacter: vi.fn(),
  changeChar: vi.fn(),
  getCharImage: vi.fn(() => ""),
}));

vi.mock(import("src/ts/characters"), () => ({
  addCharacter: mocks.addCharacter,
  changeChar: mocks.changeChar,
  getCharImage: mocks.getCharImage,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        characters: [],
      },
    },
    MobileSearch: writable(""),
  };
});

import MobileCharacters from "src/lib/Mobile/MobileCharacters.svelte";
import { DBState, MobileSearch } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mobile characters runtime smoke", () => {
  beforeEach(() => {
    mocks.addCharacter.mockClear();
    mocks.changeChar.mockClear();
    mocks.getCharImage.mockClear();

    DBState.db.characters = [
      {
        name: "Alpha",
        image: "",
        chats: [{}, {}],
        lastInteraction: 1000,
      },
      {
        name: "Beta",
        image: "",
        chats: [{}],
        lastInteraction: 2000,
      },
    ];
    MobileSearch.set("");
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies list-shell and preserves filter/select behavior", async () => {
    const endGrid = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MobileCharacters, { target, props: { endGrid } });
    await flushUi();

    const list = document.querySelector('[data-testid="mobile-char-list"]') as HTMLElement | null;
    expect(list).not.toBeNull();
    expect(list?.classList.contains("list-shell")).toBe(true);

    const initialRows = [...document.querySelectorAll(".ds-mobile-char-row")];
    expect(initialRows.length).toBe(2);

    MobileSearch.set("beta");
    await flushUi();

    const filteredRows = [...document.querySelectorAll(".ds-mobile-char-row")] as HTMLButtonElement[];
    expect(filteredRows.length).toBe(1);
    expect((filteredRows[0]?.textContent ?? "").includes("Beta")).toBe(true);
    expect(filteredRows[0]?.type).toBe("button");
    expect(filteredRows[0]?.title).toBe("Open Beta");
    expect(filteredRows[0]?.getAttribute("aria-label")).toBe("Open Beta");
    const nestedButtons = filteredRows[0]?.querySelectorAll("button") ?? [];
    expect(nestedButtons.length).toBe(0);

    const rowBarIcon = filteredRows[0]?.querySelector(".sidebar-bar-icon-button") as HTMLElement | null;
    expect(rowBarIcon).not.toBeNull();
    expect(rowBarIcon?.tagName).toBe("DIV");
    expect(rowBarIcon?.getAttribute("aria-hidden")).toBe("true");
    expect(rowBarIcon?.classList.contains("sidebar-bar-icon-static")).toBe(true);

    filteredRows[0]?.click();
    await flushUi();

    expect(mocks.changeChar).toHaveBeenCalledWith(1);
    expect(endGrid).toHaveBeenCalledTimes(1);
  });

  it("renders empty-state and icon-btn fab in grid mode", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(MobileCharacters, { target, props: { gridMode: true } });
    await flushUi();

    MobileSearch.set("no-match");
    await flushUi();

    const empty = document.querySelector('[data-testid="mobile-char-empty"]') as HTMLElement | null;
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains("empty-state")).toBe(true);

    const fab = document.querySelector(".ds-mobile-char-fab") as HTMLButtonElement | null;
    expect(fab).not.toBeNull();
    expect(fab?.classList.contains("icon-btn")).toBe(true);
    expect(fab?.classList.contains("icon-btn--md")).toBe(true);
    expect(fab?.type).toBe("button");
    expect(fab?.title).toBe("Add character");
    expect(fab?.getAttribute("aria-label")).toBe("Add character");

    fab?.click();
    await flushUi();
    expect(mocks.addCharacter).toHaveBeenCalledTimes(1);
  });
});
