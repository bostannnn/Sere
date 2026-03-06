<script lang="ts">
  import { SvelteSet } from "svelte/reactivity";
  import { ChevronUpIcon, ChevronDownIcon } from "@lucide/svelte";
  import { 
    type SerializableHypaV3Data,
    type SerializableSummary, 
    type SummarizeDebugLog,
  } from "src/ts/process/memory/hypav3";
  import { alertNormalWait, alertToast } from "src/ts/alert";
  import { DBState, selectedCharID, hypaV3ModalOpen } from "src/ts/stores.svelte";
  import { language } from "src/lang";
  import { globalFetch } from "src/ts/globalApi.svelte";
  import { alertConfirmTwice } from "./HypaV3Modal/utils";
  import ModalHeader from "./HypaV3Modal/modal-header.svelte";
  import ModalSummaryItem from "./HypaV3Modal/modal-summary-item.svelte";
  import BulkEditActions from "./HypaV3Modal/bulk-edit-actions.svelte";
  import BulkResummaryResult from "./HypaV3Modal/bulk-resummary-result.svelte";
  
  import type {
    SummaryItemState,
    ExpandedMessageState,
    SearchState,
    SearchResult,
    BulkResummaryState,
    BulkEditState,
    UIState,
  } from "./HypaV3Modal/types";
  
  import {
    shouldShowSummary,
    isGuidLike,
    parseSelectionInput,
  } from "./HypaV3Modal/utils";
  import SelectInput from "src/lib/UI/GUI/SelectInput.svelte";
  import OptionInput from "src/lib/UI/GUI/OptionInput.svelte";
  import TextAreaInput from "src/lib/UI/GUI/TextAreaInput.svelte";
  import SettingsSubTabs from "src/lib/Setting/SettingsSubTabs.svelte";
  import { pickLatestSummarizeDebug } from "src/ts/process/hypaSync";
  const hypaV3ModalLog = (..._args: unknown[]) => {};

  interface Props {
    embedded?: boolean;
  }

  type ManualSummarizeDebug = SummarizeDebugLog;

  interface ManualSummarizeTarget {
    characterId: string;
    chatId: string;
  }

  const {
    embedded = false,
  }: Props = $props();

  let modalChatIndex = $state(0);
  let wasOpen = $state(false);
  const currentChar = $derived(DBState.db.characters?.[$selectedCharID] ?? null);
  const promptOverrideCharacter = $derived.by(() =>
    currentChar && currentChar.type === "character" ? currentChar : null
  );
  const chatList = $derived(currentChar?.chats ?? []);
  const effectiveChatIndex = $derived.by(() => {
    const baseIndex = embedded ? (currentChar?.chatPage ?? 0) : modalChatIndex;
    if (chatList.length === 0) {
      return 0;
    }
    if (baseIndex < 0) {
      return 0;
    }
    if (baseIndex >= chatList.length) {
      return chatList.length - 1;
    }
    return baseIndex;
  });
  const activeChat = $derived(chatList[effectiveChatIndex]);
  const activeChatId = $derived(activeChat?.id ?? null);
  const isOpen = $derived(embedded || $hypaV3ModalOpen);

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
  type MemoryWorkspaceTab = "summary" | "settings" | "log";
  const memoryWorkspaceTabIdByValue: Record<MemoryWorkspaceTab, number> = {
    summary: 0,
    settings: 1,
    log: 2,
  };
  const memoryWorkspaceTabById: Record<number, MemoryWorkspaceTab> = {
    0: "summary",
    1: "settings",
    2: "log",
  };
  const memoryWorkspaceTabItems = [
    { id: 0, label: "Summary" },
    { id: 1, label: "Settings" },
    { id: 2, label: "Log" },
  ];
  let memoryWorkspaceTab = $state<MemoryWorkspaceTab>("summary");
  const selectedMemoryWorkspaceTabId = $derived(memoryWorkspaceTabIdByValue[memoryWorkspaceTab]);

  const bulkEditState = $state<BulkEditState>({
    isEnabled: false,
    selectedSummaries: new Set(),
    selectedCategory: "",
    bulkSelectInput: "",
  });

  const uiState = $state<UIState>({
    collapsedSummaries: new Set(),
    dropdownOpen: false,
  });

  let manualStart = $state('');
  let manualEnd = $state('');
  let manualProcessing = $state(false);
  let manualFeedbackMessage = $state("");
  let manualFeedbackTone = $state<"error" | "success" | null>(null);
  const manualRangeStartInputId = "hypav3-manual-range-start";
  const manualRangeEndInputId = "hypav3-manual-range-end";
  const hypaV3Debug = $derived(DBState.db.hypaV3Debug);
  const scopedHypaV3Debug = $derived.by(() => {
    if (!hypaV3Debug || !currentChar || !activeChatId) {
      return null;
    }
    if (hypaV3Debug.characterId !== currentChar.chaId || hypaV3Debug.chatId !== activeChatId) {
      return null;
    }
    return hypaV3Debug as ManualSummarizeDebug;
  });
  const activeChatManualDebug = $derived.by(() => {
    const manualDebug = activeChat?.hypaV3Data?.lastManualDebug;
    if (!manualDebug || typeof manualDebug !== "object") {
      return null;
    }
    return manualDebug as ManualSummarizeDebug;
  });
  const activeChatPeriodicDebug = $derived.by(() => {
    const periodicDebug = activeChat?.hypaV3Data?.lastPeriodicDebug;
    if (!periodicDebug || typeof periodicDebug !== "object") {
      return null;
    }
    return periodicDebug as ManualSummarizeDebug;
  });
  const logDebug = $derived.by(() =>
    pickLatestSummarizeDebug(
      activeChatPeriodicDebug,
      activeChatManualDebug,
      scopedHypaV3Debug,
    )
  );
  const selectMemoryWorkspaceTab = (tab: MemoryWorkspaceTab) => {
    memoryWorkspaceTab = tab;
    uiState.dropdownOpen = false;

    if (tab !== "summary") {
      searchState = null;
      bulkEditState.isEnabled = false;
      bulkEditState.selectedSummaries = new Set();
      bulkResummaryState = null;
    }
  };

  const selectMemoryWorkspaceTabById = (id: number) => {
    const tab = memoryWorkspaceTabById[id] ?? "summary";
    selectMemoryWorkspaceTab(tab);
  };

  $effect.pre(() => {
    void filterSelected;
    void activeChatId;
    const chat = chatList[effectiveChatIndex];
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

  function persistHypaV3Data() {
    const targetChat = chatList[effectiveChatIndex];
    if (!targetChat) return;
    const targetCharacter = DBState.db.characters?.[$selectedCharID];
    if (!targetCharacter) return;
    targetChat.hypaV3Data = hypaV3Data;
    targetCharacter.chats[effectiveChatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
  }

  $effect(() => {
    const char = promptOverrideCharacter;
    if (char) {
      char.hypaV3PromptOverride ??= {
        summarizationPrompt: "",
        reSummarizationPrompt: "",
      };
      char.hypaV3PromptOverride.summarizationPrompt = typeof char.hypaV3PromptOverride.summarizationPrompt === "string"
        ? char.hypaV3PromptOverride.summarizationPrompt
        : "";
      char.hypaV3PromptOverride.reSummarizationPrompt = typeof char.hypaV3PromptOverride.reSummarizationPrompt === "string"
        ? char.hypaV3PromptOverride.reSummarizationPrompt
        : "";
    }

    if (isOpen && !wasOpen && !embedded) {
      modalChatIndex = currentChar?.chatPage ?? 0;
    }
    wasOpen = isOpen;

    if (!isOpen && !embedded) {
      modalChatIndex = currentChar?.chatPage ?? 0;
    }

    if (!embedded && chatList.length > 0 && modalChatIndex >= chatList.length) {
      modalChatIndex = chatList.length - 1;
    }
  });

  const activeManualScopeKey = $derived.by(() => {
    const characterId = currentChar?.chaId ?? "";
    const chatId = activeChatId ?? "";
    return `${characterId}:${chatId}`;
  });
  let lastManualScopeKey = $state<string | null>(null);
  $effect(() => {
    const nextScopeKey = activeManualScopeKey;
    if (lastManualScopeKey === null) {
      lastManualScopeKey = nextScopeKey;
      return;
    }
    if (nextScopeKey !== lastManualScopeKey) {
      manualStart = "";
      manualEnd = "";
      manualFeedbackMessage = "";
      manualFeedbackTone = null;
      lastManualScopeKey = nextScopeKey;
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

  function toErrorMessage(error: unknown): string {
    if (error instanceof Error && typeof error.message === "string") {
      return error.message;
    }
    if (typeof error === "object" && error !== null && "message" in error) {
      return String((error as { message?: unknown }).message ?? "Unknown error");
    }
    return String(error ?? "Unknown error");
  }

  function findManualSummarizeTargetIndices(target: ManualSummarizeTarget) {
    const characters = DBState.db.characters ?? [];
    const characterIndex = characters.findIndex((item) => item?.chaId === target.characterId);
    if (characterIndex < 0) {
      return null;
    }
    const chats = characters[characterIndex]?.chats ?? [];
    const chatIndex = chats.findIndex((item) => item?.id === target.chatId);
    if (chatIndex < 0) {
      return null;
    }
    return { characterIndex, chatIndex };
  }

  function syncHypaV3DataFromServer(data: SerializableHypaV3Data, target?: ManualSummarizeTarget) {
    const resolvedTarget = target ?? (currentChar?.chaId && activeChatId
      ? { characterId: currentChar.chaId, chatId: activeChatId }
      : null);
    if (!resolvedTarget) return;
    const targetIndices = findManualSummarizeTargetIndices(resolvedTarget);
    if (!targetIndices) return;
    const targetCharacter = DBState.db.characters?.[targetIndices.characterIndex];
    const targetChat = targetCharacter?.chats?.[targetIndices.chatIndex];
    if (!targetCharacter || !targetChat) return;
    targetChat.hypaV3Data = data;
    if (currentChar?.chaId === resolvedTarget.characterId && activeChatId === resolvedTarget.chatId) {
      hypaV3Data = data;
    }
    targetCharacter.chats[targetIndices.chatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
  }

  function persistManualDebugForActiveChat(debug: ManualSummarizeDebug, target?: ManualSummarizeTarget) {
    const resolvedTarget = target ?? (currentChar?.chaId && activeChatId
      ? { characterId: currentChar.chaId, chatId: activeChatId }
      : null);
    if (!resolvedTarget) return;
    const targetIndices = findManualSummarizeTargetIndices(resolvedTarget);
    if (!targetIndices) return;
    const targetCharacter = DBState.db.characters?.[targetIndices.characterIndex];
    const targetChat = targetCharacter?.chats?.[targetIndices.chatIndex];
    if (!targetCharacter || !targetChat) return;
    targetChat.hypaV3Data ??= {
      summaries: [],
      categories: [{ id: "", name: language.hypaV3Modal.unclassified }],
      lastSelectedSummaries: [],
    };
    targetChat.hypaV3Data.lastManualDebug = debug;
    if (currentChar?.chaId === resolvedTarget.characterId && activeChatId === resolvedTarget.chatId) {
      hypaV3Data = targetChat.hypaV3Data;
    }
    targetCharacter.chats[targetIndices.chatIndex] = { ...targetChat };
    targetCharacter.chats = [...targetCharacter.chats];
  }

  async function manualSummarizeRange() {
    if (manualProcessing) return;
    manualFeedbackMessage = "";
    manualFeedbackTone = null;
    const characterId = currentChar?.chaId;
    const chat = chatList[effectiveChatIndex];
    if (!chat || !characterId || !chat.id) return;
    const requestTarget: ManualSummarizeTarget = {
      characterId,
      chatId: chat.id,
    };
    const messages = (chat.message ?? []).filter((m) => m && !m.disabled);
    const maxCount = messages.length;
    if (maxCount === 0) {
      manualFeedbackTone = "error";
      manualFeedbackMessage = "No messages available in this chat to summarize.";
      return;
    }

    const parsedStart = Number(manualStart || 1);
    const parsedEnd = Number(manualEnd || maxCount);
    const startNum = Math.max(1, Math.trunc(parsedStart));
    const endNum = Math.min(maxCount, Math.trunc(parsedEnd));
    if (!Number.isFinite(startNum) || !Number.isFinite(endNum) || startNum > endNum) {
      manualFeedbackTone = "error";
      manualFeedbackMessage = `Invalid range. Use values between 1 and ${maxCount}, and keep Start less than or equal to End.`;
      return;
    }

    try {
      manualProcessing = true;
      const requestedPromptOverride = {
        summarizationPrompt: promptOverrideCharacter?.hypaV3PromptOverride?.summarizationPrompt ?? "",
        reSummarizationPrompt: promptOverrideCharacter?.hypaV3PromptOverride?.reSummarizationPrompt ?? "",
      };
      const requestPayload = {
        characterId,
        chatId: chat.id,
        start: startNum,
        end: endNum,
        promptOverride: requestedPromptOverride,
      };
      const result = await callHypaV3Server('/data/memory/hypav3/manual-summarize', requestPayload);
      if (result?.hypaV3Data) {
        syncHypaV3DataFromServer(result.hypaV3Data as SerializableHypaV3Data, requestTarget);
      }
      if (result?.debug && typeof result.debug === "object") {
        const debugData = result.debug as ManualSummarizeDebug;
        DBState.db.hypaV3Debug = debugData;
        persistManualDebugForActiveChat(debugData, requestTarget);
      } else {
        // Compatibility fallback for older server processes that do not return `debug`.
        let fallbackDebug: ManualSummarizeDebug = {
          timestamp: Date.now(),
          model: "-",
          isResummarize: false,
          prompt: requestedPromptOverride.summarizationPrompt,
          input: messages
            .slice(startNum - 1, endNum)
            .map((m) => `${m.role}: ${String(m.data ?? "")}`)
            .join("\n"),
          formatted: [],
          characterId,
          chatId: chat.id,
          start: startNum,
          end: endNum,
          source: "manual",
          promptSource: requestedPromptOverride.summarizationPrompt.trim()
            ? "request_override"
            : "preset_or_default",
        };
        try {
          const traceResult = await callHypaV3Server('/data/memory/hypav3/manual-summarize/trace', requestPayload);
          const promptMessages = Array.isArray(traceResult?.promptMessages) ? traceResult.promptMessages as Array<{ role?: string; content?: string }> : [];
          const systemPrompt = promptMessages.find((item) => item?.role === "system")?.content ?? "";
          const slotPrompt = promptMessages.length === 1 && promptMessages[0]?.role === "user"
            ? (promptMessages[0]?.content ?? "")
            : "";
          const detectedPromptSource =
            String(traceResult?.endpoint ?? "").includes("_manual_summarize_trace") &&
            requestedPromptOverride.summarizationPrompt.trim()
              ? ((systemPrompt || slotPrompt).includes(requestedPromptOverride.summarizationPrompt.trim())
                  ? "request_override"
                  : "preset_or_default")
              : fallbackDebug.promptSource;
          fallbackDebug = {
            ...fallbackDebug,
            model: String(traceResult?.model ?? "-"),
            formatted: promptMessages
              .filter((item) => typeof item?.role === "string" && typeof item?.content === "string")
              .map((item) => ({ role: String(item.role), content: String(item.content) })),
            prompt: systemPrompt || slotPrompt || fallbackDebug.prompt,
            promptSource: detectedPromptSource,
          };
          if (requestedPromptOverride.summarizationPrompt.trim()) {
            const usesRequestedPrompt = fallbackDebug.prompt.includes(requestedPromptOverride.summarizationPrompt.trim());
            if (!usesRequestedPrompt) {
              fallbackDebug.promptSource = "preset_or_default";
              alertToast("Prompt override was not used by the running server. Restart runserver.");
            }
          }
        } catch {
          // Keep the fallback debug built from local state.
        }
        DBState.db.hypaV3Debug = fallbackDebug;
        persistManualDebugForActiveChat(fallbackDebug, requestTarget);
      }
      uiState.collapsedSummaries = new Set(hypaV3Data.summaries.map((_, index) => index));
      manualFeedbackTone = "success";
      manualFeedbackMessage = "Summary added.";
    } catch (error) {
      hypaV3ModalLog('Manual summarize failed:', error);
      const errorMessage = toErrorMessage(error);
      manualFeedbackTone = "error";
      manualFeedbackMessage = `Manual summarize failed: ${errorMessage}`;
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
    const chat = chatList[effectiveChatIndex];
    if (!characterId || !chat?.id) return;

    const sortedIndices = Array.from(bulkEditState.selectedSummaries).sort((a, b) => a - b);

    try {
      bulkResummaryState = {
        isProcessing: true,
        result: null,
        selectedIndices: sortedIndices,
        mergedChatMemos: [],
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
      };

    } catch (error) {
      hypaV3ModalLog('Re-summarize Failed:', error);
      bulkResummaryState = null;
      await alertNormalWait(`Re-summarize Failed: ${toErrorMessage(error)}`);
    }
  }

  async function applyBulkResummary() {
    if (!bulkResummaryState || !bulkResummaryState.result) return;
    const characterId = currentChar?.chaId;
    const chat = chatList[effectiveChatIndex];
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
      await alertNormalWait(`Apply re-summarize Failed: ${toErrorMessage(error)}`);
    }
  }

  async function rerollBulkResummary() {
    if (!bulkResummaryState) return;
    const characterId = currentChar?.chaId;
    const chat = chatList[effectiveChatIndex];
    if (!characterId || !chat?.id) return;
    
    const sortedIndices = bulkResummaryState.selectedIndices;
    
    try {
      bulkResummaryState = {
        ...bulkResummaryState,
        isProcessing: true,
        result: null,
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
      };
      
    } catch (error) {
      hypaV3ModalLog('Re-summarize Retry Failed:', error);
      bulkResummaryState = null;
      await alertNormalWait(`Re-summarize Retry Failed: ${toErrorMessage(error)}`);
    }
  }

  function cancelBulkResummary() {
    bulkResummaryState = null;
    bulkEditState.selectedSummaries = new Set();
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
      const targetChat = targetCharacter.chats?.[effectiveChatIndex];
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

  function handleBulkEditParseAndSelectSummaries() {
    if (!bulkEditState.bulkSelectInput.trim()) return;
    
    const newSelection = parseSelectionInput(bulkEditState.bulkSelectInput, hypaV3Data.summaries.length);
    const filteredSelection = new SvelteSet<number>();
    
    for (const index of newSelection) {
      if (shouldShowSummary(hypaV3Data.summaries[index], index, false, "all")) {
        filteredSelection.add(index);
      }
    }

    bulkEditState.selectedSummaries = filteredSelection;
    bulkEditState.bulkSelectInput = "";
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
      button.classList.add("ds-hypa-chatmemo-highlight");

      // Remove highlight after a short delay
      window.setTimeout(() => {
        button.classList.remove("ds-hypa-chatmemo-highlight");
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
      false,
      "all"
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
    const chat = char.chats[effectiveChatIndex];
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
      const chat = char.chats[effectiveChatIndex];
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
        error: `Error occurred: ${toErrorMessage(error)}`,
      };
    }
  }

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
      class:ds-hypa-modal-window-empty={hypaV3Data.summaries.length === 0}
      onclick={(e) => {
        e.stopPropagation();
        uiState.dropdownOpen = false;
      }}
    >
      {#if !embedded}
        <!-- Header -->
        <ModalHeader
          {embedded}
          activeTab={memoryWorkspaceTab}
          bind:searchState
          bind:dropdownOpen={uiState.dropdownOpen}
          bind:filterSelected
          {bulkEditState}
          {uiState}
          {hypaV3Data}
          onResetData={handleResetData}
          onToggleBulkEditMode={handleToggleBulkEditMode}
        />
      {/if}

      <SettingsSubTabs
        className="ds-hypa-memory-tabs"
        items={memoryWorkspaceTabItems}
        selectedId={selectedMemoryWorkspaceTabId}
        onSelect={selectMemoryWorkspaceTabById}
      />

      <!-- Scrollable Container -->
      <div class="ds-hypa-modal-scroll" tabindex="-1">
        {#if memoryWorkspaceTab === "summary"}
          <div
            class="ds-hypa-modal-tab-panel"
            role="tabpanel"
            id="hypa-memory-panel-summary"
            aria-label="Summary panel"
          >
            {#if embedded}
              <ModalHeader
                {embedded}
                activeTab={memoryWorkspaceTab}
                bind:searchState
                bind:dropdownOpen={uiState.dropdownOpen}
                bind:filterSelected
                {bulkEditState}
                {uiState}
                {hypaV3Data}
                onResetData={handleResetData}
                onToggleBulkEditMode={handleToggleBulkEditMode}
              />
            {/if}

            {#if hypaV3Data.summaries.length === 0}
              {#if isHypaV2ConversionPossible()}
                <div class="ds-hypa-modal-convert-card panel-shell">
                  <div class="ds-hypa-modal-convert-center">
                    <div class="ds-hypa-modal-convert-label">
                      {language.hypaV3Modal.convertLabel}
                    </div>
                    <button
                      type="button"
                      class="ds-hypa-modal-convert-button control-chip"
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
                      <span class="ds-hypa-modal-search-counter">
                        {searchState.currentResultIndex + 1}/{searchState.results
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
                      onSearch({ shiftKey: true, key: "Enter" } as KeyboardEvent);
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
                      onSearch({ key: "Enter" } as KeyboardEvent);
                    }}
                  >
                    <ChevronDownIcon class="ds-hypa-modal-search-nav-icon" />
                  </button>
                </div>
              </div>
            {/if}

            <div class="ds-hypa-modal-tools panel-shell">
              <div class="ds-hypa-modal-tools-body">
                {#if !embedded && chatList.length > 1}
                  <div class="ds-hypa-modal-chat-row">
                    <span class="ds-hypa-modal-chat-label">Chat</span>
                    <SelectInput
                      className="ds-hypa-modal-chat-select"
                      value={effectiveChatIndex}
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

                <div class={`ds-hypa-modal-manual-sticky${embedded ? " ds-hypa-modal-manual-embedded" : ""}`}>
                  <div class="ds-hypa-modal-manual-row">
                    <div class="ds-hypa-modal-manual-col">
                      <label class="ds-hypa-modal-manual-label" for={manualRangeStartInputId}>Manual summarize range</label>
                      <div class="ds-hypa-modal-manual-input-row">
                        <input
                          id={manualRangeStartInputId}
                          class="ds-hypa-modal-manual-input control-field"
                          type="number"
                          min="1"
                          max={chatList[effectiveChatIndex]?.message?.length ?? 1}
                          placeholder="Start"
                          bind:value={manualStart}
                        />
                        <span class="ds-hypa-modal-manual-to">to</span>
                        <input
                          id={manualRangeEndInputId}
                          class="ds-hypa-modal-manual-input control-field"
                          type="number"
                          min="1"
                          max={chatList[effectiveChatIndex]?.message?.length ?? 1}
                          placeholder="End"
                          bind:value={manualEnd}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      class="ds-hypa-modal-manual-submit ds-ui-button ds-ui-button-size-md ds-ui-button--primary"
                      class:is-disabled={manualProcessing}
                      disabled={manualProcessing}
                      onclick={manualSummarizeRange}
                    >
                      {manualProcessing ? "Summarizing..." : "Summarize"}
                    </button>
                  </div>
                  {#if manualFeedbackMessage}
                    <div
                      class={`ds-hypa-modal-manual-feedback control-chip ${manualFeedbackTone === "error"
                        ? "ds-hypa-modal-manual-feedback-error"
                        : "ds-hypa-modal-manual-feedback-success"}`}
                      role={manualFeedbackTone === "error" ? "alert" : "status"}
                    >
                      {manualFeedbackMessage}
                    </div>
                  {/if}
                </div>
              </div>
            </div>

            {#each hypaV3Data.summaries as summary, i (summary)}
              {#if isSummaryVisible(i)}
                <ModalSummaryItem
                  summaryIndex={i}
                  chatIndex={effectiveChatIndex}
                  {hypaV3Data}
                  {summaryItemStateMap}
                  bind:expandedMessageState
                  bind:searchState
                  {filterSelected}
                  {bulkEditState}
                  {uiState}
                  onToggleSummarySelection={handleToggleSummarySelection}
                  onToggleCollapse={handleToggleCollapse}
                  onDeleteSummary={handleDeleteSummary}
                  onDeleteAfter={handleDeleteAfter}
                />
              {/if}
            {/each}

          </div>
        {:else if memoryWorkspaceTab === "settings"}
          <div
            class="ds-hypa-modal-tab-panel"
            role="tabpanel"
            id="hypa-memory-panel-settings"
            aria-label="Settings panel"
          >
            {#if promptOverrideCharacter}
              <div class="ds-hypa-modal-prompt-override panel-shell">
                <div class="ds-hypa-modal-prompt-override-title">Per-character memory prompt override</div>
                <div class="ds-hypa-modal-prompt-override-grid">
                  <label class="ds-hypa-modal-prompt-override-label">
                    Summarization Prompt
                    <TextAreaInput
                      className="ds-hypa-modal-prompt-override-input"
                      bind:value={promptOverrideCharacter.hypaV3PromptOverride.summarizationPrompt}
                      autocomplete="off"
                      margin="none"
                      optimaizedInput={false}
                    />
                  </label>
                  <label class="ds-hypa-modal-prompt-override-label">
                    Re-summarization Prompt
                    <TextAreaInput
                      className="ds-hypa-modal-prompt-override-input"
                      bind:value={promptOverrideCharacter.hypaV3PromptOverride.reSummarizationPrompt}
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
            {#if logDebug}
              <div class="ds-hypa-modal-debug panel-shell">
                <div class="ds-hypa-modal-debug-summary">
                  Last summarize log
                </div>
                <div class="ds-hypa-modal-debug-body">
                  <div>Model: <span class="ds-hypa-modal-debug-value">{logDebug.model}</span></div>
                  <div>Mode: <span class="ds-hypa-modal-debug-value">{logDebug.source === "periodic" ? "Periodic Summarize" : (logDebug.isResummarize ? "Resummarize" : "Summarize")}</span></div>
                  <div>Time: <span class="ds-hypa-modal-debug-value">{new Date(logDebug.timestamp).toLocaleString()}</span></div>
                  {#if logDebug.promptSource}
                    <div>Prompt source: <span class="ds-hypa-modal-debug-value">{logDebug.promptSource}</span></div>
                  {/if}
                  {#if typeof logDebug.start === "number" && typeof logDebug.end === "number"}
                    <div>Range: <span class="ds-hypa-modal-debug-value">{logDebug.start} - {logDebug.end}</span></div>
                  {/if}
                  <div>
                    <div class="ds-hypa-modal-debug-block-title">Prompt</div>
                    <textarea
                      class="ds-hypa-modal-debug-textarea control-field"
                      rows="4"
                      readonly
                      value={logDebug.prompt}
                    ></textarea>
                  </div>
                  <div>
                    <div class="ds-hypa-modal-debug-block-title">Input</div>
                    <textarea
                      class="ds-hypa-modal-debug-textarea control-field"
                      rows="4"
                      readonly
                      value={logDebug.input}
                    ></textarea>
                  </div>
                  <div>
                    <div class="ds-hypa-modal-debug-block-title">Formatted</div>
                    <textarea
                      class="ds-hypa-modal-debug-textarea control-field"
                      rows="6"
                      readonly
                      value={JSON.stringify(logDebug.formatted, null, 2)}
                    ></textarea>
                  </div>
                  {#if logDebug.rawResponse}
                    <div>
                      <div class="ds-hypa-modal-debug-block-title">Raw Response</div>
                      <textarea
                        class="ds-hypa-modal-debug-textarea control-field"
                        rows="6"
                        readonly
                        value={logDebug.rawResponse}
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
      {#if memoryWorkspaceTab === "summary"}
        <BulkResummaryResult
          {bulkResummaryState}
          onReroll={rerollBulkResummary}
          onApply={applyBulkResummary}
          onCancel={cancelBulkResummary}
        />

        <BulkEditActions
          {bulkEditState}
          {categories}
          showImportantOnly={false}
          selectedCategoryFilter="all"
          onResummarize={resummarizeBulkSelected}
          onClearSelection={handleBulkEditClearSelection}
          onUpdateSelectedCategory={handleBulkEditUpdateSelectedCategory}
          onUpdateBulkSelectInput={handleBulkEditUpdateBulkSelectInput}
          onApplyCategory={handleBulkEditApplyCategory}
          onParseAndSelectSummaries={handleBulkEditParseAndSelectSummaries}
        />
      {/if}
    </div>
  </div>
</div>
