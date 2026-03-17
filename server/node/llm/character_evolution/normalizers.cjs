const {
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSemanticRecallSettings,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
    CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS,
    isBuiltinExtractionPrompt,
    isBuiltinSectionInstruction,
    normalizeCharacterEvolutionExtractionModel,
} = require('./schema.cjs');
const { normalizeCharacterEvolutionItemSourceRange } = require('./items.cjs');
const { normalizeCharacterEvolutionPromptProjectionPolicy } = require('./projection_policy.cjs');
const { normalizeCharacterEvolutionRetentionPolicy } = require('./retention_policy.cjs');
const { normalizeCharacterEvolutionRangeRef } = require('./range.cjs');
const { toTrimmedString } = require('./utils.cjs');

function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') {
        if (typeof raw === 'string' && raw.trim()) {
            return { value: raw.trim(), status: 'active' };
        }
        return null;
    }
    const value = toTrimmedString(raw.value);
    const note = Object.prototype.hasOwnProperty.call(raw, 'note') && typeof raw.note === 'string'
        ? toTrimmedString(raw.note)
        : undefined;
    if (!value) return null;
    return {
        id: toTrimmedString(raw.id) || undefined,
        value,
        confidence: raw.confidence === 'suspected' || raw.confidence === 'likely' || raw.confidence === 'confirmed'
            ? raw.confidence
            : undefined,
        ...(note !== undefined ? { note } : {}),
        status: raw.status === 'archived' || raw.status === 'corrected' || raw.status === 'active'
            ? raw.status
            : 'active',
        sourceChatId: toTrimmedString(raw.sourceChatId) || undefined,
        sourceRange: normalizeCharacterEvolutionItemSourceRange(raw.sourceRange),
        updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : undefined,
        lastSeenAt: Number.isFinite(Number(raw.lastSeenAt)) ? Number(raw.lastSeenAt) : undefined,
        lastSeenVersion: Number.isFinite(Number(raw.lastSeenVersion)) && Number(raw.lastSeenVersion) > 0
            ? Math.max(1, Math.floor(Number(raw.lastSeenVersion)))
            : undefined,
        timesSeen: Number.isFinite(Number(raw.timesSeen)) && Number(raw.timesSeen) > 0
            ? Math.max(1, Math.floor(Number(raw.timesSeen)))
            : undefined,
        unseenAcceptedHandoffs: Number.isFinite(Number(raw.unseenAcceptedHandoffs)) && Number(raw.unseenAcceptedHandoffs) >= 0
            ? Math.max(0, Math.floor(Number(raw.unseenAcceptedHandoffs)))
            : undefined,
    };
}

function normalizeCharacterEvolutionSemanticRecallSettings(raw) {
    const defaults = createDefaultCharacterEvolutionSemanticRecallSettings();
    const value = (raw && typeof raw === 'object') ? raw : {};
    const sectionsRaw = (value.sections && typeof value.sections === 'object') ? value.sections : {};
    const sections = Object.fromEntries(
        CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS.map((key) => [
            key,
            sectionsRaw[key] === undefined ? defaults.sections[key] : sectionsRaw[key] === true,
        ])
    );
    const sectionLimitsRaw = (value.sectionLimits && typeof value.sectionLimits === 'object') ? value.sectionLimits : {};
    const sectionLimits = Object.fromEntries(
        CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS.map((key) => {
            const parsed = Number(sectionLimitsRaw[key]);
            return [
                key,
                Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : defaults.sectionLimits[key],
            ];
        })
    );
    const minScore = Number(value.minScore);
    const maxItems = Number(value.maxItems);
    const queryMessageWindow = Number(value.queryMessageWindow);
    return {
        enabled: value.enabled === true,
        embeddingModel: toTrimmedString(value.embeddingModel) || defaults.embeddingModel,
        minScore: Number.isFinite(minScore) ? Math.max(0, Math.min(1, minScore)) : defaults.minScore,
        maxItems: Number.isFinite(maxItems) ? Math.max(1, Math.floor(maxItems)) : defaults.maxItems,
        queryMessageWindow: Number.isFinite(queryMessageWindow) ? Math.max(1, Math.floor(queryMessageWindow)) : defaults.queryMessageWindow,
        sections,
        sectionLimits,
    };
}

function normalizeSectionConfigKey(keyRaw) {
    const key = toTrimmedString(keyRaw);
    return key === 'lastChatEnded' ? 'lastInteractionEnded' : key;
}

function normalizeExtractionPrompt(promptRaw) {
    const prompt = toTrimmedString(promptRaw);
    if (!prompt) return '';
    if (isBuiltinExtractionPrompt(prompt)) return '';
    return prompt;
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
    const lastInteractionEndedRaw = value.lastInteractionEnded && typeof value.lastInteractionEnded === 'object'
        ? value.lastInteractionEnded
        : value.lastChatEnded;
    state.relationship = {
        trustLevel: toTrimmedString(value.relationship?.trustLevel),
        dynamic: toTrimmedString(value.relationship?.dynamic),
    };
    state.activeThreads = normalizeItemList(value.activeThreads);
    state.runningJokes = normalizeItemList(value.runningJokes);
    state.characterLikes = normalizeItemList(value.characterLikes);
    state.characterDislikes = normalizeItemList(value.characterDislikes);
    state.characterHabits = [
        ...normalizeItemList(value.characterHabits),
        ...normalizeItemList(value.characterBoundariesPreferences),
    ];
    state.userFacts = normalizeItemList(value.userFacts);
    state.userRead = normalizeItemList(value.userRead);
    state.userLikes = normalizeItemList(value.userLikes);
    state.userDislikes = normalizeItemList(value.userDislikes);
    state.lastInteractionEnded = {
        state: toTrimmedString(lastInteractionEndedRaw?.state),
        residue: toTrimmedString(lastInteractionEndedRaw?.residue),
    };
    state.keyMoments = normalizeItemList(value.keyMoments);
    state.characterIntimatePreferences = normalizeItemList(value.characterIntimatePreferences);
    state.userIntimatePreferences = normalizeItemList(value.userIntimatePreferences);
    return state;
}

function normalizeCharacterEvolutionProposalState(raw) {
    const value = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
    const defaults = createDefaultCharacterEvolutionState();
    const proposalState = {};

    for (const key of Object.keys(defaults)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
        if (key === 'relationship') {
            const relationshipRaw = value.relationship;
            const relationshipState = {};
            if (relationshipRaw && typeof relationshipRaw === 'object' && !Array.isArray(relationshipRaw)) {
                if (Object.prototype.hasOwnProperty.call(relationshipRaw, 'trustLevel')) {
                    relationshipState.trustLevel = toTrimmedString(relationshipRaw.trustLevel);
                }
                if (Object.prototype.hasOwnProperty.call(relationshipRaw, 'dynamic')) {
                    relationshipState.dynamic = toTrimmedString(relationshipRaw.dynamic);
                }
            }
            proposalState[key] = relationshipState;
            continue;
        }
        proposalState[key] = normalizeCharacterEvolutionState({ [key]: value[key] })[key];
    }

    if (
        !Object.prototype.hasOwnProperty.call(proposalState, 'lastInteractionEnded')
        && Object.prototype.hasOwnProperty.call(value, 'lastChatEnded')
    ) {
        proposalState.lastInteractionEnded = normalizeCharacterEvolutionState({
            lastChatEnded: value.lastChatEnded,
        }).lastInteractionEnded;
    }

    return proposalState;
}

function normalizeCharacterEvolutionSectionConfigs(raw) {
    const defaults = createDefaultCharacterEvolutionSectionConfigs();
    const rawSections = Array.isArray(raw) ? raw : [];
    const rawMap = new Map();
    for (const section of rawSections) {
        if (!section || typeof section !== 'object') continue;
        const key = normalizeSectionConfigKey(section.key);
        if (!key) continue;
        rawMap.set(key, {
            ...section,
            key,
        });
    }
    return defaults.map((section) => {
        const override = rawMap.get(section.key) || {};
        const rawInstruction = toTrimmedString(override.instruction);
        return {
            ...section,
            label: toTrimmedString(override.label) || section.label,
            enabled: override.enabled === undefined ? section.enabled : override.enabled === true,
            includeInPrompt: override.includeInPrompt === undefined ? section.includeInPrompt : override.includeInPrompt === true,
            instruction: (!rawInstruction || isBuiltinSectionInstruction(rawInstruction)) ? '' : rawInstruction,
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
        extractionPrompt: normalizeExtractionPrompt(value.extractionPrompt),
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
        promptProjection: normalizeCharacterEvolutionPromptProjectionPolicy(value.promptProjection),
        retention: normalizeCharacterEvolutionRetentionPolicy(value.retention),
        semanticRecall: normalizeCharacterEvolutionSemanticRecallSettings(value.semanticRecall),
    };
}

function normalizeCharacterEvolutionSettings(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    const pendingProposal = value.pendingProposal && typeof value.pendingProposal === 'object'
        ? {
            proposalId: toTrimmedString(value.pendingProposal.proposalId),
            sourceChatId: toTrimmedString(value.pendingProposal.sourceChatId),
            ...(normalizeCharacterEvolutionRangeRef(value.pendingProposal.sourceRange)
                ? { sourceRange: normalizeCharacterEvolutionRangeRef(value.pendingProposal.sourceRange) }
                : {}),
            proposedState: normalizeCharacterEvolutionProposalState(value.pendingProposal.proposedState),
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
        : null;
    const stateVersions = Array.isArray(value.stateVersions)
        ? value.stateVersions
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const version = Number(entry.version);
                if (!Number.isFinite(version)) return null;
                const range = normalizeCharacterEvolutionRangeRef(entry.range);
                return {
                    version: Math.max(0, Math.floor(version)),
                    chatId: toTrimmedString(entry.chatId) || null,
                    acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    ...(range ? { range } : {}),
                };
            })
            .filter(Boolean)
        : [];
    const processedRanges = Array.isArray(value.processedRanges)
        ? value.processedRanges
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const range = normalizeCharacterEvolutionRangeRef(entry.range);
                const version = Number(entry.version);
                if (!range || !Number.isFinite(version)) return null;
                return {
                    version: Math.max(0, Math.floor(version)),
                    acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    range,
                };
            })
            .filter(Boolean)
        : stateVersions
            .filter((entry) => !!entry.range)
            .map((entry) => ({
                version: entry.version,
                acceptedAt: entry.acceptedAt,
                range: entry.range,
            }));
    const lastProcessedMessageIndexByChat = {};
    if (value.lastProcessedMessageIndexByChat && typeof value.lastProcessedMessageIndexByChat === 'object') {
        for (const [chatId, endIndex] of Object.entries(value.lastProcessedMessageIndexByChat)) {
            const numericEndIndex = Number(endIndex);
            if (!chatId || !Number.isFinite(numericEndIndex)) continue;
            lastProcessedMessageIndexByChat[chatId] = Math.max(-1, Math.floor(numericEndIndex));
        }
    }
    for (const entry of processedRanges) {
        lastProcessedMessageIndexByChat[entry.range.chatId] = Math.max(
            lastProcessedMessageIndexByChat[entry.range.chatId] ?? -1,
            entry.range.endMessageIndex
        );
    }

    return {
        enabled: value.enabled === true,
        currentStateVersion: Number.isFinite(Number(value.currentStateVersion)) ? Math.max(0, Math.floor(Number(value.currentStateVersion))) : 0,
        currentState: normalizeCharacterEvolutionState(value.currentState),
        pendingProposal,
        lastProcessedChatId: toTrimmedString(value.lastProcessedChatId) || processedRanges[processedRanges.length - 1]?.range.chatId || null,
        lastProcessedMessageIndexByChat,
        processedRanges,
        stateVersions,
        autoHandoffEnabled: value.autoHandoffEnabled === true,
        autoHandoffBatchSize: Number.isFinite(Number(value.autoHandoffBatchSize)) && Number(value.autoHandoffBatchSize) >= 1
            ? Math.max(1, Math.floor(Number(value.autoHandoffBatchSize)))
            : 10,
        autoHandoffAutoAccept: value.autoHandoffAutoAccept !== false,
    };
}

function getEffectiveCharacterEvolutionSettings(settings, character) {
    const defaults = normalizeCharacterEvolutionDefaults(settings?.characterEvolutionDefaults);
    const evolution = normalizeCharacterEvolutionSettings(character?.characterEvolution);
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
    normalizeCharacterEvolutionProposalState,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
};
