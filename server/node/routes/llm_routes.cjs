function registerLLMRoutes(arg = {}) {
    const {
        app,
        dataRoot,
        promptPipeline,
        listOpenRouterModels,
        parseLLMExecutionInput,
        previewLLMExecution,
        handleLLMExecutePost,
        buildGenerateExecutionPayload,
        appendMemoryTraceAudit,
        toStringOrEmpty,
        getReqIdFromResponse,
        toLLMErrorResponse,
        logLLMExecutionStart,
        logLLMExecutionEnd,
        appendLLMAudit,
        buildExecutionAuditRequest,
        sendSSE,
        sendJson,
        assembleLLMServerPrompt,
        readLLMExecutionLogs,
    } = arg;

    if (!app || typeof app.post !== 'function' || typeof app.get !== 'function') {
        throw new Error('registerLLMRoutes requires an Express app instance.');
    }

    app.post('/data/llm/execute', async (req, res) => {
        await handleLLMExecutePost(req, res, req.body, 'execute');
    });

    app.post('/data/llm/preview', async (req, res) => {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        let normalized = null;
        try {
            normalized = parseLLMExecutionInput(req.body, { endpoint: 'preview' });
            logLLMExecutionStart({
                reqId,
                endpoint: normalized.endpoint,
                mode: normalized.mode,
                provider: normalized.provider,
                characterId: normalized.characterId,
                chatId: normalized.chatId,
                streaming: normalized.streaming,
            });
            const preview = await previewLLMExecution(normalized, { dataRoot });
            const durationMs = Date.now() - startedAt;
            logLLMExecutionEnd({
                reqId,
                endpoint: normalized.endpoint,
                mode: normalized.mode,
                provider: normalized.provider,
                characterId: normalized.characterId,
                chatId: normalized.chatId,
                status: 200,
                code: 'OK',
                durationMs,
            });
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: normalized.endpoint,
                mode: normalized.mode,
                provider: normalized.provider,
                characterId: normalized.characterId || null,
                chatId: normalized.chatId || null,
                streaming: normalized.streaming,
                status: 200,
                ok: true,
                durationMs,
                request: buildExecutionAuditRequest(normalized.endpoint, req.body),
                response: preview,
            });
            sendJson(res, 200, preview);
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const endpoint = normalized?.endpoint || 'preview';
            const response = toLLMErrorResponse(error, {
                requestId: reqId,
                endpoint,
                durationMs,
            });
            logLLMExecutionEnd({
                reqId,
                endpoint,
                mode: normalized?.mode || '-',
                provider: normalized?.provider || '-',
                characterId: normalized?.characterId || '-',
                chatId: normalized?.chatId || '-',
                status: response.status,
                code: response.code,
                durationMs,
            });
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint,
                mode: normalized?.mode || null,
                provider: normalized?.provider || null,
                characterId: normalized?.characterId || null,
                chatId: normalized?.chatId || null,
                streaming: normalized?.streaming || false,
                status: response.status,
                ok: false,
                durationMs,
                request: buildExecutionAuditRequest(endpoint, req.body),
                error: response.payload,
            });
            sendJson(res, response.status, response.payload);
        }
    });

    app.post('/data/llm/generate', async (req, res) => {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        try {
            const payload = await buildGenerateExecutionPayload(req.body, {
                onPeriodicSummaryTrace: async (trace) => {
                    await appendMemoryTraceAudit({
                        req,
                        reqId,
                        endpoint: toStringOrEmpty(trace?.endpoint) || 'hypav3_periodic_summarize',
                        mode: 'memory',
                        provider: trace?.provider || null,
                        characterId: toStringOrEmpty(req.body?.characterId) || null,
                        chatId: toStringOrEmpty(req.body?.chatId) || null,
                        status: Number.isFinite(Number(trace?.status)) ? Number(trace.status) : 200,
                        ok: trace?.ok !== false,
                        durationMs: Date.now() - startedAt,
                        promptMessages: Array.isArray(trace?.promptMessages) ? trace.promptMessages : [],
                        request: {
                            sourceEndpoint: 'generate',
                            characterId: toStringOrEmpty(req.body?.characterId) || null,
                            chatId: toStringOrEmpty(req.body?.chatId) || null,
                        },
                        path: '/data/memory/hypav3/periodic-summarize/trace',
                        traceTitle: 'HypaV3 Periodic Summarization',
                        error: trace?.error || null,
                    });
                },
            });
            await handleLLMExecutePost(req, res, payload, 'generate');
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const response = toLLMErrorResponse(error, {
                requestId: reqId,
                endpoint: 'generate',
                durationMs,
            });
            logLLMExecutionEnd({
                reqId,
                endpoint: 'generate',
                mode: '-',
                provider: '-',
                characterId: '-',
                chatId: '-',
                status: response.status,
                code: response.code,
                durationMs,
            });
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: 'generate',
                mode: null,
                provider: null,
                characterId: toStringOrEmpty(req.body?.characterId) || null,
                chatId: toStringOrEmpty(req.body?.chatId) || null,
                streaming: !!req.body?.streaming,
                status: response.status,
                ok: false,
                durationMs,
                request: buildExecutionAuditRequest('generate', req.body),
                error: response.payload,
            });
            if (req.body?.streaming) {
                sendSSE(res, {
                    type: 'fail',
                    status: response.status,
                    ...response.payload,
                });
                return;
            }
            sendJson(res, response.status, response.payload);
        }
    });

    app.post('/data/llm/generate/trace', async (req, res) => {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        let payload = null;
        try {
            payload = await buildGenerateExecutionPayload(req.body, {
                onPeriodicSummaryTrace: async (trace) => {
                    await appendMemoryTraceAudit({
                        req,
                        reqId,
                        endpoint: toStringOrEmpty(trace?.endpoint) || 'hypav3_periodic_summarize',
                        mode: 'memory',
                        provider: trace?.provider || null,
                        characterId: toStringOrEmpty(req.body?.characterId) || null,
                        chatId: toStringOrEmpty(req.body?.chatId) || null,
                        status: Number.isFinite(Number(trace?.status)) ? Number(trace.status) : 200,
                        ok: trace?.ok !== false,
                        durationMs: Date.now() - startedAt,
                        promptMessages: Array.isArray(trace?.promptMessages) ? trace.promptMessages : [],
                        request: {
                            sourceEndpoint: 'generate_trace',
                            characterId: toStringOrEmpty(req.body?.characterId) || null,
                            chatId: toStringOrEmpty(req.body?.chatId) || null,
                        },
                        path: '/data/memory/hypav3/periodic-summarize/trace',
                        traceTitle: 'HypaV3 Periodic Summarization',
                        error: trace?.error || null,
                    });
                },
            });
            logLLMExecutionStart({
                reqId,
                endpoint: 'generate_trace',
                mode: payload.mode,
                provider: payload.provider,
                characterId: payload.characterId,
                chatId: payload.chatId,
                streaming: false,
            });

            await assembleLLMServerPrompt(payload, { dataRoot });
            const promptMessages = promptPipeline.buildPromptTrace(payload);
            const durationMs = Date.now() - startedAt;

            const responsePayload = {
                type: 'success',
                requestId: reqId,
                endpoint: 'generate_trace',
                messageCount: promptMessages.length,
                promptMessages,
            };

            logLLMExecutionEnd({
                reqId,
                endpoint: 'generate_trace',
                mode: payload.mode,
                provider: payload.provider,
                characterId: payload.characterId || '-',
                chatId: payload.chatId || '-',
                status: 200,
                code: 'OK',
                durationMs,
            });
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: 'generate_trace',
                mode: payload.mode || null,
                provider: payload.provider || null,
                characterId: payload.characterId || null,
                chatId: payload.chatId || null,
                streaming: false,
                status: 200,
                ok: true,
                durationMs,
                request: buildExecutionAuditRequest('generate', req.body),
                response: responsePayload,
            });
            sendJson(res, 200, responsePayload);
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const response = toLLMErrorResponse(error, {
                requestId: reqId,
                endpoint: 'generate_trace',
                durationMs,
            });
            logLLMExecutionEnd({
                reqId,
                endpoint: 'generate_trace',
                mode: payload?.mode || '-',
                provider: payload?.provider || '-',
                characterId: payload?.characterId || toStringOrEmpty(req.body?.characterId) || '-',
                chatId: payload?.chatId || toStringOrEmpty(req.body?.chatId) || '-',
                status: response.status,
                code: response.code,
                durationMs,
            });
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: 'generate_trace',
                mode: payload?.mode || null,
                provider: payload?.provider || null,
                characterId: payload?.characterId || toStringOrEmpty(req.body?.characterId) || null,
                chatId: payload?.chatId || toStringOrEmpty(req.body?.chatId) || null,
                streaming: false,
                status: response.status,
                ok: false,
                durationMs,
                request: buildExecutionAuditRequest('generate', req.body),
                error: response.payload,
            });
            sendJson(res, response.status, response.payload);
        }
    });

    app.get('/data/llm/logs', async (req, res) => {
        try {
            const logs = await readLLMExecutionLogs(dataRoot, req.query || {});
            sendJson(res, 200, { logs });
        } catch (error) {
            sendJson(res, 500, {
                error: 'LOG_READ_FAILED',
                message: String(error?.message || error || 'Failed to read LLM logs'),
            });
        }
    });

    app.get('/data/openrouter/models', async (req, res) => {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        try {
            const refreshRaw = typeof req.query?.refresh === 'string' ? req.query.refresh.trim().toLowerCase() : '';
            const forceRefresh = refreshRaw === '1' || refreshRaw === 'true' || refreshRaw === 'yes';
            const models = await listOpenRouterModels({ dataRoot, forceRefresh });
            sendJson(res, 200, {
                ok: true,
                requestId: reqId,
                durationMs: Date.now() - startedAt,
                ...models,
            });
        } catch (error) {
            const response = toLLMErrorResponse(error, {
                requestId: reqId,
                endpoint: 'openrouter_models',
                durationMs: Date.now() - startedAt,
            });
            sendJson(res, response.status, response.payload);
        }
    });
}

module.exports = {
    registerLLMRoutes,
};
