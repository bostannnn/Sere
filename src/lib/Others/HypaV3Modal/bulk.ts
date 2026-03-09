import { SvelteSet } from "svelte/reactivity";
import type { SerializableHypaV3Data } from "src/ts/process/memory/hypav3";
import { parseSelectionInput, shouldShowSummary } from "./utils";
import type { BulkEditState, BulkResummaryState } from "./types";
import {
  callHypaV3Server,
  toErrorMessage,
} from "./helpers";

export async function resummarizeBulkSelected(args: {
  bulkEditState: BulkEditState;
  currentCharId: string | null;
  activeChatId: string | null;
  setBulkResummaryState: (value: BulkResummaryState | null) => void;
  onError: (message: string) => Promise<void>;
}): Promise<void> {
  const { bulkEditState, currentCharId, activeChatId, setBulkResummaryState, onError } =
    args;
  if (bulkEditState.selectedSummaries.size < 2 || !currentCharId || !activeChatId) return;
  const selectedIndices = Array.from(bulkEditState.selectedSummaries).sort((a, b) => a - b);
  try {
    setBulkResummaryState({
      isProcessing: true,
      result: null,
      selectedIndices,
      mergedChatMemos: [],
    });
    const preview = await callHypaV3Server("/data/memory/hypav3/resummarize-preview", {
      characterId: currentCharId,
      chatId: activeChatId,
      summaryIndices: selectedIndices,
    });
    setBulkResummaryState({
      isProcessing: false,
      result: String(preview.summary || ""),
      selectedIndices: Array.isArray(preview.selectedIndices)
        ? (preview.selectedIndices as number[])
        : selectedIndices,
      mergedChatMemos: Array.isArray(preview.mergedChatMemos)
        ? (preview.mergedChatMemos as string[])
        : [],
    });
  } catch (error) {
    setBulkResummaryState(null);
    await onError(`Re-summarize Failed: ${toErrorMessage(error)}`);
  }
}

export async function applyBulkResummary(args: {
  bulkResummaryState: BulkResummaryState | null;
  currentCharId: string | null;
  activeChatId: string | null;
  syncHypaV3Data: (data: SerializableHypaV3Data) => void;
  refreshCollapsedSummaries: () => void;
  clearSelection: () => void;
  setBulkResummaryState: (value: BulkResummaryState | null) => void;
  onError: (message: string) => Promise<void>;
}): Promise<void> {
  const {
    bulkResummaryState,
    currentCharId,
    activeChatId,
    syncHypaV3Data,
    refreshCollapsedSummaries,
    clearSelection,
    setBulkResummaryState,
    onError,
  } = args;
  if (!bulkResummaryState?.result || !currentCharId || !activeChatId) return;
  try {
    const applied = await callHypaV3Server("/data/memory/hypav3/resummarize-apply", {
      characterId: currentCharId,
      chatId: activeChatId,
      summaryIndices: bulkResummaryState.selectedIndices,
      summary: bulkResummaryState.result,
      mergedChatMemos: bulkResummaryState.mergedChatMemos,
    });
    if (applied.hypaV3Data) {
      syncHypaV3Data(applied.hypaV3Data as SerializableHypaV3Data);
    }
    refreshCollapsedSummaries();
    clearSelection();
    setBulkResummaryState(null);
  } catch (error) {
    await onError(`Apply re-summarize Failed: ${toErrorMessage(error)}`);
  }
}

export async function rerollBulkResummary(args: {
  bulkResummaryState: BulkResummaryState | null;
  currentCharId: string | null;
  activeChatId: string | null;
  setBulkResummaryState: (value: BulkResummaryState | null) => void;
  onError: (message: string) => Promise<void>;
}): Promise<void> {
  const {
    bulkResummaryState,
    currentCharId,
    activeChatId,
    setBulkResummaryState,
    onError,
  } = args;
  if (!bulkResummaryState || !currentCharId || !activeChatId) return;
  try {
    setBulkResummaryState({
      ...bulkResummaryState,
      isProcessing: true,
      result: null,
    });
    const preview = await callHypaV3Server("/data/memory/hypav3/resummarize-preview", {
      characterId: currentCharId,
      chatId: activeChatId,
      summaryIndices: bulkResummaryState.selectedIndices,
    });
    setBulkResummaryState({
      ...bulkResummaryState,
      isProcessing: false,
      result: String(preview.summary || ""),
      selectedIndices: Array.isArray(preview.selectedIndices)
        ? (preview.selectedIndices as number[])
        : bulkResummaryState.selectedIndices,
      mergedChatMemos: Array.isArray(preview.mergedChatMemos)
        ? (preview.mergedChatMemos as string[])
        : bulkResummaryState.mergedChatMemos,
    });
  } catch (error) {
    setBulkResummaryState(null);
    await onError(`Re-summarize Retry Failed: ${toErrorMessage(error)}`);
  }
}

export function applyBulkEditCategory(
  hypaV3Data: SerializableHypaV3Data,
  bulkEditState: BulkEditState,
): void {
  if (bulkEditState.selectedSummaries.size === 0) return;
  for (const summaryIndex of bulkEditState.selectedSummaries) {
    hypaV3Data.summaries[summaryIndex].categoryId =
      bulkEditState.selectedCategory || undefined;
  }
  bulkEditState.selectedSummaries = new SvelteSet();
}

export function parseAndSelectSummaries(args: {
  hypaV3Data: SerializableHypaV3Data;
  bulkEditState: BulkEditState;
}): void {
  const { hypaV3Data, bulkEditState } = args;
  if (!bulkEditState.bulkSelectInput.trim()) return;
  const newSelection = parseSelectionInput(
    bulkEditState.bulkSelectInput,
    hypaV3Data.summaries.length,
  );
  const filteredSelection = new SvelteSet<number>();
  for (const index of newSelection) {
    if (shouldShowSummary(hypaV3Data.summaries[index], index, false, "all")) {
      filteredSelection.add(index);
    }
  }
  bulkEditState.selectedSummaries = filteredSelection;
  bulkEditState.bulkSelectInput = "";
}
