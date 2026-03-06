function createTraceAuditors(arg = {}) {
    const appendLLMAudit = typeof arg.appendLLMAudit === 'function'
        ? arg.appendLLMAudit
        : (async () => {});
    const promptPipeline = arg.promptPipeline || {};
    const truncatePromptMessagesForAudit = typeof promptPipeline.truncatePromptMessagesForAudit === 'function'
        ? promptPipeline.truncatePromptMessagesForAudit.bind(promptPipeline)
        : ((messages) => ({ promptMessages: Array.isArray(messages) ? messages : [], omittedMessageCount: 0 }));
    const buildPromptTrace = typeof promptPipeline.buildPromptTrace === 'function'
        ? promptPipeline.buildPromptTrace.bind(promptPipeline)
        : (() => []);
    const buildMemoryPromptTrace = typeof arg.buildMemoryPromptTrace === 'function'
        ? arg.buildMemoryPromptTrace
        : ((messages) => (Array.isArray(messages) ? messages : []));

    async function appendGenerateTraceAudit({
        req,
        reqId,
        normalized,
        endpoint = 'generate_trace',
        path = '/data/llm/generate/trace',
        durationMs = 0,
        status = 200,
        ok = true,
        error = null,
    }) {
        try {
            const normalizedAudit = normalized && typeof normalized === 'object'
                ? normalized
                : {};
            const promptMessages = buildPromptTrace(normalizedAudit);
            const {
                promptMessages: promptMessagesForAudit,
                omittedMessageCount,
            } = truncatePromptMessagesForAudit(promptMessages);
            await appendLLMAudit({
                requestId: reqId,
                method: req?.method || 'POST',
                path,
                endpoint,
                mode: normalizedAudit.mode || null,
                provider: normalizedAudit.provider || null,
                characterId: normalizedAudit.characterId || null,
                chatId: normalizedAudit.chatId || null,
                streaming: false,
                status,
                ok,
                durationMs,
                request: {
                    mode: normalizedAudit.mode || null,
                    provider: normalizedAudit.provider || null,
                    characterId: normalizedAudit.characterId || null,
                    chatId: normalizedAudit.chatId || null,
                },
                ...(ok
                    ? {
                        response: {
                            type: 'success',
                            requestId: reqId,
                            endpoint,
                            messageCount: promptMessages.length,
                            promptMessages: promptMessagesForAudit,
                            truncatedForAudit: promptMessagesForAudit.length !== promptMessages.length
                                || omittedMessageCount > 0
                                || promptMessagesForAudit.some((msg) => msg?.contentTruncated === true),
                            omittedMessageCount,
                        },
                    }
                    : { error: error || { error: 'TRACE_BUILD_FAILED', message: 'Failed to build generate trace' } }),
            });
        } catch (traceError) {
            console.error('[LLMAPI] Failed to persist generate trace audit', traceError);
        }
    }

    async function appendMemoryTraceAudit({
        req,
        reqId,
        endpoint = 'hypav3_memory',
        mode = 'memory',
        provider = null,
        characterId = null,
        chatId = null,
        status = 200,
        ok = true,
        durationMs = 0,
        promptMessages = [],
        request = null,
        path = null,
        traceTitle = 'Memory Prompt',
        error = null,
    }) {
        try {
            const tracedMessages = buildMemoryPromptTrace(promptMessages, traceTitle);
            const {
                promptMessages: promptMessagesForAudit,
                omittedMessageCount,
            } = truncatePromptMessagesForAudit(tracedMessages);
            await appendLLMAudit({
                requestId: reqId,
                method: req?.method || 'POST',
                path: path || req?.originalUrl || '/data/memory/hypav3/trace',
                endpoint: `${endpoint}_trace`,
                mode,
                provider,
                characterId: characterId || null,
                chatId: chatId || null,
                streaming: false,
                status,
                ok,
                durationMs,
                request: request || {
                    mode,
                    provider,
                    characterId: characterId || null,
                    chatId: chatId || null,
                },
                ...(ok
                    ? {
                        response: {
                            type: 'success',
                            requestId: reqId,
                            endpoint: `${endpoint}_trace`,
                            messageCount: tracedMessages.length,
                            promptMessages: promptMessagesForAudit,
                            truncatedForAudit: promptMessagesForAudit.length !== tracedMessages.length
                                || omittedMessageCount > 0
                                || promptMessagesForAudit.some((msg) => msg?.contentTruncated === true),
                            omittedMessageCount,
                        },
                    }
                    : { error: error || { error: 'TRACE_BUILD_FAILED', message: 'Failed to build memory trace' } }),
            });
        } catch (traceError) {
            console.error('[LLMAPI] Failed to persist memory trace audit', traceError);
        }
    }

    return {
        appendGenerateTraceAudit,
        appendMemoryTraceAudit,
    };
}

module.exports = {
    createTraceAuditors,
};
