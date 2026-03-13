import { describe, expect, it } from "vitest"

import { projectCharacterEvolutionStateForPrompt } from "./projection"
import { createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution prompt projection", () => {
    it("caps generation prompt sections and favors durable facts", () => {
        const state = createDefaultCharacterEvolutionState()
        state.userFacts = [
            { value: "suspected-new", confidence: "suspected", status: "active", lastSeenAt: 500, updatedAt: 500, timesSeen: 1 },
            { value: "confirmed-old-1", confidence: "confirmed", status: "active", lastSeenAt: 100, updatedAt: 100, timesSeen: 3 },
            { value: "confirmed-old-2", confidence: "confirmed", status: "active", lastSeenAt: 90, updatedAt: 90, timesSeen: 2 },
            { value: "likely-mid-1", confidence: "likely", status: "active", lastSeenAt: 300, updatedAt: 300, timesSeen: 2 },
            { value: "likely-mid-2", confidence: "likely", status: "active", lastSeenAt: 280, updatedAt: 280, timesSeen: 2 },
            { value: "likely-mid-3", confidence: "likely", status: "active", lastSeenAt: 260, updatedAt: 260, timesSeen: 2 },
            { value: "suspected-low", confidence: "suspected", status: "active", lastSeenAt: 200, updatedAt: 200, timesSeen: 1 },
        ]

        const projected = projectCharacterEvolutionStateForPrompt(state, "generation")
        const projectedValues = projected.userFacts.map((item) => item.value)
        const { projectCharacterEvolutionStateForPrompt: projectCharacterEvolutionStateForPromptCjs } = require("../../../server/node/llm/character_evolution/projection.cjs")
        const projectedCjs = projectCharacterEvolutionStateForPromptCjs(state, "generation")

        expect(projectedValues).toEqual([
            "confirmed-old-1",
            "confirmed-old-2",
            "likely-mid-1",
            "likely-mid-2",
        ])
        expect(projectedCjs.userFacts.map((item: { value: string }) => item.value)).toEqual(projectedValues)
    })

    it("caps extraction prompt sections and favors recent fast-moving threads", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            { value: "thread-oldest", confidence: "confirmed", status: "active", lastSeenAt: 10, updatedAt: 10, timesSeen: 4 },
            { value: "thread-mid", confidence: "likely", status: "active", lastSeenAt: 20, updatedAt: 20, timesSeen: 2 },
            { value: "thread-newer", confidence: "suspected", status: "active", lastSeenAt: 30, updatedAt: 30, timesSeen: 1 },
            { value: "thread-newest", confidence: "suspected", status: "active", lastSeenAt: 40, updatedAt: 40, timesSeen: 1 },
        ]

        const projected = projectCharacterEvolutionStateForPrompt(state, "extraction")
        const projectedValues = projected.activeThreads.map((item) => item.value)

        expect(projectedValues).toEqual([
            "thread-newest",
            "thread-newer",
            "thread-mid",
        ])
        expect(projectedValues).not.toContain("thread-oldest")
    })
})
