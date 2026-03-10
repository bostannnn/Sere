const { applyPromptVars } = require('../scripts.cjs');
const { getEffectiveCharacterEvolutionSettings, normalizeCharacterEvolutionState } = require('./normalizers.cjs');
const { toTrimmedString } = require('./utils.cjs');

function chatMessageToTranscriptLine(message, characterName, userName) {
    if (!message || typeof message !== 'object' || message.disabled === true) return '';
    const role = toTrimmedString(message.role).toLowerCase();
    const label = role === 'user'
        ? (userName || 'User')
        : (characterName || 'Character');
    const content = toTrimmedString(message.data) || toTrimmedString(message.content);
    if (!content) return '';
    return `${label}: ${content}`;
}

function buildCharacterEvolutionPromptMessages(arg = {}) {
    const settings = arg.settings || {};
    const character = arg.character || {};
    const chat = arg.chat || {};
    const evolution = getEffectiveCharacterEvolutionSettings(settings, character);
    const transcriptLines = Array.isArray(chat.message)
        ? chat.message.map((message) => chatMessageToTranscriptLine(message, toTrimmedString(character.name), toTrimmedString(settings.username))).filter(Boolean)
        : [];
    const sections = evolution.sectionConfigs
        .filter((section) => section.enabled)
        .filter((section) => section.key !== 'characterIntimatePreferences' || evolution.privacy.allowCharacterIntimatePreferences)
        .filter((section) => section.key !== 'userIntimatePreferences' || evolution.privacy.allowUserIntimatePreferences)
        .map((section) => [
            `- key: ${section.key}`,
            `  label: ${section.label}`,
            `  kind: ${section.kind}`,
            `  includeInPrompt: ${section.includeInPrompt ? 'true' : 'false'}`,
            `  instruction: ${applyPromptVars(section.instruction, character, settings)}`,
        ].join('\n'))
        .join('\n');

    const state = JSON.stringify(normalizeCharacterEvolutionState(evolution.currentState), null, 2);
    const identity = [
        `Name: ${toTrimmedString(character.name)}`,
        'Description:',
        toTrimmedString(character.desc) || '[empty]',
        '',
        'Personality:',
        toTrimmedString(character.personality) || '[empty]',
    ].join('\n');

    const prompt = [
        applyPromptVars(evolution.extractionPrompt, character, settings),
        '',
        'Enabled sections:',
        sections || '[none]',
        '',
        'Identity context:',
        identity,
        '',
        'Current state JSON:',
        state,
        '',
        'Chat transcript:',
        transcriptLines.join('\n') || '[empty]',
    ].join('\n');

    return [
        { role: 'system', content: 'You are a strict structured extraction engine. Return JSON only.' },
        { role: 'user', content: prompt },
    ];
}

module.exports = {
    buildCharacterEvolutionPromptMessages,
};
