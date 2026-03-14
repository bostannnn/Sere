import { describe, expect, it } from "vitest"

import { resolveCharacterEvolutionStateConflicts } from "./conflicts"
import { renderCharacterEvolutionStateForPrompt } from "./render"
import {
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
} from "./schema"

describe("character evolution phase 4 workflow smoke", () => {
    it("covers correction, archival, coexistence, special-path preservation, and active-only prompting in one reviewer flow", () => {
        const currentState = createDefaultCharacterEvolutionState()
        currentState.relationship = {
            trustLevel: "steady",
            dynamic: "warm",
        }
        currentState.lastInteractionEnded = {
            state: "hopeful",
            residue: "easy warmth",
        }
        currentState.userFacts = [
            {
                value: "user lives in Berlin",
                status: "active",
                confidence: "likely",
                note: "older location",
            },
        ]
        currentState.activeThreads = [
            {
                value: "keep the ferry plan alive",
                status: "active",
                confidence: "likely",
            },
        ]
        currentState.characterLikes = [
            {
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
            },
        ]
        currentState.userLikes = [
            {
                value: "user likes tea",
                status: "active",
                confidence: "likely",
            },
        ]

        const proposedState = createDefaultCharacterEvolutionState()
        proposedState.relationship = {
            trustLevel: "closer",
            dynamic: "playful and collaborative",
        }
        proposedState.lastInteractionEnded = {
            state: "energized",
            residue: "shared momentum",
        }
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
        const { renderCharacterEvolutionStateForPrompt: renderCharacterEvolutionStateForPromptCjs } = require("../../../server/node/llm/character_evolution/render.cjs")
        const resolvedCjs = resolveCharacterEvolutionStateConflictsCjs({
            currentState,
            proposedState,
        })

        expect(resolved.relationship).toEqual({
            trustLevel: "closer",
            dynamic: "playful and collaborative",
        })
        expect(resolved.lastInteractionEnded).toEqual({
            state: "energized",
            residue: "shared momentum",
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

        const sectionConfigs = createDefaultCharacterEvolutionSectionConfigs()
        const rendered = renderCharacterEvolutionStateForPrompt(resolved, sectionConfigs)
        const renderedCjs = renderCharacterEvolutionStateForPromptCjs(resolved, sectionConfigs)

        expect(rendered).toContain("Trust level: closer")
        expect(rendered).toContain("Dynamic: playful and collaborative")
        expect(rendered).toContain("State: energized")
        expect(rendered).toContain("Residue: shared momentum")
        expect(rendered).toContain("- user lives in Moscow [confirmed]")
        expect(rendered).toContain("- user likes dark fantasy books [likely]")
        expect(rendered).toContain("- user likes dark fantasy movies [likely]")
        expect(rendered).toContain("- user dislikes tea [confirmed]")
        expect(rendered).not.toContain("user lives in Berlin")
        expect(rendered).not.toContain("keep the ferry plan alive")
        expect(rendered).not.toContain("the ferry plan is resolved")
        expect(rendered).not.toContain("user likes tea [likely]")
        expect(renderedCjs).toEqual(rendered)
    })

    it("collapses stronger-evidence refinements with preserved metadata before prompt rendering", () => {
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
                sourceChatId: "chat-new",
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
        const sectionConfigs = createDefaultCharacterEvolutionSectionConfigs()
        const rendered = renderCharacterEvolutionStateForPrompt(resolved, sectionConfigs)

        expect(resolved.userFacts).toEqual([
            {
                value: "user moved to New York last year",
                status: "active",
                confidence: "confirmed",
                note: "new stronger timing detail",
                sourceChatId: "chat-new",
                sourceRange: {
                    startMessageIndex: 4,
                    endMessageIndex: 6,
                },
                updatedAt: 200,
                lastSeenAt: 200,
                timesSeen: 3,
            },
        ])
        expect(rendered).toContain("- user moved to New York last year [confirmed]")
        expect(rendered).not.toContain("user moved to New York [likely]")
    })
})
