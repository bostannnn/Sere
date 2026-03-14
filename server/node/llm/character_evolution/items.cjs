const { clone } = require('./utils.cjs');

const CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS = [
    'relationship',
    'lastInteractionEnded',
];

const CHARACTER_EVOLUTION_ITEM_SECTION_KEYS = [
    'activeThreads',
    'runningJokes',
    'characterLikes',
    'characterDislikes',
    'characterHabits',
    'characterBoundariesPreferences',
    'userFacts',
    'userRead',
    'userLikes',
    'userDislikes',
    'keyMoments',
    'characterIntimatePreferences',
    'userIntimatePreferences',
];

const CHARACTER_EVOLUTION_CONFIDENCE_RANK = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
};

const REINFORCEMENT_MATCH_SECTIONS = new Set([
    'userFacts',
    'activeThreads',
]);

const CHARACTER_EVOLUTION_MATCH_STOPWORDS = new Set([
    'a',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'been',
    'being',
    'but',
    'by',
    'for',
    'from',
    'had',
    'has',
    'have',
    'he',
    'her',
    'hers',
    'him',
    'his',
    'i',
    'in',
    'into',
    'is',
    'it',
    'its',
    'me',
    'my',
    'of',
    'on',
    'or',
    'our',
    'ours',
    'she',
    'that',
    'the',
    'their',
    'theirs',
    'them',
    'they',
    'this',
    'to',
    'up',
    'us',
    'we',
    'with',
    'you',
    'your',
    'yours',
]);

function isCharacterEvolutionObjectSection(key) {
    return CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS.includes(key);
}

function isCharacterEvolutionItemSection(key) {
    return CHARACTER_EVOLUTION_ITEM_SECTION_KEYS.includes(key);
}

function normalizeCharacterEvolutionItemSourceRange(raw) {
    if (!raw || typeof raw !== 'object') {
        return undefined;
    }
    const startMessageIndex = Number(raw.startMessageIndex);
    const endMessageIndex = Number(raw.endMessageIndex);
    if (!Number.isFinite(startMessageIndex) || !Number.isFinite(endMessageIndex)) {
        return undefined;
    }
    const normalizedStart = Math.max(0, Math.floor(startMessageIndex));
    const normalizedEnd = Math.floor(endMessageIndex);
    if (normalizedEnd < normalizedStart) {
        return undefined;
    }
    return {
        startMessageIndex: normalizedStart,
        endMessageIndex: normalizedEnd,
    };
}

function createCharacterEvolutionItemSourceRange(range) {
    return normalizeCharacterEvolutionItemSourceRange(range);
}

function filterActiveCharacterEvolutionItems(items) {
    return (Array.isArray(items) ? items : [])
        .filter((item) => (item?.status || 'active') === 'active')
        .map((item) => clone(item));
}

function filterActiveCharacterEvolutionState(state) {
    const nextState = clone(state);
    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = filterActiveCharacterEvolutionItems(nextState[key]);
    }
    return nextState;
}

function normalizeCharacterEvolutionItemMatchValue(valueRaw) {
    return String(valueRaw || '')
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ');
}

function getCharacterEvolutionItemExactMatchKey(item) {
    return normalizeCharacterEvolutionItemMatchValue(typeof item === 'string' ? item : item?.value);
}

function getCharacterEvolutionItemNormalizedMatchKey(item) {
    return normalizeCharacterEvolutionItemMatchValue(typeof item === 'string' ? item : item?.value)
        .replace(/[\p{P}]+/gu, ' ')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function doCharacterEvolutionItemsMatch(left, right) {
    const leftExactKey = getCharacterEvolutionItemExactMatchKey(left);
    const rightExactKey = getCharacterEvolutionItemExactMatchKey(right);
    if (leftExactKey && leftExactKey === rightExactKey) {
        return true;
    }

    const leftNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(left);
    const rightNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(right);
    return leftNormalizedKey.length > 0 && leftNormalizedKey === rightNormalizedKey;
}

function tokenizeCharacterEvolutionItem(item) {
    return getCharacterEvolutionItemNormalizedMatchKey(item)
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean);
}

function getMeaningfulCharacterEvolutionItemTokens(item) {
    return tokenizeCharacterEvolutionItem(item)
        .filter((token) => !CHARACTER_EVOLUTION_MATCH_STOPWORDS.has(token));
}

function countCommonTokenPrefix(left, right) {
    const max = Math.min(left.length, right.length);
    let count = 0;
    for (let index = 0; index < max; index += 1) {
        if (left[index] !== right[index]) {
            break;
        }
        count += 1;
    }
    return count;
}

function countCommonTokenSuffix(left, right, prefixCount) {
    const max = Math.min(left.length, right.length) - prefixCount;
    let count = 0;
    for (let index = 1; index <= max; index += 1) {
        if (left[left.length - index] !== right[right.length - index]) {
            break;
        }
        count += 1;
    }
    return count;
}

function isTokenPrefix(shorter, longer) {
    if (shorter.length === 0 || shorter.length > longer.length) {
        return false;
    }
    return shorter.every((token, index) => token === longer[index]);
}

function isTokenSuffix(shorter, longer) {
    if (shorter.length === 0 || shorter.length > longer.length) {
        return false;
    }
    return shorter.every((token, index) => token === longer[longer.length - shorter.length + index]);
}

function doCharacterEvolutionItemsReinforceSameIdea(sectionKey, left, right) {
    if (!REINFORCEMENT_MATCH_SECTIONS.has(sectionKey) || doCharacterEvolutionItemsMatch(left, right)) {
        return false;
    }

    const leftTokens = tokenizeCharacterEvolutionItem(left);
    const rightTokens = tokenizeCharacterEvolutionItem(right);
    if (leftTokens.length === 0 || rightTokens.length === 0) {
        return false;
    }

    const commonPrefixCount = countCommonTokenPrefix(leftTokens, rightTokens);
    const commonSuffixCount = countCommonTokenSuffix(leftTokens, rightTokens, commonPrefixCount);
    if (commonPrefixCount < 3 && commonSuffixCount < 3) {
        return false;
    }

    const leftMeaningfulTokens = getMeaningfulCharacterEvolutionItemTokens(left);
    const rightMeaningfulTokens = getMeaningfulCharacterEvolutionItemTokens(right);
    if (leftMeaningfulTokens.length === 0 || rightMeaningfulTokens.length === 0) {
        return false;
    }

    const shorterMeaningfulTokens = leftMeaningfulTokens.length <= rightMeaningfulTokens.length
        ? leftMeaningfulTokens
        : rightMeaningfulTokens;
    const longerMeaningfulTokens = leftMeaningfulTokens.length <= rightMeaningfulTokens.length
        ? rightMeaningfulTokens
        : leftMeaningfulTokens;

    return isTokenPrefix(shorterMeaningfulTokens, longerMeaningfulTokens)
        || isTokenSuffix(shorterMeaningfulTokens, longerMeaningfulTokens);
}

function itemValueKeysForSection(items, matcher) {
    return new Set(
        (Array.isArray(items) ? items : [])
            .map((item) => matcher(item))
            .filter((value) => value.length > 0)
    );
}

function normalizeCharacterEvolutionItemStatus(item) {
    return item?.status || 'active';
}

function normalizeCharacterEvolutionItemTimesSeen(item) {
    if (!Number.isFinite(Number(item?.timesSeen)) || Number(item?.timesSeen) <= 0) {
        return undefined;
    }
    return Math.max(1, Math.floor(Number(item?.timesSeen)));
}

function normalizeCharacterEvolutionItemUnseenAcceptedHandoffs(item) {
    if (!Number.isFinite(Number(item?.unseenAcceptedHandoffs)) || Number(item?.unseenAcceptedHandoffs) < 0) {
        return undefined;
    }
    return Math.max(0, Math.floor(Number(item?.unseenAcceptedHandoffs)));
}

function normalizeCharacterEvolutionItemLastSeenVersion(item) {
    if (!Number.isFinite(Number(item?.lastSeenVersion)) || Number(item?.lastSeenVersion) <= 0) {
        return undefined;
    }
    return Math.max(1, Math.floor(Number(item?.lastSeenVersion)));
}

function normalizeCharacterEvolutionItemNote(item) {
    return typeof item?.note === 'string' ? item.note : '';
}

function promotedConfidenceForTimesSeen(timesSeen) {
    if (timesSeen >= 3) {
        return 'confirmed';
    }
    if (timesSeen >= 2) {
        return 'likely';
    }
    return 'suspected';
}

function pickStrongerCharacterEvolutionConfidence(...values) {
    return values
        .filter(Boolean)
        .sort((left, right) => CHARACTER_EVOLUTION_CONFIDENCE_RANK[right] - CHARACTER_EVOLUTION_CONFIDENCE_RANK[left])[0];
}

function buildPreferredStatusOrder(candidateStatus) {
    return [
        candidateStatus,
        'active',
        'archived',
        'corrected',
    ].filter((status, index, statuses) => statuses.indexOf(status) === index);
}

function getMatchingItemIndexes(sectionKey, items, candidate, statusOrder, options = {}) {
    const allowedStatuses = new Set(statusOrder);
    return (Array.isArray(items) ? items : [])
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => allowedStatuses.has(normalizeCharacterEvolutionItemStatus(item)))
        .filter(({ item }) => doCharacterEvolutionItemsMatch(item, candidate)
            || (options.allowReinforcement && doCharacterEvolutionItemsReinforceSameIdea(sectionKey, item, candidate)))
        .map(({ index }) => index);
}

function pickPreferredMatchingItemIndex(items, candidateIndexes, statusOrder) {
    const statusRanks = new Map(statusOrder.map((status, index) => [status, index]));
    return candidateIndexes.reduce((bestIndex, candidateIndex) => {
        if (bestIndex < 0) {
            return candidateIndex;
        }

        const bestItem = items[bestIndex];
        const candidateItem = items[candidateIndex];
        const bestStatusRank = statusRanks.get(normalizeCharacterEvolutionItemStatus(bestItem)) ?? statusOrder.length;
        const candidateStatusRank = statusRanks.get(normalizeCharacterEvolutionItemStatus(candidateItem)) ?? statusOrder.length;
        if (bestStatusRank !== candidateStatusRank) {
            return candidateStatusRank < bestStatusRank ? candidateIndex : bestIndex;
        }

        const bestConfidenceRank = bestItem?.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[bestItem.confidence] : -1;
        const candidateConfidenceRank = candidateItem?.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[candidateItem.confidence] : -1;
        if (bestConfidenceRank !== candidateConfidenceRank) {
            return candidateConfidenceRank > bestConfidenceRank ? candidateIndex : bestIndex;
        }

        const bestTokenCount = tokenizeCharacterEvolutionItem(bestItem).length;
        const candidateTokenCount = tokenizeCharacterEvolutionItem(candidateItem).length;
        if (bestTokenCount !== candidateTokenCount) {
            return candidateTokenCount > bestTokenCount ? candidateIndex : bestIndex;
        }

        return candidateIndex;
    }, -1);
}

function findMatchingItemIndex(sectionKey, items, candidate, statusOrder, options = {}) {
    const matchingIndexes = getMatchingItemIndexes(sectionKey, items, candidate, statusOrder, options);
    return pickPreferredMatchingItemIndex(items, matchingIndexes, statusOrder);
}

function findMatchingBaseItem(sectionKey, items, candidate) {
    const matchingIndex = findMatchingItemIndex(
        sectionKey,
        items,
        candidate,
        buildPreferredStatusOrder(normalizeCharacterEvolutionItemStatus(candidate))
    );
    return matchingIndex >= 0 ? items[matchingIndex] : undefined;
}

function createMergedMatchedItem(currentItem, proposedItem) {
    const currentStatus = normalizeCharacterEvolutionItemStatus(currentItem);
    const nextStatus = normalizeCharacterEvolutionItemStatus(proposedItem);
    const shouldPreserveHistoricalMetadata = nextStatus !== 'active';
    const currentTimesSeen = normalizeCharacterEvolutionItemTimesSeen(currentItem);
    const proposedTimesSeen = normalizeCharacterEvolutionItemTimesSeen(proposedItem);
    const currentLastSeenVersion = normalizeCharacterEvolutionItemLastSeenVersion(currentItem);
    const proposedLastSeenVersion = normalizeCharacterEvolutionItemLastSeenVersion(proposedItem);
    const nextUnseenAcceptedHandoffs = normalizeCharacterEvolutionItemUnseenAcceptedHandoffs(proposedItem)
        ?? normalizeCharacterEvolutionItemUnseenAcceptedHandoffs(currentItem);
    const nextProposedConfidence = proposedItem.confidence ?? currentItem.confidence;
    const nextProposedNote = proposedItem.note ?? currentItem.note;
    const hasMeaningfulUpdate = currentItem.confidence !== nextProposedConfidence
        || normalizeCharacterEvolutionItemNote(currentItem) !== (typeof nextProposedNote === 'string' ? nextProposedNote : '')
        || currentStatus !== nextStatus;
    const shouldReinforce = !shouldPreserveHistoricalMetadata
        && (currentStatus === 'archived' || hasMeaningfulUpdate);
    const shouldMarkSeenForDecay = currentStatus === 'active' && nextStatus === 'active';
    const currentSeenBaseline = shouldReinforce ? (currentTimesSeen ?? 1) : currentTimesSeen;
    const nextTimesSeen = shouldReinforce
        ? Math.max((currentSeenBaseline ?? proposedTimesSeen ?? 0) + 1, proposedTimesSeen ?? 0, 1)
        : currentTimesSeen;
    const nextConfidence = pickStrongerCharacterEvolutionConfidence(
        currentItem.confidence,
        proposedItem.confidence,
        ...(shouldReinforce && nextTimesSeen !== undefined ? [promotedConfidenceForTimesSeen(nextTimesSeen)] : [])
    );
    const nextNote = nextProposedNote;
    const nextUpdatedAt = shouldReinforce
        ? proposedItem.updatedAt ?? currentItem.updatedAt
        : currentItem.updatedAt;
    const nextLastSeenAt = shouldReinforce
        ? proposedItem.lastSeenAt ?? proposedItem.updatedAt ?? currentItem.lastSeenAt
        : currentItem.lastSeenAt;
    const nextLastSeenVersion = shouldReinforce || shouldMarkSeenForDecay
        ? proposedLastSeenVersion ?? currentLastSeenVersion
        : currentLastSeenVersion;
    const nextSourceChatId = shouldReinforce
        ? proposedItem.sourceChatId ?? currentItem.sourceChatId
        : currentItem.sourceChatId;
    const nextSourceRange = shouldReinforce
        ? proposedItem.sourceRange ?? currentItem.sourceRange
        : currentItem.sourceRange;

    return {
        value: proposedItem.value,
        status: nextStatus,
        ...(nextConfidence ? { confidence: nextConfidence } : {}),
        ...(nextNote !== undefined ? { note: nextNote } : {}),
        ...(nextSourceChatId
            ? { sourceChatId: nextSourceChatId }
            : {}),
        ...(nextSourceRange
            ? { sourceRange: clone(nextSourceRange) }
                : {}),
        ...(nextUpdatedAt !== undefined ? { updatedAt: nextUpdatedAt } : {}),
        ...(nextLastSeenAt !== undefined ? { lastSeenAt: nextLastSeenAt } : {}),
        ...(nextLastSeenVersion !== undefined ? { lastSeenVersion: nextLastSeenVersion } : {}),
        ...(nextTimesSeen !== undefined ? { timesSeen: nextTimesSeen } : {}),
        ...(nextUnseenAcceptedHandoffs !== undefined ? { unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs } : {}),
    };
}

function mergeReinforcedCharacterEvolutionItems(currentItem, proposedItem) {
    return createMergedMatchedItem(currentItem, proposedItem);
}

function applyCharacterEvolutionItemMetadata(arg = {}) {
    const nextState = clone(arg.state);
    const sourceChatId = typeof arg.sourceChatId === 'string' && arg.sourceChatId.trim()
        ? arg.sourceChatId.trim()
        : typeof arg.sourceRange?.chatId === 'string' && arg.sourceRange.chatId.trim()
            ? arg.sourceRange.chatId.trim()
            : undefined;
    const sourceRange = createCharacterEvolutionItemSourceRange(arg.sourceRange);
    const timestamp = Number.isFinite(Number(arg.timestamp)) ? Number(arg.timestamp) : undefined;
    const acceptedVersion = Number.isFinite(Number(arg.acceptedVersion)) && Number(arg.acceptedVersion) > 0
        ? Math.max(1, Math.floor(Number(arg.acceptedVersion)))
        : undefined;
    const retainOmittedSections = arg.retainOmittedSections !== false;

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        if (!retainOmittedSections && !Object.prototype.hasOwnProperty.call(nextState, key)) {
            continue;
        }
        const baseItems = Array.isArray(arg.baseState?.[key]) ? arg.baseState[key] : [];
        nextState[key] = (Array.isArray(nextState[key]) ? nextState[key] : []).map((item) => ({
            ...item,
            status: item?.status || 'active',
            ...(() => {
                const baseMatch = findMatchingBaseItem(key, baseItems, item);
                if (baseMatch) {
                    return {
                        ...(sourceChatId && arg.overwriteNewItemTimestamps
                            ? { sourceChatId }
                            : baseMatch.sourceChatId && !item?.sourceChatId
                                ? { sourceChatId: baseMatch.sourceChatId }
                                : {}),
                        ...(sourceRange && arg.overwriteNewItemTimestamps
                            ? { sourceRange: clone(sourceRange) }
                            : baseMatch.sourceRange && !item?.sourceRange
                                ? { sourceRange: clone(baseMatch.sourceRange) }
                                : {}),
                        ...(timestamp !== undefined && arg.overwriteNewItemTimestamps
                            ? {
                                updatedAt: timestamp,
                                lastSeenAt: timestamp,
                            }
                            : {
                                ...(baseMatch.updatedAt !== undefined && item?.updatedAt === undefined ? { updatedAt: baseMatch.updatedAt } : {}),
                                ...(baseMatch.lastSeenAt !== undefined && item?.lastSeenAt === undefined ? { lastSeenAt: baseMatch.lastSeenAt } : {}),
                            }),
                        ...(acceptedVersion !== undefined && arg.overwriteNewItemTimestamps
                            ? { lastSeenVersion: acceptedVersion }
                            : baseMatch.lastSeenVersion !== undefined && item?.lastSeenVersion === undefined
                                ? { lastSeenVersion: baseMatch.lastSeenVersion }
                                : {}),
                        ...(baseMatch.timesSeen !== undefined && item?.timesSeen === undefined ? { timesSeen: baseMatch.timesSeen } : {}),
                    };
                }
                return {
                    ...(sourceChatId && !item?.sourceChatId ? { sourceChatId } : {}),
                    ...(sourceRange && !item?.sourceRange ? { sourceRange: clone(sourceRange) } : {}),
                    ...(timestamp !== undefined && (arg.overwriteNewItemTimestamps || item?.updatedAt === undefined) ? { updatedAt: timestamp } : {}),
                    ...(timestamp !== undefined && (arg.overwriteNewItemTimestamps || item?.lastSeenAt === undefined) ? { lastSeenAt: timestamp } : {}),
                    ...(acceptedVersion !== undefined && (arg.overwriteNewItemTimestamps || item?.lastSeenVersion === undefined) ? { lastSeenVersion: acceptedVersion } : {}),
                    ...(!(Number.isFinite(Number(item?.timesSeen)) && Number(item.timesSeen) > 0) ? { timesSeen: 1 } : {}),
                };
            })(),
        }));
    }

    return nextState;
}

function mergeAcceptedCharacterEvolutionState(arg = {}) {
    const currentState = arg.currentState || {};
    const proposedState = arg.proposedState || {};
    const retainOmittedSections = arg.retainOmittedSections !== false;
    const includeUnchangedCurrentItems = arg.includeUnchangedCurrentItems !== false;
    const nextState = retainOmittedSections
        ? clone(currentState, currentState)
        : clone(proposedState);

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(proposedState, key)) {
            continue;
        }
        const currentItems = Array.isArray(currentState[key]) ? clone(currentState[key]) : [];
        const proposedItems = Array.isArray(proposedState[key]) ? clone(proposedState[key]) : [];
        const activeCurrentExactMatchKeys = itemValueKeysForSection(
            currentItems.filter((item) => (item?.status || 'active') === 'active'),
            getCharacterEvolutionItemExactMatchKey
        );
        const activeCurrentNormalizedMatchKeys = itemValueKeysForSection(
            currentItems.filter((item) => (item?.status || 'active') === 'active'),
            getCharacterEvolutionItemNormalizedMatchKey
        );
        const mergedItems = [];

        if (!includeUnchangedCurrentItems) {
            const remainingCurrentItems = [...currentItems];
            for (const proposedItem of proposedItems) {
                const matchingCurrentItemIndex = findMatchingItemIndex(
                    key,
                    remainingCurrentItems,
                    proposedItem,
                    buildPreferredStatusOrder(normalizeCharacterEvolutionItemStatus(proposedItem)),
                    {
                        allowReinforcement: true,
                    }
                );
                if (matchingCurrentItemIndex >= 0) {
                    mergedItems.push(createMergedMatchedItem(
                        remainingCurrentItems[matchingCurrentItemIndex],
                        proposedItem
                    ));
                    remainingCurrentItems.splice(matchingCurrentItemIndex, 1);
                } else {
                    mergedItems.push(proposedItem);
                }
            }
            nextState[key] = mergedItems;
            continue;
        }

        for (const currentItem of currentItems) {
            const currentStatus = normalizeCharacterEvolutionItemStatus(currentItem);
            const currentExactKey = getCharacterEvolutionItemExactMatchKey(currentItem);
            const currentNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(currentItem);
            const hasMatchingActiveTwin = currentStatus !== 'active' && (
                (currentExactKey.length > 0 && activeCurrentExactMatchKeys.has(currentExactKey))
                || (currentNormalizedKey.length > 0 && activeCurrentNormalizedMatchKeys.has(currentNormalizedKey))
            );
            const explicitHistoricalMatchIndex = currentStatus !== 'active'
                ? findMatchingItemIndex(key, proposedItems, currentItem, [currentStatus])
                : -1;

            if (explicitHistoricalMatchIndex >= 0) {
                mergedItems.push(createMergedMatchedItem(currentItem, proposedItems[explicitHistoricalMatchIndex]));
                proposedItems.splice(explicitHistoricalMatchIndex, 1);
                continue;
            }

            if (currentStatus === 'corrected') {
                mergedItems.push(currentItem);
                continue;
            }

            if (hasMatchingActiveTwin) {
                mergedItems.push(currentItem);
                continue;
            }

            const matchingProposedItemIndexes = currentStatus === 'active' || currentStatus === 'archived'
                ? getMatchingItemIndexes(key, proposedItems, currentItem, ['active', 'archived', 'corrected'], {
                    allowReinforcement: true,
                })
                : [];

            if (matchingProposedItemIndexes.length > 0) {
                const matchingProposedItemIndex = pickPreferredMatchingItemIndex(
                    proposedItems,
                    matchingProposedItemIndexes,
                    ['active', 'archived', 'corrected']
                );
                mergedItems.push(createMergedMatchedItem(currentItem, proposedItems[matchingProposedItemIndex]));
                for (const matchedIndex of [...matchingProposedItemIndexes].sort((left, right) => right - left)) {
                    proposedItems.splice(matchedIndex, 1);
                }
                continue;
            }

            if (currentStatus === 'archived') {
                mergedItems.push(currentItem);
            }
        }

        mergedItems.push(...proposedItems);
        nextState[key] = mergedItems;
    }

    for (const key of CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(proposedState, key)) {
            nextState[key] = clone(proposedState[key], proposedState[key]);
        }
    }

    return nextState;
}

module.exports = {
    applyCharacterEvolutionItemMetadata,
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
    CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS,
    createCharacterEvolutionItemSourceRange,
    doCharacterEvolutionItemsMatch,
    doCharacterEvolutionItemsReinforceSameIdea,
    filterActiveCharacterEvolutionItems,
    filterActiveCharacterEvolutionState,
    getCharacterEvolutionItemExactMatchKey,
    getCharacterEvolutionItemNormalizedMatchKey,
    isCharacterEvolutionItemSection,
    isCharacterEvolutionObjectSection,
    mergeAcceptedCharacterEvolutionState,
    mergeReinforcedCharacterEvolutionItems,
    normalizeCharacterEvolutionItemSourceRange,
};
