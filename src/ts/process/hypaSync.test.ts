import { describe, expect, it } from 'vitest'
import { extractServerChatHypaV3Data, shouldAdoptServerHypaV3Data } from './hypaSync'

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
