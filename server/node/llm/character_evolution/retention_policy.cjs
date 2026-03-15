const { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');
const { getCharacterEvolutionProjectionBucket } = require('./projection_policy.cjs');

const DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY = {
    thresholds: {
        archive: {
            fast: 2,
            medium: 5,
            slow: 8,
        },
        deleteNonActive: {
            fast: 6,
            medium: 12,
            slow: 24,
        },
        deleteConfirmedSlow: 36,
    },
    caps: {
        activeThreads: {
            active: 6,
            nonActive: 10,
        },
        keyMoments: {
            active: 12,
            nonActive: 12,
        },
        characterHabits: {
            active: 6,
            nonActive: 8,
        },
    },
};

function normalizeThresholdValue(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return fallback;
    }
    return Math.max(0, Math.floor(numericValue));
}

function normalizeCapValue(value, fallback) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 1) {
        return fallback;
    }
    return Math.max(1, Math.floor(numericValue));
}

function normalizeBucketThresholdRecord(raw, fallback) {
    const source = (raw && typeof raw === 'object') ? raw : {};
    return {
        fast: normalizeThresholdValue(source.fast, fallback.fast),
        medium: normalizeThresholdValue(source.medium, fallback.medium),
        slow: normalizeThresholdValue(source.slow, fallback.slow),
    };
}

function normalizeSectionCap(raw, fallback) {
    if (!raw || typeof raw !== 'object') {
        return fallback ? { ...fallback } : null;
    }
    const activeFallback = fallback?.active ?? 1;
    const nonActiveFallback = fallback?.nonActive ?? 1;
    return {
        active: normalizeCapValue(raw.active, activeFallback),
        nonActive: normalizeCapValue(raw.nonActive, nonActiveFallback),
    };
}

function normalizeCharacterEvolutionRetentionPolicy(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    const fallback = DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY;
    const capsSource = (value.caps && typeof value.caps === 'object') ? value.caps : {};
    const caps = {};

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        const normalizedCap = normalizeSectionCap(
            capsSource[key],
            fallback.caps[key] ?? null
        );
        if (normalizedCap) {
            caps[key] = normalizedCap;
        }
    }

    return {
        thresholds: {
            archive: normalizeBucketThresholdRecord(value.thresholds?.archive, fallback.thresholds.archive),
            deleteNonActive: normalizeBucketThresholdRecord(value.thresholds?.deleteNonActive, fallback.thresholds.deleteNonActive),
            deleteConfirmedSlow: normalizeThresholdValue(value.thresholds?.deleteConfirmedSlow, fallback.thresholds.deleteConfirmedSlow),
        },
        caps,
    };
}

function getCharacterEvolutionRetentionBucket(sectionKey) {
    return getCharacterEvolutionProjectionBucket(sectionKey);
}

function createCharacterEvolutionRetentionPolicy() {
    return JSON.parse(JSON.stringify(DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY));
}

module.exports = {
    DEFAULT_CHARACTER_EVOLUTION_RETENTION_POLICY,
    createCharacterEvolutionRetentionPolicy,
    getCharacterEvolutionRetentionBucket,
    normalizeCharacterEvolutionRetentionPolicy,
};
