function getMemoryData(chat) {
    if (!chat || typeof chat !== 'object') return undefined;
    return chat.memoryData || chat.hypaV3Data;
}

function setMemoryData(chat, data) {
    if (!chat || typeof chat !== 'object') return;
    if (chat.memoryData === data && chat.hypaV3Data === data) return;
    chat.memoryData = data;
    chat.hypaV3Data = data;
}

function getMemoryPromptOverride(character) {
    if (!character || typeof character !== 'object') return undefined;
    return character.memoryPromptOverride || character.hypaV3PromptOverride;
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
    const legacyPrompt = character.hypaV3PromptOverride;
    const memoryNormalized = !!memoryPrompt && typeof memoryPrompt === 'object' && typeof memoryPrompt.summarizationPrompt === 'string';
    const legacyNormalized = !!legacyPrompt && typeof legacyPrompt === 'object' && typeof legacyPrompt.summarizationPrompt === 'string';

    if (
        currentPrompt === nextPrompt &&
        memoryPrompt === legacyPrompt &&
        (normalizedPromptOverride ? memoryNormalized && legacyNormalized : !memoryPrompt && !legacyPrompt)
    ) {
        return;
    }

    character.memoryPromptOverride = normalizedPromptOverride;
    character.hypaV3PromptOverride = normalizedPromptOverride;
}

function getMemoryPresets(settings) {
    if (!settings || typeof settings !== 'object') return [];
    return Array.isArray(settings.memoryPresets)
        ? settings.memoryPresets
        : (Array.isArray(settings.hypaV3Presets) ? settings.hypaV3Presets : []);
}

function getMemoryPresetId(settings) {
    if (!settings || typeof settings !== 'object') return 0;
    const raw = settings.memoryPresetId ?? settings.hypaV3PresetId;
    return Number.isFinite(Number(raw)) ? Number(raw) : 0;
}

function isMemoryEnabled(settings) {
    if (!settings || typeof settings !== 'object') return true;
    if (typeof settings.memoryEnabled === 'boolean') return settings.memoryEnabled;
    if (typeof settings.hypaV3 === 'boolean') return settings.hypaV3;
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
