import { describe, expect, it } from "vitest"

import { applyCharacterEvolutionItemMetadata, mergeAcceptedCharacterEvolutionState } from "./items"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution special paths", () => {
    it("updates source metadata when a match is reinforced", () => {
        const baseState = createDefaultCharacterEvolutionState()
        baseState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "suspected",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "likely",
                note: "repeated in a later range",
            },
        ]

        const proposedState = applyCharacterEvolutionItemMetadata({
            state: acceptedDraft,
            baseState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 5,
                endMessageIndex: 9,
            },
            timestamp: 200,
            overwriteNewItemTimestamps: true,
        })

        const merged = mergeAcceptedCharacterEvolutionState({
            currentState: baseState,
            proposedState,
        })
        const { applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs, mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const proposedStateCjs = applyCharacterEvolutionItemMetadataCjs({
            state: acceptedDraft,
            baseState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 5,
                endMessageIndex: 9,
            },
            timestamp: 200,
            overwriteNewItemTimestamps: true,
        })
        const mergedCjs = mergeAcceptedCharacterEvolutionStateCjs({
            currentState: baseState,
            proposedState: proposedStateCjs,
        })

        expect(merged.characterLikes).toEqual([
            {
                value: "Tea",
                status: "active",
                confidence: "likely",
                note: "repeated in a later range",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 9,
                },
                updatedAt: 200,
                lastSeenAt: 200,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("keeps relationship and lastInteractionEnded on their object-section path while matching item sections", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.relationship = {
            trustLevel: "steady",
            dynamic: "warm but guarded",
        }
        currentState.lastInteractionEnded = {
            state: "tentative",
            residue: "the station plan is unresolved",
        }
        currentState.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                confidence: "suspected",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.relationship = {
            trustLevel: "higher",
            dynamic: "more openly affectionate",
        }
        proposedState.lastInteractionEnded = {
            state: "hopeful",
            residue: "they left with a clearer plan to reconnect",
        }
        proposedState.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                note: "reconfirmed in the latest range",
                updatedAt: 220,
                lastSeenAt: 220,
            },
        ]

        const merged = mergeAcceptedCharacterEvolutionState({
            currentState,
            proposedState,
        })
        const { mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const mergedCjs = mergeAcceptedCharacterEvolutionStateCjs({
            currentState,
            proposedState,
        })

        expect(merged.relationship).toEqual({
            trustLevel: "higher",
            dynamic: "more openly affectionate",
        })
        expect(merged.lastInteractionEnded).toEqual({
            state: "hopeful",
            residue: "they left with a clearer plan to reconnect",
        })
        expect(merged.activeThreads).toEqual([
            {
                value: "meet again at the station",
                status: "active",
                confidence: "likely",
                note: "reconfirmed in the latest range",
                updatedAt: 220,
                lastSeenAt: 220,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })
})
