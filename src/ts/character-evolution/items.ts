import type {
    CharacterEvolutionConfidence,
    CharacterEvolutionItem,
    CharacterEvolutionRangeRef,
    CharacterEvolutionStatus,
    CharacterEvolutionState,
} from "../storage/database.types"

export const CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS = [
    "relationship",
    "lastInteractionEnded",
] as const

export const CHARACTER_EVOLUTION_ITEM_SECTION_KEYS = [
    "activeThreads",
    "runningJokes",
    "characterLikes",
    "characterDislikes",
    "characterHabits",
    "characterBoundariesPreferences",
    "userFacts",
    "userRead",
    "userLikes",
    "userDislikes",
    "keyMoments",
    "characterIntimatePreferences",
    "userIntimatePreferences",
] as const satisfies ReadonlyArray<keyof CharacterEvolutionState>

export type CharacterEvolutionItemSectionKey = typeof CHARACTER_EVOLUTION_ITEM_SECTION_KEYS[number]
export type CharacterEvolutionObjectSectionKey = typeof CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS[number]

const CHARACTER_EVOLUTION_CONFIDENCE_RANK: Record<CharacterEvolutionConfidence, number> = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
}

export function isCharacterEvolutionObjectSection(key: string): key is CharacterEvolutionObjectSectionKey {
    return (CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS as readonly string[]).includes(key)
}

export function isCharacterEvolutionItemSection(key: string): key is CharacterEvolutionItemSectionKey {
    return (CHARACTER_EVOLUTION_ITEM_SECTION_KEYS as readonly string[]).includes(key)
}

export function normalizeCharacterEvolutionItemSourceRange(raw: unknown): CharacterEvolutionItem["sourceRange"] {
    if (!raw || typeof raw !== "object") {
        return undefined
    }
    const value = raw as Record<string, unknown>
    const startMessageIndex = Number(value.startMessageIndex)
    const endMessageIndex = Number(value.endMessageIndex)
    if (!Number.isFinite(startMessageIndex) || !Number.isFinite(endMessageIndex)) {
        return undefined
    }
    const normalizedStart = Math.max(0, Math.floor(startMessageIndex))
    const normalizedEnd = Math.floor(endMessageIndex)
    if (normalizedEnd < normalizedStart) {
        return undefined
    }
    return {
        startMessageIndex: normalizedStart,
        endMessageIndex: normalizedEnd,
    }
}

export function createCharacterEvolutionItemSourceRange(
    range: CharacterEvolutionRangeRef | null | undefined,
): CharacterEvolutionItem["sourceRange"] {
    return normalizeCharacterEvolutionItemSourceRange(range)
}

export function filterActiveCharacterEvolutionItems(items: CharacterEvolutionItem[]): CharacterEvolutionItem[] {
    return items
        .filter((item) => (item.status ?? "active") === "active")
        .map((item) => ({ ...item }))
}

export function filterActiveCharacterEvolutionState(state: CharacterEvolutionState): CharacterEvolutionState {
    const nextState = structuredClone(state)
    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = filterActiveCharacterEvolutionItems(nextState[key] as CharacterEvolutionItem[]) as never
    }
    return nextState
}

function normalizeCharacterEvolutionItemMatchValue(valueRaw: string): string {
    return valueRaw
        .normalize("NFKC")
        .trim()
        .replace(/\s+/g, " ")
}

export function getCharacterEvolutionItemExactMatchKey(item: CharacterEvolutionItem | string): string {
    return normalizeCharacterEvolutionItemMatchValue(typeof item === "string" ? item : item.value)
}

export function getCharacterEvolutionItemNormalizedMatchKey(item: CharacterEvolutionItem | string): string {
    return normalizeCharacterEvolutionItemMatchValue(typeof item === "string" ? item : item.value)
        .replace(/[\p{P}]+/gu, " ")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
}

export function doCharacterEvolutionItemsMatch(left: CharacterEvolutionItem | string, right: CharacterEvolutionItem | string): boolean {
    const leftExactKey = getCharacterEvolutionItemExactMatchKey(left)
    const rightExactKey = getCharacterEvolutionItemExactMatchKey(right)
    if (leftExactKey && leftExactKey === rightExactKey) {
        return true
    }

    const leftNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(left)
    const rightNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(right)
    return leftNormalizedKey.length > 0 && leftNormalizedKey === rightNormalizedKey
}

function itemValueKeysForSection(
    items: CharacterEvolutionItem[],
    matcher: (item: CharacterEvolutionItem) => string,
): Set<string> {
    return new Set(
        items
            .map((item) => matcher(item))
            .filter((value) => value.length > 0),
    )
}

function normalizeCharacterEvolutionItemStatus(item: CharacterEvolutionItem | null | undefined): CharacterEvolutionStatus {
    return item?.status ?? "active"
}

function normalizeCharacterEvolutionItemTimesSeen(item: CharacterEvolutionItem | null | undefined): number | undefined {
    if (!Number.isFinite(Number(item?.timesSeen)) || Number(item?.timesSeen) <= 0) {
        return undefined
    }
    return Math.max(1, Math.floor(Number(item?.timesSeen)))
}

function normalizeCharacterEvolutionItemNote(item: CharacterEvolutionItem | null | undefined): string {
    return typeof item?.note === "string" ? item.note : ""
}

function promotedConfidenceForTimesSeen(timesSeen: number): CharacterEvolutionConfidence {
    if (timesSeen >= 3) {
        return "confirmed"
    }
    if (timesSeen >= 2) {
        return "likely"
    }
    return "suspected"
}

function pickStrongerCharacterEvolutionConfidence(
    ...values: Array<CharacterEvolutionConfidence | undefined>
): CharacterEvolutionConfidence | undefined {
    const rankedValues = values
        .filter((value): value is CharacterEvolutionConfidence => !!value)
        .sort((left, right) => CHARACTER_EVOLUTION_CONFIDENCE_RANK[right] - CHARACTER_EVOLUTION_CONFIDENCE_RANK[left])
    return rankedValues[0]
}

function buildPreferredStatusOrder(candidateStatus: CharacterEvolutionStatus): CharacterEvolutionStatus[] {
    return [
        candidateStatus,
        "active",
        "archived",
        "corrected",
    ].filter((status, index, statuses): status is CharacterEvolutionStatus => statuses.indexOf(status) === index)
}

function findMatchingItemIndex(
    items: CharacterEvolutionItem[],
    candidate: CharacterEvolutionItem,
    statusOrder: CharacterEvolutionStatus[],
): number {
    const candidateExactKey = getCharacterEvolutionItemExactMatchKey(candidate)
    const candidateNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(candidate)
    const matchingStrategies = [
        (item: CharacterEvolutionItem) => candidateExactKey.length > 0 && getCharacterEvolutionItemExactMatchKey(item) === candidateExactKey,
        (item: CharacterEvolutionItem) => candidateNormalizedKey.length > 0 && getCharacterEvolutionItemNormalizedMatchKey(item) === candidateNormalizedKey,
    ]

    for (const doesMatch of matchingStrategies) {
        for (const preferredStatus of statusOrder) {
            const matchingIndex = items.findIndex(
                (item) => normalizeCharacterEvolutionItemStatus(item) === preferredStatus && doesMatch(item),
            )
            if (matchingIndex >= 0) {
                return matchingIndex
            }
        }
    }

    return -1
}

function findMatchingBaseItem(
    items: CharacterEvolutionItem[],
    candidate: CharacterEvolutionItem,
): CharacterEvolutionItem | undefined {
    const matchingIndex = findMatchingItemIndex(
        items,
        candidate,
        buildPreferredStatusOrder(normalizeCharacterEvolutionItemStatus(candidate)),
    )
    return matchingIndex >= 0 ? items[matchingIndex] : undefined
}

function createMergedMatchedItem(
    currentItem: CharacterEvolutionItem,
    proposedItem: CharacterEvolutionItem,
): CharacterEvolutionItem {
    const currentStatus = normalizeCharacterEvolutionItemStatus(currentItem)
    const nextStatus = normalizeCharacterEvolutionItemStatus(proposedItem)
    const shouldPreserveHistoricalMetadata = nextStatus !== "active"
    const currentTimesSeen = normalizeCharacterEvolutionItemTimesSeen(currentItem)
    const proposedTimesSeen = normalizeCharacterEvolutionItemTimesSeen(proposedItem)
    const nextProposedConfidence = proposedItem.confidence ?? currentItem.confidence
    const nextProposedNote = proposedItem.note ?? currentItem.note
    const hasMeaningfulUpdate = currentItem.confidence !== nextProposedConfidence
        || normalizeCharacterEvolutionItemNote(currentItem) !== normalizeCharacterEvolutionItemNote({ note: nextProposedNote })
        || currentStatus !== nextStatus
    const shouldReinforce = !shouldPreserveHistoricalMetadata
        && (currentStatus === "archived" || hasMeaningfulUpdate)
    const currentSeenBaseline = shouldReinforce ? (currentTimesSeen ?? 1) : currentTimesSeen
    const nextTimesSeen = shouldReinforce
        ? Math.max((currentSeenBaseline ?? proposedTimesSeen ?? 0) + 1, proposedTimesSeen ?? 0, 1)
        : currentTimesSeen
    const nextConfidence = pickStrongerCharacterEvolutionConfidence(
        currentItem.confidence,
        proposedItem.confidence,
        ...(shouldReinforce && nextTimesSeen !== undefined ? [promotedConfidenceForTimesSeen(nextTimesSeen)] : []),
    )
    const nextNote = nextProposedNote
    const nextUpdatedAt = shouldReinforce
        ? proposedItem.updatedAt ?? currentItem.updatedAt
        : currentItem.updatedAt
    const nextLastSeenAt = shouldReinforce
        ? proposedItem.lastSeenAt ?? proposedItem.updatedAt ?? currentItem.lastSeenAt
        : currentItem.lastSeenAt
    const nextSourceChatId = shouldReinforce
        ? proposedItem.sourceChatId ?? currentItem.sourceChatId
        : currentItem.sourceChatId
    const nextSourceRange = shouldReinforce
        ? proposedItem.sourceRange ?? currentItem.sourceRange
        : currentItem.sourceRange

    return {
        value: proposedItem.value,
        status: nextStatus,
        ...(nextConfidence ? { confidence: nextConfidence } : {}),
        ...(nextNote !== undefined ? { note: nextNote } : {}),
        ...(nextSourceChatId ? { sourceChatId: nextSourceChatId } : {}),
        ...(nextSourceRange ? { sourceRange: { ...nextSourceRange } } : {}),
        ...(nextUpdatedAt !== undefined ? { updatedAt: nextUpdatedAt } : {}),
        ...(nextLastSeenAt !== undefined ? { lastSeenAt: nextLastSeenAt } : {}),
        ...(nextTimesSeen !== undefined ? { timesSeen: nextTimesSeen } : {}),
    }
}

export function applyCharacterEvolutionItemMetadata(args: {
    state: CharacterEvolutionState
    baseState?: CharacterEvolutionState | null
    sourceChatId?: string | null
    sourceRange?: CharacterEvolutionRangeRef | null
    timestamp?: number | null
    overwriteNewItemTimestamps?: boolean
}): CharacterEvolutionState {
    const { state } = args
    const nextState = structuredClone(state)
    const sourceChatId = typeof args.sourceChatId === "string" && args.sourceChatId.trim()
        ? args.sourceChatId.trim()
        : typeof args.sourceRange?.chatId === "string" && args.sourceRange.chatId.trim()
            ? args.sourceRange.chatId.trim()
            : undefined
    const sourceRange = createCharacterEvolutionItemSourceRange(args.sourceRange)
    const timestamp = Number.isFinite(Number(args.timestamp)) ? Number(args.timestamp) : undefined

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const baseItems = Array.isArray(args.baseState?.[key])
            ? args.baseState[key] as CharacterEvolutionItem[]
            : []
        nextState[key] = (nextState[key] as CharacterEvolutionItem[]).map((item) => ({
            ...item,
            status: item.status ?? "active",
            ...(() => {
                const baseMatch = findMatchingBaseItem(baseItems, item)
                if (baseMatch) {
                    return {
                        ...(sourceChatId && args.overwriteNewItemTimestamps
                            ? { sourceChatId }
                            : baseMatch.sourceChatId && !item.sourceChatId
                                ? { sourceChatId: baseMatch.sourceChatId }
                                : {}),
                        ...(sourceRange && args.overwriteNewItemTimestamps
                            ? { sourceRange: { ...sourceRange } }
                            : baseMatch.sourceRange && !item.sourceRange
                                ? { sourceRange: { ...baseMatch.sourceRange } }
                                : {}),
                        ...(timestamp !== undefined && args.overwriteNewItemTimestamps
                            ? {
                                updatedAt: timestamp,
                                lastSeenAt: timestamp,
                            }
                            : {
                                ...(baseMatch.updatedAt !== undefined && item.updatedAt === undefined ? { updatedAt: baseMatch.updatedAt } : {}),
                                ...(baseMatch.lastSeenAt !== undefined && item.lastSeenAt === undefined ? { lastSeenAt: baseMatch.lastSeenAt } : {}),
                            }),
                        ...(baseMatch.timesSeen !== undefined && item.timesSeen === undefined ? { timesSeen: baseMatch.timesSeen } : {}),
                    }
                }
                return {
                    ...(sourceChatId && !item.sourceChatId ? { sourceChatId } : {}),
                    ...(sourceRange && !item.sourceRange ? { sourceRange: { ...sourceRange } } : {}),
                    ...(timestamp !== undefined && (args.overwriteNewItemTimestamps || item.updatedAt === undefined) ? { updatedAt: timestamp } : {}),
                    ...(timestamp !== undefined && (args.overwriteNewItemTimestamps || item.lastSeenAt === undefined) ? { lastSeenAt: timestamp } : {}),
                    ...(!(Number.isFinite(Number(item.timesSeen)) && Number(item.timesSeen) > 0) ? { timesSeen: 1 } : {}),
                }
            })(),
        })) as never
    }

    return nextState
}

export function mergeAcceptedCharacterEvolutionState(args: {
    currentState: CharacterEvolutionState
    proposedState: CharacterEvolutionState
}): CharacterEvolutionState {
    const nextState = structuredClone(args.proposedState)

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const currentItems = Array.isArray(args.currentState[key])
            ? structuredClone(args.currentState[key] as CharacterEvolutionItem[])
            : []
        const proposedItems = Array.isArray(args.proposedState[key])
            ? structuredClone(args.proposedState[key] as CharacterEvolutionItem[])
            : []
        const activeCurrentExactMatchKeys = itemValueKeysForSection(
            currentItems.filter((item) => (item.status ?? "active") === "active"),
            getCharacterEvolutionItemExactMatchKey,
        )
        const activeCurrentNormalizedMatchKeys = itemValueKeysForSection(
            currentItems.filter((item) => (item.status ?? "active") === "active"),
            getCharacterEvolutionItemNormalizedMatchKey,
        )
        const mergedItems: CharacterEvolutionItem[] = []

        for (const currentItem of currentItems) {
            const currentStatus = normalizeCharacterEvolutionItemStatus(currentItem)
            const currentExactKey = getCharacterEvolutionItemExactMatchKey(currentItem)
            const currentNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(currentItem)
            const hasMatchingActiveTwin = currentStatus !== "active" && (
                (currentExactKey.length > 0 && activeCurrentExactMatchKeys.has(currentExactKey))
                || (currentNormalizedKey.length > 0 && activeCurrentNormalizedMatchKeys.has(currentNormalizedKey))
            )

            if (currentStatus === "corrected") {
                mergedItems.push(currentItem)
                continue
            }

            if (hasMatchingActiveTwin) {
                mergedItems.push(currentItem)
                continue
            }

            const matchingProposedItemIndex = currentStatus === "active" || currentStatus === "archived"
                ? findMatchingItemIndex(proposedItems, currentItem, ["active", "archived", "corrected"])
                : -1

            if (matchingProposedItemIndex >= 0) {
                mergedItems.push(createMergedMatchedItem(currentItem, proposedItems[matchingProposedItemIndex]))
                proposedItems.splice(matchingProposedItemIndex, 1)
                continue
            }

            if (currentStatus === "archived" || currentStatus === "corrected") {
                mergedItems.push(currentItem)
            }
        }

        mergedItems.push(...proposedItems)
        nextState[key] = mergedItems as never
    }

    return nextState
}
