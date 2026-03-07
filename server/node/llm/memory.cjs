const { generateEmbeddings } = require('../rag/embedding.cjs');

function toStringOrEmpty(value) {
    return typeof value === 'string' ? value : '';
}

function safeJsonClone(value, fallback = null) {
    try {
        return value == null ? fallback : JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function clampInt(value, min, max, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const floored = Math.floor(n);
    return Math.min(Math.max(floored, min), max);
}

function getSummaryBatchSize(hypaSettings) {
    const interval = Number(hypaSettings?.periodicSummarizationInterval);
    if (!Number.isFinite(interval) || interval <= 0) return 10;
    return clampInt(interval, 1, 64, 10);
}

function wrapWithXml(tag, content) {
    return `<${tag}>\n${content}\n</${tag}>`;
}

const SUMMARY_HEADING_REGEX = /^\s*Roleplay Scene Summary\s*\n+/i;
const SUMMARY_KEYWORDS_REGEX = /\n+\s*Keywords?\s*:\s*.*$/is;
const MEMORY_PROMPT_TAG = 'Past Events Summary';
const DEFAULT_MAX_SELECTED_SUMMARIES = 6;
const DEFAULT_MAX_PROMPT_CHARS = 8000;
const DEFAULT_SUMMARIZATION_PROMPT = '[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]';

const DEFAULT_HYPAV3_SETTINGS = Object.freeze({
    summarizationModel: 'subModel',
    summarizationPrompt: '',
    reSummarizationPrompt: '',
    summarizationAllowThinking: false,
    memoryTokensRatio: 0.2,
    extraSummarizationRatio: 0,
    maxChatsPerSummary: 6,
    periodicSummarizationEnabled: true,
    periodicSummarizationInterval: 10,
    recentMemoryRatio: 0.4,
    similarMemoryRatio: 0.4,
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

function stripSummaryForPrompt(content) {
    const text = toStringOrEmpty(content);
    if (!text) return '';
    const withoutHeading = text.replace(SUMMARY_HEADING_REGEX, '');
    return withoutHeading.replace(SUMMARY_KEYWORDS_REGEX, '').trim();
}

function parseHypaV3Data(rawData) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        return null;
    }
    if (!Array.isArray(rawData.summaries)) {
        return null;
    }
    return rawData;
}

function normalizeHypaV3Data(rawData) {
    const parsed = parseHypaV3Data(rawData);
    if (!parsed) {
        return {
            summaries: [],
            lastSummarizedMessageIndex: 0,
            metrics: {
                lastImportantSummaries: [],
                lastRecentSummaries: [],
                lastSimilarSummaries: [],
                lastRandomSummaries: [],
            },
        };
    }
    const clone = safeJsonClone(parsed, {});
    if (!Array.isArray(clone.summaries)) clone.summaries = [];
    clone.lastSummarizedMessageIndex = clampInt(
        clone.lastSummarizedMessageIndex,
        0,
        Number.MAX_SAFE_INTEGER,
        0
    );
    if (!clone.metrics || typeof clone.metrics !== 'object') {
        clone.metrics = {
            lastImportantSummaries: [],
            lastRecentSummaries: [],
            lastSimilarSummaries: [],
            lastRandomSummaries: [],
        };
    }
    return clone;
}

function normalizeSummary(summary) {
    if (!summary || typeof summary !== 'object') return null;
    const text = stripSummaryForPrompt(summary.text);
    if (!text) return null;
    const embedding = Array.isArray(summary.embedding)
        ? summary.embedding.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v))
        : null;
    return {
        text,
        isImportant: summary.isImportant === true,
        embedding: embedding && embedding.length > 0 ? embedding : null,
    };
}

function normalizeCharacterPromptOverride(character) {
    if (!character || typeof character !== 'object') {
        return {
            summarizationPrompt: '',
            reSummarizationPrompt: '',
        };
    }
    const raw = character.hypaV3PromptOverride;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            summarizationPrompt: '',
            reSummarizationPrompt: '',
        };
    }
    return {
        summarizationPrompt: toStringOrEmpty(raw.summarizationPrompt),
        reSummarizationPrompt: toStringOrEmpty(raw.reSummarizationPrompt),
    };
}

function resolveHypaV3Settings(settings, character = null) {
    const dbSettings = settings && typeof settings === 'object' ? settings : {};
    const presets = Array.isArray(dbSettings.hypaV3Presets) ? dbSettings.hypaV3Presets : [];
    const presetId = clampInt(dbSettings.hypaV3PresetId, 0, Number.MAX_SAFE_INTEGER, 0);
    const preset = presets[presetId] || presets[0] || null;
    const presetSettings = preset && typeof preset === 'object' && preset.settings && typeof preset.settings === 'object'
        ? preset.settings
        : {};

    const resolved = { ...DEFAULT_HYPAV3_SETTINGS };
    for (const [key, defaultValue] of Object.entries(DEFAULT_HYPAV3_SETTINGS)) {
        const current = presetSettings[key];
        if (typeof current === typeof defaultValue) {
            resolved[key] = current;
        }
    }
    // Current product direction: HypaV3 summaries run on auxiliary model only.
    resolved.summarizationModel = 'subModel';
    // Product behavior: periodic summarization is controlled by interval only.
    // Keep this enabled to avoid legacy presets silently disabling auto-summary.
    resolved.periodicSummarizationEnabled = true;
    const characterOverride = normalizeCharacterPromptOverride(character);
    if (characterOverride.summarizationPrompt.trim()) {
        resolved.summarizationPrompt = characterOverride.summarizationPrompt;
    }
    if (characterOverride.reSummarizationPrompt.trim()) {
        resolved.reSummarizationPrompt = characterOverride.reSummarizationPrompt;
    }
    return resolved;
}

function convertStoredMessageToOpenAI(message) {
    if (!message || typeof message !== 'object') return null;
    if (message.disabled === true) return null;

    const roleRaw = toStringOrEmpty(message.role).toLowerCase();
    const content = toStringOrEmpty(message.data);
    if (!content.trim()) return null;

    let role = null;
    if (roleRaw === 'user' || roleRaw === 'human') {
        role = 'user';
    } else if (roleRaw === 'char' || roleRaw === 'assistant' || roleRaw === 'bot' || roleRaw === 'model') {
        role = 'assistant';
    } else if (roleRaw === 'system' || roleRaw === 'developer') {
        role = 'system';
    } else {
        return null;
    }

    return {
        role,
        content,
        memo: toStringOrEmpty(message.chatId),
        name: toStringOrEmpty(message.name),
    };
}

function buildSummarizationPromptMessages(sourceMessages, promptTemplate) {
    const cleaned = sourceMessages
        .filter((msg) => msg && typeof msg === 'object')
        .map((msg) => `${msg.role}: ${toStringOrEmpty(msg.content)}`.trim())
        .filter(Boolean);
    const strMessages = cleaned.join('\n');
    if (!strMessages) return null;

    const template = toStringOrEmpty(promptTemplate).trim() || DEFAULT_SUMMARIZATION_PROMPT;

    if (template.includes('{{slot}}')) {
        // Template embeds the chat content via {{slot}} — use the combined result
        // as a single user message to avoid duplicating strMessages in both messages.
        const prompt = template.replaceAll('{{slot}}', strMessages);
        return [{ role: 'user', content: prompt }];
    }

    return [
        { role: 'user', content: strMessages },
        { role: 'system', content: template },
    ];
}

function cleanSummaryOutput(summaryText) {
    const text = toStringOrEmpty(summaryText)
        .replace(/<Thoughts>[\s\S]*?<\/Thoughts>/gi, '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
    return text;
}

function resolveSummaryOutputUserName(settings, chat) {
    const personas = Array.isArray(settings?.personas) ? settings.personas : [];
    const boundPersonaId = toStringOrEmpty(chat?.bindedPersona);
    if (boundPersonaId) {
        const persona = personas.find((item) => item && typeof item === 'object' && toStringOrEmpty(item.id) === boundPersonaId);
        const personaName = toStringOrEmpty(persona?.name);
        if (personaName) return personaName;
    }
    return toStringOrEmpty(settings?.username) || 'User';
}

function replaceSummaryOutputVars(text, settings, character, chat) {
    const source = toStringOrEmpty(text);
    if (!source) return '';
    const charName = toStringOrEmpty(character?.nickname) || toStringOrEmpty(character?.name) || 'Character';
    const userName = resolveSummaryOutputUserName(settings, chat);
    return source
        .replace(/<(?:char|bot)>/gi, charName)
        .replace(/<user>/gi, userName)
        .replace(/\{\{\s*char\s*\}\}/gi, charName)
        .replace(/\{\{\s*user\s*\}\}/gi, userName);
}

function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
        return 0;
    }
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
        const av = Number(a[i]) || 0;
        const bv = Number(b[i]) || 0;
        dot += av * bv;
        magA += av * av;
        magB += bv * bv;
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function toApproxTokens(text) {
    const chars = toStringOrEmpty(text).length;
    return Math.max(1, Math.ceil(chars / 4));
}

function buildSimilarityQueryFromChat(chat) {
    const source = Array.isArray(chat?.message) ? chat.message : [];
    const converted = source
        .slice(-8)
        .map(convertStoredMessageToOpenAI)
        .filter((msg) => msg && typeof msg.content === 'string' && msg.content.trim().length > 0);
    if (converted.length === 0) return '';
    return converted
        .slice(-4)
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n')
        .trim();
}

async function generateSummaryEmbedding(summaryText, settings) {
    const text = stripSummaryForPrompt(summaryText);
    if (!text) return null;
    const modelKey = toStringOrEmpty(settings?.hypaModel) || 'MiniLM';
    const vectors = await generateEmbeddings([text], modelKey);
    const vector = Array.isArray(vectors) ? vectors[0] : null;
    if (!Array.isArray(vector) || vector.length === 0) return null;
    return vector;
}

async function getSimilaritySortedIndices(summaries, queryText, settings) {
    if (!queryText) return [];
    const withEmbeddings = [];
    for (let i = 0; i < summaries.length; i++) {
        if (Array.isArray(summaries[i]?.embedding) && summaries[i].embedding.length > 0) {
            withEmbeddings.push(i);
        }
    }
    if (withEmbeddings.length === 0) return [];

    const modelKey = toStringOrEmpty(settings?.hypaModel) || 'MiniLM';
    const queryVectors = await generateEmbeddings([queryText], modelKey);
    const queryEmbedding = Array.isArray(queryVectors) ? queryVectors[0] : null;
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) return [];

    const scored = withEmbeddings.map((idx) => [idx, cosineSimilarity(queryEmbedding, summaries[idx].embedding)]);
    scored.sort((a, b) => b[1] - a[1]);
    return scored.map((v) => v[0]);
}

function planPeriodicHypaV3Summarization(arg = {}) {
    const character = arg.character || {};
    const chat = arg.chat || {};
    const settings = arg.settings || {};
    const messages = Array.isArray(chat.message) ? chat.message : [];

    if (character?.supaMemory !== true) {
        return { shouldRun: false, reason: 'memory_disabled_on_character' };
    }
    if (settings?.hypaV3 !== true) {
        return { shouldRun: false, reason: 'hypav3_disabled_in_settings' };
    }

    const hypaSettings = resolveHypaV3Settings(settings, character);
    const batchSize = getSummaryBatchSize(hypaSettings);
    if (!Number.isFinite(Number(hypaSettings.periodicSummarizationInterval)) || Number(hypaSettings.periodicSummarizationInterval) <= 0) {
        return { shouldRun: false, reason: 'invalid_periodic_interval' };
    }

    const hypaData = normalizeHypaV3Data(chat.hypaV3Data);
    const totalChats = messages.length;
    const lastIndex = clampInt(hypaData.lastSummarizedMessageIndex, 0, totalChats, 0);
    const newMessages = totalChats - lastIndex;
    if (newMessages < batchSize) {
        return { shouldRun: false, reason: 'interval_not_reached', hypaData };
    }

    const sliceStart = Math.max(0, Math.min(lastIndex, totalChats));
    const sliceEnd = Math.max(sliceStart, Math.min(totalChats, sliceStart + batchSize));
    const chunk = messages.slice(sliceStart, sliceEnd);
    const chunkEndIndex = sliceStart + chunk.length;

    const converted = chunk
        .map(convertStoredMessageToOpenAI)
        .filter((msg) => msg && msg.memo !== 'NewChatExample' && msg.memo !== 'NewChat');

    const summarizable = converted.filter((msg) => {
        if (!msg || !msg.content || !msg.content.trim()) return false;
        if (hypaSettings.doNotSummarizeUserMessage && msg.role === 'user') return false;
        if (toStringOrEmpty(msg.name).startsWith('example_')) return false;
        return true;
    });

    if (summarizable.length === 0) {
        return {
            shouldRun: false,
            reason: 'no_summarizable_messages',
            shouldAdvanceIndex: true,
            chunkEndIndex,
            hypaData,
        };
    }

    const promptMessages = buildSummarizationPromptMessages(
        summarizable,
        hypaSettings.summarizationPrompt
    );
    if (!promptMessages) {
        return {
            shouldRun: false,
            reason: 'empty_summarization_prompt_messages',
            shouldAdvanceIndex: true,
            chunkEndIndex,
            hypaData,
        };
    }

    return {
        shouldRun: true,
        reason: 'ready',
        settings: hypaSettings,
        hypaData,
        chunkEndIndex,
        summarizable,
        promptMessages,
        selectedModel: toStringOrEmpty(hypaSettings.summarizationModel) || 'subModel',
    };
}

function applyPeriodicHypaV3Summary(arg = {}) {
    const chat = arg.chat || {};
    const plan = arg.plan || {};
    const summaryText = replaceSummaryOutputVars(
        cleanSummaryOutput(arg.summaryText),
        arg.settings || {},
        arg.character || {},
        chat
    );
    const hypaData = normalizeHypaV3Data(plan.hypaData || chat.hypaV3Data);
    const chunkEndIndex = clampInt(plan.chunkEndIndex, 0, Number.MAX_SAFE_INTEGER, hypaData.lastSummarizedMessageIndex || 0);

    if (!summaryText) {
        hypaData.lastSummarizedMessageIndex = chunkEndIndex;
        chat.hypaV3Data = hypaData;
        return {
            updated: true,
            reason: 'empty_summary_advanced_index',
            hypaV3Data: hypaData,
        };
    }

    const memos = new Set(
        (Array.isArray(plan.summarizable) ? plan.summarizable : [])
            .map((msg) => toStringOrEmpty(msg.memo))
            .filter(Boolean)
    );

    const summaryEmbedding = Array.isArray(arg.summaryEmbedding)
        ? arg.summaryEmbedding.filter((v) => Number.isFinite(Number(v))).map((v) => Number(v))
        : null;

    hypaData.summaries.push({
        text: summaryText,
        chatMemos: Array.from(memos),
        isImportant: false,
        categoryId: undefined,
        tags: [],
        ...(summaryEmbedding && summaryEmbedding.length > 0 ? { embedding: summaryEmbedding } : {}),
    });
    hypaData.lastSummarizedMessageIndex = chunkEndIndex;
    chat.hypaV3Data = hypaData;

    return {
        updated: true,
        reason: 'summary_saved',
        hypaV3Data: hypaData,
    };
}

function getMetricIndexList(metrics, total) {
    if (!metrics || typeof metrics !== 'object') return [];
    const keyOrder = [
        'lastImportantSummaries',
        'lastRecentSummaries',
        'lastSimilarSummaries',
        'lastRandomSummaries',
    ];

    const seen = new Set();
    const indices = [];
    for (const key of keyOrder) {
        const list = Array.isArray(metrics[key]) ? metrics[key] : [];
        for (const raw of list) {
            const idx = Number(raw);
            if (!Number.isInteger(idx) || idx < 0 || idx >= total) continue;
            if (seen.has(idx)) continue;
            seen.add(idx);
            indices.push(idx);
        }
    }
    return indices.sort((a, b) => a - b);
}

function selectSummaryIndices(summaries, metrics, maxSelectedSummaries) {
    const total = summaries.length;
    if (total === 0) return [];

    // Keep this as a backward-compatible fallback for older records
    // that do not have enough metadata for dynamic selection.
    const metricIndices = getMetricIndexList(metrics, total).slice(-maxSelectedSummaries);
    if (metricIndices.length > 0) return metricIndices;

    const important = [];
    for (let i = 0; i < summaries.length; i++) {
        if (summaries[i].isImportant) {
            important.push(i);
        }
    }

    const recent = [];
    const recentStart = Math.max(0, total - maxSelectedSummaries);
    for (let i = recentStart; i < total; i++) {
        recent.push(i);
    }

    const merged = [];
    const seen = new Set();
    for (const idx of important.concat(recent)) {
        if (seen.has(idx)) continue;
        seen.add(idx);
        merged.push(idx);
    }
    return merged.slice(-maxSelectedSummaries).sort((a, b) => a - b);
}

function buildCategoryIndexPools(summaries) {
    const important = [];
    for (let i = summaries.length - 1; i >= 0; i--) {
        if (summaries[i]?.isImportant) {
            important.push(i);
        }
    }
    const recent = [];
    for (let i = summaries.length - 1; i >= 0; i--) {
        recent.push(i);
    }
    return { important, recent };
}

async function buildServerMemoryMessages(arg = {}) {
    const character = arg.character || {};
    const chat = arg.chat || {};
    const settings = arg.settings || {};

    if (character?.supaMemory !== true) return [];
    if (settings?.hypaV3 !== true) return [];

    const parsed = normalizeHypaV3Data(chat.hypaV3Data);
    chat.hypaV3Data = parsed;

    const summaries = parsed.summaries
        .map(normalizeSummary)
        .filter(Boolean);
    if (summaries.length === 0) return [];

    const hypaSettings = resolveHypaV3Settings(settings, character);
    const maxSelectedSummaries = clampInt(
        arg.maxSelectedSummaries,
        1,
        32,
        clampInt(getSummaryBatchSize(hypaSettings), 1, 32, DEFAULT_MAX_SELECTED_SUMMARIES)
    );
    const maxContextTokens = clampInt(
        arg.maxContextTokens ?? settings?.maxContext,
        256,
        200000,
        8192
    );
    const memoryRatio = Number.isFinite(Number(hypaSettings.memoryTokensRatio))
        ? Math.max(0.05, Math.min(0.8, Number(hypaSettings.memoryTokensRatio)))
        : 0.2;
    const maxMemoryTokens = clampInt(
        arg.maxMemoryTokens,
        64,
        64000,
        Math.max(64, Math.floor(maxContextTokens * memoryRatio))
    );
    const maxPromptChars = clampInt(arg.maxPromptChars, 256, 32768, DEFAULT_MAX_PROMPT_CHARS);

    const totalSlots = Math.min(maxSelectedSummaries, summaries.length);
    const recentSlots = Math.max(0, Math.floor(totalSlots * Number(hypaSettings.recentMemoryRatio || 0)));
    const similarSlots = Math.max(0, Math.floor(totalSlots * Number(hypaSettings.similarMemoryRatio || 0)));
    const importantSlots = Math.max(0, totalSlots - recentSlots - similarSlots);

    const pools = buildCategoryIndexPools(summaries);
    let similarIndices = [];
    if (similarSlots > 0) {
        try {
            const queryText = buildSimilarityQueryFromChat(chat);
            similarIndices = await getSimilaritySortedIndices(summaries, queryText, settings);
        } catch {
            similarIndices = [];
        }
    }

    const selectedSet = new Set();
    const selected = [];

    const pushFromPool = (indices, count) => {
        if (!Array.isArray(indices) || count <= 0) return;
        let added = 0;
        for (const idx of indices) {
            if (selected.length >= totalSlots) break;
            if (selectedSet.has(idx)) continue;
            selectedSet.add(idx);
            selected.push(idx);
            added += 1;
            if (added >= count) break;
        }
    };

    pushFromPool(pools.important, importantSlots);
    pushFromPool(pools.recent, recentSlots);
    pushFromPool(similarIndices, similarSlots);
    pushFromPool(pools.recent, totalSlots);

    let selectedIndices = selected.sort((a, b) => a - b);
    if (selectedIndices.length === 0) {
        selectedIndices = selectSummaryIndices(summaries, parsed.metrics, maxSelectedSummaries);
    }
    if (selectedIndices.length > 0) {
        parsed.metrics = {
            ...parsed.metrics,
            lastImportantSummaries: selectedIndices.filter((idx) => summaries[idx]?.isImportant),
            lastRecentSummaries: selectedIndices.filter((idx) => pools.recent.includes(idx)),
            lastSimilarSummaries: selectedIndices.filter((idx) => similarIndices.includes(idx)),
            lastRandomSummaries: [],
        };
        chat.hypaV3Data = parsed;
    }

    if (selectedIndices.length === 0) return [];

    const selectedTexts = [];
    let currentChars = 0;
    let currentTokens = 0;
    for (const idx of selectedIndices) {
        const text = summaries[idx]?.text || '';
        if (!text) continue;
        const textTokens = toApproxTokens(text) + (selectedTexts.length > 0 ? 1 : 0);
        if ((currentTokens + textTokens) > maxMemoryTokens) {
            continue;
        }
        const projected = currentChars + text.length + (selectedTexts.length > 0 ? 2 : 0);
        if (projected > maxPromptChars) break;
        selectedTexts.push(text);
        currentChars = projected;
        currentTokens += textTokens;
    }
    if (selectedTexts.length === 0) return [];

    return [{
        role: 'system',
        content: wrapWithXml(MEMORY_PROMPT_TAG, selectedTexts.join('\n\n')),
        memo: 'hypaMemory',
    }];
}

module.exports = {
    buildServerMemoryMessages,
    stripSummaryForPrompt,
    resolveHypaV3Settings,
    planPeriodicHypaV3Summarization,
    applyPeriodicHypaV3Summary,
    cleanSummaryOutput,
    generateSummaryEmbedding,
};
