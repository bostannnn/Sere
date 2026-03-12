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
              message: [
                { chatId: "m1", role: "user", data: "User message 1" },
                { chatId: "m2", role: "char", data: "Character message 2" },
              ],
              memoryData: {
                summaries: [],
                categories: [{ id: "", name: "Unclassified" }],
                lastSelectedSummaries: [],
                metrics: {
                  lastImportantSummaries: [],
                  lastRecentSummaries: [],
                  lastSimilarSummaries: [],
                  lastRandomSummaries: [],
                },
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
    memoryModal: {
      unclassified: "Unclassified",
      tagManagerTitle: "Tags #{0}",
      newTagName: "New tag",
      noTagsYet: "No tags yet",
      addNewTagHint: "Add your first tag",
      summaryNumberLabel: "Summary {0}",
      tagManager: "Tag Manager",
      tag: "Tag",
      translationLabel: "Translation",
      rerolledSummaryLabel: "Rerolled summary",
      rerolledTranslationLabel: "Rerolled translation",
      connectedMessageCountLabel: "Connected messages ({0})",
      connectedMessageRoleLabel: "Role: {0}",
      connectedMessageNotFoundLabel: "Message not found",
      connectedMessageLoadingError: "Load error: {0}",
      connectedMessageTranslationLabel: "Message translation",
      connectedFirstMessageLabel: "First message",
      deleteThisConfirmMessage: "Delete this?",
      deleteAfterConfirmMessage: "Delete after?",
      deleteAfterConfirmSecondMessage: "Delete after really?",
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

vi.mock(import("src/ts/process/memory/memory"), () => ({
  summarize: async () => "rerolled summary",
  getCurrentMemoryPreset: () => ({
    settings: {
      processRegexScript: false,
    },
  }),
}));

vi.mock(import("src/ts/translator/translator"), () => ({
  translateHTML: async () => "translated",
}));

vi.mock(import("src/ts/alert"), () => ({
  alertConfirm: async () => true,
}));

vi.mock(import("src/lib/Others/MemoryModal/utils"), () => ({
  alertConfirmTwice: async () => true,
  handleDualAction: () => ({
    destroy: () => {},
    update: () => {},
  }),
  getFirstMessage: () => "First message",
  processRegexScript: async (msg: { role: string; data: string; chatId?: string }) => msg,
  getCategoryName: (categoryId: string | undefined, categories: Array<{ id?: string; name?: string }>) => {
    const category = categories.find((entry) => entry.id === (categoryId || ""));
    return category?.name || "Unclassified";
  },
}));

import TagManagerModal from "src/lib/Others/MemoryModal/tag-manager-modal.svelte";
import ModalSummaryItem from "src/lib/Others/MemoryModal/modal-summary-item.svelte";
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

describe("memory tag/summary runtime smoke", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    const memoryData = {
      summaries: [
        {
          text: "Summary text",
          chatMemos: ["m1", "m2"],
          categoryId: "",
          isImportant: false,
          tags: [],
        },
      ],
      categories: [{ id: "", name: "Unclassified" }],
      lastSelectedSummaries: [],
      metrics: {
        lastImportantSummaries: [0],
        lastRecentSummaries: [0],
        lastSimilarSummaries: [0],
        lastRandomSummaries: [0],
      },
    };
    DBState.db.characters[0].chats[0].memoryData = memoryData;
    mountedApps = [];
  });

  afterEach(async () => {
    for (const app of mountedApps) {
      await unmount(app);
    }
    mountedApps = [];
  });

  it("keeps tag manager controls on shared primitives and preserves tag actions", async () => {
    const firstTarget = document.createElement("div");
    document.body.appendChild(firstTarget);

    let tagManagerState = {
      isOpen: true,
      currentSummaryIndex: 0,
      editingTag: "",
      editingTagIndex: -1,
    };

    mountApp(TagManagerModal, firstTarget, { tagManagerState });
    await flushUi();

    expect(firstTarget.querySelector(".ds-memory-tag-modal.panel-shell")).not.toBeNull();
    expect(firstTarget.querySelector(".ds-memory-tag-close.icon-btn.icon-btn--sm")).not.toBeNull();
    expect(firstTarget.querySelector(".ds-memory-tag-add-row.action-rail")).not.toBeNull();
    expect(firstTarget.querySelector(".ds-memory-tag-input.control-field")).not.toBeNull();
    expect(firstTarget.querySelector(".ds-memory-tag-list.list-shell")).not.toBeNull();
    expect(firstTarget.querySelector(".ds-memory-tag-empty.empty-state")).not.toBeNull();

    const addInput = firstTarget.querySelector(".ds-memory-tag-input.control-field") as HTMLInputElement | null;
    expect(addInput).not.toBeNull();
    addInput!.value = "Lore";
    addInput!.dispatchEvent(new Event("input", { bubbles: true }));
    addInput!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await flushUi();

    const summary = DBState.db.characters[0].chats[0].memoryData.summaries[0];
    expect(summary.tags).toContain("Lore");

    tagManagerState = {
      ...tagManagerState,
      editingTag: "",
      editingTagIndex: -1,
    };
    const secondTarget = document.createElement("div");
    document.body.appendChild(secondTarget);
    mountApp(TagManagerModal, secondTarget, { tagManagerState });
    await flushUi();

    expect(secondTarget.querySelector(".ds-memory-tag-label")?.textContent ?? "").toContain("#Lore");

    const editButton = secondTarget.querySelector(
      ".ds-memory-tag-icon-btn-edit.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(editButton).not.toBeNull();

    const deleteButton = secondTarget.querySelector(
      ".ds-memory-tag-icon-btn-delete.icon-btn.icon-btn--sm",
    ) as HTMLButtonElement | null;
    expect(deleteButton).not.toBeNull();
  });

  it("keeps summary item controls on panel/chip/icon/action/field primitives", async () => {
    const target = document.createElement("div");
    document.body.appendChild(target);

    const summaryItemStateMap = new WeakMap<object, object>();
    const onToggleSummarySelection = vi.fn();
    const onToggleCollapse = vi.fn();
    const onDeleteSummary = vi.fn();
    const onDeleteAfter = vi.fn();

    mountApp(ModalSummaryItem, target, {
      summaryIndex: 0,
      chatIndex: 0,
      memoryData: DBState.db.characters[0].chats[0].memoryData,
      summaryItemStateMap,
      expandedMessageState: null,
      searchState: null,
      filterSelected: true,
      bulkEditState: {
        isEnabled: true,
        selectedSummaries: new Set<number>([0]),
        selectedCategory: "",
        bulkSelectInput: "",
      },
      uiState: {
        collapsedSummaries: new Set<number>(),
        dropdownOpen: false,
      },
      onToggleSummarySelection,
      onToggleCollapse,
      onDeleteSummary,
      onDeleteAfter,
    });
    await flushUi();

    expect(target.querySelector(".memory-summary-root.panel-shell")).not.toBeNull();
    expect(target.querySelectorAll(".memory-summary-metric-chip.control-chip").length).toBeGreaterThan(0);
    expect(target.querySelector(".memory-summary-row-inline.action-rail")).not.toBeNull();
    const collapseToggle = target.querySelector(
      ".memory-summary-toggle-button.control-chip",
    ) as HTMLButtonElement | null;
    expect(collapseToggle).not.toBeNull();
    expect(collapseToggle?.getAttribute("type")).toBe("button");
    expect(target.querySelectorAll(".memory-summary-icon-button.icon-btn.icon-btn--sm").length).toBeGreaterThanOrEqual(3);
    expect(target.querySelectorAll(".memory-summary-textarea.control-field").length).toBeGreaterThan(0);
    expect(target.querySelectorAll(".memory-summary-chatmemo-button.control-chip").length).toBe(2);

    const checkbox = target.querySelector(".memory-summary-checkbox") as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    checkbox?.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onToggleSummarySelection).toHaveBeenCalledTimes(1);
    expect(onToggleCollapse).toHaveBeenCalledTimes(0);
    expect(onDeleteSummary).toHaveBeenCalledTimes(0);
    expect(onDeleteAfter).toHaveBeenCalledTimes(0);
  });
});
