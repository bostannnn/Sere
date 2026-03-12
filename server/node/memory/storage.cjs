function getMemoryData(chat) {
    if (!chat || typeof chat !== 'object') return undefined;
    return chat.memoryData || chat.hypaV3Data;
}

function cloneMemorySettingsLike(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    return { ...value };
}

function cloneMemoryPresetLike(preset) {
    if (!preset || typeof preset !== 'object' || Array.isArray(preset)) return preset;
    return {
        ...preset,
        settings: cloneMemorySettingsLike(preset.settings),
    };
}

function canonicalizeMemorySettingsShape(settings) {
    if (!settings || typeof settings !== 'object') return settings;
    const target = settings;
    const rawPresets = Array.isArray(target.memoryPresets)
        ? target.memoryPresets
        : (Array.isArray(target.hypaV3Presets) ? target.hypaV3Presets : undefined);
    const rawSettings = (target.memorySettings && typeof target.memorySettings === 'object')
        ? target.memorySettings
        : ((target.hypaV3Settings && typeof target.hypaV3Settings === 'object') ? target.hypaV3Settings : undefined);
    const rawPresetId = target.memoryPresetId ?? target.hypaV3PresetId;
    const rawEnabled = target.memoryEnabled ?? target.hypaV3;

    if (rawPresets !== undefined) {
        target.memoryPresets = rawPresets.map((preset) => cloneMemoryPresetLike(preset));
    }
    if (rawSettings !== undefined) {
        target.memorySettings = cloneMemorySettingsLike(rawSettings);
    }
    if (rawPresetId !== undefined) {
        target.memoryPresetId = Number.isFinite(Number(rawPresetId)) ? Number(rawPresetId) : 0;
    }
    if (rawEnabled !== undefined) {
        target.memoryEnabled = Boolean(rawEnabled);
    }

    delete target.hypaV3Presets;
    delete target.hypaV3Settings;
    delete target.hypaV3PresetId;
    delete target.hypaV3;

    return target;
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
    canonicalizeMemorySettingsShape,
    getMemoryData,
    setMemoryData,
    getMemoryPromptOverride,
    setMemoryPromptOverride,
    getMemoryPresets,
    getMemoryPresetId,
    isMemoryEnabled,
};
