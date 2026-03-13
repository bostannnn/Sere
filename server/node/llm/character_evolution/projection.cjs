const { filterActiveCharacterEvolutionState, CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');
const { normalizeCharacterEvolutionState } = require('./normalizers.cjs');

const CHARACTER_EVOLUTION_CONFIDENCE_RANK = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
};

const FAST_SECTIONS = new Set([
    'activeThreads',
    'runningJokes',
    'keyMoments',
]);

const MEDIUM_SECTIONS = new Set([
    'userRead',
    'characterHabits',
    'characterBoundariesPreferences',
]);

const PROMPT_ITEM_LIMITS = {
    generation: {
        activeThreads: 2,
        runningJokes: 2,
        characterLikes: 3,
        characterDislikes: 3,
        characterHabits: 2,
        characterBoundariesPreferences: 2,
        userFacts: 4,
        userRead: 3,
        userLikes: 2,
        userDislikes: 2,
        keyMoments: 2,
        characterIntimatePreferences: 3,
        userIntimatePreferences: 3,
    },
    extraction: {
        activeThreads: 3,
        runningJokes: 3,
        characterLikes: 4,
        characterDislikes: 4,
        characterHabits: 3,
        characterBoundariesPreferences: 3,
        userFacts: 6,
        userRead: 4,
        userLikes: 3,
        userDislikes: 3,
        keyMoments: 3,
        characterIntimatePreferences: 4,
        userIntimatePreferences: 4,
    },
};

function toSortableNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function getConfidenceRank(item) {
    return item?.confidence ? (CHARACTER_EVOLUTION_CONFIDENCE_RANK[item.confidence] ?? -1) : -1;
}

function compareFastItems(left, right) {
    const byLastSeenAt = toSortableNumber(right?.lastSeenAt) - toSortableNumber(left?.lastSeenAt);
    if (byLastSeenAt !== 0) return byLastSeenAt;

    const byUpdatedAt = toSortableNumber(right?.updatedAt) - toSortableNumber(left?.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    const byTimesSeen = toSortableNumber(right?.timesSeen) - toSortableNumber(left?.timesSeen);
    if (byTimesSeen !== 0) return byTimesSeen;

    const byConfidence = getConfidenceRank(right) - getConfidenceRank(left);
    if (byConfidence !== 0) return byConfidence;

    return String(left?.value || '').localeCompare(String(right?.value || ''));
}

function compareMediumItems(left, right) {
    const byLastSeenAt = toSortableNumber(right?.lastSeenAt) - toSortableNumber(left?.lastSeenAt);
    if (byLastSeenAt !== 0) return byLastSeenAt;

    const byTimesSeen = toSortableNumber(right?.timesSeen) - toSortableNumber(left?.timesSeen);
    if (byTimesSeen !== 0) return byTimesSeen;

    const byConfidence = getConfidenceRank(right) - getConfidenceRank(left);
    if (byConfidence !== 0) return byConfidence;

    const byUpdatedAt = toSortableNumber(right?.updatedAt) - toSortableNumber(left?.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    return String(left?.value || '').localeCompare(String(right?.value || ''));
}

function compareSlowItems(left, right) {
    const byConfidence = getConfidenceRank(right) - getConfidenceRank(left);
    if (byConfidence !== 0) return byConfidence;

    const byTimesSeen = toSortableNumber(right?.timesSeen) - toSortableNumber(left?.timesSeen);
    if (byTimesSeen !== 0) return byTimesSeen;

    const byLastSeenAt = toSortableNumber(right?.lastSeenAt) - toSortableNumber(left?.lastSeenAt);
    if (byLastSeenAt !== 0) return byLastSeenAt;

    const byUpdatedAt = toSortableNumber(right?.updatedAt) - toSortableNumber(left?.updatedAt);
    if (byUpdatedAt !== 0) return byUpdatedAt;

    return String(left?.value || '').localeCompare(String(right?.value || ''));
}

function sortProjectedItems(sectionKey, items) {
    const comparator = FAST_SECTIONS.has(sectionKey)
        ? compareFastItems
        : MEDIUM_SECTIONS.has(sectionKey)
            ? compareMediumItems
            : compareSlowItems;

    return [...(Array.isArray(items) ? items : [])]
        .sort(comparator)
        .map((item) => ({ ...item }));
}

function projectCharacterEvolutionStateForPrompt(stateRaw, surface = 'generation') {
    const state = filterActiveCharacterEvolutionState(normalizeCharacterEvolutionState(stateRaw));
    const limits = PROMPT_ITEM_LIMITS[surface] || PROMPT_ITEM_LIMITS.generation;
    const nextState = {
        ...state,
        relationship: { ...state.relationship },
        lastInteractionEnded: { ...state.lastInteractionEnded },
    };

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const limit = Number.isFinite(Number(limits[key])) ? Math.max(0, Math.floor(Number(limits[key]))) : 0;
        nextState[key] = sortProjectedItems(key, state[key]).slice(0, limit);
    }

    return nextState;
}

module.exports = {
    projectCharacterEvolutionStateForPrompt,
};
