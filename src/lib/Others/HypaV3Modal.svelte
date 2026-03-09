<script lang="ts">
  import { ChevronUpIcon, ChevronDownIcon } from "@lucide/svelte";
  import { DBState } from "src/ts/stores.svelte";
  import { language } from "src/lang";
  import ModalHeader from "./HypaV3Modal/modal-header.svelte";
  import ModalSummaryItem from "./HypaV3Modal/modal-summary-item.svelte";
  import BulkEditActions from "./HypaV3Modal/bulk-edit-actions.svelte";
  import BulkResummaryResult from "./HypaV3Modal/bulk-resummary-result.svelte";
  import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
  import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
  import CheckInput from "src/lib/UI/GUI/CheckInput.svelte";
  import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
  import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
  import { useHypaV3Modal } from "./HypaV3Modal/useHypaV3Modal.svelte";

  interface Props {
    embedded?: boolean;
  }

  const {
    embedded = false,
  }: Props = $props();
  const modal = useHypaV3Modal(() => embedded);

</script>

<!-- Modal Backdrop -->
<div class={embedded ? "ds-hypa-sidebar-root" : "ds-hypa-modal-overlay"}>
  <!-- Modal Wrapper -->
  <div class={embedded ? "ds-hypa-sidebar-wrap" : "ds-hypa-modal-wrap"}>
    <!-- Modal Window -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="ds-hypa-modal-window"
      class:ds-hypa-sidebar-window={embedded}
      class:ds-hypa-modal-window-empty={modal.hypaV3Data.summaries.length === 0}
      onclick={(e) => {
        e.stopPropagation();
        modal.openDropdownClosed();
      }}
    >
      {#if !embedded}
        <!-- Header -->
        <ModalHeader
          {embedded}
          activeTab={modal.memoryWorkspaceTab}
          bind:searchState={modal.searchState}
          bind:dropdownOpen={modal.uiState.dropdownOpen}
          bind:filterSelected={modal.filterSelected}
          bulkEditState={modal.bulkEditState}
          uiState={modal.uiState}
          hypaV3Data={modal.hypaV3Data}
          onResetData={modal.handleResetData}
          onToggleBulkEditMode={modal.handleToggleBulkEditMode}
        />
      {/if}

      <SettingsSubTabs
        className="ds-hypa-memory-tabs"
        items={modal.memoryWorkspaceTabItems}
        selectedId={modal.selectedMemoryWorkspaceTabId}
        onSelect={modal.selectMemoryWorkspaceTabById}
      />

      <!-- Scrollable Container -->
      <div class="ds-hypa-modal-scroll" tabindex="-1">
        {#if modal.memoryWorkspaceTab === "summary"}
          <div
            class="ds-hypa-modal-tab-panel"
            role="tabpanel"
            id="hypa-memory-panel-summary"
            aria-label="Summary panel"
          >
            {#if embedded}
              <ModalHeader
                {embedded}
                activeTab={modal.memoryWorkspaceTab}
                bind:searchState={modal.searchState}
                bind:dropdownOpen={modal.uiState.dropdownOpen}
                bind:filterSelected={modal.filterSelected}
                bulkEditState={modal.bulkEditState}
                uiState={modal.uiState}
                hypaV3Data={modal.hypaV3Data}
                onResetData={modal.handleResetData}
                onToggleBulkEditMode={modal.handleToggleBulkEditMode}
              />
            {/if}

            {#if modal.hypaV3Data.summaries.length === 0}
              {#if modal.isHypaV2ConversionPossible()}
                <div class="ds-hypa-modal-convert-card panel-shell">
                  <div class="ds-hypa-modal-convert-center">
                    <div class="ds-hypa-modal-convert-label">
                      {language.hypaV3Modal.convertLabel}
                    </div>
                    <button
                      type="button"
                      class="ds-hypa-modal-convert-button control-chip"
                      onclick={modal.handleConvertHypaV2}
                    >
                      {language.hypaV3Modal.convertButton}
                    </button>
                  </div>
                </div>
              {:else}
                <div class="ds-hypa-modal-empty-note empty-state">
                  {language.hypaV3Modal.noSummariesLabel}
                </div>
              {/if}
            {:else if modal.searchState}
              <div class="ds-hypa-modal-search-sticky">
                <div class="ds-hypa-modal-search-row">
                  <div class="ds-hypa-modal-search-form-wrap">
                    <form
                      class="ds-hypa-modal-search-form"
                      onsubmit={(e) => {
                        e.preventDefault();
                        modal.onSearch({ key: "Enter" } as KeyboardEvent);
                      }}
                    >
                      <input
                        class="ds-hypa-modal-search-input control-field"
                        placeholder={language.hypaV3Modal.searchPlaceholder}
                        bind:this={modal.searchState.ref}
                        bind:value={modal.searchState.query}
                        oninput={modal.clearSearchResults}
                        onkeydown={modal.onSearch}
                      />
                    </form>

                    {#if modal.searchState.results.length > 0}
                      <span class="ds-hypa-modal-search-counter">
                        {modal.searchState.currentResultIndex + 1}/{modal.searchState.results
                          .length}
                      </span>
                    {/if}
                  </div>

                  <button
                    type="button"
                    class="ds-hypa-modal-search-nav-button icon-btn icon-btn--sm"
                    title="Previous search result"
                    aria-label="Previous search result"
                    onclick={() => {
                      modal.onSearch({ shiftKey: true, key: "Enter" } as KeyboardEvent);
                    }}
                  >
                    <ChevronUpIcon class="ds-hypa-modal-search-nav-icon" />
                  </button>

                  <button
                    type="button"
                    class="ds-hypa-modal-search-nav-button icon-btn icon-btn--sm"
                    title="Next search result"
                    aria-label="Next search result"
                    onclick={() => {
                      modal.onSearch({ key: "Enter" } as KeyboardEvent);
                    }}
                  >
                    <ChevronDownIcon class="ds-hypa-modal-search-nav-icon" />
                  </button>
                </div>
              </div>
            {/if}

            <div class="ds-hypa-modal-tools panel-shell">
              <div class="ds-hypa-modal-tools-body">
                {#if modal.currentChar && DBState.db.hypaV3}
                  <CheckInput
                    name={language.ToggleHypaMemory}
                    check={modal.currentChar.supaMemory ?? false}
                    margin={false}
                    onChange={(check) => {
                      modal.currentChar.supaMemory = check;
                    }}
                  />
                {/if}

                {#if !embedded && modal.chatList.length > 1}
                  <div class="ds-hypa-modal-chat-row">
                    <span class="ds-hypa-modal-chat-label">Chat</span>
                    <SelectInput
                      className="ds-hypa-modal-chat-select"
                      value={modal.effectiveChatIndex}
                      onchange={(e) => {
                        modal.setModalChatIndexFromSelect(parseInt(e.currentTarget.value));
                      }}
                    >
                      {#each modal.chatList as chat, i (chat.id ?? i)}
                        <OptionInput value={i}>
                          {chat.name && chat.name.trim().length > 0 ? chat.name : `Chat ${i + 1}`}
                        </OptionInput>
                      {/each}
                    </SelectInput>
                  </div>
                {/if}

                <div class={`ds-hypa-modal-manual-sticky${embedded ? " ds-hypa-modal-manual-embedded" : ""}`}>
                  <div class="ds-hypa-modal-manual-row">
                    <div class="ds-hypa-modal-manual-col">
                      <label class="ds-hypa-modal-manual-label" for={modal.manualRangeStartInputId}>Manual summarize range</label>
                      <div class="ds-hypa-modal-manual-input-row">
                        <input
                          id={modal.manualRangeStartInputId}
                          class="ds-hypa-modal-manual-input control-field"
                          type="number"
                          min="1"
                          max={modal.chatList[modal.effectiveChatIndex]?.message?.length ?? 1}
                          placeholder="Start"
                          bind:value={modal.manualState.start}
                        />
                        <span class="ds-hypa-modal-manual-to">to</span>
                        <input
                          id={modal.manualRangeEndInputId}
                          class="ds-hypa-modal-manual-input control-field"
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
                      class="ds-hypa-modal-manual-submit ds-ui-button ds-ui-button-size-md ds-ui-button--primary"
                      class:is-disabled={modal.manualState.processing}
                      disabled={modal.manualState.processing}
                      onclick={modal.manualSummarizeRange}
                    >
                      {modal.manualState.processing ? "Summarizing..." : "Summarize"}
                    </button>
                  </div>
                  {#if modal.manualState.feedbackMessage}
                    <div
                      class={`ds-hypa-modal-manual-feedback control-chip ${modal.manualState.feedbackTone === "error"
                        ? "ds-hypa-modal-manual-feedback-error"
                        : "ds-hypa-modal-manual-feedback-success"}`}
                      role={modal.manualState.feedbackTone === "error" ? "alert" : "status"}
                    >
                      {modal.manualState.feedbackMessage}
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            {#each modal.hypaV3Data.summaries as summary, i (summary)}
              {#if modal.isSummaryVisible(i)}
                <ModalSummaryItem
                  summaryIndex={i}
                  chatIndex={modal.effectiveChatIndex}
                  hypaV3Data={modal.hypaV3Data}
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
            class="ds-hypa-modal-tab-panel"
            role="tabpanel"
            id="hypa-memory-panel-settings"
            aria-label="Settings panel"
          >
            {#if modal.promptOverrideCharacter}
              <div class="ds-hypa-modal-prompt-override panel-shell">
                <div class="ds-hypa-modal-prompt-override-title">Per-character memory prompt override</div>
                <div class="ds-hypa-modal-prompt-override-grid">
                  <label class="ds-hypa-modal-prompt-override-label">
                    Summarization Prompt
                    <TextAreaInput
                      className="ds-hypa-modal-prompt-override-input"
                      bind:value={modal.promptOverrideCharacter.hypaV3PromptOverride.summarizationPrompt}
                      autocomplete="off"
                      margin="none"
                      optimaizedInput={false}
                    />
                  </label>
                  <label class="ds-hypa-modal-prompt-override-label">
                    Re-summarization Prompt
                    <TextAreaInput
                      className="ds-hypa-modal-prompt-override-input"
                      bind:value={modal.promptOverrideCharacter.hypaV3PromptOverride.reSummarizationPrompt}
                      autocomplete="off"
                      margin="none"
                      optimaizedInput={false}
                    />
                  </label>
                </div>
              </div>
            {:else}
              <div class="ds-hypa-modal-empty-note empty-state">
                Memory prompt override is available only for character chats.
              </div>
            {/if}
          </div>
        {:else}
          <div
            class="ds-hypa-modal-tab-panel"
            role="tabpanel"
            id="hypa-memory-panel-log"
            aria-label="Log panel"
          >
            {#if modal.logDebug}
              <div class="ds-hypa-modal-debug panel-shell">
                <div class="ds-hypa-modal-debug-summary">
                  Last summarize log
                </div>
                <div class="ds-hypa-modal-debug-body">
                  <div>Model: <span class="ds-hypa-modal-debug-value">{modal.logDebug.model}</span></div>
                  <div>Mode: <span class="ds-hypa-modal-debug-value">{modal.logDebug.source === "periodic" ? "Periodic Summarize" : (modal.logDebug.isResummarize ? "Resummarize" : "Summarize")}</span></div>
                  <div>Time: <span class="ds-hypa-modal-debug-value">{new Date(modal.logDebug.timestamp).toLocaleString()}</span></div>
                  {#if modal.logDebug.promptSource}
                    <div>Prompt source: <span class="ds-hypa-modal-debug-value">{modal.logDebug.promptSource}</span></div>
                  {/if}
                  {#if typeof modal.logDebug.start === "number" && typeof modal.logDebug.end === "number"}
                    <div>Range: <span class="ds-hypa-modal-debug-value">{modal.logDebug.start} - {modal.logDebug.end}</span></div>
                  {/if}
                  <div>
                    <div class="ds-hypa-modal-debug-block-title">Prompt</div>
                    <textarea
                      class="ds-hypa-modal-debug-textarea control-field"
                      rows="4"
                      readonly
                      value={modal.logDebug.prompt}
                    ></textarea>
                  </div>
                  <div>
                    <div class="ds-hypa-modal-debug-block-title">Input</div>
                    <textarea
                      class="ds-hypa-modal-debug-textarea control-field"
                      rows="4"
                      readonly
                      value={modal.logDebug.input}
                    ></textarea>
                  </div>
                  <div>
                    <div class="ds-hypa-modal-debug-block-title">Formatted</div>
                    <textarea
                      class="ds-hypa-modal-debug-textarea control-field"
                      rows="6"
                      readonly
                      value={JSON.stringify(modal.logDebug.formatted, null, 2)}
                    ></textarea>
                  </div>
                  {#if modal.logDebug.rawResponse}
                    <div>
                      <div class="ds-hypa-modal-debug-block-title">Raw Response</div>
                      <textarea
                        class="ds-hypa-modal-debug-textarea control-field"
                        rows="6"
                        readonly
                        value={modal.logDebug.rawResponse}
                      ></textarea>
                    </div>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="ds-hypa-modal-empty-note empty-state">
                No summarize logs yet for this chat.
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Bulk Resummary Result -->
      {#if modal.memoryWorkspaceTab === "summary"}
        <BulkResummaryResult
          bulkResummaryState={modal.bulkResummaryState}
          onReroll={modal.rerollBulkResummary}
          onApply={modal.applyBulkResummary}
          onCancel={modal.cancelBulkResummary}
        />

        <BulkEditActions
          bulkEditState={modal.bulkEditState}
          categories={modal.categories}
          showImportantOnly={false}
          selectedCategoryFilter="all"
          onResummarize={modal.resummarizeBulkSelected}
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
