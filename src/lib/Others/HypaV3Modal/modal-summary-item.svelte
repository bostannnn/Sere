<script lang="ts">
     
  import { tick, untrack } from "svelte";
  import {
    LanguagesIcon,
    StarIcon,
    RefreshCw,
    Trash2Icon,
    ScissorsLineDashed,
    XIcon,
    CheckIcon,
    TagIcon,
    ChevronUpIcon,
    ChevronDownIcon,
  } from "@lucide/svelte";
  import { language } from "src/lang";
  import {
    type SerializableHypaV3Data,
    type SerializableSummary,
    summarize,
    getCurrentHypaV3Preset,
  } from "src/ts/process/memory/hypav3";
  import { type OpenAIChat } from "src/ts/process/index.svelte";
  import { type Message } from "src/ts/storage/database.svelte";
  import { translateHTML } from "src/ts/translator/translator";
  import { alertConfirm } from "src/ts/alert";
  import { DBState, selectedCharID } from "src/ts/stores.svelte";
  import type {
    SummaryItemState,
    ExpandedMessageState,
    SearchState,
    Category,
    BulkEditState,
    UIState,
  } from "./types";
  import {
    alertConfirmTwice,
    handleDualAction,
    getFirstMessage,
    processRegexScript,
    getCategoryName,
  } from "./utils";

  interface Props {
    summaryIndex: number;
    chatIndex: number;
    hypaV3Data: SerializableHypaV3Data;
    summaryItemStateMap: WeakMap<SerializableSummary, SummaryItemState>;
    expandedMessageState: ExpandedMessageState | null;
    searchState: SearchState | null;
    filterSelected: boolean;
    categories: Category[];
    bulkEditState?: BulkEditState;
    uiState?: UIState;
    onToggleSummarySelection?: (index: number) => void;
    onOpenTagManager?: (index: number) => void;
    onToggleCollapse?: (index: number) => void;
    onDeleteSummary?: (index: number) => void;
    onDeleteAfter?: (index: number) => void;
  }

  let {
    summaryIndex,
    chatIndex,
    hypaV3Data,
    summaryItemStateMap,
    expandedMessageState = $bindable(),
    searchState = $bindable(),
    filterSelected,
    categories,
    bulkEditState,
    uiState,
    onToggleSummarySelection,
    onOpenTagManager,
    onToggleCollapse,
    onDeleteSummary,
    onDeleteAfter,
  }: Props = $props();

  const summary = $derived(hypaV3Data.summaries[summaryIndex]);
  const summaryItemState = $state<SummaryItemState>({
    originalRef: null,
    translationRef: null,
    rerolledTranslationRef: null,
    chatMemoRefs: [],
  });

  let isTranslating = $state(false);
  let translation = $state<string | null>(null);
  let isRerolling = $state(false);
  let rerolled = $state<string | null>(null);
  let isTranslatingRerolled = $state(false);
  let rerolledTranslation = $state<string | null>(null);

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

  async function toggleTranslate(regenerate: boolean): Promise<void> {
    if (isTranslating) return;

    if (translation) {
      translation = null;
      return;
    }

    isTranslating = true;
    translation = "Loading...";

    // Focus on translation element after it's rendered
    await tick();

    if (summaryItemState.translationRef) {
      summaryItemState.translationRef.focus();
      summaryItemState.translationRef.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }

    // Translate
    const result = await translate(summary.text, regenerate);

    translation = result;
    isTranslating = false;
  }

  async function translate(text: string, regenerate: boolean): Promise<string> {
    try {
      return await translateHTML(text, false, "", -1, regenerate);
    } catch (error) {
      return `Translation failed: ${error}`;
    }
  }

  function toggleImportant(): void {
    summary.isImportant = !summary.isImportant;
  }

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
        ? language.hypaV3Modal.connectedFirstMessageLabel
        : chatMemo;
    }
    if (chatMemo == null) {
      return language.hypaV3Modal.connectedFirstMessageLabel;
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
    const shouldProcess = getCurrentHypaV3Preset().settings.processRegexScript;

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
    if (await alertConfirm(language.hypaV3Modal.deleteThisConfirmMessage)) {
      onDeleteSummary?.(summaryIndex);
    }
  }

  async function deleteAfter(): Promise<void> {
    if (
      await alertConfirmTwice(
        language.hypaV3Modal.deleteAfterConfirmMessage,
        language.hypaV3Modal.deleteAfterConfirmSecondMessage
      )
    ) {
      onDeleteAfter?.(summaryIndex);
    }
  }

  async function toggleTranslateRerolled(regenerate: boolean): Promise<void> {
    if (isTranslatingRerolled) return;

    if (rerolledTranslation) {
      rerolledTranslation = null;
      return;
    }

    if (!rerolled) return;

    isTranslatingRerolled = true;
    rerolledTranslation = "Loading...";

    // Focus on rerolled translation element after it's rendered
    await tick();

    if (summaryItemState.rerolledTranslationRef) {
      summaryItemState.rerolledTranslationRef.focus();
      summaryItemState.rerolledTranslationRef.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }

    // Translate
    const result = await translate(rerolled, regenerate);

    rerolledTranslation = result;
    isTranslatingRerolled = false;
  }

  function cancelRerolled(): void {
    rerolled = null;
    rerolledTranslation = null;
  }

  function applyRerolled(): void {
    if (!rerolled) return;
    summary.text = rerolled;
    translation = null;
    rerolled = null;
    rerolledTranslation = null;
  }

  async function toggleTranslateExpandedMessage(
    regenerate: boolean
  ): Promise<void> {
    if (!expandedMessageState || expandedMessageState.isTranslating) return;

    if (expandedMessageState.translation) {
      expandedMessageState.translation = null;
      return;
    }

    const message = await getMessageFromChatMemo(
      expandedMessageState.selectedChatMemo
    );

    if (!message) return;

    expandedMessageState.isTranslating = true;
    expandedMessageState.translation = "Loading...";

    // Focus on translation element after it's rendered
    await tick();

    if (expandedMessageState.translationRef) {
      expandedMessageState.translationRef.focus();
      expandedMessageState.translationRef.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }

    // Translate
    const result = await translate(message.data, regenerate);

    expandedMessageState.translation = result;
    expandedMessageState.isTranslating = false;
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
          isTranslating: false,
          translation: null,
          translationRef: null,
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
  class="hypa-summary-root panel-shell"
  class:hypa-summary-root-selected={isSelected()}
>
  <!-- Original Summary Header -->
  <div class="hypa-summary-row-between">
    <!-- Summary Number / Metrics Container -->
    <div class="hypa-summary-row-inline">
      <!-- Bulk Edit Checkbox -->
      {#if bulkEditState?.isEnabled}
        <input
          type="checkbox"
          class="hypa-summary-checkbox"
          checked={isSelected()}
          onchange={() => onToggleSummarySelection?.(summaryIndex)}
        />
      {/if}

      <span class="hypa-summary-label"
        >{language.hypaV3Modal.summaryNumberLabel.replace(
          "{0}",
          (summaryIndex + 1).toString()
        )}</span
      >

      <!-- Category Tag -->
      <span class="hypa-summary-chip control-chip">
        <TagIcon class="hypa-summary-icon-xs-inline" />
        {getCategoryName(summary.categoryId, categories)}
      </span>

      <!-- Individual Tags -->
      {#if summary.tags && summary.tags.length > 0}
        {#each summary.tags as tag (tag)}
          <button
            type="button"
            class="hypa-summary-tag-button control-chip"
            onclick={() => onOpenTagManager?.(summaryIndex)}
          >
            #{tag}
          </button>
        {/each}
      {/if}

      <!-- Add Tag Button -->
      <button
        type="button"
        class="hypa-summary-chip-button control-chip"
        onclick={() => onOpenTagManager?.(summaryIndex)}
        title={language.hypaV3Modal.tagManager}
      >
        + {language.hypaV3Modal.tag}
      </button>

      {#if filterSelected && hypaV3Data.metrics}
        <div class="hypa-summary-chip-wrap-tight">
          {#if hypaV3Data.metrics.lastImportantSummaries.includes(summaryIndex)}
            <span
              class="hypa-summary-metric-chip control-chip"
            >
              Important
            </span>
          {/if}
          {#if hypaV3Data.metrics.lastRecentSummaries.includes(summaryIndex)}
            <span
              class="hypa-summary-metric-chip control-chip"
            >
              Recent
            </span>
          {/if}
          {#if hypaV3Data.metrics.lastSimilarSummaries.includes(summaryIndex)}
            <span
              class="hypa-summary-metric-chip control-chip"
            >
              Similar
            </span>
          {/if}
          {#if hypaV3Data.metrics.lastRandomSummaries.includes(summaryIndex)}
            <span
              class="hypa-summary-metric-chip control-chip"
            >
              Random
            </span>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Buttons Container -->
    <div class="hypa-summary-row-inline action-rail">
      <!-- Translate Button -->
      <button
        type="button"
        class="hypa-summary-icon-button icon-btn icon-btn--sm"
        title="Translate summary"
        aria-label="Translate summary"
        tabindex="-1"
        use:handleDualAction={{
          onMainAction: () => toggleTranslate(false),
          onAlternativeAction: () => toggleTranslate(true),
        }}
      >
        <LanguagesIcon class="hypa-summary-icon" />
      </button>

      <!-- Important Button -->
      <button
        type="button"
        class="hypa-summary-icon-button icon-btn icon-btn--sm"
        class:hypa-summary-icon-button-important={summary.isImportant}
        title="Toggle important"
        aria-label="Toggle important"
        tabindex="-1"
        onclick={toggleImportant}
      >
        <StarIcon class="hypa-summary-icon" />
      </button>

      <!-- Reroll Button -->
      <button
        type="button"
        class="hypa-summary-icon-button icon-btn icon-btn--sm"
        title="Reroll summary"
        aria-label="Reroll summary"
        tabindex="-1"
        disabled={isOrphan()}
        onclick={async () => await toggleReroll()}
      >
        <RefreshCw class="hypa-summary-icon" />
      </button>

      <!-- Delete This Button -->
      <button
        type="button"
        class="hypa-summary-icon-button hypa-summary-danger-hover icon-btn icon-btn--sm"
        title="Delete summary"
        aria-label="Delete summary"
        tabindex="-1"
        onclick={async () => await deleteThis()}
      >
        <Trash2Icon class="hypa-summary-icon" />
      </button>

      <!-- Delete After Button -->
      <button
        type="button"
        class="hypa-summary-icon-button hypa-summary-danger-hover icon-btn icon-btn--sm"
        title="Delete summaries after this"
        aria-label="Delete summaries after this"
        tabindex="-1"
        onclick={async () => await deleteAfter()}
      >
        <ScissorsLineDashed class="hypa-summary-icon" />
      </button>
    </div>
  </div>

  <!-- Original Summary -->
  <div class="hypa-summary-section">
    <textarea
      class="hypa-summary-textarea hypa-summary-textarea-focus control-field"
      bind:this={summaryItemState.originalRef}
      bind:value={summary.text}
      onfocus={() => {
        if (searchState && !searchState.isNavigating) {
          searchState.requestedSearchFromIndex = summaryIndex;
        }
      }}
    >
    </textarea>
  </div>

  <!-- Original Summary Translation -->
  {#if translation}
    <div class="hypa-summary-section">
      <div class="hypa-summary-subtitle">
        {language.hypaV3Modal.translationLabel}
      </div>

      <textarea
        class="hypa-summary-textarea control-field"
        readonly
        tabindex="-1"
        bind:this={summaryItemState.translationRef}
        value={translation}
      ></textarea>
    </div>
  {/if}

  {#if rerolled}
    <!-- Rerolled Summary Header -->
    <div class="hypa-summary-section">
      <div class="hypa-summary-row-between">
        <span class="hypa-summary-label"
          >{language.hypaV3Modal.rerolledSummaryLabel}</span
        >
        <div class="hypa-summary-row-inline action-rail">
          <!-- Translate Rerolled Button -->
          <button
            type="button"
            class="hypa-summary-icon-button icon-btn icon-btn--sm"
            title="Translate rerolled summary"
            aria-label="Translate rerolled summary"
            tabindex="-1"
            use:handleDualAction={{
              onMainAction: () => toggleTranslateRerolled(false),
              onAlternativeAction: () => toggleTranslateRerolled(true),
            }}
          >
            <LanguagesIcon class="hypa-summary-icon" />
          </button>

          <!-- Cancel Button -->
          <button
            type="button"
            class="hypa-summary-icon-button icon-btn icon-btn--sm"
            title="Cancel rerolled summary"
            aria-label="Cancel rerolled summary"
            tabindex="-1"
            onclick={cancelRerolled}
          >
            <XIcon class="hypa-summary-icon" />
          </button>

          <!-- Apply Button -->
          <button
            type="button"
            class="hypa-summary-icon-button hypa-summary-accent-hover icon-btn icon-btn--sm"
            title="Apply rerolled summary"
            aria-label="Apply rerolled summary"
            tabindex="-1"
            onclick={applyRerolled}
          >
            <CheckIcon class="hypa-summary-icon" />
          </button>
        </div>
      </div>
    </div>

    <!-- Rerolled Summary -->
    <div class="hypa-summary-section">
      <textarea
        class="hypa-summary-textarea hypa-summary-textarea-focus control-field"
        tabindex="-1"
        bind:value={rerolled}
      >
      </textarea>
    </div>

    <!-- Rerolled Summary Translation -->
    {#if rerolledTranslation}
      <div class="hypa-summary-section">
        <div class="hypa-summary-subtitle">
          {language.hypaV3Modal.rerolledTranslationLabel}
        </div>

        <textarea
          class="hypa-summary-textarea control-field"
          readonly
          tabindex="-1"
          bind:this={summaryItemState.rerolledTranslationRef}
          value={rerolledTranslation}
        ></textarea>
      </div>
    {/if}
  {/if}

  <!-- Connected Messages Header -->
  <div class="hypa-summary-section">
    <div class="hypa-summary-row-between">
      <button
        type="button"
        class="hypa-summary-toggle-button control-chip"
        tabindex="-1"
        onclick={toggleSummaryCollapse}
      >
        {#if isCollapsed()}
          <ChevronDownIcon class="hypa-summary-icon" />
        {:else}
          <ChevronUpIcon class="hypa-summary-icon" />
        {/if}
        <span>{language.hypaV3Modal.connectedMessageCountLabel.replace(
          "{0}",
          summary.chatMemos.length.toString()
        )}</span>
      </button>

      <div class="hypa-summary-row-inline action-rail">
        <!-- Translate Message Button -->
        <button
          type="button"
          class="hypa-summary-icon-button icon-btn icon-btn--sm"
          title="Translate connected message"
          aria-label="Translate connected message"
          tabindex="-1"
          use:handleDualAction={{
            onMainAction: () => toggleTranslateExpandedMessage(false),
            onAlternativeAction: () => toggleTranslateExpandedMessage(true),
          }}
        >
          <LanguagesIcon class="hypa-summary-icon" />
        </button>
      </div>
    </div>
  </div>

  {#if !isCollapsed()}
    <!-- Connected Message IDs -->
    <div class="hypa-summary-chatmemo-wrap">
      {#key summary.chatMemos.length}
        {#each summary.chatMemos as chatMemo, memoIndex (chatMemo)}
          <button
            type="button"
            class="hypa-summary-chatmemo-button control-chip"
            class:hypa-summary-chatmemo-button-active={isMessageExpanded(chatMemo)}
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
      <div class="hypa-summary-section">
        {#await getMessageFromChatMemo(expandedMessageState.selectedChatMemo) then expandedMessage}
          {#if expandedMessage}
            <!-- Role -->
            <div class="hypa-summary-subtitle">
              {language.hypaV3Modal.connectedMessageRoleLabel.replace(
                "{0}",
                expandedMessage.role
              )}
            </div>

            <!-- Content -->
            <textarea
              class="hypa-summary-textarea control-field"
              readonly
              tabindex="-1"
              value={expandedMessage.data}
            ></textarea>
          {:else}
            <span class="hypa-summary-error-text"
              >{language.hypaV3Modal.connectedMessageNotFoundLabel}</span
            >
          {/if}
        {:catch error}
          <span class="hypa-summary-error-text"
            >{language.hypaV3Modal.connectedMessageLoadingError.replace(
              "{0}",
              error.message
            )}</span
          >
        {/await}
      </div>

      <!-- Expanded Message Translation -->
      {#if expandedMessageState.translation}
        <div class="hypa-summary-section">
          <div class="hypa-summary-subtitle">
            {language.hypaV3Modal.connectedMessageTranslationLabel}
          </div>

          <textarea
            class="hypa-summary-textarea control-field"
            readonly
            tabindex="-1"
            bind:this={expandedMessageState.translationRef}
            value={expandedMessageState.translation}
          ></textarea>
        </div>
      {/if}
    {/if}
  {/if}

</div>

<style>
  .hypa-summary-root.panel-shell {
    display: flex;
    flex-direction: column;
    padding: var(--ds-space-2);
    border: 1px solid var(--ds-border-subtle);
    border-radius: var(--ds-radius-lg);
    background: color-mix(in srgb, var(--ds-surface-2) 80%, transparent);
  }

  .hypa-summary-root-selected {
    border-color: var(--ds-border-strong);
  }

  .hypa-summary-row-between {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .hypa-summary-row-inline {
    display: flex;
    align-items: center;
    gap: var(--ds-space-2);
  }

  .hypa-summary-label {
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
  }

  .hypa-summary-chip.control-chip {
    display: inline-flex;
    align-items: center;
    padding: var(--ds-space-1) var(--ds-space-2);
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-3);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-xs);
  }

  :global(.hypa-summary-icon-xs-inline) {
    width: 0.75rem;
    height: 0.75rem;
    display: inline-block;
    margin-right: var(--ds-space-1);
  }

  .hypa-summary-tag-button.control-chip {
    padding: var(--ds-space-1) var(--ds-space-2);
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-active);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-xs);
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-summary-chip-button.control-chip {
    padding: var(--ds-space-1) var(--ds-space-2);
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-3);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-xs);
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
      color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-summary-chip-button.control-chip:hover {
    background: var(--ds-surface-active);
    color: var(--ds-text-primary);
  }

  .hypa-summary-chip-wrap-tight {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ds-space-1);
  }

  .hypa-summary-metric-chip.control-chip {
    padding: 2px 6px;
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-3);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-xs);
    white-space: nowrap;
  }

  .hypa-summary-checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: var(--ds-radius-sm);
    border: 1px solid var(--ds-border-subtle);
    background: var(--ds-surface-1);
    color: var(--ds-border-strong);
    accent-color: var(--ds-border-strong);
    outline: none;
  }

  .hypa-summary-checkbox:focus {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-border-strong) 45%, transparent);
  }

  .hypa-summary-icon-button.icon-btn.icon-btn--sm {
    padding: var(--ds-space-2);
    color: var(--ds-text-secondary);
    transition: color var(--ds-motion-fast) var(--ds-ease-standard),
      background-color var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-summary-icon-button.icon-btn.icon-btn--sm:hover {
    color: var(--ds-text-primary);
  }

  .hypa-summary-icon-button-important.icon-btn.icon-btn--sm {
    color: var(--ds-text-primary);
    background: var(--ds-surface-active);
    border-radius: var(--ds-radius-sm);
  }

  :global(.hypa-summary-icon) {
    width: 1rem;
    height: 1rem;
  }

  .hypa-summary-section {
    margin-top: var(--ds-space-2);
  }

  .hypa-summary-textarea.control-field {
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

  .hypa-summary-textarea-focus.control-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--ds-border-strong) 45%, transparent);
  }

  .hypa-summary-subtitle {
    margin-bottom: var(--ds-space-2);
    color: var(--ds-text-secondary);
    font-size: var(--ds-font-size-sm);
  }

  .hypa-summary-toggle-button.control-chip {
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

  .hypa-summary-toggle-button.control-chip:hover {
    color: var(--ds-text-primary);
    background: color-mix(in srgb, var(--ds-surface-active) 80%, transparent);
  }

  .hypa-summary-chatmemo-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ds-space-2);
    margin-top: var(--ds-space-2);
  }

  .hypa-summary-chatmemo-button.control-chip {
    padding: var(--ds-space-2) var(--ds-space-3);
    border-radius: var(--ds-radius-pill);
    background: var(--ds-surface-3);
    color: var(--ds-text-primary);
    font-size: var(--ds-font-size-xs);
    transition: background-color var(--ds-motion-fast) var(--ds-ease-standard),
      box-shadow var(--ds-motion-fast) var(--ds-ease-standard);
  }

  .hypa-summary-chatmemo-button.control-chip:hover {
    background: var(--ds-surface-active);
  }

  .hypa-summary-chatmemo-button.hypa-summary-chatmemo-button-active.control-chip {
    box-shadow: 0 0 0 2px var(--ds-border-strong);
  }

  .hypa-summary-danger-hover:hover {
    color: var(--ds-text-danger);
  }

  .hypa-summary-accent-hover:hover {
    color: var(--ds-border-strong);
  }

  .hypa-summary-error-text {
    color: var(--ds-text-danger);
    font-size: var(--ds-font-size-sm);
  }

  @media (min-width: 640px) {
    .hypa-summary-root.panel-shell {
      padding: var(--ds-space-4);
    }

    .hypa-summary-section {
      margin-top: var(--ds-space-4);
    }

    .hypa-summary-subtitle {
      margin-bottom: var(--ds-space-4);
    }

    .hypa-summary-textarea.control-field {
      min-height: 14rem;
      padding: var(--ds-space-4);
    }
  }
</style>
