import { describe, expect, it } from "vitest"

import {
    getPendingProposalSourceRange,
    mergeProposalStateWithCurrentState,
    rebasePendingProposalAfterMessageDeletion,
} from "./pendingProposal"

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

    it("shifts a pending proposal range left when deleting earlier messages in the same chat", () => {
        expect(rebasePendingProposalAfterMessageDeletion({
            proposalId: "proposal-1",
            sourceChatId: "chat-1",
            sourceRange: {
                chatId: "chat-1",
                startMessageIndex: 4,
                endMessageIndex: 6,
            },
            proposedState: {} as never,
            changes: [],
            createdAt: 10,
        }, "chat-1", 1, 2)).toMatchObject({
            sourceRange: {
                chatId: "chat-1",
                startMessageIndex: 2,
                endMessageIndex: 4,
            },
        })
    })

    it("invalidates a pending proposal when a covered message is deleted", () => {
        expect(rebasePendingProposalAfterMessageDeletion({
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
        }, "chat-1", 3, 3)).toBeNull()
    })

    it("invalidates legacy proposals without sourceRange when their source chat changes", () => {
        expect(rebasePendingProposalAfterMessageDeletion({
            proposalId: "proposal-1",
            sourceChatId: "chat-1",
            proposedState: {} as never,
            changes: [],
            createdAt: 10,
        }, "chat-1", 0, 0)).toBeNull()
    })

    it("preserves current relationship trustLevel when a proposal only updates dynamic", () => {
        const merged = mergeProposalStateWithCurrentState({
            relationship: {
                dynamic: "warmer and more trusting",
            },
        }, {
            relationship: {
                trustLevel: "high",
                dynamic: "warm",
            },
            activeThreads: [],
            runningJokes: [],
            characterLikes: [],
            characterDislikes: [],
            characterHabits: [],
            userFacts: [],
            userRead: [],
            userLikes: [],
            userDislikes: [],
            lastInteractionEnded: {
                state: "",
                residue: "",
            },
            keyMoments: [],
            characterIntimatePreferences: [],
            userIntimatePreferences: [],
        })

        expect(merged.relationship).toEqual({
            trustLevel: "high",
            dynamic: "warmer and more trusting",
        })
    })
})
