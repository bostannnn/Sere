import { describe, expect, it, vi, beforeEach } from "vitest"

const mocks = vi.hoisted(() => ({
    acceptCharacterEvolutionProposal: vi.fn(),
    createNewChatAfterEvolution: vi.fn(),
    evolutionDefaultsSettingsTabIndexSet: vi.fn(),
    otherBotSettingsSubMenuIndexSet: vi.fn(),
    settingsMenuIndexSet: vi.fn(),
    settingsOpenSet: vi.fn(),
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
    EvolutionDefaultsSettingsTabIndex: { set: mocks.evolutionDefaultsSettingsTabIndexSet },
    OtherBotSettingsSubMenuIndex: { set: mocks.otherBotSettingsSubMenuIndexSet },
    SettingsMenuIndex: { set: mocks.settingsMenuIndexSet },
    settingsOpen: { set: mocks.settingsOpenSet },
}))

import { acceptEvolutionProposalAction, openEvolutionGlobalDefaults } from "./evolutionSettings.actions"

describe("evolutionSettings.actions", () => {
    beforeEach(() => {
        mocks.createNewChatAfterEvolution.mockReset()
        mocks.acceptCharacterEvolutionProposal.mockReset()
        mocks.evolutionDefaultsSettingsTabIndexSet.mockReset()
        mocks.otherBotSettingsSubMenuIndexSet.mockReset()
        mocks.settingsMenuIndexSet.mockReset()
        mocks.settingsOpenSet.mockReset()
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

    it("opens Other Bots Evolution on the global defaults tab", () => {
        openEvolutionGlobalDefaults()

        expect(mocks.evolutionDefaultsSettingsTabIndexSet).toHaveBeenCalledTimes(1)
        expect(mocks.evolutionDefaultsSettingsTabIndexSet).toHaveBeenCalledWith(0)
        expect(mocks.otherBotSettingsSubMenuIndexSet).toHaveBeenCalledTimes(1)
        expect(mocks.otherBotSettingsSubMenuIndexSet).toHaveBeenCalledWith(3)
        expect(mocks.settingsMenuIndexSet).toHaveBeenCalledTimes(1)
        expect(mocks.settingsMenuIndexSet).toHaveBeenCalledWith(2)
        expect(mocks.settingsOpenSet).toHaveBeenCalledTimes(1)
        expect(mocks.settingsOpenSet).toHaveBeenCalledWith(true)
    })
})
