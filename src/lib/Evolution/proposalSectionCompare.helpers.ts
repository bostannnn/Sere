import type { CharacterEvolutionItem, CharacterEvolutionState } from "src/ts/storage/database.types";
import type { FactDiffRow, FieldDiffRow, StringDiffRow } from "./proposalSectionCompare.types";

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

export function normalizeProposalText(value: string | null | undefined) {
    return String(value ?? "").trim();
}

export function areProposalStringItemsEqual(left: string, right: string) {
    return normalizeProposalText(left) === normalizeProposalText(right);
}

export function normalizeProposalFactItem(item: CharacterEvolutionItem | null | undefined) {
    return {
        value: normalizeProposalText(item?.value),
        confidence: item?.confidence ?? "suspected",
        status: item?.status ?? "active",
        note: normalizeProposalText(item?.note),
    };
}

export function areProposalFactItemsEqual(left: CharacterEvolutionItem | null | undefined, right: CharacterEvolutionItem | null | undefined) {
    return JSON.stringify(normalizeProposalFactItem(left)) === JSON.stringify(normalizeProposalFactItem(right));
}

export function changedProposalFactFields(left: CharacterEvolutionItem | null | undefined, right: CharacterEvolutionItem | null | undefined) {
    const normalizedLeft = normalizeProposalFactItem(left);
    const normalizedRight = normalizeProposalFactItem(right);
    const fields: string[] = [];

    if (normalizedLeft.value !== normalizedRight.value) fields.push("text");
    if (normalizedLeft.confidence !== normalizedRight.confidence) fields.push("confidence");
    if (normalizedLeft.status !== normalizedRight.status) fields.push("status");
    if (normalizedLeft.note !== normalizedRight.note) fields.push("note");

    return fields;
}

export function sectionHasProposalItems(state: CharacterEvolutionState, key: keyof CharacterEvolutionState) {
    if (key === "relationship") {
        return Boolean(state.relationship.trustLevel || state.relationship.dynamic);
    }
    if (key === "lastInteractionEnded") {
        return Boolean(state.lastInteractionEnded.state || state.lastInteractionEnded.residue);
    }
    const sectionValue = state[key];
    return Array.isArray(sectionValue) ? sectionValue.length > 0 : false;
}

function factItemValueKeys(items: CharacterEvolutionItem[]) {
    return new Set(
        items
            .map((item) => normalizeProposalText(item?.value))
            .filter((value) => value.length > 0)
            .map((value) => value.toLowerCase()),
    );
}

export function reviewCurrentProposalFactItems(currentItems: CharacterEvolutionItem[], proposedItems: CharacterEvolutionItem[]) {
    const proposedValueKeys = factItemValueKeys(proposedItems);
    const activeCurrentValueKeys = factItemValueKeys(
        currentItems.filter((item) => (item?.status ?? "active") === "active"),
    );

    return currentItems.filter((item) => {
        const status = item?.status ?? "active";
        if (status === "active") {
            return true;
        }

        const valueKey = normalizeProposalText(item?.value).toLowerCase();
        if (valueKey.length === 0 || activeCurrentValueKeys.has(valueKey)) {
            return false;
        }

        return proposedValueKeys.has(valueKey);
    });
}

export function buildProposalStringDiffRows(
    currentItems: string[],
    proposedItems: string[],
    forceVisibleRowKeys: Record<string, true>,
): StringDiffRow[] {
    const rows: StringDiffRow[] = [];
    const totalRows = Math.max(currentItems.length, proposedItems.length);

    for (let index = 0; index < totalRows; index += 1) {
        const currentValue = currentItems[index];
        const proposedValue = proposedItems[index];
        const cacheKey = buildIndexedRowKey("string", currentValue !== undefined ? index : null, proposedValue !== undefined ? index : null);

        if (currentValue !== undefined && proposedValue !== undefined) {
            rows.push({
                cacheKey,
                status: areProposalStringItemsEqual(currentValue, proposedValue) ? "unchanged" : "changed",
                currentIndex: index,
                proposedIndex: index,
                currentValue,
                proposedValue,
                forceVisible: forceVisibleRowKeys[cacheKey] === true,
            });
            continue;
        }

        if (currentValue !== undefined) {
            rows.push({
                cacheKey,
                status: "removed",
                currentIndex: index,
                proposedIndex: null,
                currentValue,
                proposedValue: "",
                forceVisible: forceVisibleRowKeys[cacheKey] === true,
            });
            continue;
        }

        rows.push({
            cacheKey,
            status: "added",
            currentIndex: null,
            proposedIndex: index,
            currentValue: "",
            proposedValue: proposedValue ?? "",
            forceVisible: forceVisibleRowKeys[cacheKey] === true,
        });
    }

    return rows;
}

export function buildProposalFactDiffRows(
    currentItems: CharacterEvolutionItem[],
    proposedItems: CharacterEvolutionItem[],
    forceVisibleRowKeys: Record<string, true>,
): FactDiffRow[] {
    const rows: FactDiffRow[] = [];

    for (const pair of matchFactItemsByValue(currentItems, proposedItems)) {
        const currentItem = pair.currentItem;
        const proposedItem = pair.proposedItem;
        const cacheKey = buildIndexedRowKey("fact", pair.currentIndex, pair.proposedIndex);

        if (currentItem && proposedItem) {
            rows.push({
                cacheKey,
                status: areProposalFactItemsEqual(currentItem, proposedItem) ? "unchanged" : "changed",
                currentIndex: pair.currentIndex,
                proposedIndex: pair.proposedIndex,
                currentItem,
                proposedItem,
                changedFields: changedProposalFactFields(currentItem, proposedItem),
                forceVisible: forceVisibleRowKeys[cacheKey] === true,
            });
            continue;
        }

        if (currentItem) {
            rows.push({
                cacheKey,
                status: "removed",
                currentIndex: pair.currentIndex,
                proposedIndex: null,
                currentItem,
                proposedItem: null,
                changedFields: [],
                forceVisible: forceVisibleRowKeys[cacheKey] === true,
            });
            continue;
        }

        rows.push({
            cacheKey,
            status: "added",
            currentIndex: null,
            proposedIndex: pair.proposedIndex,
            currentItem: null,
            proposedItem: proposedItem ?? null,
            changedFields: [],
            forceVisible: forceVisibleRowKeys[cacheKey] === true,
        });
    }

    return rows;
}

export function buildProposalObjectRows(
    sectionKey: string,
    currentState: CharacterEvolutionState,
    proposedState: CharacterEvolutionState,
    forceVisibleRowKeys: Record<string, true>,
): FieldDiffRow[] {
    if (sectionKey === "relationship") {
        return [
            {
                cacheKey: "object:relationship:trustLevel",
                key: "trustLevel",
                label: "Trust level",
                status: areProposalStringItemsEqual(currentState.relationship.trustLevel, proposedState.relationship.trustLevel)
                    ? "unchanged"
                    : currentState.relationship.trustLevel && proposedState.relationship.trustLevel
                        ? "changed"
                        : proposedState.relationship.trustLevel
                            ? "added"
                            : "removed",
                currentValue: currentState.relationship.trustLevel,
                proposedValue: proposedState.relationship.trustLevel,
                forceVisible: forceVisibleRowKeys["object:relationship:trustLevel"] === true,
            },
            {
                cacheKey: "object:relationship:dynamic",
                key: "dynamic",
                label: "Dynamic",
                multiline: true,
                status: areProposalStringItemsEqual(currentState.relationship.dynamic, proposedState.relationship.dynamic)
                    ? "unchanged"
                    : currentState.relationship.dynamic && proposedState.relationship.dynamic
                        ? "changed"
                        : proposedState.relationship.dynamic
                            ? "added"
                            : "removed",
                currentValue: currentState.relationship.dynamic,
                proposedValue: proposedState.relationship.dynamic,
                forceVisible: forceVisibleRowKeys["object:relationship:dynamic"] === true,
            },
        ];
    }

    return [
        {
            cacheKey: "object:lastInteractionEnded:state",
            key: "state",
            label: "State",
            multiline: true,
            status: areProposalStringItemsEqual(currentState.lastInteractionEnded.state, proposedState.lastInteractionEnded.state)
                ? "unchanged"
                : currentState.lastInteractionEnded.state && proposedState.lastInteractionEnded.state
                    ? "changed"
                    : proposedState.lastInteractionEnded.state
                        ? "added"
                        : "removed",
            currentValue: currentState.lastInteractionEnded.state,
            proposedValue: proposedState.lastInteractionEnded.state,
            forceVisible: forceVisibleRowKeys["object:lastInteractionEnded:state"] === true,
        },
        {
            cacheKey: "object:lastInteractionEnded:residue",
            key: "residue",
            label: "Residue",
            multiline: true,
            status: areProposalStringItemsEqual(currentState.lastInteractionEnded.residue, proposedState.lastInteractionEnded.residue)
                ? "unchanged"
                : currentState.lastInteractionEnded.residue && proposedState.lastInteractionEnded.residue
                    ? "changed"
                    : proposedState.lastInteractionEnded.residue
                        ? "added"
                        : "removed",
            currentValue: currentState.lastInteractionEnded.residue,
            proposedValue: proposedState.lastInteractionEnded.residue,
            forceVisible: forceVisibleRowKeys["object:lastInteractionEnded:residue"] === true,
        },
    ];
}
