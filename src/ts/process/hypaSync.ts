import type { StateSnapshot } from '../storage/serverStateClient'

type HypaShape = {
    summaries?: unknown[]
    lastSummarizedMessageIndex?: unknown
    metrics?: {
        lastImportantSummaries?: unknown[]
        lastRecentSummaries?: unknown[]
        lastSimilarSummaries?: unknown[]
        lastRandomSummaries?: unknown[]
    }
}

type DebugLike = {
    timestamp?: unknown
}

function countMetricEntries(data: unknown): number {
    if (!data || typeof data !== 'object') return 0
    const metrics = (data as HypaShape).metrics
    if (!metrics || typeof metrics !== 'object') return 0
    const keys: Array<keyof NonNullable<HypaShape['metrics']>> = [
        'lastImportantSummaries',
        'lastRecentSummaries',
        'lastSimilarSummaries',
        'lastRandomSummaries',
    ]
    let total = 0
    for (const key of keys) {
        const rows = metrics[key]
        if (Array.isArray(rows)) total += rows.length
    }
    return total
}

function toTimestamp(value: unknown): number {
    if (!value || typeof value !== 'object') return -1
    const n = Number((value as DebugLike).timestamp)
    if (!Number.isFinite(n) || n < 0) return -1
    return n
}

function countSummaries(data: unknown): number {
    if (!data || typeof data !== 'object') return 0
    const summaries = (data as HypaShape).summaries
    return Array.isArray(summaries) ? summaries.length : 0
}

function summarizedIndex(data: unknown): number {
    if (!data || typeof data !== 'object') return 0
    const value = Number((data as HypaShape).lastSummarizedMessageIndex)
    if (!Number.isFinite(value) || value < 0) return 0
    return Math.floor(value)
}

export function shouldAdoptServerHypaV3Data(localData: unknown, serverData: unknown): boolean {
    if (!serverData || typeof serverData !== 'object') {
        return false
    }

    const serverIndex = summarizedIndex(serverData)
    const localIndex = summarizedIndex(localData)
    if (serverIndex > localIndex) {
        return true
    }
    if (serverIndex < localIndex) {
        return false
    }

    const serverSummaries = countSummaries(serverData)
    const localSummaries = countSummaries(localData)
    if (serverSummaries > localSummaries) {
        return true
    }
    if (serverSummaries < localSummaries) {
        return false
    }

    const serverMetricEntries = countMetricEntries(serverData)
    const localMetricEntries = countMetricEntries(localData)
    return serverMetricEntries > localMetricEntries
}

export function extractServerChatHypaV3Data(
    snapshot: StateSnapshot | null | undefined,
    charId: string,
    chatId: string,
): unknown | null {
    if (!snapshot || typeof snapshot !== 'object') return null
    if (!charId || !chatId) return null
    const chatsByCharacter = snapshot.chatsByCharacter
    if (!chatsByCharacter || typeof chatsByCharacter !== 'object') return null
    const charChats = (chatsByCharacter as Record<string, unknown[]>)[charId]
    if (!Array.isArray(charChats)) return null
    const chat = charChats.find((entry) => (
        !!entry
        && typeof entry === 'object'
        && (entry as { id?: unknown }).id === chatId
    ))
    if (!chat || typeof chat !== 'object') return null
    const hypa = (chat as { hypaV3Data?: unknown }).hypaV3Data
    if (!hypa || typeof hypa !== 'object') return null
    return hypa
}

export function pickLatestSummarizeDebug<T extends { timestamp?: unknown }>(
    ...entries: Array<T | null | undefined>
): T | null {
    let next: T | null = null
    let nextTs = -1
    let fallback: T | null = null
    for (const entry of entries) {
        if (!fallback && entry) {
            fallback = entry
        }
        const ts = toTimestamp(entry)
        if (ts < 0) continue
        if (ts > nextTs) {
            next = entry as T
            nextTs = ts
        }
    }
    return next ?? fallback
}

export async function tryServerHypaMerge(arg: {
    attempted: boolean
    enabled: boolean
    charId: string
    chatId: string
    localData: unknown
    fetchSnapshot: () => Promise<StateSnapshot>
}): Promise<{
    attempted: boolean
    merged: boolean
    data: unknown | null
    error: unknown | null
}> {
    if (arg.attempted || !arg.enabled || !arg.charId || !arg.chatId) {
        return {
            attempted: arg.attempted,
            merged: false,
            data: null,
            error: null,
        }
    }

    let snapshot: StateSnapshot | null = null
    try {
        snapshot = await arg.fetchSnapshot()
    } catch (error) {
        return {
            attempted: false,
            merged: false,
            data: null,
            error,
        }
    }
    const serverData = extractServerChatHypaV3Data(snapshot, arg.charId, arg.chatId)
    const shouldMerge = shouldAdoptServerHypaV3Data(arg.localData, serverData)
    return {
        attempted: true,
        merged: shouldMerge,
        data: shouldMerge ? serverData : null,
        error: null,
    }
}
