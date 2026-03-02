<script lang="ts">
     
  import {
    PlusIcon,
    XIcon,
    SquarePenIcon,
    Trash2Icon,
    CheckIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import { DBState, selectedCharID } from "src/ts/stores.svelte";
  import type { SerializableHypaV3Data } from "src/ts/process/memory/hypav3";
  import type { Category, CategoryManagerState, SearchState, FilterState } from "./types";
  import { createCategoryId } from "./utils";

  interface Props {
    categoryManagerState: CategoryManagerState;
    searchState: SearchState | null;
    filterState?: FilterState;
    onCategoryFilter?: (categoryId: string) => void;
  }

  let {
    categoryManagerState = $bindable(),
    searchState = $bindable(),
    filterState,
    onCategoryFilter,
  }: Props = $props();

  function getOrInitHypaV3Data(): SerializableHypaV3Data {
    const chat =
      DBState.db.characters[$selectedCharID].chats[
        DBState.db.characters[$selectedCharID].chatPage
      ];
    chat.hypaV3Data ??= {
      summaries: [],
      categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
      lastSelectedSummaries: [],
    };
    chat.hypaV3Data.categories ??= [
      { id: "", name: language.hypaV3Modal.unclassified },
    ];
    chat.hypaV3Data.lastSelectedSummaries ??= [];
    return chat.hypaV3Data;
  }

  const hypaV3Data = $derived(getOrInitHypaV3Data());

  const categories = $derived((() => {
    const savedCategories = hypaV3Data.categories || [];
    const uncategorized = { id: "", name: language.hypaV3Modal.unclassified };

    const hasUncategorized = savedCategories.some(c => c.id === "");

    if (hasUncategorized) {
      return [uncategorized, ...savedCategories.filter(c => c.id !== "")];
    } else {
      return [uncategorized, ...savedCategories];
    }
  })());

  function closeCategoryManager() {
    categoryManagerState.isOpen = false;
    categoryManagerState.editingCategory = null;
  }

  function startEditCategory(category: Category) {
    categoryManagerState.editingCategory = { ...category };
  }

  function startAddCategory() {
    categoryManagerState.editingCategory = { id: "", name: "" };
  }

  function saveEditingCategory() {
    if (!categoryManagerState.editingCategory) return;

    if (categoryManagerState.editingCategory.id === "") {
      addCategory(categoryManagerState.editingCategory.name);
    } else {
      updateCategory(categoryManagerState.editingCategory.id, categoryManagerState.editingCategory.name);
    }

    categoryManagerState.editingCategory = null;
  }

  function cancelEditingCategory() {
    categoryManagerState.editingCategory = null;
  }

  function addCategory(name: string) {
    const id = createCategoryId();
    const currentCategories = hypaV3Data.categories || [];
    const uncategorized = { id: "", name: language.hypaV3Modal.unclassified };

    const hasUncategorized = currentCategories.some(c => c.id === "");
    const baseCategories = hasUncategorized ? currentCategories : [uncategorized, ...currentCategories];

    hypaV3Data.categories = [...baseCategories, { id, name }];
  }

  function updateCategory(id: string, name: string) {
    hypaV3Data.categories = (hypaV3Data.categories || []).map(c => c.id === id ? { ...c, name } : c);
  }

  function deleteCategory(id: string) {
    if (id === "") return;

    for (const summary of hypaV3Data.summaries) {
      if (summary.categoryId === id) {
        summary.categoryId = undefined;
      }
    }

    hypaV3Data.categories = (hypaV3Data.categories || []).filter(c => c.id !== id);

    if (categoryManagerState.selectedCategoryFilter === id) {
      categoryManagerState.selectedCategoryFilter = "all";
    }
    if (filterState?.selectedCategoryFilter === id && onCategoryFilter) {
      onCategoryFilter("all");
    }
  }

  function selectCategory(categoryId: string) {
    categoryManagerState.selectedCategoryFilter = categoryId;
    if (onCategoryFilter) {
      onCategoryFilter(categoryId);
    }
    if (searchState) {
      searchState.query = '';
      searchState.results = [];
      searchState.currentResultIndex = -1;
    }
    closeCategoryManager();
  }
</script>

<!-- Category Manager Modal -->
{#if categoryManagerState.isOpen}
  <div class="hypa-category-overlay">
    <div class="hypa-category-modal panel-shell">
      <div class="hypa-category-header">
        <h2 class="hypa-category-title">{language.hypaV3Modal.categoryManager}</h2>
        <div class="hypa-category-header-actions action-rail">
          <!-- Add Category Button -->
          <button
            class="hypa-category-icon-btn hypa-category-icon-btn-accent icon-btn icon-btn--sm"
            onclick={startAddCategory}
          >
            <PlusIcon size={20} />
          </button>
          <!-- Close Button -->
          <button
            class="hypa-category-icon-btn icon-btn icon-btn--sm"
            onclick={closeCategoryManager}
          >
            <XIcon size={20} />
          </button>
        </div>
      </div>

      <!-- Combined Category List -->
      <div class="hypa-category-list list-shell">
        <!-- All Categories -->
        <button
          class="hypa-category-row hypa-category-row-button"
          class:is-selected={categoryManagerState.selectedCategoryFilter === "all"}
          onclick={() => selectCategory('all')}
        >
          <span class="hypa-category-row-label">{language.hypaV3Modal.allCategories} ({hypaV3Data.summaries.length})</span>
          <!-- Spacer to match button height -->
          <div class="hypa-category-spacer-row">
            <div class="hypa-category-spacer-cell"></div>
            <div class="hypa-category-spacer-cell"></div>
          </div>
        </button>

        {#each categories as category (category.id)}
          {@const count = hypaV3Data.summaries.filter(s => (s.categoryId || '') === category.id).length}
          <div
            class="hypa-category-row"
            class:is-selected={categoryManagerState.selectedCategoryFilter === category.id}
          >
            {#if categoryManagerState.editingCategory?.id === category.id}
              <input
                type="text"
                class="hypa-category-edit-input control-field"
                bind:value={categoryManagerState.editingCategory.name}
                placeholder={language.hypaV3Modal.categoryName}
              />
              <button
                class="hypa-category-icon-btn hypa-category-icon-btn-accent icon-btn icon-btn--sm"
                onclick={saveEditingCategory}
              >
                <CheckIcon size={16} />
              </button>
              <button
                class="hypa-category-icon-btn icon-btn icon-btn--sm"
                onclick={cancelEditingCategory}
              >
                <XIcon size={16} />
              </button>
            {:else}
              <button
                class="hypa-category-select-btn"
                onclick={() => selectCategory(category.id)}
              >
                {category.name} ({count})
              </button>
              {#if category.id !== ""}
                <button
                  class="hypa-category-icon-btn icon-btn icon-btn--sm"
                  onclick={() => startEditCategory(category)}
                >
                  <SquarePenIcon size={16} />
                </button>
                <button
                  class="hypa-category-icon-btn hypa-category-icon-btn-danger icon-btn icon-btn--sm"
                  onclick={() => deleteCategory(category.id)}
                >
                  <Trash2Icon size={16} />
                </button>
              {:else}
                <!-- Spacer to match button height for 미분류 -->
                <div class="hypa-category-spacer-row">
                  <div class="hypa-category-spacer-cell"></div>
                  <div class="hypa-category-spacer-cell"></div>
                </div>
              {/if}
            {/if}
          </div>
        {/each}

        <!-- Empty State -->
        {#if categories.filter(c => c.id !== "").length === 0 && !categoryManagerState.editingCategory}
          <div class="hypa-category-empty empty-state">
            {language.hypaV3Modal.noCategoriesYet}<br>
            <span class="hypa-category-empty-hint">{language.hypaV3Modal.addNewCategoryHint}</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .hypa-category-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ds-space-4);
    background: color-mix(in srgb, #000 70%, transparent);
  }

  .hypa-category-modal.panel-shell {
    width: min(100%, 28rem);
    max-height: min(80vh, 34rem);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-md);
    background: var(--ds-surface-2);
    padding: var(--ds-space-5);
  }

  .hypa-category-header {
    margin-bottom: var(--ds-space-5);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ds-space-2);
  }

  .hypa-category-title {
    margin: 0;
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-lg);
    font-weight: var(--ds-font-weight-semibold);
  }

  .hypa-category-header-actions.action-rail,
  .hypa-category-spacer-row {
    display: flex;
    align-items: center;
    gap: var(--ds-space-1);
  }

  .hypa-category-icon-btn.icon-btn.icon-btn--sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--ds-space-2);
    border-radius: var(--ds-radius-sm);
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-category-icon-btn.icon-btn.icon-btn--sm:hover {
    color: var(--ds-text-primary);
    background: color-mix(in srgb, var(--ds-surface-active) 35%, transparent);
  }

  .hypa-category-icon-btn-accent.icon-btn.icon-btn--sm:hover {
    color: var(--ds-border-strong);
  }

  .hypa-category-icon-btn-danger.icon-btn.icon-btn--sm:hover {
    color: var(--ds-text-danger);
  }

  .hypa-category-list.list-shell {
    display: flex;
    flex-direction: column;
    gap: var(--ds-space-2);
    max-height: 20rem;
    overflow-y: auto;
  }

  .hypa-category-row {
    display: flex;
    align-items: center;
    gap: var(--ds-space-3);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-1);
    color: var(--ds-text-primary);
    padding: var(--ds-space-2) var(--ds-space-3);
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
      border-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-category-row:hover {
    border-color: var(--ds-border-strong);
    background: color-mix(in srgb, var(--ds-surface-active) 32%, var(--ds-surface-1) 68%);
  }

  .hypa-category-row.is-selected {
    border-color: var(--ds-border-strong);
    background: var(--ds-surface-active);
    color: var(--ds-text-primary);
  }

  .hypa-category-row-button {
    width: 100%;
    text-align: left;
  }

  .hypa-category-row-label,
  .hypa-category-select-btn {
    flex: 1 1 auto;
    text-align: left;
    font-size: var(--ds-font-size-sm);
  }

  .hypa-category-edit-input.control-field {
    flex: 1 1 auto;
    min-height: var(--ds-height-control-sm);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-2);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-sm);
    padding: var(--ds-space-1) var(--ds-space-3);
    outline: none;
  }

  .hypa-category-edit-input.control-field:focus {
    border-color: var(--ds-border-strong);
  }

  .hypa-category-spacer-cell {
    width: 2rem;
    height: 2rem;
  }

  .hypa-category-empty.empty-state {
    text-align: center;
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
    padding-block: var(--ds-space-5);
  }

  .hypa-category-empty-hint {
    font-size: var(--ds-font-size-xs);
  }
</style>
