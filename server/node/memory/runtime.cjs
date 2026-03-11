const {
    toStringOrEmpty,
    clampInt,
    getPeriodicSummarizationInterval,
    getSummaryBatchSize,
    getMaxSelectedSummaries,
    DEFAULT_MAX_PROMPT_CHARS,
    DEFAULT_SUMMARIZATION_PROMPT,
    resolveMemorySettings,
    isMemoryEnabled,
} = require('./settings.cjs');
const { getMemoryData, setMemoryData } = require('./storage.cjs');
const {
    normalizeMemoryData,
    selectSummaryIndices,
} = require('./data.cjs');
const {
    toApproxTokens,
    buildSimilarityQueryFromChat: buildSimilarityQueryFromStoredChat,
    generateSummaryEmbedding: generateSummaryEmbeddingInternal,
    getSimilaritySortedIndices,
    buildCategoryIndexPools,
    resolveSummarySlotAllocation,
} = require('./similarity.cjs');

function wrapWithXml(tag, content) {
    return `<${tag}>\n${content}\n</${tag}>`;
}

const SUMMARY_HEADING_REGEX = /^\s*Roleplay Scene Summary\s*\n+/i;
const SUMMARY_KEYWORDS_REGEX = /\n+\s*Keywords?\s*:\s*.*$/is;
const MEMORY_PROMPT_TAG = 'Past Events Summary';

function stripSummaryForPrompt(content) {
    const text = toStringOrEmpty(content);
    if (!text) return '';
    const withoutHeading = text.replace(SUMMARY_HEADING_REGEX, '');
    return withoutHeading.replace(SUMMARY_KEYWORDS_REGEX, '').trim();
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

function buildSimilarityQueryFromChat(chat) {
    return buildSimilarityQueryFromStoredChat(chat, convertStoredMessageToOpenAI);
}

async function generateSummaryEmbedding(summaryText, settings) {
    return generateSummaryEmbeddingInternal(summaryText, settings, stripSummaryForPrompt);
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


function planPeriodicMemorySummarization(arg = {}) {
    const character = arg.character || {};
    const chat = arg.chat || {};
    const settings = arg.settings || {};
    const messages = Array.isArray(chat.message) ? chat.message : [];

    if (character?.supaMemory !== true) {
        return { shouldRun: false, reason: 'memory_disabled_on_character' };
    }
    if (!isMemoryEnabled(settings)) {
        return { shouldRun: false, reason: 'memory_disabled_in_settings' };
    }

    const memorySettings = resolveMemorySettings(settings, character);
    const periodicInterval = getPeriodicSummarizationInterval(memorySettings);
    const batchSize = getSummaryBatchSize(memorySettings);
    if (!Number.isFinite(Number(memorySettings.periodicSummarizationInterval)) || Number(memorySettings.periodicSummarizationInterval) <= 0) {
        return { shouldRun: false, reason: 'invalid_periodic_interval' };
    }

    const memoryData = normalizeMemoryData(getMemoryData(chat));
    const totalChats = messages.length;
    const lastIndex = clampInt(memoryData.lastSummarizedMessageIndex, 0, totalChats, 0);
    const newMessages = totalChats - lastIndex;
    const forcedWindowEndIndex = Number(arg.forceWindowEndIndex);
    const hasForcedWindow = Number.isFinite(forcedWindowEndIndex) && forcedWindowEndIndex > lastIndex;
    if (!hasForcedWindow && newMessages < periodicInterval) {
        return { shouldRun: false, reason: 'interval_not_reached', memoryData };
    }

    const sliceStart = Math.max(0, Math.min(lastIndex, totalChats));
    const windowEndIndex = hasForcedWindow
        ? clampInt(forcedWindowEndIndex, sliceStart, totalChats, totalChats)
        : Math.max(sliceStart, Math.min(totalChats, sliceStart + periodicInterval));
    const sliceEnd = Math.max(sliceStart, Math.min(totalChats, windowEndIndex, sliceStart + batchSize));
    const chunk = messages.slice(sliceStart, sliceEnd);
    const chunkEndIndex = sliceStart + chunk.length;

    const converted = chunk
        .map(convertStoredMessageToOpenAI)
        .filter((msg) => msg && msg.memo !== 'NewChatExample' && msg.memo !== 'NewChat');

    const summarizable = converted.filter((msg) => {
        if (!msg || !msg.content || !msg.content.trim()) return false;
        if (memorySettings.doNotSummarizeUserMessage && msg.role === 'user') return false;
        if (toStringOrEmpty(msg.name).startsWith('example_')) return false;
        return true;
    });

    if (summarizable.length === 0) {
        return {
            shouldRun: false,
            reason: 'no_summarizable_messages',
            shouldAdvanceIndex: true,
            chunkEndIndex,
            memoryData,
        };
    }

    const promptMessages = buildSummarizationPromptMessages(
        summarizable,
        memorySettings.summarizationPrompt
    );
    if (!promptMessages) {
        return {
            shouldRun: false,
            reason: 'empty_summarization_prompt_messages',
            shouldAdvanceIndex: true,
            chunkEndIndex,
            memoryData,
        };
    }

    return {
        shouldRun: true,
        reason: 'ready',
        settings: memorySettings,
        memoryData,
        chunkEndIndex,
        windowEndIndex,
        summarizable,
        promptMessages,
        selectedModel: toStringOrEmpty(memorySettings.summarizationModel) || 'subModel',
    };
}

function applyPeriodicMemorySummary(arg = {}) {
    const chat = arg.chat || {};
    const plan = arg.plan || {};
    const summaryText = replaceSummaryOutputVars(
        cleanSummaryOutput(arg.summaryText),
        arg.settings || {},
        arg.character || {},
        chat
    );
    const memoryData = normalizeMemoryData(plan.memoryData || getMemoryData(chat));
    const chunkEndIndex = clampInt(plan.chunkEndIndex, 0, Number.MAX_SAFE_INTEGER, memoryData.lastSummarizedMessageIndex || 0);

    if (!summaryText) {
        memoryData.lastSummarizedMessageIndex = chunkEndIndex;
        setMemoryData(chat, memoryData);
        return {
            updated: true,
            reason: 'empty_summary_advanced_index',
            memoryData,
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

    memoryData.summaries.push({
        text: summaryText,
        chatMemos: Array.from(memos),
        isImportant: false,
        categoryId: undefined,
        tags: [],
        ...(summaryEmbedding && summaryEmbedding.length > 0 ? { embedding: summaryEmbedding } : {}),
    });
    memoryData.lastSummarizedMessageIndex = chunkEndIndex;
    setMemoryData(chat, memoryData);

    return {
        updated: true,
        reason: 'summary_saved',
        memoryData,
    };
}


async function buildServerMemoryMessages(arg = {}) {
    const character = arg.character || {};
    const chat = arg.chat || {};
    const settings = arg.settings || {};

    if (character?.supaMemory !== true) return [];
    if (!isMemoryEnabled(settings)) return [];

    const parsed = normalizeMemoryData(getMemoryData(chat));
    setMemoryData(chat, parsed);

    const summaries = parsed.summaries
        .map(normalizeSummary)
        .filter(Boolean);
    if (summaries.length === 0) return [];

    const memorySettings = resolveMemorySettings(settings, character);
    const maxSelectedSummaries = clampInt(
        arg.maxSelectedSummaries,
        1,
        32,
        getMaxSelectedSummaries(memorySettings)
    );
    const maxContextTokens = clampInt(
        arg.maxContextTokens ?? settings?.maxContext,
        256,
        200000,
        8192
    );
    const memoryRatio = Number.isFinite(Number(memorySettings.memoryTokensRatio))
        ? Math.max(0.05, Math.min(0.8, Number(memorySettings.memoryTokensRatio)))
        : 0.2;
    const maxMemoryTokens = clampInt(
        arg.maxMemoryTokens,
        64,
        64000,
        Math.max(64, Math.floor(maxContextTokens * memoryRatio))
    );
    const maxPromptChars = clampInt(arg.maxPromptChars, 256, 32768, DEFAULT_MAX_PROMPT_CHARS);

    const totalSlots = Math.min(maxSelectedSummaries, summaries.length);
    const {
        recentSlots,
        similarSlots,
    } = resolveSummarySlotAllocation(memorySettings, totalSlots);

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
    const selectedRecentIndices = [];
    const selectedSimilarIndices = [];

    const pushFromPool = (indices, count, bucket = null) => {
        if (!Array.isArray(indices) || count <= 0) return;
        let added = 0;
        for (const idx of indices) {
            if (selected.length >= totalSlots) break;
            if (selectedSet.has(idx)) continue;
            selectedSet.add(idx);
            selected.push(idx);
            if (bucket === 'recent') selectedRecentIndices.push(idx);
            if (bucket === 'similar') selectedSimilarIndices.push(idx);
            added += 1;
            if (added >= count) break;
        }
    };

    pushFromPool(pools.recent, recentSlots, 'recent');
    pushFromPool(similarIndices, similarSlots, 'similar');
    pushFromPool(pools.recent, totalSlots, 'recent');

    let selectedIndices = selected.sort((a, b) => a - b);
    if (selectedIndices.length === 0) {
        selectedIndices = selectSummaryIndices(summaries, parsed.metrics, maxSelectedSummaries);
    }
    if (selectedIndices.length === 0) return [];

    const selectedTexts = [];
    const includedIndices = [];
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
        includedIndices.push(idx);
        currentChars = projected;
        currentTokens += textTokens;
    }
    if (selectedTexts.length === 0) return [];

    parsed.metrics = {
        ...parsed.metrics,
        lastImportantSummaries: [],
        lastRecentSummaries: selectedRecentIndices.filter((idx) => includedIndices.includes(idx)).sort((a, b) => a - b),
        lastSimilarSummaries: selectedSimilarIndices.filter((idx) => includedIndices.includes(idx)).sort((a, b) => a - b),
        lastRandomSummaries: [],
    };
    setMemoryData(chat, parsed);

    return [{
        role: 'system',
        content: wrapWithXml(MEMORY_PROMPT_TAG, selectedTexts.join('\n\n')),
        memo: 'memory',
    }];
}

module.exports = {
    buildServerMemoryMessages,
    stripSummaryForPrompt,
    resolveMemorySettings,
    planPeriodicMemorySummarization,
    applyPeriodicMemorySummary,
    cleanSummaryOutput,
    generateSummaryEmbedding,
    getPeriodicSummarizationInterval,
    getSummaryBatchSize,
    getMaxSelectedSummaries,
};
