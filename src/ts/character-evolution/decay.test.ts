import { describe, expect, it } from "vitest"

import {
    applyCharacterEvolutionDecay,
    applyLastInteractionEndedOverwrite,
    compactCharacterEvolutionCurrentState,
    previewCharacterEvolutionRetentionDryRun,
} from "./decay"
import { projectCharacterEvolutionStateForPrompt } from "./projection"
import { createDefaultCharacterEvolutionSectionConfigs, createDefaultCharacterEvolutionState } from "./schema"
import { createCharacterEvolutionRetentionPolicy } from "./retentionPolicy"

describe("character evolution decay", () => {
    it("archives fast sections after 2 unseen accepted handoffs", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [{
            value: "find a new apartment",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 1,
        }]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.activeThreads).toEqual([
            expect.objectContaining({
                value: "find a new apartment",
                status: "archived",
                unseenAcceptedHandoffs: 2,
            }),
        ])
        expect(decayedCjs).toEqual(decayed)
    })

    it("archives medium sections after 5 unseen accepted handoffs", () => {
        const state = createDefaultCharacterEvolutionState()
        state.userRead = [{
            value: "The Left Hand of Darkness",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 4,
        }]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.userRead).toEqual([
            expect.objectContaining({
                value: "The Left Hand of Darkness",
                status: "archived",
                unseenAcceptedHandoffs: 5,
            }),
        ])
        expect(decayedCjs).toEqual(decayed)
    })

    it("respects slow and permanent confidence rules", () => {
        const state = createDefaultCharacterEvolutionState()
        state.userFacts = [{
            value: "user works night shifts",
            status: "active",
            confidence: "suspected",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 7,
        }]
        state.userLikes = [{
            value: "likes charcoal sketching",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 7,
        }]
        state.characterLikes = [{
            value: "quiet museums",
            status: "active",
            confidence: "confirmed",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 7,
        }]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.userFacts[0]).toEqual(expect.objectContaining({
            status: "archived",
            unseenAcceptedHandoffs: 8,
        }))
        expect(decayed.userLikes[0]).toEqual(expect.objectContaining({
            status: "active",
            unseenAcceptedHandoffs: 8,
        }))
        expect(decayed.characterLikes[0]).toEqual(expect.objectContaining({
            status: "active",
            confidence: "confirmed",
            unseenAcceptedHandoffs: 8,
        }))
        expect(decayedCjs).toEqual(decayed)
    })

    it("lets section bucket overrides change decay timing", () => {
        const state = createDefaultCharacterEvolutionState()
        state.runningJokes = [{
            value: "the cursed teacup",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 4,
        }]
        const retentionPolicy = createCharacterEvolutionRetentionPolicy()
        retentionPolicy.sectionBuckets = {
            ...retentionPolicy.sectionBuckets,
            runningJokes: "fast",
        }

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
            retentionPolicy,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
            retentionPolicy,
        })

        expect(decayed.runningJokes[0]).toEqual(expect.objectContaining({
            status: "archived",
            unseenAcceptedHandoffs: 5,
        }))
        expect(decayedCjs).toEqual(decayed)
    })

    it("never auto-prunes permanent sections", () => {
        const state = createDefaultCharacterEvolutionState()
        state.characterLikes = [
            {
                value: "quiet museums",
                status: "active",
                confidence: "confirmed",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 99,
            },
            {
                value: "matinee showings",
                status: "archived",
                confidence: "confirmed",
                lastSeenVersion: 1,
                unseenAcceptedHandoffs: 99,
            },
        ]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.characterLikes).toEqual([
            expect.objectContaining({
                value: "quiet museums",
                status: "active",
                unseenAcceptedHandoffs: 100,
            }),
            expect.objectContaining({
                value: "matinee showings",
                status: "archived",
                unseenAcceptedHandoffs: 100,
            }),
        ])
        expect(decayedCjs).toEqual(decayed)
    })

    it("increments unseen for non-reinforced items even when their section was omitted from a partial proposal", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [{
            value: "follow up on the gallery invite",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 1,
        }]
        state.userFacts = [{
            value: "user is moving soon",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 2,
            unseenAcceptedHandoffs: 0,
        }]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.activeThreads[0]).toEqual(expect.objectContaining({
            status: "archived",
            unseenAcceptedHandoffs: 2,
        }))
        expect(decayed.userFacts[0]).toEqual(expect.objectContaining({
            status: "active",
            unseenAcceptedHandoffs: 0,
        }))
        expect(decayedCjs).toEqual(decayed)
    })

    it("uses accept-version reinforcement markers instead of timestamp equality", () => {
        const state = createDefaultCharacterEvolutionState()
        state.userFacts = [{
            value: "user is moving soon",
            status: "active",
            confidence: "likely",
            lastSeenAt: 200,
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 0,
        }]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.userFacts[0]).toEqual(expect.objectContaining({
            unseenAcceptedHandoffs: 1,
        }))
        expect(decayedCjs).toEqual(decayed)
    })

    it("keeps relationship unchanged and only renders active items after decay", () => {
        const state = createDefaultCharacterEvolutionState()
        state.relationship = {
            trustLevel: "high",
            dynamic: "steady and intimate",
        }
        state.activeThreads = [{
            value: "finish the train booking",
            status: "active",
            confidence: "likely",
            lastSeenVersion: 1,
            unseenAcceptedHandoffs: 1,
        }]

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
        })
        const projected = projectCharacterEvolutionStateForPrompt(decayed)
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
        })

        expect(decayed.relationship).toEqual({
            trustLevel: "high",
            dynamic: "steady and intimate",
        })
        expect(decayed.activeThreads[0]).toEqual(expect.objectContaining({
            status: "archived",
        }))
        expect(projected.activeThreads).toEqual([])
        expect(decayedCjs).toEqual(decayed)
    })

    it("archives active overflow before trimming older non-active items under stored caps", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "book the train",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 2,
                lastSeenAt: 200,
                updatedAt: 200,
                timesSeen: 5,
            },
            {
                value: "renew the passport",
                status: "active",
                confidence: "likely",
                lastSeenVersion: 2,
                lastSeenAt: 150,
                updatedAt: 150,
                timesSeen: 2,
            },
            {
                value: "older archived errand",
                status: "archived",
                confidence: "likely",
                unseenAcceptedHandoffs: 0,
                lastSeenAt: 120,
                updatedAt: 120,
                timesSeen: 1,
            },
        ]
        const retentionPolicy = createCharacterEvolutionRetentionPolicy()
        retentionPolicy.caps.activeThreads = {
            active: 1,
            nonActive: 1,
        }

        const decayed = applyCharacterEvolutionDecay({
            state,
            acceptedVersion: 2,
            retentionPolicy,
        })
        const { applyCharacterEvolutionDecay: applyCharacterEvolutionDecayCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")
        const decayedCjs = applyCharacterEvolutionDecayCjs({
            state,
            acceptedVersion: 2,
            retentionPolicy,
        })

        expect(decayed.activeThreads).toEqual([
            expect.objectContaining({
                value: "book the train",
                status: "active",
            }),
            expect.objectContaining({
                value: "renew the passport",
                status: "archived",
            }),
        ])
        expect(decayedCjs).toEqual(decayed)
    })

})
