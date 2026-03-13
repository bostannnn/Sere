import { describe, expect, it } from "vitest";
import {
    formatCharacterEvolutionItemTimestamp,
    getCharacterEvolutionItemMetadataRows,
} from "./itemMetadata";

describe("character evolution item metadata", () => {
    it("formats timestamps into a compact UTC label", () => {
        expect(formatCharacterEvolutionItemTimestamp(0)).toBe("1970-01-01 00:00:00 UTC");
        expect(formatCharacterEvolutionItemTimestamp(undefined)).toBeNull();
    });

    it("returns only collected metadata rows", () => {
        expect(getCharacterEvolutionItemMetadataRows({
            value: "Texas Chain Saw",
            sourceChatId: "chat-1",
            sourceRange: {
                startMessageIndex: 12,
                endMessageIndex: 15,
            },
            updatedAt: 42,
            lastSeenAt: 45,
            timesSeen: 3,
        })).toEqual([
            { label: "Source chat", value: "chat-1" },
            { label: "Source range", value: "12..15" },
            { label: "Updated", value: "1970-01-01 00:00:00.042 UTC", detail: "Epoch 42" },
            { label: "Last seen", value: "1970-01-01 00:00:00.045 UTC", detail: "Epoch 45" },
            { label: "Times seen", value: "3" },
        ]);
    });

    it("skips absent metadata fields", () => {
        expect(getCharacterEvolutionItemMetadataRows({
            value: "Dead Man",
            note: "black-and-white poetry",
            status: "active",
        })).toEqual([]);
    });
});
