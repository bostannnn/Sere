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

function findMatchingItemIndex(items, candidate, statusOrder) {
    const candidateExactKey = getCharacterEvolutionItemExactMatchKey(candidate);
    const candidateNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(candidate);
    const matchingStrategies = [
        (item) => candidateExactKey.length > 0 && getCharacterEvolutionItemExactMatchKey(item) === candidateExactKey,
        (item) => candidateNormalizedKey.length > 0 && getCharacterEvolutionItemNormalizedMatchKey(item) === candidateNormalizedKey,
    ];

    for (const doesMatch of matchingStrategies) {
        for (const preferredStatus of statusOrder) {
            const matchingIndex = (Array.isArray(items) ? items : []).findIndex(
                (item) => normalizeCharacterEvolutionItemStatus(item) === preferredStatus && doesMatch(item)
            );
            if (matchingIndex >= 0) {
                return matchingIndex;
            }
        }
    }

    return -1;
}

function findMatchingBaseItem(items, candidate) {
    const matchingIndex = findMatchingItemIndex(
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
    const nextProposedConfidence = proposedItem.confidence ?? currentItem.confidence;
    const nextProposedNote = proposedItem.note ?? currentItem.note;
    const hasMeaningfulUpdate = currentItem.confidence !== nextProposedConfidence
        || normalizeCharacterEvolutionItemNote(currentItem) !== normalizeCharacterEvolutionItemNote({ note: nextProposedNote })
        || currentStatus !== nextStatus;
    const shouldReinforce = !shouldPreserveHistoricalMetadata
        && (currentStatus === 'archived' || hasMeaningfulUpdate);
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
        ...(nextTimesSeen !== undefined ? { timesSeen: nextTimesSeen } : {}),
    };
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

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const baseItems = Array.isArray(arg.baseState?.[key]) ? arg.baseState[key] : [];
        nextState[key] = (Array.isArray(nextState[key]) ? nextState[key] : []).map((item) => ({
            ...item,
            status: item?.status || 'active',
            ...(() => {
                const baseMatch = findMatchingBaseItem(baseItems, item);
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
                        ...(baseMatch.timesSeen !== undefined && item?.timesSeen === undefined ? { timesSeen: baseMatch.timesSeen } : {}),
                    };
                }
                return {
                    ...(sourceChatId && !item?.sourceChatId ? { sourceChatId } : {}),
                    ...(sourceRange && !item?.sourceRange ? { sourceRange: clone(sourceRange) } : {}),
                    ...(timestamp !== undefined && (arg.overwriteNewItemTimestamps || item?.updatedAt === undefined) ? { updatedAt: timestamp } : {}),
                    ...(timestamp !== undefined && (arg.overwriteNewItemTimestamps || item?.lastSeenAt === undefined) ? { lastSeenAt: timestamp } : {}),
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
    const nextState = clone(proposedState);

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
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

        for (const currentItem of currentItems) {
            const currentStatus = normalizeCharacterEvolutionItemStatus(currentItem);
            const currentExactKey = getCharacterEvolutionItemExactMatchKey(currentItem);
            const currentNormalizedKey = getCharacterEvolutionItemNormalizedMatchKey(currentItem);
            const hasMatchingActiveTwin = currentStatus !== 'active' && (
                (currentExactKey.length > 0 && activeCurrentExactMatchKeys.has(currentExactKey))
                || (currentNormalizedKey.length > 0 && activeCurrentNormalizedMatchKeys.has(currentNormalizedKey))
            );
            const explicitHistoricalMatchIndex = currentStatus !== 'active'
                ? findMatchingItemIndex(proposedItems, currentItem, [currentStatus])
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

            const matchingProposedItemIndex = currentStatus === 'active' || currentStatus === 'archived'
                ? findMatchingItemIndex(proposedItems, currentItem, ['active', 'archived', 'corrected'])
                : -1;

            if (matchingProposedItemIndex >= 0) {
                mergedItems.push(createMergedMatchedItem(currentItem, proposedItems[matchingProposedItemIndex]));
                proposedItems.splice(matchingProposedItemIndex, 1);
                continue;
            }

            if (currentStatus === 'archived' || currentStatus === 'corrected') {
                mergedItems.push(currentItem);
            }
        }

        mergedItems.push(...proposedItems);
        nextState[key] = mergedItems;
    }

    return nextState;
}

module.exports = {
    applyCharacterEvolutionItemMetadata,
    CHARACTER_EVOLUTION_ITEM_SECTION_KEYS,
    CHARACTER_EVOLUTION_OBJECT_SECTION_KEYS,
    createCharacterEvolutionItemSourceRange,
    doCharacterEvolutionItemsMatch,
    filterActiveCharacterEvolutionItems,
    filterActiveCharacterEvolutionState,
    getCharacterEvolutionItemExactMatchKey,
    getCharacterEvolutionItemNormalizedMatchKey,
    isCharacterEvolutionItemSection,
    isCharacterEvolutionObjectSection,
    mergeAcceptedCharacterEvolutionState,
    normalizeCharacterEvolutionItemSourceRange,
};
