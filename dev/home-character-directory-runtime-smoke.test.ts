import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const { addCharacterMock, changeCharMock, getCharImageMock, removeCharMock, checkCharOrderMock } = vi.hoisted(() => ({
  addCharacterMock: vi.fn(async () => {}),
  changeCharMock: vi.fn(),
  getCharImageMock: vi.fn(async () => null),
  removeCharMock: vi.fn(async () => {}),
  checkCharOrderMock: vi.fn(),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");

  const selectedCharID = writable(-1);
  const DBState = {
    db: {
      characters: [
        {
          chaId: "char-1",
          name: "Alpha",
          type: "character",
          image: "",
          desc: "",
          creatorNotes: "",
          chatPage: 0,
          trashTime: undefined,
          chats: [
            {
              id: "chat-1",
              name: "Chat 1",
              message: [{ role: "user", data: "hello", time: 1000 }],
            },
          ],
        },
        {
          chaId: "char-2",
          name: "Beta",
          type: "group",
          image: "",
          desc: "",
          creatorNotes: "",
          chatPage: 0,
          trashTime: undefined,
          chats: [
            {
              id: "chat-2",
              name: "Chat 2",
              message: [{ role: "char", data: "world", time: 2000 }],
            },
          ],
        },
        {
          chaId: "char-3",
          name: "Gamma",
          type: "character",
          image: "",
          desc: "",
          creatorNotes: "",
          chatPage: 0,
          trashTime: 123,
          chats: [
            {
              id: "chat-3",
              name: "Chat 3",
              message: [{ role: "user", data: "trash", time: 3000 }],
            },
          ],
        },
      ],
    },
  };

  return {
    DBState,
    selectedCharID,
  };
});

vi.mock(import("src/ts/characters"), () => ({
  addCharacter: addCharacterMock,
  changeChar: changeCharMock,
  getCharImage: getCharImageMock,
  removeChar: removeCharMock,
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  checkCharOrder: checkCharOrderMock,
}));

vi.mock(import("src/ts/util"), () => ({
  parseMultilangString: (value: string) => ({
    en: value,
    xx: value,
  }),
}));

import HomeCharacterDirectory from "src/lib/UI/HomeCharacterDirectory.svelte";
import { DBState, selectedCharID } from "src/ts/stores.svelte";

function dispatchKeyboard(source: Element | null, key: string) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  const notCanceled = source?.dispatchEvent(event);
  return {
    event,
    notCanceled: notCanceled ?? false,
  };
}

describe("home character directory runtime smoke", () => {
  let app: Record<string, unknown> | undefined;

  beforeEach(() => {
    addCharacterMock.mockClear();
    changeCharMock.mockClear();
    getCharImageMock.mockClear();
    removeCharMock.mockClear();
    checkCharOrderMock.mockClear();

    DBState.db.characters = [
      {
        chaId: "char-1",
        name: "Alpha",
        type: "character",
        image: "",
        desc: "",
        creatorNotes: "",
        chatPage: 0,
        trashTime: undefined,
        chats: [
          {
            id: "chat-1",
            name: "Chat 1",
            message: [{ role: "user", data: "hello", time: 1000 }],
          },
        ],
      },
      {
        chaId: "char-2",
        name: "Beta",
        type: "group",
        image: "",
        desc: "",
        creatorNotes: "",
        chatPage: 0,
        trashTime: undefined,
        chats: [
          {
            id: "chat-2",
            name: "Chat 2",
            message: [{ role: "char", data: "world", time: 2000 }],
          },
        ],
      },
      {
        chaId: "char-3",
        name: "Gamma",
        type: "character",
        image: "",
        desc: "",
        creatorNotes: "",
        chatPage: 0,
        trashTime: 123,
        chats: [
          {
            id: "chat-3",
            name: "Chat 3",
            message: [{ role: "user", data: "trash", time: 3000 }],
          },
        ],
      },
    ];

    selectedCharID.set(-1);

    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("filters rows by showTrash prop", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
        showTrash: false,
      },
    });
    await tick();

    expect((document.querySelector('[data-testid="app-home-grid-stub"]') as HTMLElement | null)?.dataset.showTrash).toBe("0");
    expect(document.querySelector('[data-testid="app-home-select-char-1"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="app-home-select-char-3"]')).toBeNull();
  });

  it("keeps keyboard focus semantics consistent for active and trashed cards", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
        showTrash: false,
      },
    });
    await tick();

    const activeCard = document.querySelector('[data-testid="app-home-select-char-1"]') as HTMLElement | null;
    expect(activeCard).not.toBeNull();
    expect(activeCard?.getAttribute("role")).toBe("button");
    expect(activeCard?.getAttribute("tabindex")).toBe("0");
    expect(activeCard?.getAttribute("aria-disabled")).toBeNull();

    if (app) {
      await unmount(app);
      app = undefined;
    }

    const trashTarget = document.createElement("div");
    document.body.appendChild(trashTarget);

    app = mount(HomeCharacterDirectory as never, {
      target: trashTarget,
      props: {
        shellSearchQuery: "",
        showTrash: true,
      },
    });
    await tick();

    const trashedCard = document.querySelector('[data-testid="app-home-select-char-3"]') as HTMLElement | null;
    expect(trashedCard).not.toBeNull();
    expect(trashedCard?.getAttribute("role")).toBe("button");
    expect(trashedCard?.getAttribute("tabindex")).toBe("-1");
    expect(trashedCard?.getAttribute("aria-disabled")).toBe("true");
  });

  it("preserves character selection and trash action for active rows", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const selectButton = document.querySelector('[data-testid="app-home-select-char-1"]') as HTMLButtonElement | null;
    expect(selectButton).not.toBeNull();
    selectButton!.click();
    await tick();
    expect(changeCharMock).toHaveBeenCalledWith(0);

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-1"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    expect(menuButton?.getAttribute("type")).toBe("button");
    expect(menuButton?.getAttribute("aria-haspopup")).toBe("menu");
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
    menuButton!.click();
    await tick();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("true");

    const menu = document.querySelector(".ds-home-character-menu") as HTMLElement | null;
    expect(menu).not.toBeNull();
    expect(menu?.classList.contains("ds-ui-menu")).toBe(true);
    expect(menu?.id).toBe("home-directory-menu-1");
    expect(menuButton?.getAttribute("aria-controls")).toBe(menu?.id);

    const trashButton = document.querySelector('[data-testid="home-directory-trash-char-1"]') as HTMLButtonElement | null;
    expect(trashButton).not.toBeNull();
    expect(trashButton?.getAttribute("type")).toBe("button");
    expect(trashButton?.getAttribute("title")).toBe("Move character to trash");
    expect(trashButton?.getAttribute("aria-label")).toBe("Move character to trash");
    expect(trashButton?.classList.contains("ds-ui-menu-item")).toBe(true);
    expect(trashButton?.classList.contains("ds-ui-menu-item--danger")).toBe(true);
    expect(trashButton?.classList.contains("ds-home-character-menu-item-danger")).toBe(true);
    trashButton!.click();
    await tick();
    expect(removeCharMock).toHaveBeenCalledWith(0, "Alpha", "normal");
  });

  it("resolves trash action by character id when list indices drift", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-1"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await tick();

    DBState.db.characters = [
      DBState.db.characters[1],
      DBState.db.characters[0],
      DBState.db.characters[2],
    ];

    const trashButton = document.querySelector('[data-testid="home-directory-trash-char-1"]') as HTMLButtonElement | null;
    expect(trashButton).not.toBeNull();
    trashButton!.click();
    await tick();

    expect(removeCharMock).toHaveBeenCalledWith(1, "Alpha", "normal");
  });

  it("preserves trash management actions (restore and permanent delete)", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
        showTrash: true,
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-3"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await tick();

    const deleteButton = document.querySelector('[data-testid="home-directory-delete-char-3"]') as HTMLButtonElement | null;
    expect(deleteButton).not.toBeNull();
    expect(deleteButton?.getAttribute("type")).toBe("button");
    expect(deleteButton?.getAttribute("title")).toBe("Delete character permanently");
    expect(deleteButton?.getAttribute("aria-label")).toBe("Delete character permanently");
    expect(deleteButton?.classList.contains("ds-ui-menu-item")).toBe(true);
    expect(deleteButton?.classList.contains("ds-ui-menu-item--danger")).toBe(true);
    expect(deleteButton?.classList.contains("ds-home-character-menu-item-danger")).toBe(true);
    deleteButton!.click();
    await tick();
    expect(removeCharMock).toHaveBeenCalledWith(2, "Gamma", "permanent");

    const restoreButton = document.querySelector('[data-testid="home-directory-restore-char-3"]') as HTMLButtonElement | null;
    expect(restoreButton).not.toBeNull();
    expect(restoreButton?.getAttribute("type")).toBe("button");
    expect(restoreButton?.getAttribute("title")).toBe("Restore character");
    expect(restoreButton?.getAttribute("aria-label")).toBe("Restore character");
    expect(restoreButton?.classList.contains("ds-ui-menu-item")).toBe(true);
    restoreButton!.click();
    await tick();

    expect(DBState.db.characters[2].trashTime).toBeUndefined();
    expect(checkCharOrderMock).toHaveBeenCalledTimes(1);
  });

  it("resolves permanent delete action by character id when list indices drift", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
        showTrash: true,
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-3"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await tick();

    DBState.db.characters = [
      DBState.db.characters[2],
      DBState.db.characters[0],
      DBState.db.characters[1],
    ];

    const deleteButton = document.querySelector('[data-testid="home-directory-delete-char-3"]') as HTMLButtonElement | null;
    expect(deleteButton).not.toBeNull();
    deleteButton!.click();
    await tick();

    expect(removeCharMock).toHaveBeenCalledWith(0, "Gamma", "permanent");
  });

  it("keeps menu keyboard events uncanceled and avoids selecting character from menu control", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-1"]') as HTMLElement | null;
    expect(menuButton).not.toBeNull();

    const enterResult = dispatchKeyboard(menuButton, "Enter");
    const spaceResult = dispatchKeyboard(menuButton, " ");

    expect(enterResult.notCanceled).toBe(true);
    expect(spaceResult.notCanceled).toBe(true);
    expect(enterResult.event.defaultPrevented).toBe(false);
    expect(spaceResult.event.defaultPrevented).toBe(false);
    expect(changeCharMock).not.toHaveBeenCalled();
  });

  it("supports keyboard activation for character cards", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const card = document.querySelector('[data-testid="app-home-select-char-1"]') as HTMLElement | null;
    expect(card).not.toBeNull();

    const enterResult = dispatchKeyboard(card, "Enter");
    await tick();
    const spaceResult = dispatchKeyboard(card, " ");
    await tick();

    expect(enterResult.notCanceled).toBe(false);
    expect(spaceResult.notCanceled).toBe(false);
    expect(enterResult.event.defaultPrevented).toBe(true);
    expect(spaceResult.event.defaultPrevented).toBe(true);
    expect(changeCharMock).toHaveBeenCalledTimes(2);
    expect(changeCharMock).toHaveBeenNthCalledWith(1, 0);
    expect(changeCharMock).toHaveBeenNthCalledWith(2, 0);
  });

  it("skips tilt/glare updates when reduced motion is enabled", async () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList);

    try {
      const target = document.createElement("div");
      document.body.appendChild(target);

      app = mount(HomeCharacterDirectory as never, {
        target,
        props: {
          shellSearchQuery: "",
        },
      });
      await tick();

      const main = document.querySelector('[data-testid="app-home-select-char-1"]') as HTMLElement | null;
      expect(main).not.toBeNull();

      const host = main!.closest("[data-home-tilt-card]") as HTMLElement | null;
      expect(host).not.toBeNull();

      main!.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        pointerType: "mouse",
        clientX: 40,
        clientY: 40,
      }));
      await tick();

      expect(host!.style.getPropertyValue("--home-card-tilt-x")).toBe("");
      expect(host!.style.getPropertyValue("--home-card-tilt-y")).toBe("");
      expect(host!.style.getPropertyValue("--home-card-glare-opacity")).toBe("");
    } finally {
      matchMediaSpy.mockRestore();
    }
  });

  it("resets tilt immediately without animation when reduced motion is active", async () => {
    const matchMediaSpy = vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList);
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    try {
      const target = document.createElement("div");
      document.body.appendChild(target);

      app = mount(HomeCharacterDirectory as never, {
        target,
        props: {
          shellSearchQuery: "",
        },
      });
      await tick();

      const main = document.querySelector('[data-testid="app-home-select-char-1"]') as HTMLElement | null;
      expect(main).not.toBeNull();

      const host = main!.closest("[data-home-tilt-card]") as HTMLElement | null;
      expect(host).not.toBeNull();

      host!.style.setProperty("--home-card-tilt-x", "5deg");
      host!.style.setProperty("--home-card-tilt-y", "-3deg");
      host!.style.setProperty("--home-card-glare-x", "15%");
      host!.style.setProperty("--home-card-glare-y", "80%");
      host!.style.setProperty("--home-card-glare-opacity", "0.5");

      main!.dispatchEvent(new PointerEvent("pointerleave", {
        bubbles: true,
        pointerType: "mouse",
      }));
      await tick();

      expect(rafSpy).not.toHaveBeenCalled();
      expect(host!.style.getPropertyValue("--home-card-tilt-x")).toBe("0deg");
      expect(host!.style.getPropertyValue("--home-card-tilt-y")).toBe("0deg");
      expect(host!.style.getPropertyValue("--home-card-glare-x")).toBe("50%");
      expect(host!.style.getPropertyValue("--home-card-glare-y")).toBe("50%");
      expect(host!.style.getPropertyValue("--home-card-glare-opacity")).toBe("0");
    } finally {
      rafSpy.mockRestore();
      matchMediaSpy.mockRestore();
    }
  });

  it("prefers personality preview, falls back to description, and strips markup tokens", async () => {
    (DBState.db.characters[0] as Record<string, unknown>).personality = "  <b>Persona primary</b> {{user}} *clean*  ";
    DBState.db.characters[0].desc = "Desc fallback should not render";
    (DBState.db.characters[1] as Record<string, unknown>).personality = "";
    DBState.db.characters[1].desc = "<i>Group fallback desc</i>";

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const firstPreview = document.querySelector('[data-testid="home-directory-preview-char-1"]') as HTMLElement | null;
    const secondPreview = document.querySelector('[data-testid="home-directory-preview-char-2"]') as HTMLElement | null;
    expect(firstPreview).not.toBeNull();
    expect(secondPreview).not.toBeNull();

    const firstText = firstPreview!.textContent ?? "";
    const secondText = secondPreview!.textContent ?? "";

    expect(firstText).toContain("Persona primary");
    expect(firstText).toContain("clean");
    expect(firstText).not.toContain("Desc fallback should not render");
    expect(firstText).not.toContain("<");
    expect(firstText).not.toContain("{{");

    expect(secondText).toContain("Group fallback desc");
    expect(secondText).not.toContain("<");
  });

  it("closes open menu on outside pointerdown", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-1"]') as HTMLElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await tick();
    expect(document.querySelector('[data-testid="home-directory-trash-char-1"]')).not.toBeNull();

    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await tick();
    expect(document.querySelector('[data-testid="home-directory-trash-char-1"]')).toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders empty-state primitive for no-results search and empty trash view", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "unmatched-character-query",
        showTrash: false,
      },
    });
    await tick();

    const emptyState = document.querySelector('[data-testid="home-directory-empty-state"]') as HTMLElement | null;
    const emptyTitle = document.querySelector('[data-testid="home-directory-empty-title"]') as HTMLElement | null;
    expect(emptyState).not.toBeNull();
    expect(emptyState?.classList.contains("empty-state")).toBe(true);
    expect(emptyTitle?.textContent).toContain("No characters found");

    if (app) {
      await unmount(app);
      app = undefined;
    }

    DBState.db.characters.forEach((character) => {
      character.trashTime = undefined;
    });

    const trashTarget = document.createElement("div");
    document.body.appendChild(trashTarget);
    app = mount(HomeCharacterDirectory as never, {
      target: trashTarget,
      props: {
        shellSearchQuery: "",
        showTrash: true,
      },
    });
    await tick();

    const trashEmptyState = document.querySelector('[data-testid="home-directory-empty-state"]') as HTMLElement | null;
    const trashEmptyTitle = document.querySelector('[data-testid="home-directory-empty-title"]') as HTMLElement | null;
    expect(trashEmptyState).not.toBeNull();
    expect(trashEmptyState?.classList.contains("empty-state")).toBe(true);
    expect(trashEmptyTitle?.textContent).toContain("No trashed characters");
  });

  it("closes open card menu on Escape", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-1"]') as HTMLElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await tick();
    expect(document.querySelector('[data-testid="home-directory-trash-char-1"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await tick();
    expect(document.querySelector('[data-testid="home-directory-trash-char-1"]')).toBeNull();
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears stale open menu state after row removal and handles large directory lists", async () => {
    DBState.db.characters = Array.from({ length: 120 }, (_, index) => ({
      chaId: `char-${index + 1}`,
      name: `Character ${index + 1}`,
      type: index % 9 === 0 ? "group" : "character",
      image: "",
      desc: `Description ${index + 1}`,
      creatorNotes: "",
      chatPage: 0,
      trashTime: undefined,
      chats: [
        {
          id: `chat-${index + 1}`,
          name: `Chat ${index + 1}`,
          message: [{ role: "user", data: "hello", time: 1000 + index }],
        },
      ],
    }));

    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const cards = document.querySelectorAll('[data-testid^="app-home-select-char-"]');
    expect(cards.length).toBe(120);
    expect(document.querySelector('[data-testid="home-directory-empty-state"]')).toBeNull();

    const firstMenuButton = document.querySelector('[data-testid="home-directory-menu-char-1"]') as HTMLElement | null;
    expect(firstMenuButton).not.toBeNull();
    firstMenuButton!.click();
    await tick();
    expect(document.querySelector('[data-testid="home-directory-trash-char-1"]')).not.toBeNull();

    DBState.db.characters = DBState.db.characters.slice(1);
    selectedCharID.set(99);
    await tick();
    expect(document.querySelector('[data-testid="home-directory-trash-char-1"]')).toBeNull();
  });
});
