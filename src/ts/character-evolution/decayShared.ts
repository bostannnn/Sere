import type {
    CharacterEvolutionItem,
    CharacterEvolutionPromptProjectionPolicy,
    CharacterEvolutionRetentionBucket,
    CharacterEvolutionRetentionCompactionReport,
    CharacterEvolutionRetentionDryRunCounts,
    CharacterEvolutionRetentionDryRunSectionReport,
    CharacterEvolutionRetentionPolicy,
} from "../storage/database.types"
import {
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
    type CharacterEvolutionItemSectionKey,
} from "./items"
import { compareCharacterEvolutionItemsForProjection } from "./projectionPolicy"
import { getCharacterEvolutionRetentionBucket } from "./retentionPolicy"

export type CharacterEvolutionRetentionDecisionReason =
    | "reinforced"
    | "decay_archive"
    | "decay_delete"
    | "cap_archive"
    | "cap_delete"

export interface CharacterEvolutionRetentionDecision {
    reason: CharacterEvolutionRetentionDecisionReason
    valuePreview: string
    confidence: CharacterEvolutionItem["confidence"]
    fromStatus: CharacterEvolutionItem["status"]
    toStatus: CharacterEvolutionItem["status"] | null
    unseenBefore: number
    unseenAfter: number | null
    lastSeenVersion: number | null
    sourceChatId: string | null
    sourceRange: CharacterEvolutionItem["sourceRange"] | null
}

export interface CharacterEvolutionDecayTraceSectionReport extends CharacterEvolutionRetentionDryRunSectionReport {
    bucket: CharacterEvolutionRetentionBucket
    archiveThreshold: number
    deleteNonActiveThreshold: number
    deleteConfirmedSlowThreshold: number
    decisions: CharacterEvolutionRetentionDecision[]
}

export interface CharacterEvolutionDecayTraceReport {
    acceptedVersion: number
    totals: CharacterEvolutionRetentionCompactionReport["totals"]
    sections: Record<CharacterEvolutionItemSectionKey, CharacterEvolutionDecayTraceSectionReport>
}

export function normalizeVersionNumber(value: unknown): number | null {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return null
    }
    return Math.floor(numericValue)
}

export function buildRetentionTotals(
    sections: Record<CharacterEvolutionItemSectionKey, CharacterEvolutionRetentionDryRunSectionReport>,
): CharacterEvolutionRetentionCompactionReport["totals"] {
    return CHARACTER_EVOLUTION_ITEM_SECTION_KEYS.reduce<CharacterEvolutionRetentionCompactionReport["totals"]>((acc, key) => {
        const section = sections[key]
        acc.before.total += section.before.total
        acc.before.active += section.before.active
        acc.before.archived += section.before.archived
        acc.before.corrected += section.before.corrected
        acc.after.total += section.after.total
        acc.after.active += section.after.active
        acc.after.archived += section.after.archived
        acc.after.corrected += section.after.corrected
        return acc
    }, {
        before: {
            total: 0,
            active: 0,
            archived: 0,
            corrected: 0,
        },
        after: {
            total: 0,
            active: 0,
            archived: 0,
            corrected: 0,
        },
    })
}

function sortItemsByProjectionRank(
    sectionKey: CharacterEvolutionItemSectionKey,
    items: CharacterEvolutionItem[],
    promptProjectionPolicy: CharacterEvolutionPromptProjectionPolicy,
): CharacterEvolutionItem[] {
    return [...items].sort((left, right) => compareCharacterEvolutionItemsForProjection({
        sectionKey,
        left,
        right,
        policy: promptProjectionPolicy,
    }))
}

export function createRetentionCounts(items: CharacterEvolutionItem[]): CharacterEvolutionRetentionDryRunCounts {
    const counts: CharacterEvolutionRetentionDryRunCounts = {
        total: 0,
        active: 0,
        archived: 0,
        corrected: 0,
    }

    for (const item of items) {
        const status = item.status ?? "active"
        counts.total += 1
        if (status === "archived") {
            counts.archived += 1
            continue
        }
        if (status === "corrected") {
            counts.corrected += 1
            continue
        }
        counts.active += 1
    }

    return counts
}

export function createEmptySectionReport(items: CharacterEvolutionItem[]): CharacterEvolutionRetentionDryRunSectionReport {
    return {
        before: createRetentionCounts(items),
        after: {
            total: 0,
            active: 0,
            archived: 0,
            corrected: 0,
        },
        archivedByDecay: 0,
        deletedByDecay: 0,
        archivedByCap: 0,
        deletedByCap: 0,
    }
}

export function createRetentionTraceContext(
    sectionKey: CharacterEvolutionItemSectionKey,
    retentionPolicy: CharacterEvolutionRetentionPolicy,
): Pick<CharacterEvolutionDecayTraceSectionReport, "bucket" | "archiveThreshold" | "deleteNonActiveThreshold" | "deleteConfirmedSlowThreshold"> {
    const bucket = getCharacterEvolutionRetentionBucket(sectionKey, retentionPolicy)
    return {
        bucket,
        archiveThreshold: retentionPolicy.thresholds.archive[bucket],
        deleteNonActiveThreshold: retentionPolicy.thresholds.deleteNonActive[bucket],
        deleteConfirmedSlowThreshold: retentionPolicy.thresholds.deleteConfirmedSlow,
    }
}

export function createTraceSectionReport(
    sectionKey: CharacterEvolutionItemSectionKey,
    items: CharacterEvolutionItem[],
    retentionPolicy: CharacterEvolutionRetentionPolicy,
): CharacterEvolutionDecayTraceSectionReport {
    return {
        ...createEmptySectionReport(items),
        ...createRetentionTraceContext(sectionKey, retentionPolicy),
        decisions: [],
    }
}

function previewDecisionValue(item: CharacterEvolutionItem | null | undefined): string {
    const rawValue = typeof item?.value === "string" ? item.value.trim() : ""
    if (!rawValue) {
        return ""
    }
    if (rawValue.length <= 160) {
        return rawValue
    }
    return `${rawValue.slice(0, 157)}...`
}

export function createRetentionDecision(args: {
    beforeItem: CharacterEvolutionItem
    afterItem?: CharacterEvolutionItem | null
    reason: CharacterEvolutionRetentionDecisionReason
}): CharacterEvolutionRetentionDecision {
    const itemForPreview = args.afterItem ?? args.beforeItem
    return {
        reason: args.reason,
        valuePreview: previewDecisionValue(itemForPreview),
        confidence: itemForPreview.confidence ?? args.beforeItem.confidence ?? "suspected",
        fromStatus: args.beforeItem.status ?? "active",
        toStatus: args.afterItem ? (args.afterItem.status ?? "active") : null,
        unseenBefore: Number.isFinite(Number(args.beforeItem.unseenAcceptedHandoffs))
            ? Math.max(0, Math.floor(Number(args.beforeItem.unseenAcceptedHandoffs)))
            : 0,
        unseenAfter: args.afterItem
            ? (
                Number.isFinite(Number(args.afterItem.unseenAcceptedHandoffs))
                    ? Math.max(0, Math.floor(Number(args.afterItem.unseenAcceptedHandoffs)))
                    : 0
            )
            : null,
        lastSeenVersion: normalizeVersionNumber(itemForPreview.lastSeenVersion),
        sourceChatId: typeof itemForPreview.sourceChatId === "string" ? itemForPreview.sourceChatId : null,
        sourceRange: itemForPreview.sourceRange ? structuredClone(itemForPreview.sourceRange) : null,
    }
}

export function applyStoredCapsToSection(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    items: CharacterEvolutionItem[]
    protectedNonActiveItems?: Set<CharacterEvolutionItem>
    retentionPolicy: CharacterEvolutionRetentionPolicy
    promptProjectionPolicy: CharacterEvolutionPromptProjectionPolicy
}): {
    items: CharacterEvolutionItem[]
    archivedByCap: number
    deletedByCap: number
    keptItems: Set<CharacterEvolutionItem>
    archivedOverflowBySource: Map<CharacterEvolutionItem, CharacterEvolutionItem>
    deletedOverflowItems: Set<CharacterEvolutionItem>
} {
    const cap = args.retentionPolicy.caps[args.sectionKey]
    if (!cap) {
        return {
            items: args.items.map((item) => ({ ...item })),
            archivedByCap: 0,
            deletedByCap: 0,
            keptItems: new Set(args.items),
            archivedOverflowBySource: new Map(),
            deletedOverflowItems: new Set(),
        }
    }

    const activeItems = args.items.filter((item) => (item.status ?? "active") === "active")
    const nonActiveItems = args.items.filter((item) => (item.status ?? "active") !== "active")
    const protectedNonActiveItems = nonActiveItems.filter((item) => args.protectedNonActiveItems?.has(item))
    const trimmableNonActiveItems = nonActiveItems.filter((item) => !args.protectedNonActiveItems?.has(item))

    const keptActive = new Set(
        sortItemsByProjectionRank(args.sectionKey, activeItems, args.promptProjectionPolicy)
            .slice(0, cap.active),
    )
    const archivedOverflowByItem = new Map(
        activeItems
            .filter((item) => !keptActive.has(item))
            .map((item) => [item, {
                ...item,
                status: "archived" as const,
            }] as const),
    )
    const archivedOverflow = [...archivedOverflowByItem.values()]
    const trimmableNonActiveCapacity = Math.max(0, cap.nonActive - protectedNonActiveItems.length - archivedOverflow.length)
    const keptTrimmableNonActive = sortItemsByProjectionRank(
        args.sectionKey,
        trimmableNonActiveItems,
        args.promptProjectionPolicy,
    ).slice(0, trimmableNonActiveCapacity)
    const keptNonActiveSet = new Set([
        ...protectedNonActiveItems,
        ...keptTrimmableNonActive,
    ])

    return {
        items: args.items.flatMap((item) => {
            const status = item.status ?? "active"
            if (status === "active") {
                if (keptActive.has(item)) {
                    return [{ ...item }]
                }
                const archivedOverflowItem = archivedOverflowByItem.get(item)
                if (archivedOverflowItem) {
                    return [{ ...archivedOverflowItem }]
                }
                return []
            }
            if (keptNonActiveSet.has(item)) {
                return [{ ...item }]
            }
            return []
        }),
        archivedByCap: archivedOverflow.length,
        deletedByCap: Math.max(0, trimmableNonActiveItems.length - keptTrimmableNonActive.length),
        keptItems: new Set([
            ...activeItems.filter((item) => keptActive.has(item)),
            ...protectedNonActiveItems,
            ...keptTrimmableNonActive,
        ]),
        archivedOverflowBySource: archivedOverflowByItem,
        deletedOverflowItems: new Set(trimmableNonActiveItems.filter((item) => !keptNonActiveSet.has(item))),
    }
}
