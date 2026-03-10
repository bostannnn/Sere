import type { Database, character, groupChat, CharacterEvolutionSettings } from "../storage/database.types"
import {
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSettings,
} from "./normalizers"

export function getEffectiveCharacterEvolutionSettings(db: Database, char: character | groupChat): CharacterEvolutionSettings {
    const defaults = normalizeCharacterEvolutionDefaults(db.characterEvolutionDefaults)
    const settings = normalizeCharacterEvolutionSettings(char.characterEvolution)
    if (!settings.useGlobalDefaults) {
        return settings
    }
    return {
        ...settings,
        extractionProvider: defaults.extractionProvider,
        extractionModel: defaults.extractionModel,
        extractionMaxTokens: defaults.extractionMaxTokens,
        extractionPrompt: defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(defaults.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(defaults.privacy),
    }
}

export function hasCharacterStateTemplateBlock(db: Database): boolean {
    return Array.isArray(db.promptTemplate) && db.promptTemplate.some((item) => item?.type === "characterState")
}
