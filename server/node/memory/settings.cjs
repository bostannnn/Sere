const {
    getMemoryPresetId,
    getMemoryPresets,
    getMemoryPromptOverride,
    isMemoryEnabled,
} = require('./storage.cjs');

function toStringOrEmpty(value) {
    return typeof value === 'string' ? value : '';
}

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const floored = Math.floor(n);
    return Math.min(Math.max(floored, min), max);
}

function getPeriodicSummarizationInterval(memorySettings) {
    const interval = Number(memorySettings?.periodicSummarizationInterval);
    if (!Number.isFinite(interval) || interval <= 0) return 10;
    return clampInt(interval, 1, 64, 10);
}

function getSummaryBatchSize(memorySettings) {
    return getPeriodicSummarizationInterval(memorySettings);
}

const DEFAULT_MAX_SELECTED_SUMMARIES = 6;
const DEFAULT_MAX_PROMPT_CHARS = 8000;
const DEFAULT_SUMMARIZATION_PROMPT = '[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]';

const DEFAULT_MEMORY_SETTINGS = Object.freeze({
    summarizationModel: 'subModel',
    summarizationPrompt: '',
    memoryTokensRatio: 0.2,
    maxChatsPerSummary: 6,
    maxSelectedSummaries: 4,
    periodicSummarizationEnabled: true,
    periodicSummarizationInterval: 10,
    recentSummarySlots: 3,
    similarSummarySlots: 1,
    recentMemoryRatio: 0.75,
    similarMemoryRatio: 0.25,
    enableSimilarityCorrection: false,
    preserveOrphanedMemory: false,
    processRegexScript: false,
    doNotSummarizeUserMessage: false,
    useExperimentalImpl: false,
    summarizationRequestsPerMinute: 20,
    summarizationMaxConcurrent: 1,
    embeddingRequestsPerMinute: 100,
    embeddingMaxConcurrent: 1,
    alwaysToggleOn: false,
});

function getMaxSelectedSummaries(memorySettings) {
    const maxSelectedSummaries = Number(memorySettings?.maxSelectedSummaries);
    if (!Number.isFinite(maxSelectedSummaries) || maxSelectedSummaries <= 0) {
        return DEFAULT_MAX_SELECTED_SUMMARIES;
    }
    return clampInt(maxSelectedSummaries, 1, 32, DEFAULT_MAX_SELECTED_SUMMARIES);
}

function normalizeCharacterPromptOverride(character) {
    if (!character || typeof character !== 'object') {
        return {
            summarizationPrompt: '',
        };
    }
    const raw = getMemoryPromptOverride(character);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            summarizationPrompt: '',
        };
    }
    return {
        summarizationPrompt: toStringOrEmpty(raw.summarizationPrompt),
    };
}

function resolveMemorySettings(settings, character = null) {
    const dbSettings = settings && typeof settings === 'object' ? settings : {};
    const presets = getMemoryPresets(dbSettings);
    const presetId = clampInt(getMemoryPresetId(dbSettings), 0, Number.MAX_SAFE_INTEGER, 0);
    const preset = presets[presetId] || presets[0] || null;
    const presetSettings = preset && typeof preset === 'object' && preset.settings && typeof preset.settings === 'object'
        ? preset.settings
        : {};

    const resolved = { ...DEFAULT_MEMORY_SETTINGS };
    for (const [key, defaultValue] of Object.entries(DEFAULT_MEMORY_SETTINGS)) {
        const current = presetSettings[key];
        if (typeof current === typeof defaultValue) {
            resolved[key] = current;
        }
    }

    resolved.summarizationModel = 'subModel';
    resolved.periodicSummarizationEnabled = true;
    resolved.maxChatsPerSummary = resolved.periodicSummarizationInterval;

    const characterOverride = normalizeCharacterPromptOverride(character);
    if (characterOverride.summarizationPrompt.trim()) {
        resolved.summarizationPrompt = characterOverride.summarizationPrompt;
    }
    return resolved;
}

module.exports = {
    toStringOrEmpty,
    clampInt,
    getPeriodicSummarizationInterval,
    getSummaryBatchSize,
    getMaxSelectedSummaries,
    DEFAULT_MAX_SELECTED_SUMMARIES,
    DEFAULT_MAX_PROMPT_CHARS,
    DEFAULT_SUMMARIZATION_PROMPT,
    DEFAULT_MEMORY_SETTINGS,
    normalizeCharacterPromptOverride,
    resolveMemorySettings,
    isMemoryEnabled,
};
