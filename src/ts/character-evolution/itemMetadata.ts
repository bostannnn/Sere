import type { CharacterEvolutionItem } from "../storage/database.types";

export interface CharacterEvolutionItemMetadataRow {
    label: string;
    value: string;
    detail?: string;
}

export function formatCharacterEvolutionItemTimestamp(timestamp: number | null | undefined): string | null {
    if (!Number.isFinite(Number(timestamp))) {
        return null;
    }

    const numericTimestamp = Number(timestamp);
    const date = new Date(numericTimestamp);
    if (Number.isNaN(date.getTime())) {
        return String(numericTimestamp);
    }

    return date.toISOString().replace("T", " ").replace(".000Z", " UTC").replace("Z", " UTC");
}

export function getCharacterEvolutionItemMetadataRows(
    item: CharacterEvolutionItem | null | undefined,
): CharacterEvolutionItemMetadataRow[] {
    const rows: CharacterEvolutionItemMetadataRow[] = [];

    if (typeof item?.sourceChatId === "string" && item.sourceChatId.trim()) {
        rows.push({
            label: "Source chat",
            value: item.sourceChatId.trim(),
        });
    }

    if (
        Number.isFinite(Number(item?.sourceRange?.startMessageIndex))
        && Number.isFinite(Number(item?.sourceRange?.endMessageIndex))
    ) {
        rows.push({
            label: "Source range",
            value: `${Number(item?.sourceRange?.startMessageIndex)}..${Number(item?.sourceRange?.endMessageIndex)}`,
        });
    }

    const updatedAt = formatCharacterEvolutionItemTimestamp(item?.updatedAt);
    if (updatedAt) {
        rows.push({
            label: "Updated",
            value: updatedAt,
            detail: `Epoch ${Number(item?.updatedAt)}`,
        });
    }

    const lastSeenAt = formatCharacterEvolutionItemTimestamp(item?.lastSeenAt);
    if (lastSeenAt) {
        rows.push({
            label: "Last seen",
            value: lastSeenAt,
            detail: `Epoch ${Number(item?.lastSeenAt)}`,
        });
    }

    if (Number.isFinite(Number(item?.timesSeen)) && Number(item?.timesSeen) > 0) {
        rows.push({
            label: "Times seen",
            value: String(Math.max(1, Math.floor(Number(item?.timesSeen)))),
        });
    }

    return rows;
}
