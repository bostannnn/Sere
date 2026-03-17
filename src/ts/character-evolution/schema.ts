import type {
    CharacterEvolutionDefaults,
    CharacterEvolutionSemanticRecallSectionKey,
    CharacterEvolutionSemanticRecallSettings,
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

export const CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS = [
    "characterLikes",
    "characterDislikes",
    "characterHabits",
    "userFacts",
    "userLikes",
    "userDislikes",
    "keyMoments",
] as const satisfies ReadonlyArray<CharacterEvolutionSemanticRecallSectionKey>

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
        instruction: "",
        kind: section.kind,
        sensitive: section.sensitive ?? false,
    }))
}

export function createDefaultCharacterEvolutionSemanticRecallSettings(): CharacterEvolutionSemanticRecallSettings {
    return {
        enabled: false,
        embeddingModel: "MiniLM",
        minScore: 0.42,
        maxItems: 3,
        queryMessageWindow: 4,
        sections: {
            characterLikes: false,
            characterDislikes: false,
            characterHabits: false,
            userFacts: true,
            userLikes: false,
            userDislikes: false,
            keyMoments: false,
        },
        sectionLimits: {
            characterLikes: 0,
            characterDislikes: 0,
            characterHabits: 0,
            userFacts: 0,
            userLikes: 0,
            userDislikes: 0,
            keyMoments: 0,
        },
    }
}

export function createDefaultCharacterEvolutionDefaults(): CharacterEvolutionDefaults {
    return {
        extractionProvider: "openrouter",
        extractionModel: "",
        extractionMaxTokens: 2400,
        extractionPrompt: "",
        sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        privacy: clone(DEFAULT_PRIVACY),
        promptProjection: createCharacterEvolutionPromptProjectionPolicy(),
        retention: createCharacterEvolutionRetentionPolicy(),
        semanticRecall: createDefaultCharacterEvolutionSemanticRecallSettings(),
    }
}
