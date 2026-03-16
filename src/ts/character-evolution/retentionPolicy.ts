import type {
    CharacterEvolutionProjectedItemSectionKey,
    CharacterEvolutionRetentionBucket,
    CharacterEvolutionRetentionPolicy,
    CharacterEvolutionRetentionSectionCap,
} from "../storage/database.types"
import { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } from "./items"
import { CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION } from "./projectionPolicy"

export const CHARACTER_EVOLUTION_RETENTION_BUCKET_BY_SECTION: Record<
    CharacterEvolutionProjectedItemSectionKey,
    CharacterEvolutionRetentionBucket
> = {
    ...CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION,
}

export const DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY: CharacterEvolutionRetentionPolicy = {
    thresholds: {
        archive: {
            fast: 2,
            medium: 5,
            slow: 8,
            permanent: Number.POSITIVE_INFINITY,
        },
        deleteNonActive: {
            fast: 6,
            medium: 12,
            slow: 24,
            permanent: Number.POSITIVE_INFINITY,
        },
        deleteConfirmedSlow: 36,
    },
    caps: {
        activeThreads: {
            active: 6,
            nonActive: 10,
        },
        keyMoments: {
            active: 12,
            nonActive: 12,
        },
        characterHabits: {
            active: 6,
            nonActive: 8,
        },
    },
    sectionBuckets: {
        ...CHARACTER_EVOLUTION_RETENTION_BUCKET_BY_SECTION,
    },
}

function normalizeThresholdValue(value: unknown, fallback: number): number {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return fallback
    }
    return Math.max(0, Math.floor(numericValue))
}

function normalizeCapValue(value: unknown, fallback: number): number {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 1) {
        return fallback
    }
    return Math.max(1, Math.floor(numericValue))
}

function normalizeBucketThresholdRecord(
    raw: unknown,
    fallback: Record<CharacterEvolutionRetentionBucket, number>,
): Record<CharacterEvolutionRetentionBucket, number> {
    const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    return {
        fast: normalizeThresholdValue(source.fast, fallback.fast),
        medium: normalizeThresholdValue(source.medium, fallback.medium),
        slow: normalizeThresholdValue(source.slow, fallback.slow),
        permanent: Number.POSITIVE_INFINITY,
    }
}

function normalizeSectionBucket(
    value: unknown,
    fallback: CharacterEvolutionRetentionBucket,
): CharacterEvolutionRetentionBucket {
    return value === "fast" || value === "medium" || value === "slow" || value === "permanent"
        ? value
        : fallback
}

function normalizeSectionBuckets(
    raw: unknown,
    fallback: Record<CharacterEvolutionProjectedItemSectionKey, CharacterEvolutionRetentionBucket>,
): Record<CharacterEvolutionProjectedItemSectionKey, CharacterEvolutionRetentionBucket> {
    const source = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    const sectionBuckets = {} as Record<CharacterEvolutionProjectedItemSectionKey, CharacterEvolutionRetentionBucket>

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS as readonly CharacterEvolutionProjectedItemSectionKey[]) {
        sectionBuckets[key] = normalizeSectionBucket(source[key], fallback[key])
    }

    return sectionBuckets
}

function normalizeSectionCap(
    raw: unknown,
    fallback: CharacterEvolutionRetentionSectionCap | null,
): CharacterEvolutionRetentionSectionCap | null {
    if (!raw || typeof raw !== "object") {
        return fallback ? { ...fallback } : null
    }
    const source = raw as Record<string, unknown>
    const activeFallback = fallback?.active ?? 1
    const nonActiveFallback = fallback?.nonActive ?? 1
    return {
        active: normalizeCapValue(source.active, activeFallback),
        nonActive: normalizeCapValue(source.nonActive, nonActiveFallback),
    }
}

export function normalizeCharacterEvolutionRetentionPolicy(raw: unknown): CharacterEvolutionRetentionPolicy {
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    const fallback = DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY
    const capsSource = (value.caps && typeof value.caps === "object") ? value.caps as Record<string, unknown> : {}
    const caps = {} as Partial<Record<CharacterEvolutionProjectedItemSectionKey, CharacterEvolutionRetentionSectionCap>>

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS as readonly CharacterEvolutionProjectedItemSectionKey[]) {
        const normalizedCap = normalizeSectionCap(
            capsSource[key],
            fallback.caps[key] ?? null,
        )
        if (normalizedCap) {
            caps[key] = normalizedCap
        }
    }

    return {
        thresholds: {
            archive: normalizeBucketThresholdRecord(
                (value.thresholds as Record<string, unknown> | undefined)?.archive,
                fallback.thresholds.archive,
            ),
            deleteNonActive: normalizeBucketThresholdRecord(
                (value.thresholds as Record<string, unknown> | undefined)?.deleteNonActive,
                fallback.thresholds.deleteNonActive,
            ),
            deleteConfirmedSlow: normalizeThresholdValue(
                (value.thresholds as Record<string, unknown> | undefined)?.deleteConfirmedSlow,
                fallback.thresholds.deleteConfirmedSlow,
            ),
        },
        caps,
        sectionBuckets: normalizeSectionBuckets(
            value.sectionBuckets,
            {
                ...CHARACTER_EVOLUTION_RETENTION_BUCKET_BY_SECTION,
                ...(fallback.sectionBuckets ?? {}),
            },
        ),
    }
}

export function getCharacterEvolutionRetentionBucket(
    sectionKey: CharacterEvolutionProjectedItemSectionKey,
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null,
): CharacterEvolutionRetentionBucket {
    return retentionPolicy?.sectionBuckets?.[sectionKey]
        ?? CHARACTER_EVOLUTION_RETENTION_BUCKET_BY_SECTION[sectionKey]
}

export function createCharacterEvolutionRetentionPolicy(): CharacterEvolutionRetentionPolicy {
    return structuredClone(DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY)
}
