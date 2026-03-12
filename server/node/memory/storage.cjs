function getMemoryData(chat) {
    if (!chat || typeof chat !== 'object') return undefined;
    return chat.memoryData || chat.hypaV3Data;
}

const LEGACY_MEMORY_CONFIG_KEYS = [
    'memoryAlgorithmType',
    'hypaMemory',
    'hanuraiEnable',
    'hanuraiSplit',
    'hanuraiTokens',
    'hypaMemoryKey',
];

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

function getSelectedMemorySettingsLike(presets, presetId) {
    if (!Array.isArray(presets) || presets.length === 0) return undefined;
    const normalizedPresetId = Number.isFinite(Number(presetId))
        ? Number(presetId)
        : 0;
    const selectedPreset = presets[normalizedPresetId] || presets[0];
    if (!selectedPreset || typeof selectedPreset !== 'object') return undefined;
    const settings = selectedPreset.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return undefined;
    return settings;
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
    if (rawPresetId !== undefined) {
        target.memoryPresetId = Number.isFinite(Number(rawPresetId)) ? Number(rawPresetId) : 0;
    }
    const selectedPresetSettings = getSelectedMemorySettingsLike(
        target.memoryPresets,
        target.memoryPresetId ?? rawPresetId,
    );
    if (selectedPresetSettings) {
        target.memorySettings = cloneMemorySettingsLike(selectedPresetSettings);
    } else if (rawSettings !== undefined) {
        target.memorySettings = cloneMemorySettingsLike(rawSettings);
    }
    if (rawEnabled !== undefined) {
        target.memoryEnabled = Boolean(rawEnabled);
    }

    delete target.hypaV3Presets;
    delete target.hypaV3Settings;
    delete target.hypaV3PresetId;
    delete target.hypaV3;
    for (const legacyKey of LEGACY_MEMORY_CONFIG_KEYS) {
        delete target[legacyKey];
    }

    return target;
}

function setMemoryData(chat, data) {
    if (!chat || typeof chat !== 'object') return;
    if (chat.memoryData === data && !('hypaV3Data' in chat)) return;
    chat.memoryData = data;
    delete chat.hypaV3Data;
    delete chat.hypaV2Data;
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
    const memoryNormalized = !!memoryPrompt && typeof memoryPrompt === 'object' && typeof memoryPrompt.summarizationPrompt === 'string';

    if (
        currentPrompt === nextPrompt &&
        !('hypaV3PromptOverride' in character) &&
        (normalizedPromptOverride ? memoryNormalized : !memoryPrompt)
    ) {
        return;
    }

    character.memoryPromptOverride = normalizedPromptOverride;
    delete character.hypaV3PromptOverride;
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
