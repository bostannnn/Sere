import { describe, expect, it } from "vitest"

import { normalizeCharacterEvolutionSettings, normalizeCharacterEvolutionState } from "../characterEvolution"

describe("character evolution normalizers", () => {
    it("migrates legacy string-array sections into canonical item objects", () => {
        const input = {
            activeThreads: ["follow up on the train ticket"],
            runningJokes: ["the cursed teacup"],
            userRead: ["seems guarded but curious"],
            keyMoments: ["shared the apartment spare key"],
        }

        const normalized = normalizeCharacterEvolutionState(input)
        const { normalizeCharacterEvolutionState: normalizeCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionStateCjs(input)

        expect(normalized.activeThreads).toEqual([{ value: "follow up on the train ticket", status: "active" }])
        expect(normalized.runningJokes).toEqual([{ value: "the cursed teacup", status: "active" }])
        expect(normalized.userRead).toEqual([{ value: "seems guarded but curious", status: "active" }])
        expect(normalized.keyMoments).toEqual([{ value: "shared the apartment spare key", status: "active" }])
        expect(normalizedCjs).toEqual(normalized)
    })

    it("normalizes item provenance and support metadata", () => {
        const input = {
            activeThreads: [
                {
                    value: "keep the lighthouse trip alive",
                    sourceChatId: "  chat-2  ",
                    sourceRange: {
                        startMessageIndex: 4.7,
                        endMessageIndex: 9.2,
                    },
                    updatedAt: "42",
                    lastSeenAt: "45",
                    timesSeen: "3",
                },
            ],
        }

        const normalized = normalizeCharacterEvolutionState(input)
        const { normalizeCharacterEvolutionState: normalizeCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionStateCjs(input)

        expect(normalized.activeThreads[0]).toEqual(expect.objectContaining({
            value: "keep the lighthouse trip alive",
            status: "active",
            sourceChatId: "chat-2",
            sourceRange: {
                startMessageIndex: 4,
                endMessageIndex: 9,
            },
            updatedAt: 42,
            lastSeenAt: 45,
            timesSeen: 3,
        }))
        expect(normalizedCjs).toEqual(normalized)
    })

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
