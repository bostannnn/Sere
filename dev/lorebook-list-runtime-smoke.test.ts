import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    DBState: {
      db: {
        characters: [
          {
            globalLore: [],
            chatPage: 0,
            chats: [{ localLore: [] }],
          },
        ],
      },
    },
    selectedCharID: writable(0),
    selIdState: { selId: 0 },
  };
});

vi.mock(import("src/ts/util"), () => ({
  sleep: async () => {},
  sortableOptions: {},
}));

vi.mock(import("src/ts/alert"), () => ({
  alertError: () => {},
}));

vi.mock(import("sortablejs/modular/sortable.core.esm.js"), () => {
  class SortableMock {
    destroy() {}

    static create() {
      return {
        destroy() {},
      };
    }
  }

  return {
    default: SortableMock,
  };
});

import LoreBookList from "src/lib/SideBars/LoreBook/LoreBookList.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("lorebook list runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("uses primitive list-shell and empty-state classes", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(LoreBookList, { target, props: { submenu: 0 } });
    await flushUi();

    const shell = document.querySelector('[data-testid="lorebook-list-shell"]') as HTMLElement | null;
    const empty = document.querySelector('[data-testid="lorebook-list-empty"]') as HTMLElement | null;

    expect(shell).not.toBeNull();
    expect(shell?.classList.contains("list-shell")).toBe(true);
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains("empty-state")).toBe(true);
  });
});
