import { describe, expect, it } from "vitest"
import { createDefaultCharacterEvolutionSectionConfigs } from "src/ts/characterEvolution"
import type {
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSettings,
    CharacterEvolutionState,
    character,
} from "src/ts/storage/database.types"
import {
    buildEvolutionSyncSettings,
    createCurrentStateDraft,
    createSectionDraftSnapshot,
    getCurrentStateDraftHydrationKey,
    getSectionDraftHydrationKey,
} from "./evolutionSettings.drafts"

function createState(overrides: Partial<CharacterEvolutionState> = {}): CharacterEvolutionState {
    return {
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
        ...overrides,
    }
}

function createPrivacy(
    overrides: Partial<CharacterEvolutionPrivacySettings> = {},
): CharacterEvolutionPrivacySettings {
    return {
        allowCharacterIntimatePreferences: false,
        allowUserIntimatePreferences: false,
        ...overrides,
    }
}

function createSectionConfigs(
    labelPrefix: string,
): CharacterEvolutionSectionConfig[] {
    return createDefaultCharacterEvolutionSectionConfigs().map((section, index) => ({
        ...section,
        label: `${labelPrefix} ${index}`,
    }))
}

function createEvolutionSettings(
    overrides: Partial<CharacterEvolutionSettings> = {},
): CharacterEvolutionSettings {
    return {
        enabled: true,
        useGlobalDefaults: false,
        extractionProvider: "openrouter",
        extractionModel: "model-a",
        extractionMaxTokens: 2400,
        extractionPrompt: "",
        sectionConfigs: createSectionConfigs("local"),
        privacy: createPrivacy(),
        currentStateVersion: 3,
        currentState: createState(),
        pendingProposal: null,
        stateVersions: [],
        ...overrides,
    }
}

function createCharacter(
    evolutionOverrides: Partial<CharacterEvolutionSettings> = {},
): character {
    return {
        chaId: "char-1",
        characterEvolution: createEvolutionSettings(evolutionOverrides),
    } as character
}

describe("evolutionSettings.drafts", () => {
    it("hydrates section drafts from effective settings when using global defaults", () => {
        const characterEntry = createCharacter({
            useGlobalDefaults: true,
            sectionConfigs: createSectionConfigs("character"),
            privacy: createPrivacy({ allowCharacterIntimatePreferences: true }),
        })
        const evolutionSettings = createEvolutionSettings({
            useGlobalDefaults: true,
            sectionConfigs: createSectionConfigs("effective"),
            privacy: createPrivacy({ allowUserIntimatePreferences: true }),
        })

        const snapshot = createSectionDraftSnapshot({
            characterEntry,
            evolutionSettings,
        })

        expect(snapshot.sectionConfigDraft).toEqual(evolutionSettings.sectionConfigs)
        expect(snapshot.sectionConfigDraft).not.toBe(evolutionSettings.sectionConfigs)
        expect(snapshot.privacyDraft).toEqual(evolutionSettings.privacy)
    })

    it("hydrates local section drafts when character overrides are active", () => {
        const characterEntry = createCharacter({
            useGlobalDefaults: false,
            sectionConfigs: createSectionConfigs("character"),
            privacy: createPrivacy({ allowCharacterIntimatePreferences: true }),
        })

        const snapshot = createSectionDraftSnapshot({
            characterEntry,
            evolutionSettings: createEvolutionSettings({
                useGlobalDefaults: true,
                sectionConfigs: createSectionConfigs("effective"),
            }),
        })

        expect(snapshot.sectionConfigDraft).toEqual(characterEntry.characterEvolution?.sectionConfigs)
        expect(snapshot.privacyDraft).toEqual(characterEntry.characterEvolution?.privacy)
    })

    it("returns no sync payload when normalized drafts match the base character", () => {
        const baseCharacter = createCharacter({
            useGlobalDefaults: false,
            currentState: createState(),
            sectionConfigs: createSectionConfigs("local"),
            privacy: createPrivacy({ allowUserIntimatePreferences: true }),
        })

        const nextEvolution = buildEvolutionSyncSettings({
            baseCharacter,
            currentStateDraft: createCurrentStateDraft(baseCharacter),
            sectionConfigDraft: structuredClone(baseCharacter.characterEvolution?.sectionConfigs ?? []),
            privacyDraft: structuredClone(baseCharacter.characterEvolution?.privacy ?? createPrivacy()),
        })

        expect(nextEvolution).toBeNull()
    })

    it("updates state, sections, and privacy when local drafts changed", () => {
        const baseCharacter = createCharacter({
            useGlobalDefaults: false,
            currentState: createState(),
            sectionConfigs: createSectionConfigs("local"),
            privacy: createPrivacy(),
        })
        const nextSectionDraft = structuredClone(baseCharacter.characterEvolution?.sectionConfigs ?? [])
        nextSectionDraft[0] = {
            ...nextSectionDraft[0],
            enabled: !nextSectionDraft[0].enabled,
            label: "updated section",
        }

        const nextEvolution = buildEvolutionSyncSettings({
            baseCharacter,
            currentStateDraft: createState({
                keyMoments: [
                    {
                        value: "met at the station",
                        status: "active",
                    },
                ],
            }),
            sectionConfigDraft: nextSectionDraft,
            privacyDraft: createPrivacy({ allowCharacterIntimatePreferences: true }),
        })

        expect(nextEvolution).not.toBeNull()
        expect(nextEvolution?.currentState.keyMoments).toEqual([
            expect.objectContaining({
                value: "met at the station",
                status: "active",
                note: "",
            }),
        ])
        expect(nextEvolution?.sectionConfigs[0]).toMatchObject({
            enabled: nextSectionDraft[0].enabled,
            label: "updated section",
        })
        expect(nextEvolution?.privacy.allowCharacterIntimatePreferences).toBe(true)
    })

    it("ignores local section and privacy drafts when the character uses global defaults", () => {
        const baseCharacter = createCharacter({
            useGlobalDefaults: true,
            sectionConfigs: createSectionConfigs("local"),
            privacy: createPrivacy(),
        })

        const nextEvolution = buildEvolutionSyncSettings({
            baseCharacter,
            currentStateDraft: null,
            sectionConfigDraft: createSectionConfigs("changed"),
            privacyDraft: createPrivacy({ allowCharacterIntimatePreferences: true }),
        })

        expect(nextEvolution).toBeNull()
    })

    it("builds stable hydration keys for section and state drafts", () => {
        const characterEntry = createCharacter({
            useGlobalDefaults: true,
            currentStateVersion: 7,
        })
        const evolutionSettings = createEvolutionSettings({
            useGlobalDefaults: true,
            sectionConfigs: createSectionConfigs("effective"),
        })

        expect(getSectionDraftHydrationKey({
            characterEntry,
            evolutionSettings,
        })).toContain("char-1:global:")
        expect(getCurrentStateDraftHydrationKey(characterEntry)).toBe("char-1:7")
    })

    it("hydrates canonical phase 2 state fields without reintroducing legacy lastChatEnded", () => {
        const baseCharacter = createCharacter({
            currentState: createState({
                lastInteractionEnded: {
                    state: "close and reflective",
                    residue: "movie talk should carry forward",
                },
                keyMoments: [
                    {
                        value: "Eva explicitly named Dead Man as a desert-island film",
                        confidence: "confirmed",
                        status: "active",
                        note: "canonical item-object row",
                    },
                ],
            }),
        })

        const draft = createCurrentStateDraft(baseCharacter)

        expect(draft).toEqual(createState({
            lastInteractionEnded: {
                state: "close and reflective",
                residue: "movie talk should carry forward",
            },
            keyMoments: [
                {
                    value: "Eva explicitly named Dead Man as a desert-island film",
                    confidence: "confirmed",
                    status: "active",
                    note: "canonical item-object row",
                },
            ],
        }))
        expect(Object.prototype.hasOwnProperty.call(draft, "lastChatEnded")).toBe(false)
    })
})
