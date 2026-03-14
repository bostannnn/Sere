const { CHARACTER_EVOLUTION_ITEM_SECTION_KEYS } = require('./items.cjs');
const { normalizeCharacterEvolutionSectionConfigs } = require('./normalizers.cjs');
const { createDefaultCharacterEvolutionState } = require('./schema.cjs');

const FAST_DECAY_SECTIONS = new Set([
    'activeThreads',
    'runningJokes',
    'keyMoments',
]);

const MEDIUM_DECAY_SECTIONS = new Set([
    'userRead',
    'characterHabits',
    'characterBoundariesPreferences',
]);

const SLOW_DECAY_SECTIONS = new Set([
    'userFacts',
    'characterLikes',
    'characterDislikes',
    'userLikes',
    'userDislikes',
    'characterIntimatePreferences',
    'userIntimatePreferences',
]);

function normalizeUnseenAcceptedHandoffs(item) {
    if (!Number.isFinite(Number(item?.unseenAcceptedHandoffs)) || Number(item?.unseenAcceptedHandoffs) < 0) {
        return 0;
    }
    return Math.max(0, Math.floor(Number(item.unseenAcceptedHandoffs)));
}

function isReinforcedOnAcceptedHandoff(item, acceptedVersion) {
    return Number.isFinite(item?.lastSeenVersion)
        && Number(item.lastSeenVersion) === acceptedVersion
        && (item?.status || 'active') === 'active';
}

function shouldArchiveAfterDecay(sectionKey, item, unseenAcceptedHandoffs) {
    if ((item?.status || 'active') !== 'active') {
        return false;
    }

    if (FAST_DECAY_SECTIONS.has(sectionKey)) {
        return unseenAcceptedHandoffs >= 2;
    }

    if (MEDIUM_DECAY_SECTIONS.has(sectionKey)) {
        return unseenAcceptedHandoffs >= 5;
    }

    if (!SLOW_DECAY_SECTIONS.has(sectionKey)) {
        return false;
    }

    const confidence = item?.confidence || 'suspected';
    if (confidence === 'confirmed') {
        return false;
    }
    return unseenAcceptedHandoffs >= 8;
}

function applyDecayToSection(arg = {}) {
    return (Array.isArray(arg.items) ? arg.items : []).map((item) => {
        if ((item?.status || 'active') !== 'active') {
            return { ...item };
        }

        const reinforced = isReinforcedOnAcceptedHandoff(item, arg.acceptedVersion);
        const nextUnseenAcceptedHandoffs = reinforced
            ? 0
            : normalizeUnseenAcceptedHandoffs(item) + 1;

        if (shouldArchiveAfterDecay(arg.sectionKey, item, nextUnseenAcceptedHandoffs)) {
            return {
                ...item,
                status: 'archived',
                unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
            };
        }

        return {
            ...item,
            unseenAcceptedHandoffs: nextUnseenAcceptedHandoffs,
        };
    });
}

function isSectionEnabled(sectionConfigs, key) {
    return normalizeCharacterEvolutionSectionConfigs(sectionConfigs)
        .some((section) => section.key === key && section.enabled);
}

function applyLastInteractionEndedOverwrite(arg = {}) {
    const nextState = structuredClone(arg.proposedState || {});
    if (!isSectionEnabled(arg.sectionConfigs, 'lastInteractionEnded')) {
        return nextState;
    }

    nextState.lastInteractionEnded = Object.prototype.hasOwnProperty.call(nextState, 'lastInteractionEnded')
        ? structuredClone(nextState.lastInteractionEnded || createDefaultCharacterEvolutionState().lastInteractionEnded)
        : structuredClone(createDefaultCharacterEvolutionState().lastInteractionEnded);

    return nextState;
}

function applyCharacterEvolutionDecay(arg = {}) {
    const nextState = structuredClone(arg.state || {});

    for (const key of CHARACTER_EVOLUTION_ITEM_SECTION_KEYS) {
        nextState[key] = applyDecayToSection({
            sectionKey: key,
            items: Array.isArray(nextState[key]) ? nextState[key] : [],
            acceptedVersion: arg.acceptedVersion,
        });
    }

    return nextState;
}

module.exports = {
    applyCharacterEvolutionDecay,
    applyLastInteractionEndedOverwrite,
};
