import { SvelteSet } from "svelte/reactivity";
import type { SerializableMemoryData } from "src/ts/process/memory/memory";
import { parseSelectionInput, shouldShowSummary } from "./utils";
import type { BulkEditState } from "./types";

export function applyBulkEditCategory(
  memoryData: SerializableMemoryData,
  bulkEditState: BulkEditState,
): void {
  if (bulkEditState.selectedSummaries.size === 0) return;
  for (const summaryIndex of bulkEditState.selectedSummaries) {
    memoryData.summaries[summaryIndex].categoryId =
      bulkEditState.selectedCategory || undefined;
  }
  bulkEditState.selectedSummaries = new SvelteSet();
}

export function parseAndSelectSummaries(args: {
  memoryData: SerializableMemoryData;
  bulkEditState: BulkEditState;
}): void {
  const { memoryData, bulkEditState } = args;
  if (!bulkEditState.bulkSelectInput.trim()) return;
  const newSelection = parseSelectionInput(
    bulkEditState.bulkSelectInput,
    memoryData.summaries.length,
  );
  const filteredSelection = new SvelteSet<number>();
  for (const index of newSelection) {
    if (shouldShowSummary(memoryData.summaries[index])) {
      filteredSelection.add(index);
    }
  }
  bulkEditState.selectedSummaries = filteredSelection;
  bulkEditState.bulkSelectInput = "";
}
