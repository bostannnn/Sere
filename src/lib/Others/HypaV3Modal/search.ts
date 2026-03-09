import type {
  SerializableHypaV3Data,
  SerializableSummary,
} from "src/ts/process/memory/hypav3";
import { isGuidLike, shouldShowSummary } from "./utils";
import type {
  SearchResult,
  SearchState,
  SummaryItemState,
} from "./types";

export function findAllMatches(
  hypaV3Data: SerializableHypaV3Data,
  query: string,
): SearchResult[] {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();
  hypaV3Data.summaries.forEach((summary, summaryIndex) => {
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
    if (isGuidLike(query)) {
      summary.chatMemos.forEach((chatMemo, memoIndex) => {
        if (chatMemo && chatMemo.toLowerCase().includes(lowerQuery)) {
          results.push({ type: "chatmemo", summaryIndex, memoIndex });
        }
      });
    }
  });
  return results;
}

export function getNextSearchResult(
  searchState: SearchState | null,
  backward: boolean,
): SearchResult | null {
  if (!searchState || searchState.results.length === 0) return null;
  let nextIndex: number;
  if (searchState.requestedSearchFromIndex !== -1) {
    const fromSummaryIndex = searchState.requestedSearchFromIndex;
    nextIndex = backward
      ? searchState.results.findLastIndex((r) => r.summaryIndex <= fromSummaryIndex)
      : searchState.results.findIndex((r) => r.summaryIndex >= fromSummaryIndex);
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

export function navigateToSearchResult(args: {
  searchState: SearchState | null;
  hypaV3Data: SerializableHypaV3Data;
  summaryItemStateMap: WeakMap<SerializableSummary, SummaryItemState>;
  result: SearchResult;
}): void {
  const { searchState, hypaV3Data, summaryItemStateMap, result } = args;
  if (!searchState) return;
  searchState.isNavigating = true;
  if (result.type === "summary") {
    const textarea =
      summaryItemStateMap.get(hypaV3Data.summaries[result.summaryIndex])?.originalRef;
    if (!textarea) {
      searchState.isNavigating = false;
      return;
    }
    textarea.scrollIntoView({ behavior: "instant", block: "center" });
    if (result.start !== result.end) {
      textarea.setSelectionRange(result.start, result.end);
      scrollToSelection(textarea);
      if (!("ontouchend" in window)) {
        textarea.readOnly = true;
        textarea.focus();
        window.setTimeout(() => {
          searchState.ref?.focus();
          textarea.readOnly = false;
        }, 300);
      }
    }
  } else {
    const button =
      summaryItemStateMap.get(hypaV3Data.summaries[result.summaryIndex])?.chatMemoRefs[
        result.memoIndex
      ];
    if (!button) {
      searchState.isNavigating = false;
      return;
    }
    button.scrollIntoView({ behavior: "instant", block: "center" });
    button.classList.add("ds-hypa-chatmemo-highlight");
    window.setTimeout(() => {
      button.classList.remove("ds-hypa-chatmemo-highlight");
    }, 1000);
  }
  searchState.isNavigating = false;
}

function scrollToSelection(textarea: HTMLTextAreaElement): void {
  const { selectionStart, selectionEnd } = textarea;
  if (
    selectionStart === null ||
    selectionEnd === null ||
    selectionStart === selectionEnd
  ) {
    return;
  }
  const tempDiv = document.createElement("div");
  tempDiv.style.position = "absolute";
  tempDiv.style.whiteSpace = "pre-wrap";
  tempDiv.style.overflowWrap = "break-word";
  tempDiv.style.font = window.getComputedStyle(textarea).font;
  tempDiv.style.width = `${textarea.offsetWidth}px`;
  tempDiv.style.visibility = "hidden";
  tempDiv.textContent = textarea.value.substring(0, selectionStart);
  document.body.appendChild(tempDiv);
  textarea.scrollTop = tempDiv.offsetHeight - textarea.clientHeight / 2;
  document.body.removeChild(tempDiv);
}

export function isSummaryVisible(args: {
  hypaV3Data: SerializableHypaV3Data;
  filterSelected: boolean;
  index: number;
}): boolean {
  const { hypaV3Data, filterSelected, index } = args;
  const summary = hypaV3Data.summaries[index];
  return shouldShowSummary(summary, index, false, "all") && (
    !filterSelected ||
    !hypaV3Data.metrics ||
    hypaV3Data.metrics.lastImportantSummaries.includes(index) ||
    hypaV3Data.metrics.lastRecentSummaries.includes(index) ||
    hypaV3Data.metrics.lastSimilarSummaries.includes(index) ||
    hypaV3Data.metrics.lastRandomSummaries.includes(index)
  );
}
