<script lang="ts">
     
  import { tick } from "svelte";
  import {
    SearchIcon,
    SettingsIcon,
    MoreVerticalIcon,
    BarChartIcon,
    Trash2Icon,
    SquarePenIcon,
  } from "@lucide/svelte";
  import type { SerializableMemoryData } from "src/ts/process/memory/memory";
  import {
    settingsOpen,
    SettingsMenuIndex,
  } from "src/ts/stores.svelte";
  import type { SearchState, BulkEditState, UIState } from "./types";

  interface Props {
    activeTab?: "summary" | "settings" | "log";
    searchState: SearchState | null;
    dropdownOpen: boolean;
    filterSelected: boolean;
    bulkEditState?: BulkEditState;
    uiState?: UIState;
    memoryData: SerializableMemoryData;
    onResetData?: () => Promise<void>;
    onToggleBulkEditMode?: () => void;
  }

  let {
    activeTab = "summary",
    searchState = $bindable(),
    dropdownOpen = $bindable(),
    filterSelected = $bindable(),
    bulkEditState,
    uiState: _uiState,
    memoryData: _memoryData,
    onResetData,
    onToggleBulkEditMode,
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

  function openGlobalSettings() {
    $settingsOpen = true;
    $SettingsMenuIndex = 2; // Other bot settings
  }

  function openDropdown(e: MouseEvent) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }

  function toggleFilterSelected() {
    filterSelected = !filterSelected;
  }

  async function resetData() {
    if (onResetData) {
      await onResetData();
    }
  }

  function toggleBulkEditMode() {
    if (onToggleBulkEditMode) {
      onToggleBulkEditMode();
    }
  }

  function closeDropdown() {
    dropdownOpen = false;
  }

  function handleToggleFilterSelected() {
    toggleFilterSelected();
    closeDropdown();
  }

  function handleOpenGlobalSettings() {
    openGlobalSettings();
    closeDropdown();
  }

  async function handleResetData() {
    await resetData();
    closeDropdown();
  }
</script>

<div class="memory-header-shell">
  <!-- Buttons Container -->
  <div class="memory-header-actions action-rail">
    {#if activeTab === "summary"}
      <!-- Open Search Button -->
      <button
        class="memory-header-icon-btn icon-btn icon-btn--md"
        title="Search summaries"
        aria-label="Search summaries"
        tabindex="-1"
        onclick={async () => await toggleSearch()}
      >
        <SearchIcon size={24} />
      </button>
    {/if}

    <!-- Bulk Edit Mode Button -->
    {#if bulkEditState && activeTab === "summary"}
      <button
        class="memory-header-icon-btn memory-header-icon-btn-accent icon-btn icon-btn--md"
        class:is-active={bulkEditState.isEnabled}
        title="Toggle bulk edit"
        aria-label="Toggle bulk edit"
        tabindex="-1"
        onclick={toggleBulkEditMode}
      >
        <SquarePenIcon size={24} />
      </button>
    {/if}

    <!-- Open Dropdown Button -->
    <div class="memory-header-menu-root">
      <button
        class="memory-header-icon-btn icon-btn icon-btn--md"
        title="More actions"
        aria-label="More actions"
        tabindex="-1"
        onclick={openDropdown}
      >
        <MoreVerticalIcon size={24} />
      </button>

      {#if dropdownOpen}
        <div class="memory-header-menu-panel panel-shell">
          <!-- Buttons Container -->
          <div class="memory-header-menu-actions action-rail">
            {#if activeTab === "summary"}
              <button class="memory-header-menu-item" type="button" onclick={handleToggleFilterSelected}>
                <BarChartIcon size={16} />
                <span>{filterSelected ? "Show all summaries" : "Show selected only"}</span>
              </button>
            {/if}

            <button class="memory-header-menu-item" type="button" onclick={handleOpenGlobalSettings}>
              <SettingsIcon size={16} />
              <span>Memory settings</span>
            </button>

            <button class="memory-header-menu-item memory-header-menu-item-danger" type="button" onclick={async () => await handleResetData()}>
              <Trash2Icon size={16} />
              <span>Reset memory data</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .memory-header-shell {
    margin-bottom: var(--ds-space-3);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--ds-space-2);
  }

  .memory-header-actions.action-rail {
    flex-wrap: wrap;
    justify-content: flex-end;
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .memory-header-icon-btn.icon-btn.icon-btn--md {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--ds-space-2);
    border-radius: var(--ds-radius-sm);
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .memory-header-icon-btn.icon-btn.icon-btn--md:hover {
    color: var(--ds-text-primary);
    background: color-mix(in srgb, var(--ds-surface-active) 35%, transparent);
  }

  .memory-header-icon-btn-accent.is-active {
    color: var(--ds-border-strong);
  }

  .memory-header-menu-root {
    position: relative;
  }

  .memory-header-menu-panel.panel-shell {
    position: absolute;
    right: 0;
    z-index: 70;
    margin-top: var(--ds-space-1);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    background: var(--ds-surface-2);
    padding: var(--ds-space-2);
    box-shadow: var(--shadow-lg);
  }

  .memory-header-menu-actions.action-rail {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 12rem;
    max-width: min(17rem, 70vw);
    gap: var(--ds-space-1);
  }

  .memory-header-menu-item {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
    width: 100%;
    border: 1px solid transparent;
    border-radius: var(--ds-radius-sm);
    background: transparent;
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-sm);
    text-align: left;
    padding: var(--ds-space-2);
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
      border-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .memory-header-menu-item:hover {
    background: color-mix(in srgb, var(--ds-surface-active) 45%, transparent);
    border-color: var(--ds-border-subtle);
  }

  .memory-header-menu-item-danger {
    color: var(--ds-text-danger);
  }

  .memory-header-menu-item-danger:hover {
    background: color-mix(in srgb, var(--ds-text-danger) 14%, transparent);
  }

  @media (max-width: 960px) {
    .memory-header-shell {
      flex-wrap: wrap;
    }

    .memory-header-actions.action-rail {
      width: 100%;
    }
  }

  @media (min-width: 640px) {
    .memory-header-shell {
      margin-bottom: var(--ds-space-4);
    }
  }
</style>
