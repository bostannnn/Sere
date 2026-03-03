<script lang="ts">
  import { untrack } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { ChevronUpIcon, ChevronDownIcon } from "@lucide/svelte";
  import { 
    type SerializableHypaV3Data,
    type SerializableSummary, 
  } from "src/ts/process/memory/hypav3";
  import { alertNormalWait, alertToast } from "src/ts/alert";
  import { DBState, selectedCharID, hypaV3ModalOpen } from "src/ts/stores.svelte";
  import { language } from "src/lang";
  import { translateHTML } from "src/ts/translator/translator";
  import { globalFetch } from "src/ts/globalApi.svelte";
  import { alertConfirmTwice } from "./HypaV3Modal/utils";
  import ModalHeader from "./HypaV3Modal/modal-header.svelte";
  import ModalSummaryItem from "./HypaV3Modal/modal-summary-item.svelte";
  import ModalFooter from "./HypaV3Modal/modal-footer.svelte";
  import CategoryManagerModal from "./HypaV3Modal/category-manager-modal.svelte";
  import TagManagerModal from "./HypaV3Modal/tag-manager-modal.svelte";
  import BulkEditActions from "./HypaV3Modal/bulk-edit-actions.svelte";
  import BulkResummaryResult from "./HypaV3Modal/bulk-resummary-result.svelte";
  
  import type {
    SummaryItemState,
    ExpandedMessageState,
    SearchState,
    SearchResult,
    BulkResummaryState,
    CategoryManagerState,
    TagManagerState,
    BulkEditState,
    FilterState,
    UIState,
  } from "./HypaV3Modal/types";
  
  import {
    shouldShowSummary,
    isGuidLike,
    parseSelectionInput,
  } from "./HypaV3Modal/utils";
  import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
  import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
  const hypaV3ModalLog = (..._args: unknown[]) => {};

  let modalChatIndex = $state(0);
  let wasOpen = $state(false);
  const currentChar = $derived(DBState.db.characters?.[$selectedCharID] ?? null);
  const chatList = $derived(currentChar?.chats ?? []);

  const emptyHypaV3Data: SerializableHypaV3Data = {
    summaries: [],
    categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
    lastSelectedSummaries: [],
  };

  let hypaV3Data = $state<SerializableHypaV3Data>(emptyHypaV3Data);

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

  const summaryItemStateMap = new WeakMap<SerializableSummary, SummaryItemState>();
  let expandedMessageState = $state<ExpandedMessageState | null>(null);
  let searchState = $state<SearchState | null>(null);
  let filterSelected = $state(false);
  let bulkResummaryState = $state<BulkResummaryState | null>(null);

  let categoryManagerState = $state<CategoryManagerState>({
    isOpen: false,
    editingCategory: null,
    selectedCategoryFilter: "all",
  });

  let tagManagerState = $state<TagManagerState>({
    isOpen: false,
    currentSummaryIndex: -1,
    editingTag: "",
    editingTagIndex: -1,
  });

  const bulkEditState = $state<BulkEditState>({
    isEnabled: false,
    selectedSummaries: new Set(),
    selectedCategory: "",
    bulkSelectInput: "",
  });

  const filterState = $state<FilterState>({
    showImportantOnly: false,
    selectedCategoryFilter: "all",
    isManualImportantToggle: false,
  });

  const uiState = $state<UIState>({
    collapsedSummaries: new Set(),
    dropdownOpen: false,
  });

  let manualStart = $state('');
  let manualEnd = $state('');
  let manualProcessing = $state(false);
  const manualRangeStartInputId = "hypav3-manual-range-start";
  const manualRangeEndInputId = "hypav3-manual-range-end";
  const hypaV3Debug = $derived(DBState.db.hypaV3Debug);
  const hypaV3Settings = $derived(DBState.db.hypaV3Presets?.[DBState.db.hypaV3PresetId]?.settings);
  const hypaRuntimeDebug = $derived({
    memoryToggle: currentChar?.supaMemory,
    hypaV3Enabled: DBState.db.hypaV3,
    hypaV2Enabled: DBState.db.hypav2,
    hanuraiEnabled: DBState.db.hanuraiEnable,
    supaModelType: DBState.db.supaModelType,
    memoryAlgorithmType: DBState.db.memoryAlgorithmType,
  });

  $effect.pre(() => {
    void hypaV3Data?.summaries?.length;
    void filterSelected;

    untrack(() => {
      const chat = chatList[modalChatIndex];
      if (!chat) {
        hypaV3Data = emptyHypaV3Data;
        return;
      }

      chat.hypaV3Data ??= {
        summaries: [],
        categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
        lastSelectedSummaries: [],
      };
      chat.hypaV3Data.categories ??= [{ id: "", name: language.hypaV3Modal.unclassified }];
      chat.hypaV3Data.lastSelectedSummaries ??= [];

      hypaV3Data = chat.hypaV3Data;

      expandedMessageState = null;
      searchState = null;
      
      uiState.collapsedSummaries = new Set(hypaV3Data.summaries.map((_, index) => index));
    });
  });

  $effect(() => {
    const chat = chatList[modalChatIndex];
    if (!chat) {
      hypaV3Data = emptyHypaV3Data;
      return;
    }

    chat.hypaV3Data ??= {
      summaries: [],
      categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
      lastSelectedSummaries: [],
    };
    chat.hypaV3Data.categories ??= [{ id: "", name: language.hypaV3Modal.unclassified }];
    chat.hypaV3Data.lastSelectedSummaries ??= [];

    hypaV3Data = chat.hypaV3Data;
  });

  function persistHypaV3Data() {
    const targetChat = chatList[modalChatIndex];
    if (!targetChat) return;
    const targetCharacter = DBState.db.characters?.[$selectedCharID];
    if (!targetCharacter) return;
    targetChat.hypaV3Data = hypaV3Data;
    targetCharacter.chats[modalChatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
  }

  $effect(() => {
    if ($hypaV3ModalOpen && !wasOpen) {
      modalChatIndex = currentChar?.chatPage ?? 0;
    }
    wasOpen = $hypaV3ModalOpen;

    if (!$hypaV3ModalOpen) {
      modalChatIndex = currentChar?.chatPage ?? 0;
    }

    if (chatList.length > 0 && modalChatIndex >= chatList.length) {
      modalChatIndex = chatList.length - 1;
    }

    if ($hypaV3ModalOpen) {
      const currentImportantCount = untrack(() => hypaV3Data.summaries.filter(s => s.isImportant).length);

      if (currentImportantCount > 0) {
        categoryManagerState.selectedCategoryFilter = "all";
        filterState.selectedCategoryFilter = "all";
        filterState.showImportantOnly = true;
      } else {
        categoryManagerState.selectedCategoryFilter = "";
        filterState.selectedCategoryFilter = "";
        filterState.showImportantOnly = false;
      }

      filterState.isManualImportantToggle = false;
    }
  });

  function handleToggleSummarySelection(summaryIndex: number) {
    const newSelection = new SvelteSet(bulkEditState.selectedSummaries);
    if (newSelection.has(summaryIndex)) {
      newSelection.delete(summaryIndex);
    } else {
      newSelection.add(summaryIndex);
    }
    bulkEditState.selectedSummaries = newSelection;
  }

  function handleOpenTagManager(summaryIndex: number) {
    tagManagerState.currentSummaryIndex = summaryIndex;
    tagManagerState.isOpen = true;
  }

  async function callHypaV3Server(path: string, body: Record<string, unknown>) {
    const response = await globalFetch(path, {
      method: "POST",
      body,
    });
    if (!response.ok) {
      const payload = response.data as { message?: string; error?: string } | undefined;
      const message = payload?.message || payload?.error || String(response.data || "Request failed");
      throw new Error(message);
    }
    return (response.data ?? {}) as Record<string, unknown>;
  }

  function syncHypaV3DataFromServer(data: SerializableHypaV3Data) {
    const targetChat = chatList[modalChatIndex];
    if (!targetChat) return;
    const targetCharacter = DBState.db.characters?.[$selectedCharID];
    if (!targetCharacter) return;
    hypaV3Data = data;
    targetChat.hypaV3Data = data;
    targetCharacter.chats[modalChatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
  }

  async function manualSummarizeRange() {
    if (manualProcessing) return;
    const characterId = currentChar?.chaId;
    const chat = chatList[modalChatIndex];
    if (!chat || !characterId || !chat.id) return;
    const messages = (chat.message ?? []).filter((m) => m && !m.disabled);
    const maxCount = messages.length;
    if (maxCount === 0) {
        alertToast('No messages to summarize.');
        return;
    }

    const startNum = Math.max(1, Number(manualStart || 1));
    const endNum = Math.min(maxCount, Number(manualEnd || maxCount));
    if (!Number.isFinite(startNum) || !Number.isFinite(endNum) || startNum > endNum) {
      alertToast('Invalid range. Use Start ≤ End.');
      return;
    }

    try {
      manualProcessing = true;
      const result = await callHypaV3Server('/data/memory/hypav3/manual-summarize', {
        characterId,
        chatId: chat.id,
        start: startNum,
        end: endNum,
      });
      if (result?.hypaV3Data) {
        syncHypaV3DataFromServer(result.hypaV3Data as SerializableHypaV3Data);
      }
      uiState.collapsedSummaries = new Set(hypaV3Data.summaries.map((_, index) => index));
      alertToast('Summary added.');
    } catch (error) {
      hypaV3ModalLog('Manual summarize failed:', error);
      alertToast(`Manual summarize failed: ${error.message || error}`);
    }
    manualProcessing = false;
  }

  // Search functionality
  function onSearch(e: KeyboardEvent) {
    if (e.key === "Enter") {
      if (!searchState || !searchState.query.trim()) return;

      // Perform search
      performSearch(searchState.query, e.shiftKey);
    }
  }

  function performSearch(query: string, backward: boolean = false) {
    if (!searchState) return;

    // Reset results if query changed
    if (searchState.results.length === 0) {
      searchState.results = findAllMatches(query);
      searchState.currentResultIndex = -1;
    }

    // Navigate to next/previous result
    const result = getNextSearchResult(backward);
    if (result) {
      navigateToSearchResult(result);
    }
  }

  function findAllMatches(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    hypaV3Data.summaries.forEach((summary, summaryIndex) => {
      // Search in summary text
      const summaryText = summary.text.toLowerCase();
      let index = 0;
      while ((index = summaryText.indexOf(lowerQuery, index)) !== -1) {
        results.push({
          type: "summary",
          summaryIndex,
          start: index,
          end: index + query.length,
        });
        index += query.length;
      }

      // Search in chat memos (if they're GUIDs)
      if (isGuidLike(query)) {
        summary.chatMemos.forEach((chatMemo, memoIndex) => {
          if (chatMemo && chatMemo.toLowerCase().includes(lowerQuery)) {
            results.push({
              type: "chatmemo",
              summaryIndex,
              memoIndex,
            });
          }
        });
      }
    });

    return results;
  }

  async function resummarizeBulkSelected() {
    if (bulkEditState.selectedSummaries.size < 2) return;
    const characterId = currentChar?.chaId;
    const chat = chatList[modalChatIndex];
    if (!characterId || !chat?.id) return;

    const sortedIndices = Array.from(bulkEditState.selectedSummaries).sort((a, b) => a - b);

    try {
      bulkResummaryState = {
        isProcessing: true,
        result: null,
        selectedIndices: sortedIndices,
        mergedChatMemos: [],
        isTranslating: false,
        translation: null
      };

      const preview = await callHypaV3Server('/data/memory/hypav3/resummarize-preview', {
        characterId,
        chatId: chat.id,
        summaryIndices: sortedIndices,
      });

      bulkResummaryState = {
        isProcessing: false,
        result: String(preview?.summary || ''),
        selectedIndices: Array.isArray(preview?.selectedIndices) ? preview.selectedIndices : sortedIndices,
        mergedChatMemos: Array.isArray(preview?.mergedChatMemos) ? preview.mergedChatMemos : [],
        isTranslating: false,
        translation: null
      };

    } catch (error) {
      hypaV3ModalLog('Re-summarize Failed:', error);
      bulkResummaryState = null;
      await alertNormalWait(`Re-summarize Failed: ${error.message || error}`);
    }
  }

  async function applyBulkResummary() {
    if (!bulkResummaryState || !bulkResummaryState.result) return;
    const characterId = currentChar?.chaId;
    const chat = chatList[modalChatIndex];
    if (!characterId || !chat?.id) return;

    try {
      const applied = await callHypaV3Server('/data/memory/hypav3/resummarize-apply', {
        characterId,
        chatId: chat.id,
        summaryIndices: bulkResummaryState.selectedIndices,
        summary: bulkResummaryState.result,
        mergedChatMemos: bulkResummaryState.mergedChatMemos,
      });
      if (applied?.hypaV3Data) {
        syncHypaV3DataFromServer(applied.hypaV3Data as SerializableHypaV3Data);
      }
      uiState.collapsedSummaries = new Set(hypaV3Data.summaries.map((_, index) => index));
      bulkResummaryState = null;
      bulkEditState.selectedSummaries = new Set();
    } catch (error) {
      hypaV3ModalLog('Apply re-summarize failed:', error);
      await alertNormalWait(`Apply re-summarize Failed: ${error.message || error}`);
    }
  }

  async function rerollBulkResummary() {
    if (!bulkResummaryState) return;
    const characterId = currentChar?.chaId;
    const chat = chatList[modalChatIndex];
    if (!characterId || !chat?.id) return;
    
    const sortedIndices = bulkResummaryState.selectedIndices;
    
    try {
      bulkResummaryState = {
        ...bulkResummaryState,
        isProcessing: true,
        result: null,
        isTranslating: false,
        translation: null
      };

      const preview = await callHypaV3Server('/data/memory/hypav3/resummarize-preview', {
        characterId,
        chatId: chat.id,
        summaryIndices: sortedIndices,
      });
      
      bulkResummaryState = {
        ...bulkResummaryState,
        isProcessing: false,
        result: String(preview?.summary || ''),
        selectedIndices: Array.isArray(preview?.selectedIndices) ? preview.selectedIndices : sortedIndices,
        mergedChatMemos: Array.isArray(preview?.mergedChatMemos) ? preview.mergedChatMemos : bulkResummaryState.mergedChatMemos,
        isTranslating: false,
        translation: null
      };
      
    } catch (error) {
      hypaV3ModalLog('Re-summarize Retry Failed:', error);
      bulkResummaryState = null;
      await alertNormalWait(`Re-summarize Retry Failed: ${error.message || error}`);
    }
  }

  function cancelBulkResummary() {
    bulkResummaryState = null;
    bulkEditState.selectedSummaries = new Set();
  }

  async function toggleBulkResummaryTranslation(regenerate: boolean = false) {
    if (!bulkResummaryState || !bulkResummaryState.result) return;
    
    if (bulkResummaryState.isTranslating) return;

    if (bulkResummaryState.translation) {
      bulkResummaryState.translation = null;
      return;
    }

    bulkResummaryState.isTranslating = true;
    bulkResummaryState.translation = "Loading...";

    try {
      const result = await translateHTML(bulkResummaryState.result, false, "", -1, regenerate);
      
      bulkResummaryState.translation = result;
    } catch (error) {
      bulkResummaryState.translation = `Translation failed: ${error}`;
    } finally {
      bulkResummaryState.isTranslating = false;
    }
  }

  async function handleResetData() {
    if (
      await alertConfirmTwice(
        language.hypaV3Modal.resetConfirmMessage,
        language.hypaV3Modal.resetConfirmSecondMessage
      )
    ) {
      const targetCharacter = DBState.db.characters?.[$selectedCharID];
      if (!targetCharacter) return;
      const targetChat = targetCharacter.chats?.[targetCharacter.chatPage];
      if (!targetChat) return;
      targetChat.hypaV3Data = {
        summaries: [],
      };
    }
  }

  function handleToggleBulkEditMode() {
    bulkEditState.isEnabled = !bulkEditState.isEnabled;
    if (!bulkEditState.isEnabled) {
      bulkEditState.selectedSummaries = new Set();
    }
  }

  function handleBulkEditClearSelection() {
    bulkEditState.selectedSummaries = new Set();
  }

  function handleBulkEditUpdateSelectedCategory(categoryId: string) {
    bulkEditState.selectedCategory = categoryId;
  }

  function handleBulkEditUpdateBulkSelectInput(input: string) {
    bulkEditState.bulkSelectInput = input;
  }

  function handleBulkEditApplyCategory() {
    if (bulkEditState.selectedSummaries.size === 0) return;

    for (const summaryIndex of bulkEditState.selectedSummaries) {
      hypaV3Data.summaries[summaryIndex].categoryId = bulkEditState.selectedCategory || undefined;
    }

    handleBulkEditClearSelection();
  }

  function handleBulkEditToggleImportant() {
    if (bulkEditState.selectedSummaries.size === 0) return;
    const selectedIndices = Array.from(bulkEditState.selectedSummaries);
    const hasNonImportant = selectedIndices.some(index => !hypaV3Data.summaries[index].isImportant);

    selectedIndices.forEach(index => {
      const summary = hypaV3Data.summaries[index];
      if (hasNonImportant) {
        summary.isImportant = true;
      } else {
        summary.isImportant = false;
      }
    });
    handleBulkEditClearSelection();
  }

  function handleBulkEditParseAndSelectSummaries() {
    if (!bulkEditState.bulkSelectInput.trim()) return;
    
    const newSelection = parseSelectionInput(bulkEditState.bulkSelectInput, hypaV3Data.summaries.length);
    const filteredSelection = new SvelteSet<number>();
    
    for (const index of newSelection) {
      if (shouldShowSummary(hypaV3Data.summaries[index], index, filterState.showImportantOnly, filterState.selectedCategoryFilter)) {
        filteredSelection.add(index);
      }
    }

    bulkEditState.selectedSummaries = filteredSelection;
    bulkEditState.bulkSelectInput = "";
  }

  function handleOpenCategoryManager() {
    categoryManagerState.isOpen = true;
  }

  function handleDeleteSummary(summaryIndex: number) {
    hypaV3Data.summaries.splice(summaryIndex, 1);
    uiState.collapsedSummaries = new Set(hypaV3Data.summaries.map((_, index) => index));
    persistHypaV3Data();
  }

  function handleDeleteAfter(summaryIndex: number) {
    if (summaryIndex + 1 < hypaV3Data.summaries.length) {
      hypaV3Data.summaries.splice(summaryIndex + 1);
    }
    uiState.collapsedSummaries = new Set(hypaV3Data.summaries.map((_, index) => index));
    persistHypaV3Data();
  }

  function handleCategoryFilter(categoryId: string) {
    filterState.selectedCategoryFilter = categoryId;
  }

  function handleToggleCollapse(summaryIndex: number) {
    const newCollapsed = new SvelteSet(uiState.collapsedSummaries);
    if (newCollapsed.has(summaryIndex)) {
      newCollapsed.delete(summaryIndex);
    } else {
      newCollapsed.add(summaryIndex);
    }
    uiState.collapsedSummaries = newCollapsed;
  }

  function getNextSearchResult(backward: boolean): SearchResult | null {
    if (!searchState || searchState.results.length === 0) return null;

    let nextIndex: number;

    if (searchState.requestedSearchFromIndex !== -1) {
      const fromSummaryIndex = searchState.requestedSearchFromIndex;

      nextIndex = backward
        ? searchState.results.findLastIndex(
            (r) => r.summaryIndex <= fromSummaryIndex
          )
        : searchState.results.findIndex(
            (r) => r.summaryIndex >= fromSummaryIndex
          );

      if (nextIndex === -1) {
        nextIndex = backward ? searchState.results.length - 1 : 0;
      }

      searchState.requestedSearchFromIndex = -1;
    } else {
      const delta = backward ? -1 : 1;

      nextIndex =
        (searchState.currentResultIndex + delta + searchState.results.length) %
        searchState.results.length;
    }

    searchState.currentResultIndex = nextIndex;
    return searchState.results[nextIndex];
  }

  function navigateToSearchResult(result: SearchResult) {
    if (!searchState) return;
    searchState.isNavigating = true;

    if (result.type === "summary") {
      const summary = hypaV3Data.summaries[result.summaryIndex];
      const summaryItemState = summaryItemStateMap.get(summary);
      const textarea = summaryItemState?.originalRef;
      if (!textarea) {
        searchState.isNavigating = false;
        return;
      }

      // Scroll to element
      textarea.scrollIntoView({
        behavior: "instant",
        block: "center",
      });

      if (result.start === result.end) {
        searchState.isNavigating = false;
        return;
      }

      // Scroll to query
      textarea.setSelectionRange(result.start, result.end);
      scrollToSelection(textarea);

      // Highlight query on desktop environment
      if (!("ontouchend" in window)) {
        // Make readonly temporarily
        textarea.readOnly = true;
        textarea.focus();
        window.setTimeout(() => {
          searchState?.ref?.focus(); // Restore focus to search bar
          textarea.readOnly = false; // Remove readonly after focus moved
        }, 300);
      }
    } else {
      const summary = hypaV3Data.summaries[result.summaryIndex];
      const summaryItemState = summaryItemStateMap.get(summary);
      const button = summaryItemState?.chatMemoRefs[result.memoIndex];
      if (!button) {
        searchState.isNavigating = false;
        return;
      }

      // Scroll to element
      button.scrollIntoView({
        behavior: "instant",
        block: "center",
      });

      // Highlight chatMemo
      button.classList.add("ring-2", "ring-zinc-500");

      // Remove highlight after a short delay
      window.setTimeout(() => {
        button.classList.remove("ring-2", "ring-zinc-500");
      }, 1000);
    }

    searchState.isNavigating = false;
  }

  function scrollToSelection(textarea: HTMLTextAreaElement) {
    const { selectionStart, selectionEnd } = textarea;

    if (
      selectionStart === null ||
      selectionEnd === null ||
      selectionStart === selectionEnd
    ) {
      return; // Exit if there is no selected text
    }

    // Calculate the text before the selected position based on the textarea's text
    const textBeforeSelection = textarea.value.substring(0, selectionStart);

    // Use a temporary DOM element to calculate the exact position of the selected text
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.whiteSpace = "pre-wrap";
    tempDiv.style.overflowWrap = "break-word";
    tempDiv.style.font = window.getComputedStyle(textarea).font;
    tempDiv.style.width = `${textarea.offsetWidth}px`;
    tempDiv.style.visibility = "hidden"; // Set it to be invisible

    tempDiv.textContent = textBeforeSelection;
    document.body.appendChild(tempDiv);

    // Calculate the position of the selected text within the textarea
    const selectionTop = tempDiv.offsetHeight;
    document.body.removeChild(tempDiv);

    // Adjust the scroll so that the selected text is centered on the screen
    textarea.scrollTop = selectionTop - textarea.clientHeight / 2;
  }

  function isSummaryVisible(index: number): boolean {
    const summary = hypaV3Data.summaries[index];
    
    // Use the new shouldShowSummary utility function
    return shouldShowSummary(
      summary, 
      index, 
      filterState.showImportantOnly, 
      filterState.selectedCategoryFilter
    ) && (
      !filterSelected ||
      !hypaV3Data.metrics ||
      hypaV3Data.metrics.lastImportantSummaries.includes(index) ||
      hypaV3Data.metrics.lastRecentSummaries.includes(index) ||
      hypaV3Data.metrics.lastSimilarSummaries.includes(index) ||
      hypaV3Data.metrics.lastRandomSummaries.includes(index)
    );
  }

  function isHypaV2ConversionPossible(): boolean {
    const char = DBState.db.characters?.[$selectedCharID];
    if (!char) {
      return false;
    }
    const chat = char.chats[modalChatIndex];
    if (!chat) {
      return false;
    }

    return chat.hypaV3Data?.summaries?.length === 0 && chat.hypaV2Data != null;
  }

  function convertHypaV2ToV3(): { success: boolean; error?: string } {
    try {
      const char = DBState.db.characters?.[$selectedCharID];
      if (!char) {
        return {
          success: false,
          error: "Character not found.",
        };
      }
      const chat = char.chats[modalChatIndex];
      if (!chat) {
        return {
          success: false,
          error: "Chat not found.",
        };
      }
      const hypaV2Data = chat.hypaV2Data;

      if ((chat.hypaV3Data?.summaries?.length ?? 0) > 0) {
        return {
          success: false,
          error: "HypaV3 data already exists.",
        };
      }

      if (!hypaV2Data) {
        return {
          success: false,
          error: "HypaV2 data not found.",
        };
      }

      if (hypaV2Data.mainChunks.length === 0) {
        return {
          success: false,
          error: "No main chunks found.",
        };
      }

      for (let i = 0; i < hypaV2Data.mainChunks.length; i++) {
        const mainChunk = hypaV2Data.mainChunks[i];

        if (!Array.isArray(mainChunk.chatMemos)) {
          return {
            success: false,
            error: `Chunk ${i}'s chatMemos is not an array.`,
          };
        }

        if (mainChunk.chatMemos.length === 0) {
          return {
            success: false,
            error: `Chunk ${i}'s chatMemos is empty.`,
          };
        }
      }

      const newHypaV3Data: SerializableHypaV3Data = {
        summaries: hypaV2Data.mainChunks.map((mainChunk) => ({
          text: mainChunk.text,
          chatMemos: [...mainChunk.chatMemos],
          isImportant: false,
        })),
        categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
        lastSelectedSummaries: [],
      };

      chat.hypaV3Data = newHypaV3Data;

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: `Error occurred: ${error.message}`,
      };
    }
  }

</script>

<!-- Modal Backdrop -->
<div class="ds-hypa-modal-overlay">
  <!-- Modal Wrapper -->
  <div class="ds-hypa-modal-wrap">
    <!-- Modal Window -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="ds-hypa-modal-window"
      class:ds-hypa-modal-window-empty={hypaV3Data.summaries.length === 0}
      onclick={(e) => {
        e.stopPropagation();
        uiState.dropdownOpen = false;
      }}
    >
      <!-- Header -->
      <ModalHeader
        bind:searchState
        bind:filterImportant={filterState.showImportantOnly}
        bind:dropdownOpen={uiState.dropdownOpen}
        bind:filterSelected
        {bulkEditState}
        {categoryManagerState}
        {filterState}
        {uiState}
        {hypaV3Data}
        onResetData={handleResetData}
        onToggleBulkEditMode={handleToggleBulkEditMode}
        onOpenCategoryManager={handleOpenCategoryManager}
      />

      {#if chatList.length > 1}
        <div class="ds-hypa-modal-chat-row">
          <span class="ds-hypa-modal-chat-label">Chat</span>
          <SelectInput
            className="ds-hypa-modal-chat-select"
            value={modalChatIndex}
            onchange={(e) => {
              const nextIndex = parseInt(e.currentTarget.value);
              if (!Number.isNaN(nextIndex)) {
                modalChatIndex = nextIndex;
              }
            }}
          >
            {#each chatList as chat, i (chat.id ?? i)}
              <OptionInput value={i}>
                {chat.name && chat.name.trim().length > 0 ? chat.name : `Chat ${i + 1}`}
              </OptionInput>
            {/each}
          </SelectInput>
        </div>
      {/if}

      <!-- Scrollable Container -->
      <div class="ds-hypa-modal-scroll" tabindex="-1">
        {#if hypaV3Data.summaries.length === 0}
          <!-- Conversion Section -->
          {#if isHypaV2ConversionPossible()}
            <div
              class="ds-hypa-modal-convert-card panel-shell"
            >
              <div class="ds-hypa-modal-convert-center">
                <div class="ds-hypa-modal-convert-label">
                  {language.hypaV3Modal.convertLabel}
                </div>
                <button
                  type="button"
                  class="ds-hypa-modal-convert-button control-chip"
                  tabindex="-1"
                  onclick={async () => {
                    const conversionResult = convertHypaV2ToV3();

                    if (conversionResult.success) {
                      await alertNormalWait(
                        language.hypaV3Modal.convertSuccessMessage
                      );
                    } else {
                      await alertNormalWait(
                        language.hypaV3Modal.convertErrorMessage.replace(
                          "{0}",
                          conversionResult.error ?? "Unknown error"
                        )
                      );
                    }
                  }}
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

          <!-- Search Bar -->
        {:else if searchState}
          <div class="ds-hypa-modal-search-sticky">
            <div class="ds-hypa-modal-search-row">
              <div class="ds-hypa-modal-search-form-wrap">
                <form
                  class="ds-hypa-modal-search-form"
                  onsubmit={(e) => {
                    e.preventDefault();
                    onSearch({ key: "Enter" } as KeyboardEvent);
                  }}
                >
                  <input
                    class="ds-hypa-modal-search-input control-field"
                    placeholder={language.hypaV3Modal.searchPlaceholder}
                    bind:this={searchState.ref}
                    bind:value={searchState.query}
                    oninput={() => {
                      if (searchState) {
                        searchState.results = [];
                        searchState.currentResultIndex = -1;
                      }
                    }}
                    onkeydown={(e) => onSearch(e)}
                  />
                </form>

                {#if searchState.results.length > 0}
                  <span
                    class="ds-hypa-modal-search-counter"
                  >
                    {searchState.currentResultIndex + 1}/{searchState.results
                      .length}
                  </span>
                {/if}
              </div>

              <!-- Previous Button -->
              <button
                type="button"
                class="ds-hypa-modal-search-nav-button icon-btn icon-btn--sm"
                tabindex="-1"
                title="Previous search result"
                aria-label="Previous search result"
                onclick={() => {
                  onSearch({ shiftKey: true, key: "Enter" } as KeyboardEvent);
                }}
              >
                <ChevronUpIcon class="ds-hypa-modal-search-nav-icon" />
              </button>

              <!-- Next Button -->
              <button
                type="button"
                class="ds-hypa-modal-search-nav-button icon-btn icon-btn--sm"
                tabindex="-1"
                title="Next search result"
                aria-label="Next search result"
                onclick={() => {
                  onSearch({ key: "Enter" } as KeyboardEvent);
                }}
              >
                <ChevronDownIcon class="ds-hypa-modal-search-nav-icon" />
              </button>
            </div>
          </div>
        {/if}

        <!-- Manual Summarize -->
        <div class="ds-hypa-modal-manual-sticky">
          <div class="ds-hypa-modal-manual-row">
            <div class="ds-hypa-modal-manual-col">
              <label class="ds-hypa-modal-manual-label" for={manualRangeStartInputId}>Manual summarize range</label>
              <div class="ds-hypa-modal-manual-input-row">
                <input
                  id={manualRangeStartInputId}
                  class="ds-hypa-modal-manual-input control-field"
                  type="number"
                  min="1"
                  max={chatList[modalChatIndex]?.message?.length ?? 1}
                  placeholder="Start"
                  bind:value={manualStart}
                />
                <span class="ds-hypa-modal-manual-to">to</span>
                <input
                  id={manualRangeEndInputId}
                  class="ds-hypa-modal-manual-input control-field"
                  type="number"
                  min="1"
                  max={chatList[modalChatIndex]?.message?.length ?? 1}
                  placeholder="End"
                  bind:value={manualEnd}
                />
              </div>
            </div>
            <button
              type="button"
              class="ds-hypa-modal-manual-submit control-chip"
              disabled={manualProcessing}
              onclick={manualSummarizeRange}
            >
              {manualProcessing ? 'Summarizing...' : 'Summarize Range'}
            </button>
          </div>
        </div>

        {#if hypaV3Debug}
          <details class="ds-hypa-modal-debug">
            <summary class="ds-hypa-modal-debug-summary">
              Last summarize log
            </summary>
            <div class="ds-hypa-modal-debug-body">
              <div>Model: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.model}</span></div>
              <div>Mode: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.isResummarize ? 'Resummarize' : 'Summarize'}</span></div>
              <div>Time: <span class="ds-hypa-modal-debug-value">{new Date(hypaV3Debug.timestamp).toLocaleString()}</span></div>
              <div>Memory toggle: <span class="ds-hypa-modal-debug-value">{hypaRuntimeDebug.memoryToggle ? 'On' : 'Off'}</span></div>
              <div>HypaV3 enabled: <span class="ds-hypa-modal-debug-value">{hypaRuntimeDebug.hypaV3Enabled ? 'On' : 'Off'}</span></div>
              <div>HypaV2 enabled: <span class="ds-hypa-modal-debug-value">{hypaRuntimeDebug.hypaV2Enabled ? 'On' : 'Off'}</span></div>
              <div>Hanurai enabled: <span class="ds-hypa-modal-debug-value">{hypaRuntimeDebug.hanuraiEnabled ? 'On' : 'Off'}</span></div>
              <div>SupaModelType: <span class="ds-hypa-modal-debug-value">{hypaRuntimeDebug.supaModelType || 'none'}</span></div>
              <div>Memory algorithm: <span class="ds-hypa-modal-debug-value">{hypaRuntimeDebug.memoryAlgorithmType || 'n/a'}</span></div>
              {#if hypaV3Settings}
                <div>Periodic: <span class="ds-hypa-modal-debug-value">{hypaV3Settings.periodicSummarizationEnabled && hypaV3Settings.periodicSummarizationInterval > 0 ? 'On' : 'Off'}</span></div>
                <div>Interval: <span class="ds-hypa-modal-debug-value">{hypaV3Settings.periodicSummarizationInterval}</span></div>
                <div>Last index: <span class="ds-hypa-modal-debug-value">{hypaV3Data.lastSummarizedMessageIndex ?? 0}</span></div>
                <div>Chat messages: <span class="ds-hypa-modal-debug-value">{chatList[modalChatIndex]?.message?.length ?? 0}</span></div>
                {#if hypaV3Debug.periodic}
                  <div>Periodic total chats: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.periodic.totalChats}</span></div>
                  <div>Periodic new messages: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.periodic.newMessages}</span></div>
                  <div>Periodic to summarize: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.periodic.toSummarizeCount}</span></div>
                  {#if hypaV3Debug.periodic.skippedReason}
                    <div>Periodic skipped: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.periodic.skippedReason}</span></div>
                  {/if}
                  {#if hypaV3Debug.periodic.chatName}
                    <div>Periodic chat: <span class="ds-hypa-modal-debug-value">{hypaV3Debug.periodic.chatName}</span></div>
                  {/if}
                {/if}
              {/if}
              <div>
                <div class="ds-hypa-modal-debug-block-title">Prompt</div>
                <textarea
                  class="ds-hypa-modal-debug-textarea control-field"
                  rows="4"
                  readonly
                  value={hypaV3Debug.prompt}
                ></textarea>
              </div>
              <div>
                <div class="ds-hypa-modal-debug-block-title">Input</div>
                <textarea
                  class="ds-hypa-modal-debug-textarea control-field"
                  rows="4"
                  readonly
                  value={hypaV3Debug.input}
                ></textarea>
              </div>
              <div>
                <div class="ds-hypa-modal-debug-block-title">Formatted</div>
                <textarea
                  class="ds-hypa-modal-debug-textarea control-field"
                  rows="6"
                  readonly
                  value={JSON.stringify(hypaV3Debug.formatted, null, 2)}
                ></textarea>
              </div>
              {#if hypaV3Debug.rawResponse}
                <div>
                  <div class="ds-hypa-modal-debug-block-title">Raw Response</div>
                  <textarea
                    class="ds-hypa-modal-debug-textarea control-field"
                    rows="6"
                    readonly
                    value={hypaV3Debug.rawResponse}
                  ></textarea>
                </div>
              {/if}
            </div>
          </details>
        {/if}

        <!-- Summaries List -->
        {#each hypaV3Data.summaries as summary, i (summary)}
          {#if isSummaryVisible(i)}
            <!-- Summary Item  -->
            <ModalSummaryItem
              summaryIndex={i}
              chatIndex={modalChatIndex}
              {hypaV3Data}
              {summaryItemStateMap}
              bind:expandedMessageState
              bind:searchState
              {filterSelected}
              {categories}
              {bulkEditState}
              {uiState}
              onToggleSummarySelection={handleToggleSummarySelection}
              onOpenTagManager={handleOpenTagManager}
              onToggleCollapse={handleToggleCollapse}
              onDeleteSummary={handleDeleteSummary}
              onDeleteAfter={handleDeleteAfter}
            />
          {/if}
        {/each}

        <!-- Footer -->
        <ModalFooter {hypaV3Data} />
      </div>

      <!-- Bulk Resummary Result -->
      <BulkResummaryResult
        {bulkResummaryState}
        onToggleTranslation={toggleBulkResummaryTranslation}
        onReroll={rerollBulkResummary}
        onApply={applyBulkResummary}
        onCancel={cancelBulkResummary}
      />

      <!-- Bulk Edit Actions -->
      <BulkEditActions
        {bulkEditState}
        {categories}
        showImportantOnly={filterState.showImportantOnly}
        selectedCategoryFilter={filterState.selectedCategoryFilter}
        onResummarize={resummarizeBulkSelected}
        onClearSelection={handleBulkEditClearSelection}
        onUpdateSelectedCategory={handleBulkEditUpdateSelectedCategory}
        onUpdateBulkSelectInput={handleBulkEditUpdateBulkSelectInput}
        onApplyCategory={handleBulkEditApplyCategory}
        onToggleImportant={handleBulkEditToggleImportant}
        onParseAndSelectSummaries={handleBulkEditParseAndSelectSummaries}
      />
    </div>
  </div>
</div>

<!-- Component Modals -->
<CategoryManagerModal
  bind:categoryManagerState
  bind:searchState
  {filterState}
  onCategoryFilter={handleCategoryFilter}
/>

<TagManagerModal
  bind:tagManagerState
/>
