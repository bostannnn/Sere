import { describe, expect, it } from "vitest"

import { applyCharacterEvolutionItemMetadata, mergeAcceptedCharacterEvolutionState } from "./items"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution item metadata", () => {
    it("preserves provenance and refreshes matched timestamps when an item's lifecycle status changes on accept", () => {
        const baseState = createDefaultCharacterEvolutionState()
        baseState.activeThreads = [
            {
                value: "keep the ferry plan alive",
                status: "active",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 3,
                },
                updatedAt: 100,
                lastSeenAt: 120,
                timesSeen: 2,
            },
        ]

        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "keep the ferry plan alive",
                status: "archived",
            },
        ]

        const normalized = applyCharacterEvolutionItemMetadata({
            state,
            baseState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 4,
                endMessageIndex: 6,
            },
            timestamp: 200,
            overwriteNewItemTimestamps: true,
        })
        const { applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const normalizedCjs = applyCharacterEvolutionItemMetadataCjs({
            state,
            baseState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 4,
                endMessageIndex: 6,
            },
            timestamp: 200,
            overwriteNewItemTimestamps: true,
        })

        expect(normalized.activeThreads[0]).toEqual({
            value: "keep the ferry plan alive",
            status: "archived",
            sourceChatId: "chat-2",
            sourceRange: {
                startMessageIndex: 4,
                endMessageIndex: 6,
            },
            updatedAt: 200,
            lastSeenAt: 200,
            timesSeen: 2,
        })
        expect(normalizedCjs).toEqual(normalized)
    })

    it("matches existing item metadata after punctuation and case cleanup", () => {
        const baseState = createDefaultCharacterEvolutionState()
        baseState.characterLikes = [
            {
                value: "Dead Man",
                status: "archived",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 5,
                },
                updatedAt: 150,
                lastSeenAt: 150,
                timesSeen: 2,
            },
        ]

        const state = createDefaultCharacterEvolutionState()
        state.characterLikes = [
            {
                value: "dead-man!",
                status: "active",
            },
        ]

        const normalized = applyCharacterEvolutionItemMetadata({
            state,
            baseState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 6,
                endMessageIndex: 9,
            },
            timestamp: 250,
        })
        const { applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const normalizedCjs = applyCharacterEvolutionItemMetadataCjs({
            state,
            baseState,
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 6,
                endMessageIndex: 9,
            },
            timestamp: 250,
        })

        expect(normalized.characterLikes[0]).toEqual({
            value: "dead-man!",
            status: "active",
            sourceChatId: "chat-1",
            sourceRange: {
                startMessageIndex: 2,
                endMessageIndex: 5,
            },
            updatedAt: 150,
            lastSeenAt: 150,
            timesSeen: 2,
        })
        expect(normalizedCjs).toEqual(normalized)
    })

    it("matches slash-separated values after punctuation cleanup", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "AC/DC",
                status: "active",
                confidence: "suspected",
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 1,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "ac dc",
                status: "active",
                note: "mentioned again in the later range",
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
                value: "ac dc",
                status: "active",
                confidence: "likely",
                note: "mentioned again in the later range",
                updatedAt: 220,
                lastSeenAt: 220,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("refreshes new item timestamps on accept even if the pending proposal already stamped them", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "meet again at the station",
                status: "active",
                updatedAt: 1000,
                lastSeenAt: 1000,
            },
        ]

        const normalized = applyCharacterEvolutionItemMetadata({
            state,
            baseState: createDefaultCharacterEvolutionState(),
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 8,
                endMessageIndex: 12,
            },
            timestamp: 2000,
            overwriteNewItemTimestamps: true,
        })
        const { applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs } = require("../../../server/node/llm/character_evolution/items.cjs")
        const normalizedCjs = applyCharacterEvolutionItemMetadataCjs({
            state,
            baseState: createDefaultCharacterEvolutionState(),
            sourceChatId: "chat-2",
            sourceRange: {
                chatId: "chat-2",
                startMessageIndex: 8,
                endMessageIndex: 12,
            },
            timestamp: 2000,
            overwriteNewItemTimestamps: true,
        })

        expect(normalized.activeThreads[0]).toEqual(expect.objectContaining({
            value: "meet again at the station",
            sourceChatId: "chat-2",
            sourceRange: {
                startMessageIndex: 8,
                endMessageIndex: 12,
            },
            updatedAt: 2000,
            lastSeenAt: 2000,
            timesSeen: 1,
        }))
        expect(normalizedCjs).toEqual(normalized)
    })

    it("merges stronger-evidence refinements instead of appending a duplicate active row", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
                note: "older accepted phrasing",
                sourceChatId: "chat-old",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 3,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
                note: "older accepted phrasing",
                sourceChatId: "chat-old",
                sourceRange: {
                    startMessageIndex: 1,
                    endMessageIndex: 3,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 2,
            },
            {
                value: "user moved to New York last year",
                status: "active",
                confidence: "confirmed",
                note: "new stronger timing detail",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 4,
                    endMessageIndex: 6,
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

        expect(merged.userFacts).toEqual([
            {
                value: "user moved to New York last year",
                status: "active",
                confidence: "confirmed",
                note: "new stronger timing detail",
                sourceChatId: "chat-2",
                sourceRange: {
                    startMessageIndex: 4,
                    endMessageIndex: 6,
                },
                updatedAt: 200,
                lastSeenAt: 200,
                timesSeen: 3,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })
})
