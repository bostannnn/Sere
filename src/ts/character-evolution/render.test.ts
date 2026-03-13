import { describe, expect, it } from "vitest"

import { renderCharacterEvolutionStateForPrompt } from "../characterEvolution"
import { createDefaultCharacterEvolutionSectionConfigs, createDefaultCharacterEvolutionState } from "./schema"

describe("character evolution render", () => {
    it("includes only active item-object memory in the normal prompt render", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "Meet again at the station",
                status: "active",
                confidence: "likely",
            },
            {
                value: "Old resolved detour",
                status: "archived",
                confidence: "suspected",
            },
        ]
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

        expect(rendered).toContain("Meet again at the station")
        expect(rendered).not.toContain("Old resolved detour")
        expect(rendered).toContain("Tea")
        expect(rendered).not.toContain("Coffee")
        expect(rendered).not.toContain("Juice")
        expect(renderedCjs).toBe(rendered)
    })

    it("keeps archived and corrected items out of extractor prompt state JSON", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "Keep the diner promise",
                status: "active",
                confidence: "likely",
            },
            {
                value: "Old repaired misunderstanding",
                status: "corrected",
                confidence: "confirmed",
            },
        ]
        const sectionConfigs = createDefaultCharacterEvolutionSectionConfigs()
        const { buildCharacterEvolutionPromptMessages } = require("../../../server/node/llm/character_evolution/prompt_builder.cjs")

        const promptMessages = buildCharacterEvolutionPromptMessages({
            settings: {
                username: "User",
            },
            character: {
                name: "Eva",
                characterEvolution: {
                    enabled: true,
                    useGlobalDefaults: false,
                    extractionProvider: "openrouter",
                    extractionModel: "anthropic/claude-3.5-haiku",
                    extractionMaxTokens: 2400,
                    extractionPrompt: "prompt",
                    sectionConfigs,
                    privacy: {
                        allowCharacterIntimatePreferences: false,
                        allowUserIntimatePreferences: false,
                    },
                    currentStateVersion: 1,
                    currentState: state,
                    stateVersions: [],
                },
            },
            chat: {
                id: "chat-1",
                message: [],
            },
            sourceRange: {
                chatId: "chat-1",
                startMessageIndex: 0,
                endMessageIndex: 0,
            },
        })

        expect(promptMessages[1]?.content).toContain("Keep the diner promise")
        expect(promptMessages[1]?.content).not.toContain("Old repaired misunderstanding")
    })
})
