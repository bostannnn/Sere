import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const { exportCharMock, getCharImageMock, removeCharMock, checkCharOrderMock } = vi.hoisted(() => ({
  exportCharMock: vi.fn(async () => ""),
  getCharImageMock: vi.fn(async () => null),
  removeCharMock: vi.fn(async () => {}),
  checkCharOrderMock: vi.fn(),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");

  const selectedCharID = writable(-1);
  const DBState = {
    db: {
      characters: [] as Array<Record<string, unknown>>,
    },
  };

  return {
    DBState,
    selIdState: {
      selId: -1,
    },
    selectedCharID,
  };
});

vi.mock(import("src/ts/characters"), () => ({
  changeChar: vi.fn(),
  getCharImage: getCharImageMock,
  removeChar: removeCharMock,
}));

vi.mock(import("src/ts/characterCards"), () => ({
  exportChar: exportCharMock,
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

vi.mock(import("src/ts/storage/database.svelte"), () => ({
  resolveSafeChatIndex: (chats: Array<unknown> | undefined, chatPage: number | undefined) => {
    if (!Array.isArray(chats) || chats.length === 0) {
      return -1;
    }
    if (!Number.isInteger(chatPage) || chatPage < 0 || chatPage >= chats.length) {
      return 0;
    }
    return chatPage;
  },
}));

import HomeCharacterDirectory from "src/lib/UI/HomeCharacterDirectory.svelte";
import { DBState, selectedCharID } from "src/ts/stores.svelte";

function createCharacters() {
  return [
    {
      chaId: "char-1",
      name: "Alpha",
      type: "character",
      image: "alpha-image",
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
}

describe("home character directory export menu runtime smoke", () => {
  let app: Record<string, unknown> | undefined;

  beforeEach(() => {
    exportCharMock.mockClear();
    getCharImageMock.mockClear();
    removeCharMock.mockClear();
    checkCharOrderMock.mockClear();

    DBState.db.characters = createCharacters();
    selectedCharID.set(-1);
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("renders export action for active character rows and closes the menu after export", async () => {
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

    const exportButton = document.querySelector('[data-testid="home-directory-export-char-1"]') as HTMLButtonElement | null;
    expect(exportButton).not.toBeNull();
    expect(exportButton?.getAttribute("type")).toBe("button");
    expect(exportButton?.getAttribute("title")).toBe("Export Character");
    expect(exportButton?.getAttribute("aria-label")).toBe("Export Character");
    expect(exportButton?.classList.contains("ds-ui-menu-item")).toBe(true);
    exportButton!.click();
    await tick();

    expect(exportCharMock).toHaveBeenCalledWith(0);
    expect(menuButton?.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[data-testid="home-directory-export-char-1"]')).toBeNull();
  });

  it("does not render export action for group rows", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    app = mount(HomeCharacterDirectory as never, {
      target,
      props: {
        shellSearchQuery: "",
      },
    });
    await tick();

    const menuButton = document.querySelector('[data-testid="home-directory-menu-char-2"]') as HTMLButtonElement | null;
    expect(menuButton).not.toBeNull();
    menuButton!.click();
    await tick();

    expect(document.querySelector('[data-testid="home-directory-export-char-2"]')).toBeNull();
    expect(document.querySelector('[data-testid="home-directory-trash-char-2"]')).not.toBeNull();
  });

  it("resolves export action by character id when list indices drift", async () => {
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

    const exportButton = document.querySelector('[data-testid="home-directory-export-char-1"]') as HTMLButtonElement | null;
    expect(exportButton).not.toBeNull();
    exportButton!.click();
    await tick();

    expect(exportCharMock).toHaveBeenCalledWith(1);
  });
});
