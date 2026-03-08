export function buildCharacterRagPayload(charRagSettings?: {
  enabled?: unknown;
  enabledRulebooks?: unknown;
} | null) {
  if (!charRagSettings || typeof charRagSettings !== "object") {
    return undefined;
  }

  return {
    enabled: charRagSettings.enabled === true,
    enabledRulebooks: Array.isArray(charRagSettings.enabledRulebooks)
      ? charRagSettings.enabledRulebooks.filter((id): id is string => typeof id === "string")
      : [],
  };
}

export function buildGlobalRagPayload(globalRagSettings?: {
  topK?: unknown;
  minScore?: unknown;
  budget?: unknown;
  model?: unknown;
} | null) {
  if (!globalRagSettings || typeof globalRagSettings !== "object") {
    return undefined;
  }

  return {
    topK: globalRagSettings.topK,
    minScore: globalRagSettings.minScore,
    budget: globalRagSettings.budget,
    model: globalRagSettings.model,
  };
}
