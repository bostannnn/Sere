<script lang="ts">
  import { ChevronUpIcon, ChevronDownIcon } from "@lucide/svelte";
  import { DBState } from "src/ts/stores.svelte";
  import { language } from "src/lang";
  import ModalHeader from "./MemoryModal/modal-header.svelte";
  import ModalSummaryItem from "./MemoryModal/modal-summary-item.svelte";
  import BulkEditActions from "./MemoryModal/bulk-edit-actions.svelte";
  import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
  import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
  import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
  import { useMemoryModal } from "./MemoryModal/useMemoryModal.svelte";
  import {
    getCharacterMemoryEnabled,
    getDbMemoryEnabled,
    setCharacterMemoryEnabled,
  } from "src/ts/process/memory/storage";
  const modal = useMemoryModal();

</script>

<div class="ds-memory-sidebar-root">
  <div class="ds-memory-sidebar-wrap">
    <!-- Modal Window -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="ds-memory-modal-window ds-memory-sidebar-window"
        class:ds-memory-modal-window-empty={modal.memoryData.summaries.length === 0}
        onclick={(e) => {
          e.stopPropagation();
          modal.openDropdownClosed();
        }}
      >
      <SettingsSubTabs
        className="ds-memory-tabs"
        items={modal.memoryWorkspaceTabItems}
        selectedId={modal.selectedMemoryWorkspaceTabId}
        onSelect={modal.selectMemoryWorkspaceTabById}
      />

      <!-- Scrollable Container -->
      <div class="ds-memory-modal-scroll" tabindex="-1">
        {#if modal.memoryWorkspaceTab === "summary"}
          <div
            class="ds-memory-modal-tab-panel"
            role="tabpanel"
            id="memory-panel-summary"
            aria-label="Summary panel"
          >
            <ModalHeader
              activeTab={modal.memoryWorkspaceTab}
              bind:searchState={modal.searchState}
              bind:dropdownOpen={modal.uiState.dropdownOpen}
              bind:filterSelected={modal.filterSelected}
              bulkEditState={modal.bulkEditState}
              uiState={modal.uiState}
              memoryData={modal.memoryData}
              onResetData={modal.handleResetData}
              onToggleBulkEditMode={modal.handleToggleBulkEditMode}
            />

            {#if modal.memoryData.summaries.length === 0}
              <div class="ds-memory-modal-empty-note empty-state">
                {language.memoryModal.noSummariesLabel}
              </div>
            {:else if modal.searchState}
              <div class="ds-memory-modal-search-sticky">
                <div class="ds-memory-modal-search-row">
                  <div class="ds-memory-modal-search-form-wrap">
                    <form
                      class="ds-memory-modal-search-form"
                      onsubmit={(e) => {
                        e.preventDefault();
                        modal.onSearch({ key: "Enter" } as KeyboardEvent);
                      }}
                    >
                      <input
                        class="ds-memory-modal-search-input control-field"
                        placeholder={language.memoryModal.searchPlaceholder}
                        bind:this={modal.searchState.ref}
                        bind:value={modal.searchState.query}
                        oninput={modal.clearSearchResults}
                        onkeydown={modal.onSearch}
                      />
                    </form>

                    {#if modal.searchState.results.length > 0}
                      <span class="ds-memory-modal-search-counter">
                        {modal.searchState.currentResultIndex + 1}/{modal.searchState.results
                          .length}
                      </span>
                    {/if}
                  </div>

                  <button
                    type="button"
                    class="ds-memory-modal-search-nav-button icon-btn icon-btn--sm"
                    title="Previous search result"
                    aria-label="Previous search result"
                    onclick={() => {
                      modal.onSearch({ shiftKey: true, key: "Enter" } as KeyboardEvent);
                    }}
                  >
                    <ChevronUpIcon class="ds-memory-modal-search-nav-icon" />
                  </button>

                  <button
                    type="button"
                    class="ds-memory-modal-search-nav-button icon-btn icon-btn--sm"
                    title="Next search result"
                    aria-label="Next search result"
                    onclick={() => {
                      modal.onSearch({ key: "Enter" } as KeyboardEvent);
                    }}
                  >
                    <ChevronDownIcon class="ds-memory-modal-search-nav-icon" />
                  </button>
                </div>
              </div>
            {/if}

            <div class="ds-memory-modal-tools panel-shell">
              <div class="ds-memory-modal-tools-body">
                {#if modal.currentChar && getDbMemoryEnabled(DBState.db)}
                  <CheckInput
                    name={language.ToggleMemory}
                    check={getCharacterMemoryEnabled(modal.currentChar)}
                    margin={false}
                    onChange={(check) => {
                      setCharacterMemoryEnabled(modal.currentChar, check);
                    }}
                  />
                {/if}

                <div class="ds-memory-modal-manual-sticky ds-memory-modal-manual-embedded">
                  <div class="ds-memory-modal-manual-row">
                    <div class="ds-memory-modal-manual-col">
                      <label class="ds-memory-modal-manual-label" for={modal.manualRangeStartInputId}>Manual summarize range</label>
                      <div class="ds-memory-modal-manual-input-row">
                        <input
                          id={modal.manualRangeStartInputId}
                          class="ds-memory-modal-manual-input control-field"
                          type="number"
                          min="1"
                          max={modal.chatList[modal.effectiveChatIndex]?.message?.length ?? 1}
                          placeholder="Start"
                          bind:value={modal.manualState.start}
                        />
                        <span class="ds-memory-modal-manual-to">to</span>
                        <input
                          id={modal.manualRangeEndInputId}
                          class="ds-memory-modal-manual-input control-field"
                          type="number"
                          min="1"
                          max={modal.chatList[modal.effectiveChatIndex]?.message?.length ?? 1}
                          placeholder="End"
                          bind:value={modal.manualState.end}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      class="ds-memory-modal-manual-submit ds-ui-button ds-ui-button-size-md ds-ui-button--primary"
                      class:is-disabled={modal.manualState.processing}
                      disabled={modal.manualState.processing}
                      onclick={modal.manualSummarizeRange}
                    >
                      {modal.manualState.processing ? "Summarizing..." : "Summarize"}
                    </button>
                  </div>
                  {#if modal.manualState.feedbackMessage}
                    <div
                      class={`ds-memory-modal-manual-feedback control-chip ${modal.manualState.feedbackTone === "error"
                        ? "ds-memory-modal-manual-feedback-error"
                        : "ds-memory-modal-manual-feedback-success"}`}
                      role={modal.manualState.feedbackTone === "error" ? "alert" : "status"}
                    >
                      {modal.manualState.feedbackMessage}
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            {#each modal.memoryData.summaries as summary, i (summary)}
              {#if modal.isSummaryVisible(i)}
                <ModalSummaryItem
                  summaryIndex={i}
                  chatIndex={modal.effectiveChatIndex}
                  memoryData={modal.memoryData}
                  summaryItemStateMap={modal.summaryItemStateMap}
                  bind:expandedMessageState={modal.expandedMessageState}
                  bind:searchState={modal.searchState}
                  filterSelected={modal.filterSelected}
                  bulkEditState={modal.bulkEditState}
                  uiState={modal.uiState}
                  onToggleSummarySelection={modal.handleToggleSummarySelection}
                  onToggleCollapse={modal.handleToggleCollapse}
                  onDeleteSummary={modal.handleDeleteSummary}
                  onDeleteAfter={modal.handleDeleteAfter}
                />
              {/if}
            {/each}
          </div>
        {:else if modal.memoryWorkspaceTab === "settings"}
          <div
            class="ds-memory-modal-tab-panel"
            role="tabpanel"
            id="memory-panel-settings"
            aria-label="Settings panel"
          >
            {#if modal.promptOverrideCharacter}
              <div class="ds-memory-modal-prompt-override panel-shell">
                <div class="ds-memory-modal-prompt-override-title">Per-character memory prompt override</div>
                <div class="ds-memory-modal-prompt-override-grid">
                  <label class="ds-memory-modal-prompt-override-label">
                    Summarization Prompt
                    <TextAreaInput
                      className="ds-memory-modal-prompt-override-input"
                      value={modal.promptOverrideCharacter.memoryPromptOverride?.summarizationPrompt ?? ""}
                      onValueChange={modal.updatePromptOverrideSummarizationPrompt}
                      autocomplete="off"
                      margin="none"
                      optimaizedInput={false}
                    />
                  </label>
                </div>
              </div>
            {:else}
              <div class="ds-memory-modal-empty-note empty-state">
                Memory prompt override is available only for character chats.
              </div>
            {/if}
          </div>
        {:else}
          <div
            class="ds-memory-modal-tab-panel"
            role="tabpanel"
            id="memory-panel-log"
            aria-label="Log panel"
          >
            {#if modal.logDebug}
              <div class="ds-memory-modal-debug panel-shell">
                <div class="ds-memory-modal-debug-summary">
                  Last summarize log
                </div>
                <div class="ds-memory-modal-debug-body">
                  <div>Model: <span class="ds-memory-modal-debug-value">{modal.logDebug.model}</span></div>
                  <div>Mode: <span class="ds-memory-modal-debug-value">{modal.logDebug.source === "periodic" ? "Periodic Summarize" : "Summarize"}</span></div>
                  <div>Time: <span class="ds-memory-modal-debug-value">{new Date(modal.logDebug.timestamp).toLocaleString()}</span></div>
                  {#if modal.logDebug.promptSource}
                    <div>Prompt source: <span class="ds-memory-modal-debug-value">{modal.logDebug.promptSource}</span></div>
                  {/if}
                  {#if typeof modal.logDebug.start === "number" && typeof modal.logDebug.end === "number"}
                    <div>Range: <span class="ds-memory-modal-debug-value">{modal.logDebug.start} - {modal.logDebug.end}</span></div>
                  {/if}
                  <div>
                    <div class="ds-memory-modal-debug-block-title">Prompt</div>
                    <textarea
                      class="ds-memory-modal-debug-textarea control-field"
                      rows="4"
                      readonly
                      value={modal.logDebug.prompt}
                    ></textarea>
                  </div>
                  <div>
                    <div class="ds-memory-modal-debug-block-title">Input</div>
                    <textarea
                      class="ds-memory-modal-debug-textarea control-field"
                      rows="4"
                      readonly
                      value={modal.logDebug.input}
                    ></textarea>
                  </div>
                  <div>
                    <div class="ds-memory-modal-debug-block-title">Formatted</div>
                    <textarea
                      class="ds-memory-modal-debug-textarea control-field"
                      rows="6"
                      readonly
                      value={JSON.stringify(modal.logDebug.formatted, null, 2)}
                    ></textarea>
                  </div>
                  {#if modal.logDebug.rawResponse}
                    <div>
                      <div class="ds-memory-modal-debug-block-title">Raw Response</div>
                      <textarea
                        class="ds-memory-modal-debug-textarea control-field"
                        rows="6"
                        readonly
                        value={modal.logDebug.rawResponse}
                      ></textarea>
                    </div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="ds-memory-modal-empty-note empty-state">
                No summarize logs yet for this chat.
              </div>
            {/if}
          </div>
        {/if}
      </div>

      {#if modal.memoryWorkspaceTab === "summary"}
        <BulkEditActions
          bulkEditState={modal.bulkEditState}
          categories={modal.categories}
          onClearSelection={modal.handleBulkEditClearSelection}
          onUpdateSelectedCategory={modal.handleBulkEditUpdateSelectedCategory}
          onUpdateBulkSelectInput={modal.handleBulkEditUpdateBulkSelectInput}
          onApplyCategory={modal.handleBulkEditApplyCategory}
          onParseAndSelectSummaries={modal.handleBulkEditParseAndSelectSummaries}
        />
      {/if}
    </div>
  </div>
</div>
