import { afterEach, beforeEach, describe, expect, it } from "vitest"
import * as path from "node:path"
import { readFileSync } from "node:fs"

import { renderCharacterEvolutionStateForPrompt } from "../../../src/ts/character-evolution/render"
import { createDefaultCharacterEvolutionSectionConfigs } from "../../../src/ts/character-evolution/schema"
import {
    buildHandlers,
    characterId,
    chatId,
    cleanupEvolutionRouteTest,
    createReq,
    createRes,
    getDataDirs,
    setupEvolutionRouteTest,
    writeJson,
} from "./evolution_routes.test_helpers"

beforeEach(() => {
    setupEvolutionRouteTest()
})

afterEach(() => {
    cleanupEvolutionRouteTest()
})

describe("evolution routes phase 4 manual smoke", () => {
    it("walks a mixed handoff and accept workflow without leaking corrected or archived items into prompt state", async () => {
        const dataDirs = getDataDirs()
        const characterFile = path.join(dataDirs.characters, characterId, "character.json")

        writeJson(characterFile, {
            character: {
                chaId: characterId,
                type: "character",
                name: "Eva",
                desc: "desc",
                personality: "personality",
                characterEvolution: {
                    enabled: true,
                    useGlobalDefaults: false,
                    extractionProvider: "openrouter",
                    extractionModel: "anthropic/claude-3.5-haiku",
                    extractionMaxTokens: 2400,
                    extractionPrompt: "prompt",
                    currentStateVersion: 1,
                    currentState: {
                        relationship: {
                            trustLevel: "steady",
                            dynamic: "warm",
                        },
                        lastInteractionEnded: {
                            state: "hopeful",
                            residue: "easy warmth",
                        },
                        userFacts: [
                            {
                                value: "user lives in Berlin",
                                status: "active",
                                confidence: "likely",
                                note: "older location",
                                sourceChatId: "chat-old",
                                updatedAt: 100,
                                lastSeenAt: 100,
                                timesSeen: 2,
                            },
                        ],
                        activeThreads: [
                            {
                                value: "keep the ferry plan alive",
                                status: "active",
                                confidence: "likely",
                                sourceChatId: "chat-old",
                                updatedAt: 100,
                                lastSeenAt: 100,
                                timesSeen: 2,
                            },
                        ],
                        characterLikes: [
                            {
                                value: "user likes dark fantasy books",
                                status: "active",
                                confidence: "likely",
                                sourceChatId: "chat-old",
                                updatedAt: 100,
                                lastSeenAt: 100,
                                timesSeen: 2,
                            },
                        ],
                        userLikes: [
                            {
                                value: "user likes tea",
                                status: "active",
                                confidence: "likely",
                                note: "older preference call",
                                sourceChatId: "chat-old",
                                updatedAt: 100,
                                lastSeenAt: 100,
                                timesSeen: 2,
                            },
                        ],
                    },
                    pendingProposal: null,
                    stateVersions: [],
                    lastProcessedChatId: null,
                },
            },
        })

        const { postHandlers } = buildHandlers({
            executeInternalLLMTextCompletion: async () => JSON.stringify({
                proposedState: {
                    relationship: {
                        trustLevel: "closer",
                        dynamic: "playful and collaborative",
                    },
                    lastInteractionEnded: {
                        state: "energized",
                        residue: "shared momentum",
                    },
                    userFacts: [
                        {
                            value: "user lives in Berlin",
                            status: "active",
                            confidence: "likely",
                            note: "older location",
                        },
                        {
                            value: "user lives in Moscow",
                            status: "active",
                            confidence: "confirmed",
                            note: "new explicit move",
                        },
                    ],
                    activeThreads: [
                        {
                            value: "keep the ferry plan alive",
                            status: "active",
                            confidence: "likely",
                        },
                        {
                            value: "the ferry plan is resolved",
                            status: "active",
                            confidence: "confirmed",
                        },
                    ],
                    characterLikes: [
                        {
                            value: "user likes dark fantasy books",
                            status: "active",
                            confidence: "likely",
                        },
                        {
                            value: "user likes dark fantasy movies",
                            status: "active",
                            confidence: "likely",
                        },
                    ],
                    userLikes: [
                        {
                            value: "user likes tea",
                            status: "active",
                            confidence: "likely",
                            note: "older preference call",
                        },
                        {
                            value: "user dislikes tea",
                            status: "active",
                            confidence: "confirmed",
                            note: "new contradictory evidence",
                        },
                    ],
                },
                changes: [
                    {
                        sectionKey: "userFacts",
                        summary: "The user location changed.",
                        evidence: ["They explicitly moved to Moscow."],
                    },
                    {
                        sectionKey: "activeThreads",
                        summary: "The ferry plan resolved.",
                        evidence: ["They closed out the ferry plan."],
                    },
                    {
                        sectionKey: "characterLikes",
                        summary: "A second compatible preference was added.",
                        evidence: ["They also like dark fantasy movies."],
                    },
                    {
                        sectionKey: "userLikes",
                        summary: "The user's tea stance reversed.",
                        evidence: ["They now say they dislike tea."],
                    },
                ],
            }),
        })

        const handoff = postHandlers.get("/data/character-evolution/handoff")
        expect(handoff).toBeTruthy()

        const handoffRes = createRes()
        await handoff!(createReq({ characterId, chatId }), handoffRes)

        expect(handoffRes.statusCode).toBe(200)
        expect(handoffRes.payload.proposal.proposedState.relationship).toEqual({
            trustLevel: "closer",
            dynamic: "playful and collaborative",
        })
        expect(handoffRes.payload.proposal.proposedState.lastInteractionEnded).toEqual({
            state: "energized",
            residue: "shared momentum",
        })
        expect(handoffRes.payload.proposal.proposedState.userFacts).toEqual([
            expect.objectContaining({
                value: "user lives in Berlin",
                status: "corrected",
                confidence: "likely",
            }),
            expect.objectContaining({
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
                sourceChatId: chatId,
            }),
        ])
        expect(handoffRes.payload.proposal.proposedState.activeThreads).toEqual([
            expect.objectContaining({
                value: "keep the ferry plan alive",
                status: "archived",
                confidence: "likely",
            }),
            expect.objectContaining({
                value: "the ferry plan is resolved",
                status: "archived",
                confidence: "confirmed",
                sourceChatId: chatId,
            }),
        ])
        expect(handoffRes.payload.proposal.proposedState.characterLikes).toEqual([
            expect.objectContaining({
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
            }),
            expect.objectContaining({
                value: "user likes dark fantasy movies",
                status: "active",
                confidence: "likely",
                sourceChatId: chatId,
            }),
        ])
        expect(handoffRes.payload.proposal.proposedState.userLikes).toEqual([
            expect.objectContaining({
                value: "user likes tea",
                status: "corrected",
                confidence: "likely",
            }),
            expect.objectContaining({
                value: "user dislikes tea",
                status: "active",
                confidence: "confirmed",
                sourceChatId: chatId,
            }),
        ])

        const accept = postHandlers.get("/data/character-evolution/:charId/proposal/accept")
        expect(accept).toBeTruthy()

        const acceptRes = createRes()
        await accept!(createReq({}, { charId: characterId }), acceptRes)

        expect(acceptRes.statusCode).toBe(200)
        expect(acceptRes.payload.state.relationship).toEqual({
            trustLevel: "closer",
            dynamic: "playful and collaborative",
        })
        expect(acceptRes.payload.state.lastInteractionEnded).toEqual({
            state: "energized",
            residue: "shared momentum",
        })
        expect(acceptRes.payload.state.userFacts).toEqual([
            expect.objectContaining({
                value: "user lives in Berlin",
                status: "corrected",
                confidence: "likely",
                sourceChatId: "chat-old",
                timesSeen: 2,
            }),
            expect.objectContaining({
                value: "user lives in Moscow",
                status: "active",
                confidence: "confirmed",
                sourceChatId: chatId,
                timesSeen: 1,
            }),
        ])
        expect(acceptRes.payload.state.activeThreads).toEqual([
            expect.objectContaining({
                value: "keep the ferry plan alive",
                status: "archived",
                confidence: "likely",
                sourceChatId: "chat-old",
                timesSeen: 2,
            }),
            expect.objectContaining({
                value: "the ferry plan is resolved",
                status: "archived",
                confidence: "confirmed",
                sourceChatId: chatId,
                timesSeen: 1,
            }),
        ])
        expect(acceptRes.payload.state.characterLikes).toEqual([
            expect.objectContaining({
                value: "user likes dark fantasy books",
                status: "active",
                confidence: "likely",
                sourceChatId: "chat-old",
                timesSeen: 2,
            }),
            expect.objectContaining({
                value: "user likes dark fantasy movies",
                status: "active",
                confidence: "likely",
                sourceChatId: chatId,
                timesSeen: 1,
            }),
        ])
        expect(acceptRes.payload.state.userLikes).toEqual([
            expect.objectContaining({
                value: "user likes tea",
                status: "corrected",
                confidence: "likely",
                sourceChatId: "chat-old",
                timesSeen: 2,
            }),
            expect.objectContaining({
                value: "user dislikes tea",
                status: "active",
                confidence: "confirmed",
                sourceChatId: chatId,
                timesSeen: 1,
            }),
        ])

        const persistedCharacter = JSON.parse(readFileSync(characterFile, "utf-8")).character
        const rendered = renderCharacterEvolutionStateForPrompt(
            persistedCharacter.characterEvolution.currentState,
            createDefaultCharacterEvolutionSectionConfigs(),
        )

        expect(rendered).toContain("Trust level: closer")
        expect(rendered).toContain("State: energized")
        expect(rendered).toContain("user lives in Moscow")
        expect(rendered).toContain("user likes dark fantasy books")
        expect(rendered).toContain("user likes dark fantasy movies")
        expect(rendered).toContain("user dislikes tea")
        expect(rendered).not.toContain("user lives in Berlin")
        expect(rendered).not.toContain("keep the ferry plan alive")
        expect(rendered).not.toContain("the ferry plan is resolved")
        expect(rendered).not.toContain("user likes tea")
    })
})
