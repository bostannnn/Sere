import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

const mocks = vi.hoisted(() => ({
  alertInput: vi.fn(async () => "Renamed bookmark"),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const bookmarkListOpen = writable(true);
  const ScrollToMessageStore = { value: -1 };
  const DBState = {
    db: {
      characters: [
        {
          type: "character",
          name: "Alpha",
          image: "",
          largePortrait: false,
          chatPage: 0,
          chats: [
            {
              bookmarks: ["m-1", "m-2"],
              bookmarkNames: {},
              message: [
                { chatId: "m-1", role: "char", data: "first bookmark message" },
                { chatId: "m-2", role: "char", data: "second bookmark message" },
              ],
            },
          ],
        },
      ],
    },
  };

  return {
    DBState,
    selectedCharID,
    bookmarkListOpen,
    ScrollToMessageStore,
    createSimpleCharacter: () => ({ name: "Alpha" }),
  };
});

vi.mock(import("src/ts/characters"), () => ({
  getCharImage: () => "",
}));

vi.mock(import("src/ts/util"), () => ({
  findCharacterbyId: () => null,
  getUserName: () => "User",
  getUserIcon: () => "",
}));

vi.mock(import("src/lang"), () => ({
  language: {
    bookmarks: "Bookmarks",
    noBookmarks: "No bookmarks",
    collapseAll: "Collapse all",
    expandAll: "Expand all",
    goToChat: "Go to chat",
    bookmarkAskNameOrCancel: "Enter bookmark name",
  },
}));

vi.mock(import("src/ts/alert"), () => ({
  alertInput: mocks.alertInput,
}));

vi.mock(import("src/lib/ChatScreens/Chat.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import BookmarkList from "src/lib/Others/BookmarkList.svelte";
import { bookmarkListOpen, DBState, ScrollToMessageStore } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("bookmark list runtime smoke", () => {
  beforeEach(() => {
    mocks.alertInput.mockClear();
    document.body.innerHTML = "";
    DBState.db.characters[0].chats[0].bookmarks = ["m-1", "m-2"];
    DBState.db.characters[0].chats[0].bookmarkNames = {};
    bookmarkListOpen.set(true);
    ScrollToMessageStore.value = -1;
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("renders bookmark rows with primitive classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(BookmarkList, { target });
    await flushUi();

    const headerActions = document.querySelector(".ds-bookmark-header-actions") as HTMLElement | null;
    const rowActions = document.querySelector(".ds-bookmark-row-actions") as HTMLElement | null;
    const bookmarkItem = document.querySelector(".ds-bookmark-item") as HTMLElement | null;
    expect(headerActions).not.toBeNull();
    expect(rowActions).not.toBeNull();
    expect(bookmarkItem).not.toBeNull();
    expect(headerActions?.classList.contains("action-rail")).toBe(true);
    expect(rowActions?.classList.contains("action-rail")).toBe(true);
    expect(bookmarkItem?.classList.contains("panel-shell")).toBe(true);

    const headerButtons = [...(headerActions?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];
    expect(headerButtons.length).toBeGreaterThan(0);
    expect(headerButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(headerButtons.every((button) => button.classList.contains("icon-btn--md"))).toBe(true);
    expect(headerButtons.every((button) => button.type === "button")).toBe(true);

    const rowButtons = [...(rowActions?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];
    expect(rowButtons.length).toBe(3);
    expect(rowButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(rowButtons.every((button) => button.classList.contains("icon-btn--sm"))).toBe(true);
    expect(rowButtons.every((button) => button.type === "button")).toBe(true);

    const toggleRow = document.querySelector(".ds-bookmark-toggle") as HTMLElement | null;
    expect(toggleRow).not.toBeNull();
    expect(toggleRow?.getAttribute("role")).toBe("button");
    expect(toggleRow?.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps bookmark actions functional after primitive convergence", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(BookmarkList, { target });
    await flushUi();

    const firstRowActions = document.querySelector(".ds-bookmark-row-actions") as HTMLElement | null;
    expect(firstRowActions).not.toBeNull();
    const [goButton, renameButton, removeButton] = [...(firstRowActions?.querySelectorAll("button") ?? [])] as HTMLButtonElement[];
    expect(goButton).toBeDefined();
    expect(renameButton).toBeDefined();
    expect(removeButton).toBeDefined();

    goButton.click();
    await flushUi();
    expect(ScrollToMessageStore.value).toBe(0);
    expect(get(bookmarkListOpen)).toBe(false);

    bookmarkListOpen.set(true);
    await flushUi();

    renameButton.click();
    await flushUi();
    expect(mocks.alertInput).toHaveBeenCalledTimes(1);
    expect(DBState.db.characters[0].chats[0].bookmarkNames["m-1"]).toBe("Renamed bookmark");

    removeButton.click();
    await flushUi();
    expect(DBState.db.characters[0].chats[0].bookmarks.includes("m-1")).toBe(false);
    expect(DBState.db.characters[0].chats[0].bookmarkNames["m-1"]).toBeUndefined();

    const toggleRow = document.querySelector(".ds-bookmark-toggle") as HTMLElement | null;
    expect(toggleRow?.getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps empty bookmark state on empty-state primitive", async () => {
    DBState.db.characters[0].chats[0].bookmarks = [];
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(BookmarkList, { target });
    await flushUi();

    const emptyState = document.querySelector(".ds-bookmark-empty.empty-state") as HTMLElement | null;
    expect(emptyState).not.toBeNull();
    expect(emptyState?.textContent).toContain("No bookmarks");
    expect(document.querySelector(".ds-bookmark-item")).toBeNull();
  });
});
