import { afterEach, describe, expect, it, vi } from "vitest"

import { getNewChatFirstMessageIndex } from "./newChatFirstMessage"

describe("getNewChatFirstMessageIndex", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it("returns -1 for group chats", () => {
        expect(getNewChatFirstMessageIndex({
            type: "group",
            randomAltFirstMessageOnNewChat: true,
            alternateGreetings: ["a", "b"],
        })).toBe(-1)
    })

    it("returns -1 when toggle is disabled", () => {
        expect(getNewChatFirstMessageIndex({
            type: "character",
            randomAltFirstMessageOnNewChat: false,
            alternateGreetings: ["a", "b"],
        })).toBe(-1)
    })

    it("returns -1 when there are no alternate greetings", () => {
        expect(getNewChatFirstMessageIndex({
            type: "character",
            randomAltFirstMessageOnNewChat: true,
            alternateGreetings: [],
        })).toBe(-1)
    })

    it("uses random source when available", () => {
        const randomSource = {
            getRandomValues: (array: Uint32Array) => {
                array[0] = 8
                return array
            },
        }

        expect(getNewChatFirstMessageIndex({
            type: "character",
            randomAltFirstMessageOnNewChat: true,
            alternateGreetings: ["a", "b", "c"],
        }, randomSource)).toBe(2)
    })

    it("uses global crypto when explicit random source is not passed", () => {
        vi.stubGlobal("crypto", {
            getRandomValues: (array: Uint32Array) => {
                array[0] = 5
                return array
            },
        })

        expect(getNewChatFirstMessageIndex({
            type: "character",
            randomAltFirstMessageOnNewChat: true,
            alternateGreetings: ["a", "b", "c", "d"],
        })).toBe(1)
    })

    it("falls back to deterministic selection when random source is unavailable", () => {
        vi.stubGlobal("crypto", undefined)

        const char = {
            type: "character" as const,
            randomAltFirstMessageOnNewChat: true,
            alternateGreetings: ["a", "b", "c", "d"],
            chaId: "char-1",
            chats: [{}, {}],
            name: "Yuki",
        }

        const first = getNewChatFirstMessageIndex(char)
        const second = getNewChatFirstMessageIndex(char)

        expect(first).toBeGreaterThanOrEqual(0)
        expect(first).toBeLessThan(char.alternateGreetings.length)
        expect(second).toBe(first)
    })

    it("changes deterministic selection when seed changes", () => {
        vi.stubGlobal("crypto", undefined)

        const base = {
            type: "character" as const,
            randomAltFirstMessageOnNewChat: true,
            alternateGreetings: ["a", "b", "c", "d"],
            chaId: "char-1",
            chats: [{}],
            name: "Yuki",
        }

        const a = getNewChatFirstMessageIndex(base)
        const b = getNewChatFirstMessageIndex({
            ...base,
            chats: [{}, {}],
        })

        expect(a).not.toBe(b)
    })
})
