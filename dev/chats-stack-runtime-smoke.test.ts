import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const shared = vi.hoisted(() => ({
  chatFoldedStateMessageIndex: { index: -1 },
}));

vi.mock(import("src/ts/characters"), () => ({
  getCharImage: () => "",
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    createSimpleCharacter: (character: unknown) => character,
    selectedCharID: writable(0),
    ReloadChatPointer: writable({}),
    DBState: {
      db: {
        autoScrollToNewMessage: true,
        alwaysScrollToNewMessage: false,
        characters: [
          {
            chaId: "char-chat-1",
            name: "Chat Character",
            image: "",
            chatPage: 0,
            chats: [
              { id: "chat-room-1", message: [] },
            ],
          },
        ],
      },
    },
  };
});

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  chatFoldedStateMessageIndex: shared.chatFoldedStateMessageIndex,
}));

vi.mock(import("src/lib/ChatScreens/Chat.svelte"), async () => ({
  default: (await import("./test-stubs/ChatItemProbeStub.svelte")).default,
}));

import Chats from "src/lib/ChatScreens/Chats.svelte";
import { ReloadChatPointer } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function makeMessages(total: number) {
  return Array.from({ length: total }, (_, index) => ({
    role: index % 2 === 0 ? "char" : "user",
    data: `Message ${index + 1}`,
    chatId: `msg-${index + 1}`,
    disabled: false,
  }));
}

function getRenderedIndices() {
  return Array.from(document.querySelectorAll('[data-testid="chat-item-probe"]')).map((el) => {
    const value = (el as HTMLElement).dataset.idx;
    return Number(value ?? "-1");
  });
}

describe("chats stack runtime smoke", () => {
  beforeEach(() => {
    shared.chatFoldedStateMessageIndex.index = -1;
    ReloadChatPointer.set({});
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("renders newest messages first in the reverse chat stack", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(Chats, {
      target,
      props: {
        messages: makeMessages(3),
        currentCharacter: {
          name: "Chat Character",
          image: "",
          chats: [{ id: "chat-room-1" }],
          chatPage: 0,
        },
        onReroll: () => {},
        unReroll: () => {},
        currentUsername: "User",
        userIcon: "",
        loadPages: 10,
      },
    });

    await flushUi();

    const stack = document.querySelector(".ds-chat-list-stack") as HTMLElement | null;
    expect(stack).not.toBeNull();
    expect(stack?.classList.contains("list-shell")).toBe(false);
    expect(getRenderedIndices()).toEqual([2, 1, 0]);
    const rows = Array.from(document.querySelectorAll('[data-testid="chat-item-probe"]')) as HTMLElement[];
    expect(rows[0]?.textContent).toContain("Message 3");
    expect(rows[2]?.textContent).toContain("Message 1");
  });

  it("respects loadPages window for long histories", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(Chats, {
      target,
      props: {
        messages: makeMessages(8),
        currentCharacter: {
          name: "Chat Character",
          image: "",
          chats: [{ id: "chat-room-1" }],
          chatPage: 0,
        },
        onReroll: () => {},
        unReroll: () => {},
        currentUsername: "User",
        userIcon: "",
        loadPages: 3,
      },
    });

    await flushUi();
    expect(getRenderedIndices()).toEqual([7, 6, 5]);
  });

  it("anchors load window to folded-message index when folding is active", async () => {
    shared.chatFoldedStateMessageIndex.index = 4;
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(Chats, {
      target,
      props: {
        messages: makeMessages(8),
        currentCharacter: {
          name: "Chat Character",
          image: "",
          chats: [{ id: "chat-room-1" }],
          chatPage: 0,
        },
        onReroll: () => {},
        unReroll: () => {},
        currentUsername: "User",
        userIcon: "",
        loadPages: 2,
      },
    });

    await flushUi();
    expect(getRenderedIndices()).toEqual([4, 3, 2]);
  });

  it("keeps rendered window stable during reload-pointer refreshes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(Chats, {
      target,
      props: {
        messages: makeMessages(6),
        currentCharacter: {
          name: "Chat Character",
          image: "",
          chats: [{ id: "chat-room-1" }],
          chatPage: 0,
        },
        onReroll: () => {},
        unReroll: () => {},
        currentUsername: "User",
        userIcon: "",
        loadPages: 2,
      },
    });

    await flushUi();
    expect(getRenderedIndices()).toEqual([5, 4]);

    ReloadChatPointer.set({ 5: 1 });
    await flushUi();
    expect(getRenderedIndices()).toEqual([5, 4]);
  });
});
