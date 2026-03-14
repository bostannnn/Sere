import { describe, expect, it } from "vitest"

import { applyCharacterEvolutionDecay, applyLastInteractionEndedOverwrite } from "./decay"
import { projectCharacterEvolutionStateForPrompt } from "./projection"
import { createDefaultCharacterEvolutionSectionConfigs, createDefaultCharacterEvolutionState } from "./schema"

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

    it("respects slow-section confidence rules", () => {
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
            status: "archived",
            unseenAcceptedHandoffs: 8,
        }))
        expect(decayed.characterLikes[0]).toEqual(expect.objectContaining({
            status: "active",
            confidence: "confirmed",
            unseenAcceptedHandoffs: 8,
        }))
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

    it("overwrites lastInteractionEnded on accept-time proposal prep", () => {
        const blankOverwrite = applyLastInteractionEndedOverwrite({
            proposedState: {},
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        })
        const explicitOverwrite = applyLastInteractionEndedOverwrite({
            proposedState: {
                lastInteractionEnded: {
                    state: "they ended the call laughing",
                    residue: "a promise to text in the morning",
                },
            },
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        })
        const { applyLastInteractionEndedOverwrite: applyLastInteractionEndedOverwriteCjs } = require("../../../server/node/llm/character_evolution/decay.cjs")

        expect(blankOverwrite.lastInteractionEnded).toEqual({
            state: "",
            residue: "",
        })
        expect(explicitOverwrite.lastInteractionEnded).toEqual({
            state: "they ended the call laughing",
            residue: "a promise to text in the morning",
        })
        expect(applyLastInteractionEndedOverwriteCjs({
            proposedState: {},
            sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        })).toEqual(blankOverwrite)
    })
})
