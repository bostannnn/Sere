import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, tick, unmount } from "svelte";

const hoisted = vi.hoisted(() => ({
  dbState: {
    db: {
      characters: [
        {
          chatPage: 0,
          chats: [
            {
              hypaV3Data: {
                summaries: [
                  { categoryId: "", chatMemos: [] },
                  { categoryId: "cat-1", chatMemos: [] },
                ],
                categories: [
                  { id: "", name: "Unclassified" },
                  { id: "cat-1", name: "Important" },
                ],
                lastSelectedSummaries: [],
              },
            },
          ],
        },
      ],
    },
  },
}));

vi.mock(import("src/lang"), () => ({
  language: {
    add: "Add",
    apply: "Apply",
    cancel: "Cancel",
    select: "Select",
    memoryModal: {
      unclassified: "Unclassified",
      categoryManager: "Category Manager",
      allCategories: "All Categories",
      categoryName: "Category Name",
      noCategoriesYet: "No categories yet",
      addNewCategoryHint: "Add a new category to organize summaries",
      reSummarize: "Resummarize",
    },
  },
}));

vi.mock(import("src/ts/stores.svelte"), async () => {
  const { writable } = await import("svelte/store");
  return {
    selectedCharID: writable(0),
    DBState: hoisted.dbState,
  };
});

import BulkEditActions from "src/lib/Others/MemoryModal/bulk-edit-actions.svelte";
import { DBState } from "src/ts/stores.svelte";

let mountedApps: Array<Record<string, unknown>> = [];

async function flushUi() {
  await tick();
  await Promise.resolve();
}

function mountApp(component: unknown, target: HTMLElement, props: Record<string, unknown>) {
  const app = mount(component as never, { target, props });
  mountedApps.push(app);
  return app;
}

describe("memory bulk runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    DBState.db.characters[0].chats[0].hypaV3Data = {
      summaries: [
        { categoryId: "", chatMemos: [] },
        { categoryId: "cat-1", chatMemos: [] },
      ],
      categories: [
        { id: "", name: "Unclassified" },
        { id: "cat-1", name: "Important" },
      ],
      lastSelectedSummaries: [],
    };
    mountedApps = [];
  });

  afterEach(async () => {
    for (const app of mountedApps) {
      await unmount(app);
    }
    mountedApps = [];
  });

  it("keeps bulk edit actions and field controls on shared primitives", async () => {
    const onClearSelection = vi.fn();
    const onUpdateSelectedCategory = vi.fn();
    const onUpdateBulkSelectInput = vi.fn();
    const onApplyCategory = vi.fn();
    const onParseAndSelectSummaries = vi.fn();

    const target = document.createElement("div");
    document.body.appendChild(target);

    mountApp(BulkEditActions, target, {
      bulkEditState: {
        isEnabled: true,
        selectedSummaries: new Set([0, 1]),
        selectedCategory: "",
        bulkSelectInput: "",
      },
      categories: [
        { id: "", name: "Unclassified" },
        { id: "cat-1", name: "Important" },
      ],
      onClearSelection,
      onUpdateSelectedCategory,
      onUpdateBulkSelectInput,
      onApplyCategory,
      onParseAndSelectSummaries,
    });
    await flushUi();

    expect(target.querySelector(".hypa-bulk-shell.panel-shell")).not.toBeNull();
    expect(target.querySelector(".hypa-bulk-row.action-rail")).not.toBeNull();
    expect(target.querySelector(".hypa-bulk-right.action-rail")).not.toBeNull();
    expect(target.querySelector(".hypa-bulk-input-row.action-rail")).not.toBeNull();

    const select = target.querySelector(".hypa-bulk-select.control-field") as HTMLSelectElement | null;
    const input = target.querySelector(".hypa-bulk-input.control-field") as HTMLInputElement | null;
    expect(select).not.toBeNull();
    expect(input).not.toBeNull();

    select!.value = "cat-1";
    select!.dispatchEvent(new Event("change", { bubbles: true }));
    input!.value = "1,2";
    input!.dispatchEvent(new Event("input", { bubbles: true }));
    input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();

    expect(onUpdateSelectedCategory).toHaveBeenCalledWith("cat-1");
    expect(onUpdateBulkSelectInput).toHaveBeenCalledWith("1,2");
    expect(onParseAndSelectSummaries).toHaveBeenCalledTimes(1);

    const buttons = [...target.querySelectorAll(".hypa-bulk-btn")] as HTMLButtonElement[];
    const applyButton = buttons.find((button) => (button.textContent ?? "").includes("Apply"));
    const clearButton = buttons.find((button) => (button.textContent ?? "").includes("Cancel"));
    expect(applyButton).toBeDefined();
    expect(clearButton).toBeDefined();

    applyButton?.click();
    clearButton?.click();
    await flushUi();

    expect(onApplyCategory).toHaveBeenCalledTimes(1);
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });
});
