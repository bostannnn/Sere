import type { CharacterEvolutionItem } from "src/ts/storage/database.types";

export type ProposalDiffStatus = "unchanged" | "changed" | "added" | "removed";

export interface MatchedFactPair {
    currentIndex: number | null;
    proposedIndex: number | null;
    currentItem: CharacterEvolutionItem | null;
    proposedItem: CharacterEvolutionItem | null;
}

export function buildIndexedRowKey(
    kind: "string" | "fact",
    currentIndex: number | null,
    proposedIndex: number | null,
): string {
    if (currentIndex !== null) {
        return `${kind}:current:${currentIndex}`;
    }

    if (proposedIndex !== null) {
        return `${kind}:proposed:${proposedIndex}`;
    }

    return `${kind}:unknown`;
}

export function buildDismissedRowKey(cacheKey: string): string {
    return `dismissed:${cacheKey}`;
}

export function buildProposalSectionScopeKey(
    proposalId: string | null | undefined,
    sectionKey: string,
): string {
    return `${proposalId ?? "none"}:${sectionKey}`;
}

export function shouldResetProposalSectionTransientState(
    previousScopeKey: string | null,
    nextScopeKey: string,
): boolean {
    return previousScopeKey !== nextScopeKey;
}

export function getProposalRowStatusLabel(status: ProposalDiffStatus, dismissed = false): string {
    if (dismissed) {
        return "Discarded";
    }

    if (status === "added") return "Added";
    if (status === "removed") return "Removed";
    if (status === "changed") return "Changed";
    return "Unchanged";
}

export function createDismissedAddedRow<T extends { cacheKey: string }>(
    row: T,
    overrides: Partial<T>,
) {
    return {
        ...row,
        ...overrides,
        cacheKey: buildDismissedRowKey(row.cacheKey),
        status: "added" as const,
        forceVisible: true as const,
        dismissed: true as const,
    };
}

export function upsertDismissedAddedRow<T extends { cacheKey: string }>(
    existingRows: T[],
    row: T,
    overrides: Partial<T>,
) {
    const dismissedCacheKey = buildDismissedRowKey(row.cacheKey);

    return [
        ...existingRows.filter((entry) => entry.cacheKey !== row.cacheKey && entry.cacheKey !== dismissedCacheKey),
        createDismissedAddedRow(row, overrides),
    ];
}

export function countHiddenUnchangedRows<T extends { status: ProposalDiffStatus; forceVisible?: boolean }>(
    rows: T[],
): number {
    return rows.filter((row) => row.status === "unchanged" && !row.forceVisible).length;
}

export function getProposalRowBadgeVariant(
    status: ProposalDiffStatus,
    dismissed = false,
): ProposalDiffStatus | "dismissed" {
    return dismissed ? "dismissed" : status;
}

export function getProposalRowContainerVariant(
    status: ProposalDiffStatus,
    dismissed = false,
): ProposalDiffStatus | "dismissed" {
    return dismissed ? "dismissed" : status;
}

export function mergeProposalDisplayRows<
    T extends {
        currentIndex: number | null;
        proposedIndex: number | null;
        dismissed?: boolean;
    },
>(
    liveRows: T[],
    dismissedRows: T[],
): T[] {
    return [...liveRows, ...dismissedRows].sort((left, right) => {
        const leftOrder = left.proposedIndex ?? left.currentIndex ?? Number.MAX_SAFE_INTEGER;
        const rightOrder = right.proposedIndex ?? right.currentIndex ?? Number.MAX_SAFE_INTEGER;

        if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder;
        }

        if (!!left.dismissed !== !!right.dismissed) {
            return left.dismissed ? -1 : 1;
        }

        return 0;
    });
}

function normalizeFactMatchValue(item: CharacterEvolutionItem | null | undefined): string {
    return String(item?.value ?? "").trim();
}

export function matchFactItemsByValue(
    currentItems: CharacterEvolutionItem[],
    proposedItems: CharacterEvolutionItem[],
): MatchedFactPair[] {
    const matchedProposedIndexes = new Set<number>();
    const matchedCurrentIndexes = new Set<number>();
    const proposedIndexesByValue = new Map<string, number[]>();

    proposedItems.forEach((item, index) => {
        const matchValue = normalizeFactMatchValue(item);
        if (!matchValue) {
            return;
        }

        const bucket = proposedIndexesByValue.get(matchValue) ?? [];
        bucket.push(index);
        proposedIndexesByValue.set(matchValue, bucket);
    });

    const rows: MatchedFactPair[] = [];

    currentItems.forEach((currentItem, currentIndex) => {
        const matchValue = normalizeFactMatchValue(currentItem);
        const bucket = matchValue ? proposedIndexesByValue.get(matchValue) ?? [] : [];
        let proposedIndex: number | null = null;

        while (bucket.length > 0) {
            const candidateIndex = bucket.shift();
            if (candidateIndex === undefined || matchedProposedIndexes.has(candidateIndex)) {
                continue;
            }

            proposedIndex = candidateIndex;
            matchedProposedIndexes.add(candidateIndex);
            break;
        }

        if (proposedIndex !== null) {
            matchedCurrentIndexes.add(currentIndex);
        }

        rows.push({
            currentIndex,
            proposedIndex,
            currentItem,
            proposedItem: proposedIndex === null ? null : proposedItems[proposedIndex] ?? null,
        });
    });

    const unmatchedCurrentIndexes = currentItems
        .map((_, index) => index)
        .filter((index) => !matchedCurrentIndexes.has(index));
    const unmatchedProposedIndexes = proposedItems
        .map((_, index) => index)
        .filter((index) => !matchedProposedIndexes.has(index));
    const fallbackPairCount = Math.min(unmatchedCurrentIndexes.length, unmatchedProposedIndexes.length);

    for (let offset = 0; offset < fallbackPairCount; offset += 1) {
        const currentIndex = unmatchedCurrentIndexes[offset];
        const proposedIndex = unmatchedProposedIndexes[offset];
        const row = rows.find((entry) => entry.currentIndex === currentIndex);

        if (!row) {
            continue;
        }

        row.proposedIndex = proposedIndex;
        row.proposedItem = proposedItems[proposedIndex] ?? null;
        matchedProposedIndexes.add(proposedIndex);
    }

    proposedItems.forEach((proposedItem, proposedIndex) => {
        if (matchedProposedIndexes.has(proposedIndex)) {
            return;
        }

        rows.push({
            currentIndex: null,
            proposedIndex,
            currentItem: null,
            proposedItem,
        });
    });

    return rows;
}
