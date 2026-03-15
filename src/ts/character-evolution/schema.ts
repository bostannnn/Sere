import type {
    CharacterEvolutionDefaults,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionState,
} from "../storage/database.types"
import {
    BUILTIN_SECTION_DEFS,
    DEFAULT_EXTRACTION_PROMPT,
    DEFAULT_PRIVACY,
} from "./constants"
import { createCharacterEvolutionPromptProjectionPolicy } from "./projectionPolicy"
import { createCharacterEvolutionRetentionPolicy } from "./retentionPolicy"

export function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
}

export function createDefaultCharacterEvolutionState(): CharacterEvolutionState {
    return {
        relationship: {
            trustLevel: "",
            dynamic: "",
        },
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
        lastInteractionEnded: {
            state: "",
            residue: "",
        },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
    }
}

export function createDefaultCharacterEvolutionSectionConfigs(): CharacterEvolutionSectionConfig[] {
    return BUILTIN_SECTION_DEFS.map((section) => ({
        key: section.key,
        label: section.label,
        enabled: section.enabled ?? true,
        includeInPrompt: section.includeInPrompt ?? true,
        instruction: section.instruction,
        kind: section.kind,
        sensitive: section.sensitive ?? false,
    }))
}

export function createDefaultCharacterEvolutionDefaults(): CharacterEvolutionDefaults {
    return {
        extractionProvider: "openrouter",
        extractionModel: "",
        extractionMaxTokens: 2400,
        extractionPrompt: DEFAULT_EXTRACTION_PROMPT,
        sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        privacy: clone(DEFAULT_PRIVACY),
        promptProjection: createCharacterEvolutionPromptProjectionPolicy(),
        retention: createCharacterEvolutionRetentionPolicy(),
    }
}
