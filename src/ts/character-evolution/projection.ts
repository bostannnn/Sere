import type {
    CharacterEvolutionProjectedItemSectionKey,
    CharacterEvolutionPromptProjectionPolicy,
    CharacterEvolutionState,
} from "../storage/database.types"
import { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS, filterActiveCharacterEvolutionState } from "./items"
import { normalizeCharacterEvolutionState } from "./normalizers"
import {
    compareCharacterEvolutionItemsForProjection,
    normalizeCharacterEvolutionPromptProjectionPolicy,
} from "./projectionPolicy"

type PromptProjectionSurface = "generation" | "extraction"

function sortProjectedItems(
    sectionKey: CharacterEvolutionProjectedItemSectionKey,
    items: CharacterEvolutionState[CharacterEvolutionProjectedItemSectionKey],
    policy: CharacterEvolutionPromptProjectionPolicy,
) {
    return [...items]
        .map((item, index) => ({ item, index }))
        .sort((left, right) => {
            const comparison = compareCharacterEvolutionItemsForProjection({
                sectionKey,
                left: left.item,
                right: right.item,
                policy,
            })
            return comparison !== 0 ? comparison : left.index - right.index
        })
        .map(({ item }) => ({ ...item }))
}

export function projectCharacterEvolutionStateForPrompt(
    stateRaw: CharacterEvolutionState,
    surface: PromptProjectionSurface = "generation",
    promptProjectionRaw?: CharacterEvolutionPromptProjectionPolicy | null,
): CharacterEvolutionState {
    const state = filterActiveCharacterEvolutionState(normalizeCharacterEvolutionState(stateRaw))
    const promptProjection = normalizeCharacterEvolutionPromptProjectionPolicy(promptProjectionRaw)
    const limits = promptProjection.limits[surface]
    const nextState: CharacterEvolutionState = {
        ...state,
        relationship: { ...state.relationship },
        lastInteractionEnded: { ...state.lastInteractionEnded },
    }

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS as readonly CharacterEvolutionProjectedItemSectionKey[]) {
        nextState[key] = sortProjectedItems(key, state[key], promptProjection)
            .slice(0, limits[key]) as never
    }

    return nextState
}
