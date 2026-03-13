import type {
    CharacterEvolutionItem,
    CharacterEvolutionRangeRef,
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

function normalizeItemValueKey(item: CharacterEvolutionItem): string {
    return item.value.trim().toLowerCase()
}

function itemValueKeysForSection(items: CharacterEvolutionItem[]): Set<string> {
    return new Set(
        items
            .map((item) => normalizeItemValueKey(item))
            .filter((value) => value.length > 0),
    )
}

function findMatchingBaseItem(
    items: CharacterEvolutionItem[],
    candidate: CharacterEvolutionItem,
): CharacterEvolutionItem | undefined {
    const candidateValueKey = normalizeItemValueKey(candidate)
    const sameValueItems = items.filter((item) => normalizeItemValueKey(item) === candidateValueKey)
    if (sameValueItems.length === 0) {
        return undefined
    }
    const candidateStatus = candidate.status ?? "active"
    return sameValueItems.find((item) => (item.status ?? "active") === candidateStatus)
        ?? sameValueItems.find((item) => (item.status ?? "active") === "active")
        ?? sameValueItems[0]
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
                        ...(baseMatch.sourceChatId && !item.sourceChatId ? { sourceChatId: baseMatch.sourceChatId } : {}),
                        ...(baseMatch.sourceRange && !item.sourceRange ? { sourceRange: { ...baseMatch.sourceRange } } : {}),
                        ...(baseMatch.updatedAt !== undefined && item.updatedAt === undefined ? { updatedAt: baseMatch.updatedAt } : {}),
                        ...(baseMatch.lastSeenAt !== undefined && item.lastSeenAt === undefined ? { lastSeenAt: baseMatch.lastSeenAt } : {}),
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
        const activeCurrentValueKeys = itemValueKeysForSection(
            currentItems.filter((item) => (item.status ?? "active") === "active"),
        )
        const mergedItems: CharacterEvolutionItem[] = []

        for (const currentItem of currentItems) {
            const currentValueKey = normalizeItemValueKey(currentItem)
            const currentStatus = currentItem.status ?? "active"
            const matchingProposedItemIndex = proposedItems.findIndex(
                (item) => normalizeItemValueKey(item) === currentValueKey,
            )

            if (currentStatus !== "active" && currentValueKey.length > 0 && activeCurrentValueKeys.has(currentValueKey)) {
                mergedItems.push(currentItem)
                continue
            }

            if (matchingProposedItemIndex >= 0) {
                mergedItems.push(proposedItems[matchingProposedItemIndex])
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
