function registerMemoryTraceRoutes(arg = {}) {
    const {
        app,
        fs,
        dataDirs,
        existsSync,
        LLMHttpError,
        isSafePathSegment,
        requirePasswordAuth,
        safeResolve,
        getReqIdFromResponse,
        toStringOrEmpty,
        logLLMExecutionStart,
        logLLMExecutionEnd,
        appendLLMAudit,
        buildMemoryAuditRequestPayload,
        sendJson,
        toLLMErrorResponse,
        resolveMemorySettings,
        convertStoredMessageForMemorySummary,
        buildMemorySummarizationPromptMessages,
        resolveMemorySummaryProviderModel,
        buildMemoryTraceResponsePayload,
        planPeriodicMemorySummarization,
        normalizePromptOverride,
        applyPromptOverride,
    } = arg;

    if (!app || typeof app.post !== 'function') {
        throw new Error('registerMemoryTraceRoutes requires an Express app instance.');
    }
    if (typeof safeResolve !== 'function') {
        throw new Error('registerMemoryTraceRoutes requires safeResolve.');
    }
    if (typeof normalizePromptOverride !== 'function' || typeof applyPromptOverride !== 'function') {
        throw new Error('registerMemoryTraceRoutes requires normalizePromptOverride/applyPromptOverride.');
    }

const manualTraceHandler = async (req, res) => {
    if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
        return;
    }

    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'memory_manual_summarize_trace';
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

        let settingsPath = '';
        let charPath = '';
        let chatPath = '';
        try {
            settingsPath = safeResolve(dataDirs.root, 'settings.json');
            const characterDir = safeResolve(dataDirs.characters, characterId);
            charPath = safeResolve(characterDir, 'character.json');
            chatPath = safeResolve(characterDir, `chats/${chatId}.json`);
        } catch {
            throw new LLMHttpError(400, 'INVALID_PATH', 'Invalid characterId/chatId path segments.');
        }
        if (!existsSync(settingsPath)) throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        if (!existsSync(charPath)) throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        if (!existsSync(chatPath)) throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);

        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = (settingsRaw && typeof settingsRaw === 'object' && settingsRaw.data && typeof settingsRaw.data === 'object')
            ? settingsRaw.data
            : settingsRaw;
        const charRaw = JSON.parse(await fs.readFile(charPath, 'utf-8'));
        const character = charRaw.character || charRaw.data || charRaw || {};
        const promptOverride = normalizePromptOverride(body.promptOverride);
        const characterForRequest = applyPromptOverride(character, promptOverride);
        const chatRaw = JSON.parse(await fs.readFile(chatPath, 'utf-8'));
        const chat = chatRaw.chat || chatRaw.data || chatRaw || {};
        const sourceMessages = Array.isArray(chat?.message) ? chat.message.filter((m) => m && m.disabled !== true) : [];
        const maxCount = sourceMessages.length;
        if (maxCount === 0) throw new LLMHttpError(400, 'NO_MESSAGES', 'No chat messages to summarize.');

        const startIndex = Math.max(1, Math.min(start, maxCount));
        const endIndex = Math.max(startIndex, Math.min(end, maxCount));
        const slice = sourceMessages.slice(startIndex - 1, endIndex);
        const memorySettings = resolveMemorySettings(settings, characterForRequest);
        const summarizable = [];
        for (let i = 0; i < slice.length; i++) {
            const converted = convertStoredMessageForMemorySummary(slice[i]);
            if (!converted) continue;
            if (memorySettings.doNotSummarizeUserMessage && converted.role === 'user') continue;
            if (toStringOrEmpty(converted.name).startsWith('example_')) continue;
            summarizable.push(converted);
        }
        if (summarizable.length === 0) throw new LLMHttpError(400, 'NO_SUMMARIZABLE_MESSAGES', 'No valid messages in selected range.');

        const promptMessages = buildMemorySummarizationPromptMessages(
            summarizable,
            memorySettings.summarizationPrompt,
            false
        );
        if (!promptMessages) throw new LLMHttpError(400, 'EMPTY_PROMPT_MESSAGES', 'Failed to build summarization prompt.');

        const modelMeta = resolveMemorySummaryProviderModel(settings, characterForRequest);
        const responsePayload = buildMemoryTraceResponsePayload({
            endpoint,
            requestId: reqId,
            promptMessages,
            traceTitle: 'Memory Manual Summarization',
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
            request: buildMemoryAuditRequestPayload(endpoint, body),
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
            request: buildMemoryAuditRequestPayload(endpoint, body),
            error: response.payload,
        });
        sendJson(res, response.status, response.payload);
    }
};

const periodicTraceHandler = async (req, res) => {
    if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
        return;
    }

    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'memory_periodic_summarize_trace';
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

        let settingsPath = '';
        let charPath = '';
        let chatPath = '';
        try {
            settingsPath = safeResolve(dataDirs.root, 'settings.json');
            const characterDir = safeResolve(dataDirs.characters, characterId);
            charPath = safeResolve(characterDir, 'character.json');
            chatPath = safeResolve(characterDir, `chats/${chatId}.json`);
        } catch {
            throw new LLMHttpError(400, 'INVALID_PATH', 'Invalid characterId/chatId path segments.');
        }
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

        const plan = planPeriodicMemorySummarization({
            character,
            chat,
            settings,
        });
        const promptMessages = Array.isArray(plan?.promptMessages) ? plan.promptMessages : [];
        const modelMeta = resolveMemorySummaryProviderModel(settings, character);

        const responsePayload = buildMemoryTraceResponsePayload({
            endpoint,
            requestId: reqId,
            promptMessages,
            traceTitle: 'Memory Periodic Summarization',
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
            request: buildMemoryAuditRequestPayload('memory_periodic_summarize', body),
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
            request: buildMemoryAuditRequestPayload('memory_periodic_summarize', body),
            error: response.payload,
        });
        sendJson(res, response.status, response.payload);
    }
};

app.post('/data/memory/manual-summarize/trace', manualTraceHandler);
app.post('/data/memory/periodic-summarize/trace', periodicTraceHandler);
}

module.exports = {
    registerMemoryTraceRoutes,
};
