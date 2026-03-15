import type {
    CharacterEvolutionProjectedItemSectionKey,
    CharacterEvolutionRetentionBucket,
    CharacterEvolutionRetentionPolicy,
    CharacterEvolutionRetentionSectionCap,
} from "../storage/database.types"
import { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } from "./items"
import { getCharacterEvolutionProjectionBucket } from "./projectionPolicy"

export const DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY: CharacterEvolutionRetentionPolicy = {
    thresholds: {
        archive: {
            fast: 2,
            medium: 5,
            slow: 8,
        },
        deleteNonActive: {
            fast: 6,
            medium: 12,
            slow: 24,
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
    }
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
    }
}

export function getCharacterEvolutionRetentionBucket(
    sectionKey: CharacterEvolutionProjectedItemSectionKey,
): CharacterEvolutionRetentionBucket {
    return getCharacterEvolutionProjectionBucket(sectionKey)
}

export function createCharacterEvolutionRetentionPolicy(): CharacterEvolutionRetentionPolicy {
    return structuredClone(DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY)
}
