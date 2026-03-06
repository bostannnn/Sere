import { describe, expect, it } from 'vitest'
import { extractServerChatHypaV3Data, pickLatestSummarizeDebug, shouldAdoptServerHypaV3Data, tryServerHypaMerge } from './hypaSync'

describe('shouldAdoptServerHypaV3Data', () => {
    it('adopts server data when summarized index is newer', () => {
        const local = { summaries: [{ text: 'a' }], lastSummarizedMessageIndex: 4 }
        const server = { summaries: [{ text: 'a' }], lastSummarizedMessageIndex: 6 }
        expect(shouldAdoptServerHypaV3Data(local, server)).toBe(true)
    })

    it('adopts server data when index is equal but server has more summaries', () => {
        const local = { summaries: [{ text: 'a' }], lastSummarizedMessageIndex: 6 }
        const server = { summaries: [{ text: 'a' }, { text: 'b' }], lastSummarizedMessageIndex: 6 }
        expect(shouldAdoptServerHypaV3Data(local, server)).toBe(true)
    })

    it('does not adopt server data when local is newer', () => {
        const local = { summaries: [{ text: 'a' }, { text: 'b' }], lastSummarizedMessageIndex: 8 }
        const server = { summaries: [{ text: 'a' }], lastSummarizedMessageIndex: 6 }
        expect(shouldAdoptServerHypaV3Data(local, server)).toBe(false)
    })

    it('adopts server data when summary index/count are equal but server metrics are richer', () => {
        const local = {
            summaries: [{ text: 'a' }],
            lastSummarizedMessageIndex: 6,
            metrics: {
                lastImportantSummaries: [],
                lastRecentSummaries: [],
                lastSimilarSummaries: [],
                lastRandomSummaries: [],
            },
        }
        const server = {
            summaries: [{ text: 'a' }],
            lastSummarizedMessageIndex: 6,
            metrics: {
                lastImportantSummaries: [0],
                lastRecentSummaries: [0],
                lastSimilarSummaries: [],
                lastRandomSummaries: [],
            },
        }
        expect(shouldAdoptServerHypaV3Data(local, server)).toBe(true)
    })
})

describe('extractServerChatHypaV3Data', () => {
    it('returns hypaV3Data for the active chat', () => {
        const snapshot = {
            chatsByCharacter: {
                char_1: [
                    { id: 'chat_1', hypaV3Data: { summaries: [{ text: 'scene' }], lastSummarizedMessageIndex: 2 } },
                ],
            },
        } as unknown as Parameters<typeof extractServerChatHypaV3Data>[0]
        const hypa = extractServerChatHypaV3Data(snapshot, 'char_1', 'chat_1')
        expect(hypa).toEqual({ summaries: [{ text: 'scene' }], lastSummarizedMessageIndex: 2 })
    })

    it('returns null for missing chat', () => {
        const snapshot = {
            chatsByCharacter: {
                char_1: [{ id: 'chat_1', hypaV3Data: { summaries: [] } }],
            },
        } as unknown as Parameters<typeof extractServerChatHypaV3Data>[0]
        const hypa = extractServerChatHypaV3Data(snapshot, 'char_1', 'chat_2')
        expect(hypa).toBeNull()
    })
})

describe('pickLatestSummarizeDebug', () => {
    it('returns newest entry by timestamp', () => {
        const periodic = { source: 'periodic', timestamp: 100 }
        const manual = { source: 'manual', timestamp: 200 }
        expect(pickLatestSummarizeDebug(periodic, manual)).toEqual(manual)
    })

    it('falls back to first available entry when timestamps are missing or invalid', () => {
        const periodic = { source: 'periodic', timestamp: undefined }
        const manual = { source: 'manual', timestamp: 'bad' }
        expect(pickLatestSummarizeDebug(periodic, manual)).toEqual(periodic)
    })
})

describe('tryServerHypaMerge', () => {
    it('keeps attempted=false when snapshot fetch fails, so a later flush can retry', async () => {
        const result = await tryServerHypaMerge({
            attempted: false,
            enabled: true,
            charId: 'c1',
            chatId: 'chat1',
            localData: { summaries: [], lastSummarizedMessageIndex: 0 },
            fetchSnapshot: async () => {
                throw new Error('network')
            },
        })
        expect(result).toMatchObject({
            attempted: false,
            merged: false,
            data: null,
        })
        expect(result.error).toBeInstanceOf(Error)
    })

    it('marks attempted=true after successful fetch and returns merged data when server is newer', async () => {
        const result = await tryServerHypaMerge({
            attempted: false,
            enabled: true,
            charId: 'c1',
            chatId: 'chat1',
            localData: { summaries: [], lastSummarizedMessageIndex: 0 },
            fetchSnapshot: async () => ({
                chatsByCharacter: {
                    c1: [
                        {
                            id: 'chat1',
                            hypaV3Data: {
                                summaries: [{ text: 'scene' }],
                                lastSummarizedMessageIndex: 2,
                            },
                        },
                    ],
                },
            } as unknown as Parameters<typeof extractServerChatHypaV3Data>[0]),
        })
        expect(result.attempted).toBe(true)
        expect(result.merged).toBe(true)
        expect(result.error).toBeNull()
        expect(result.data).toEqual({
            summaries: [{ text: 'scene' }],
            lastSummarizedMessageIndex: 2,
        })
    })
})
