import type { CharacterEvolutionItem, CharacterEvolutionItemSectionKey, CharacterEvolutionState } from "../storage/database.types"
import { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS, filterActiveCharacterEvolutionState } from "./items"
import { normalizeCharacterEvolutionState } from "./normalizers"

type PromptProjectionSurface = "generation" | "extraction"

const CHARACTER_EVOLUTION_CONFIDENCE_RANK = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
} as const

const FAST_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "activeThreads",
    "runningJokes",
    "keyMoments",
])

const MEDIUM_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "userRead",
    "characterHabits",
    "characterBoundariesPreferences",
])

const PROMPT_ITEM_LIMITS: Record<PromptProjectionSurface, Record<CharacterEvolutionItemSectionKey, number>> = {
    generation: {
        activeThreads: 2,
        runningJokes: 2,
        characterLikes: 3,
        characterDislikes: 3,
        characterHabits: 2,
        characterBoundariesPreferences: 2,
        userFacts: 4,
        userRead: 3,
        userLikes: 2,
        userDislikes: 2,
        keyMoments: 2,
        characterIntimatePreferences: 3,
        userIntimatePreferences: 3,
    },
    extraction: {
        activeThreads: 3,
        runningJokes: 3,
        characterLikes: 4,
        characterDislikes: 4,
        characterHabits: 3,
        characterBoundariesPreferences: 3,
        userFacts: 6,
        userRead: 4,
        userLikes: 3,
        userDislikes: 3,
        keyMoments: 3,
        characterIntimatePreferences: 4,
        userIntimatePreferences: 4,
    },
}

function toSortableNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0
}

function getConfidenceRank(item: CharacterEvolutionItem): number {
    return item.confidence ? (CHARACTER_EVOLUTION_CONFIDENCE_RANK[item.confidence] ?? -1) : -1
}

function compareFastItems(left: CharacterEvolutionItem, right: CharacterEvolutionItem): number {
    const byLastSeenAt = toSortableNumber(right.lastSeenAt) - toSortableNumber(left.lastSeenAt)
    if (byLastSeenAt !== 0) return byLastSeenAt

    const byUpdatedAt = toSortableNumber(right.updatedAt) - toSortableNumber(left.updatedAt)
    if (byUpdatedAt !== 0) return byUpdatedAt

    const byTimesSeen = toSortableNumber(right.timesSeen) - toSortableNumber(left.timesSeen)
    if (byTimesSeen !== 0) return byTimesSeen

    const byConfidence = getConfidenceRank(right) - getConfidenceRank(left)
    if (byConfidence !== 0) return byConfidence

    return left.value.localeCompare(right.value)
}

function compareMediumItems(left: CharacterEvolutionItem, right: CharacterEvolutionItem): number {
    const byLastSeenAt = toSortableNumber(right.lastSeenAt) - toSortableNumber(left.lastSeenAt)
    if (byLastSeenAt !== 0) return byLastSeenAt

    const byTimesSeen = toSortableNumber(right.timesSeen) - toSortableNumber(left.timesSeen)
    if (byTimesSeen !== 0) return byTimesSeen

    const byConfidence = getConfidenceRank(right) - getConfidenceRank(left)
    if (byConfidence !== 0) return byConfidence

    const byUpdatedAt = toSortableNumber(right.updatedAt) - toSortableNumber(left.updatedAt)
    if (byUpdatedAt !== 0) return byUpdatedAt

    return left.value.localeCompare(right.value)
}

function compareSlowItems(left: CharacterEvolutionItem, right: CharacterEvolutionItem): number {
    const byConfidence = getConfidenceRank(right) - getConfidenceRank(left)
    if (byConfidence !== 0) return byConfidence

    const byTimesSeen = toSortableNumber(right.timesSeen) - toSortableNumber(left.timesSeen)
    if (byTimesSeen !== 0) return byTimesSeen

    const byLastSeenAt = toSortableNumber(right.lastSeenAt) - toSortableNumber(left.lastSeenAt)
    if (byLastSeenAt !== 0) return byLastSeenAt

    const byUpdatedAt = toSortableNumber(right.updatedAt) - toSortableNumber(left.updatedAt)
    if (byUpdatedAt !== 0) return byUpdatedAt

    return left.value.localeCompare(right.value)
}

function sortProjectedItems(sectionKey: CharacterEvolutionItemSectionKey, items: CharacterEvolutionItem[]): CharacterEvolutionItem[] {
    const comparator = FAST_SECTIONS.has(sectionKey)
        ? compareFastItems
        : MEDIUM_SECTIONS.has(sectionKey)
            ? compareMediumItems
            : compareSlowItems

    return [...items]
        .sort(comparator)
        .map((item) => ({ ...item }))
}

export function projectCharacterEvolutionStateForPrompt(
    stateRaw: CharacterEvolutionState,
    surface: PromptProjectionSurface = "generation",
): CharacterEvolutionState {
    const state = filterActiveCharacterEvolutionState(normalizeCharacterEvolutionState(stateRaw))
    const limits = PROMPT_ITEM_LIMITS[surface]
    const nextState: CharacterEvolutionState = {
        ...state,
        relationship: { ...state.relationship },
        lastInteractionEnded: { ...state.lastInteractionEnded },
    }

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = sortProjectedItems(key, state[key]).slice(0, limits[key]) as never
    }

    return nextState
}
