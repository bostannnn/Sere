<script lang="ts">
  import type { BulkEditState, Category } from "./types";
  import { language } from "src/lang";

  interface Props {
    bulkEditState: BulkEditState;
    categories: Category[];
    onClearSelection: () => void;
    onUpdateSelectedCategory: (categoryId: string) => void;
    onUpdateBulkSelectInput: (input: string) => void;
    onApplyCategory: () => void;
    onParseAndSelectSummaries: () => void;
  }

  const {
    bulkEditState,
    categories,
    onClearSelection,
    onUpdateSelectedCategory,
    onUpdateBulkSelectInput,
    onApplyCategory,
    onParseAndSelectSummaries,
  }: Props = $props();

  function applyCategoryToSelected() {
    onApplyCategory();
  }

  function parseAndSelectSummaries() {
    onParseAndSelectSummaries();
  }

  function clearSelection() {
    onClearSelection();
  }

  function handleCategoryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    onUpdateSelectedCategory(target.value);
  }

  function handleBulkSelectInputChange(event: Event) {
    const target = event.target as HTMLInputElement;
    onUpdateBulkSelectInput(target.value);
  }

  function handleBulkSelectKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      parseAndSelectSummaries();
    }
  }
</script>

<!-- Bulk Edit Action Bar -->
{#if bulkEditState.isEnabled}
  <div class="hypa-bulk-shell panel-shell">
    <div class="hypa-bulk-row action-rail">
      <div class="hypa-bulk-right action-rail">
        <!-- Category Selection -->
        <select
          class="hypa-bulk-select control-field"
          value={bulkEditState.selectedCategory}
          onchange={handleCategoryChange}
        >
          {#each categories as category (category.id)}
            <option value={category.id}>{category.name}</option>
          {/each}
        </select>

        <!-- Apply Category Button -->
        <button
          class="hypa-bulk-btn hypa-bulk-btn-accent"
          class:is-disabled={bulkEditState.selectedSummaries.size === 0}
          onclick={applyCategoryToSelected}
          disabled={bulkEditState.selectedSummaries.size === 0}
        >
          {language.apply}
        </button>

        <!-- Bulk Select by Numbers -->
        <div class="hypa-bulk-input-row action-rail">
          <input
            type="text"
            value={bulkEditState.bulkSelectInput}
            oninput={handleBulkSelectInputChange}
            placeholder="1,3,5-8"
            class="hypa-bulk-input control-field"
            onkeydown={handleBulkSelectKeydown}
          />
          <button
            class="hypa-bulk-btn hypa-bulk-btn-outline hypa-bulk-btn-compact"
            onclick={parseAndSelectSummaries}
          >
            {language.select}
          </button>
        </div>

        <!-- Clear Selection Button -->
        <button
          class="hypa-bulk-btn hypa-bulk-btn-danger hypa-bulk-btn-compact"
          onclick={clearSelection}
        >
          {language.cancel}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .hypa-bulk-shell.panel-shell {
    position: sticky;
    bottom: 0;
    border-top: 1px solid var(--ds-border-subtle);
    border-radius: 0 0 var(--ds-radius-md) var(--ds-radius-md);
    background: var(--ds-surface-2);
    padding: var(--ds-space-3);
  }

  .hypa-bulk-row.action-rail {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ds-space-3);
    flex-wrap: wrap;
  }

  .hypa-bulk-right.action-rail,
  .hypa-bulk-input-row.action-rail {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .hypa-bulk-right {
    flex-wrap: wrap;
  }

  .hypa-bulk-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--ds-height-control-sm);
    border-radius: var(--ds-radius-sm);
    border: 1px solid var(--ds-border-subtle);
    padding: var(--ds-space-2) var(--ds-space-3);
    font-size: var(--ds-font-size-sm);
    font-weight: var(--ds-font-weight-medium);
    color: var(--ds-text-primary);
    background: var(--ds-surface-3);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard),
      border-color var(--ds-motion-fast) var(--ds-ease-standard),
      opacity var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-bulk-btn:hover {
    border-color: var(--ds-border-strong);
    background: var(--ds-surface-active);
  }

  .hypa-bulk-btn-accent {
    color: var(--ds-text-primary);
    border-color: var(--ds-border-strong);
    background: color-mix(in srgb, var(--ds-surface-active) 70%, var(--ds-surface-2) 30%);
  }

  .hypa-bulk-btn-danger {
    border-color: color-mix(in srgb, var(--color-red-500) 55%, var(--ds-border-subtle));
    color: color-mix(in srgb, var(--color-red-300) 88%, var(--ds-text-primary));
    background: color-mix(in srgb, var(--color-red-500) 14%, transparent);
  }

  .hypa-bulk-btn-outline {
    border-color: var(--ds-border-strong);
    color: var(--ds-border-strong);
    background: color-mix(in srgb, var(--ds-border-strong) 14%, transparent);
  }

  .hypa-bulk-btn-compact {
    padding-inline: var(--ds-space-3);
  }

  .hypa-bulk-btn.is-disabled,
  .hypa-bulk-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hypa-bulk-btn.is-disabled:hover,
  .hypa-bulk-btn:disabled:hover {
    border-color: var(--ds-border-subtle);
    background: var(--ds-surface-3);
  }

  .hypa-bulk-select.control-field {
    min-height: var(--ds-height-control-sm);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-1);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-sm);
    padding: var(--ds-space-2) var(--ds-space-3);
    outline: none;
  }

  .hypa-bulk-select.control-field:focus {
    border-color: var(--ds-border-strong);
  }

  .hypa-bulk-input.control-field {
    width: 8rem;
    min-height: var(--ds-height-control-sm);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-2);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-sm);
    padding: var(--ds-space-2) var(--ds-space-3);
    outline: none;
  }

  .hypa-bulk-input.control-field::placeholder {
    color: color-mix(in srgb, var(--ds-text-secondary) 75%, transparent);
  }

  .hypa-bulk-input.control-field:focus {
    border-color: var(--ds-border-strong);
  }
</style>
