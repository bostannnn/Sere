import type {
    CharacterEvolutionItem,
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionPromptProjectionPolicy,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSectionKey,
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
    return `- ${item.value}${confidence}`
}

export const CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS = {
    characterState: [
        "characterLikes",
        "characterDislikes",
        "characterHabits",
        "characterIntimatePreferences",
    ],
    userState: [
        "userFacts",
        "userRead",
        "userLikes",
        "userDislikes",
        "userIntimatePreferences",
    ],
    relationshipState: [
        "relationship",
        "activeThreads",
        "runningJokes",
        "lastInteractionEnded",
        "keyMoments",
    ],
} as const satisfies Record<"characterState" | "userState" | "relationshipState", CharacterEvolutionSectionKey[]>

const CHARACTER_EVOLUTION_PROMPT_BLOCK_ROOT_TAG = {
    characterState: "CharacterState",
    userState: "UserState",
    relationshipState: "RelationshipState",
} as const satisfies Record<keyof typeof CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS, string>

function renderCharacterEvolutionStateSectionsForPrompt(args: {
    stateRaw: CharacterEvolutionState
    sectionConfigsRaw: CharacterEvolutionSectionConfig[]
    privacyRaw?: CharacterEvolutionPrivacySettings
    promptProjectionRaw?: CharacterEvolutionPromptProjectionPolicy | null
    allowedSectionKeys?: readonly CharacterEvolutionSectionKey[]
    rootTag?: string
}): string {
    const {
        stateRaw,
        sectionConfigsRaw,
        privacyRaw,
        promptProjectionRaw,
        allowedSectionKeys,
        rootTag = "CharacterEvolutionState",
    } = args

    const state = projectCharacterEvolutionStateForPrompt(stateRaw, "generation", promptProjectionRaw)
    const sectionConfigs = normalizeCharacterEvolutionSectionConfigs(sectionConfigsRaw)
    const privacy = normalizeCharacterEvolutionPrivacy(privacyRaw)
    const allowedSectionKeySet = allowedSectionKeys ? new Set(allowedSectionKeys) : null
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
        if (allowedSectionKeySet && !allowedSectionKeySet.has(section.key)) continue
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

    return [`<${rootTag}>`, ...lines, `</${rootTag}>`].join("\n").trim()
}

export function renderCharacterEvolutionPromptBlockForPrompt(
    blockType: keyof typeof CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS,
    stateRaw: CharacterEvolutionState,
    sectionConfigsRaw: CharacterEvolutionSectionConfig[],
    privacyRaw?: CharacterEvolutionPrivacySettings,
    promptProjectionRaw?: CharacterEvolutionPromptProjectionPolicy | null,
): string {
    return renderCharacterEvolutionStateSectionsForPrompt({
        stateRaw,
        sectionConfigsRaw,
        privacyRaw,
        promptProjectionRaw,
        allowedSectionKeys: CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS[blockType],
        rootTag: CHARACTER_EVOLUTION_PROMPT_BLOCK_ROOT_TAG[blockType],
    })
}

export function renderCharacterEvolutionStateForPrompt(
    stateRaw: CharacterEvolutionState,
    sectionConfigsRaw: CharacterEvolutionSectionConfig[],
    privacyRaw?: CharacterEvolutionPrivacySettings,
    promptProjectionRaw?: CharacterEvolutionPromptProjectionPolicy | null,
): string {
    return renderCharacterEvolutionStateSectionsForPrompt({
        stateRaw,
        sectionConfigsRaw,
        privacyRaw,
        promptProjectionRaw,
    })
}
