import type {
    CharacterEvolutionItem,
    CharacterEvolutionRetentionCompactionReport,
    CharacterEvolutionPromptProjectionPolicy,
    CharacterEvolutionProposalState,
    CharacterEvolutionRetentionDryRunCounts,
    CharacterEvolutionRetentionDryRunReport,
    CharacterEvolutionRetentionDryRunSectionReport,
    CharacterEvolutionRetentionPolicy,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSectionKey,
    CharacterEvolutionState,
} from "../storage/database.types"
import { createDefaultCharacterEvolutionState } from "./schema"
import {
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
    type CharacterEvolutionItemSectionKey,
} from "./items"
import { normalizeCharacterEvolutionSectionConfigs } from "./normalizers"
import { compareCharacterEvolutionItemsForProjection, normalizeCharacterEvolutionPromptProjectionPolicy } from "./projectionPolicy"
import { normalizeCharacterEvolutionRetentionPolicy } from "./retentionPolicy"

function normalizeUnseenAcceptedHandoffs(item: CharacterEvolutionItem): number {
    if (!Number.isFinite(Number(item.unseenAcceptedHandoffs)) || Number(item.unseenAcceptedHandoffs) < 0) {
        return 0
    }
    return Math.max(0, Math.floor(Number(item.unseenAcceptedHandoffs)))
}

function isReinforcedOnAcceptedHandoff(item: CharacterEvolutionItem, acceptedVersion: number): boolean {
    return Number.isFinite(item.lastSeenVersion)
        && Number(item.lastSeenVersion) === acceptedVersion
        && (item.status ?? "active") === "active"
}

function shouldArchiveAfterDecay(
    sectionKey: CharacterEvolutionItemSectionKey,
    item: CharacterEvolutionItem,
    unseenAcceptedHandoffs: number,
    retentionPolicy: CharacterEvolutionRetentionPolicy,
): boolean {
    if ((item.status ?? "active") !== "active") {
        return false
    }
    const bucket = getBucketKeyForSection(sectionKey)
    const threshold = retentionPolicy.thresholds.archive[bucket]
    const confidence = item.confidence ?? "suspected"
    if (bucket === "slow" && confidence === "confirmed") {
        return false
    }
    return unseenAcceptedHandoffs >= threshold
}

function shouldDeleteAfterDecay(
    sectionKey: CharacterEvolutionItemSectionKey,
    item: CharacterEvolutionItem,
    unseenAcceptedHandoffs: number,
    retentionPolicy: CharacterEvolutionRetentionPolicy,
): boolean {
    const status = item.status ?? "active"
    if (status === "active") {
        return false
    }
    const confidence = item.confidence ?? "suspected"
    const isSlowConfirmed = (
        sectionKey === "userFacts"
        || sectionKey === "characterLikes"
        || sectionKey === "characterDislikes"
        || sectionKey === "userLikes"
        || sectionKey === "userDislikes"
        || sectionKey === "characterIntimatePreferences"
        || sectionKey === "userIntimatePreferences"
    ) && confidence === "confirmed"
    if (isSlowConfirmed) {
        return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteConfirmedSlow
    }
    const bucket = getBucketKeyForSection(sectionKey)
    return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteNonActive[bucket]
}

function getBucketKeyForSection(sectionKey: CharacterEvolutionItemSectionKey) {
    if (sectionKey === "activeThreads" || sectionKey === "runningJokes" || sectionKey === "keyMoments") {
        return "fast" as const
    }
    if (sectionKey === "userRead" || sectionKey === "characterHabits" || sectionKey === "characterBoundariesPreferences") {
        return "medium" as const
    }
    return "slow" as const
}

function normalizeVersionNumber(value: unknown): number | null {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return null
    }
    return Math.floor(numericValue)
}

function buildRetentionTotals(
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

function getEffectiveCompactionUnseenAcceptedHandoffs(
    item: CharacterEvolutionItem,
    currentStateVersion: number,
): number {
    const storedUnseenAcceptedHandoffs = normalizeUnseenAcceptedHandoffs(item)
    if ((item.status ?? "active") === "active") {
        return storedUnseenAcceptedHandoffs
    }
    const lastSeenVersion = normalizeVersionNumber(item.lastSeenVersion)
    if (lastSeenVersion === null || lastSeenVersion > currentStateVersion) {
        return storedUnseenAcceptedHandoffs
    }
    return Math.max(storedUnseenAcceptedHandoffs, currentStateVersion - lastSeenVersion)
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

function createRetentionCounts(items: CharacterEvolutionItem[]): CharacterEvolutionRetentionDryRunCounts {
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

function createEmptySectionReport(items: CharacterEvolutionItem[]): CharacterEvolutionRetentionDryRunSectionReport {
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

function applyStoredCapsToSection(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    items: CharacterEvolutionItem[]
    protectedNonActiveItems?: Set<CharacterEvolutionItem>
    retentionPolicy: CharacterEvolutionRetentionPolicy
    promptProjectionPolicy: CharacterEvolutionPromptProjectionPolicy
}): {
    items: CharacterEvolutionItem[]
    archivedByCap: number
    deletedByCap: number
} {
    const cap = args.retentionPolicy.caps[args.sectionKey]
    if (!cap) {
        return {
            items: args.items.map((item) => ({ ...item })),
            archivedByCap: 0,
            deletedByCap: 0,
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
    }
}

function applyDecayToSection(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    items: CharacterEvolutionItem[]
    acceptedVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
}): {
    items: CharacterEvolutionItem[]
    report: CharacterEvolutionRetentionDryRunSectionReport
} {
    const {
        sectionKey,
        items,
        acceptedVersion,
    } = args
    const retentionPolicy = normalizeCharacterEvolutionRetentionPolicy(args.retentionPolicy)
    const promptProjectionPolicy = normalizeCharacterEvolutionPromptProjectionPolicy(args.promptProjectionPolicy)
    const protectedNonActiveItems = new Set<CharacterEvolutionItem>()
    const report = createEmptySectionReport(items)

    const decayedItems = items.flatMap((item) => {
        const status = item.status ?? "active"
        const reinforced = status === "active" && isReinforcedOnAcceptedHandoff(item, acceptedVersion)
        const nextUnseenAcceptedHandoffs = reinforced
            ? 0
            : normalizeUnseenAcceptedHandoffs(item) + 1

        const nextItem: CharacterEvolutionItem = {
            ...item,
            unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
        }

        if (shouldArchiveAfterDecay(sectionKey, item, nextUnseenAcceptedHandoffs, retentionPolicy)) {
            const archivedItem: CharacterEvolutionItem = {
                ...item,
                status: "archived",
                unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
            }
            if (shouldDeleteAfterDecay(sectionKey, archivedItem, nextUnseenAcceptedHandoffs, retentionPolicy)) {
                report.deletedByDecay += 1
                return []
            }
            report.archivedByDecay += 1
            protectedNonActiveItems.add(archivedItem)
            return [archivedItem]
        }

        if (shouldDeleteAfterDecay(sectionKey, nextItem, nextUnseenAcceptedHandoffs, retentionPolicy)) {
            report.deletedByDecay += 1
            return []
        }

        return [nextItem]
    })

    const cappedResult = applyStoredCapsToSection({
        sectionKey,
        items: decayedItems,
        protectedNonActiveItems,
        retentionPolicy,
        promptProjectionPolicy,
    })
    report.archivedByCap = cappedResult.archivedByCap
    report.deletedByCap = cappedResult.deletedByCap
    report.after = createRetentionCounts(cappedResult.items)

    return {
        items: cappedResult.items,
        report,
    }
}

function isSectionEnabled(sectionConfigs: CharacterEvolutionSectionConfig[] | null | undefined, key: CharacterEvolutionSectionKey): boolean {
    return normalizeCharacterEvolutionSectionConfigs(sectionConfigs)
        .some((section) => section.key === key && section.enabled)
}

export function applyLastInteractionEndedOverwrite(args: {
    proposedState: CharacterEvolutionProposalState
    sectionConfigs?: CharacterEvolutionSectionConfig[] | null
}): CharacterEvolutionProposalState {
    const nextState = structuredClone(args.proposedState)
    if (!isSectionEnabled(args.sectionConfigs, "lastInteractionEnded")) {
        return nextState
    }

    nextState.lastInteractionEnded = Object.prototype.hasOwnProperty.call(nextState, "lastInteractionEnded")
        ? structuredClone(nextState.lastInteractionEnded ?? createDefaultCharacterEvolutionState().lastInteractionEnded)
        : structuredClone(createDefaultCharacterEvolutionState().lastInteractionEnded)

    return nextState
}

export function applyCharacterEvolutionDecay(args: {
    state: CharacterEvolutionState
    acceptedVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
}): CharacterEvolutionState {
    const nextState = structuredClone(args.state)

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] as CharacterEvolutionItem[] : [],
            acceptedVersion: args.acceptedVersion,
            retentionPolicy: args.retentionPolicy,
            promptProjectionPolicy: args.promptProjectionPolicy,
        }).items as never
    }

    return nextState
}

export function previewCharacterEvolutionRetentionDryRun(args: {
    state: CharacterEvolutionState
    currentStateVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
}): CharacterEvolutionRetentionDryRunReport {
    const nextState = structuredClone(args.state)
    const currentStateVersion = Math.max(0, Math.floor(Number(args.currentStateVersion) || 0))
    const simulatedAcceptedVersion = currentStateVersion + 1
    const sections = {} as CharacterEvolutionRetentionDryRunReport["sections"]

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const result = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] as CharacterEvolutionItem[] : [],
            acceptedVersion: simulatedAcceptedVersion,
            retentionPolicy: args.retentionPolicy,
            promptProjectionPolicy: args.promptProjectionPolicy,
        })
        nextState[key] = result.items as never
        sections[key] = result.report
    }

    const totals = buildRetentionTotals(sections)

    return {
        currentStateVersion,
        simulatedAcceptedVersion,
        totals,
        sections,
    }
}

function compactSectionForCurrentState(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    items: CharacterEvolutionItem[]
    currentStateVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
}): {
    items: CharacterEvolutionItem[]
    report: CharacterEvolutionRetentionDryRunSectionReport
} {
    const retentionPolicy = normalizeCharacterEvolutionRetentionPolicy(args.retentionPolicy)
    const promptProjectionPolicy = normalizeCharacterEvolutionPromptProjectionPolicy(args.promptProjectionPolicy)
    const protectedNonActiveItems = new Set<CharacterEvolutionItem>()
    const report = createEmptySectionReport(args.items)

    const compactedItems = args.items.flatMap((item) => {
        const status = item.status ?? "active"
        const effectiveUnseenAcceptedHandoffs = getEffectiveCompactionUnseenAcceptedHandoffs(
            item,
            args.currentStateVersion,
        )

        if (status === "active") {
            const nextItem: CharacterEvolutionItem = {
                ...item,
                unseenAcceptedHandoffs: effectiveUnseenAcceptedHandoffs,
            }
            if (shouldArchiveAfterDecay(args.sectionKey, item, effectiveUnseenAcceptedHandoffs, retentionPolicy)) {
                const archivedItem: CharacterEvolutionItem = {
                    ...item,
                    status: "archived",
                    unseenAcceptedHandoffs: effectiveUnseenAcceptedHandoffs,
                }
                report.archivedByDecay += 1
                protectedNonActiveItems.add(archivedItem)
                return [archivedItem]
            }
            return [nextItem]
        }

        const nextItem: CharacterEvolutionItem = {
            ...item,
            unseenAcceptedHandoffs: effectiveUnseenAcceptedHandoffs,
        }
        if (shouldDeleteAfterDecay(args.sectionKey, nextItem, effectiveUnseenAcceptedHandoffs, retentionPolicy)) {
            report.deletedByDecay += 1
            return []
        }
        return [nextItem]
    })

    const cappedResult = applyStoredCapsToSection({
        sectionKey: args.sectionKey,
        items: compactedItems,
        protectedNonActiveItems,
        retentionPolicy,
        promptProjectionPolicy,
    })
    report.archivedByCap = cappedResult.archivedByCap
    report.deletedByCap = cappedResult.deletedByCap
    report.after = createRetentionCounts(cappedResult.items)

    return {
        items: cappedResult.items,
        report,
    }
}

export function compactCharacterEvolutionCurrentState(args: {
    state: CharacterEvolutionState
    currentStateVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
}): {
    state: CharacterEvolutionState
    report: CharacterEvolutionRetentionCompactionReport
} {
    const nextState = structuredClone(args.state)
    const currentStateVersion = Math.max(0, Math.floor(Number(args.currentStateVersion) || 0))
    const sections = {} as CharacterEvolutionRetentionCompactionReport["sections"]

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const result = compactSectionForCurrentState({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] as CharacterEvolutionItem[] : [],
            currentStateVersion,
            retentionPolicy: args.retentionPolicy,
            promptProjectionPolicy: args.promptProjectionPolicy,
        })
        nextState[key] = result.items as never
        sections[key] = result.report
    }

    return {
        state: nextState,
        report: {
            currentStateVersion,
            totals: buildRetentionTotals(sections),
            sections,
        },
    }
}
