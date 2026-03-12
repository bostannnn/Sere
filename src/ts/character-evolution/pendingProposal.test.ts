import { describe, expect, it } from "vitest"

import { getPendingProposalSourceRange } from "./pendingProposal"

describe("pending proposal source range", () => {
    it("returns the stored source range when present", () => {
        expect(getPendingProposalSourceRange({
            proposalId: "proposal-1",
            sourceChatId: "chat-1",
            sourceRange: {
                chatId: "chat-1",
                startMessageIndex: 2,
                endMessageIndex: 4,
            },
            proposedState: {} as never,
            changes: [],
            createdAt: 10,
        })).toEqual({
            chatId: "chat-1",
            startMessageIndex: 2,
            endMessageIndex: 4,
        })
    })

    it("returns null for legacy proposals without sourceRange", () => {
        expect(getPendingProposalSourceRange({
            proposalId: "proposal-1",
            sourceChatId: "chat-1",
            proposedState: {} as never,
            changes: [],
            createdAt: 10,
        })).toBeNull()
    })
})
