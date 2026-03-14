export type CardExportFormat = "png" | "json" | "charx" | "charxJpeg";
export type CardExportScope = "character" | "preset" | "module";

export interface CardExportSelection {
  format: CardExportFormat;
  includeChats: boolean;
  includeMemories: boolean;
  includeEvolution: boolean;
  cancelled: boolean;
}

const CHARACTER_FORMATS = new Set<CardExportFormat>(["png", "json", "charx", "charxJpeg"]);

export function normalizeCardExportSelection(
  raw: Partial<CardExportSelection> | null | undefined,
  scope: CardExportScope = "character",
): CardExportSelection {
  const format = CHARACTER_FORMATS.has(raw?.format as CardExportFormat)
    ? (raw?.format as CardExportFormat)
    : scope === "character"
      ? "json"
      : "json";
  const allowBundle = scope === "character" && format === "json";
  const includeChats = allowBundle && raw?.includeChats === true;

  return {
    format,
    includeChats,
    includeMemories: includeChats && raw?.includeMemories === true,
    includeEvolution: allowBundle && raw?.includeEvolution === true,
    cancelled: raw?.cancelled === true,
  };
}
