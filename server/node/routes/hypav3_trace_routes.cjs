function registerHypaV3TraceRoutes(arg = {}) {
    const {
        app,
        path,
        fs,
        dataDirs,
        existsSync,
        LLMHttpError,
        isSafePathSegment,
        getReqIdFromResponse,
        toStringOrEmpty,
        logLLMExecutionStart,
        logLLMExecutionEnd,
        appendLLMAudit,
        buildHypaV3AuditRequestPayload,
        sendJson,
        toLLMErrorResponse,
        resolveHypaV3Settings,
        convertStoredMessageForHypaSummary,
        buildHypaSummarizationPromptMessages,
        resolveHypaSummaryProviderModel,
        buildMemoryTraceResponsePayload,
        normalizeHypaV3DataForEdit,
        sanitizeHypaSummarizationContent,
        planPeriodicHypaV3Summarization,
    } = arg;

app.post('/data/memory/hypav3/manual-summarize/trace', async (req, res) => {
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'hypav3_manual_summarize_trace';
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const characterIdFromBody = toStringOrEmpty(body.characterId);
    const chatIdFromBody = toStringOrEmpty(body.chatId);
    logLLMExecutionStart({
        reqId,
        endpoint,
        mode: 'memory',
        provider: '-',
        characterId: characterIdFromBody || '-',
        chatId: chatIdFromBody || '-',
        streaming: false,
    });
    try {
        const characterId = toStringOrEmpty(body.characterId);
        const chatId = toStringOrEmpty(body.chatId);
        const start = Math.floor(Number(body.start));
        const end = Math.floor(Number(body.end));
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId is required and must be a safe id.');
        }
        if (!chatId || !isSafePathSegment(chatId)) {
            throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId is required and must be a safe id.');
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || start > end) {
            throw new LLMHttpError(400, 'INVALID_RANGE', 'start/end must be positive numbers with start <= end.');
        }

        const settingsPath = path.join(dataDirs.root, 'settings.json');
        const charPath = path.join(dataDirs.characters, characterId, 'character.json');
        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(settingsPath)) throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        if (!existsSync(charPath)) throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        if (!existsSync(chatPath)) throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);

        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = (settingsRaw && typeof settingsRaw === 'object' && settingsRaw.data && typeof settingsRaw.data === 'object')
            ? settingsRaw.data
            : settingsRaw;
        const charRaw = JSON.parse(await fs.readFile(charPath, 'utf-8'));
        const character = charRaw.character || charRaw.data || charRaw || {};
        const chatRaw = JSON.parse(await fs.readFile(chatPath, 'utf-8'));
        const chat = chatRaw.chat || chatRaw.data || chatRaw || {};
        const sourceMessages = Array.isArray(chat?.message) ? chat.message.filter((m) => m && m.disabled !== true) : [];
        const maxCount = sourceMessages.length;
        if (maxCount === 0) throw new LLMHttpError(400, 'NO_MESSAGES', 'No chat messages to summarize.');

        const startIndex = Math.max(1, Math.min(start, maxCount));
        const endIndex = Math.max(startIndex, Math.min(end, maxCount));
        const slice = sourceMessages.slice(startIndex - 1, endIndex);
        const hypaSettings = resolveHypaV3Settings(settings, character);
        const summarizable = [];
        for (let i = 0; i < slice.length; i++) {
            const converted = convertStoredMessageForHypaSummary(slice[i]);
            if (!converted) continue;
            if (hypaSettings.doNotSummarizeUserMessage && converted.role === 'user') continue;
            if (toStringOrEmpty(converted.name).startsWith('example_')) continue;
            summarizable.push(converted);
        }
        if (summarizable.length === 0) throw new LLMHttpError(400, 'NO_SUMMARIZABLE_MESSAGES', 'No valid messages in selected range.');

        const promptMessages = buildHypaSummarizationPromptMessages(
            summarizable,
            hypaSettings.summarizationPrompt,
            false
        );
        if (!promptMessages) throw new LLMHttpError(400, 'EMPTY_PROMPT_MESSAGES', 'Failed to build summarization prompt.');

        const modelMeta = resolveHypaSummaryProviderModel(settings, character);
        const responsePayload = buildMemoryTraceResponsePayload({
            endpoint,
            requestId: reqId,
            promptMessages,
            traceTitle: 'HypaV3 Manual Summarization',
            shouldRun: true,
            reason: 'ready',
            provider: modelMeta.provider,
            model: modelMeta.model,
        });

        const durationMs = Date.now() - startedAt;
        logLLMExecutionEnd({
            reqId,
            endpoint,
            mode: 'memory',
            provider: modelMeta.provider || '-',
            characterId: characterId || '-',
            chatId: chatId || '-',
            status: 200,
            code: 'OK',
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint,
            mode: 'memory',
            provider: modelMeta.provider || null,
            characterId: characterId || null,
            chatId: chatId || null,
            streaming: false,
            status: 200,
            ok: true,
            durationMs,
            request: buildHypaV3AuditRequestPayload(endpoint, body),
            response: responsePayload,
        });
        sendJson(res, 200, responsePayload);
    } catch (error) {
        const durationMs = Date.now() - startedAt;
        const response = toLLMErrorResponse(error, {
            requestId: reqId,
            endpoint,
            durationMs,
        });
        logLLMExecutionEnd({
            reqId,
            endpoint,
            mode: 'memory',
            provider: '-',
            characterId: characterIdFromBody || '-',
            chatId: chatIdFromBody || '-',
            status: response.status,
            code: response.code,
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint,
            mode: 'memory',
            provider: null,
            characterId: characterIdFromBody || null,
            chatId: chatIdFromBody || null,
            streaming: false,
            status: response.status,
            ok: false,
            durationMs,
            request: buildHypaV3AuditRequestPayload(endpoint, body),
            error: response.payload,
        });
        sendJson(res, response.status, response.payload);
    }
});

app.post('/data/memory/hypav3/resummarize-preview/trace', async (req, res) => {
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'hypav3_resummarize_preview_trace';
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const characterIdFromBody = toStringOrEmpty(body.characterId);
    const chatIdFromBody = toStringOrEmpty(body.chatId);
    logLLMExecutionStart({
        reqId,
        endpoint,
        mode: 'memory',
        provider: '-',
        characterId: characterIdFromBody || '-',
        chatId: chatIdFromBody || '-',
        streaming: false,
    });
    try {
        const characterId = toStringOrEmpty(body.characterId);
        const chatId = toStringOrEmpty(body.chatId);
        const summaryIndices = Array.isArray(body.summaryIndices)
            ? [...new Set(body.summaryIndices.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0))].sort((a, b) => a - b)
            : [];

        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId is required and must be a safe id.');
        }
        if (!chatId || !isSafePathSegment(chatId)) {
            throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId is required and must be a safe id.');
        }
        if (summaryIndices.length < 2) {
            throw new LLMHttpError(400, 'INVALID_SUMMARY_SELECTION', 'Select at least two summaries to re-summarize.');
        }

        const settingsPath = path.join(dataDirs.root, 'settings.json');
        const charPath = path.join(dataDirs.characters, characterId, 'character.json');
        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(settingsPath)) throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        if (!existsSync(charPath)) throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        if (!existsSync(chatPath)) throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);

        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = (settingsRaw && typeof settingsRaw === 'object' && settingsRaw.data && typeof settingsRaw.data === 'object')
            ? settingsRaw.data
            : settingsRaw;
        const charRaw = JSON.parse(await fs.readFile(charPath, 'utf-8'));
        const character = charRaw.character || charRaw.data || charRaw || {};
        const chatRaw = JSON.parse(await fs.readFile(chatPath, 'utf-8'));
        const chat = chatRaw.chat || chatRaw.data || chatRaw || {};
        const hypaData = normalizeHypaV3DataForEdit(chat.hypaV3Data);

        const selectedSummaries = summaryIndices.map((index) => hypaData.summaries[index]).filter(Boolean);
        if (selectedSummaries.length !== summaryIndices.length) {
            throw new LLMHttpError(400, 'SUMMARY_INDEX_OUT_OF_RANGE', 'One or more selected summary indices are out of range.');
        }

        const promptSource = selectedSummaries.map((summary) => ({
            role: 'user',
            content: sanitizeHypaSummarizationContent(summary.text),
        })).filter((item) => item.content.length > 0);
        if (promptSource.length === 0) throw new LLMHttpError(400, 'NO_SUMMARIZABLE_MESSAGES', 'No valid summaries to re-summarize.');

        const hypaSettings = resolveHypaV3Settings(settings, character);
        const promptMessages = buildHypaSummarizationPromptMessages(
            promptSource,
            hypaSettings.reSummarizationPrompt,
            true
        );
        if (!promptMessages) throw new LLMHttpError(400, 'EMPTY_PROMPT_MESSAGES', 'Failed to build re-summarization prompt.');

        const modelMeta = resolveHypaSummaryProviderModel(settings, character);
        const responsePayload = buildMemoryTraceResponsePayload({
            endpoint,
            requestId: reqId,
            promptMessages,
            traceTitle: 'HypaV3 Re-summarization Preview',
            shouldRun: true,
            reason: 'ready',
            provider: modelMeta.provider,
            model: modelMeta.model,
        });

        const durationMs = Date.now() - startedAt;
        logLLMExecutionEnd({
            reqId,
            endpoint,
            mode: 'memory',
            provider: modelMeta.provider || '-',
            characterId: characterId || '-',
            chatId: chatId || '-',
            status: 200,
            code: 'OK',
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint,
            mode: 'memory',
            provider: modelMeta.provider || null,
            characterId: characterId || null,
            chatId: chatId || null,
            streaming: false,
            status: 200,
            ok: true,
            durationMs,
            request: buildHypaV3AuditRequestPayload('hypav3_resummarize_preview', body),
            response: responsePayload,
        });
        sendJson(res, 200, responsePayload);
    } catch (error) {
        const durationMs = Date.now() - startedAt;
        const response = toLLMErrorResponse(error, {
            requestId: reqId,
            endpoint,
            durationMs,
        });
        logLLMExecutionEnd({
            reqId,
            endpoint,
            mode: 'memory',
            provider: '-',
            characterId: characterIdFromBody || '-',
            chatId: chatIdFromBody || '-',
            status: response.status,
            code: response.code,
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint,
            mode: 'memory',
            provider: null,
            characterId: characterIdFromBody || null,
            chatId: chatIdFromBody || null,
            streaming: false,
            status: response.status,
            ok: false,
            durationMs,
            request: buildHypaV3AuditRequestPayload('hypav3_resummarize_preview', body),
            error: response.payload,
        });
        sendJson(res, response.status, response.payload);
    }
});

app.post('/data/memory/hypav3/periodic-summarize/trace', async (req, res) => {
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'hypav3_periodic_summarize_trace';
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const characterIdFromBody = toStringOrEmpty(body.characterId);
    const chatIdFromBody = toStringOrEmpty(body.chatId);
    logLLMExecutionStart({
        reqId,
        endpoint,
        mode: 'memory',
        provider: '-',
        characterId: characterIdFromBody || '-',
        chatId: chatIdFromBody || '-',
        streaming: false,
    });
    try {
        const characterId = toStringOrEmpty(body.characterId);
        const chatId = toStringOrEmpty(body.chatId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId is required and must be a safe id.');
        }
        if (!chatId || !isSafePathSegment(chatId)) {
            throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId is required and must be a safe id.');
        }

        const settingsPath = path.join(dataDirs.root, 'settings.json');
        const charPath = path.join(dataDirs.characters, characterId, 'character.json');
        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(settingsPath)) throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        if (!existsSync(charPath)) throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        if (!existsSync(chatPath)) throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);

        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = (settingsRaw && typeof settingsRaw === 'object' && settingsRaw.data && typeof settingsRaw.data === 'object')
            ? settingsRaw.data
            : settingsRaw;
        const charRaw = JSON.parse(await fs.readFile(charPath, 'utf-8'));
        const chatRaw = JSON.parse(await fs.readFile(chatPath, 'utf-8'));
        const character = charRaw.character || charRaw.data || charRaw || {};
        const chat = chatRaw.chat || chatRaw.data || chatRaw || {};

        const plan = planPeriodicHypaV3Summarization({
            character,
            chat,
            settings,
        });
        const promptMessages = Array.isArray(plan?.promptMessages) ? plan.promptMessages : [];
        const modelMeta = resolveHypaSummaryProviderModel(settings, character);

        const responsePayload = buildMemoryTraceResponsePayload({
            endpoint,
            requestId: reqId,
            promptMessages,
            traceTitle: 'HypaV3 Periodic Summarization',
            shouldRun: plan?.shouldRun === true,
            reason: toStringOrEmpty(plan?.reason) || 'not_planned',
            provider: modelMeta.provider,
            model: modelMeta.model,
        });

        const durationMs = Date.now() - startedAt;
        logLLMExecutionEnd({
            reqId,
            endpoint,
            mode: 'memory',
            provider: modelMeta.provider || '-',
            characterId: characterId || '-',
            chatId: chatId || '-',
            status: 200,
            code: 'OK',
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint,
            mode: 'memory',
            provider: modelMeta.provider || null,
            characterId: characterId || null,
            chatId: chatId || null,
            streaming: false,
            status: 200,
            ok: true,
            durationMs,
            request: buildHypaV3AuditRequestPayload('hypav3_periodic_summarize', body),
            response: responsePayload,
        });
        sendJson(res, 200, responsePayload);
    } catch (error) {
        const durationMs = Date.now() - startedAt;
        const response = toLLMErrorResponse(error, {
            requestId: reqId,
            endpoint,
            durationMs,
        });
        logLLMExecutionEnd({
            reqId,
            endpoint,
            mode: 'memory',
            provider: '-',
            characterId: characterIdFromBody || '-',
            chatId: chatIdFromBody || '-',
            status: response.status,
            code: response.code,
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint,
            mode: 'memory',
            provider: null,
            characterId: characterIdFromBody || null,
            chatId: chatIdFromBody || null,
            streaming: false,
            status: response.status,
            ok: false,
            durationMs,
            request: buildHypaV3AuditRequestPayload('hypav3_periodic_summarize', body),
            error: response.payload,
        });
        sendJson(res, response.status, response.payload);
    }
});
}

module.exports = {
    registerHypaV3TraceRoutes,
};
