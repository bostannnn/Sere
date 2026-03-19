function normalizeMaxContextTokens(rawBody, settings) {
    const candidates = [
        rawBody?.maxContext,
        rawBody?.request?.maxContext,
        settings?.maxContext,
    ];
    for (const candidate of candidates) {
        const value = Number(candidate);
        if (Number.isFinite(value) && value > 0) {
            return Math.max(256, Math.floor(value));
        }
    }
    return 0;
}

function getOldestChatMessageIndex(promptBlocks, messagesLength) {
    if (!Array.isArray(promptBlocks)) {
        return null;
    }
    let best = null;
    for (const block of promptBlocks) {
        if (!block || typeof block !== 'object') continue;
        if (block.source !== 'chat') continue;
        const index = Number(block.index);
        if (!Number.isInteger(index) || index < 0 || index >= messagesLength) continue;
        if (best === null || index < best) {
            best = index;
        }
    }
    return best;
}

function removePromptMessageAtIndex(messages, promptBlocks, targetIndex) {
    if (!Array.isArray(messages)) {
        return;
    }
    messages.splice(targetIndex, 1);
    if (!Array.isArray(promptBlocks)) {
        return;
    }
    for (let i = promptBlocks.length - 1; i >= 0; i -= 1) {
        const block = promptBlocks[i];
        if (!block || typeof block !== 'object') continue;
        const index = Number(block.index);
        if (!Number.isInteger(index)) continue;
        if (index === targetIndex) {
            promptBlocks.splice(i, 1);
            continue;
        }
        if (index > targetIndex) {
            block.index = index - 1;
        }
    }
}

function resolvePromptBudgetDependencies(options = {}) {
    if (typeof options.estimatePromptTokens !== 'function') {
        throw new TypeError('trimPromptMessagesToContext requires options.estimatePromptTokens.');
    }
    if (typeof options.LLMHttpError !== 'function') {
        throw new TypeError('trimPromptMessagesToContext requires options.LLMHttpError.');
    }
    return {
        estimatePromptTokens: options.estimatePromptTokens,
        LLMHttpError: options.LLMHttpError,
    };
}

async function trimPromptMessagesToContext(messages, promptBlocks, maxInputTokens, options = {}) {
    if (!Array.isArray(messages) || messages.length === 0 || !Number.isFinite(Number(maxInputTokens))) {
        return 0;
    }

    const {
        estimatePromptTokens,
        LLMHttpError,
    } = resolvePromptBudgetDependencies(options);

    let inputTokens = Number(await Promise.resolve(estimatePromptTokens(messages))) || 0;
    while (inputTokens > maxInputTokens) {
        const trimIndex = getOldestChatMessageIndex(promptBlocks, messages.length);
        if (!Number.isInteger(trimIndex)) {
            const reservedOutputTokens = Number(options.reservedOutputTokens);
            const maxContextTokens = Number(options.maxContextTokens);
            const reserveSuffix = Number.isFinite(reservedOutputTokens) && reservedOutputTokens > 0
                ? ` after reserving ${reservedOutputTokens} output tokens`
                : '';
            const contextSuffix = Number.isFinite(maxContextTokens) && maxContextTokens > 0
                ? ` within max context size (${maxContextTokens})`
                : '';
            throw new LLMHttpError(
                400,
                'MAX_CONTEXT_EXCEEDED',
                `Input token count (${inputTokens}) exceeds allowed prompt budget (${maxInputTokens})${contextSuffix}${reserveSuffix}, but no removable chat history remains.`
            );
        }
        removePromptMessageAtIndex(messages, promptBlocks, trimIndex);
        inputTokens = Number(await Promise.resolve(estimatePromptTokens(messages))) || 0;
    }

    return inputTokens;
}

module.exports = {
    normalizeMaxContextTokens,
    getOldestChatMessageIndex,
    removePromptMessageAtIndex,
    trimPromptMessagesToContext,
};
