const { getMemoryPromptOverride, setMemoryPromptOverride } = require('./storage.cjs');

function toPromptString(value) {
    return typeof value === 'string' ? value : '';
}

function normalizePromptOverride(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }
    const raw = payload;
    return {
        summarizationPrompt: toPromptString(raw.summarizationPrompt),
    };
}

function applyPromptOverride(character, promptOverride) {
    const baseCharacter = (character && typeof character === 'object' && !Array.isArray(character))
        ? { ...character }
        : {};
    if (!promptOverride) {
        return baseCharacter;
    }
    setMemoryPromptOverride(baseCharacter, {
        summarizationPrompt: promptOverride.summarizationPrompt,
    });
    return baseCharacter;
}

function resolveManualPromptSource(promptOverride, characterForRequest) {
    const requestPromptOverride = toPromptString(promptOverride?.summarizationPrompt).trim();
    const effectiveCharacterPromptOverride = (
        characterForRequest &&
        typeof characterForRequest === 'object' &&
        getMemoryPromptOverride(characterForRequest) &&
        typeof getMemoryPromptOverride(characterForRequest) === 'object'
    ) ? getMemoryPromptOverride(characterForRequest) : null;
    const effectiveCharacterPrompt = toPromptString(effectiveCharacterPromptOverride?.summarizationPrompt).trim();
    if (requestPromptOverride.length > 0) {
        return 'request_override';
    }
    if (effectiveCharacterPrompt.length > 0) {
        return 'character_override';
    }
    return 'preset_or_default';
}

module.exports = {
    normalizePromptOverride,
    applyPromptOverride,
    resolveManualPromptSource,
};
