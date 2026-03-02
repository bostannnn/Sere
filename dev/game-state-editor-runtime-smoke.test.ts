import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { mount, tick, unmount } from "svelte";

const mocks = vi.hoisted(() => ({
  DBState: {
    db: {
      characters: [
        {
          gameState: {} as Record<string, string>,
        },
      ],
    },
  },
  stateEditorActive: null as {
    set: (value: boolean) => void;
    subscribe: (run: (value: boolean) => void) => () => void;
  } | null,
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  const selectedCharID = writable(0);
  const stateEditorActive = writable(false);
  mocks.stateEditorActive = stateEditorActive;

  return {
    DBState: mocks.DBState,
    selectedCharID,
    stateEditorActive,
  };
});

import GameStateEditor from "src/lib/SideBars/GameStateEditor.svelte";

let app: Record<string, unknown> | undefined;

async function flushUi() {
  await tick();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("game state editor runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mocks.DBState.db.characters[0].gameState = { hunger: "3", resolve: "4" };
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(async () => {
    if (app) {
      await unmount(app);
      app = undefined;
    }
    vi.unstubAllGlobals();
  });

  it("keeps editor shell on panel/list/action primitives and preserves remove behavior", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GameStateEditor, { target });
    await flushUi();

    const root = target.querySelector('[data-testid="game-state-editor-root"]') as HTMLElement | null;
    expect(root).not.toBeNull();
    expect(root?.classList.contains("panel-shell")).toBe(true);

    const header = target.querySelector(".state-header") as HTMLElement | null;
    expect(header).not.toBeNull();
    expect(header?.classList.contains("action-rail")).toBe(true);

    const list = target.querySelector('[data-testid="game-state-editor-list"]') as HTMLElement | null;
    expect(list).not.toBeNull();
    expect(list?.classList.contains("panel-shell")).toBe(true);
    expect(list?.classList.contains("list-shell")).toBe(true);

    const addRow = target.querySelector('[data-testid="game-state-editor-add-row"]') as HTMLElement | null;
    expect(addRow).not.toBeNull();
    expect(addRow?.classList.contains("action-rail")).toBe(true);
    expect(addRow?.classList.contains("panel-shell")).toBe(true);

    expect(mocks.stateEditorActive).not.toBeNull();
    expect(get(mocks.stateEditorActive!)).toBe(true);

    const removeButton = target.querySelector(".state-row-action") as HTMLButtonElement | null;
    expect(removeButton).not.toBeNull();
    expect(removeButton?.getAttribute("title")).toBe("Remove variable");
    expect(removeButton?.getAttribute("aria-label")).toBe("Remove hunger");
    removeButton?.click();
    await flushUi();

    expect(mocks.DBState.db.characters[0].gameState.hunger).toBeUndefined();
  });

  it("keeps empty-state primitive and normalizes added keys", async () => {
    mocks.DBState.db.characters[0].gameState = {};

    const target = document.createElement("div");
    document.body.appendChild(target);
    app = mount(GameStateEditor, { target });
    await flushUi();

    const empty = target.querySelector('[data-testid="game-state-editor-empty"]') as HTMLElement | null;
    expect(empty).not.toBeNull();
    expect(empty?.classList.contains("empty-state")).toBe(true);

    const keyInput = target.querySelector(
      'input[placeholder="New variable (e.g. hunger)"]',
    ) as HTMLInputElement | null;
    const valueInput = target.querySelector('input[placeholder="Value"]') as HTMLInputElement | null;
    expect(keyInput).not.toBeNull();
    expect(valueInput).not.toBeNull();

    keyInput!.value = "Hunger Level";
    keyInput!.dispatchEvent(new Event("input", { bubbles: true }));
    valueInput!.value = "8";
    valueInput!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushUi();

    const addButton = target.querySelector(".add-btn.state-add-btn") as HTMLButtonElement | null;
    expect(addButton).not.toBeNull();
    expect(addButton?.getAttribute("title")).toBe("Add variable");
    expect(addButton?.getAttribute("aria-label")).toBe("Add variable");
    addButton?.click();
    await flushUi();

    expect(mocks.DBState.db.characters[0].gameState.hunger_level).toBe("8");
    expect(keyInput?.value).toBe("");
    expect(valueInput?.value).toBe("");
  });
});
