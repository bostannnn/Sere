import type {
    CharacterEvolutionItem,
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionState,
} from "../storage/database.types"
import {
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionState,
} from "./normalizers"

function itemToLine(item: CharacterEvolutionItem): string {
    const note = item.note?.trim() ? ` (${item.note.trim()})` : ""
    const confidence = item.confidence ? ` [${item.confidence}]` : ""
    return `- ${item.value}${confidence}${note}`
}

export function renderCharacterEvolutionStateForPrompt(
    stateRaw: CharacterEvolutionState,
    sectionConfigsRaw: CharacterEvolutionSectionConfig[],
    privacyRaw?: CharacterEvolutionPrivacySettings,
): string {
    const state = normalizeCharacterEvolutionState(stateRaw)
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

        switch (section.key) {
            case "relationship":
                pushSection(section.label, [
                    state.relationship.trustLevel ? `Trust level: ${state.relationship.trustLevel}` : "",
                    state.relationship.dynamic ? `Dynamic: ${state.relationship.dynamic}` : "",
                ])
                break
            case "activeThreads":
            case "runningJokes":
            case "keyMoments":
            case "userRead":
                pushSection(section.label, (state[section.key] as string[]).map((item) => `- ${item}`))
                break
            case "lastChatEnded":
                pushSection(section.label, [
                    state.lastChatEnded.state ? `State: ${state.lastChatEnded.state}` : "",
                    state.lastChatEnded.residue ? `Residue: ${state.lastChatEnded.residue}` : "",
                ])
                break
            default:
                pushSection(section.label, (state[section.key] as CharacterEvolutionItem[])
                    .filter((item) => item.status !== "archived")
                    .map((item) => itemToLine(item)))
                break
        }
    }

    if (lines.length === 0) {
        return ""
    }

    return ["<CharacterEvolutionState>", ...lines, "</CharacterEvolutionState>"].join("\n").trim()
}
