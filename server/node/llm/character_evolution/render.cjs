const {
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
} = require('./normalizers.cjs');
const {
    isCharacterEvolutionObjectSection,
} = require('./items.cjs');
const { toTrimmedString } = require('./utils.cjs');
const { projectCharacterEvolutionStateForPrompt } = require('./projection.cjs');

function itemToLine(item) {
    const confidence = toTrimmedString(item.confidence) ? ` [${toTrimmedString(item.confidence)}]` : '';
    return `- ${toTrimmedString(item.value)}${confidence}`;
}

function renderCharacterEvolutionStateForPrompt(stateRaw, sectionConfigsRaw, privacyRaw, promptProjectionRaw = null) {
    const state = projectCharacterEvolutionStateForPrompt(stateRaw, 'generation', promptProjectionRaw);
    const sectionConfigs = normalizeCharacterEvolutionSectionConfigs(sectionConfigsRaw);
    const privacy = normalizeCharacterEvolutionPrivacy(privacyRaw);
    const lines = [];

    const pushSection = (label, content) => {
        const filtered = (Array.isArray(content) ? content : []).map((value) => toTrimmedString(value)).filter(Boolean);
        if (filtered.length === 0) return;
        lines.push(label);
        lines.push(...filtered);
        lines.push('');
    };

    for (const section of sectionConfigs) {
        if (!section.enabled || !section.includeInPrompt) continue;
        if (section.key === 'characterIntimatePreferences' && !privacy.allowCharacterIntimatePreferences) continue;
        if (section.key === 'userIntimatePreferences' && !privacy.allowUserIntimatePreferences) continue;

        if (section.key === 'relationship') {
            pushSection(section.label, [
                state.relationship.trustLevel ? `Trust level: ${state.relationship.trustLevel}` : '',
                state.relationship.dynamic ? `Dynamic: ${state.relationship.dynamic}` : '',
            ]);
            continue;
        }

        if (section.key === 'lastInteractionEnded') {
            pushSection(section.label, [
                state.lastInteractionEnded.state ? `State: ${state.lastInteractionEnded.state}` : '',
                state.lastInteractionEnded.residue ? `Residue: ${state.lastInteractionEnded.residue}` : '',
            ]);
            continue;
        }

        if (isCharacterEvolutionObjectSection(section.key)) {
            continue;
        }

        pushSection(section.label, state[section.key].map((item) => itemToLine(item)));
    }

    if (lines.length === 0) return '';
    return ['<CharacterEvolutionState>', ...lines, '</CharacterEvolutionState>'].join('\n').trim();
}

module.exports = {
    renderCharacterEvolutionStateForPrompt,
};
