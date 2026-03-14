import { describe, expect, it } from "vitest"

import { mergeAcceptedCharacterEvolutionState } from "./items"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution item matching", () => {
    it("upgrades an existing active item on exact match instead of duplicating it", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                confidence: "suspected",
                sourceChatId: "chat-1",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                note: "reconfirmed in the latest range",
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

        expect(merged.activeThreads).toEqual([
            {
                value: "meet again at the station",
                status: "active",
                confidence: "likely",
                note: "reconfirmed in the latest range",
                sourceChatId: "chat-1",
                updatedAt: 200,
                lastSeenAt: 200,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("upgrades an existing active item on normalized match instead of duplicating it when evidence is repeated", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                updatedAt: 120,
                lastSeenAt: 120,
                timesSeen: 2,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "dead-man!",
                status: "active",
                note: "reconfirmed in the later range",
                updatedAt: 240,
                lastSeenAt: 240,
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
                value: "dead-man!",
                status: "active",
                confidence: "confirmed",
                note: "reconfirmed in the later range",
                updatedAt: 240,
                lastSeenAt: 240,
                timesSeen: 3,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("dedupes normalized formatting-only matches without counting them as repeat evidence", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 5,
                },
                updatedAt: 120,
                lastSeenAt: 120,
                lastSeenVersion: 1,
                timesSeen: 2,
                unseenAcceptedHandoffs: 1,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "dead-man!",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 6,
                    endMessageIndex: 9,
                },
                updatedAt: 240,
                lastSeenAt: 240,
                lastSeenVersion: 2,
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
                value: "dead-man!",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 5,
                },
                updatedAt: 120,
                lastSeenAt: 120,
                lastSeenVersion: 2,
                timesSeen: 2,
                unseenAcceptedHandoffs: 1,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("marks an unchanged matched active item as seen for decay without counting repeat evidence", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                confidence: "likely",
                note: "stable standing plan",
                updatedAt: 100,
                lastSeenAt: 100,
                lastSeenVersion: 1,
                timesSeen: 2,
                unseenAcceptedHandoffs: 1,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                confidence: "likely",
                note: "stable standing plan",
                updatedAt: 200,
                lastSeenAt: 200,
                lastSeenVersion: 2,
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

        expect(merged.activeThreads).toEqual([
            {
                value: "meet again at the station",
                status: "active",
                confidence: "likely",
                note: "stable standing plan",
                updatedAt: 100,
                lastSeenAt: 100,
                lastSeenVersion: 2,
                timesSeen: 2,
                unseenAcceptedHandoffs: 1,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("does not count omitted note on a matched carried-forward item as repeat evidence", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "likely",
                note: "existing stable note",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "likely",
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
                confidence: "likely",
                note: "existing stable note",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("does not count omitted confidence on a matched carried-forward item as repeat evidence", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "likely",
                note: "existing stable note",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "Tea",
                status: "active",
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
                confidence: "likely",
                note: "existing stable note",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 2,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("allows an explicit blank note to clear a matched active item's note", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "suspected",
                note: "old note to clear",
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
                note: "",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 8,
                },
                updatedAt: 200,
                lastSeenAt: 200,
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
                confidence: "likely",
                note: "",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 8,
                },
                updatedAt: 200,
                lastSeenAt: 200,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })
})
