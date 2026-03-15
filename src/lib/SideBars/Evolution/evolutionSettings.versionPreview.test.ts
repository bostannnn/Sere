import { describe, expect, it } from "vitest"

import {
    buildClearCoveragePreview,
    buildDeleteVersionPreview,
    buildRevertVersionPreview,
} from "./evolutionSettings.versionPreview"

const versions = [
    { version: 1, chatId: "chat-a", acceptedAt: 1, range: { chatId: "chat-a", startMessageIndex: 0, endMessageIndex: 9 } },
    { version: 2, chatId: "chat-a", acceptedAt: 2, range: { chatId: "chat-a", startMessageIndex: 10, endMessageIndex: 19 } },
    { version: 3, chatId: "chat-a", acceptedAt: 3, range: { chatId: "chat-a", startMessageIndex: 20, endMessageIndex: 29 } },
]

describe("evolution settings version previews", () => {
    it("builds clear-coverage preview with invalidated versions and restore target", () => {
        const result = buildClearCoveragePreview({
            versions,
            targetVersion: 2,
            range: { chatId: "chat-a", startMessageIndex: 10, endMessageIndex: 19 },
            pendingProposal: {
                proposalId: "proposal-1",
                sourceChatId: "chat-a",
                proposedState: {},
                changes: [],
                createdAt: 1,
            },
        })

        expect(result.preview).toEqual({
            invalidatedVersions: [3, 2],
            restoreVersion: 1,
            clearsPendingProposal: true,
        })
        expect(result.summary).toContain("messages 11-20")
        expect(result.summary).toContain("Invalidate versions: v3, v2")
        expect(result.summary).toContain("pending proposal")
    })

    it("builds revert preview for later versions only", () => {
        const result = buildRevertVersionPreview({
            versions,
            targetVersion: 2,
            pendingProposal: null,
        })

        expect(result.preview).toEqual({
            invalidatedVersions: [3],
            restoreVersion: 2,
            clearsPendingProposal: false,
        })
        expect(result.summary).toContain("Revert current state to v2")
        expect(result.summary).toContain("Invalidate later versions: v3")
    })

    it("builds delete preview differently for latest and interior versions", () => {
        const latest = buildDeleteVersionPreview({
            versions,
            targetVersion: 3,
            pendingProposal: null,
        })
        const interior = buildDeleteVersionPreview({
            versions,
            targetVersion: 2,
            pendingProposal: null,
        })

        expect(latest.preview).toEqual({
            invalidatedVersions: [3],
            restoreVersion: 2,
            clearsPendingProposal: false,
        })
        expect(latest.summary).toContain("Delete latest version v3")

        expect(interior.preview).toEqual({
            invalidatedVersions: [3, 2],
            restoreVersion: 1,
            clearsPendingProposal: false,
        })
        expect(interior.summary).toContain("roll back from that point")
        expect(interior.summary).toContain("Invalidate versions: v3, v2")
    })
})
