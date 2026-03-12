import { describe, expect, it } from "vitest"

import { renderCharacterEvolutionStateForPrompt } from "../characterEvolution"
import { createDefaultCharacterEvolutionSectionConfigs, createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution render", () => {
    it("includes only active item-object memory in the normal prompt render", () => {
        const state = createDefaultCharacterEvolutionState()
        state.characterLikes = [
            {
                value: "Tea",
                status: "active",
                confidence: "confirmed",
            },
            {
                value: "Coffee",
                status: "corrected",
                confidence: "confirmed",
            },
            {
                value: "Juice",
                status: "archived",
                confidence: "suspected",
            },
        ]
        const sectionConfigs = createDefaultCharacterEvolutionSectionConfigs()

        const rendered = renderCharacterEvolutionStateForPrompt(state, sectionConfigs)
        const { renderCharacterEvolutionStateForPrompt: renderCharacterEvolutionStateForPromptCjs } = require("../../../server/node/llm/character_evolution/render.cjs")
        const renderedCjs = renderCharacterEvolutionStateForPromptCjs(state, sectionConfigs)

        expect(rendered).toContain("Tea")
        expect(rendered).not.toContain("Coffee")
        expect(rendered).not.toContain("Juice")
        expect(renderedCjs).toBe(rendered)
    })
})
