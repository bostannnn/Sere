import { describe, expect, it } from "vitest"

import {
    getCharacterEvolutionProcessedRanges,
    getLastProcessedMessageIndexForChat,
    getNextUnprocessedMessageIndexForChat,
    hasAcceptedEvolutionForChat,
    rebaseEvolutionCoverageAfterMessageDeletion,
} from "./ranges"

describe("character evolution ranges", () => {
    it("ignores malformed explicit processed ranges and matches the server normalization", () => {
        const settings = {
            processedRanges: [
                null,
                {
                    version: 1,
                    acceptedAt: 10,
                    range: null,
                },
                {
                    version: 2,
                    acceptedAt: 20,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 0,
                        endMessageIndex: 2,
                    },
                },
            ],
            stateVersions: [],
            lastProcessedMessageIndexByChat: undefined,
        }
        const { getCharacterEvolutionProcessedRanges: getCharacterEvolutionProcessedRangesCjs } = require("../../../server/node/llm/character_evolution/range.cjs")

        expect(getCharacterEvolutionProcessedRanges(settings)).toEqual([
            {
                version: 2,
                acceptedAt: 20,
                range: {
                    chatId: "chat-1",
                    startMessageIndex: 0,
                    endMessageIndex: 2,
                },
            },
        ])
        expect(getCharacterEvolutionProcessedRanges(settings)).toEqual(getCharacterEvolutionProcessedRangesCjs(settings))
        expect(getLastProcessedMessageIndexForChat(settings, "chat-1")).toBe(2)
        expect(hasAcceptedEvolutionForChat({
            chaId: "char-1",
            characterEvolution: settings,
        } as never, "chat-1", 3)).toBe(true)
    })

    it("derives last processed cursor from surviving processed ranges before trusting an explicit cursor", () => {
        const settings = {
            processedRanges: [
                {
                    version: 2,
                    acceptedAt: 20,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 5,
                        endMessageIndex: 8,
                    },
                },
            ],
            stateVersions: [],
            lastProcessedMessageIndexByChat: {
                "chat-1": 99,
            },
        }
        const { getLastProcessedMessageIndexForChat: getLastProcessedMessageIndexForChatCjs } = require("../../../server/node/llm/character_evolution/range.cjs")

        expect(getLastProcessedMessageIndexForChat(settings, "chat-1")).toBe(8)
        expect(getLastProcessedMessageIndexForChat(settings, "chat-1")).toBe(getLastProcessedMessageIndexForChatCjs(settings, "chat-1"))
    })

    it("derives the next unprocessed message index from the cursor fallback when detailed ranges are unavailable", () => {
        const settings = {
            processedRanges: [],
            stateVersions: [],
            lastProcessedMessageIndexByChat: {
                "chat-1": 8,
            },
        }
        const { getNextUnprocessedMessageIndexForChat: getNextUnprocessedMessageIndexForChatCjs } = require("../../../server/node/llm/character_evolution/range.cjs")

        expect(getNextUnprocessedMessageIndexForChat(settings, "chat-1")).toBe(9)
        expect(getNextUnprocessedMessageIndexForChat(settings, "chat-1")).toBe(getNextUnprocessedMessageIndexForChatCjs(settings, "chat-1"))
    })

    it("derives the next unprocessed message index from the first uncovered gap before trusting an explicit cursor", () => {
        const settings = {
            processedRanges: [
                {
                    version: 1,
                    acceptedAt: 10,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 0,
                        endMessageIndex: 4,
                    },
                },
                {
                    version: 2,
                    acceptedAt: 20,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 7,
                        endMessageIndex: 8,
                    },
                },
            ],
            stateVersions: [],
            lastProcessedMessageIndexByChat: {
                "chat-1": 99,
            },
        }
        const { getNextUnprocessedMessageIndexForChat: getNextUnprocessedMessageIndexForChatCjs } = require("../../../server/node/llm/character_evolution/range.cjs")

        expect(getNextUnprocessedMessageIndexForChat(settings, "chat-1")).toBe(5)
        expect(getNextUnprocessedMessageIndexForChat(settings, "chat-1")).toBe(getNextUnprocessedMessageIndexForChatCjs(settings, "chat-1"))
    })

    it("rebases accepted coverage after deleting a processed message from the same chat", () => {
        const nextSettings = rebaseEvolutionCoverageAfterMessageDeletion({
            lastProcessedChatId: "chat-1",
            lastProcessedMessageIndexByChat: {
                "chat-1": 3,
            },
            processedRanges: [
                {
                    version: 1,
                    acceptedAt: 10,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 0,
                        endMessageIndex: 3,
                    },
                },
            ],
            stateVersions: [
                {
                    version: 1,
                    chatId: "chat-1",
                    acceptedAt: 10,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 0,
                        endMessageIndex: 3,
                    },
                },
            ],
        }, "chat-1", 1, 1)

        expect(nextSettings.processedRanges).toEqual([
            {
                version: 1,
                acceptedAt: 10,
                range: {
                    chatId: "chat-1",
                    startMessageIndex: 0,
                    endMessageIndex: 2,
                },
            },
        ])
        expect(nextSettings.stateVersions[0]).toEqual({
            version: 1,
            chatId: "chat-1",
            acceptedAt: 10,
            range: {
                chatId: "chat-1",
                startMessageIndex: 0,
                endMessageIndex: 2,
            },
        })
        expect(nextSettings.lastProcessedMessageIndexByChat).toEqual({
            "chat-1": 2,
        })
        expect(getNextUnprocessedMessageIndexForChat(nextSettings, "chat-1")).toBe(3)
    })

    it("drops fully deleted coverage and shifts later ranges left", () => {
        const nextSettings = rebaseEvolutionCoverageAfterMessageDeletion({
            lastProcessedChatId: "chat-1",
            lastProcessedMessageIndexByChat: {
                "chat-1": 7,
            },
            processedRanges: [
                {
                    version: 1,
                    acceptedAt: 10,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 0,
                        endMessageIndex: 1,
                    },
                },
                {
                    version: 2,
                    acceptedAt: 20,
                    range: {
                        chatId: "chat-1",
                        startMessageIndex: 4,
                        endMessageIndex: 7,
                    },
                },
            ],
            stateVersions: [],
        }, "chat-1", 1, 4)

        expect(nextSettings.processedRanges).toEqual([
            {
                version: 1,
                acceptedAt: 10,
                range: {
                    chatId: "chat-1",
                    startMessageIndex: 0,
                    endMessageIndex: 0,
                },
            },
            {
                version: 2,
                acceptedAt: 20,
                range: {
                    chatId: "chat-1",
                    startMessageIndex: 1,
                    endMessageIndex: 3,
                },
            },
        ])
        expect(nextSettings.lastProcessedMessageIndexByChat).toEqual({
            "chat-1": 3,
        })
    })

    it("preserves unrelated cursor-only chats while rebasing the deleted chat cursor", () => {
        const nextSettings = rebaseEvolutionCoverageAfterMessageDeletion({
            lastProcessedChatId: "chat-legacy",
            lastProcessedMessageIndexByChat: {
                "chat-legacy": 5,
                "chat-1": 7,
            },
            processedRanges: [],
            stateVersions: [],
        }, "chat-1", 1, 4)

        expect(nextSettings.lastProcessedChatId).toBe("chat-legacy")
        expect(nextSettings.lastProcessedMessageIndexByChat).toEqual({
            "chat-legacy": 5,
            "chat-1": 3,
        })
    })

    it("clears lastProcessedChatId when rebasing removes the only processed cursor for that chat", () => {
        const nextSettings = rebaseEvolutionCoverageAfterMessageDeletion({
            lastProcessedChatId: "chat-1",
            lastProcessedMessageIndexByChat: {
                "chat-1": 0,
            },
            processedRanges: [],
            stateVersions: [],
        }, "chat-1", 0, 0)

        expect(nextSettings.lastProcessedChatId).toBeNull()
        expect(nextSettings.lastProcessedMessageIndexByChat).toEqual({
            "chat-1": -1,
        })
    })
})
