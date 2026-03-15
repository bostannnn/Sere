import { describe, expect, it } from "vitest"

import {
    getCharacterEvolutionProcessedRanges,
    getLastProcessedMessageIndexForChat,
    hasAcceptedEvolutionForChat,
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
})
