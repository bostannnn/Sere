const {
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionState,
} = require('./normalizers.cjs');
const { toTrimmedString } = require('./utils.cjs');

function itemToLine(item) {
    const note = toTrimmedString(item.note) ? ` (${toTrimmedString(item.note)})` : '';
    const confidence = toTrimmedString(item.confidence) ? ` [${toTrimmedString(item.confidence)}]` : '';
    return `- ${toTrimmedString(item.value)}${confidence}${note}`;
}

function renderCharacterEvolutionStateForPrompt(stateRaw, sectionConfigsRaw, privacyRaw) {
    const state = normalizeCharacterEvolutionState(stateRaw);
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

        switch (section.key) {
            case 'relationship':
                pushSection(section.label, [
                    state.relationship.trustLevel ? `Trust level: ${state.relationship.trustLevel}` : '',
                    state.relationship.dynamic ? `Dynamic: ${state.relationship.dynamic}` : '',
                ]);
                break;
            case 'activeThreads':
            case 'runningJokes':
            case 'keyMoments':
            case 'userRead':
                pushSection(section.label, state[section.key].map((item) => `- ${item}`));
                break;
            case 'lastChatEnded':
                pushSection(section.label, [
                    state.lastChatEnded.state ? `State: ${state.lastChatEnded.state}` : '',
                    state.lastChatEnded.residue ? `Residue: ${state.lastChatEnded.residue}` : '',
                ]);
                break;
            default:
                pushSection(section.label, state[section.key]
                    .filter((item) => item.status !== 'archived')
                    .map((item) => itemToLine(item)));
                break;
        }
    }

    if (lines.length === 0) return '';
    return ['<CharacterEvolutionState>', ...lines, '</CharacterEvolutionState>'].join('\n').trim();
}

module.exports = {
    renderCharacterEvolutionStateForPrompt,
};
