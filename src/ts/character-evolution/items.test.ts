import { describe, expect, it } from "vitest"

import { applyCharacterEvolutionItemMetadata, mergeAcceptedCharacterEvolutionState } from "./items"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution item metadata", () => {
    it("preserves existing provenance when an item's lifecycle status changes", () => {
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
            sourceChatId: "chat-1",
            sourceRange: {
                startMessageIndex: 1,
                endMessageIndex: 3,
            },
            updatedAt: 100,
            lastSeenAt: 120,
            timesSeen: 2,
        })
        expect(normalizedCjs).toEqual(normalized)
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
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "Dead Man",
                status: "active",
                note: "brought back into current taste",
            },
        ]

        const merged = mergeAcceptedCharacterEvolutionState({
            currentState,
            proposedState,
        })

        expect(merged.characterLikes).toEqual([
            {
                value: "Dead Man",
                status: "active",
                note: "brought back into current taste",
            },
        ])
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
                note: "current live formulation updated",
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
                note: "current live formulation updated",
            },
        ])
        expect(mergedCjs).toEqual(merged)
    })
})
