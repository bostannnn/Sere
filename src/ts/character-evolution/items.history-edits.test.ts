import { describe, expect, it } from "vitest"

import { applyCharacterEvolutionItemMetadata, mergeAcceptedCharacterEvolutionState } from "./items"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution historical edit matching", () => {
    it("applies an explicit archived edit when a same-value active item remains live", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 1,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 3,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.characterLikes = [
            {
                value: "Dead Man",
                status: "archived",
                note: "older archived formulation clarified",
            },
            {
                value: "Dead Man",
                status: "active",
                note: "current live formulation",
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
        const {
            applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs,
            mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs,
        } = require("../../../server/node/llm/character_evolution/items.cjs")
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

        expect(merged.characterLikes).toEqual([
            {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation clarified",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 1,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 3,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("applies an explicit archived edit after normalized matching when a same-value active item remains live", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "Dead Man",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 1,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 3,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.characterLikes = [
            {
                value: "dead-man!",
                status: "archived",
                note: "older archived formulation clarified",
            },
            {
                value: "Dead Man",
                status: "active",
                note: "current live formulation",
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
        const {
            applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs,
            mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs,
        } = require("../../../server/node/llm/character_evolution/items.cjs")
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

        expect(merged.characterLikes).toEqual([
            {
                value: "dead-man!",
                status: "archived",
                confidence: "confirmed",
                note: "older archived formulation clarified",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 1,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "Dead Man",
                status: "active",
                confidence: "likely",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 3,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("applies an explicit corrected edit when a same-value active item remains live", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "user hates ferries",
                status: "corrected",
                confidence: "confirmed",
                note: "older corrected formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 4,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "user hates ferries",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 7,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.activeThreads = [
            {
                value: "user hates ferries",
                status: "corrected",
                note: "older corrected formulation clarified",
            },
            {
                value: "user hates ferries",
                status: "active",
                note: "current live formulation",
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
        const {
            applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs,
            mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs,
        } = require("../../../server/node/llm/character_evolution/items.cjs")
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

        expect(merged.activeThreads).toEqual([
            {
                value: "user hates ferries",
                status: "corrected",
                confidence: "confirmed",
                note: "older corrected formulation clarified",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 4,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "user hates ferries",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 7,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })

    it("applies an explicit corrected edit after normalized matching when a same-value active item remains live", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "AC/DC",
                status: "corrected",
                confidence: "confirmed",
                note: "older corrected formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 4,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "AC/DC",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 7,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ]

        const acceptedDraft = createDefaultCharacterEvolutionState()
        acceptedDraft.activeThreads = [
            {
                value: "ac dc",
                status: "corrected",
                note: "older corrected formulation clarified",
            },
            {
                value: "AC/DC",
                status: "active",
                note: "current live formulation",
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
        const {
            applyCharacterEvolutionItemMetadata: applyCharacterEvolutionItemMetadataCjs,
            mergeAcceptedCharacterEvolutionState: mergeAcceptedCharacterEvolutionStateCjs,
        } = require("../../../server/node/llm/character_evolution/items.cjs")
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

        expect(merged.activeThreads).toEqual([
            {
                value: "ac dc",
                status: "corrected",
                confidence: "confirmed",
                note: "older corrected formulation clarified",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 2,
                    endMessageIndex: 4,
                },
                updatedAt: 100,
                lastSeenAt: 100,
                timesSeen: 3,
            },
            {
                value: "AC/DC",
                status: "active",
                confidence: "confirmed",
                note: "current live formulation",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 5,
                    endMessageIndex: 7,
                },
                updatedAt: 140,
                lastSeenAt: 140,
                timesSeen: 2,
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })
})
