import { describe, expect, it } from "vitest"

import {
    createDefaultCharacterEvolutionDefaults,
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
} from "../characterEvolution"

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

    it("round-trips accepted-handoff decay metadata through state normalization", () => {
        const input = {
            activeThreads: [
                {
                    value: "keep the lighthouse trip alive",
                    status: "active",
                    lastSeenVersion: "7.9",
                    unseenAcceptedHandoffs: "4.2",
                },
                {
                    value: "invalid metadata is dropped",
                    status: "active",
                    lastSeenVersion: "0",
                    unseenAcceptedHandoffs: "-1",
                },
            ],
        }

        const normalized = normalizeCharacterEvolutionState(input)
        const { normalizeCharacterEvolutionState: normalizeCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionStateCjs(input)

        expect(normalized.activeThreads).toEqual([
            {
                value: "keep the lighthouse trip alive",
                status: "active",
                lastSeenVersion: 7,
                unseenAcceptedHandoffs: 4,
            },
            {
                value: "invalid metadata is dropped",
                status: "active",
            },
        ])
        expect(normalizedCjs).toEqual(normalized)
    })

    it("preserves omitted optional item notes as absent while keeping explicit blank notes", () => {
        const input = {
            characterLikes: [
                {
                    value: "Tea",
                    status: "active",
                },
                {
                    value: "Coffee",
                    status: "active",
                    note: "  explicit note  ",
                },
                {
                    value: "Juice",
                    status: "active",
                    note: "   ",
                },
            ],
        }

        const normalized = normalizeCharacterEvolutionState(input)
        const { normalizeCharacterEvolutionState: normalizeCharacterEvolutionStateCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionStateCjs(input)

        expect(normalized.characterLikes).toEqual([
            {
                value: "Tea",
                status: "active",
            },
            {
                value: "Coffee",
                status: "active",
                note: "explicit note",
            },
            {
                value: "Juice",
                status: "active",
                note: "",
            },
        ])
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

    it("normalizes prompt projection defaults with complete ranking orders and per-section limits", () => {
        const input = {
            promptProjection: {
                rankings: {
                    fast: ["timesSeen", "timesSeen", "confidence"],
                },
                limits: {
                    generation: {
                        activeThreads: "5",
                        userFacts: -2,
                    },
                },
            },
        }

        const normalized = normalizeCharacterEvolutionDefaults(input)
        const { normalizeCharacterEvolutionDefaults: normalizeCharacterEvolutionDefaultsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionDefaultsCjs(input)

        expect(normalized.promptProjection?.rankings.fast).toEqual([
            "timesSeen",
            "confidence",
            "lastSeenAt",
            "updatedAt",
        ])
        expect(normalized.promptProjection?.rankings.medium).toEqual([
            "lastSeenAt",
            "timesSeen",
            "confidence",
            "updatedAt",
        ])
        expect(normalized.promptProjection?.limits.generation.activeThreads).toBe(5)
        expect(normalized.promptProjection?.limits.generation.userFacts).toBe(4)
        expect(normalized.promptProjection?.limits.extraction.userFacts).toBe(6)
        expect(normalizedCjs).toEqual(normalized)
    })

    it("upgrades legacy built-in full-replacement prompts to the changed-subset prompt", () => {
        const defaults = createDefaultCharacterEvolutionDefaults()
        const legacyPrompt = defaults.extractionPrompt.replace(
            "- for list sections, include only changed, new, corrected, archived, or explicitly cleared items; do not copy unchanged active items from Current state JSON\n- for relationship, include dynamic when that section changes; include trustLevel when it materially changes or clarifies the shift\n- for lastInteractionEnded, include the full object when that section changes",
            "- each included section must be the full intended replacement for that section",
        )

        const normalizedDefaults = normalizeCharacterEvolutionDefaults({
            extractionPrompt: legacyPrompt,
        })
        const normalizedSettings = normalizeCharacterEvolutionSettings({
            extractionPrompt: legacyPrompt,
        })
        const { normalizeCharacterEvolutionDefaults: normalizeCharacterEvolutionDefaultsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const { normalizeCharacterEvolutionSettings: normalizeCharacterEvolutionSettingsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")

        expect(normalizedDefaults.extractionPrompt).toBe(defaults.extractionPrompt)
        expect(normalizedSettings.extractionPrompt).toBe(defaults.extractionPrompt)
        expect(normalizeCharacterEvolutionDefaultsCjs({ extractionPrompt: legacyPrompt }).extractionPrompt).toBe(defaults.extractionPrompt)
        expect(normalizeCharacterEvolutionSettingsCjs({ extractionPrompt: legacyPrompt }).extractionPrompt).toBe(defaults.extractionPrompt)
    })

})
