import { describe, expect, it } from "vitest"

import {
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
                    id: "  item-1  ",
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
            id: "item-1",
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
        expect("useGlobalDefaults" in normalized).toBe(false)
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
        expect("useGlobalDefaults" in normalized).toBe(false)
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
        expect(normalized.promptProjection?.rankings.permanent).toEqual([
            "confidence",
            "timesSeen",
            "lastSeenAt",
            "updatedAt",
        ])
        expect(normalized.promptProjection?.limits.generation.activeThreads).toBe(5)
        expect(normalized.promptProjection?.limits.generation.userFacts).toBe(4)
        expect(normalized.promptProjection?.limits.extraction.userFacts).toBe(6)
        expect(normalizedCjs).toEqual(normalized)
    })

    it("normalizes retention defaults with permanent thresholds and section bucket overrides", () => {
        const input = {
            retention: {
                thresholds: {
                    archive: {
                        fast: "3",
                        permanent: 0,
                    },
                    deleteNonActive: {
                        medium: "7",
                        permanent: 0,
                    },
                    deleteConfirmedSlow: "41",
                },
                sectionBuckets: {
                    runningJokes: "fast",
                    keyMoments: "medium",
                    userFacts: "permanent",
                    userLikes: "bogus",
                },
            },
        }

        const normalized = normalizeCharacterEvolutionDefaults(input)
        const { normalizeCharacterEvolutionDefaults: normalizeCharacterEvolutionDefaultsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionDefaultsCjs(input)

        expect(normalized.retention?.thresholds.archive.fast).toBe(3)
        expect(normalized.retention?.thresholds.archive.permanent).toBe(Number.POSITIVE_INFINITY)
        expect(normalized.retention?.thresholds.deleteNonActive.medium).toBe(7)
        expect(normalized.retention?.thresholds.deleteNonActive.permanent).toBe(Number.POSITIVE_INFINITY)
        expect(normalized.retention?.thresholds.deleteConfirmedSlow).toBe(41)
        expect(normalized.retention?.sectionBuckets?.runningJokes).toBe("fast")
        expect(normalized.retention?.sectionBuckets?.keyMoments).toBe("medium")
        expect(normalized.retention?.sectionBuckets?.userFacts).toBe("permanent")
        expect(normalized.retention?.sectionBuckets?.userLikes).toBe("permanent")
        expect(normalizedCjs).toEqual(normalized)
    })

    it("normalizes semantic recall defaults and section toggles", () => {
        const input = {
            semanticRecall: {
                enabled: true,
                embeddingModel: " multiMiniLM ",
                minScore: "0.7",
                maxItems: "5.9",
                queryMessageWindow: "6",
                sections: {
                    userFacts: true,
                    keyMoments: true,
                    userLikes: true,
                },
                sectionLimits: {
                    userFacts: "5.9",
                    userLikes: "3.2",
                    keyMoments: "-1",
                },
            },
        }

        const normalized = normalizeCharacterEvolutionDefaults(input)
        const { normalizeCharacterEvolutionDefaults: normalizeCharacterEvolutionDefaultsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const normalizedCjs = normalizeCharacterEvolutionDefaultsCjs(input)

        expect(normalized.semanticRecall).toEqual({
            enabled: true,
            embeddingModel: "multiMiniLM",
            minScore: 0.7,
            maxItems: 5,
            queryMessageWindow: 6,
            sections: {
                characterLikes: false,
                characterDislikes: false,
                characterHabits: false,
                userFacts: true,
                userLikes: true,
                userDislikes: false,
                keyMoments: true,
            },
            sectionLimits: {
                characterLikes: 0,
                characterDislikes: 0,
                characterHabits: 0,
                userFacts: 5,
                userLikes: 3,
                userDislikes: 0,
                keyMoments: 0,
            },
        })
        expect(normalizedCjs).toEqual(normalized)
    })

    it("clears builtin extraction prompts to empty (empty = use code default at runtime)", () => {
        const legacyFullReplacement = "You update a character evolution state from the current processed roleplay transcript range.\n\n- each included section must be the full intended replacement for that section"
        const legacyUnderExtraction = "You update a character evolution state from the current processed roleplay transcript range.\n\n- Prefer under-extraction over over-extraction."
        const currentBuiltin = "You update a character evolution state from the current processed roleplay transcript range.\n\nReturn raw JSON only."

        // All known builtins should be cleared to empty
        for (const builtinPrompt of [legacyFullReplacement, legacyUnderExtraction, currentBuiltin]) {
            expect(normalizeCharacterEvolutionDefaults({ extractionPrompt: builtinPrompt }).extractionPrompt).toBe("")
            expect("extractionPrompt" in normalizeCharacterEvolutionSettings({ extractionPrompt: builtinPrompt })).toBe(false)
        }

        // User customizations should be preserved in defaults
        expect(normalizeCharacterEvolutionDefaults({ extractionPrompt: "My custom prompt" }).extractionPrompt).toBe("My custom prompt")
        expect("extractionPrompt" in normalizeCharacterEvolutionSettings({ extractionPrompt: "My custom prompt" })).toBe(false)

        // Empty/missing should stay empty
        expect(normalizeCharacterEvolutionDefaults({}).extractionPrompt).toBe("")
        expect(normalizeCharacterEvolutionDefaults({ extractionPrompt: "" }).extractionPrompt).toBe("")

        // Server-side parity
        const { normalizeCharacterEvolutionDefaults: normalizeDefaultsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        const { normalizeCharacterEvolutionSettings: normalizeSettingsCjs } = require("../../../server/node/llm/character_evolution/normalizers.cjs")
        expect(normalizeDefaultsCjs({ extractionPrompt: legacyFullReplacement }).extractionPrompt).toBe("")
        expect("extractionPrompt" in normalizeSettingsCjs({ extractionPrompt: legacyFullReplacement })).toBe(false)
        expect(normalizeDefaultsCjs({ extractionPrompt: "My custom prompt" }).extractionPrompt).toBe("My custom prompt")
    })

})
