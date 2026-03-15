import { describe, expect, it } from "vitest"

import { getPendingProposalSourceRange, mergeProposalStateWithCurrentState } from "./pendingProposal"

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
            characterBoundariesPreferences: [],
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
