const { applyPromptVars } = require('../scripts.cjs');
const { getEffectiveCharacterEvolutionSettings } = require('./normalizers.cjs');
const { projectCharacterEvolutionStateForPrompt } = require('./projection.cjs');
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

function toCompactPromptItem(item) {
    const value = toTrimmedString(item?.value);
    if (!value) {
        return null;
    }

    return {
        value,
        ...(item?.confidence ? { confidence: item.confidence } : {}),
        status: 'active',
    };
}

function buildCompactCurrentStateForExtraction(stateRaw) {
    const state = projectCharacterEvolutionStateForPrompt(stateRaw, 'extraction');

    return {
        relationship: {
            trustLevel: toTrimmedString(state.relationship?.trustLevel),
            dynamic: toTrimmedString(state.relationship?.dynamic),
        },
        activeThreads: state.activeThreads.map((item) => toCompactPromptItem(item)).filter(Boolean),
        runningJokes: state.runningJokes.map((item) => toCompactPromptItem(item)).filter(Boolean),
        characterLikes: state.characterLikes.map((item) => toCompactPromptItem(item)).filter(Boolean),
        characterDislikes: state.characterDislikes.map((item) => toCompactPromptItem(item)).filter(Boolean),
        characterHabits: state.characterHabits.map((item) => toCompactPromptItem(item)).filter(Boolean),
        characterBoundariesPreferences: state.characterBoundariesPreferences.map((item) => toCompactPromptItem(item)).filter(Boolean),
        userFacts: state.userFacts.map((item) => toCompactPromptItem(item)).filter(Boolean),
        userRead: state.userRead.map((item) => toCompactPromptItem(item)).filter(Boolean),
        userLikes: state.userLikes.map((item) => toCompactPromptItem(item)).filter(Boolean),
        userDislikes: state.userDislikes.map((item) => toCompactPromptItem(item)).filter(Boolean),
        lastInteractionEnded: {
            state: toTrimmedString(state.lastInteractionEnded?.state),
            residue: toTrimmedString(state.lastInteractionEnded?.residue),
        },
        keyMoments: state.keyMoments.map((item) => toCompactPromptItem(item)).filter(Boolean),
        characterIntimatePreferences: state.characterIntimatePreferences.map((item) => toCompactPromptItem(item)).filter(Boolean),
        userIntimatePreferences: state.userIntimatePreferences.map((item) => toCompactPromptItem(item)).filter(Boolean),
    };
}

function buildCharacterEvolutionPromptMessages(arg = {}) {
    const settings = arg.settings || {};
    const character = arg.character || {};
    const chat = arg.chat || {};
    const evolution = getEffectiveCharacterEvolutionSettings(settings, character);
    const sourceRange = arg.sourceRange && typeof arg.sourceRange === 'object'
        ? arg.sourceRange
        : null;
    const transcriptStart = Number.isFinite(Number(sourceRange?.startMessageIndex))
        ? Math.max(0, Math.floor(Number(sourceRange.startMessageIndex)))
        : 0;
    const transcriptEnd = Number.isFinite(Number(sourceRange?.endMessageIndex))
        ? Math.max(transcriptStart, Math.floor(Number(sourceRange.endMessageIndex)))
        : (Array.isArray(chat.message) ? chat.message.length - 1 : -1);
    const transcriptMessages = Array.isArray(chat.message)
        ? chat.message.slice(transcriptStart, transcriptEnd + 1)
        : [];
    const transcriptLines = Array.isArray(transcriptMessages)
        ? transcriptMessages
            .map((message, index) => {
                const line = chatMessageToTranscriptLine(message, toTrimmedString(character.name), toTrimmedString(settings.username));
                if (!line) return '';
                return `[${transcriptStart + index}] ${line}`;
            })
            .filter(Boolean)
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

    const state = JSON.stringify(buildCompactCurrentStateForExtraction(evolution.currentState), null, 2);
    const prompt = [
        applyPromptVars(evolution.extractionPrompt, character, settings),
        '',
        'Enabled sections:',
        sections || '[none]',
        '',
        'Current state JSON:',
        state,
        '',
        'Chat transcript range:',
        sourceRange
            ? `${sourceRange.chatId}:${transcriptStart}..${transcriptEnd}`
            : `${toTrimmedString(chat.id) || '[unknown chat]'}:${transcriptStart}..${transcriptEnd}`,
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
