function getMemoryData(chat) {
    if (!chat || typeof chat !== 'object') return undefined;
    return chat.memoryData;
}

function setMemoryData(chat, data) {
    if (!chat || typeof chat !== 'object') return;
    if (chat.memoryData === data) return;
    chat.memoryData = data;
}

function getMemoryPromptOverride(character) {
    if (!character || typeof character !== 'object') return undefined;
    return character.memoryPromptOverride;
}

function setMemoryPromptOverride(character, promptOverride) {
    if (!character || typeof character !== 'object') return;
    const normalizedPromptOverride = promptOverride
        ? {
            summarizationPrompt: typeof promptOverride.summarizationPrompt === 'string'
                ? promptOverride.summarizationPrompt
                : '',
        }
        : undefined;
    const currentPrompt = getMemoryPromptOverride(character)?.summarizationPrompt || '';
    const nextPrompt = normalizedPromptOverride?.summarizationPrompt || '';
    const memoryPrompt = character.memoryPromptOverride;
    const memoryNormalized = !!memoryPrompt && typeof memoryPrompt === 'object' && typeof memoryPrompt.summarizationPrompt === 'string';

    if (
        currentPrompt === nextPrompt &&
        (normalizedPromptOverride ? memoryNormalized : !memoryPrompt)
    ) {
        return;
    }

    character.memoryPromptOverride = normalizedPromptOverride;
}

function getMemoryPresets(settings) {
    if (!settings || typeof settings !== 'object') return [];
    return Array.isArray(settings.memoryPresets) ? settings.memoryPresets : [];
}

function getMemoryPresetId(settings) {
    if (!settings || typeof settings !== 'object') return 0;
    const raw = settings.memoryPresetId;
    return Number.isFinite(Number(raw)) ? Number(raw) : 0;
}

function isMemoryEnabled(settings) {
    if (!settings || typeof settings !== 'object') return true;
    if (typeof settings.memoryEnabled === 'boolean') return settings.memoryEnabled;
    return true;
}

module.exports = {
    getMemoryData,
    setMemoryData,
    getMemoryPromptOverride,
    setMemoryPromptOverride,
    getMemoryPresets,
    getMemoryPresetId,
    isMemoryEnabled,
};
