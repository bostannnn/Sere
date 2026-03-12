import { describe, expect, it } from "vitest"

import { normalizeCharacterEvolutionSettings } from "../characterEvolution"

describe("character evolution normalizers", () => {
    it("preserves an explicit unprocessed cursor sentinel of -1", () => {
        const input = {
            enabled: true,
            useGlobalDefaults: false,
            extractionProvider: "openrouter",
            extractionModel: "anthropic/claude-3.5-haiku",
            extractionMaxTokens: 1200,
            extractionPrompt: "prompt",
            currentStateVersion: 0,
            currentState: {},
            stateVersions: [],
            lastProcessedMessageIndexByChat: {
                "chat-1": -1,
            },
        }

        const normalized = normalizeCharacterEvolutionSettings(input)
        const { normalizeCharacterEvolutionSettings: normalizeCharacterEvolutionSettingsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionSettingsCjs(input)

        expect(normalized.lastProcessedMessageIndexByChat?.["chat-1"]).toBe(-1)
        expect(normalizedCjs.lastProcessedMessageIndexByChat?.["chat-1"]).toBe(-1)
    })

    it("trims legacy chat-id metadata to match the server normalizer", () => {
        const input = {
            enabled: true,
            useGlobalDefaults: false,
            extractionProvider: "openrouter",
            extractionModel: "anthropic/claude-3.5-haiku",
            extractionMaxTokens: 1200,
            extractionPrompt: "prompt",
            currentStateVersion: 1,
            currentState: {
                characterLikes: [
                    {
                        value: "Tea",
                        sourceChatId: "  chat-like  ",
                    },
                ],
            },
            pendingProposal: {
                proposalId: "proposal-1",
                sourceChatId: "  chat-pending  ",
                proposedState: {},
                changes: [],
                createdAt: 10,
            },
            stateVersions: [
                {
                    version: 1,
                    chatId: "  chat-version  ",
                    acceptedAt: 20,
                },
            ],
            lastProcessedChatId: "  chat-last  ",
        }

        const normalized = normalizeCharacterEvolutionSettings(input)
        const { normalizeCharacterEvolutionSettings: normalizeCharacterEvolutionSettingsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionSettingsCjs(input)

        expect(normalized.pendingProposal?.sourceChatId).toBe("chat-pending")
        expect(normalized.stateVersions[0]?.chatId).toBe("chat-version")
        expect(normalized.lastProcessedChatId).toBe("chat-last")
        expect(normalized.currentState.characterLikes[0]?.sourceChatId).toBe("chat-like")
        expect(normalized).toEqual(normalizedCjs)
    })
})
