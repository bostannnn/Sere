import { describe, expect, it } from "vitest"
import { createDefaultCharacterEvolutionSectionConfigs } from "src/ts/characterEvolution"
import type {
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionRuntimeSettings,
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

function createStoredEvolutionSettings(
    overrides: Partial<CharacterEvolutionRuntimeSettings> = {},
): CharacterEvolutionRuntimeSettings {
    return {
        enabled: true,
        currentStateVersion: 3,
        currentState: createState(),
        pendingProposal: null,
        stateVersions: [],
        ...overrides,
    }
}

function createCharacter(
    evolutionOverrides: Partial<CharacterEvolutionRuntimeSettings> = {},
): character {
    return {
        chaId: "char-1",
        characterEvolution: createStoredEvolutionSettings(evolutionOverrides),
    } as unknown as character
}

describe("evolutionSettings.drafts", () => {
    it("hydrates section drafts from effective settings", () => {
        const characterEntry = createCharacter()
        const evolutionSettings = createEvolutionSettings({
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

    it("ignores stored character policy remnants when hydrating section drafts", () => {
        const characterEntry = createCharacter()
        const snapshot = createSectionDraftSnapshot({
            characterEntry,
            evolutionSettings: createEvolutionSettings({
                sectionConfigs: createSectionConfigs("effective"),
                privacy: createPrivacy({ allowUserIntimatePreferences: true }),
            }),
        })

        expect(snapshot.sectionConfigDraft).toEqual(createSectionConfigs("effective"))
        expect(snapshot.privacyDraft).toEqual(createPrivacy({ allowUserIntimatePreferences: true }))
    })

    it("returns no sync payload when normalized drafts match the base character", () => {
        const baseCharacter = createCharacter({
            currentState: createState(),
        })
        const evolutionSettings = createEvolutionSettings({
            sectionConfigs: createSectionConfigs("effective"),
            privacy: createPrivacy({ allowUserIntimatePreferences: true }),
        })

        const nextEvolution = buildEvolutionSyncSettings({
            baseCharacter,
            currentStateDraft: createCurrentStateDraft(baseCharacter),
            sectionConfigDraft: structuredClone(evolutionSettings.sectionConfigs),
            privacyDraft: structuredClone(evolutionSettings.privacy),
        })

        expect(nextEvolution).toBeNull()
    })

    it("updates state while ignoring section and privacy drafts", () => {
        const baseCharacter = createCharacter({
            currentState: createState(),
        })
        const nextSectionDraft = createSectionConfigs("changed")
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
        expect(nextEvolution?.currentState.keyMoments).toMatchObject([
            {
                value: "met at the station",
                status: "active",
            },
        ])
        expect("sectionConfigs" in (nextEvolution ?? {})).toBe(false)
        expect("privacy" in (nextEvolution ?? {})).toBe(false)
    })

    it("ignores section and privacy drafts when state is unchanged", () => {
        const baseCharacter = createCharacter()

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
            currentStateVersion: 7,
        })
        const evolutionSettings = createEvolutionSettings({
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
