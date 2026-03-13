export type ProposalDiffStatus = "unchanged" | "changed" | "added" | "removed";

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
