<script lang="ts">
     
  import { tick } from "svelte";
  import {
    SearchIcon,
    StarIcon,
    SettingsIcon,
    MoreVerticalIcon,
    BarChartIcon,
    Trash2Icon,
    XIcon,
    SquarePenIcon,
    TagIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import type { SerializableHypaV3Data } from "src/ts/process/memory/hypav3";
  import {
    hypaV3ModalOpen,
    settingsOpen,
    SettingsMenuIndex,
  } from "src/ts/stores.svelte";
  import type { SearchState, BulkEditState, CategoryManagerState, FilterState, UIState } from "./types";

  interface Props {
    searchState: SearchState | null;
    filterImportant: boolean;
    dropdownOpen: boolean;
    filterSelected: boolean;
    bulkEditState?: BulkEditState;
    categoryManagerState?: CategoryManagerState;
    filterState?: FilterState;
    uiState?: UIState;
    hypaV3Data: SerializableHypaV3Data;
    onResetData?: () => Promise<void>;
    onToggleBulkEditMode?: () => void;
    onOpenCategoryManager?: () => void;
  }

  let {
    searchState = $bindable(),
    filterImportant = $bindable(),
    dropdownOpen = $bindable(),
    filterSelected = $bindable(),
    bulkEditState,
    categoryManagerState,
    filterState,
    uiState: _uiState,
    hypaV3Data: _hypaV3Data,
    onResetData,
    onToggleBulkEditMode,
    onOpenCategoryManager,
  }: Props = $props();


  async function toggleSearch() {
    if (searchState === null) {
      searchState = {
        ref: null,
        query: "",
        results: [],
        currentResultIndex: -1,
        requestedSearchFromIndex: -1,
        isNavigating: false,
      };

      // Focus on search element after it's rendered
      await tick();

      if (searchState.ref) {
        searchState.ref.focus();
      }
    } else {
      searchState = null;
    }
  }

  function toggleFilterImportant() {
    filterImportant = !filterImportant;
  }

  function openGlobalSettings() {
    $hypaV3ModalOpen = false;
    $settingsOpen = true;
    $SettingsMenuIndex = 2; // Other bot settings
  }

  function openDropdown(e: MouseEvent) {
    e.stopPropagation();
    dropdownOpen = true;
  }

  function toggleFilterSelected() {
    filterSelected = !filterSelected;
  }

  async function resetData() {
    if (onResetData) {
      await onResetData();
    }
  }

  function closeModal() {
    $hypaV3ModalOpen = false;
  }

  function toggleBulkEditMode() {
    if (onToggleBulkEditMode) {
      onToggleBulkEditMode();
    }
  }

  function openCategoryManager() {
    if (onOpenCategoryManager) {
      onOpenCategoryManager();
    }
  }
</script>

<div class="hypa-modal-header">
  <!-- Modal Title -->
  <h1 class="hypa-modal-title">
    {language.hypaV3Modal.titleLabel}
  </h1>

  <!-- Buttons Container -->
  <div class="hypa-modal-actions action-rail">
    <!-- Open Search Button -->
    <button
      class="hypa-modal-icon-btn icon-btn icon-btn--md"
      tabindex="-1"
      onclick={async () => await toggleSearch()}
    >
      <SearchIcon size={24} />
    </button>

    <!-- Filter Important Summary Button -->
    <button
      class="hypa-modal-icon-btn hypa-modal-icon-btn-accent icon-btn icon-btn--md"
      class:is-active={filterState?.showImportantOnly}
      tabindex="-1"
      onclick={toggleFilterImportant}
    >
      <StarIcon size={24} />
    </button>

    <!-- Bulk Edit Mode Button -->
    {#if bulkEditState}
      <button
        class="hypa-modal-icon-btn hypa-modal-icon-btn-accent icon-btn icon-btn--md"
        class:is-active={bulkEditState.isEnabled}
        tabindex="-1"
        onclick={toggleBulkEditMode}
      >
        <SquarePenIcon size={24} />
      </button>
    {/if}

    <!-- Category Manager Button -->
    {#if categoryManagerState}
      <button
        class="hypa-modal-icon-btn icon-btn icon-btn--md"
        tabindex="-1"
        onclick={openCategoryManager}
      >
        <TagIcon size={24} />
      </button>
    {/if}

    <!-- Open Global Settings Button -->
    <button
      class="hypa-modal-icon-btn icon-btn icon-btn--md"
      tabindex="-1"
      onclick={openGlobalSettings}
    >
      <SettingsIcon size={24} />
    </button>

    <!-- Open Dropdown Button -->
    <div class="hypa-modal-dropdown-root">
      <button
        class="hypa-modal-icon-btn icon-btn icon-btn--md"
        tabindex="-1"
        onclick={openDropdown}
      >
        <MoreVerticalIcon size={24} />
      </button>

      {#if dropdownOpen}
        <div class="hypa-modal-dropdown-panel panel-shell">
          <!-- Buttons Container -->
          <div class="hypa-modal-dropdown-actions action-rail">
            <!-- Filter Selected Summary Button -->
            <button
              class="hypa-modal-icon-btn hypa-modal-icon-btn-accent icon-btn icon-btn--md"
              class:is-active={filterSelected}
              tabindex="-1"
              onclick={toggleFilterSelected}
            >
              <BarChartIcon size={24} />
            </button>

            <!-- Reset Data Button -->
            <button
              class="hypa-modal-icon-btn hypa-modal-icon-btn-danger icon-btn icon-btn--md"
              tabindex="-1"
              onclick={async () => await resetData()}
            >
              <Trash2Icon size={24} />
            </button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Close Modal Button -->
    <button
      class="hypa-modal-icon-btn icon-btn icon-btn--md"
      tabindex="-1"
      onclick={closeModal}
    >
      <XIcon size={24} />
    </button>
  </div>
</div>

<style>
  .hypa-modal-header {
    margin-bottom: var(--ds-space-3);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hypa-modal-title {
    margin: 0;
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-lg);
    font-weight: var(--ds-font-weight-semibold);
  }

  .hypa-modal-actions.action-rail {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .hypa-modal-icon-btn.icon-btn.icon-btn--md {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--ds-space-2);
    border-radius: var(--ds-radius-sm);
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-modal-icon-btn.icon-btn.icon-btn--md:hover {
    color: var(--ds-text-primary);
    background: color-mix(in srgb, var(--ds-surface-active) 35%, transparent);
  }

  .hypa-modal-icon-btn-accent.is-active {
    color: var(--ds-border-strong);
  }

  .hypa-modal-icon-btn-danger.icon-btn.icon-btn--md:hover {
    color: var(--ds-text-danger);
  }

  .hypa-modal-dropdown-root {
    position: relative;
  }

  .hypa-modal-dropdown-panel.panel-shell {
    position: absolute;
    right: 0;
    z-index: 10;
    margin-top: var(--ds-space-1);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-2);
    padding: var(--ds-space-2);
    box-shadow: var(--shadow-lg);
  }

  .hypa-modal-dropdown-actions.action-rail {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  @media (min-width: 640px) {
    .hypa-modal-header {
      margin-bottom: var(--ds-space-4);
    }

    .hypa-modal-title {
      font-size: var(--ds-font-size-xl);
    }
  }
</style>
