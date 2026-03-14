const { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');

const CHARACTER_EVOLUTION_CONFIDENCE_RANK = {
    suspected: 0,
    likely: 1,
    confirmed: 2,
};

const CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION = {
    activeThreads: 'fast',
    runningJokes: 'fast',
    keyMoments: 'fast',
    userRead: 'medium',
    characterHabits: 'medium',
    characterBoundariesPreferences: 'medium',
    userFacts: 'slow',
    characterLikes: 'slow',
    characterDislikes: 'slow',
    userLikes: 'slow',
    userDislikes: 'slow',
    characterIntimatePreferences: 'slow',
    userIntimatePreferences: 'slow',
};

const CHARACTER_EVOLUTION_PROJECTION_BUCKETS = [
    'fast',
    'medium',
    'slow',
];

const CHARACTER_EVOLUTION_PROJECTION_RANK_FIELDS = [
    'confidence',
    'timesSeen',
    'lastSeenAt',
    'updatedAt',
];

const DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY = {
    rankings: {
        fast: ['lastSeenAt', 'updatedAt', 'timesSeen', 'confidence'],
        medium: ['lastSeenAt', 'timesSeen', 'confidence', 'updatedAt'],
        slow: ['confidence', 'timesSeen', 'lastSeenAt', 'updatedAt'],
    },
    limits: {
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
    },
};

function toSortableNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function compareProjectionField(field, left, right) {
    if (field === 'confidence') {
        return (right?.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[right.confidence] : -1)
            - (left?.confidence ? CHARACTER_EVOLUTION_CONFIDENCE_RANK[left.confidence] : -1);
    }

    return toSortableNumber(right?.[field]) - toSortableNumber(left?.[field]);
}

function normalizeRankingOrder(raw, fallback) {
    const ranked = Array.isArray(raw)
        ? raw.filter((value) => typeof value === 'string' && CHARACTER_EVOLUTION_PROJECTION_RANK_FIELDS.includes(value))
        : [];
    const seen = new Set();
    const ordered = [];
    for (const field of ranked) {
        if (seen.has(field)) continue;
        seen.add(field);
        ordered.push(field);
    }
    for (const field of fallback) {
        if (seen.has(field)) continue;
        seen.add(field);
        ordered.push(field);
    }
    return ordered;
}

function normalizeLimitValue(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return fallback;
    }
    return Math.max(0, Math.floor(numericValue));
}

function normalizeSectionLimits(raw, fallback) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    const limits = {};
    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        limits[key] = normalizeLimitValue(source[key], fallback[key]);
    }
    return limits;
}

function normalizeCharacterEvolutionPromptProjectionPolicy(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    return {
        rankings: {
            fast: normalizeRankingOrder(
                value.rankings?.fast,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.fast
            ),
            medium: normalizeRankingOrder(
                value.rankings?.medium,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.medium
            ),
            slow: normalizeRankingOrder(
                value.rankings?.slow,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.slow
            ),
        },
        limits: {
            generation: normalizeSectionLimits(
                value.limits?.generation,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.limits.generation
            ),
            extraction: normalizeSectionLimits(
                value.limits?.extraction,
                DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.limits.extraction
            ),
        },
    };
}

function getCharacterEvolutionProjectionBucket(sectionKey) {
    return CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION[sectionKey];
}

function compareCharacterEvolutionItemsForProjection(arg = {}) {
    const ranking = arg.policy?.rankings?.[getCharacterEvolutionProjectionBucket(arg.sectionKey)]
        || DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY.rankings.slow;
    for (const field of ranking) {
        const comparison = compareProjectionField(field, arg.left, arg.right);
        if (comparison !== 0) {
            return comparison;
        }
    }
    return String(arg.left?.value || '').localeCompare(String(arg.right?.value || ''));
}

function getCharacterEvolutionPromptProjectionPolicy(settings) {
    return normalizeCharacterEvolutionPromptProjectionPolicy(settings?.characterEvolutionDefaults?.promptProjection);
}

function createCharacterEvolutionPromptProjectionPolicy() {
    return JSON.parse(JSON.stringify(DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY));
}

module.exports = {
    CHARACTER_EVOLUTION_PROJECTION_BUCKETS,
    CHARACTER_EVOLUTION_PROJECTION_BUCKET_BY_SECTION,
    CHARACTER_EVOLUTION_PROJECTION_RANK_FIELDS,
    DEFAULT_CHARACTER_EVOLUTION_PROMPT_PROJECTION_POLICY,
    compareCharacterEvolutionItemsForProjection,
    createCharacterEvolutionPromptProjectionPolicy,
    getCharacterEvolutionProjectionBucket,
    getCharacterEvolutionPromptProjectionPolicy,
    normalizeCharacterEvolutionPromptProjectionPolicy,
};
