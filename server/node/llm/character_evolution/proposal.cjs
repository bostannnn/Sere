const { clone } = require('./utils.cjs');
const { createDefaultCharacterEvolutionState } = require('./schema.cjs');
const {
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionState,
} = require('./normalizers.cjs');

function isEvolutionSectionAllowed(section, privacy) {
    if (!section || section.enabled !== true) return false;
    if (section.key === 'characterIntimatePreferences' && !privacy.allowCharacterIntimatePreferences) return false;
    if (section.key === 'userIntimatePreferences' && !privacy.allowUserIntimatePreferences) return false;
    return true;
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

function normalizeCharacterEvolutionProposal(raw, evolutionSettings) {
    const payload = (raw && typeof raw === 'object') ? raw : {};
    const privacy = normalizeCharacterEvolutionPrivacy(evolutionSettings?.privacy);
    const allowedSections = new Set(
        normalizeCharacterEvolutionSectionConfigs(evolutionSettings?.sectionConfigs)
            .filter((section) => isEvolutionSectionAllowed(section, privacy))
            .map((section) => section.key)
    );
    return {
        proposedState: sanitizeStateForEvolution(
            payload.proposedState || evolutionSettings.currentState,
            evolutionSettings,
            evolutionSettings.currentState
        ),
        changes: Array.isArray(payload.changes)
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
            : [],
    };
}

module.exports = {
    normalizeCharacterEvolutionProposal,
    safeParseEvolutionJson,
    sanitizeStateForEvolution,
};
