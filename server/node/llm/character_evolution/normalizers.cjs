const {
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
    normalizeCharacterEvolutionExtractionModel,
} = require('./schema.cjs');
const { toTrimmedString } = require('./utils.cjs');

function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') {
        if (typeof raw === 'string' && raw.trim()) {
            return { value: raw.trim(), status: 'active' };
        }
        return null;
    }
    const value = toTrimmedString(raw.value);
    if (!value) return null;
    return {
        value,
        confidence: raw.confidence === 'suspected' || raw.confidence === 'likely' || raw.confidence === 'confirmed'
            ? raw.confidence
            : undefined,
        note: toTrimmedString(raw.note),
        status: raw.status === 'archived' || raw.status === 'corrected' || raw.status === 'active'
            ? raw.status
            : 'active',
        sourceChatId: toTrimmedString(raw.sourceChatId) || undefined,
        updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : undefined,
    };
}

function normalizeStringList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => toTrimmedString(item)).filter(Boolean);
}

function normalizeItemList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => normalizeItem(item)).filter(Boolean);
}

function normalizeCharacterEvolutionState(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    const state = createDefaultCharacterEvolutionState();
    state.relationship = {
        trustLevel: toTrimmedString(value.relationship?.trustLevel),
        dynamic: toTrimmedString(value.relationship?.dynamic),
    };
    state.activeThreads = normalizeStringList(value.activeThreads);
    state.runningJokes = normalizeStringList(value.runningJokes);
    state.characterLikes = normalizeItemList(value.characterLikes);
    state.characterDislikes = normalizeItemList(value.characterDislikes);
    state.characterHabits = normalizeItemList(value.characterHabits);
    state.characterBoundariesPreferences = normalizeItemList(value.characterBoundariesPreferences);
    state.userFacts = normalizeItemList(value.userFacts);
    state.userRead = normalizeStringList(value.userRead);
    state.userLikes = normalizeItemList(value.userLikes);
    state.userDislikes = normalizeItemList(value.userDislikes);
    state.lastChatEnded = {
        state: toTrimmedString(value.lastChatEnded?.state),
        residue: toTrimmedString(value.lastChatEnded?.residue),
    };
    state.keyMoments = normalizeStringList(value.keyMoments);
    state.characterIntimatePreferences = normalizeItemList(value.characterIntimatePreferences);
    state.userIntimatePreferences = normalizeItemList(value.userIntimatePreferences);
    return state;
}

function normalizeCharacterEvolutionSectionConfigs(raw) {
    const defaults = createDefaultCharacterEvolutionSectionConfigs();
    const rawSections = Array.isArray(raw) ? raw : [];
    const rawMap = new Map();
    for (const section of rawSections) {
        if (!section || typeof section !== 'object') continue;
        const key = toTrimmedString(section.key);
        if (!key) continue;
        rawMap.set(key, section);
    }
    return defaults.map((section) => {
        const override = rawMap.get(section.key) || {};
        return {
            ...section,
            label: toTrimmedString(override.label) || section.label,
            enabled: override.enabled === undefined ? section.enabled : override.enabled === true,
            includeInPrompt: override.includeInPrompt === undefined ? section.includeInPrompt : override.includeInPrompt === true,
            instruction: toTrimmedString(override.instruction) || section.instruction,
            sensitive: override.sensitive === undefined ? section.sensitive : override.sensitive === true,
        };
    });
}

function normalizeCharacterEvolutionPrivacy(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    return {
        allowCharacterIntimatePreferences: value.allowCharacterIntimatePreferences === true,
        allowUserIntimatePreferences: value.allowUserIntimatePreferences === true,
    };
}

function normalizeCharacterEvolutionDefaults(raw) {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === 'object') ? raw : {};
    const extractionMaxTokens = Number(value.extractionMaxTokens);
    const extractionProvider = toTrimmedString(value.extractionProvider) || defaults.extractionProvider;
    return {
        extractionProvider,
        extractionModel: normalizeCharacterEvolutionExtractionModel(extractionProvider, value.extractionModel),
        extractionMaxTokens: Number.isFinite(extractionMaxTokens) && extractionMaxTokens > 0
            ? Math.max(64, Math.floor(extractionMaxTokens))
            : defaults.extractionMaxTokens,
        extractionPrompt: toTrimmedString(value.extractionPrompt) || defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
    };
}

function normalizeCharacterEvolutionSettings(raw) {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === 'object') ? raw : {};
    const extractionMaxTokens = Number(value.extractionMaxTokens);
    const extractionProvider = toTrimmedString(value.extractionProvider) || defaults.extractionProvider;
    return {
        enabled: value.enabled === true,
        useGlobalDefaults: value.useGlobalDefaults !== false,
        extractionProvider,
        extractionModel: normalizeCharacterEvolutionExtractionModel(extractionProvider, value.extractionModel),
        extractionMaxTokens: Number.isFinite(extractionMaxTokens) && extractionMaxTokens > 0
            ? Math.max(64, Math.floor(extractionMaxTokens))
            : defaults.extractionMaxTokens,
        extractionPrompt: toTrimmedString(value.extractionPrompt) || defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
        currentStateVersion: Number.isFinite(Number(value.currentStateVersion)) ? Math.max(0, Math.floor(Number(value.currentStateVersion))) : 0,
        currentState: normalizeCharacterEvolutionState(value.currentState),
        pendingProposal: value.pendingProposal && typeof value.pendingProposal === 'object'
            ? {
                proposalId: toTrimmedString(value.pendingProposal.proposalId),
                sourceChatId: toTrimmedString(value.pendingProposal.sourceChatId),
                proposedState: normalizeCharacterEvolutionState(value.pendingProposal.proposedState),
                changes: Array.isArray(value.pendingProposal.changes)
                    ? value.pendingProposal.changes
                        .map((change) => {
                            if (!change || typeof change !== 'object') return null;
                            const sectionKey = toTrimmedString(change.sectionKey);
                            if (!sectionKey) return null;
                            return {
                                sectionKey,
                                summary: toTrimmedString(change.summary),
                                evidence: normalizeStringList(change.evidence),
                            };
                        })
                        .filter(Boolean)
                    : [],
                createdAt: Number.isFinite(Number(value.pendingProposal.createdAt)) ? Number(value.pendingProposal.createdAt) : 0,
            }
            : null,
        lastProcessedChatId: toTrimmedString(value.lastProcessedChatId) || null,
        stateVersions: Array.isArray(value.stateVersions)
            ? value.stateVersions
                .map((entry) => {
                    if (!entry || typeof entry !== 'object') return null;
                    const version = Number(entry.version);
                    if (!Number.isFinite(version)) return null;
                    return {
                        version: Math.max(0, Math.floor(version)),
                        chatId: toTrimmedString(entry.chatId) || null,
                        acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    };
                })
                .filter(Boolean)
            : [],
    };
}

function getEffectiveCharacterEvolutionSettings(settings, character) {
    const defaults = normalizeCharacterEvolutionDefaults(settings?.characterEvolutionDefaults);
    const evolution = normalizeCharacterEvolutionSettings(character?.characterEvolution);
    if (!evolution.useGlobalDefaults) {
        return evolution;
    }
    return {
        ...evolution,
        extractionProvider: defaults.extractionProvider,
        extractionModel: defaults.extractionModel,
        extractionMaxTokens: defaults.extractionMaxTokens,
        extractionPrompt: defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(defaults.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(defaults.privacy),
    };
}

module.exports = {
    getEffectiveCharacterEvolutionSettings,
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionPrivacy,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
};
