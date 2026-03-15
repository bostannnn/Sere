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

const REINFORCEMENT_MATCH_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "userFacts",
    "activeThreads",
])

const CHARACTER_EVOLUTION_MATCH_STOPWORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "been",
    "being",
    "but",
    "by",
    "for",
    "from",
    "had",
    "has",
    "have",
    "he",
    "her",
    "hers",
    "him",
    "his",
    "i",
    "in",
    "into",
    "is",
    "it",
    "its",
    "me",
    "my",
    "of",
    "on",
    "or",
    "our",
    "ours",
    "she",
    "that",
    "the",
    "their",
    "theirs",
    "them",
    "they",
    "this",
    "to",
    "up",
    "us",
    "we",
    "with",
    "you",
    "your",
    "yours",
])

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

function tokenizeCharacterEvolutionItem(item: CharacterEvolutionItem | string): string[] {
    return getCharacterEvolutionItemNormalizedMatchKey(item)
        .split(" ")
        .map((token) => token.trim())
        .filter(Boolean)
}

function getMeaningfulCharacterEvolutionItemTokens(item: CharacterEvolutionItem | string): string[] {
    return tokenizeCharacterEvolutionItem(item)
        .filter((token) => !CHARACTER_EVOLUTION_MATCH_STOPWORDS.has(token))
}

function countCommonTokenPrefix(left: string[], right: string[]): number {
    const max = Math.min(left.length, right.length)
    let count = 0
    for (let index = 0; index < max; index += 1) {
        if (left[index] !== right[index]) {
            break
        }
        count += 1
    }
    return count
}

function countCommonTokenSuffix(left: string[], right: string[], prefixCount: number): number {
    const max = Math.min(left.length, right.length) - prefixCount
    let count = 0
    for (let index = 1; index <= max; index += 1) {
        if (left[left.length - index] !== right[right.length - index]) {
            break
        }
        count += 1
    }
    return count
}

function isTokenPrefix(shorter: string[], longer: string[]): boolean {
    if (shorter.length === 0 || shorter.length > longer.length) {
        return false
    }
    return shorter.every((token, index) => token === longer[index])
}

function isTokenSuffix(shorter: string[], longer: string[]): boolean {
    if (shorter.length === 0 || shorter.length > longer.length) {
        return false
    }
    return shorter.every((token, index) => token === longer[longer.length - shorter.length + index])
}

function containsTokenSubsequence(shorter: string[], longer: string[]): boolean {
    if (shorter.length === 0 || shorter.length > longer.length) {
        return false
    }
    for (let startIndex = 0; startIndex <= longer.length - shorter.length; startIndex += 1) {
        let matches = true
        for (let offset = 0; offset < shorter.length; offset += 1) {
            if (longer[startIndex + offset] !== shorter[offset]) {
                matches = false
                break
            }
        }
        if (matches) {
            return true
        }
    }
    return false
}

function countSharedTokens(left: string[], right: string[]): number {
    const rightTokens = new Set(right)
    return [...new Set(left)].filter((token) => rightTokens.has(token)).length
}

export function doCharacterEvolutionItemsReinforceSameIdea(
    sectionKey: CharacterEvolutionItemSectionKey,
    left: CharacterEvolutionItem | string,
    right: CharacterEvolutionItem | string,
): boolean {
    if (!REINFORCEMENT_MATCH_SECTIONS.has(sectionKey) || doCharacterEvolutionItemsMatch(left, right)) {
        return false
    }

    const leftTokens = tokenizeCharacterEvolutionItem(left)
    const rightTokens = tokenizeCharacterEvolutionItem(right)
    if (leftTokens.length === 0 || rightTokens.length === 0) {
        return false
    }

    const commonPrefixCount = countCommonTokenPrefix(leftTokens, rightTokens)
    const commonSuffixCount = countCommonTokenSuffix(leftTokens, rightTokens, commonPrefixCount)

    const leftMeaningfulTokens = getMeaningfulCharacterEvolutionItemTokens(left)
    const rightMeaningfulTokens = getMeaningfulCharacterEvolutionItemTokens(right)
    if (leftMeaningfulTokens.length === 0 || rightMeaningfulTokens.length === 0) {
        return false
    }
    const meaningfulPrefixCount = countCommonTokenPrefix(leftMeaningfulTokens, rightMeaningfulTokens)
    const meaningfulSuffixCount = countCommonTokenSuffix(
        leftMeaningfulTokens,
        rightMeaningfulTokens,
        meaningfulPrefixCount,
    )

    const [shorterMeaningfulTokens, longerMeaningfulTokens] = leftMeaningfulTokens.length <= rightMeaningfulTokens.length
        ? [leftMeaningfulTokens, rightMeaningfulTokens]
        : [rightMeaningfulTokens, leftMeaningfulTokens]

    const sharedMeaningfulTokenCount = countSharedTokens(shorterMeaningfulTokens, longerMeaningfulTokens)
    const hasStrongBoundaryMatch = commonPrefixCount >= 3
        || commonSuffixCount >= 3
        || meaningfulPrefixCount >= 3
        || meaningfulSuffixCount >= 3
    const hasContainedMeaningfulSubsequence = containsTokenSubsequence(
        shorterMeaningfulTokens,
        longerMeaningfulTokens,
    )
    const hasHighMeaningfulTokenOverlap = shorterMeaningfulTokens.length >= 4
        && sharedMeaningfulTokenCount >= Math.max(3, shorterMeaningfulTokens.length - 1)

    if (!hasStrongBoundaryMatch && !hasContainedMeaningfulSubsequence && !hasHighMeaningfulTokenOverlap) {
        return false
    }

    return isTokenPrefix(shorterMeaningfulTokens, longerMeaningfulTokens)
        || isTokenSuffix(shorterMeaningfulTokens, longerMeaningfulTokens)
        || hasContainedMeaningfulSubsequence
        || hasHighMeaningfulTokenOverlap
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

function normalizeCharacterEvolutionItemUnseenAcceptedHandoffs(item: CharacterEvolutionItem | null | undefined): number | undefined {
    if (!Number.isFinite(Number(item?.unseenAcceptedHandoffs)) || Number(item?.unseenAcceptedHandoffs) < 0) {
        return undefined
    }
    return Math.max(0, Math.floor(Number(item?.unseenAcceptedHandoffs)))
}

function normalizeCharacterEvolutionItemLastSeenVersion(item: CharacterEvolutionItem | null | undefined): number | undefined {
    if (!Number.isFinite(Number(item?.lastSeenVersion)) || Number(item?.lastSeenVersion) <= 0) {
        return undefined
    }
    return Math.max(1, Math.floor(Number(item?.lastSeenVersion)))
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

interface MatchingItemSearchOptions {
    allowReinforcement?: boolean
}

function getMatchingItemIndexes(
    sectionKey: CharacterEvolutionItemSectionKey,
    items: CharacterEvolutionItem[],
    candidate: CharacterEvolutionItem,
    statusOrder: CharacterEvolutionStatus[],
    options: MatchingItemSearchOptions = {},
): number[] {
    const allowedStatuses = new Set(statusOrder)
    return items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => allowedStatuses.has(normalizeCharacterEvolutionItemStatus(item)))
        .filter(({ item }) => doCharacterEvolutionItemsMatch(item, candidate)
            || (options.allowReinforcement && doCharacterEvolutionItemsReinforceSameIdea(sectionKey, item, candidate)))
        .map(({ index }) => index)
}

function pickPreferredMatchingItemIndex(
    items: CharacterEvolutionItem[],
    candidateIndexes: number[],
    statusOrder: CharacterEvolutionStatus[],
): number {
    const statusRanks = new Map(statusOrder.map((status, index) => [status, index]))
    return candidateIndexes.reduce((bestIndex, candidateIndex) => {
        if (bestIndex < 0) {
            return candidateIndex
        }

        const bestItem = items[bestIndex]
        const candidateItem = items[candidateIndex]
        const bestStatusRank = statusRanks.get(normalizeCharacterEvolutionItemStatus(bestItem)) ?? statusOrder.length
        const candidateStatusRank = statusRanks.get(normalizeCharacterEvolutionItemStatus(candidateItem)) ?? statusOrder.length
        if (bestStatusRank !== candidateStatusRank) {
            return candidateStatusRank < bestStatusRank ? candidateIndex : bestIndex
        }

        const bestConfidenceRank = bestItem.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[bestItem.confidence] : -1
        const candidateConfidenceRank = candidateItem.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[candidateItem.confidence] : -1
        if (bestConfidenceRank !== candidateConfidenceRank) {
            return candidateConfidenceRank > bestConfidenceRank ? candidateIndex : bestIndex
        }

        const bestTokenCount = tokenizeCharacterEvolutionItem(bestItem).length
        const candidateTokenCount = tokenizeCharacterEvolutionItem(candidateItem).length
        if (bestTokenCount !== candidateTokenCount) {
            return candidateTokenCount > bestTokenCount ? candidateIndex : bestIndex
        }

        return candidateIndex
    }, -1)
}

function findMatchingItemIndex(
    sectionKey: CharacterEvolutionItemSectionKey,
    items: CharacterEvolutionItem[],
    candidate: CharacterEvolutionItem,
    statusOrder: CharacterEvolutionStatus[],
    options: MatchingItemSearchOptions = {},
): number {
    const matchingIndexes = getMatchingItemIndexes(sectionKey, items, candidate, statusOrder, options)
    return pickPreferredMatchingItemIndex(items, matchingIndexes, statusOrder)
}

function findMatchingBaseItem(
    sectionKey: CharacterEvolutionItemSectionKey,
    items: CharacterEvolutionItem[],
    candidate: CharacterEvolutionItem,
): CharacterEvolutionItem | undefined {
    const matchingIndex = findMatchingItemIndex(
        sectionKey,
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
    const currentLastSeenVersion = normalizeCharacterEvolutionItemLastSeenVersion(currentItem)
    const proposedLastSeenVersion = normalizeCharacterEvolutionItemLastSeenVersion(proposedItem)
    const nextUnseenAcceptedHandoffs = normalizeCharacterEvolutionItemUnseenAcceptedHandoffs(proposedItem)
        ?? normalizeCharacterEvolutionItemUnseenAcceptedHandoffs(currentItem)
    const nextProposedConfidence = proposedItem.confidence ?? currentItem.confidence
    const nextProposedNote = proposedItem.note ?? currentItem.note
    const hasMeaningfulUpdate = currentItem.confidence !== nextProposedConfidence
        || normalizeCharacterEvolutionItemNote(currentItem) !== (typeof nextProposedNote === "string" ? nextProposedNote : "")
        || currentStatus !== nextStatus
    const shouldReinforce = !shouldPreserveHistoricalMetadata
        && (currentStatus === "archived" || hasMeaningfulUpdate)
    const shouldMarkSeenForDecay = currentStatus === "active" && nextStatus === "active"
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
    const nextLastSeenVersion = shouldReinforce || shouldMarkSeenForDecay
        ? proposedLastSeenVersion ?? currentLastSeenVersion
        : currentLastSeenVersion
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
        ...(nextLastSeenVersion !== undefined ? { lastSeenVersion: nextLastSeenVersion } : {}),
        ...(nextTimesSeen !== undefined ? { timesSeen: nextTimesSeen } : {}),
        ...(nextUnseenAcceptedHandoffs !== undefined ? { unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs } : {}),
    }
}

export function mergeReinforcedCharacterEvolutionItems(
    currentItem: CharacterEvolutionItem,
    proposedItem: CharacterEvolutionItem,
): CharacterEvolutionItem {
    return createMergedMatchedItem(currentItem, proposedItem)
}

function hasExplicitProposalItemUpdate(
    currentItem: CharacterEvolutionItem,
    proposedItem: CharacterEvolutionItem,
): boolean {
    if (normalizeCharacterEvolutionItemStatus(proposedItem) !== normalizeCharacterEvolutionItemStatus(currentItem)) {
        return true
    }
    if (proposedItem.confidence !== undefined && proposedItem.confidence !== currentItem.confidence) {
        return true
    }
    if (Object.prototype.hasOwnProperty.call(proposedItem, "note")) {
        return normalizeCharacterEvolutionItemNote(proposedItem) !== normalizeCharacterEvolutionItemNote(currentItem)
    }
    return false
}

export function pruneUnchangedCharacterEvolutionProposalState(args: {
    currentState: CharacterEvolutionState
    proposedState: Partial<CharacterEvolutionState>
}): Partial<CharacterEvolutionState> {
    const nextState = structuredClone((args.proposedState ?? {}) as Partial<CharacterEvolutionState>)

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(nextState, key) || REINFORCEMENT_MATCH_SECTIONS.has(key)) {
            continue
        }
        const proposedItems = Array.isArray(nextState[key])
            ? structuredClone(nextState[key] as CharacterEvolutionItem[])
            : []
        if (proposedItems.length === 0) {
            continue
        }

        const currentActiveItems = Array.isArray(args.currentState[key])
            ? (args.currentState[key] as CharacterEvolutionItem[]).filter((item) => normalizeCharacterEvolutionItemStatus(item) === "active")
            : []
        const filteredItems = proposedItems.filter((proposedItem) => {
            if (normalizeCharacterEvolutionItemStatus(proposedItem) !== "active") {
                return true
            }
            const matchingCurrentIndex = findMatchingItemIndex(key, currentActiveItems, proposedItem, ["active"])
            if (matchingCurrentIndex < 0) {
                return true
            }
            return hasExplicitProposalItemUpdate(currentActiveItems[matchingCurrentIndex], proposedItem)
        })

        if (filteredItems.length === 0) {
            delete nextState[key]
            continue
        }

        nextState[key] = filteredItems as never
    }

    return nextState
}

export function applyCharacterEvolutionItemMetadata(args: {
    state: CharacterEvolutionState
    baseState?: CharacterEvolutionState | null
    sourceChatId?: string | null
    sourceRange?: CharacterEvolutionRangeRef | null
    timestamp?: number | null
    acceptedVersion?: number | null
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
    const acceptedVersion = Number.isFinite(Number(args.acceptedVersion)) && Number(args.acceptedVersion) > 0
        ? Math.max(1, Math.floor(Number(args.acceptedVersion)))
        : undefined

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const baseItems = Array.isArray(args.baseState?.[key])
            ? args.baseState[key] as CharacterEvolutionItem[]
            : []
        nextState[key] = (nextState[key] as CharacterEvolutionItem[]).map((item) => ({
            ...item,
            status: item.status ?? "active",
            ...(() => {
                const baseMatch = findMatchingBaseItem(key, baseItems, item)
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
                        ...(acceptedVersion !== undefined && args.overwriteNewItemTimestamps
                            ? { lastSeenVersion: acceptedVersion }
                            : baseMatch.lastSeenVersion !== undefined && item.lastSeenVersion === undefined
                                ? { lastSeenVersion: baseMatch.lastSeenVersion }
                                : {}),
                        ...(baseMatch.timesSeen !== undefined && item.timesSeen === undefined ? { timesSeen: baseMatch.timesSeen } : {}),
                    }
                }
                return {
                    ...(sourceChatId && !item.sourceChatId ? { sourceChatId } : {}),
                    ...(sourceRange && !item.sourceRange ? { sourceRange: { ...sourceRange } } : {}),
                    ...(timestamp !== undefined && (args.overwriteNewItemTimestamps || item.updatedAt === undefined) ? { updatedAt: timestamp } : {}),
                    ...(timestamp !== undefined && (args.overwriteNewItemTimestamps || item.lastSeenAt === undefined) ? { lastSeenAt: timestamp } : {}),
                    ...(acceptedVersion !== undefined && (args.overwriteNewItemTimestamps || item.lastSeenVersion === undefined) ? { lastSeenVersion: acceptedVersion } : {}),
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
    const nextState = structuredClone(args.currentState)

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(args.proposedState, key)) {
            continue
        }
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
            const explicitHistoricalMatchIndex = currentStatus !== "active"
                ? findMatchingItemIndex(key, proposedItems, currentItem, [currentStatus])
                : -1

            if (explicitHistoricalMatchIndex >= 0) {
                mergedItems.push(createMergedMatchedItem(currentItem, proposedItems[explicitHistoricalMatchIndex]))
                proposedItems.splice(explicitHistoricalMatchIndex, 1)
                continue
            }

            if (currentStatus === "corrected") {
                mergedItems.push(currentItem)
                continue
            }

            if (hasMatchingActiveTwin) {
                mergedItems.push(currentItem)
                continue
            }

            const matchingProposedItemIndexes = currentStatus === "active" || currentStatus === "archived"
                ? getMatchingItemIndexes(key, proposedItems, currentItem, ["active", "archived", "corrected"], {
                    allowReinforcement: true,
                })
                : []

            if (matchingProposedItemIndexes.length > 0) {
                const matchingProposedItemIndex = pickPreferredMatchingItemIndex(
                    proposedItems,
                    matchingProposedItemIndexes,
                    ["active", "archived", "corrected"],
                )
                mergedItems.push(createMergedMatchedItem(currentItem, proposedItems[matchingProposedItemIndex]))
                for (const matchedIndex of [...matchingProposedItemIndexes].sort((left, right) => right - left)) {
                    proposedItems.splice(matchedIndex, 1)
                }
                continue
            }

            if (currentStatus === "archived") {
                mergedItems.push(currentItem)
            }
        }

        mergedItems.push(...proposedItems)
        nextState[key] = mergedItems as never
    }

    for (const key of CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(args.proposedState, key)) {
            continue
        }
        nextState[key] = structuredClone(args.proposedState[key]) as never
    }

    return nextState
}
