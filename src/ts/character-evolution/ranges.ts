import type {
    CharacterEvolutionProcessedRange,
    CharacterEvolutionRangeRef,
    CharacterEvolutionSettings,
    CharacterEvolutionVersionMeta,
    character,
} from "../storage/database.types"

function toInteger(value: unknown): number | null {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
        return null
    }
    return Math.floor(parsed)
}

export function normalizeCharacterEvolutionRangeRef(raw: unknown): CharacterEvolutionRangeRef | null {
    if (!raw || typeof raw !== "object") {
        return null
    }

    const value = raw as Record<string, unknown>
    const chatId = typeof value.chatId === "string" ? value.chatId.trim() : ""
    const startMessageIndex = toInteger(value.startMessageIndex)
    const endMessageIndex = toInteger(value.endMessageIndex)
    if (!chatId || startMessageIndex === null || endMessageIndex === null) {
        return null
    }
    if (startMessageIndex < 0 || endMessageIndex < startMessageIndex) {
        return null
    }

    return {
        chatId,
        startMessageIndex,
        endMessageIndex,
    }
}

export function getCharacterEvolutionProcessedRanges(
    settings: Pick<CharacterEvolutionSettings, "processedRanges" | "stateVersions"> | null | undefined,
): CharacterEvolutionProcessedRange[] {
    const explicitRanges = Array.isArray(settings?.processedRanges)
        ? settings.processedRanges
        : []
    if (explicitRanges.length > 0) {
        return explicitRanges
            .map((entry) => {
                if (!entry || typeof entry !== "object") {
                    return null
                }
                const item = entry as unknown as Record<string, unknown>
                const range = normalizeCharacterEvolutionRangeRef(item.range)
                const version = toInteger(item.version)
                if (!range || version === null || version < 0) {
                    return null
                }
                return {
                    version,
                    acceptedAt: Number.isFinite(Number(item.acceptedAt))
                        ? Number(item.acceptedAt)
                        : 0,
                    range,
                }
            })
            .filter((entry): entry is CharacterEvolutionProcessedRange => !!entry)
    }

    return Array.isArray(settings?.stateVersions)
        ? settings.stateVersions
            .map((entry) => {
                const range = normalizeCharacterEvolutionRangeRef(entry?.range)
                const version = toInteger(entry?.version)
                const acceptedAt = Number.isFinite(Number(entry?.acceptedAt)) ? Number(entry?.acceptedAt) : 0
                if (!range || version === null || version < 0) {
                    return null
                }
                return {
                    version,
                    acceptedAt,
                    range,
                }
            })
            .filter((entry): entry is CharacterEvolutionProcessedRange => !!entry)
        : []
}

export function getLastProcessedMessageIndexForChat(
    settings: Pick<CharacterEvolutionSettings, "lastProcessedChatId" | "lastProcessedMessageIndexByChat" | "processedRanges" | "stateVersions"> | null | undefined,
    chatId: string | null | undefined,
): number {
    if (!chatId) {
        return -1
    }

    let derivedCursor = -1
    for (const entry of getCharacterEvolutionProcessedRanges(settings)) {
        if (entry.range.chatId !== chatId) {
            continue
        }
        derivedCursor = Math.max(derivedCursor, entry.range.endMessageIndex)
    }
    if (derivedCursor >= 0) {
        return derivedCursor
    }

    const explicitCursor = settings?.lastProcessedMessageIndexByChat?.[chatId]
    if (Number.isFinite(Number(explicitCursor))) {
        return Math.max(-1, Math.floor(Number(explicitCursor)))
    }

    return -1
}

export function getNextUnprocessedMessageIndexForChat(
    settings: Pick<CharacterEvolutionSettings, "lastProcessedChatId" | "lastProcessedMessageIndexByChat" | "processedRanges" | "stateVersions"> | null | undefined,
    chatId: string | null | undefined,
): number {
    if (!chatId) {
        return 0
    }

    const chatRanges = getCharacterEvolutionProcessedRanges(settings)
        .filter((entry) => entry.range.chatId === chatId)
        .sort((left, right) => left.range.startMessageIndex - right.range.startMessageIndex)

    if (chatRanges.length > 0) {
        let contiguousProcessedEnd = -1
        for (const entry of chatRanges) {
            if (entry.range.startMessageIndex > contiguousProcessedEnd + 1) {
                break
            }
            contiguousProcessedEnd = Math.max(contiguousProcessedEnd, entry.range.endMessageIndex)
        }
        return contiguousProcessedEnd + 1
    }

    return getLastProcessedMessageIndexForChat(settings, chatId) + 1
}

function rebaseRangeAfterMessageDeletion(
    range: CharacterEvolutionRangeRef,
    chatId: string,
    startMessageIndex: number,
    endMessageIndex: number,
): CharacterEvolutionRangeRef | null {
    if (range.chatId !== chatId) {
        return range
    }

    const removedCount = endMessageIndex - startMessageIndex + 1
    if (removedCount <= 0) {
        return range
    }

    if (range.endMessageIndex < startMessageIndex) {
        return range
    }

    if (range.startMessageIndex > endMessageIndex) {
        return {
            ...range,
            startMessageIndex: range.startMessageIndex - removedCount,
            endMessageIndex: range.endMessageIndex - removedCount,
        }
    }

    if (range.startMessageIndex >= startMessageIndex && range.endMessageIndex <= endMessageIndex) {
        return null
    }

    if (range.startMessageIndex < startMessageIndex && range.endMessageIndex <= endMessageIndex) {
        return {
            ...range,
            endMessageIndex: startMessageIndex - 1,
        }
    }

    if (range.startMessageIndex >= startMessageIndex && range.endMessageIndex > endMessageIndex) {
        return {
            ...range,
            startMessageIndex,
            endMessageIndex: range.endMessageIndex - removedCount,
        }
    }

    return {
        ...range,
        endMessageIndex: range.endMessageIndex - removedCount,
    }
}

function deriveLastProcessedMessageIndexByChat(
    ranges: CharacterEvolutionProcessedRange[],
): Record<string, number> {
    const cursors: Record<string, number> = {}

    for (const entry of ranges) {
        const current = cursors[entry.range.chatId] ?? -1
        cursors[entry.range.chatId] = Math.max(current, entry.range.endMessageIndex)
    }

    return cursors
}

function normalizeLastProcessedMessageIndexByChat(
    value: CharacterEvolutionSettings["lastProcessedMessageIndexByChat"] | null | undefined,
): Record<string, number> {
    const cursors: Record<string, number> = {}
    if (!value || typeof value !== "object") {
        return cursors
    }

    for (const [chatId, endIndex] of Object.entries(value)) {
        const normalizedChatId = typeof chatId === "string" ? chatId.trim() : ""
        const numericEndIndex = Number(endIndex)
        if (!normalizedChatId || !Number.isFinite(numericEndIndex)) {
            continue
        }
        cursors[normalizedChatId] = Math.max(-1, Math.floor(numericEndIndex))
    }

    return cursors
}

function rebaseLastProcessedMessageIndexAfterDeletion(
    lastProcessedMessageIndex: number,
    startMessageIndex: number,
    endMessageIndex: number,
): number {
    const removedCount = endMessageIndex - startMessageIndex + 1
    if (removedCount <= 0) {
        return Math.max(-1, Math.floor(lastProcessedMessageIndex))
    }

    if (lastProcessedMessageIndex < startMessageIndex) {
        return Math.max(-1, Math.floor(lastProcessedMessageIndex))
    }

    if (lastProcessedMessageIndex <= endMessageIndex) {
        return Math.max(-1, startMessageIndex - 1)
    }

    return Math.max(-1, Math.floor(lastProcessedMessageIndex) - removedCount)
}

function deriveLastProcessedChatId(
    stateVersions: CharacterEvolutionVersionMeta[],
    processedRanges: CharacterEvolutionProcessedRange[],
    fallbackChatId: string | null,
): string | null {
    if (fallbackChatId) {
        return fallbackChatId
    }

    const latestVersionWithRange = [...stateVersions]
        .filter((entry) => !!entry?.range?.chatId)
        .sort((left, right) => {
            if (left.version !== right.version) {
                return left.version - right.version
            }
            return left.acceptedAt - right.acceptedAt
        })
        .at(-1)
    if (latestVersionWithRange?.range?.chatId) {
        return latestVersionWithRange.range.chatId
    }

    const latestProcessedRange = [...processedRanges]
        .sort((left, right) => {
            if (left.version !== right.version) {
                return left.version - right.version
            }
            return left.acceptedAt - right.acceptedAt
        })
        .at(-1)
    return latestProcessedRange?.range.chatId ?? null
}

export function rebaseEvolutionCoverageAfterMessageDeletion(
    settings: Pick<CharacterEvolutionSettings, "lastProcessedChatId" | "lastProcessedMessageIndexByChat" | "processedRanges" | "stateVersions"> | null | undefined,
    chatId: string | null | undefined,
    startMessageIndex: number,
    endMessageIndex: number,
): Pick<CharacterEvolutionSettings, "lastProcessedChatId" | "lastProcessedMessageIndexByChat" | "processedRanges" | "stateVersions"> {
    const normalizedChatId = typeof chatId === "string" ? chatId.trim() : ""
    if (
        !normalizedChatId
        || !Number.isInteger(startMessageIndex)
        || !Number.isInteger(endMessageIndex)
        || startMessageIndex < 0
        || endMessageIndex < startMessageIndex
    ) {
        return {
            lastProcessedChatId: settings?.lastProcessedChatId ?? null,
            lastProcessedMessageIndexByChat: {
                ...(settings?.lastProcessedMessageIndexByChat ?? {}),
            },
            processedRanges: Array.isArray(settings?.processedRanges)
                ? structuredClone(settings.processedRanges)
                : [],
            stateVersions: Array.isArray(settings?.stateVersions)
                ? structuredClone(settings.stateVersions)
                : [],
        }
    }

    const nextProcessedRanges = (Array.isArray(settings?.processedRanges) ? settings.processedRanges : [])
        .map((entry) => {
            const range = normalizeCharacterEvolutionRangeRef(entry?.range)
            if (!entry || typeof entry !== "object" || !range) {
                return null
            }
            const nextRange = rebaseRangeAfterMessageDeletion(range, normalizedChatId, startMessageIndex, endMessageIndex)
            if (!nextRange) {
                return null
            }
            return {
                version: toInteger(entry.version) ?? 0,
                acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                range: nextRange,
            }
        })
        .filter((entry): entry is CharacterEvolutionProcessedRange => !!entry)

    const nextStateVersions = (Array.isArray(settings?.stateVersions) ? settings.stateVersions : [])
        .map((entry) => {
            const base: CharacterEvolutionVersionMeta = {
                version: toInteger(entry?.version) ?? 0,
                chatId: typeof entry?.chatId === "string" ? entry.chatId : null,
                acceptedAt: Number.isFinite(Number(entry?.acceptedAt)) ? Number(entry.acceptedAt) : 0,
            }
            const range = normalizeCharacterEvolutionRangeRef(entry?.range)
            if (!range) {
                return base
            }
            const nextRange = rebaseRangeAfterMessageDeletion(range, normalizedChatId, startMessageIndex, endMessageIndex)
            if (!nextRange) {
                return base
            }
            return {
                ...base,
                chatId: nextRange.chatId,
                range: nextRange,
            }
        })

    const effectiveRanges = getCharacterEvolutionProcessedRanges({
        processedRanges: nextProcessedRanges,
        stateVersions: nextStateVersions,
    })
    const nextLastProcessedMessageIndexByChat = normalizeLastProcessedMessageIndexByChat(
        settings?.lastProcessedMessageIndexByChat,
    )
    if (Object.prototype.hasOwnProperty.call(nextLastProcessedMessageIndexByChat, normalizedChatId)) {
        nextLastProcessedMessageIndexByChat[normalizedChatId] = rebaseLastProcessedMessageIndexAfterDeletion(
            nextLastProcessedMessageIndexByChat[normalizedChatId] ?? -1,
            startMessageIndex,
            endMessageIndex,
        )
    }
    for (const [chatId, endIndex] of Object.entries(deriveLastProcessedMessageIndexByChat(effectiveRanges))) {
        nextLastProcessedMessageIndexByChat[chatId] = Math.max(
            nextLastProcessedMessageIndexByChat[chatId] ?? -1,
            endIndex,
        )
    }

    const preferredLastProcessedChatId = (() => {
        const current = typeof settings?.lastProcessedChatId === "string" ? settings.lastProcessedChatId.trim() : ""
        if (
            current
            && Object.prototype.hasOwnProperty.call(nextLastProcessedMessageIndexByChat, current)
            && (nextLastProcessedMessageIndexByChat[current] ?? -1) >= 0
        ) {
            return current
        }
        return null
    })()

    return {
        lastProcessedChatId: deriveLastProcessedChatId(nextStateVersions, nextProcessedRanges, preferredLastProcessedChatId),
        lastProcessedMessageIndexByChat: nextLastProcessedMessageIndexByChat,
        processedRanges: nextProcessedRanges,
        stateVersions: nextStateVersions,
    }
}

export function hasAcceptedEvolutionForChat(
    characterEntry: character | null | undefined,
    chatId: string | null | undefined,
    messageCount?: number | null,
): boolean {
    if (!characterEntry?.chaId || !chatId) {
        return false
    }

    const processedEnd = getLastProcessedMessageIndexForChat(characterEntry.characterEvolution, chatId)
    if (processedEnd < 0) {
        return false
    }

    if (!Number.isFinite(Number(messageCount))) {
        return true
    }

    const normalizedMessageCount = Math.max(0, Math.floor(Number(messageCount)))
    if (normalizedMessageCount === 0) {
        return false
    }
    return processedEnd >= normalizedMessageCount - 1
}
