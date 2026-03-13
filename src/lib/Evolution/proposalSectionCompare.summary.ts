import type { DiffStatus, FactDiffRow, StringDiffRow } from "./proposalSectionCompare.types";

export function countProposalRowsWithStatus(rows: Array<{ status: DiffStatus }>, status: DiffStatus) {
    return rows.filter((row) => row.status === status).length;
}

export function diffProposalRowLabel(
    row: StringDiffRow | FactDiffRow,
    isStringSection: boolean,
) {
    const currentOrdinal = row.currentIndex === null ? null : row.currentIndex + 1;
    const proposedOrdinal = row.proposedIndex === null ? null : row.proposedIndex + 1;

    if (isStringSection) {
        const ordinal = row.proposedIndex ?? row.currentIndex;
        return row.status === "added" ? `New line${ordinal === null ? "" : ` ${ordinal + 1}`}` : `Line${ordinal === null ? "" : ` ${ordinal + 1}`}`;
    }

    if (row.status === "added") return `New item${proposedOrdinal === null ? "" : ` ${proposedOrdinal}`}`;
    if (row.status === "removed") return `Item${currentOrdinal === null ? "" : ` ${currentOrdinal}`}`;
    if (currentOrdinal !== null && proposedOrdinal !== null && currentOrdinal !== proposedOrdinal) {
        return `Item ${currentOrdinal} -> ${proposedOrdinal}`;
    }

    return `Item${currentOrdinal === null ? proposedOrdinal === null ? "" : ` ${proposedOrdinal}` : ` ${currentOrdinal}`}`;
}

export function proposalRowDiscardLabel(status: DiffStatus) {
    return status === "added" ? "Discard addition" : "Revert change";
}

export function proposalSectionChangeSummary(changedCount: number, addedCount: number, removedCount: number) {
    const summary: string[] = [];
    if (changedCount > 0) summary.push(`${changedCount} changed`);
    if (addedCount > 0) summary.push(`${addedCount} added`);
    if (removedCount > 0) summary.push(`${removedCount} removed`);
    return summary.join(" · ");
}

export function changedProposalFieldSummary(fields: string[]) {
    return fields.length === 0 ? "" : `Edited: ${fields.join(", ")}`;
}
