const { generateEmbeddings } = require('../rag/embedding.cjs');
const {
    clampInt,
    getMaxSelectedSummaries,
    toStringOrEmpty,
} = require('./settings.cjs');

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

function buildSimilarityQueryFromChat(chat, convertStoredMessageToOpenAI) {
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

async function generateSummaryEmbedding(summaryText, settings, stripSummaryForPrompt) {
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

function buildCategoryIndexPools(summaries) {
    const recent = [];
    for (let i = summaries.length - 1; i >= 0; i--) {
        recent.push(i);
    }
    return { recent };
}

function resolveLegacySummarySlotAllocation(hypaSettings, totalSlots) {
    const recentRatioRaw = Number(hypaSettings?.recentMemoryRatio || 0);
    const similarRatioRaw = Number(hypaSettings?.similarMemoryRatio || 0);
    const recentRatio = Number.isFinite(recentRatioRaw) ? Math.max(0, Math.min(1, recentRatioRaw)) : 0;
    const similarRatio = Number.isFinite(similarRatioRaw) ? Math.max(0, Math.min(1, similarRatioRaw)) : 0;
    const ratioSum = recentRatio + similarRatio;
    const normalizedRecentRatio = ratioSum > 1 ? recentRatio / ratioSum : recentRatio;
    const normalizedSimilarRatio = ratioSum > 1 ? similarRatio / ratioSum : similarRatio;
    const similarSlots = Math.max(0, Math.floor(totalSlots * normalizedSimilarRatio));
    const recentSlots = Math.max(0, totalSlots - similarSlots);
    return { recentSlots, similarSlots };
}

function resolveSummarySlotAllocation(hypaSettings, totalSlots) {
    if (totalSlots <= 0) {
        return {
            recentSlots: 0,
            similarSlots: 0,
        };
    }

    const legacy = resolveLegacySummarySlotAllocation(hypaSettings, totalSlots);
    const similarSlots = clampInt(
        hypaSettings?.similarSummarySlots,
        0,
        totalSlots,
        legacy.similarSlots
    );
    const recentSlotsRaw = Number(hypaSettings?.recentSummarySlots);
    let recentSlots = Number.isFinite(recentSlotsRaw)
        ? clampInt(recentSlotsRaw, 0, totalSlots, legacy.recentSlots)
        : legacy.recentSlots;

    if ((recentSlots + similarSlots) > totalSlots) {
        recentSlots = Math.max(0, totalSlots - similarSlots);
    }

    if ((recentSlots + similarSlots) < totalSlots) {
        recentSlots = Math.max(0, totalSlots - similarSlots);
    }

    return {
        recentSlots,
        similarSlots,
    };
}

module.exports = {
    cosineSimilarity,
    toApproxTokens,
    buildSimilarityQueryFromChat,
    generateSummaryEmbedding,
    getSimilaritySortedIndices,
    buildCategoryIndexPools,
    resolveLegacySummarySlotAllocation,
    resolveSummarySlotAllocation,
    getMaxSelectedSummaries,
};
