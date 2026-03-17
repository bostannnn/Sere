import type {
    CharacterEvolutionItem,
    CharacterEvolutionPromptProjectionPolicy,
    CharacterEvolutionProposalState,
    CharacterEvolutionRetentionCompactionReport,
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
import {
    applyStoredCapsToSection,
    buildRetentionTotals,
    createEmptySectionReport,
    createRetentionCounts,
    createRetentionDecision,
    createTraceSectionReport,
    normalizeVersionNumber,
    type CharacterEvolutionDecayTraceReport,
    type CharacterEvolutionDecayTraceSectionReport,
    type CharacterEvolutionRetentionDecisionReason,
} from "./decayShared"
import { normalizeCharacterEvolutionSectionConfigs } from "./normalizers"
import { normalizeCharacterEvolutionPromptProjectionPolicy } from "./projectionPolicy"
import { getCharacterEvolutionRetentionBucket, normalizeCharacterEvolutionRetentionPolicy } from "./retentionPolicy"
export type {
    CharacterEvolutionDecayTraceReport,
    CharacterEvolutionDecayTraceSectionReport,
    CharacterEvolutionRetentionDecision,
    CharacterEvolutionRetentionDecisionReason,
} from "./decayShared"

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
    const bucket = getCharacterEvolutionRetentionBucket(sectionKey, retentionPolicy)
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
    const bucket = getCharacterEvolutionRetentionBucket(sectionKey, retentionPolicy)
    if (bucket === "permanent") {
        return false
    }
    const confidence = item.confidence ?? "suspected"
    const isSlowConfirmed = (
        bucket === "slow"
        && (
            sectionKey === "userFacts"
            || sectionKey === "characterLikes"
            || sectionKey === "characterDislikes"
            || sectionKey === "userLikes"
            || sectionKey === "userDislikes"
            || sectionKey === "characterIntimatePreferences"
            || sectionKey === "userIntimatePreferences"
        )
    ) && confidence === "confirmed"
    if (isSlowConfirmed) {
        return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteConfirmedSlow
    }
    return unseenAcceptedHandoffs >= retentionPolicy.thresholds.deleteNonActive[bucket]
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

function applyDecayToSection(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    items: CharacterEvolutionItem[]
    acceptedVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
    includeTrace?: boolean
}): {
    items: CharacterEvolutionItem[]
    report: CharacterEvolutionRetentionDryRunSectionReport | CharacterEvolutionDecayTraceSectionReport
} {
    const {
        sectionKey,
        items,
        acceptedVersion,
    } = args
    const retentionPolicy = normalizeCharacterEvolutionRetentionPolicy(args.retentionPolicy)
    const promptProjectionPolicy = normalizeCharacterEvolutionPromptProjectionPolicy(args.promptProjectionPolicy)
    const protectedNonActiveItems = new Set<CharacterEvolutionItem>()
    const includeTrace = args.includeTrace === true
    const traceReport = includeTrace
        ? createTraceSectionReport(sectionKey, items, retentionPolicy)
        : null
    const report = traceReport ?? createEmptySectionReport(items)
    const pendingDecisionsByItem = new Map<CharacterEvolutionItem, {
        beforeItem: CharacterEvolutionItem
        keepReason: Extract<CharacterEvolutionRetentionDecisionReason, "reinforced"> | null
    }>()

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
                if (traceReport) {
                    traceReport.decisions.push(createRetentionDecision({
                        beforeItem: item,
                        reason: "decay_delete",
                    }))
                }
                return []
            }
            report.archivedByDecay += 1
            protectedNonActiveItems.add(archivedItem)
            if (traceReport) {
                traceReport.decisions.push(createRetentionDecision({
                    beforeItem: item,
                    afterItem: archivedItem,
                    reason: "decay_archive",
                }))
            }
            return [archivedItem]
        }

        if (shouldDeleteAfterDecay(sectionKey, nextItem, nextUnseenAcceptedHandoffs, retentionPolicy)) {
            report.deletedByDecay += 1
            if (traceReport) {
                traceReport.decisions.push(createRetentionDecision({
                    beforeItem: item,
                    reason: "decay_delete",
                }))
            }
            return []
        }

        if (includeTrace) {
            pendingDecisionsByItem.set(nextItem, {
                beforeItem: item,
                keepReason: reinforced ? "reinforced" : null,
            })
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

    if (traceReport) {
        for (const [item, pendingDecision] of pendingDecisionsByItem.entries()) {
            const archivedOverflowItem = cappedResult.archivedOverflowBySource.get(item)
            if (archivedOverflowItem) {
                traceReport.decisions.push(createRetentionDecision({
                    beforeItem: pendingDecision.beforeItem,
                    afterItem: archivedOverflowItem,
                    reason: "cap_archive",
                }))
                continue
            }
            if (cappedResult.deletedOverflowItems.has(item)) {
                traceReport.decisions.push(createRetentionDecision({
                    beforeItem: pendingDecision.beforeItem,
                    reason: "cap_delete",
                }))
                continue
            }
            if (cappedResult.keptItems.has(item)) {
                if (pendingDecision.keepReason) {
                    traceReport.decisions.push(createRetentionDecision({
                        beforeItem: pendingDecision.beforeItem,
                        afterItem: item,
                        reason: pendingDecision.keepReason,
                    }))
                }
            }
        }
    }

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
    return applyCharacterEvolutionDecayWithReport(args).state
}

export function applyCharacterEvolutionDecayWithReport(args: {
    state: CharacterEvolutionState
    acceptedVersion: number
    retentionPolicy?: CharacterEvolutionRetentionPolicy | null
    promptProjectionPolicy?: CharacterEvolutionPromptProjectionPolicy | null
}): {
    state: CharacterEvolutionState
    report: CharacterEvolutionDecayTraceReport
} {
    const nextState = structuredClone(args.state)
    const sections = {} as CharacterEvolutionDecayTraceReport["sections"]

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const result = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] as CharacterEvolutionItem[] : [],
            acceptedVersion: args.acceptedVersion,
            retentionPolicy: args.retentionPolicy,
            promptProjectionPolicy: args.promptProjectionPolicy,
            includeTrace: true,
        })
        nextState[key] = result.items as never
        sections[key] = result.report as CharacterEvolutionDecayTraceSectionReport
    }

    return {
        state: nextState,
        report: {
            acceptedVersion: Math.max(0, Math.floor(Number(args.acceptedVersion) || 0)),
            totals: buildRetentionTotals(sections),
            sections,
        },
    }
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
