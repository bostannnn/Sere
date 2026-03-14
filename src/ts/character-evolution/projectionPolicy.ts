import type {
    CharacterEvolutionConfidence,
    CharacterEvolutionItem,
    CharacterEvolutionProjectedItemSectionKey,
    CharacterEvolutionProjectionBucket,
    CharacterEvolutionProjectionRankField,
    CharacterEvolutionPromptProjectionPolicy,
    Database,
    character,
    groupChat,
} from "../storage/database.types"
import { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } from "./items"

const CHARACTER_EVOLUTION_CONFIDENCE_RANK: Record<CharacterEvolutionConfidence, number> = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
}

export const CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION: Record<
    CharacterEvolutionProjectedItemSectionKey,
    CharacterEvolutionProjectionBucket
> = {
    activeThreads: "fast",
    runningJokes: "fast",
    keyMoments: "fast",
    userRead: "medium",
    characterHabits: "medium",
    characterBoundariesPreferences: "medium",
    userFacts: "slow",
    characterLikes: "slow",
    characterDislikes: "slow",
    userLikes: "slow",
    userDislikes: "slow",
    characterIntimatePreferences: "slow",
    userIntimatePreferences: "slow",
}

export const CHARACTER_EVOLUTION_PROJECTION_BUCKETS = [
    "fast",
    "medium",
    "slow",
] as const satisfies readonly CharacterEvolutionProjectionBucket[]

export const CHARACTER_EVOLUTION_PROJECTION_RANK_FIELDS = [
    "confidence",
    "timesSeen",
    "lastSeenAt",
    "updatedAt",
] as const satisfies readonly CharacterEvolutionProjectionRankField[]

export const DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY: CharacterEvolutionPromptProjectionPolicy = {
    rankings: {
        fast: ["lastSeenAt", "updatedAt", "timesSeen", "confidence"],
        medium: ["lastSeenAt", "timesSeen", "confidence", "updatedAt"],
        slow: ["confidence", "timesSeen", "lastSeenAt", "updatedAt"],
    },
    limits: {
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
    },
}

function toSortableNumber(value: unknown): number {
    return Number.isFinite(Number(value)) ? Number(value) : 0
}

function compareProjectionField(
    field: CharacterEvolutionProjectionRankField,
    left: CharacterEvolutionItem,
    right: CharacterEvolutionItem,
): number {
    if (field === "confidence") {
        return (right.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[right.confidence] : -1)
            - (left.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[left.confidence] : -1)
    }

    return toSortableNumber(right[field]) - toSortableNumber(left[field])
}

function normalizeRankingOrder(
    raw: unknown,
    fallback: readonly CharacterEvolutionProjectionRankField[],
): CharacterEvolutionProjectionRankField[] {
    const ranked = Array.isArray(raw)
        ? raw.filter((value): value is CharacterEvolutionProjectionRankField =>
            typeof value === "string"
            && (CHARACTER_EVOLUTION_PROJECTION_RANK_FIELDS as readonly string[]).includes(value),
        )
        : []
    const seen = new Set<CharacterEvolutionProjectionRankField>()
    const ordered: CharacterEvolutionProjectionRankField[] = []
    for (const field of ranked) {
        if (seen.has(field)) continue
        seen.add(field)
        ordered.push(field)
    }
    for (const field of fallback) {
        if (seen.has(field)) continue
        seen.add(field)
        ordered.push(field)
    }
    return ordered
}

function normalizeLimitValue(value: unknown, fallback: number): number {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return fallback
    }
    return Math.max(0, Math.floor(numericValue))
}

function normalizeSectionLimits(
    raw: unknown,
    fallback: Record<CharacterEvolutionProjectedItemSectionKey, number>,
): Record<CharacterEvolutionProjectedItemSectionKey, number> {
    const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    const limits = {} as Record<CharacterEvolutionProjectedItemSectionKey, number>
    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS as readonly CharacterEvolutionProjectedItemSectionKey[]) {
        limits[key] = normalizeLimitValue(source[key], fallback[key])
    }
    return limits
}

export function normalizeCharacterEvolutionPromptProjectionPolicy(raw: unknown): CharacterEvolutionPromptProjectionPolicy {
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    return {
        rankings: {
            fast: normalizeRankingOrder(
                (value.rankings as Record<string, unknown> | undefined)?.fast,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.fast,
            ),
            medium: normalizeRankingOrder(
                (value.rankings as Record<string, unknown> | undefined)?.medium,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.medium,
            ),
            slow: normalizeRankingOrder(
                (value.rankings as Record<string, unknown> | undefined)?.slow,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.slow,
            ),
        },
        limits: {
            generation: normalizeSectionLimits(
                (value.limits as Record<string, unknown> | undefined)?.generation,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.limits.generation,
            ),
            extraction: normalizeSectionLimits(
                (value.limits as Record<string, unknown> | undefined)?.extraction,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.limits.extraction,
            ),
        },
    }
}

export function getCharacterEvolutionProjectionBucket(
    sectionKey: CharacterEvolutionProjectedItemSectionKey,
): CharacterEvolutionProjectionBucket {
    return CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION[sectionKey]
}

export function compareCharacterEvolutionItemsForProjection(args: {
    sectionKey: CharacterEvolutionProjectedItemSectionKey
    left: CharacterEvolutionItem
    right: CharacterEvolutionItem
    policy: CharacterEvolutionPromptProjectionPolicy
}): number {
    const ranking = args.policy.rankings[getCharacterEvolutionProjectionBucket(args.sectionKey)]
    for (const field of ranking) {
        const comparison = compareProjectionField(field, args.left, args.right)
        if (comparison !== 0) {
            return comparison
        }
    }
    return args.left.value.localeCompare(args.right.value)
}

export function getCharacterEvolutionPromptProjectionPolicy(
    db: Database,
    _char?: character | groupChat | null,
): CharacterEvolutionPromptProjectionPolicy {
    return normalizeCharacterEvolutionPromptProjectionPolicy(db.characterEvolutionDefaults?.promptProjection)
}

export function createCharacterEvolutionPromptProjectionPolicy(): CharacterEvolutionPromptProjectionPolicy {
    return structuredClone(DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY)
}
