import type {
    CharacterEvolutionItem,
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionPromptProjectionPolicy,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionState,
} from "../storage/database.types"
import { isCharacterEvolutionObjectSection } from "./items"
import {
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
} from "./normalizers"
import { projectCharacterEvolutionStateForPrompt } from "./projection"

function itemToLine(item: CharacterEvolutionItem): string {
    const confidence = item.confidence ? ` [${item.confidence}]` : ""
    const note = item.note?.trim() ? ` (${item.note.trim()})` : ""
    return `- ${item.value}${confidence}${note}`
}

export function renderCharacterEvolutionStateForPrompt(
    stateRaw: CharacterEvolutionState,
    sectionConfigsRaw: CharacterEvolutionSectionConfig[],
    privacyRaw?: CharacterEvolutionPrivacySettings,
    promptProjectionRaw?: CharacterEvolutionPromptProjectionPolicy | null,
): string {
    const state = projectCharacterEvolutionStateForPrompt(stateRaw, "generation", promptProjectionRaw)
    const sectionConfigs = normalizeCharacterEvolutionSectionConfigs(sectionConfigsRaw)
    const privacy = normalizeCharacterEvolutionPrivacy(privacyRaw)
    const lines: string[] = []

    const pushSection = (label: string, content: string[]) => {
        const filtered = content.map((value) => value.trim()).filter(Boolean)
        if (filtered.length === 0) return
        lines.push(label)
        lines.push(...filtered)
        lines.push("")
    }

    for (const section of sectionConfigs) {
        if (!section.enabled || !section.includeInPrompt) continue
        if (section.key === "characterIntimatePreferences" && !privacy.allowCharacterIntimatePreferences) continue
        if (section.key === "userIntimatePreferences" && !privacy.allowUserIntimatePreferences) continue

        if (section.key === "relationship") {
            pushSection(section.label, [
                state.relationship.trustLevel ? `Trust level: ${state.relationship.trustLevel}` : "",
                state.relationship.dynamic ? `Dynamic: ${state.relationship.dynamic}` : "",
            ])
            continue
        }

        if (section.key === "lastInteractionEnded") {
            pushSection(section.label, [
                state.lastInteractionEnded.state ? `State: ${state.lastInteractionEnded.state}` : "",
                state.lastInteractionEnded.residue ? `Residue: ${state.lastInteractionEnded.residue}` : "",
            ])
            continue
        }

        if (isCharacterEvolutionObjectSection(section.key)) {
            continue
        }

        pushSection(section.label, (state[section.key] as CharacterEvolutionItem[])
            .map((item) => itemToLine(item)))
    }

    if (lines.length === 0) {
        return ""
    }

    return ["<CharacterEvolutionState>", ...lines, "</CharacterEvolutionState>"].join("\n").trim()
}
