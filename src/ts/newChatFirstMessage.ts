export interface NewChatFirstMessageSelectorCharacter {
    type?: 'character' | 'group'
    randomAltFirstMessageOnNewChat?: boolean
    alternateGreetings?: string[]
    chaId?: string
    chats?: unknown[]
    name?: string
}

export interface RandomLike {
    getRandomValues: (array: Uint32Array) => Uint32Array
}

function pickRandomAltFirstMessageIndex(maxExclusive:number, randomSource?: RandomLike):number|null {
    if(maxExclusive <= 0 || !randomSource){
        return null
    }
    const random = new Uint32Array(1)
    randomSource.getRandomValues(random)
    return random[0] % maxExclusive
}

function pickDeterministicAltFirstMessageIndex(chara:NewChatFirstMessageSelectorCharacter, maxExclusive:number){
    const seed = `${chara.chaId ?? ''}:${chara.chats?.length ?? 0}:${chara.name ?? ''}`
    let hash = 0
    for(let i = 0; i < seed.length; i++){
        hash = ((hash * 31) + seed.charCodeAt(i)) >>> 0
    }
    return hash % maxExclusive
}

export function getNewChatFirstMessageIndex(
    chara:NewChatFirstMessageSelectorCharacter,
    randomSource?: RandomLike,
){
    if(chara.type === 'group'){
        return -1
    }

    const altCount = chara.alternateGreetings?.length ?? 0
    if(!chara.randomAltFirstMessageOnNewChat || altCount === 0){
        return -1
    }

    const providedRandomSource = randomSource
        ?? ((typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function')
            ? globalThis.crypto
            : undefined)

    const randomIndex = pickRandomAltFirstMessageIndex(altCount, providedRandomSource)
    if(randomIndex !== null){
        return randomIndex
    }

    return pickDeterministicAltFirstMessageIndex(chara, altCount)
}
