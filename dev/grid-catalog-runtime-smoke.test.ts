import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  characterFormatUpdate: vi.fn(),
  removeChar: vi.fn(),
  checkCharOrder: vi.fn(),
  endGrid: vi.fn(),
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const MobileSearch = writable("");
  const DBState = {
    db: {
      characters: [
        {
          name: "Alpha",
          image: "",
          type: "character",
          creatorNotes: "Alpha notes",
        },
        {
          name: "Beta",
          image: "",
          type: "character",
          creatorNotes: "Beta notes",
          trashTime: 123,
        },
      ],
    },
  };

  return {
    DBState,
    selectedCharID,
    MobileSearch,
  };
});

vi.mock(import("src/ts/characters"), () => ({
  characterFormatUpdate: mocks.characterFormatUpdate,
  getCharImage: () => "",
  removeChar: mocks.removeChar,
}));

vi.mock(import("src/lang"), () => ({
  language: {
    simple: "Simple",
    grid: "Grid",
    list: "List",
    trash: "Trash",
    trashDesc: "Trash description",
    character: "Character",
  },
}));

vi.mock(import("src/ts/util"), () => ({
  parseMultilangString: (value: string) => ({ en: value ?? "", xx: value ?? "" }),
}));

vi.mock(import("src/ts/globalApi.svelte"), () => ({
  checkCharOrder: mocks.checkCharOrder,
}));

vi.mock(import("src/lib/SideBars/BarIcon.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));
vi.mock(import("src/lib/UI/GUI/Button.svelte"), async () => ({
  default: (await import("./test-stubs/ComponentActionButtonStub.svelte")).default,
}));
vi.mock(import("src/lib/Mobile/MobileCharacters.svelte"), async () => ({
  default: (await import("./test-stubs/SimplePanelStub.svelte")).default,
}));

import GridCatalog from "src/lib/Others/GridCatalog.svelte";
import { DBState } from "src/ts/stores.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function findStubButton(text: string) {
  const buttons = [...document.querySelectorAll('[data-testid="component-action-button-stub"]')] as HTMLButtonElement[];
  return buttons.find((button) => (button.textContent ?? "").includes(text)) ?? null;
}

describe("grid catalog runtime smoke", () => {
  beforeEach(() => {
    mocks.characterFormatUpdate.mockClear();
    mocks.removeChar.mockClear();
    mocks.checkCharOrder.mockClear();
    mocks.endGrid.mockClear();
    document.body.innerHTML = "";
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
  });

  it("applies panel/action/icon primitives in list mode", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GridCatalog, { target, props: { embedded: true, endGrid: mocks.endGrid } });
    await flushUi();

    const listFilter = findStubButton("List");
    expect(listFilter).not.toBeNull();
    listFilter?.click();
    await flushUi();

    const cards = [...document.querySelectorAll(".grid-catalog-card")] as HTMLElement[];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.classList.contains("panel-shell"))).toBe(true);

    const actionRails = [...document.querySelectorAll(".grid-catalog-card-actions")] as HTMLElement[];
    expect(actionRails.length).toBeGreaterThan(0);
    expect(actionRails.every((row) => row.classList.contains("action-rail"))).toBe(true);

    const iconButtons = [...document.querySelectorAll(".grid-catalog-icon-btn")] as HTMLButtonElement[];
    expect(iconButtons.length).toBeGreaterThan(0);
    expect(iconButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(iconButtons.every((button) => button.classList.contains("icon-btn--sm"))).toBe(true);
    expect(iconButtons.every((button) => button.type === "button")).toBe(true);

    iconButtons[0]?.click();
    await flushUi();
    expect(mocks.characterFormatUpdate).toHaveBeenCalledWith(0);
    expect(mocks.endGrid).toHaveBeenCalledTimes(1);

    iconButtons[1]?.click();
    await flushUi();
    expect(mocks.removeChar).toHaveBeenCalledWith(0, "Alpha");
  });

  it("keeps primitive classes and restore behavior in trash mode", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GridCatalog, { target, props: { embedded: true, endGrid: mocks.endGrid } });
    await flushUi();

    const trashFilter = findStubButton("Trash");
    expect(trashFilter).not.toBeNull();
    trashFilter?.click();
    await flushUi();

    const cards = [...document.querySelectorAll(".grid-catalog-card")] as HTMLElement[];
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.classList.contains("panel-shell"))).toBe(true);
    expect((document.querySelector(".grid-catalog-trash-note") as HTMLElement | null)?.textContent).toContain("Trash description");

    const actionRow = document.querySelector(".grid-catalog-card-actions") as HTMLElement | null;
    expect(actionRow).not.toBeNull();
    expect(actionRow?.classList.contains("action-rail")).toBe(true);

    const iconButtons = [...document.querySelectorAll(".grid-catalog-icon-btn")] as HTMLButtonElement[];
    expect(iconButtons.length).toBeGreaterThan(0);
    expect(iconButtons.every((button) => button.classList.contains("icon-btn"))).toBe(true);
    expect(iconButtons.every((button) => button.classList.contains("icon-btn--sm"))).toBe(true);
    expect(iconButtons.every((button) => button.type === "button")).toBe(true);

    expect(DBState.db.characters[1].trashTime).toBe(123);
    iconButtons[0]?.click();
    await flushUi();
    expect(DBState.db.characters[1].trashTime).toBeUndefined();
    expect(mocks.checkCharOrder).toHaveBeenCalledTimes(1);
  });

  it("applies control-field primitive to desktop search input", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GridCatalog, { target, props: { endGrid: mocks.endGrid } });
    await flushUi();

    const searchInput = document.querySelector('input[placeholder="Search"]') as HTMLInputElement | null;
    expect(searchInput).not.toBeNull();
    expect(searchInput?.classList.contains("control-field")).toBe(true);

    const backButton = document.querySelector(".grid-catalog-back") as HTMLButtonElement | null;
    expect(backButton).not.toBeNull();
    expect(backButton?.type).toBe("button");
    expect(backButton?.getAttribute("aria-label")).toBe("Back");
  });
});
