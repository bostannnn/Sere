import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { get } from "svelte/store";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");

  const selectedCharID = writable(-1);
  const PlaygroundStore = writable(1);
  const settingsOpen = writable(true);
  const openRulebookManager = writable(true);
  const additionalHamburgerMenu = [];

  const DBState = {
    db: {
      characters: [
        {
          chaId: "char-1",
          name: "Character One",
          trashTime: undefined,
          chats: [
            {
              id: "chat-1-a",
              name: "First Chat",
              message: [{ role: "user", data: "old", time: 1000 }],
            },
          ],
          chatPage: 0,
        },
        {
          chaId: "char-2",
          name: "Character Two",
          trashTime: undefined,
          chats: [
            {
              id: "chat-2-a",
              name: "Second Chat",
              message: [{ role: "user", data: "middle", time: 3000 }],
            },
            {
              id: "chat-2-b",
              name: "Latest Chat",
              message: [{ role: "char", data: "latest", time: 5000 }],
            },
          ],
          chatPage: 0,
        },
      ],
    },
  };

  return {
    DBState,
    additionalHamburgerMenu,
    openRulebookManager,
    PlaygroundStore,
    selectedCharID,
    settingsOpen,
  };
});

vi.mock(import("src/lib/Others/PluginDefinedIcon.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import GlobalLauncher from "src/lib/UI/GlobalLauncher.svelte";
import {
  DBState,
  openRulebookManager,
  PlaygroundStore,
  selectedCharID,
  settingsOpen,
} from "src/ts/stores.svelte";

describe("global launcher runtime smoke", () => {
  let app: Record<string, unknown> | undefined;

  const resetStores = () => {
    selectedCharID.set(-1);
    PlaygroundStore.set(1);
    settingsOpen.set(true);
    openRulebookManager.set(true);
  };

  const navButtons = () =>
    Array.from(
      document.querySelectorAll(".ds-global-nav-item[data-testid^=\"global-launcher-nav-\"]"),
    ) as HTMLButtonElement[];

  beforeEach(() => {
    resetStores();
    DBState.db.characters = [
      {
        chaId: "char-1",
        name: "Character One",
        trashTime: undefined,
        chats: [
          {
            id: "chat-1-a",
            name: "First Chat",
            message: [{ role: "user", data: "old", time: 1000 }],
          },
        ],
        chatPage: 0,
      },
      {
        chaId: "char-2",
        name: "Character Two",
        trashTime: undefined,
        chats: [
          {
            id: "chat-2-a",
            name: "Second Chat",
            message: [{ role: "user", data: "middle", time: 3000 }],
          },
          {
            id: "chat-2-b",
            name: "Latest Chat",
            message: [{ role: "char", data: "latest", time: 5000 }],
          },
        ],
        chatPage: 0,
      },
    ];
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("opens recent chat and routes to the target character/chat", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const onResetOverlays = vi.fn();
    app = mount(GlobalLauncher as never, {
      target,
      props: {
        visible: true,
        activeOverlay: "none",
        onResetOverlays,
      },
    });
    await tick();

    const recentChatButtons = document.querySelectorAll('[data-testid="global-launcher-recent-item"]');
    expect(recentChatButtons.length).toBe(3);

    const newestRecentChat = recentChatButtons[0] as HTMLButtonElement;
    expect(newestRecentChat.dataset.charId).toBe("char-2");
    expect(newestRecentChat.dataset.chatId).toBe("chat-2-b");
    expect(newestRecentChat.dataset.charIndex).toBe("1");
    expect(newestRecentChat.dataset.chatIndex).toBe("1");
    const nav = document.querySelector(".ds-global-nav") as HTMLElement | null;
    expect(nav).not.toBeNull();
    expect(nav?.id).toBe("global-navigation-rail");
    expect(nav?.dataset.testid).toBe("global-navigation-rail");
    expect(nav?.classList.contains("drawer-elevation--left")).toBe(true);
    expect(nav?.classList.contains("ds-global-nav-drawer")).toBe(true);
    const recentShell = document.querySelector(".ds-global-nav-recent") as HTMLElement | null;
    expect(recentShell).not.toBeNull();
    expect(recentShell?.classList.contains("list-shell")).toBe(true);
    expect(document.querySelector(".ds-global-nav-empty")).toBeNull();
    expect(document.querySelector(".ds-global-nav-brand")).toBeNull();
    expect(document.querySelector(".ds-global-nav-collapse")).toBeNull();
    const navControls = navButtons();
    expect(navControls.length).toBe(4);
    expect(navControls.every((button) => button.getAttribute("type") === "button")).toBe(true);
    expect(
      navControls.every((button) => (button.getAttribute("aria-label") ?? "").length > 0),
    ).toBe(true);
    expect(
      navControls.some((button) => button.getAttribute("aria-pressed") === "true"),
    ).toBe(true);
    newestRecentChat.click();
    await tick();

    expect(onResetOverlays).toHaveBeenCalledTimes(1);
    expect(get(settingsOpen)).toBe(false);
    expect(get(openRulebookManager)).toBe(false);
    expect(get(PlaygroundStore)).toBe(0);
    expect(get(selectedCharID)).toBe(1);
    expect(DBState.db.characters[1].chatPage).toBe(1);

    const footerPill = document.querySelector(".ds-global-nav-footer-pill") as HTMLElement | null;
    expect(footerPill).not.toBeNull();
    expect(footerPill?.classList.contains("control-chip")).toBe(true);
  });

  it("falls back to indexed chat when a recent row does not expose a chat id", async () => {
    DBState.db.characters[0].chats[0].id = undefined;
    DBState.db.characters[0].chats[0].message = [{ role: "user", data: "latest", time: 7000 }];

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(GlobalLauncher as never, {
      target,
      props: {
        visible: true,
        activeOverlay: "none",
      },
    });
    await tick();

    const recentChatButtons = document.querySelectorAll('[data-testid="global-launcher-recent-item"]');
    expect(recentChatButtons.length).toBe(3);
    const newestRecentChat = recentChatButtons[0] as HTMLButtonElement;
    expect(newestRecentChat.dataset.charId).toBe("char-1");
    expect(newestRecentChat.dataset.chatId).toBe("");

    newestRecentChat.click();
    await tick();

    expect(get(selectedCharID)).toBe(0);
    expect(DBState.db.characters[0].chatPage).toBe(0);
  });

  it("resolves the target character by chat id when character indexes drift", async () => {
    DBState.db.characters = [
      {
        name: "First Character",
        trashTime: undefined,
        chats: [
          {
            id: "chat-first",
            name: "First Chat",
            message: [{ role: "user", data: "first", time: 1000 }],
          },
        ],
        chatPage: 0,
      },
      {
        name: "Target Character",
        trashTime: undefined,
        chats: [
          {
            id: "chat-target",
            name: "Target Chat",
            message: [{ role: "char", data: "target", time: 9000 }],
          },
        ],
        chatPage: 0,
      },
    ];

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(GlobalLauncher as never, {
      target,
      props: {
        visible: true,
        activeOverlay: "none",
      },
    });
    await tick();

    const recentChatButtons = document.querySelectorAll('[data-testid="global-launcher-recent-item"]');
    expect(recentChatButtons.length).toBe(2);
    const newestRecentChat = recentChatButtons[0] as HTMLButtonElement;
    expect(newestRecentChat.dataset.chatId).toBe("chat-target");
    expect(newestRecentChat.dataset.charIndex).toBe("1");

    const firstCharacter = DBState.db.characters[0];
    const targetCharacter = DBState.db.characters[1];
    DBState.db.characters = [targetCharacter, firstCharacter];

    newestRecentChat.click();
    await tick();

    expect(get(selectedCharID)).toBe(0);
    expect(DBState.db.characters[0].chatPage).toBe(0);
  });

  it("highlights nav item for the active workspace", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    PlaygroundStore.set(0);
    settingsOpen.set(true);
    openRulebookManager.set(false);
    selectedCharID.set(-1);

    app = mount(GlobalLauncher as never, {
      target,
      props: {
        visible: true,
        activeOverlay: "none",
      },
    });
    await tick();

    expect(document.querySelector('[data-testid="global-launcher-nav-settings"]')?.classList.contains("ds-global-nav-item-active")).toBe(true);
    expect(document.querySelector('[data-testid="global-launcher-nav-settings"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-testid="global-launcher-nav-home"]')?.classList.contains("ds-global-nav-item-active")).toBe(false);

    settingsOpen.set(false);
    openRulebookManager.set(true);
    await tick();
    expect(document.querySelector('[data-testid="global-launcher-nav-library"]')?.classList.contains("ds-global-nav-item-active")).toBe(true);

    openRulebookManager.set(false);
    selectedCharID.set(0);
    await tick();
    expect(document.querySelector(".ds-global-nav-item-active")).toBeNull();

    selectedCharID.set(-1);
    PlaygroundStore.set(1);
    await tick();
    expect(document.querySelector('[data-testid="global-launcher-nav-playground"]')?.classList.contains("ds-global-nav-item-active")).toBe(true);

    PlaygroundStore.set(0);
    await tick();
    expect(document.querySelector('[data-testid="global-launcher-nav-home"]')?.classList.contains("ds-global-nav-item-active")).toBe(true);

  });

  it("renders recent empty state with empty-state primitive when there are no recent chats", async () => {
    DBState.db.characters = [
      {
        chaId: "char-1",
        name: "Character One",
        trashTime: undefined,
        chats: [{ id: "chat-1", name: "Chat 1", message: [] }],
        chatPage: 0,
      },
    ];

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(GlobalLauncher as never, {
      target,
      props: {
        visible: true,
        activeOverlay: "none",
      },
    });
    await tick();

    const emptyState = document.querySelector(".ds-global-nav-empty") as HTMLElement | null;
    expect(emptyState).not.toBeNull();
    expect(emptyState?.classList.contains("empty-state")).toBe(true);
  });
});
