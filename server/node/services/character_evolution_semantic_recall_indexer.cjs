const { cosineSimilarity } = require('../memory/similarity.cjs');
const { generateEmbeddings } = require('../rag/embedding.cjs');
const {
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
} = require('../llm/character_evolution.cjs');
const {
    BUILTIN_SECTION_DEFS,
} = require('../llm/character_evolution/schema.cjs');
const {
    CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS,
} = require('../llm/character_evolution/render.cjs');
const {
    doCharacterEvolutionItemsMatch,
    doCharacterEvolutionItemsReinforceSameIdea,
    getCharacterEvolutionItemNormalizedMatchKey,
    mintLegacyCharacterEvolutionItemId,
} = require('../llm/character_evolution/items.cjs');
const {
    resolveCharacterEvolutionSectionConflicts,
} = require('../llm/character_evolution/conflicts.cjs');
const {
    createCharacterEvolutionHistoryResolver,
} = require('./character_evolution_history_resolver.cjs');
const {
    createCharacterEvolutionVersionStore,
} = require('./character_evolution_version_store.cjs');
const {
    createCharacterEvolutionSemanticRecallRepository,
} = require('./character_evolution_semantic_recall_repository.cjs');

const SECTION_LABEL_BY_KEY = Object.fromEntries(
    BUILTIN_SECTION_DEFS.map((section) => [section.key, section.label])
);

const CONFIDENCE_BONUS = {
    suspected: 0,
    likely: 0.008,
    confirmed: 0.015,
};

const DEFAULT_PER_SECTION_SOFT_CAP = 2;
const SEMANTIC_RECALL_BLOCK_TO_SECTION_KEYS = {
    semanticRecallCharacterState: CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS.characterState,
    semanticRecallUserState: CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS.userState,
    semanticRecallRelationshipState: CHARACTER_EVOLUTION_PROMPT_BLOCK_SECTION_KEYS.relationshipState,
};
const SEMANTIC_RECALL_BLOCK_ROOT_TAG = {
    semanticRecallCharacterState: 'CharacterRecall',
    semanticRecallUserState: 'UserRecall',
    semanticRecallRelationshipState: 'RelationshipRecall',
};

function createCharacterEvolutionSemanticRecallService(arg = {}) {
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const repository = arg.repository || createCharacterEvolutionSemanticRecallRepository({
        fs,
        existsSync,
    });
    const historyResolver = arg.historyResolver || createCharacterEvolutionHistoryResolver({
        normalizeCharacterEvolutionState,
        normalizeCharacterEvolutionRangeRef: require('../llm/character_evolution/range.cjs').normalizeCharacterEvolutionRangeRef,
    });
    const versionStore = arg.versionStore || createCharacterEvolutionVersionStore({
        fs,
        existsSync,
    });
    const embed = typeof arg.generateEmbeddings === 'function'
        ? arg.generateEmbeddings
        : generateEmbeddings;

    function toTrimmedString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function getEnabledSectionKeys(settings) {
        const sectionFlags = settings?.sections && typeof settings.sections === 'object'
            ? settings.sections
            : {};
        return Object.entries(sectionFlags)
            .filter(([, enabled]) => enabled === true)
            .map(([key]) => key)
            .sort();
    }

    function getConfiguredSectionLimit(settings, sectionKey) {
        const raw = Number(settings?.sectionLimits?.[sectionKey]);
        return Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    }

    function getErrorMessage(error) {
        if (error && typeof error === 'object' && typeof error.message === 'string' && error.message.trim()) {
            return error.message.trim();
        }
        const fallback = toTrimmedString(error);
        return fallback || 'Unknown semantic recall error.';
    }

    function isNewerSnapshot(candidate, current) {
        const candidateVersion = Number(candidate?.snapshotVersion) || 0;
        const currentVersion = Number(current?.snapshotVersion) || 0;
        if (candidateVersion !== currentVersion) {
            return candidateVersion > currentVersion;
        }
        return (Number(candidate?.acceptedAt) || 0) >= (Number(current?.acceptedAt) || 0);
    }

    function buildEmbeddingText(sectionKey, item) {
        const label = SECTION_LABEL_BY_KEY[sectionKey] || sectionKey;
        const value = toTrimmedString(item?.value);
        const note = toTrimmedString(item?.note);
        if (note && note.length <= 120) {
            return `${label}: ${value} Note: ${note}`;
        }
        return `${label}: ${value}`;
    }

    function buildHistorySignature(readableVersions) {
        return JSON.stringify(
            (Array.isArray(readableVersions) ? readableVersions : []).map((entry) => ({
                version: Number(entry?.version) || 0,
                chatId: toTrimmedString(entry?.chatId) || null,
                acceptedAt: Number(entry?.acceptedAt) || 0,
                range: entry?.range
                    ? {
                        chatId: toTrimmedString(entry.range.chatId),
                        startMessageIndex: Number(entry.range.startMessageIndex) || 0,
                        endMessageIndex: Number(entry.range.endMessageIndex) || 0,
                    }
                    : null,
            }))
        );
    }

    function buildCurrentArchivedSignature(state, enabledSections) {
        const normalizedState = normalizeCharacterEvolutionState(state);
        return JSON.stringify(enabledSections.map((sectionKey) => ({
            sectionKey,
            items: (Array.isArray(normalizedState?.[sectionKey]) ? normalizedState[sectionKey] : [])
                .filter((item) => (item?.status || 'active') === 'archived')
                .map((item) => ({
                    id: toTrimmedString(item?.id),
                    value: toTrimmedString(item?.value),
                    note: toTrimmedString(item?.note),
                    confidence: toTrimmedString(item?.confidence),
                    sourceChatId: toTrimmedString(item?.sourceChatId),
                    sourceRange: item?.sourceRange
                        ? {
                            startMessageIndex: Number(item.sourceRange.startMessageIndex) || 0,
                            endMessageIndex: Number(item.sourceRange.endMessageIndex) || 0,
                        }
                        : null,
                    lastSeenVersion: Number(item?.lastSeenVersion) || 0,
                    updatedAt: Number(item?.updatedAt) || 0,
                })),
        })));
    }

    function buildSettingsSignature(settings) {
        return JSON.stringify({
            embeddingModel: toTrimmedString(settings?.embeddingModel) || 'MiniLM',
            enabledSections: getEnabledSectionKeys(settings),
        });
    }

    function buildStoredMessageForSimilarity(message) {
        if (!message || typeof message !== 'object') return null;
        const rawRole = String(message.role || '').toLowerCase();
        const content = typeof message.data === 'string'
            ? message.data.trim()
            : (typeof message.content === 'string' ? message.content.trim() : '');
        if (!content) return null;
        if (rawRole === 'user' || rawRole === 'human') {
            return { role: 'user', content };
        }
        if (rawRole === 'char' || rawRole === 'assistant' || rawRole === 'bot' || rawRole === 'model') {
            return { role: 'assistant', content };
        }
        if (rawRole === 'system' || rawRole === 'developer') {
            return { role: 'system', content };
        }
        return null;
    }

    function buildQueryText(chat, queryMessageWindow) {
        const source = Array.isArray(chat?.message) ? chat.message : [];
        const converted = source
            .slice(-8)
            .map(buildStoredMessageForSimilarity)
            .filter((msg) => msg && typeof msg.content === 'string' && msg.content.trim().length > 0);
        if (converted.length === 0) {
            return '';
        }
        return converted
            .slice(-Math.max(1, Math.floor(Number(queryMessageWindow) || 4)))
            .map((msg) => `${msg.role}: ${msg.content}`)
            .join('\n')
            .trim();
    }

    function resolveSourceChatId(item, versionMeta) {
        const itemChatId = toTrimmedString(item?.sourceChatId);
        if (itemChatId) return itemChatId;
        const versionChatId = toTrimmedString(versionMeta?.chatId);
        if (versionChatId) return versionChatId;
        const rangeChatId = toTrimmedString(versionMeta?.range?.chatId);
        if (rangeChatId) return rangeChatId;
        return '';
    }

    async function readVersionPayload(characterDir, evolution, versionMeta) {
        const version = Number(versionMeta?.version) || 0;
        const versionPath = await versionStore.resolveVersionFilePath(characterDir, version, {
            allowStaged: version > 0 && version <= (Number(evolution?.currentStateVersion) || 0),
        });
        if (!versionPath) {
            return historyResolver.buildSyntheticCurrentVersionPayload(evolution, version);
        }
        return JSON.parse(await fs.readFile(versionPath, 'utf-8'));
    }

    function createBuildSignature(evolution, readableVersions, settings) {
        const enabledSections = getEnabledSectionKeys(settings);
        return {
            history: buildHistorySignature(readableVersions),
            currentArchived: buildCurrentArchivedSignature(evolution?.currentState, enabledSections),
            settings: buildSettingsSignature(settings),
        };
    }

    function isIndexStale(index, signature, settings, dirtyMeta) {
        if (!index) {
            return 'no_index';
        }
        if (dirtyMeta) {
            return 'dirty';
        }
        if (toTrimmedString(index.embeddingModel) !== (toTrimmedString(settings?.embeddingModel) || 'MiniLM')) {
            return 'model_mismatch';
        }
        if (index?.buildSignature?.settings !== signature.settings) {
            return 'settings_changed';
        }
        if (index?.buildSignature?.history !== signature.history) {
            return 'history_changed';
        }
        if (index?.buildSignature?.currentArchived !== signature.currentArchived) {
            return 'current_state_changed';
        }
        return '';
    }

    function getLegacyRegistryBucket(registry, sectionKey, chatId) {
        const key = `${sectionKey}::${chatId}`;
        if (!registry.has(key)) {
            registry.set(key, []);
        }
        return registry.get(key);
    }

    function resolveLegacyItemId(registry, sectionKey, resolvedChatId, item, version, sourceRange) {
        if (toTrimmedString(item?.id)) {
            return item.id.trim();
        }
        const bucket = getLegacyRegistryBucket(registry, sectionKey, resolvedChatId);
        const matched = bucket.find((entry) =>
            doCharacterEvolutionItemsMatch(entry.item, item)
            || doCharacterEvolutionItemsReinforceSameIdea(sectionKey, entry.item, item)
        );
        if (matched) {
            return matched.itemId;
        }
        const mintedId = mintLegacyCharacterEvolutionItemId({
            sectionKey,
            resolvedChatId,
            item,
            firstSeenVersion: version,
            sourceRange,
        });
        bucket.push({
            itemId: mintedId,
            item: {
                ...item,
                id: mintedId,
            },
        });
        return mintedId;
    }

    async function rebuildIndex(arg = {}) {
        const characterId = toTrimmedString(arg.characterId);
        const chatId = toTrimmedString(arg.chatId);
        const characterDir = arg.characterDir;
        const character = arg.character || {};
        const settingsRaw = arg.settings || {};
        const defaults = normalizeCharacterEvolutionDefaults(settingsRaw.characterEvolutionDefaults);
        const semanticSettings = defaults.semanticRecall || {};
        const enabledSections = getEnabledSectionKeys(semanticSettings);
        const evolution = historyResolver.reconcileEvolution(
            normalizeCharacterEvolutionSettings(character.characterEvolution),
            await versionStore.readVersionMetasFromDisk(characterDir, {
                includeStagedThroughVersion: Number(character?.characterEvolution?.currentStateVersion) || 0,
            })
        );
        const readableVersions = historyResolver.listReadableVersionMetas(evolution, evolution.stateVersions);
        const latestByItemId = new Map();
        const legacyRegistry = new Map();

        for (const versionMeta of readableVersions) {
            const payload = await readVersionPayload(characterDir, evolution, versionMeta);
            const state = normalizeCharacterEvolutionState(payload?.state);
            for (const sectionKey of enabledSections) {
                const sectionItems = Array.isArray(state?.[sectionKey]) ? state[sectionKey] : [];
                for (const item of sectionItems) {
                    const resolvedChatId = resolveSourceChatId(item, versionMeta);
                    if (!resolvedChatId || resolvedChatId !== chatId) {
                        continue;
                    }
                    const status = toTrimmedString(item?.status) || 'active';
                    const itemId = resolveLegacyItemId(
                        legacyRegistry,
                        sectionKey,
                        resolvedChatId,
                        item,
                        Number(versionMeta?.version) || 1,
                        item?.sourceRange
                    );
                    const nextSnapshot = {
                        itemId,
                        sectionKey,
                        status,
                        value: toTrimmedString(item?.value),
                        note: toTrimmedString(item?.note) || undefined,
                        confidence: toTrimmedString(item?.confidence) || undefined,
                        sourceChatId: resolvedChatId,
                        sourceRange: item?.sourceRange
                            ? {
                                startMessageIndex: Number(item.sourceRange.startMessageIndex) || 0,
                                endMessageIndex: Number(item.sourceRange.endMessageIndex) || 0,
                            }
                            : undefined,
                        snapshotVersion: Number(versionMeta?.version) || 0,
                        acceptedAt: Number(versionMeta?.acceptedAt) || 0,
                        embeddingText: status === 'archived'
                            ? buildEmbeddingText(sectionKey, item)
                            : '',
                    };
                    const currentSnapshot = latestByItemId.get(itemId);
                    if (!currentSnapshot || isNewerSnapshot(nextSnapshot, currentSnapshot)) {
                        latestByItemId.set(itemId, nextSnapshot);
                    }
                }
            }
        }

        const itemsForEmbedding = [...latestByItemId.values()]
            .filter((item) => item.status === 'archived');
        const vectors = itemsForEmbedding.length > 0
            ? await embed(itemsForEmbedding.map((item) => item.embeddingText), semanticSettings.embeddingModel || 'MiniLM')
            : [];
        const signature = createBuildSignature(evolution, readableVersions, semanticSettings);
        const payload = {
            version: 1,
            characterId,
            chatId,
            embeddingModel: semanticSettings.embeddingModel || 'MiniLM',
            generatedAt: Date.now(),
            buildSignature: signature,
            items: itemsForEmbedding.map((item, index) => ({
                itemId: item.itemId,
                sectionKey: item.sectionKey,
                status: 'archived',
                value: item.value,
                ...(item.note ? { note: item.note } : {}),
                ...(item.confidence ? { confidence: item.confidence } : {}),
                sourceChatId: item.sourceChatId,
                ...(item.sourceRange ? { sourceRange: item.sourceRange } : {}),
                snapshotVersion: item.snapshotVersion,
                acceptedAt: item.acceptedAt,
                embedding: Array.isArray(vectors[index]) ? vectors[index] : [],
            })),
        };
        await repository.writeIndex(characterDir, chatId, payload);
        await repository.clearDirty(characterDir, chatId);
        return {
            index: payload,
            rebuildReason: 'rebuilt',
        };
    }

    async function ensureFreshIndex(arg = {}) {
        const characterDir = arg.characterDir;
        const character = arg.character || {};
        const settingsRaw = arg.settings || {};
        const chatId = toTrimmedString(arg.chatId);
        const defaults = normalizeCharacterEvolutionDefaults(settingsRaw.characterEvolutionDefaults);
        const semanticSettings = defaults.semanticRecall || {};
        const evolution = historyResolver.reconcileEvolution(
            normalizeCharacterEvolutionSettings(character.characterEvolution),
            await versionStore.readVersionMetasFromDisk(characterDir, {
                includeStagedThroughVersion: Number(character?.characterEvolution?.currentStateVersion) || 0,
            })
        );
        const readableVersions = historyResolver.listReadableVersionMetas(evolution, evolution.stateVersions);
        const signature = createBuildSignature(evolution, readableVersions, semanticSettings);
        const index = await repository.readIndex(characterDir, chatId);
        const meta = await repository.readMeta(characterDir);
        const staleReason = isIndexStale(index, signature, semanticSettings, meta?.dirtyChats?.[chatId]);
        if (staleReason) {
            const rebuilt = await rebuildIndex({
                ...arg,
                character,
                settings: settingsRaw,
                chatId,
            });
            return {
                index: rebuilt.index,
                rebuildReason: staleReason,
            };
        }
        return {
            index,
            rebuildReason: '',
        };
    }

    function detectActiveCanonSuppression(sectionKey, activeItems, candidate) {
        const activeList = (Array.isArray(activeItems) ? activeItems : [])
            .filter((item) => (item?.status || 'active') === 'active');
        if (activeList.some((item) => doCharacterEvolutionItemsMatch(item, candidate))) {
            return 'active_match';
        }
        if (activeList.some((item) => doCharacterEvolutionItemsReinforceSameIdea(sectionKey, item, candidate))) {
            return 'active_reinforcement';
        }
        const resolved = resolveCharacterEvolutionSectionConflicts({
            sectionKey,
            currentItems: activeList,
            proposedItems: [{
                id: candidate.itemId,
                value: candidate.value,
                ...(candidate.note ? { note: candidate.note } : {}),
                ...(candidate.confidence ? { confidence: candidate.confidence } : {}),
                status: 'active',
            }],
        });
        const currentCanonChanged = activeList.some((currentItem) => {
            const matchingResolved = resolved.find((item) => doCharacterEvolutionItemsMatch(item, currentItem));
            return !matchingResolved || (matchingResolved.status || 'active') !== 'active';
        });
        if (currentCanonChanged) {
            return 'active_conflict';
        }
        const surviving = resolved.some((item) =>
            (item?.status || 'active') === 'active'
            && doCharacterEvolutionItemsMatch(item, candidate.value)
        );
        return surviving ? '' : 'active_conflict';
    }

    function renderSemanticRecallBlock(groupedItems, rootTag = 'SemanticRecall') {
        const sectionKeys = Object.keys(groupedItems);
        if (sectionKeys.length === 0) {
            return '';
        }
        const lines = [`<${rootTag}>`];
        for (const sectionKey of sectionKeys) {
            const tagName = `Semantic${sectionKey.charAt(0).toUpperCase()}${sectionKey.slice(1)}`;
            lines.push(`<${tagName}>`);
            for (const item of groupedItems[sectionKey]) {
                lines.push(`- ${item.value}${item.confidence ? ` [${item.confidence}]` : ''}`);
            }
            lines.push(`</${tagName}>`);
            lines.push('');
        }
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        lines.push(`</${rootTag}>`);
        return lines.join('\n');
    }

    async function buildPromptBlock(arg = {}) {
        const characterId = toTrimmedString(arg.characterId);
        const chatId = toTrimmedString(arg.chatId || arg.chat?.id);
        const characterDir = arg.characterDir;
        const character = arg.character || {};
        const settingsRaw = arg.settings || {};
        const defaults = normalizeCharacterEvolutionDefaults(settingsRaw.characterEvolutionDefaults);
        const semanticSettings = defaults.semanticRecall || {};
        const enabledSections = getEnabledSectionKeys(semanticSettings);
        if (semanticSettings.enabled !== true) {
            return { skippedReason: 'disabled' };
        }
        if (!chatId) {
            return { skippedReason: 'no_chat_id' };
        }
        if (enabledSections.length === 0) {
            return { skippedReason: 'no_enabled_sections' };
        }

        let index = null;
        let rebuildReason = '';
        try {
            const ensured = await ensureFreshIndex({
                characterId,
                chatId,
                characterDir,
                character,
                settings: settingsRaw,
            });
            index = ensured.index;
            rebuildReason = ensured.rebuildReason;
        } catch (error) {
            return {
                skippedReason: 'rebuild_failed',
                metadata: {
                    error: getErrorMessage(error),
                },
            };
        }
        if (!index || !Array.isArray(index.items) || index.items.length === 0) {
            return {
                skippedReason: rebuildReason ? `no_index_items:${rebuildReason}` : 'no_index_items',
            };
        }

        const queryText = buildQueryText(arg.chat || {}, semanticSettings.queryMessageWindow);
        if (!queryText) {
            return { skippedReason: 'no_query_text' };
        }
        let queryVectors = null;
        try {
            queryVectors = await embed([queryText], semanticSettings.embeddingModel || 'MiniLM');
        } catch (error) {
            return {
                skippedReason: 'query_embedding_failed',
                metadata: {
                    queryText,
                    rebuildReason,
                    error: getErrorMessage(error),
                },
            };
        }
        const queryEmbedding = Array.isArray(queryVectors) ? queryVectors[0] : null;
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
            return { skippedReason: 'no_query_embedding' };
        }

        const activeState = normalizeCharacterEvolutionState(character?.characterEvolution?.currentState);
        const scored = [];
        const suppressed = [];
        for (const item of index.items) {
            if (!item || typeof item !== 'object') continue;
            if (!enabledSections.includes(item.sectionKey)) continue;
            const similarity = cosineSimilarity(queryEmbedding, item.embedding);
            if (similarity < Number(semanticSettings.minScore || 0)) {
                suppressed.push({
                    sectionKey: item.sectionKey,
                    itemId: item.itemId,
                    similarity,
                    snapshotVersion: item.snapshotVersion,
                    sourceChatId: item.sourceChatId,
                    outcome: 'below_min_score',
                });
                continue;
            }
            const suppression = detectActiveCanonSuppression(item.sectionKey, activeState?.[item.sectionKey], item);
            if (suppression) {
                suppressed.push({
                    sectionKey: item.sectionKey,
                    itemId: item.itemId,
                    similarity,
                    snapshotVersion: item.snapshotVersion,
                    sourceChatId: item.sourceChatId,
                    outcome: suppression,
                });
                continue;
            }
            scored.push({
                ...item,
                similarity,
                rankingScore: similarity + (CONFIDENCE_BONUS[item.confidence] || 0),
            });
        }

        scored.sort((left, right) => {
            if (right.rankingScore !== left.rankingScore) {
                return right.rankingScore - left.rankingScore;
            }
            if ((right.snapshotVersion || 0) !== (left.snapshotVersion || 0)) {
                return (right.snapshotVersion || 0) - (left.snapshotVersion || 0);
            }
            return (right.acceptedAt || 0) - (left.acceptedAt || 0);
        });

        const maxItems = Math.max(1, Number(semanticSettings.maxItems) || 3);
        const selected = [];
        const sectionCounts = new Map();
        const seenItemIds = new Set();
        const seenSectionValues = new Set();
        const leftovers = [];

        for (const item of scored) {
            if (seenItemIds.has(item.itemId)) {
                suppressed.push({
                    sectionKey: item.sectionKey,
                    itemId: item.itemId,
                    similarity: item.similarity,
                    snapshotVersion: item.snapshotVersion,
                    sourceChatId: item.sourceChatId,
                    outcome: 'duplicate_item_id',
                });
                continue;
            }
            const repeatedValueKey = `${item.sectionKey}::${getCharacterEvolutionItemNormalizedMatchKey(item.value)}`;
            if (seenSectionValues.has(repeatedValueKey)) {
                suppressed.push({
                    sectionKey: item.sectionKey,
                    itemId: item.itemId,
                    similarity: item.similarity,
                    snapshotVersion: item.snapshotVersion,
                    sourceChatId: item.sourceChatId,
                    outcome: 'duplicate_section_value',
                });
                continue;
            }
            const configuredSectionLimit = getConfiguredSectionLimit(semanticSettings, item.sectionKey);
            const firstPassLimit = configuredSectionLimit > 0
                ? configuredSectionLimit
                : DEFAULT_PER_SECTION_SOFT_CAP;
            if ((sectionCounts.get(item.sectionKey) || 0) >= firstPassLimit) {
                leftovers.push(item);
                continue;
            }
            selected.push(item);
            seenItemIds.add(item.itemId);
            seenSectionValues.add(repeatedValueKey);
            sectionCounts.set(item.sectionKey, (sectionCounts.get(item.sectionKey) || 0) + 1);
            if (selected.length >= maxItems) {
                break;
            }
        }

        if (selected.length < maxItems) {
            for (const item of leftovers) {
                if (selected.length >= maxItems) break;
                const repeatedValueKey = `${item.sectionKey}::${getCharacterEvolutionItemNormalizedMatchKey(item.value)}`;
                if (seenItemIds.has(item.itemId) || seenSectionValues.has(repeatedValueKey)) {
                    continue;
                }
                const configuredSectionLimit = getConfiguredSectionLimit(semanticSettings, item.sectionKey);
                if (configuredSectionLimit > 0 && (sectionCounts.get(item.sectionKey) || 0) >= configuredSectionLimit) {
                    suppressed.push({
                        sectionKey: item.sectionKey,
                        itemId: item.itemId,
                        similarity: item.similarity,
                        snapshotVersion: item.snapshotVersion,
                        sourceChatId: item.sourceChatId,
                        outcome: 'section_limit',
                    });
                    continue;
                }
                selected.push(item);
                seenItemIds.add(item.itemId);
                seenSectionValues.add(repeatedValueKey);
                sectionCounts.set(item.sectionKey, (sectionCounts.get(item.sectionKey) || 0) + 1);
            }
        }

        if (selected.length === 0) {
            return {
                skippedReason: 'no_recalled_items',
                metadata: {
                    queryText,
                    rebuildReason,
                    recalledItems: [],
                    suppressedCandidates: suppressed,
                },
            };
        }

        const grouped = {};
        for (const item of selected) {
            if (!grouped[item.sectionKey]) {
                grouped[item.sectionKey] = [];
            }
            grouped[item.sectionKey].push(item);
        }

        const contentByBlock = {};
        for (const [blockType, allowedSectionKeys] of Object.entries(SEMANTIC_RECALL_BLOCK_TO_SECTION_KEYS)) {
            const groupedForBlock = {};
            for (const sectionKey of allowedSectionKeys) {
                if (Array.isArray(grouped[sectionKey]) && grouped[sectionKey].length > 0) {
                    groupedForBlock[sectionKey] = grouped[sectionKey];
                }
            }
            const rendered = renderSemanticRecallBlock(groupedForBlock, SEMANTIC_RECALL_BLOCK_ROOT_TAG[blockType]);
            if (rendered) {
                contentByBlock[blockType] = rendered;
            }
        }

        return {
            contentByBlock,
            metadata: {
                queryText,
                rebuildReason,
                recalledItems: selected.map((item) => ({
                    sectionKey: item.sectionKey,
                    itemId: item.itemId,
                    similarity: item.similarity,
                    snapshotVersion: item.snapshotVersion,
                    sourceChatId: item.sourceChatId,
                })),
                suppressedCandidates: suppressed,
            },
        };
    }

    async function markDirtyChat(arg = {}) {
        const characterDir = arg.characterDir;
        const chatId = toTrimmedString(arg.chatId);
        if (!characterDir || !chatId) return;
        await repository.markDirty(characterDir, chatId, toTrimmedString(arg.reason) || 'changed');
    }

    async function markDirtyChats(arg = {}) {
        const characterDir = arg.characterDir;
        const chatIds = Array.isArray(arg.chatIds) ? arg.chatIds : [];
        if (!characterDir || chatIds.length === 0) return;
        await repository.markDirtyMany(characterDir, chatIds, toTrimmedString(arg.reason) || 'changed');
    }

    return {
        buildPromptBlock,
        ensureFreshIndex,
        markDirtyChat,
        markDirtyChats,
        rebuildIndex,
        repository,
    };
}

module.exports = {
    createCharacterEvolutionSemanticRecallService,
};
