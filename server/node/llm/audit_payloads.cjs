function createAuditPayloadBuilders(arg = {}) {
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const estimatePromptTokens = typeof arg.estimatePromptTokens === 'function'
        ? arg.estimatePromptTokens
        : (() => '[REDACTED]');
    const extractTextFromMessageContent = typeof arg.extractTextFromMessageContent === 'function'
        ? arg.extractTextFromMessageContent
        : ((content) => toStringOrEmpty(content));
    const parseBooleanEnv = typeof arg.parseBooleanEnv === 'function'
        ? arg.parseBooleanEnv
        : ((name) => {
            const value = String(process.env[name] || '').trim().toLowerCase();
            return value === '1' || value === 'true' || value === 'yes' || value === 'on';
        });

    const HYPAV3_AUDIT_SUMMARY_PREVIEW_CHARS = 1200;
    const includeFullGenerateRequestInAudit = parseBooleanEnv('RISU_AUDIT_INCLUDE_FULL_GENERATE_REQUEST');

    function buildMemoryPromptTrace(promptMessages, traceTitle = 'Memory Prompt') {
        const source = Array.isArray(promptMessages) ? promptMessages : [];
        return source.map((message, index) => ({
            index,
            role: toStringOrEmpty(message?.role) || 'system',
            title: traceTitle,
            source: 'memory',
            content: extractTextFromMessageContent(message?.content),
        }));
    }

    function buildGenerateAuditRequestPayload(requestBody) {
        const body = (requestBody && typeof requestBody === 'object' && !Array.isArray(requestBody)) ? requestBody : {};
        const request = (body.request && typeof body.request === 'object' && !Array.isArray(body.request)) ? body.request : {};
        const requestBodyInner = (request.requestBody && typeof request.requestBody === 'object' && !Array.isArray(request.requestBody))
            ? request.requestBody
            : {};

        const nestedMaxTokens = Number(requestBodyInner.max_tokens ?? requestBodyInner.max_completion_tokens ?? requestBodyInner?.generation_config?.maxOutputTokens);
        const requestMaxTokens = Number(request.maxTokens);
        const model = toStringOrEmpty(request.model) || toStringOrEmpty(requestBodyInner.model) || null;
        const messagesForEstimate = Array.isArray(request.messages)
            ? request.messages
            : (Array.isArray(requestBodyInner.messages) ? requestBodyInner.messages : []);
        const messagesCount = Array.isArray(messagesForEstimate) ? messagesForEstimate.length : 0;
        const prompt = toStringOrEmpty(request.prompt) || toStringOrEmpty(requestBodyInner.prompt);
        const toolsCount = Array.isArray(request.tools)
            ? request.tools.length
            : (Array.isArray(requestBodyInner.tools) ? requestBodyInner.tools.length : 0);

        const payload = {
            mode: toStringOrEmpty(body.mode) || null,
            provider: toStringOrEmpty(body.provider) || null,
            characterId: toStringOrEmpty(body.characterId) || null,
            chatId: toStringOrEmpty(body.chatId) || null,
            streaming: body.streaming === true,
            continue: body.continue === true,
            userMessageChars: toStringOrEmpty(body.userMessage).length,
            request: {
                model,
                maxTokens: Number.isFinite(requestMaxTokens)
                    ? requestMaxTokens
                    : (Number.isFinite(nestedMaxTokens) ? nestedMaxTokens : null),
                messagesCount,
                estimatedPromptTokens: estimatePromptTokens(messagesForEstimate),
                promptChars: prompt.length,
                toolsCount,
                requestBodyKeys: Object.keys(requestBodyInner),
            },
        };

        if (body.ragSettings && typeof body.ragSettings === 'object') {
            payload.ragSettings = {
                enabled: body.ragSettings.enabled === true,
                enabledRulebooksCount: Array.isArray(body.ragSettings.enabledRulebooks)
                    ? body.ragSettings.enabledRulebooks.length
                    : 0,
            };
        }
        if (body.globalRagSettings && typeof body.globalRagSettings === 'object') {
            payload.globalRagSettings = {
                topK: Number(body.globalRagSettings.topK),
                minScore: Number(body.globalRagSettings.minScore),
                budget: Number(body.globalRagSettings.budget),
                model: toStringOrEmpty(body.globalRagSettings.model) || null,
            };
        }
        return payload;
    }

    function buildExecutionAuditRequest(endpoint, requestBody) {
        const normalizedEndpoint = toStringOrEmpty(endpoint).toLowerCase();
        const isGenerateLike = normalizedEndpoint === 'generate' || normalizedEndpoint === 'generate_trace';
        if (isGenerateLike && !includeFullGenerateRequestInAudit) {
            return buildGenerateAuditRequestPayload(requestBody);
        }
        return requestBody;
    }

    function truncateAuditText(text, maxChars = HYPAV3_AUDIT_SUMMARY_PREVIEW_CHARS) {
        const normalized = toStringOrEmpty(text);
        if (!normalized) return '';
        if (normalized.length <= maxChars) return normalized;
        return `${normalized.slice(0, maxChars)}\n...[truncated ${normalized.length - maxChars} chars]`;
    }

    function buildHypaV3AuditRequestPayload(endpoint, body) {
        const payload = (body && typeof body === 'object' && !Array.isArray(body)) ? body : {};
        const promptOverride = (payload.promptOverride && typeof payload.promptOverride === 'object' && !Array.isArray(payload.promptOverride))
            ? payload.promptOverride
            : null;
        const summarizationPrompt = toStringOrEmpty(promptOverride?.summarizationPrompt);
        const reSummarizationPrompt = toStringOrEmpty(promptOverride?.reSummarizationPrompt);
        const promptOverrideMeta = {
            hasPromptOverride: !!promptOverride,
            summarizationPromptChars: summarizationPrompt.length,
            reSummarizationPromptChars: reSummarizationPrompt.length,
        };
        const base = {
            characterId: toStringOrEmpty(payload.characterId) || null,
            chatId: toStringOrEmpty(payload.chatId) || null,
        };
        if (endpoint === 'hypav3_manual_summarize' || endpoint === 'hypav3_manual_summarize_trace') {
            return {
                ...base,
                start: Number.isFinite(Number(payload.start)) ? Number(payload.start) : null,
                end: Number.isFinite(Number(payload.end)) ? Number(payload.end) : null,
                ...promptOverrideMeta,
            };
        }
        if (endpoint === 'hypav3_resummarize_preview') {
            const summaryIndices = Array.isArray(payload.summaryIndices)
                ? payload.summaryIndices.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0)
                : [];
            return {
                ...base,
                summaryIndices,
                summaryIndicesCount: summaryIndices.length,
            };
        }
        if (endpoint === 'hypav3_resummarize_apply') {
            const summaryIndices = Array.isArray(payload.summaryIndices)
                ? payload.summaryIndices.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0)
                : [];
            const summary = toStringOrEmpty(payload.summary);
            return {
                ...base,
                summaryIndices,
                summaryIndicesCount: summaryIndices.length,
                summaryChars: summary.length,
                mergedChatMemosCount: Array.isArray(payload.mergedChatMemos) ? payload.mergedChatMemos.length : 0,
            };
        }
        return base;
    }

    function buildHypaV3AuditResponsePayload(endpoint, payload) {
        const body = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
        const summary = toStringOrEmpty(body.summary);
        const base = {
            type: toStringOrEmpty(body.type) || 'success',
            requestId: toStringOrEmpty(body.requestId) || null,
            summaryChars: summary.length,
            summaryPreview: truncateAuditText(summary),
        };
        if (endpoint === 'hypav3_manual_summarize' || endpoint === 'hypav3_resummarize_apply') {
            const summariesCount = Array.isArray(body?.hypaV3Data?.summaries) ? body.hypaV3Data.summaries.length : 0;
            return {
                ...base,
                summariesCount,
            };
        }
        if (endpoint === 'hypav3_resummarize_preview') {
            const selectedIndices = Array.isArray(body.selectedIndices) ? body.selectedIndices : [];
            const mergedChatMemos = Array.isArray(body.mergedChatMemos) ? body.mergedChatMemos : [];
            return {
                ...base,
                selectedIndices,
                selectedIndicesCount: selectedIndices.length,
                mergedChatMemosCount: mergedChatMemos.length,
            };
        }
        return base;
    }

    function buildMemoryTraceResponsePayload(payload = {}) {
        const endpoint = toStringOrEmpty(payload.endpoint) || 'hypav3_memory_trace';
        const requestId = toStringOrEmpty(payload.requestId) || null;
        const promptMessages = Array.isArray(payload.promptMessages) ? payload.promptMessages : [];
        const traceTitle = toStringOrEmpty(payload.traceTitle) || 'Memory Prompt';
        const tracedMessages = buildMemoryPromptTrace(promptMessages, traceTitle);
        return {
            type: 'success',
            requestId,
            endpoint,
            messageCount: tracedMessages.length,
            promptMessages: tracedMessages,
            shouldRun: payload.shouldRun === true,
            reason: toStringOrEmpty(payload.reason) || undefined,
            provider: toStringOrEmpty(payload.provider) || null,
            model: toStringOrEmpty(payload.model) || null,
        };
    }

    return {
        buildMemoryPromptTrace,
        buildGenerateAuditRequestPayload,
        buildExecutionAuditRequest,
        truncateAuditText,
        buildHypaV3AuditRequestPayload,
        buildHypaV3AuditResponsePayload,
        buildMemoryTraceResponsePayload,
    };
}

module.exports = {
    createAuditPayloadBuilders,
};
