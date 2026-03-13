import { describe, expect, it } from "vitest";
import {
    countHiddenUnchangedRows,
    createDismissedAddedRow,
    buildDismissedRowKey,
    buildIndexedRowKey,
    buildProposalSectionScopeKey,
    getProposalRowBadgeVariant,
    getProposalRowContainerVariant,
    getProposalRowStatusLabel,
    matchFactItemsByValue,
    mergeProposalDisplayRows,
    shouldResetProposalSectionTransientState,
    upsertDismissedAddedRow,
} from "./proposalSectionCompare.helpers";

describe("proposal section compare helpers", () => {
    it("keeps row keys stable when a changed row is reverted", () => {
        expect(buildIndexedRowKey("string", 0, 0)).toBe("string:current:0");
        expect(buildIndexedRowKey("fact", 2, 2)).toBe("fact:current:2");
    });

    it("keeps row keys stable when a removed row is restored", () => {
        const removedKey = buildIndexedRowKey("string", 1, null);
        const restoredKey = buildIndexedRowKey("string", 1, 1);

        expect(removedKey).toBe("string:current:1");
        expect(restoredKey).toBe("string:current:1");
    });

    it("gives dismissed additions their own transient key space", () => {
        const liveKey = buildIndexedRowKey("fact", null, 3);
        const dismissedKey = buildDismissedRowKey(liveKey);

        expect(liveKey).toBe("fact:proposed:3");
        expect(dismissedKey).toBe("dismissed:fact:proposed:3");
    });

    it("scopes transient state by proposal id and section key", () => {
        expect(buildProposalSectionScopeKey("proposal-a", "activeThreads")).toBe("proposal-a:activeThreads");
        expect(buildProposalSectionScopeKey("proposal-b", "activeThreads")).toBe("proposal-b:activeThreads");
        expect(buildProposalSectionScopeKey(null, "activeThreads")).toBe("none:activeThreads");
    });

    it("only resets transient review state when the proposal scope changes", () => {
        expect(shouldResetProposalSectionTransientState(null, "proposal-a:activeThreads")).toBe(true);
        expect(shouldResetProposalSectionTransientState("proposal-a:activeThreads", "proposal-a:activeThreads")).toBe(false);
        expect(shouldResetProposalSectionTransientState("proposal-a:activeThreads", "proposal-b:activeThreads")).toBe(true);
    });

    it("preserves added status for discarded additions while showing a discarded label", () => {
        const row = createDismissedAddedRow(
            {
                cacheKey: "fact:proposed:3",
                status: "added" as const,
                proposedIndex: 3,
                proposedValue: "new",
            },
            {
                proposedIndex: null,
                proposedValue: "",
            },
        );

        expect(row.cacheKey).toBe("dismissed:fact:proposed:3");
        expect(row.status).toBe("added");
        expect(row.dismissed).toBe(true);
        expect(getProposalRowStatusLabel(row.status, row.dismissed)).toBe("Discarded");
    });

    it("replaces an existing dismissed row when the same live row is discarded again", () => {
        const first = upsertDismissedAddedRow(
            [],
            {
                cacheKey: "string:proposed:2",
                status: "added" as const,
                proposedIndex: 2,
                proposedValue: "first",
            },
            {
                proposedIndex: null,
                proposedValue: "",
            },
        );

        const second = upsertDismissedAddedRow(
            first,
            {
                cacheKey: "string:proposed:2",
                status: "added" as const,
                proposedIndex: 2,
                proposedValue: "second",
            },
            {
                proposedIndex: null,
                proposedValue: "",
            },
        );

        expect(second).toHaveLength(1);
        expect(second[0].cacheKey).toBe("dismissed:string:proposed:2");
    });

    it("counts only unchanged rows that are still hidden", () => {
        expect(countHiddenUnchangedRows([
            { status: "unchanged" as const, forceVisible: false },
            { status: "unchanged" as const, forceVisible: true },
            { status: "changed" as const, forceVisible: false },
        ])).toBe(1);
    });

    it("uses a neutral badge variant for dismissed rows", () => {
        expect(getProposalRowBadgeVariant("added", true)).toBe("dismissed");
        expect(getProposalRowBadgeVariant("removed", false)).toBe("removed");
    });

    it("uses a neutral container variant for dismissed rows", () => {
        expect(getProposalRowContainerVariant("added", true)).toBe("dismissed");
        expect(getProposalRowContainerVariant("changed", false)).toBe("changed");
    });

    it("keeps dismissed rows in their original index position when merged for display", () => {
        const merged = mergeProposalDisplayRows(
            [
                { currentIndex: 0, proposedIndex: 0, dismissed: false, cacheKey: "live-0" },
                { currentIndex: 1, proposedIndex: 1, dismissed: false, cacheKey: "live-1" },
                { currentIndex: 2, proposedIndex: 2, dismissed: false, cacheKey: "live-2" },
            ],
            [
                { currentIndex: null, proposedIndex: 1, dismissed: true, cacheKey: "dismissed-1" },
            ],
        );

        expect(merged.map((row) => row.cacheKey)).toEqual([
            "live-0",
            "dismissed-1",
            "live-1",
            "live-2",
        ]);
    });

    it("matches fact rows by normalized value instead of array position", () => {
        const rows = matchFactItemsByValue(
            [
                { value: "Stalker", confidence: "confirmed", status: "active", note: "" },
                { value: "Dead Man", confidence: "confirmed", status: "archived", note: "" },
                { value: "Texas Chain Saw", confidence: "confirmed", status: "active", note: "" },
            ],
            [
                { value: "Stalker", confidence: "confirmed", status: "active", note: "" },
                { value: "Texas Chain Saw", confidence: "confirmed", status: "active", note: "updated" },
            ],
        );

        expect(rows).toEqual([
            {
                currentIndex: 0,
                proposedIndex: 0,
                currentItem: { value: "Stalker", confidence: "confirmed", status: "active", note: "" },
                proposedItem: { value: "Stalker", confidence: "confirmed", status: "active", note: "" },
            },
            {
                currentIndex: 1,
                proposedIndex: null,
                currentItem: { value: "Dead Man", confidence: "confirmed", status: "archived", note: "" },
                proposedItem: null,
            },
            {
                currentIndex: 2,
                proposedIndex: 1,
                currentItem: { value: "Texas Chain Saw", confidence: "confirmed", status: "active", note: "" },
                proposedItem: { value: "Texas Chain Saw", confidence: "confirmed", status: "active", note: "updated" },
            },
        ]);
    });

    it("falls back to positional pairing for unmatched fact rows so value edits stay editable", () => {
        const rows = matchFactItemsByValue(
            [
                { value: "Coffee", confidence: "likely", status: "active", note: "old note" },
            ],
            [
                { value: "Dark coffee", confidence: "likely", status: "active", note: "new note" },
            ],
        );

        expect(rows).toEqual([
            {
                currentIndex: 0,
                proposedIndex: 0,
                currentItem: { value: "Coffee", confidence: "likely", status: "active", note: "old note" },
                proposedItem: { value: "Dark coffee", confidence: "likely", status: "active", note: "new note" },
            },
        ]);
    });
});
