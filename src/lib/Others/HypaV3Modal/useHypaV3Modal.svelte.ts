import { SvelteSet } from "svelte/reactivity";
import { fromStore } from "svelte/store";
import { alertNormalWait } from "src/ts/alert";
import { language } from "src/lang";
import { DBState, hypaV3ModalOpen, selectedCharID } from "src/ts/stores.svelte";
import { pickLatestSummarizeDebug } from "src/ts/process/hypaSync";
import type {
  SerializableHypaV3Data,
  SerializableSummary,
} from "src/ts/process/memory/hypav3";
import { alertConfirmTwice } from "./utils";
import {
  convertHypaV2ToV3,
  createEmptyHypaV3Data,
  isHypaV2ConversionPossible,
  manualSummarizeRange,
  normalizePromptOverrideCharacter,
} from "./helpers";
import {
  applyBulkEditCategory,
  applyBulkResummary,
  parseAndSelectSummaries,
  rerollBulkResummary,
  resummarizeBulkSelected,
} from "./bulk";
import {
  findAllMatches,
  getNextSearchResult,
  isSummaryVisible,
  navigateToSearchResult,
} from "./search";
import type {
  BulkEditState,
  BulkResummaryState,
  ExpandedMessageState,
  ManualState,
  MemoryWorkspaceTab,
  SearchState,
  SummaryItemState,
  UIState,
} from "./types";

const hypaV3ModalLog = (..._args: unknown[]) => {};

export function useHypaV3Modal(getEmbedded: () => boolean) {
  let modalChatIndex = $state(0);
  let wasOpen = $state(false);
  let lastManualScopeKey = $state<string | null>(null);
  let hypaV3Data = $state<SerializableHypaV3Data>(
    createEmptyHypaV3Data(language.hypaV3Modal.unclassified),
  );
  let expandedMessageState = $state<ExpandedMessageState | null>(null);
  let searchState = $state<SearchState | null>(null);
  let filterSelected = $state(false);
  let bulkResummaryState = $state<BulkResummaryState | null>(null);
  let memoryWorkspaceTab = $state<MemoryWorkspaceTab>("summary");
  const selectedCharIndex = fromStore(selectedCharID);
  const hypaModalOpenState = fromStore(hypaV3ModalOpen);

  const currentChar = $derived(DBState.db.characters?.[selectedCharIndex.current] ?? null);
  const promptOverrideCharacter = $derived.by(() =>
    currentChar && currentChar.type === "character" ? currentChar : null,
  );
  const chatList = $derived(currentChar?.chats ?? []);
  const effectiveChatIndex = $derived.by(() => {
    const baseIndex = getEmbedded() ? (currentChar?.chatPage ?? 0) : modalChatIndex;
    if (chatList.length === 0) return 0;
    if (baseIndex < 0) return 0;
    if (baseIndex >= chatList.length) return chatList.length - 1;
    return baseIndex;
  });
  const activeChat = $derived(chatList[effectiveChatIndex]);
  const activeChatId = $derived(activeChat?.id ?? null);
  const isOpen = $derived(getEmbedded() || hypaModalOpenState.current);
  const categories = $derived.by(() => {
    const uncategorized = { id: "", name: language.hypaV3Modal.unclassified };
    const savedCategories = hypaV3Data.categories || [];
    return savedCategories.some((category) => category.id === "")
      ? [uncategorized, ...savedCategories.filter((category) => category.id !== "")]
      : [uncategorized, ...savedCategories];
  });
  const selectedMemoryWorkspaceTabId = $derived(
    memoryWorkspaceTab === "summary" ? 0 : memoryWorkspaceTab === "settings" ? 1 : 2,
  );
  const logDebug = $derived.by(() =>
    pickLatestSummarizeDebug(
      activeChat?.hypaV3Data?.lastPeriodicDebug ?? null,
      activeChat?.hypaV3Data?.lastManualDebug ?? null,
      DBState.db.hypaV3Debug &&
        currentChar?.chaId === DBState.db.hypaV3Debug.characterId &&
        activeChatId === DBState.db.hypaV3Debug.chatId
        ? DBState.db.hypaV3Debug
        : null,
    ),
  );

  const summaryItemStateMap = new WeakMap<SerializableSummary, SummaryItemState>();
  const bulkEditState = $state<BulkEditState>({
    isEnabled: false,
    selectedSummaries: new SvelteSet(),
    selectedCategory: "",
    bulkSelectInput: "",
  });
  const uiState = $state<UIState>({
    collapsedSummaries: new SvelteSet(),
    dropdownOpen: false,
  });
  const manualState = $state<ManualState>({
    start: "",
    end: "",
    processing: false,
    feedbackMessage: "",
    feedbackTone: null,
  });

  function refreshCollapsedSummaries() {
    uiState.collapsedSummaries = new SvelteSet(hypaV3Data.summaries.map((_, index) => index));
  }

  function setHypaV3Data(data: SerializableHypaV3Data) {
    hypaV3Data = data;
  }

  function syncActiveChatHypaV3Data(data: SerializableHypaV3Data) {
    const targetCharacter = DBState.db.characters?.[selectedCharIndex.current];
    const targetChat = targetCharacter?.chats?.[effectiveChatIndex];
    if (!targetCharacter || !targetChat) {
      hypaV3Data = data;
      return;
    }
    targetChat.hypaV3Data = data;
    targetCharacter.chats[effectiveChatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
    hypaV3Data = data;
  }

  function setBulkResummary(value: BulkResummaryState | null) {
    bulkResummaryState = value;
  }

  function clearSelection() {
    bulkEditState.selectedSummaries = new SvelteSet();
  }

  function selectMemoryWorkspaceTab(tab: MemoryWorkspaceTab) {
    memoryWorkspaceTab = tab;
    uiState.dropdownOpen = false;
    if (tab !== "summary") {
      searchState = null;
      bulkEditState.isEnabled = false;
      clearSelection();
      bulkResummaryState = null;
    }
  }

  $effect.pre(() => {
    void filterSelected;
    void activeChatId;
    const chat = chatList[effectiveChatIndex];
    if (!chat) {
      hypaV3Data = createEmptyHypaV3Data(language.hypaV3Modal.unclassified);
      return;
    }
    chat.hypaV3Data ??= createEmptyHypaV3Data(language.hypaV3Modal.unclassified);
    chat.hypaV3Data.categories ??= [{ id: "", name: language.hypaV3Modal.unclassified }];
    chat.hypaV3Data.lastSelectedSummaries ??= [];
    hypaV3Data = chat.hypaV3Data;
    expandedMessageState = null;
    searchState = null;
    refreshCollapsedSummaries();
  });

  $effect(() => {
    normalizePromptOverrideCharacter(promptOverrideCharacter);
    if (isOpen && !wasOpen && !getEmbedded()) {
      modalChatIndex = currentChar?.chatPage ?? 0;
    }
    wasOpen = isOpen;
    if (!isOpen && !getEmbedded()) {
      modalChatIndex = currentChar?.chatPage ?? 0;
    }
    if (!getEmbedded() && chatList.length > 0 && modalChatIndex >= chatList.length) {
      modalChatIndex = chatList.length - 1;
    }
  });

  $effect(() => {
    const nextScopeKey = `${currentChar?.chaId ?? ""}:${activeChatId ?? ""}`;
    if (lastManualScopeKey === null) {
      lastManualScopeKey = nextScopeKey;
      return;
    }
    if (nextScopeKey !== lastManualScopeKey) {
      manualState.start = "";
      manualState.end = "";
      manualState.feedbackMessage = "";
      manualState.feedbackTone = null;
      lastManualScopeKey = nextScopeKey;
    }
  });

  async function handleManualSummarizeRange() {
    await manualSummarizeRange({
      manualState,
      currentChar,
      promptOverrideCharacter,
      chatList,
      effectiveChatIndex,
      uncategorizedLabel: language.hypaV3Modal.unclassified,
      setGlobalDebug: (debug) => {
        DBState.db.hypaV3Debug = debug;
      },
      setHypaV3Data,
      isTargetActive: (target) =>
        currentChar?.chaId === target.characterId && activeChatId === target.chatId,
      getCharacters: () => DBState.db.characters ?? [],
      refreshCollapsedSummaries,
      onError: (error) => hypaV3ModalLog("Manual summarize failed:", error),
    });
  }

  function onSearch(event: KeyboardEvent) {
    if (event.key !== "Enter" || !searchState?.query.trim()) return;
    if (searchState.results.length === 0) {
      searchState.results = findAllMatches(hypaV3Data, searchState.query);
      searchState.currentResultIndex = -1;
    }
    const result = getNextSearchResult(searchState, event.shiftKey);
    if (result) {
      navigateToSearchResult({ searchState, hypaV3Data, summaryItemStateMap, result });
    }
  }

  return {
    summaryItemStateMap,
    bulkEditState,
    uiState,
    manualState,
    memoryWorkspaceTabItems: [
      { id: 0, label: "Summary" },
      { id: 1, label: "Settings" },
      { id: 2, label: "Log" },
    ],
    manualRangeStartInputId: "hypav3-manual-range-start",
    manualRangeEndInputId: "hypav3-manual-range-end",
    get currentChar() { return currentChar; },
    get promptOverrideCharacter() { return promptOverrideCharacter; },
    get chatList() { return chatList; },
    get effectiveChatIndex() { return effectiveChatIndex; },
    get activeChatId() { return activeChatId; },
    get hypaV3Data() { return hypaV3Data; },
    set hypaV3Data(value) { hypaV3Data = value; },
    get expandedMessageState() { return expandedMessageState; },
    set expandedMessageState(value) { expandedMessageState = value; },
    get searchState() { return searchState; },
    set searchState(value) { searchState = value; },
    get filterSelected() { return filterSelected; },
    set filterSelected(value) { filterSelected = value; },
    get bulkResummaryState() { return bulkResummaryState; },
    get memoryWorkspaceTab() { return memoryWorkspaceTab; },
    get selectedMemoryWorkspaceTabId() { return selectedMemoryWorkspaceTabId; },
    get categories() { return categories; },
    get logDebug() { return logDebug; },
    selectMemoryWorkspaceTabById(id: number) {
      selectMemoryWorkspaceTab(id === 1 ? "settings" : id === 2 ? "log" : "summary");
    },
    handleToggleSummarySelection(summaryIndex: number) {
      const selection = new SvelteSet(bulkEditState.selectedSummaries);
      if (selection.has(summaryIndex)) {
        selection.delete(summaryIndex);
      } else {
        selection.add(summaryIndex);
      }
      bulkEditState.selectedSummaries = selection;
    },
    async handleResetData() {
      if (!(await alertConfirmTwice(language.hypaV3Modal.resetConfirmMessage, language.hypaV3Modal.resetConfirmSecondMessage))) return;
      if (DBState.db.characters?.[selectedCharIndex.current]?.chats?.[effectiveChatIndex]) {
        syncActiveChatHypaV3Data({ summaries: [] });
      }
    },
    handleToggleBulkEditMode() {
      bulkEditState.isEnabled = !bulkEditState.isEnabled;
      if (!bulkEditState.isEnabled) clearSelection();
    },
    handleBulkEditClearSelection: clearSelection,
    handleBulkEditUpdateSelectedCategory(categoryId: string) {
      bulkEditState.selectedCategory = categoryId;
    },
    handleBulkEditUpdateBulkSelectInput(input: string) {
      bulkEditState.bulkSelectInput = input;
    },
    handleBulkEditApplyCategory() {
      applyBulkEditCategory(hypaV3Data, bulkEditState);
    },
    handleBulkEditParseAndSelectSummaries() {
      parseAndSelectSummaries({ hypaV3Data, bulkEditState });
    },
    handleDeleteSummary(summaryIndex: number) {
      hypaV3Data.summaries.splice(summaryIndex, 1);
      refreshCollapsedSummaries();
      syncActiveChatHypaV3Data(hypaV3Data);
    },
    handleDeleteAfter(summaryIndex: number) {
      if (summaryIndex + 1 < hypaV3Data.summaries.length) {
        hypaV3Data.summaries.splice(summaryIndex + 1);
      }
      refreshCollapsedSummaries();
      syncActiveChatHypaV3Data(hypaV3Data);
    },
    handleToggleCollapse(summaryIndex: number) {
      const collapsed = new SvelteSet(uiState.collapsedSummaries);
      if (collapsed.has(summaryIndex)) {
        collapsed.delete(summaryIndex);
      } else {
        collapsed.add(summaryIndex);
      }
      uiState.collapsedSummaries = collapsed;
    },
    onSearch,
    async manualSummarizeRange() {
      await handleManualSummarizeRange();
    },
    async resummarizeBulkSelected() {
      await resummarizeBulkSelected({
        bulkEditState,
        currentCharId: currentChar?.chaId ?? null,
        activeChatId,
        setBulkResummaryState: setBulkResummary,
        onError: alertNormalWait,
      });
    },
    async applyBulkResummary() {
      await applyBulkResummary({
        bulkResummaryState,
        currentCharId: currentChar?.chaId ?? null,
        activeChatId,
        syncHypaV3Data: syncActiveChatHypaV3Data,
        refreshCollapsedSummaries,
        clearSelection,
        setBulkResummaryState: setBulkResummary,
        onError: alertNormalWait,
      });
    },
    async rerollBulkResummary() {
      await rerollBulkResummary({
        bulkResummaryState,
        currentCharId: currentChar?.chaId ?? null,
        activeChatId,
        setBulkResummaryState: setBulkResummary,
        onError: alertNormalWait,
      });
    },
    cancelBulkResummary() {
      bulkResummaryState = null;
      clearSelection();
    },
    isSummaryVisible(index: number) {
      return isSummaryVisible({ hypaV3Data, filterSelected, index });
    },
    isHypaV2ConversionPossible() {
      return isHypaV2ConversionPossible({
        characters: DBState.db.characters,
        selectedCharIndex: selectedCharIndex.current,
        effectiveChatIndex,
      });
    },
    convertHypaV2ToV3() {
      return convertHypaV2ToV3({
        characters: DBState.db.characters,
        selectedCharIndex: selectedCharIndex.current,
        effectiveChatIndex,
        uncategorizedLabel: language.hypaV3Modal.unclassified,
      });
    },
    async handleConvertHypaV2() {
      const result = convertHypaV2ToV3({
        characters: DBState.db.characters,
        selectedCharIndex: selectedCharIndex.current,
        effectiveChatIndex,
        uncategorizedLabel: language.hypaV3Modal.unclassified,
      });
      const convertedData =
        DBState.db.characters?.[selectedCharIndex.current]?.chats?.[effectiveChatIndex]?.hypaV3Data;
      if (result.success && convertedData) {
        syncActiveChatHypaV3Data(convertedData as SerializableHypaV3Data);
      }
      await alertNormalWait(
        result.success
          ? language.hypaV3Modal.convertSuccessMessage
          : language.hypaV3Modal.convertErrorMessage.replace("{0}", result.error ?? "Unknown error"),
      );
    },
    openDropdownClosed() {
      uiState.dropdownOpen = false;
    },
    setModalChatIndexFromSelect(nextIndex: number) {
      if (!Number.isNaN(nextIndex)) modalChatIndex = nextIndex;
    },
    clearSearchResults() {
      if (!searchState) return;
      searchState.results = [];
      searchState.currentResultIndex = -1;
    },
  };
}
