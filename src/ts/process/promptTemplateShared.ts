export const MEMORY_PROMPT_TAG = "Past Events Summary";
export const MEMORY_MESSAGE_MEMO = "memory";

export function normalizeTemplateRange(items, rangeStart, rangeEnd) {
  const source = Array.isArray(items) ? items : [];
  let start = Number.isFinite(Number(rangeStart)) ? Number(rangeStart) : 0;
  let end = rangeEnd === "end"
    ? source.length
    : (Number.isFinite(Number(rangeEnd)) ? Number(rangeEnd) : source.length);

  if (start === -1000) {
    start = 0;
    end = source.length;
  }
  if (start < 0) {
    start = source.length + start;
    if (start < 0) {
      start = 0;
    }
  }
  if (end < 0) {
    end = source.length + end;
    if (end < 0) {
      end = 0;
    }
  }
  if (start >= end) {
    return [];
  }
  return source.slice(start, end);
}

export function hasTemplateRangeConfig(rangeStart, rangeEnd) {
  return Number.isFinite(Number(rangeStart))
    || rangeEnd === "end"
    || Number.isFinite(Number(rangeEnd));
}

export function renderPromptMemoryContent(summaryItems) {
  const summaries = Array.isArray(summaryItems)
    ? summaryItems.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  return `<${MEMORY_PROMPT_TAG}>\n${summaries.join("\n\n")}\n</${MEMORY_PROMPT_TAG}>`;
}

export function resolveMemoryTemplateMessages(sourceMessages, summaryItems, rangeStart, rangeEnd) {
  const source = Array.isArray(sourceMessages)
    ? sourceMessages.filter((item) => item && typeof item === "object")
    : [];
  if (source.length === 0) {
    return {
      messages: [],
      skippedReason: "no_memory_data",
    };
  }

  const summaries = Array.isArray(summaryItems)
    ? summaryItems.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  if (!hasTemplateRangeConfig(rangeStart, rangeEnd) || summaries.length === 0) {
    return {
      messages: source,
    };
  }

  const slicedSummaries = normalizeTemplateRange(summaries, rangeStart, rangeEnd);
  if (slicedSummaries.length === 0) {
    return {
      messages: [],
      skippedReason: "memory_range_empty",
    };
  }

  const firstMessage = source[0] ?? {};
  return {
    messages: [{
      ...firstMessage,
      role: typeof firstMessage.role === "string" ? firstMessage.role : "system",
      content: renderPromptMemoryContent(slicedSummaries),
      memo: MEMORY_MESSAGE_MEMO,
    }],
  };
}
