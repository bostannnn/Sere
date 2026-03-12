import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
    acceptCharacterEvolutionProposal: vi.fn(),
    createNewChatAfterEvolution: vi.fn(),
    DBState: {
        db: {
            characters: [] as Array<Record<string, unknown>>,
        },
    },
}))

vi.mock("src/ts/evolution", () => ({
    acceptCharacterEvolutionProposal: mocks.acceptCharacterEvolutionProposal,
    createNewChatAfterEvolution: mocks.createNewChatAfterEvolution,
    fetchCharacterEvolutionVersion: vi.fn(),
    listCharacterEvolutionVersions: vi.fn(async () => []),
    rejectCharacterEvolutionProposal: vi.fn(async () => {}),
}))

vi.mock("src/ts/stores.svelte", () => ({
    DBState: mocks.DBState,
    selIdState: { selId: 0 },
    OtherBotSettingsSubMenuIndex: { set: vi.fn() },
    SettingsMenuIndex: { set: vi.fn() },
    settingsOpen: { set: vi.fn() },
}))

import { acceptEvolutionProposalAction } from "./evolutionSettings.actions"

describe("acceptEvolutionProposalAction", () => {
    beforeEach(() => {
        mocks.createNewChatAfterEvolution.mockReset()
        mocks.acceptCharacterEvolutionProposal.mockReset()
        mocks.DBState.db.characters = [
            { type: "character", chaId: "char-1" },
            { type: "character", chaId: "char-2" },
        ]
    })

    it("resolves the new-chat target by character id after accept", async () => {
        mocks.acceptCharacterEvolutionProposal.mockImplementation(async () => {
            mocks.DBState.db.characters = [
                { type: "character", chaId: "char-2" },
                { type: "character", chaId: "char-1" },
            ]
            return {
                version: 4,
                state: {
                    relationship: { trustLevel: "", dynamic: "" },
                    activeThreads: [],
                    runningJokes: [],
                    characterLikes: [],
                    characterDislikes: [],
                    characterHabits: [],
                    characterBoundariesPreferences: [],
                    userFacts: [],
                    userRead: [],
                    userLikes: [],
                    userDislikes: [],
                    lastInteractionEnded: { state: "", residue: "" },
                    keyMoments: [],
                    characterIntimatePreferences: [],
                    userIntimatePreferences: [],
                },
            }
        })

        await acceptEvolutionProposalAction({
            characterId: "char-1",
            proposedState: {
                relationship: { trustLevel: "", dynamic: "" },
                activeThreads: [],
                runningJokes: [],
                characterLikes: [],
                characterDislikes: [],
                characterHabits: [],
                characterBoundariesPreferences: [],
                userFacts: [],
                userRead: [],
                userLikes: [],
                userDislikes: [],
                lastInteractionEnded: { state: "", residue: "" },
                keyMoments: [],
                characterIntimatePreferences: [],
                userIntimatePreferences: [],
            },
            createNextChat: true,
        })

        expect(mocks.createNewChatAfterEvolution).toHaveBeenCalledTimes(1)
        expect(mocks.createNewChatAfterEvolution).toHaveBeenCalledWith(1)
    })
})
