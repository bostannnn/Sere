import type { StateSnapshot } from '../storage/serverStateClient'

type HypaShape = {
    summaries?: unknown[]
    lastSummarizedMessageIndex?: unknown
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
    return serverSummaries > localSummaries
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
