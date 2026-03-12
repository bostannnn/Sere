<script lang="ts">
     
  import { untrack } from "svelte";
  import {
    RefreshCw,
    Trash2Icon,
    ScissorsLineDashed,
    XIcon,
    CheckIcon,
    ChevronUpIcon,
    ChevronDownIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import {
    type SerializableMemoryData,
    type SerializableSummary,
    summarize,
    getCurrentMemoryPreset,
  } from "src/ts/process/memory/memory";
  import { type OpenAIChat } from "src/ts/process/index.svelte";
  import { type Message } from "src/ts/storage/database.svelte";
  import { alertConfirm } from "src/ts/alert";
  import { DBState, selectedCharID } from "src/ts/stores.svelte";
  import type {
    SummaryItemState,
    ExpandedMessageState,
    SearchState,
    BulkEditState,
    UIState,
  } from "./types";
  import {
    alertConfirmTwice,
    getFirstMessage,
    processRegexScript,
  } from "./utils";

  interface Props {
    summaryIndex: number;
    chatIndex: number;
    memoryData: SerializableMemoryData;
    summaryItemStateMap: WeakMap<SerializableSummary, SummaryItemState>;
    expandedMessageState: ExpandedMessageState | null;
    searchState: SearchState | null;
    filterSelected: boolean;
    bulkEditState?: BulkEditState;
    uiState?: UIState;
    onToggleSummarySelection?: (index: number) => void;
    onToggleCollapse?: (index: number) => void;
    onDeleteSummary?: (index: number) => void;
    onDeleteAfter?: (index: number) => void;
  }

  let {
    summaryIndex,
    chatIndex,
    memoryData,
    summaryItemStateMap,
    expandedMessageState = $bindable(),
    searchState = $bindable(),
    filterSelected,
    bulkEditState,
    uiState,
    onToggleSummarySelection,
    onToggleCollapse,
    onDeleteSummary,
    onDeleteAfter,
  }: Props = $props();

  const summary = $derived(memoryData.summaries[summaryIndex]);
  const summaryItemState = $state<SummaryItemState>({
    originalRef: null,
    chatMemoRefs: [],
  });

  let isRerolling = $state(false);
  let rerolled = $state<string | null>(null);
  let summaryText = $state("");

  $effect.pre(() => {
    summaryItemStateMap.set(summary, summaryItemState);
  });

  $effect.pre(() => {
    if (!summary) return;
    void summary?.chatMemos?.length;

    untrack(() => {
      summaryItemState.chatMemoRefs = new Array(summary.chatMemos.length).fill(
        null
      );

      expandedMessageState = null;
      searchState = null;
    });
  });

  $effect(() => {
    const nextSummaryText = summary?.text ?? "";
    if (summaryText !== nextSummaryText) {
      summaryText = nextSummaryText;
    }
  });

  function isOrphan(): boolean {
    const char = DBState.db.characters[$selectedCharID];
    const chat = char.chats[DBState.db.characters[$selectedCharID].chatPage];

    for (const chatMemo of summary.chatMemos) {
      if (chatMemo == null) {
        // Check first message exists
        if (!getFirstMessage()) return true;
      } else {
        if (chat.message.findIndex((m) => m.chatId === chatMemo) === -1)
          return true;
      }
    }

    return false;
  }

  function getChatMemoLabel(chatMemo: string | null): string {
    const char = DBState.db.characters[$selectedCharID];
    const chat = char?.chats?.[chatIndex];
    if (!chat) {
      return chatMemo == null
        ? language.memoryModal.connectedFirstMessageLabel
        : chatMemo;
    }
    if (chatMemo == null) {
      return language.memoryModal.connectedFirstMessageLabel;
    }
    const index = chat.message.findIndex((m) => m.chatId === chatMemo);
    if (index === -1) return chatMemo;
    return `#${index + 1}`;
  }

  async function toggleReroll(): Promise<void> {
    if (isRerolling) return;
    if (isOrphan()) return;

    isRerolling = true;
    rerolled = "Loading...";

    try {
      const messages = await Promise.all(
        summary.chatMemos.map((chatMemo) => getMessageFromChatMemo(chatMemo))
      );
      const toSummarize: OpenAIChat[] = messages
        .filter((message): message is Message => message !== null)
        .map((message) => ({
          role: (message.role === "char"
            ? "assistant"
            : message.role) as OpenAIChat["role"],
          content: message.data,
        }));

      if (toSummarize.length === 0) {
        rerolled = "Reroll failed";
        return;
      }

      const summarizeResult = await summarize(toSummarize);

      rerolled = summarizeResult;
    } catch {
      rerolled = "Reroll failed";
    } finally {
      isRerolling = false;
    }
  }

  async function getMessageFromChatMemo(
    chatMemo: string | null
  ): Promise<Message | null> {
    const char = DBState.db.characters[$selectedCharID];
    const chat = char.chats[DBState.db.characters[$selectedCharID].chatPage];
    const shouldProcess = getCurrentMemoryPreset().settings.processRegexScript;

    let msg: Message | null = null;
    let msgIndex = -1;

    if (chatMemo == null) {
      const firstMessage = getFirstMessage();

      if (!firstMessage) return null;
      msg = { role: "char", data: firstMessage };
    } else {
      msgIndex = chat.message.findIndex((m) => m.chatId === chatMemo);
      if (msgIndex === -1) return null;
      msg = chat.message[msgIndex];
    }

    if (!msg) return null;
    return shouldProcess ? await processRegexScript(msg, msgIndex) : msg;
  }

  async function deleteThis(): Promise<void> {
    if (await alertConfirm(language.memoryModal.deleteThisConfirmMessage)) {
      onDeleteSummary?.(summaryIndex);
    }
  }

  async function deleteAfter(): Promise<void> {
    if (
      await alertConfirmTwice(
        language.memoryModal.deleteAfterConfirmMessage,
        language.memoryModal.deleteAfterConfirmSecondMessage
      )
    ) {
      onDeleteAfter?.(summaryIndex);
    }
  }

  function cancelRerolled(): void {
    rerolled = null;
  }

  function applyRerolled(): void {
    if (!rerolled) return;
    summaryText = rerolled;
    summary.text = rerolled;
    rerolled = null;
  }

  function updateSummaryText(value: string): void {
    summaryText = value;
    if (summary.text !== value) {
      summary.text = value;
    }
  }

  function isMessageExpanded(chatMemo: string | null): boolean {
    if (!expandedMessageState) return false;

    return (
      expandedMessageState.summaryIndex === summaryIndex &&
      expandedMessageState.selectedChatMemo === chatMemo
    );
  }

  function toggleExpandMessage(chatMemo: string | null): void {
    expandedMessageState = isMessageExpanded(chatMemo)
      ? null
      : {
          summaryIndex,
          selectedChatMemo: chatMemo,
        };
  }

  function toggleSummaryCollapse(): void {
    if (onToggleCollapse) {
      onToggleCollapse(summaryIndex);
    }
  }

  function isCollapsed(): boolean {
    return uiState?.collapsedSummaries?.has(summaryIndex) ?? false;
  }

  function isSelected(): boolean {
    return bulkEditState?.selectedSummaries?.has(summaryIndex) ?? false;
  }
</script>

<div
  class="memory-summary-root panel-shell"
  class:memory-summary-root-selected={isSelected()}
>
  <!-- Original Summary Header -->
  <div class="memory-summary-row-between">
    <!-- Summary Number / Metrics Container -->
    <div class="memory-summary-row-inline">
      <!-- Bulk Edit Checkbox -->
      {#if bulkEditState?.isEnabled}
        <input
          type="checkbox"
          class="memory-summary-checkbox"
          checked={isSelected()}
          onchange={() => onToggleSummarySelection?.(summaryIndex)}
        />
      {/if}

      <span class="memory-summary-label"
        >{language.memoryModal.summaryNumberLabel.replace(
          "{0}",
          (summaryIndex + 1).toString()
        )}</span
      >

      {#if filterSelected && memoryData.metrics}
        <div class="memory-summary-chip-wrap-tight">
          {#if memoryData.metrics.lastImportantSummaries.includes(summaryIndex)}
            <span
              class="memory-summary-metric-chip control-chip"
            >
              Important
            </span>
          {/if}
          {#if memoryData.metrics.lastRecentSummaries.includes(summaryIndex)}
            <span
              class="memory-summary-metric-chip control-chip"
            >
              Recent
            </span>
          {/if}
          {#if memoryData.metrics.lastSimilarSummaries.includes(summaryIndex)}
            <span
              class="memory-summary-metric-chip control-chip"
            >
              Similar
            </span>
          {/if}
          {#if memoryData.metrics.lastRandomSummaries.includes(summaryIndex)}
            <span
              class="memory-summary-metric-chip control-chip"
            >
              Random
            </span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Buttons Container -->
    <div class="memory-summary-row-inline action-rail">
      <!-- Reroll Button -->
      <button
        type="button"
        class="memory-summary-icon-button icon-btn icon-btn--sm"
        title="Reroll summary"
        aria-label="Reroll summary"
        tabindex="-1"
        disabled={isOrphan()}
        onclick={async () => await toggleReroll()}
      >
        <RefreshCw class="memory-summary-icon" />
      </button>

      <!-- Delete This Button -->
      <button
        type="button"
        class="memory-summary-icon-button memory-summary-danger-hover icon-btn icon-btn--sm"
        title="Delete summary"
        aria-label="Delete summary"
        tabindex="-1"
        onclick={async () => await deleteThis()}
      >
        <Trash2Icon class="memory-summary-icon" />
      </button>

      <!-- Delete After Button -->
      <button
        type="button"
        class="memory-summary-icon-button memory-summary-danger-hover icon-btn icon-btn--sm"
        title="Delete summaries after this"
        aria-label="Delete summaries after this"
        tabindex="-1"
        onclick={async () => await deleteAfter()}
      >
        <ScissorsLineDashed class="memory-summary-icon" />
      </button>
    </div>
  </div>

  <!-- Original Summary -->
  <div class="memory-summary-section">
    <textarea
      class="memory-summary-textarea memory-summary-textarea-focus control-field"
      bind:this={summaryItemState.originalRef}
      value={summaryText}
      oninput={(event) => {
        updateSummaryText(event.currentTarget.value);
      }}
      onfocus={() => {
        if (searchState && !searchState.isNavigating) {
          searchState.requestedSearchFromIndex = summaryIndex;
        }
      }}
    ></textarea>
  </div>

  {#if rerolled}
    <!-- Rerolled Summary Header -->
    <div class="memory-summary-section">
      <div class="memory-summary-row-between">
        <span class="memory-summary-label"
          >{language.memoryModal.rerolledSummaryLabel}</span
        >
        <div class="memory-summary-row-inline action-rail">
          <!-- Cancel Button -->
          <button
            type="button"
            class="memory-summary-icon-button icon-btn icon-btn--sm"
            title="Cancel rerolled summary"
            aria-label="Cancel rerolled summary"
            tabindex="-1"
            onclick={cancelRerolled}
          >
            <XIcon class="memory-summary-icon" />
          </button>

          <!-- Apply Button -->
          <button
            type="button"
            class="memory-summary-icon-button memory-summary-accent-hover icon-btn icon-btn--sm"
            title="Apply rerolled summary"
            aria-label="Apply rerolled summary"
            tabindex="-1"
            onclick={applyRerolled}
          >
            <CheckIcon class="memory-summary-icon" />
          </button>
        </div>
      </div>
    </div>

    <!-- Rerolled Summary -->
    <div class="memory-summary-section">
      <textarea
        class="memory-summary-textarea memory-summary-textarea-focus control-field"
        tabindex="-1"
        bind:value={rerolled}
      >
      </textarea>
    </div>
  {/if}

  <!-- Connected Messages Header -->
  <div class="memory-summary-section">
    <div class="memory-summary-row-between">
      <button
        type="button"
        class="memory-summary-toggle-button control-chip"
        tabindex="-1"
        onclick={toggleSummaryCollapse}
      >
        {#if isCollapsed()}
          <ChevronDownIcon class="memory-summary-icon" />
        {:else}
          <ChevronUpIcon class="memory-summary-icon" />
        {/if}
        <span>{language.memoryModal.connectedMessageCountLabel.replace(
          "{0}",
          summary.chatMemos.length.toString()
        )}</span>
      </button>
    </div>
  </div>

  {#if !isCollapsed()}
    <!-- Connected Message IDs -->
    <div class="memory-summary-chatmemo-wrap">
      {#key summary.chatMemos.length}
        {#each summary.chatMemos as chatMemo, memoIndex (chatMemo)}
          <button
            type="button"
            class="memory-summary-chatmemo-button control-chip"
            class:memory-summary-chatmemo-button-active={isMessageExpanded(chatMemo)}
            tabindex="-1"
            bind:this={summaryItemState.chatMemoRefs[memoIndex]}
            onclick={() => toggleExpandMessage(chatMemo)}
          >
            {getChatMemoLabel(chatMemo)}
          </button>
        {/each}
      {/key}
    </div>

    {#if expandedMessageState?.summaryIndex === summaryIndex}
      <!-- Expanded Message -->
      <div class="memory-summary-section">
        {#await getMessageFromChatMemo(expandedMessageState.selectedChatMemo) then expandedMessage}
          {#if expandedMessage}
            <!-- Role -->
            <div class="memory-summary-subtitle">
              {language.memoryModal.connectedMessageRoleLabel.replace(
                "{0}",
                expandedMessage.role
              )}
            </div>

            <!-- Content -->
            <textarea
              class="memory-summary-textarea control-field"
              readonly
              tabindex="-1"
              value={expandedMessage.data}
            ></textarea>
          {:else}
            <span class="memory-summary-error-text"
              >{language.memoryModal.connectedMessageNotFoundLabel}</span
            >
          {/if}
        {:catch error}
          <span class="memory-summary-error-text"
            >{language.memoryModal.connectedMessageLoadingError.replace(
              "{0}",
              error.message
            )}</span
          >
        {/await}
      </div>
    {/if}
  {/if}

</div>

<style>
  .memory-summary-root.panel-shell {
    display: flex;
    flex-direction: column;
    padding: var(--ds-space-2);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-lg);
    background: color-mix(in srgb, var(--ds-surface-2) 80%, transparent);
  }

  .memory-summary-root-selected {
    border-color: var(--ds-border-strong);
  }

  .memory-summary-row-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .memory-summary-row-inline {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .memory-summary-label {
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
  }

  .memory-summary-chip-wrap-tight {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ds-space-1);
  }

  .memory-summary-metric-chip.control-chip {
    padding: 2px 6px;
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-3);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-xs);
    white-space: nowrap;
  }

  .memory-summary-checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: var(--ds-radius-sm);
    border: 1px solid var(--ds-border-subtle);
    background: var(--ds-surface-1);
    color: var(--ds-border-strong);
    accent-color: var(--ds-border-strong);
    outline: none;
  }

  .memory-summary-checkbox:focus {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-border-strong) 45%, transparent);
  }

  .memory-summary-icon-button.icon-btn.icon-btn--sm {
    padding: var(--ds-space-2);
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .memory-summary-icon-button.icon-btn.icon-btn--sm:hover {
    color: var(--ds-text-primary);
  }

  :global(.memory-summary-icon) {
    width: 1rem;
    height: 1rem;
  }

  .memory-summary-section {
    margin-top: var(--ds-space-2);
  }

  .memory-summary-textarea.control-field {
    width: 100%;
    min-height: 10rem;
    padding: var(--ds-space-2);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-sm);
    resize: vertical;
    background: var(--ds-surface-3);
    color: var(--ds-text-primary);
    transition: border-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .memory-summary-textarea-focus.control-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-border-strong) 45%, transparent);
  }

  .memory-summary-subtitle {
    margin-bottom: var(--ds-space-2);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
  }

  .memory-summary-toggle-button.control-chip {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
    padding: var(--ds-space-2) var(--ds-space-3);
    border-radius: var(--ds-radius-pill);
    background: color-mix(in srgb, var(--ds-surface-3) 82%, transparent);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .memory-summary-toggle-button.control-chip:hover {
    color: var(--ds-text-primary);
    background: color-mix(in srgb, var(--ds-surface-active) 80%, transparent);
  }

  .memory-summary-chatmemo-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ds-space-2);
    margin-top: var(--ds-space-2);
  }

  .memory-summary-chatmemo-button.control-chip {
    padding: var(--ds-space-2) var(--ds-space-3);
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-3);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-xs);
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
      box-shadow var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .memory-summary-chatmemo-button.control-chip:hover {
    background: var(--ds-surface-active);
  }

  .memory-summary-chatmemo-button.memory-summary-chatmemo-button-active.control-chip {
    box-shadow: 0 0 0 2px var(--ds-border-strong);
  }

  .memory-summary-danger-hover:hover {
    color: var(--ds-text-danger);
  }

  .memory-summary-accent-hover:hover {
    color: var(--ds-border-strong);
  }

  .memory-summary-error-text {
    color: var(--ds-text-danger);
    font-size: var(--ds-font-size-sm);
  }

  @media (min-width: 640px) {
    .memory-summary-root.panel-shell {
      padding: var(--ds-space-4);
    }

    .memory-summary-section {
      margin-top: var(--ds-space-4);
    }

    .memory-summary-subtitle {
      margin-bottom: var(--ds-space-4);
    }

    .memory-summary-textarea.control-field {
      min-height: 14rem;
      padding: var(--ds-space-4);
    }
  }
</style>
