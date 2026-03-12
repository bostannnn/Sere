const { clampInt } = require('./settings.cjs');

function safeJsonClone(value, fallback = null) {
    try {
        return value == null ? fallback : JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function parseMemoryData(rawData) {
    if (!rawData || typeof rawData !== 'object' || Array.isArray(rawData)) {
        return null;
    }
    if (!Array.isArray(rawData.summaries)) {
        return null;
    }
    return rawData;
}

function normalizeMemoryData(rawData) {
    const parsed = parseMemoryData(rawData);
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

module.exports = {
    safeJsonClone,
    parseMemoryData,
    normalizeMemoryData,
    getMetricIndexList,
    selectSummaryIndices,
};
