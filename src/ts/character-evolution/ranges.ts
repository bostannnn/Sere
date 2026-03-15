import type {
    CharacterEvolutionProcessedRange,
    CharacterEvolutionRangeRef,
    CharacterEvolutionSettings,
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
