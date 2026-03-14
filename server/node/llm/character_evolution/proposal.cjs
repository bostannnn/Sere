const { clone } = require('./utils.cjs');
const { createDefaultCharacterEvolutionState } = require('./schema.cjs');
const {
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionState,
} = require('./normalizers.cjs');

const CHARACTER_EVOLUTION_OBJECT_SECTION_SHAPE_KEYS = {
    relationship: ['trustLevel', 'dynamic'],
    lastInteractionEnded: ['state', 'residue'],
};

function isEvolutionSectionAllowed(section, privacy) {
    if (!section || section.enabled !== true) return false;
    if (section.key === 'characterIntimatePreferences' && !privacy.allowCharacterIntimatePreferences) return false;
    if (section.key === 'userIntimatePreferences' && !privacy.allowUserIntimatePreferences) return false;
    return true;
}

function getAllowedEvolutionSections(evolutionSettings) {
    const privacy = normalizeCharacterEvolutionPrivacy(evolutionSettings?.privacy);
    return new Set(
        normalizeCharacterEvolutionSectionConfigs(evolutionSettings?.sectionConfigs)
            .filter((section) => isEvolutionSectionAllowed(section, privacy))
            .map((section) => section.key)
    );
}

function extractNormalizedProposalParts(raw, evolutionSettings) {
    const payload = (raw && typeof raw === 'object') ? raw : {};
    const allowedSections = getAllowedEvolutionSections(evolutionSettings);
    const defaults = createDefaultCharacterEvolutionState();
    const proposedState = {};
    const rawProposedState = (payload.proposedState && typeof payload.proposedState === 'object')
        ? payload.proposedState
        : {};

    for (const key of Object.keys(defaults)) {
        if (!allowedSections.has(key)) continue;
        if (Object.prototype.hasOwnProperty.call(rawProposedState, key)) {
            proposedState[key] = rawProposedState[key];
        }
    }

    if (
        !Object.prototype.hasOwnProperty.call(proposedState, 'lastInteractionEnded')
        && allowedSections.has('lastInteractionEnded')
        && Object.prototype.hasOwnProperty.call(rawProposedState, 'lastChatEnded')
    ) {
        proposedState.lastInteractionEnded = rawProposedState.lastChatEnded;
    }

    const changes = Array.isArray(payload.changes)
        ? payload.changes
            .map((change) => {
                if (!change || typeof change !== 'object') return null;
                const sectionKey = typeof change.sectionKey === 'string' ? change.sectionKey.trim() : '';
                if (!sectionKey || !allowedSections.has(sectionKey)) return null;
                return {
                    sectionKey,
                    summary: typeof change.summary === 'string' ? change.summary.trim() : '',
                    evidence: Array.isArray(change.evidence)
                        ? change.evidence.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean)
                        : [],
                };
            })
            .filter(Boolean)
        : [];

    return {
        proposedState,
        changes,
    };
}

function getCharacterEvolutionProposalValidationError(raw, evolutionSettings) {
    const payload = (raw && typeof raw === 'object') ? raw : {};
    const allowedSections = getAllowedEvolutionSections(evolutionSettings);
    const knownSections = new Set(Object.keys(createDefaultCharacterEvolutionState()));
    const rawProposedState = (payload.proposedState && typeof payload.proposedState === 'object' && !Array.isArray(payload.proposedState))
        ? payload.proposedState
        : {};
    const rawProposedKeys = Object.keys(rawProposedState);
    const parts = extractNormalizedProposalParts(raw, evolutionSettings);
    const proposedKeys = Object.keys(parts.proposedState);
    const proposedKeySet = new Set(proposedKeys);

    for (const key of rawProposedKeys) {
        if (!knownSections.has(key)) {
            return `Malformed extractor proposal: unknown proposedState section "${key}".`;
        }
        if (!allowedSections.has(key)) {
            return `Malformed extractor proposal: proposedState section "${key}" is not enabled for evolution.`;
        }
    }

    if (parts.changes.length > 0 && proposedKeys.length === 0) {
        return 'Malformed extractor proposal: changes requires matching proposedState sections.';
    }

    if (Array.isArray(payload.changes)) {
        for (const change of payload.changes) {
            if (!change || typeof change !== 'object') {
                return 'Malformed extractor proposal: changes entries must be objects.';
            }
            const sectionKey = typeof change.sectionKey === 'string' ? change.sectionKey.trim() : '';
            if (!sectionKey) {
                return 'Malformed extractor proposal: changes entries require sectionKey.';
            }
            if (!knownSections.has(sectionKey)) {
                return `Malformed extractor proposal: unknown changes section "${sectionKey}".`;
            }
            if (!allowedSections.has(sectionKey)) {
                return `Malformed extractor proposal: changes section "${sectionKey}" is not enabled for evolution.`;
            }
        }
    }

    for (const change of parts.changes) {
        if (!proposedKeySet.has(change.sectionKey)) {
            return `Malformed extractor proposal: changes section "${change.sectionKey}" is missing from proposedState.`;
        }
    }

    for (const key of proposedKeys) {
        const sectionValue = parts.proposedState[key];
        if (Object.prototype.hasOwnProperty.call(CHARACTER_EVOLUTION_OBJECT_SECTION_SHAPE_KEYS, key)) {
            if (!sectionValue || typeof sectionValue !== 'object' || Array.isArray(sectionValue)) {
                return `Malformed extractor proposal: "${key}" must be an object section.`;
            }
            const requiredKeys = CHARACTER_EVOLUTION_OBJECT_SECTION_SHAPE_KEYS[key] || [];
            for (const requiredKey of requiredKeys) {
                if (!Object.prototype.hasOwnProperty.call(sectionValue, requiredKey)) {
                    return `Malformed extractor proposal: "${key}" must include "${requiredKey}" for full replacement.`;
                }
            }
            continue;
        }

        if (!Array.isArray(sectionValue)) {
            return `Malformed extractor proposal: "${key}" must be an array section.`;
        }
    }

    return '';
}

function sanitizeStateForEvolution(stateRaw, evolutionSettings, baseStateRaw = null) {
    const state = normalizeCharacterEvolutionState(stateRaw);
    const defaults = createDefaultCharacterEvolutionState();
    const baseState = normalizeCharacterEvolutionState(baseStateRaw);
    const privacy = normalizeCharacterEvolutionPrivacy(evolutionSettings?.privacy);
    const allowedKeys = new Set(
        normalizeCharacterEvolutionSectionConfigs(evolutionSettings?.sectionConfigs)
            .filter((section) => isEvolutionSectionAllowed(section, privacy))
            .map((section) => section.key)
    );

    for (const key of Object.keys(defaults)) {
        if (allowedKeys.has(key)) continue;
        state[key] = clone(baseState[key], defaults[key]);
    }
    return state;
}

function safeParseEvolutionJson(text) {
    const source = typeof text === 'string' ? text.trim() : '';
    if (!source) return null;
    const candidates = [
        source,
        source.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, ''),
    ];
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {}
    }
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            return JSON.parse(source.slice(start, end + 1));
        } catch {}
    }
    return null;
}

function mergeChangedProposalStateWithCurrentState(proposedStateRaw, currentStateRaw) {
    const currentState = normalizeCharacterEvolutionState(currentStateRaw);
    if (!proposedStateRaw || typeof proposedStateRaw !== 'object') {
        return currentState;
    }

    const mergedState = clone(currentState, currentState);
    const proposedState = proposedStateRaw;

    for (const key of Object.keys(createDefaultCharacterEvolutionState())) {
        if (Object.prototype.hasOwnProperty.call(proposedState, key)) {
            mergedState[key] = proposedState[key];
        }
    }

    if (
        !Object.prototype.hasOwnProperty.call(proposedState, 'lastInteractionEnded')
        && Object.prototype.hasOwnProperty.call(proposedState, 'lastChatEnded')
    ) {
        mergedState.lastInteractionEnded = proposedState.lastChatEnded;
    }

    return mergedState;
}

function normalizeCharacterEvolutionProposal(raw, evolutionSettings) {
    const payload = extractNormalizedProposalParts(raw, evolutionSettings);
    return {
        proposedState: sanitizeStateForEvolution(
            mergeChangedProposalStateWithCurrentState(payload.proposedState, evolutionSettings.currentState),
            evolutionSettings,
            evolutionSettings.currentState
        ),
        changes: payload.changes,
    };
}

module.exports = {
    getCharacterEvolutionProposalValidationError,
    mergeChangedProposalStateWithCurrentState,
    normalizeCharacterEvolutionProposal,
    safeParseEvolutionJson,
    sanitizeStateForEvolution,
};
