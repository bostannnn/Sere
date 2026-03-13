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

    it("preserves an explicit matched archived edit instead of forcing the item back to active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.runningJokes = [
            {
                value: "the cursed teacup",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 1,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.runningJokes = [
            {
                value: "the cursed teacup",
                status: "archived",
                note: "resolved and no longer current",
            },
        ]
        const proposedState = applyCharacterEvolutionItemMetadata({
            state: acceptedDraft,
            baseState: currentState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 5,
                endMessageIndex: 8,
            },
            timestamp: 220,
            overwriteNewItemTimestamps: true,
        })

        const merged = mergeAcceptedCharacterEvolutionState({
            currentState,
            proposedState,
        })
        const { applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs, mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const proposedStateCjs = applyCharacterEvolutionItemMetadataCjs({
            state: acceptedDraft,
            baseState: currentState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 5,
                endMessageIndex: 8,
            },
            timestamp: 220,
            overwriteNewItemTimestamps: true,
        })
        const mergedCjs = mergeAcceptedCharacterEvolutionStateCjs({
            currentState,
            proposedState: proposedStateCjs,
        })

        expect(merged.runningJokes).toEqual([
            {
                value: "the cursed teacup",
                status: "archived",
                confidence: "likely",
                note: "resolved and no longer current",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 1,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("preserves an explicit matched corrected edit instead of forcing the item back to active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "user lives in Seattle",
                status: "active",
                confidence: "confirmed",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 4,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.userFacts = [
            {
                value: "user lives in Seattle",
                status: "corrected",
                note: "superseded by a newer clarification",
            },
        ]
        const proposedState = applyCharacterEvolutionItemMetadata({
            state: acceptedDraft,
            baseState: currentState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 6,
                endMessageIndex: 9,
            },
            timestamp: 220,
            overwriteNewItemTimestamps: true,
        })

        const merged = mergeAcceptedCharacterEvolutionState({
            currentState,
            proposedState,
        })
        const { applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs, mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const proposedStateCjs = applyCharacterEvolutionItemMetadataCjs({
            state: acceptedDraft,
            baseState: currentState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 6,
                endMessageIndex: 9,
            },
            timestamp: 220,
            overwriteNewItemTimestamps: true,
        })
        const mergedCjs = mergeAcceptedCharacterEvolutionStateCjs({
            currentState,
            proposedState: proposedStateCjs,
        })

        expect(merged.userFacts).toEqual([
            {
                value: "user lives in Seattle",
                status: "corrected",
                confidence: "confirmed",
                note: "superseded by a newer clarification",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 4,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })
})
