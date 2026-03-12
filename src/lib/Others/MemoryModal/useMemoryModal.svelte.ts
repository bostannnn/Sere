import { untrack } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { fromStore } from "svelte/store";
import { alertNormalWait } from "src/ts/alert";
import { language } from "src/lang";
import { DBState, selectedCharID } from "src/ts/stores.svelte";
import { pickLatestSummarizeDebug } from "src/ts/process/memorySync";
import type {
  SerializableMemoryData,
  SerializableSummary,
} from "src/ts/process/memory/memory";
import {
  getChatMemoryData,
  getDbMemoryDebug,
  setChatMemoryData,
  setDbMemoryDebug,
} from "src/ts/process/memory/storage";
import { alertConfirmTwice } from "./utils";
import {
  convertHypaV2ToMemory,
  createEmptyMemoryData,
  isHypaV2ConversionPossible,
  manualSummarizeRange,
} from "./helpers";
import {
  applyBulkEditCategory,
  parseAndSelectSummaries,
} from "./bulk";
import {
  findAllMatches,
  getNextSearchResult,
  isSummaryVisible,
  navigateToSearchResult,
} from "./search";
import type {
  BulkEditState,
  ExpandedMessageState,
  ManualState,
  MemoryWorkspaceTab,
  SearchState,
  SummaryItemState,
  UIState,
} from "./types";

const memoryModalLog = (..._args: unknown[]) => {};

export function useMemoryModal() {
  let lastManualScopeKey = $state<string | null>(null);
  let memoryData = $state<SerializableMemoryData>(
    createEmptyMemoryData(language.memoryModal.unclassified),
  );
  let expandedMessageState = $state<ExpandedMessageState | null>(null);
  let searchState = $state<SearchState | null>(null);
  let filterSelected = $state(false);
  let memoryWorkspaceTab = $state<MemoryWorkspaceTab>("summary");
  const selectedCharIndex = fromStore(selectedCharID);

  const currentChar = $derived(DBState.db.characters?.[selectedCharIndex.current] ?? null);
  const promptOverrideCharacter = $derived.by(() =>
    currentChar && currentChar.type === "character" ? currentChar : null,
  );
  const chatList = $derived(currentChar?.chats ?? []);
  const effectiveChatIndex = $derived.by(() => {
    const baseIndex = currentChar?.chatPage ?? 0;
    if (chatList.length === 0) return 0;
    if (baseIndex < 0) return 0;
    if (baseIndex >= chatList.length) return chatList.length - 1;
    return baseIndex;
  });
  const activeChat = $derived(chatList[effectiveChatIndex]);
  const activeChatId = $derived(activeChat?.id ?? null);
  const categories = $derived.by(() => {
    const uncategorized = { id: "", name: language.memoryModal.unclassified };
    const savedCategories = memoryData.categories || [];
    return savedCategories.some((category) => category.id === "")
      ? [uncategorized, ...savedCategories.filter((category) => category.id !== "")]
      : [uncategorized, ...savedCategories];
  });
  const selectedMemoryWorkspaceTabId = $derived(
    memoryWorkspaceTab === "summary" ? 0 : memoryWorkspaceTab === "settings" ? 1 : 2,
  );
  const logDebug = $derived.by(() =>
    pickLatestSummarizeDebug(
      getChatMemoryData(activeChat)?.lastPeriodicDebug ?? null,
      getChatMemoryData(activeChat)?.lastManualDebug ?? null,
      getDbMemoryDebug(DBState.db) &&
        currentChar?.chaId === getDbMemoryDebug(DBState.db)?.characterId &&
        activeChatId === getDbMemoryDebug(DBState.db)?.chatId
        ? getDbMemoryDebug(DBState.db) ?? null
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
    uiState.collapsedSummaries = new SvelteSet(memoryData.summaries.map((_, index) => index));
  }

  function setMemoryData(data: SerializableMemoryData) {
    memoryData = data;
  }

  function normalizeMemoryDataForUi(
    data: SerializableMemoryData | undefined,
  ): { data: SerializableMemoryData; changed: boolean } {
    const nextData = data ?? createEmptyMemoryData(language.memoryModal.unclassified);
    let changed = data == null;
    if (!Array.isArray(nextData.categories)) {
      nextData.categories = [{ id: "", name: language.memoryModal.unclassified }];
      changed = true;
    } else if (!nextData.categories.some((category) => category.id === "")) {
      nextData.categories = [
        { id: "", name: language.memoryModal.unclassified },
        ...nextData.categories,
      ];
      changed = true;
    }
    if (!Array.isArray(nextData.lastSelectedSummaries)) {
      nextData.lastSelectedSummaries = [];
      changed = true;
    }
    return { data: nextData, changed };
  }

  function syncActiveChatMemoryData(data: SerializableMemoryData) {
    const targetCharacter = DBState.db.characters?.[selectedCharIndex.current];
    const targetChat = targetCharacter?.chats?.[effectiveChatIndex];
    if (!targetCharacter || !targetChat) {
      memoryData = data;
      return;
    }
    setChatMemoryData(targetChat, data);
    targetCharacter.chats[effectiveChatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
    memoryData = data;
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
    }
  }

  $effect.pre(() => {
    void filterSelected;
    void activeChatId;
    const chat = chatList[effectiveChatIndex];
    if (!chat) {
      memoryData = createEmptyMemoryData(language.memoryModal.unclassified);
      return;
    }
    const { data: chatMemoryData, changed } = normalizeMemoryDataForUi(
      untrack(() => getChatMemoryData(chat)),
    );
    if (changed) {
      untrack(() => {
        setChatMemoryData(chat, chatMemoryData);
      });
    }
    memoryData = chatMemoryData;
    expandedMessageState = null;
    searchState = null;
    refreshCollapsedSummaries();
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
      uncategorizedLabel: language.memoryModal.unclassified,
      setGlobalDebug: (debug) => {
        setDbMemoryDebug(DBState.db, debug);
      },
      setMemoryData,
      isTargetActive: (target) =>
        currentChar?.chaId === target.characterId && activeChatId === target.chatId,
      getCharacters: () => DBState.db.characters ?? [],
      refreshCollapsedSummaries,
      onError: (error) => memoryModalLog("Manual summarize failed:", error),
    });
  }

  function onSearch(event: KeyboardEvent) {
    if (event.key !== "Enter" || !searchState?.query.trim()) return;
    if (searchState.results.length === 0) {
      searchState.results = findAllMatches(memoryData, searchState.query);
      searchState.currentResultIndex = -1;
    }
    const result = getNextSearchResult(searchState, event.shiftKey);
    if (result) {
      navigateToSearchResult({ searchState, memoryData, summaryItemStateMap, result });
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
    manualRangeStartInputId: "memory-manual-range-start",
    manualRangeEndInputId: "memory-manual-range-end",
    get currentChar() { return currentChar; },
    get promptOverrideCharacter() { return promptOverrideCharacter; },
    get chatList() { return chatList; },
    get effectiveChatIndex() { return effectiveChatIndex; },
    get activeChatId() { return activeChatId; },
    get memoryData() { return memoryData; },
    set memoryData(value) { memoryData = value; },
    get expandedMessageState() { return expandedMessageState; },
    set expandedMessageState(value) { expandedMessageState = value; },
    get searchState() { return searchState; },
    set searchState(value) { searchState = value; },
    get filterSelected() { return filterSelected; },
    set filterSelected(value) { filterSelected = value; },
    get memoryWorkspaceTab() { return memoryWorkspaceTab; },
    get selectedMemoryWorkspaceTabId() { return selectedMemoryWorkspaceTabId; },
    get categories() { return categories; },
    get logDebug() { return logDebug; },
    updatePromptOverrideSummarizationPrompt(value: string) {
      if (!promptOverrideCharacter) return;
      promptOverrideCharacter.memoryPromptOverride = {
        summarizationPrompt: value,
      };
      delete (promptOverrideCharacter as Record<string, unknown>).hypaV3PromptOverride;
    },
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
      if (!(await alertConfirmTwice(language.memoryModal.resetConfirmMessage, language.memoryModal.resetConfirmSecondMessage))) return;
      if (DBState.db.characters?.[selectedCharIndex.current]?.chats?.[effectiveChatIndex]) {
        syncActiveChatMemoryData({ summaries: [] });
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
      applyBulkEditCategory(memoryData, bulkEditState);
    },
    handleBulkEditParseAndSelectSummaries() {
      parseAndSelectSummaries({ memoryData, bulkEditState });
    },
    handleDeleteSummary(summaryIndex: number) {
      memoryData.summaries.splice(summaryIndex, 1);
      refreshCollapsedSummaries();
      syncActiveChatMemoryData(memoryData);
    },
    handleDeleteAfter(summaryIndex: number) {
      if (summaryIndex + 1 < memoryData.summaries.length) {
        memoryData.summaries.splice(summaryIndex + 1);
      }
      refreshCollapsedSummaries();
      syncActiveChatMemoryData(memoryData);
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
    isSummaryVisible(index: number) {
      return isSummaryVisible({ memoryData, filterSelected, index });
    },
    isHypaV2ConversionPossible() {
      return isHypaV2ConversionPossible({
        characters: DBState.db.characters,
        selectedCharIndex: selectedCharIndex.current,
        effectiveChatIndex,
      });
    },
    convertHypaV2ToMemory() {
      return convertHypaV2ToMemory({
        characters: DBState.db.characters,
        selectedCharIndex: selectedCharIndex.current,
        effectiveChatIndex,
        uncategorizedLabel: language.memoryModal.unclassified,
      });
    },
    async handleConvertHypaV2() {
      const result = convertHypaV2ToMemory({
        characters: DBState.db.characters,
        selectedCharIndex: selectedCharIndex.current,
        effectiveChatIndex,
        uncategorizedLabel: language.memoryModal.unclassified,
      });
      const convertedData =
        getChatMemoryData(DBState.db.characters?.[selectedCharIndex.current]?.chats?.[effectiveChatIndex]);
      if (result.success && convertedData) {
        syncActiveChatMemoryData(convertedData as SerializableMemoryData);
      }
      await alertNormalWait(
        result.success
          ? language.memoryModal.convertSuccessMessage
          : language.memoryModal.convertErrorMessage.replace("{0}", result.error ?? "Unknown error"),
      );
    },
    openDropdownClosed() {
      uiState.dropdownOpen = false;
    },
    clearSearchResults() {
      if (!searchState) return;
      searchState.results = [];
      searchState.currentResultIndex = -1;
    },
  };
}
