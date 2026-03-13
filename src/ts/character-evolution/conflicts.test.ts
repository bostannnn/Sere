import { describe, expect, it } from "vitest"

import { resolveCharacterEvolutionStateConflicts } from "./conflicts"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution conflicts", () => {
    it("marks a replaced fact as corrected and keeps the replacement active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "user lives in Berlin",
                status: "active",
                confidence: "likely",
                note: "older location",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "user lives in Berlin",
                status: "active",
                confidence: "likely",
                note: "older location",
            },
            {
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
                note: "new explicit move",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "user lives in Berlin",
                status: "corrected",
                confidence: "likely",
                note: "older location",
            },
            {
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
                note: "new explicit move",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("archives resolved thread formulations in conflict sections instead of leaving them active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "keep the ferry plan alive",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.activeThreads = [
            {
                value: "keep the ferry plan alive",
                status: "active",
                confidence: "likely",
            },
            {
                value: "the ferry plan is resolved",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.activeThreads).toEqual([
            {
                value: "keep the ferry plan alive",
                status: "archived",
                confidence: "likely",
            },
            {
                value: "the ferry plan is resolved",
                status: "archived",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("keeps unrelated ideas active together when they can coexist", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "dark fantasy",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "dark fantasy",
                status: "active",
                confidence: "likely",
            },
            {
                value: "quiet domestic scenes",
                status: "active",
                confidence: "likely",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.characterLikes).toEqual([
            {
                value: "dark fantasy",
                status: "active",
                confidence: "likely",
            },
            {
                value: "quiet domestic scenes",
                status: "active",
                confidence: "likely",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("does not misclassify same-prefix likes as contradictions when both can coexist", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.characterLikes = [
            {
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.characterLikes = [
            {
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user likes dark fantasy movies",
                status: "active",
                confidence: "likely",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.characterLikes).toEqual([
            {
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user likes dark fantasy movies",
                status: "active",
                confidence: "likely",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("does not leave two contradictory proposed actives in the same section", () => {
        const currentState = createDefaultCharacterEvolutionState()

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "user lives in Berlin",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "user lives in Berlin",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects same-domain fact replacements even when the differing slot is in the middle", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "user drinks coffee every morning",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "user drinks coffee every morning",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user drinks tea every morning",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "user drinks coffee every morning",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "user drinks tea every morning",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects multi-token fact replacements instead of leaving both active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "user moved to New York",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user moved to Los Angeles",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "user moved to New York",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "user moved to Los Angeles",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects short-form fact replacements instead of dropping the old fact", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "Lives in Moscow",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "Lives in Berlin now",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "Lives in Moscow",
                status: "corrected",
                confidence: "confirmed",
            },
            {
                value: "Lives in Berlin now",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("keeps short-form coexistence facts active when both can be true", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
            },
            {
                value: "Has a dog",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
            },
            {
                value: "Has a dog",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("preserves omitted coexistence facts from current state when only the new item is proposed", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userFacts = [
            {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userFacts = [
            {
                value: "Has a dog",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
            {
                value: "Has a cat",
                status: "active",
                confidence: "likely",
            },
            {
                value: "Has a dog",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects slot replacements in active threads instead of leaving both active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "meet at 7pm tomorrow",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.activeThreads = [
            {
                value: "meet at 7pm tomorrow",
                status: "active",
                confidence: "likely",
            },
            {
                value: "meet at 9pm tomorrow",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.activeThreads).toEqual([
            {
                value: "meet at 7pm tomorrow",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "meet at 9pm tomorrow",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects multi-token active-thread replacements instead of leaving both active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.activeThreads = [
            {
                value: "meet in New York tomorrow",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.activeThreads = [
            {
                value: "meet in New York tomorrow",
                status: "active",
                confidence: "likely",
            },
            {
                value: "meet in Los Angeles tomorrow",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.activeThreads).toEqual([
            {
                value: "meet in New York tomorrow",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "meet in Los Angeles tomorrow",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects conflicting preference reversals instead of keeping both active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userLikes = [
            {
                value: "user prefers sci fi over fantasy",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userLikes = [
            {
                value: "user prefers sci fi over fantasy",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user prefers fantasy over sci fi",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userLikes).toEqual([
            {
                value: "user prefers sci fi over fantasy",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "user prefers fantasy over sci fi",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("corrects opposite same-domain preference polarity instead of keeping both active", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.userLikes = [
            {
                value: "user likes tea",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.userLikes = [
            {
                value: "user likes tea",
                status: "active",
                confidence: "likely",
            },
            {
                value: "user dislikes tea",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userLikes).toEqual([
            {
                value: "user likes tea",
                status: "corrected",
                confidence: "likely",
            },
            {
                value: "user dislikes tea",
                status: "active",
                confidence: "confirmed",
            },
        ])
        expect(resolvedCjs).toEqual(resolved)
    })

    it("collapses stronger-evidence refinements in the pending proposal instead of leaving duplicate actives", () => {
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

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
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
        expect(resolvedCjs).toEqual(resolved)
    })

    it("merges omitted stronger-evidence refinements from current state into the proposed item", () => {
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

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.userFacts).toEqual([
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
        expect(resolvedCjs).toEqual(resolved)
    })

    it("leaves relationship and lastInteractionEnded on their special path", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.relationship = {
            trustLevel: "steady",
            dynamic: "warm",
        }
        currentState.lastInteractionEnded = {
            state: "soft landing",
            residue: "curious",
        }

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.relationship = {
            trustLevel: "closer",
            dynamic: "playful",
        }
        proposedState.lastInteractionEnded = {
            state: "late-night goodbye",
            residue: "buzzing",
        }
        proposedState.userFacts = [
            {
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
            },
        ]

        const resolved = resolveCharacterEvolutionStateConflicts({
            currentState,
            proposedState,
        })
        const { resolveCharacterEvolutionStateConflicts: resolveCharacterEvolutionStateConflictsCjs } = require("../../../server/node/llm/character_evolution/conflicts.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.relationship).toEqual({
            trustLevel: "closer",
            dynamic: "playful",
        })
        expect(resolved.lastInteractionEnded).toEqual({
            state: "late-night goodbye",
            residue: "buzzing",
        })
        expect(resolvedCjs).toEqual(resolved)
    })
})
