const { toStringOrEmpty } = require('./scripts.cjs');

function extractTextFromMessageContent(content) {
    if (typeof content === 'string') {
        return content.trim();
    }
    if (!Array.isArray(content)) {
        return '';
    }
    const chunks = [];
    for (const part of content) {
        if (typeof part === 'string') {
            if (part.trim()) chunks.push(part.trim());
            continue;
        }
        if (!part || typeof part !== 'object') continue;
        if (typeof part.text === 'string' && part.text.trim()) {
            chunks.push(part.text.trim());
        }
    }
    return chunks.join('\n').trim();
}

function estimateTextTokens(text) {
    const chars = toStringOrEmpty(text).length;
    return Math.max(1, Math.ceil(chars / 4));
}

function estimateMessageTokens(message) {
    if (!message || typeof message !== 'object') return 0;
    const roleCost = 2;
    const textCost = estimateTextTokens(extractTextFromMessageContent(message.content));
    const nameCost = toStringOrEmpty(message.name) ? 1 : 0;
    return roleCost + textCost + nameCost;
}

function estimateMessagesTokens(messages) {
    if (!Array.isArray(messages)) return 0;
    let total = 0;
    for (const message of messages) {
        total += estimateMessageTokens(message);
    }
    return total;
}

module.exports = {
    extractTextFromMessageContent,
    estimateTextTokens,
    estimateMessageTokens,
    estimateMessagesTokens,
};
