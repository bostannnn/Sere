import { describe, expect, it } from "vitest"

import { applyCharacterEvolutionItemMetadata, mergeAcceptedCharacterEvolutionState } from "./items"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution item retention", () => {
    it("does not increment timesSeen or confidence for unchanged active items copied forward in the full proposal state", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "suspected",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "suspected",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 8,
                },
                updatedAt: 200,
                lastSeenAt: 200,
                timesSeen: 1,
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

        expect(merged.characterLikes).toEqual([
            {
                value: "Tea",
                status: "active",
                confidence: "suspected",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("preserves unmatched archived items when merging an active-only accepted proposal", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Stalker",
                status: "active",
            },
            {
                value: "Dead Man",
                status: "archived",
                sourceChatId: "chat-1",
            },
            {
                value: "Texas Chain Saw",
                status: "active",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "Stalker",
                status: "active",
            },
            {
                value: "Texas Chain Saw",
                status: "active",
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

        expect(merged.characterLikes).toEqual([
            {
                value: "Stalker",
                status: "active",
            },
            {
                value: "Dead Man",
                status: "archived",
                sourceChatId: "chat-1",
            },
            {
                value: "Texas Chain Saw",
                status: "active",
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("revives a matching archived item instead of keeping both archived and active copies", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Dead Man",
                status: "archived",
                sourceChatId: "chat-1",
                confidence: "likely",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "dead-man",
                status: "active",
                note: "brought back into current taste",
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

        expect(merged.characterLikes).toEqual([
            {
                value: "dead-man",
                status: "active",
                confidence: "confirmed",
                note: "brought back into current taste",
                sourceChatId: "chat-1",
                updatedAt: 220,
                lastSeenAt: 220,
                timesSeen: 3,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("preserves same-value archived history when a current active item with that value remains live", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Dead Man",
                status: "archived",
                note: "older archived formulation",
            },
            {
                value: "Dead Man",
                status: "active",
                note: "current live formulation",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "Dead Man",
                status: "active",
                note: "current live formulation updated",
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

        expect(merged.characterLikes).toEqual([
            {
                value: "Dead Man",
                status: "archived",
                note: "older archived formulation",
            },
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                note: "current live formulation updated",
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("preserves same-value corrected history when a current active item with that value remains live", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "user hates ferries",
                status: "corrected",
                note: "older corrected formulation",
            },
            {
                value: "user hates ferries",
                status: "active",
                note: "current live formulation",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.activeThreads = [
            {
                value: "user hates ferries",
                status: "active",
                note: "current live formulation updated",
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

        expect(merged.activeThreads).toEqual([
            {
                value: "user hates ferries",
                status: "corrected",
                note: "older corrected formulation",
            },
            {
                value: "user hates ferries",
                status: "active",
                confidence: "likely",
                note: "current live formulation updated",
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

})
