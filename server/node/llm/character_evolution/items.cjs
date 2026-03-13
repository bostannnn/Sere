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

function normalizeItemValueKey(item) {
    return String(item?.value || '').trim().toLowerCase();
}

function itemValueKeysForSection(items) {
    return new Set(
        (Array.isArray(items) ? items : [])
            .map((item) => normalizeItemValueKey(item))
            .filter((value) => value.length > 0)
    );
}

function findMatchingBaseItem(items, candidate) {
    const candidateValueKey = normalizeItemValueKey(candidate);
    const sameValueItems = (Array.isArray(items) ? items : []).filter((item) => normalizeItemValueKey(item) === candidateValueKey);
    if (sameValueItems.length === 0) {
        return undefined;
    }
    const candidateStatus = candidate?.status || 'active';
    return sameValueItems.find((item) => (item?.status || 'active') === candidateStatus)
        || sameValueItems.find((item) => (item?.status || 'active') === 'active')
        || sameValueItems[0];
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
                        ...(baseMatch.sourceChatId && !item?.sourceChatId ? { sourceChatId: baseMatch.sourceChatId } : {}),
                        ...(baseMatch.sourceRange && !item?.sourceRange ? { sourceRange: clone(baseMatch.sourceRange) } : {}),
                        ...(baseMatch.updatedAt !== undefined && item?.updatedAt === undefined ? { updatedAt: baseMatch.updatedAt } : {}),
                        ...(baseMatch.lastSeenAt !== undefined && item?.lastSeenAt === undefined ? { lastSeenAt: baseMatch.lastSeenAt } : {}),
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
        const activeCurrentValueKeys = itemValueKeysForSection(
            currentItems.filter((item) => (item?.status || 'active') === 'active')
        );
        const mergedItems = [];

        for (const currentItem of currentItems) {
            const currentValueKey = normalizeItemValueKey(currentItem);
            const currentStatus = currentItem?.status || 'active';
            const matchingProposedItemIndex = proposedItems.findIndex((item) => normalizeItemValueKey(item) === currentValueKey);

            if (currentStatus !== 'active' && currentValueKey.length > 0 && activeCurrentValueKeys.has(currentValueKey)) {
                mergedItems.push(currentItem);
                continue;
            }

            if (matchingProposedItemIndex >= 0) {
                mergedItems.push(proposedItems[matchingProposedItemIndex]);
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
    filterActiveCharacterEvolutionItems,
    filterActiveCharacterEvolutionState,
    isCharacterEvolutionItemSection,
    isCharacterEvolutionObjectSection,
    mergeAcceptedCharacterEvolutionState,
    normalizeCharacterEvolutionItemSourceRange,
};
