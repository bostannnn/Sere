import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  alertConfirm: vi.fn(async () => true),
  alertError: vi.fn(),
  exportChat: vi.fn(),
  importChat: vi.fn(),
  changeChatTo: vi.fn(),
}));

vi.mock(import("src/lang"), () => ({
  language: {
    chatList: "Chat List",
    removeConfirm: "Remove ",
    errors: {
      onlyOneChat: "Only one chat",
    },
  },
}));

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: mocks.alertConfirm,
  alertError: mocks.alertError,
}));

vi.mock(import("src/ts/characters"), () => ({
  exportChat: mocks.exportChat,
  importChat: mocks.importChat,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  changeChatTo: mocks.changeChatTo,
}));

vi.mock(import("src/ts/util"), () => ({
  findCharacterbyId: () => ({
    firstMessage: "hello",
  }),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        characters: [],
      },
    },
    selectedCharID: writable(0),
  };
});

import ChatList from "src/lib/Others/ChatList.svelte";
import { DBState, selectedCharID } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("chat list runtime smoke", () => {
  beforeEach(() => {
    mocks.alertConfirm.mockClear();
    mocks.alertError.mockClear();
    mocks.exportChat.mockClear();
    mocks.importChat.mockClear();
    mocks.changeChatTo.mockClear();

    DBState.db.characters = [
      {
        type: "character",
        name: "Test Character",
        chatPage: 0,
        chats: [
          { id: "chat-1", name: "Chat 1", message: [], note: "", localLore: [], fmIndex: -1 },
          { id: "chat-2", name: "Chat 2", message: [], note: "", localLore: [], fmIndex: -1 },
        ],
      },
    ];
    selectedCharID.set(0);
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies icon button primitive classes and preserves footer actions", async () => {
    const close = vi.fn();
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatList, { target, props: { close } });
    await flushUi();

    const closeButton = document.querySelector(
      '.ds-settings-icon-link.icon-btn.icon-btn--sm',
    ) as HTMLButtonElement | null;
    expect(closeButton).not.toBeNull();
    expect(closeButton?.type).toBe("button");
    expect(closeButton?.getAttribute("aria-label")).toBe("Close chat list");

    const firstRow = document.querySelector(".ds-chatlist-row") as HTMLElement | null;
    expect(firstRow).not.toBeNull();
    const rowActionButtons = Array.from(
      firstRow?.querySelectorAll("button.ds-settings-icon-link.icon-btn.icon-btn--sm") ?? [],
    ) as HTMLButtonElement[];
    expect(rowActionButtons.length).toBe(2);
    expect(rowActionButtons.every((button) => button.type === "button")).toBe(true);
    expect(firstRow?.getAttribute("role")).toBe("button");
    expect(firstRow?.getAttribute("tabindex")).toBe("0");

    rowActionButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushUi();
    expect(mocks.exportChat).toHaveBeenCalledWith(0);

    const footerButtons = Array.from(
      document.querySelectorAll(".ds-chatlist-footer .ds-settings-icon-link.icon-btn.icon-btn--sm"),
    ) as HTMLButtonElement[];
    expect(footerButtons.length).toBe(3);
    expect(footerButtons.every((button) => button.type === "button")).toBe(true);

    const beforeChatCount = DBState.db.characters[0].chats.length;
    footerButtons[0]?.click();
    await flushUi();
    expect(DBState.db.characters[0].chats.length).toBe(beforeChatCount + 1);
    expect(mocks.changeChatTo).toHaveBeenCalledWith(beforeChatCount);
    expect(close).toHaveBeenCalledTimes(1);

    footerButtons[1]?.click();
    await flushUi();
    expect(mocks.importChat).toHaveBeenCalledTimes(1);

    footerButtons[2]?.click();
    await flushUi();
    const editInputs = document.querySelectorAll("input.ds-ui-input");
    expect(editInputs.length).toBeGreaterThan(0);
  });

  it("keeps delete action behavior with icon-btn classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(ChatList, { target });
    await flushUi();

    const firstRow = document.querySelector(".ds-chatlist-row") as HTMLElement | null;
    expect(firstRow).not.toBeNull();
    const rowActionButtons = Array.from(
      firstRow?.querySelectorAll("button.ds-settings-icon-link.icon-btn.icon-btn--sm") ?? [],
    ) as HTMLButtonElement[];
    expect(rowActionButtons.length).toBe(2);

    rowActionButtons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushUi();

    expect(mocks.alertConfirm).toHaveBeenCalledTimes(1);
    expect(DBState.db.characters[0].chats.length).toBe(1);
    expect(mocks.changeChatTo).toHaveBeenCalledWith(0);
    expect(mocks.alertError).not.toHaveBeenCalled();
  });
});
