import type {
    CharacterEvolutionConfidence,
    CharacterEvolutionItem,
    CharacterEvolutionState,
} from "../storage/database.types"
import {
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
    type CharacterEvolutionItemSectionKey,
    doCharacterEvolutionItemsMatch,
    doCharacterEvolutionItemsReinforceSameIdea,
    mergeReinforcedCharacterEvolutionItems,
} from "./items"

const CONFLICT_CONFIDENCE_RANK: Record<CharacterEvolutionConfidence, number> = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
}

const ARCHIVE_ON_RESOLUTION_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "activeThreads",
    "runningJokes",
    "keyMoments",
])

const SLOT_REPLACEMENT_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "userFacts",
    "activeThreads",
])

const COMPARISON_CONFLICT_SECTIONS = new Set<CharacterEvolutionItemSectionKey>([
    "characterLikes",
    "characterDislikes",
    "characterBoundariesPreferences",
    "userLikes",
    "userDislikes",
    "characterIntimatePreferences",
    "userIntimatePreferences",
])

const CONFLICT_STOPWORDS = new Set([
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

const CONFLICT_MARKER_STOPWORDS = new Set([
    "archived",
    "archive",
    "closed",
    "complete",
    "completed",
    "concluded",
    "done",
    "ended",
    "finished",
    "irrelevant",
    "moved",
    "never",
    "no",
    "not",
    "obsolete",
    "on",
    "out",
    "over",
    "quit",
    "resolved",
    "retired",
    "settled",
    "stopped",
    "without",
    "wrapped",
])

const RESOLUTION_PATTERN = /\b(?:archived?|closed?|complete(?:d)?|concluded?|done|ended?|finished?|irrelevant|obsolete|over|resolved?|retired|settled?|wrapped)\b|no longer relevant|moved on|not important anymore/iu
const NEGATION_PATTERN = /\b(?:can't|cannot|couldn't|could not|didn't|did not|doesn't|does not|don't|do not|isn't|is not|never|no longer|not|quit|stopped|without|won't|will not|wouldn't|would not)\b/iu
const POSITIVE_PREFERENCE_TOKENS = new Set([
    "enjoy",
    "enjoying",
    "enjoys",
    "like",
    "liked",
    "likes",
    "love",
    "loved",
    "loves",
    "loving",
    "prefer",
    "preferred",
    "prefers",
    "preferring",
])
const NEGATIVE_PREFERENCE_TOKENS = new Set([
    "avoid",
    "avoided",
    "avoiding",
    "avoids",
    "dislike",
    "disliked",
    "dislikes",
    "hate",
    "hated",
    "hates",
    "hating",
])

type ConflictPreferencePolarity = "positive" | "negative" | null

interface ConflictItemAnalysis {
    normalizedValue: string
    tokens: string[]
    meaningfulTokens: string[]
    hasResolutionSignal: boolean
    hasNegationSignal: boolean
    preferencePolarity: ConflictPreferencePolarity
}

function normalizeConflictValue(valueRaw: string): string {
    return valueRaw
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[\p{P}\p{S}]+/gu, " ")
        .replace(/\s+/g, " ")
}

function analyzeConflictItem(item: CharacterEvolutionItem | string): ConflictItemAnalysis {
    const value = typeof item === "string" ? item : item.value
    const normalizedValue = normalizeConflictValue(value)
    const tokens = normalizedValue
        .split(" ")
        .map((token) => token.trim())
        .filter(Boolean)
    const meaningfulTokens = tokens.filter((token) => !CONFLICT_STOPWORDS.has(token) && !CONFLICT_MARKER_STOPWORDS.has(token))

    return {
        normalizedValue,
        tokens,
        meaningfulTokens,
        hasResolutionSignal: RESOLUTION_PATTERN.test(normalizedValue),
        hasNegationSignal: NEGATION_PATTERN.test(normalizedValue),
        preferencePolarity: getConflictPreferencePolarity(tokens),
    }
}

function getConflictPreferencePolarity(tokens: string[]): ConflictPreferencePolarity {
    const hasPositiveSignal = tokens.some((token) => POSITIVE_PREFERENCE_TOKENS.has(token))
    const hasNegativeSignal = tokens.some((token) => NEGATIVE_PREFERENCE_TOKENS.has(token))
    if (hasPositiveSignal === hasNegativeSignal) {
        return null
    }
    return hasPositiveSignal ? "positive" : "negative"
}

function countCommonPrefix(left: string[], right: string[]): number {
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

function countCommonSuffix(left: string[], right: string[], prefixCount: number): number {
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

function countSharedMeaningfulTokens(left: string[], right: string[]): number {
    if (left.length === 0 || right.length === 0) {
        return 0
    }
    const rightSet = new Set(right)
    return Array.from(new Set(left)).filter((token) => rightSet.has(token)).length
}

function filterMeaningfulConflictTokens(tokens: string[]): string[] {
    return tokens.filter((token) => !CONFLICT_STOPWORDS.has(token) && !CONFLICT_MARKER_STOPWORDS.has(token))
}

function itemsShareConflictDomain(left: ConflictItemAnalysis, right: ConflictItemAnalysis): boolean {
    const commonPrefix = countCommonPrefix(left.tokens, right.tokens)
    if (commonPrefix >= 3) {
        return true
    }

    const sharedMeaningfulTokens = countSharedMeaningfulTokens(left.meaningfulTokens, right.meaningfulTokens)
    if (sharedMeaningfulTokens < 2) {
        return false
    }

    const minimumTokenCount = Math.min(left.meaningfulTokens.length, right.meaningfulTokens.length)
    if (minimumTokenCount <= 0) {
        return false
    }

    return sharedMeaningfulTokens >= (minimumTokenCount - 1)
}

function getRemainingMeaningfulTokensAfterPrefix(
    analysis: ConflictItemAnalysis,
    commonPrefixCount: number,
): string[] {
    return filterMeaningfulConflictTokens(analysis.tokens.slice(commonPrefixCount))
}

function getRemainingMeaningfulTokensAfterPrefixAndSuffix(
    analysis: ConflictItemAnalysis,
    commonPrefixCount: number,
    commonSuffixCount: number,
): string[] {
    const endIndex = commonSuffixCount > 0
        ? analysis.tokens.length - commonSuffixCount
        : analysis.tokens.length
    return filterMeaningfulConflictTokens(analysis.tokens.slice(commonPrefixCount, endIndex))
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

function oneSpanLooksLikeRefinement(left: string[], right: string[]): boolean {
    if (left.length === 0 || right.length === 0) {
        return false
    }
    const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left]
    return isTokenPrefix(shorter, longer) || isTokenSuffix(shorter, longer)
}

function findTokenSequenceIndex(tokens: string[], sequence: string[]): number {
    if (sequence.length === 0 || tokens.length < sequence.length) {
        return -1
    }
    for (let index = 0; index <= tokens.length - sequence.length; index += 1) {
        const matches = sequence.every((token, sequenceIndex) => tokens[index + sequenceIndex] === token)
        if (matches) {
            return index
        }
    }
    return -1
}

interface ComparisonConflictPattern {
    marker: "over" | "instead_of"
    before: string[]
    after: string[]
}

function getComparisonConflictPattern(tokens: string[]): ComparisonConflictPattern | null {
    const overIndex = tokens.indexOf("over")
    if (overIndex > 0 && overIndex < tokens.length - 1) {
        return {
            marker: "over",
            before: tokens.slice(0, overIndex),
            after: tokens.slice(overIndex + 1),
        }
    }

    const insteadOfIndex = findTokenSequenceIndex(tokens, ["instead", "of"])
    if (insteadOfIndex > 0 && insteadOfIndex < tokens.length - 2) {
        return {
            marker: "instead_of",
            before: tokens.slice(0, insteadOfIndex),
            after: tokens.slice(insteadOfIndex + 2),
        }
    }

    return null
}

function startsWithTokenSequence(tokens: string[], sequence: string[]): boolean {
    if (tokens.length < sequence.length || sequence.length === 0) {
        return false
    }
    return sequence.every((token, index) => tokens[index] === token)
}

function isShortLocationFactFrame(tokens: string[]): boolean {
    return startsWithTokenSequence(tokens, ["live", "in"])
        || startsWithTokenSequence(tokens, ["lives", "in"])
        || startsWithTokenSequence(tokens, ["based", "in"])
        || startsWithTokenSequence(tokens, ["located", "in"])
}

function shouldArchiveConflict(
    sectionKey: CharacterEvolutionItemSectionKey,
    left: ConflictItemAnalysis,
    right: ConflictItemAnalysis,
): boolean {
    return ARCHIVE_ON_RESOLUTION_SECTIONS.has(sectionKey)
        && itemsShareConflictDomain(left, right)
        && (left.hasResolutionSignal || right.hasResolutionSignal)
}

function shouldCorrectByFactSlotReplacement(
    sectionKey: CharacterEvolutionItemSectionKey,
    left: ConflictItemAnalysis,
    right: ConflictItemAnalysis,
): boolean {
    if (!SLOT_REPLACEMENT_SECTIONS.has(sectionKey)) {
        return false
    }

    const commonPrefixCount = countCommonPrefix(left.tokens, right.tokens)
    const commonSuffixCount = countCommonSuffix(left.tokens, right.tokens, commonPrefixCount)
    if (commonPrefixCount + commonSuffixCount >= Math.min(left.tokens.length, right.tokens.length)) {
        return false
    }

    const leftRemaining = getRemainingMeaningfulTokensAfterPrefix(left, commonPrefixCount)
    const rightRemaining = getRemainingMeaningfulTokensAfterPrefix(right, commonPrefixCount)
    const leftRemainingWithSuffix = getRemainingMeaningfulTokensAfterPrefixAndSuffix(left, commonPrefixCount, commonSuffixCount)
    const rightRemainingWithSuffix = getRemainingMeaningfulTokensAfterPrefixAndSuffix(right, commonPrefixCount, commonSuffixCount)

    const isPrefixOnlyReplacement = commonPrefixCount >= 3
        && leftRemaining.length > 0
        && rightRemaining.length > 0
        && leftRemaining.join(" ") !== rightRemaining.join(" ")
        && !oneSpanLooksLikeRefinement(leftRemaining, rightRemaining)

    const isPrefixSuffixReplacement = commonPrefixCount >= 2
        && commonSuffixCount >= 1
        && leftRemainingWithSuffix.length > 0
        && rightRemainingWithSuffix.length > 0
        && leftRemainingWithSuffix.join(" ") !== rightRemainingWithSuffix.join(" ")
        && !oneSpanLooksLikeRefinement(leftRemainingWithSuffix, rightRemainingWithSuffix)

    const isShortFactFrameReplacement = sectionKey === "userFacts"
        && commonPrefixCount >= 2
        && commonSuffixCount === 0
        && Math.max(left.tokens.length, right.tokens.length) <= 5
        && isShortLocationFactFrame(left.tokens)
        && isShortLocationFactFrame(right.tokens)
        && leftRemaining.length > 0
        && rightRemaining.length > 0
        && leftRemaining.join(" ") !== rightRemaining.join(" ")
        && !oneSpanLooksLikeRefinement(leftRemaining, rightRemaining)

    return isPrefixOnlyReplacement || isPrefixSuffixReplacement || isShortFactFrameReplacement
}

function shouldCorrectByPreferenceComparisonReversal(
    sectionKey: CharacterEvolutionItemSectionKey,
    left: ConflictItemAnalysis,
    right: ConflictItemAnalysis,
): boolean {
    if (!COMPARISON_CONFLICT_SECTIONS.has(sectionKey)) {
        return false
    }

    const leftPattern = getComparisonConflictPattern(left.tokens)
    const rightPattern = getComparisonConflictPattern(right.tokens)
    if (!leftPattern || !rightPattern || leftPattern.marker !== rightPattern.marker) {
        return false
    }

    const sharedSubjectPrefixCount = countCommonPrefix(leftPattern.before, rightPattern.before)
    if (sharedSubjectPrefixCount < 2) {
        return false
    }

    const leftPreferred = filterMeaningfulConflictTokens(leftPattern.before.slice(sharedSubjectPrefixCount))
    const rightPreferred = filterMeaningfulConflictTokens(rightPattern.before.slice(sharedSubjectPrefixCount))
    const leftOther = filterMeaningfulConflictTokens(leftPattern.after)
    const rightOther = filterMeaningfulConflictTokens(rightPattern.after)
    if (leftPreferred.length === 0 || rightPreferred.length === 0 || leftOther.length === 0 || rightOther.length === 0) {
        return false
    }

    return leftPreferred.join(" ") === rightOther.join(" ")
        && leftOther.join(" ") === rightPreferred.join(" ")
        && leftPreferred.join(" ") !== rightPreferred.join(" ")
}

function shouldCorrectByOppositePreferencePolarity(
    sectionKey: CharacterEvolutionItemSectionKey,
    left: ConflictItemAnalysis,
    right: ConflictItemAnalysis,
): boolean {
    if (!COMPARISON_CONFLICT_SECTIONS.has(sectionKey)) {
        return false
    }
    if (!left.preferencePolarity || !right.preferencePolarity || left.preferencePolarity === right.preferencePolarity) {
        return false
    }
    return itemsShareConflictDomain(left, right)
}

function shouldCorrectConflict(
    sectionKey: CharacterEvolutionItemSectionKey,
    left: ConflictItemAnalysis,
    right: ConflictItemAnalysis,
): boolean {
    if (shouldCorrectByFactSlotReplacement(sectionKey, left, right)) {
        return true
    }
    if (shouldCorrectByPreferenceComparisonReversal(sectionKey, left, right)) {
        return true
    }
    if (shouldCorrectByOppositePreferencePolarity(sectionKey, left, right)) {
        return true
    }
    if (!itemsShareConflictDomain(left, right)) {
        return false
    }
    if (left.hasResolutionSignal || right.hasResolutionSignal) {
        return false
    }
    if (left.hasNegationSignal !== right.hasNegationSignal) {
        return true
    }
    return false
}

function getConflictTransition(
    sectionKey: CharacterEvolutionItemSectionKey,
    leftItem: CharacterEvolutionItem,
    rightItem: CharacterEvolutionItem,
): "archived" | "corrected" | null {
    if (doCharacterEvolutionItemsMatch(leftItem, rightItem)) {
        return null
    }

    const left = analyzeConflictItem(leftItem)
    const right = analyzeConflictItem(rightItem)

    if (shouldArchiveConflict(sectionKey, left, right)) {
        return "archived"
    }
    if (shouldCorrectConflict(sectionKey, left, right)) {
        return "corrected"
    }
    return null
}

function getItemStatus(item: CharacterEvolutionItem | null | undefined): NonNullable<CharacterEvolutionItem["status"]> {
    return item?.status ?? "active"
}

function getConfidenceRank(item: CharacterEvolutionItem): number {
    const confidence = item.confidence
    return confidence ? CONFLICT_CONFIDENCE_RANK[confidence] : -1
}

function pickWinningProposalIndex(
    items: CharacterEvolutionItem[],
    leftIndex: number,
    rightIndex: number,
): number {
    const leftRank = getConfidenceRank(items[leftIndex])
    const rightRank = getConfidenceRank(items[rightIndex])
    if (leftRank !== rightRank) {
        return leftRank > rightRank ? leftIndex : rightIndex
    }
    return rightIndex
}

function pickBestProposalConflictIndex(
    items: CharacterEvolutionItem[],
    candidateIndexes: number[],
): number {
    return candidateIndexes.reduce((bestIndex, candidateIndex) => {
        if (bestIndex < 0) {
            return candidateIndex
        }
        return pickWinningProposalIndex(items, bestIndex, candidateIndex)
    }, -1)
}

function pickWinningReinforcementProposalIndex(
    items: CharacterEvolutionItem[],
    leftIndex: number,
    rightIndex: number,
): number {
    const preferredIndex = pickWinningProposalIndex(items, leftIndex, rightIndex)
    const otherIndex = preferredIndex === leftIndex ? rightIndex : leftIndex
    const preferredTokenCount = analyzeConflictItem(items[preferredIndex]).tokens.length
    const otherTokenCount = analyzeConflictItem(items[otherIndex]).tokens.length
    if (preferredTokenCount !== otherTokenCount) {
        return preferredTokenCount > otherTokenCount ? preferredIndex : otherIndex
    }
    return preferredIndex
}

function pickBestProposalReinforcementIndex(
    items: CharacterEvolutionItem[],
    candidateIndexes: number[],
): number {
    return candidateIndexes.reduce((bestIndex, candidateIndex) => {
        if (bestIndex < 0) {
            return candidateIndex
        }
        return pickWinningReinforcementProposalIndex(items, bestIndex, candidateIndex)
    }, -1)
}

function resolveConflictsWithinProposal(
    sectionKey: CharacterEvolutionItemSectionKey,
    itemsRaw: CharacterEvolutionItem[],
): CharacterEvolutionItem[] {
    const items = structuredClone(itemsRaw)

    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
        if (getItemStatus(items[leftIndex]) !== "active") {
            continue
        }
        for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
            if (getItemStatus(items[rightIndex]) !== "active") {
                continue
            }

            if (doCharacterEvolutionItemsReinforceSameIdea(sectionKey, items[leftIndex], items[rightIndex])) {
                const winningIndex = pickWinningReinforcementProposalIndex(items, leftIndex, rightIndex)
                const losingIndex = winningIndex === leftIndex ? rightIndex : leftIndex
                items[winningIndex] = mergeReinforcedCharacterEvolutionItems(
                    items[losingIndex],
                    items[winningIndex],
                )
                items.splice(losingIndex, 1)
                if (losingIndex === leftIndex) {
                    leftIndex -= 1
                    break
                }
                rightIndex -= 1
                continue
            }

            const transition = getConflictTransition(sectionKey, items[leftIndex], items[rightIndex])
            if (!transition) {
                continue
            }

            if (transition === "archived") {
                items[leftIndex] = { ...items[leftIndex], status: "archived" }
                items[rightIndex] = { ...items[rightIndex], status: "archived" }
                continue
            }

            const winningIndex = pickWinningProposalIndex(items, leftIndex, rightIndex)
            const losingIndex = winningIndex === leftIndex ? rightIndex : leftIndex
            items[losingIndex] = { ...items[losingIndex], status: "corrected" }
        }
    }

    return items
}

function resolveCurrentAgainstProposal(
    sectionKey: CharacterEvolutionItemSectionKey,
    currentItemsRaw: CharacterEvolutionItem[],
    proposedItemsRaw: CharacterEvolutionItem[],
): CharacterEvolutionItem[] {
    const proposedItems = structuredClone(proposedItemsRaw)
    const currentActiveItems = currentItemsRaw.filter((item) => getItemStatus(item) === "active")
    const carryForwardItems: CharacterEvolutionItem[] = []

    for (const currentItem of currentActiveItems) {
        const matchingIndex = proposedItems.findIndex((item) => doCharacterEvolutionItemsMatch(item, currentItem))
        const reinforcementIndexes = proposedItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => getItemStatus(item) === "active" && !doCharacterEvolutionItemsMatch(item, currentItem))
            .filter(({ item }) => doCharacterEvolutionItemsReinforceSameIdea(sectionKey, currentItem, item))
            .map(({ index }) => index)
        const conflictingIndexes = proposedItems
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => getItemStatus(item) === "active" && !doCharacterEvolutionItemsMatch(item, currentItem))
            .filter(({ item }) => getConflictTransition(sectionKey, currentItem, item) !== null)
            .map(({ index }) => index)

        if (matchingIndex >= 0) {
            continue
        }

        if (reinforcementIndexes.length > 0) {
            const reinforcementIndex = pickBestProposalReinforcementIndex(proposedItems, reinforcementIndexes)
            proposedItems[reinforcementIndex] = mergeReinforcedCharacterEvolutionItems(
                currentItem,
                proposedItems[reinforcementIndex],
            )
            continue
        }

        if (conflictingIndexes.length === 0) {
            carryForwardItems.push(structuredClone(currentItem))
            continue
        }

        const conflictIndex = pickBestProposalConflictIndex(proposedItems, conflictingIndexes)
        const transition = conflictIndex >= 0
            ? getConflictTransition(sectionKey, currentItem, proposedItems[conflictIndex])
            : null
        if (!transition) {
            continue
        }

        if (!proposedItems.some((item) => getItemStatus(item) === transition && doCharacterEvolutionItemsMatch(item, currentItem))) {
            proposedItems.splice(conflictIndex, 0, {
                ...currentItem,
                status: transition,
            })
        }

        if (transition === "archived" && conflictIndex >= 0 && getItemStatus(proposedItems[conflictIndex]) === "active") {
            proposedItems[conflictIndex] = {
                ...proposedItems[conflictIndex],
                status: "archived",
            }
        }
    }

    return [...carryForwardItems, ...proposedItems]
}

export function resolveCharacterEvolutionSectionConflicts(args: {
    sectionKey: CharacterEvolutionItemSectionKey
    currentItems: CharacterEvolutionItem[]
    proposedItems: CharacterEvolutionItem[]
}): CharacterEvolutionItem[] {
    const resolvedProposal = resolveConflictsWithinProposal(
        args.sectionKey,
        Array.isArray(args.proposedItems) ? args.proposedItems : [],
    )
    return resolveCurrentAgainstProposal(
        args.sectionKey,
        Array.isArray(args.currentItems) ? args.currentItems : [],
        resolvedProposal,
    )
}

export function resolveCharacterEvolutionStateConflicts(args: {
    currentState: CharacterEvolutionState
    proposedState: CharacterEvolutionState
}): CharacterEvolutionState {
    const nextState = structuredClone(args.proposedState)

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = resolveCharacterEvolutionSectionConflicts({
            sectionKey: key,
            currentItems: Array.isArray(args.currentState[key]) ? args.currentState[key] as CharacterEvolutionItem[] : [],
            proposedItems: Array.isArray(nextState[key]) ? nextState[key] as CharacterEvolutionItem[] : [],
        }) as never
    }

    return nextState
}
