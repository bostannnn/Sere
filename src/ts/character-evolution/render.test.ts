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
                note: "Shared promise from the museum conversation.",
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
        expect(rendered).toContain("Meet again at the station [likely]")
        expect(rendered).not.toContain("Shared promise from the museum conversation.")
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

    it("strips prompt-only evidence notes and operational metadata from extractor state JSON", () => {
        const state = createDefaultCharacterEvolutionState()
        state.activeThreads = [
            {
                value: "Keep the diner promise",
                status: "active",
                confidence: "likely",
                note: "Came up twice in the last handoff.",
                sourceChatId: "chat-1",
                sourceRange: {
                    startMessageIndex: 0,
                    endMessageIndex: 23,
                },
                updatedAt: 111,
                lastSeenAt: 222,
                timesSeen: 3,
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

        expect(promptMessages[1]?.content).toContain("\"value\": \"Keep the diner promise\"")
        expect(promptMessages[1]?.content).toContain("\"confidence\": \"likely\"")
        expect(promptMessages[1]?.content).toContain("\"status\": \"active\"")
        expect(promptMessages[1]?.content).not.toContain("Came up twice in the last handoff.")
        expect(promptMessages[1]?.content).not.toContain("\"sourceChatId\"")
        expect(promptMessages[1]?.content).not.toContain("\"sourceRange\"")
        expect(promptMessages[1]?.content).not.toContain("\"updatedAt\"")
        expect(promptMessages[1]?.content).not.toContain("\"lastSeenAt\"")
        expect(promptMessages[1]?.content).not.toContain("\"timesSeen\"")
    })

    it("caps extracted current state instead of sending every active fact forever", () => {
        const state = createDefaultCharacterEvolutionState()
        state.userFacts = [
            { value: "fact-1", confidence: "confirmed", status: "active", lastSeenAt: 10, updatedAt: 10, timesSeen: 3 },
            { value: "fact-2", confidence: "confirmed", status: "active", lastSeenAt: 9, updatedAt: 9, timesSeen: 3 },
            { value: "fact-3", confidence: "likely", status: "active", lastSeenAt: 8, updatedAt: 8, timesSeen: 2 },
            { value: "fact-4", confidence: "likely", status: "active", lastSeenAt: 7, updatedAt: 7, timesSeen: 2 },
            { value: "fact-5", confidence: "likely", status: "active", lastSeenAt: 6, updatedAt: 6, timesSeen: 2 },
            { value: "fact-6", confidence: "suspected", status: "active", lastSeenAt: 5, updatedAt: 5, timesSeen: 1 },
            { value: "fact-7", confidence: "suspected", status: "active", lastSeenAt: 4, updatedAt: 4, timesSeen: 1 },
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

        expect(promptMessages[1]?.content).toContain("\"fact-1\"")
        expect(promptMessages[1]?.content).toContain("\"fact-6\"")
        expect(promptMessages[1]?.content).not.toContain("\"fact-7\"")
    })
})
