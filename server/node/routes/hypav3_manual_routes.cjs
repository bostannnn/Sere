function registerHypaV3ManualRoutes(arg = {}) {
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
        appendMemoryTraceAudit,
        buildHypaV3AuditRequestPayload,
        buildHypaV3AuditResponsePayload,
        sendJson,
        toLLMErrorResponse,
        resolveHypaV3Settings,
        convertStoredMessageForHypaSummary,
        buildHypaSummarizationPromptMessages,
        executeHypaSummaryFromMessages,
        generateSummaryEmbedding,
        normalizeHypaV3DataForEdit,
        persistChatDataToRaw,
        normalizePromptOverride,
        applyPromptOverride,
        resolveManualPromptSource,
    } = arg;

    if (!app || typeof app.post !== 'function') {
        throw new Error('registerHypaV3ManualRoutes requires an Express app instance.');
    }
    if (typeof safeResolve !== 'function') {
        throw new Error('registerHypaV3ManualRoutes requires safeResolve.');
    }
    if (typeof normalizePromptOverride !== 'function'
        || typeof applyPromptOverride !== 'function'
        || typeof resolveManualPromptSource !== 'function') {
        throw new Error(
            'registerHypaV3ManualRoutes requires normalizePromptOverride/applyPromptOverride/resolveManualPromptSource.'
        );
    }

    app.post('/data/memory/hypav3/manual-summarize', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }

        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        const endpoint = 'hypav3_manual_summarize';
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
        let promptMessagesForTrace = [];
        const summaryModelMeta = { provider: null, model: null };
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
            const hypaSettings = resolveHypaV3Settings(settings, characterForRequest);
            const promptSource = resolveManualPromptSource(promptOverride, characterForRequest);
            const summarizable = [];
            const chatMemos = [];
            for (let i = 0; i < slice.length; i++) {
                const converted = convertStoredMessageForHypaSummary(slice[i]);
                if (!converted) continue;
                if (hypaSettings.doNotSummarizeUserMessage && converted.role === 'user') continue;
                if (toStringOrEmpty(converted.name).startsWith('example_')) continue;
                summarizable.push(converted);
                if (converted.memo) chatMemos.push(converted.memo);
            }
            if (summarizable.length === 0) throw new LLMHttpError(400, 'NO_SUMMARIZABLE_MESSAGES', 'No valid messages in selected range.');

            const promptMessages = buildHypaSummarizationPromptMessages(
                summarizable,
                hypaSettings.summarizationPrompt,
                false
            );
            if (!promptMessages) throw new LLMHttpError(400, 'EMPTY_PROMPT_MESSAGES', 'Failed to build summarization prompt.');
            promptMessagesForTrace = promptMessages;

            const summaryText = await executeHypaSummaryFromMessages({
                settings,
                character: characterForRequest,
                characterId,
                chatId,
                promptMessages,
                isResummarize: false,
                meta: summaryModelMeta,
            });
            if (!summaryText) throw new LLMHttpError(500, 'EMPTY_SUMMARY', 'Summarization returned empty output.');

            const hypaData = normalizeHypaV3DataForEdit(chat.hypaV3Data);
            let summaryEmbedding = null;
            try {
                summaryEmbedding = await generateSummaryEmbedding(summaryText, settings);
            } catch {
                summaryEmbedding = null;
            }
            hypaData.summaries.push({
                text: summaryText,
                chatMemos: [...new Set(chatMemos)],
                isImportant: false,
                categoryId: undefined,
                tags: [],
                ...(Array.isArray(summaryEmbedding) && summaryEmbedding.length > 0 ? { embedding: summaryEmbedding } : {}),
            });
            chat.hypaV3Data = hypaData;
            await fs.writeFile(chatPath, JSON.stringify(persistChatDataToRaw(chatRaw, chat), null, 2), 'utf-8');

            const debugPayload = {
                timestamp: Date.now(),
                model: toStringOrEmpty(summaryModelMeta.model) || '-',
                isResummarize: false,
                prompt: hypaSettings.summarizationPrompt,
                input: summarizable.map((item) => `${item.role}: ${toStringOrEmpty(item.content)}`).join('\n'),
                formatted: promptMessages.map((item) => ({
                    role: toStringOrEmpty(item.role),
                    content: toStringOrEmpty(item.content),
                })),
                rawResponse: summaryText,
                characterId,
                chatId,
                start: startIndex,
                end: endIndex,
                source: 'manual',
                promptSource,
            };

            const successPayload = {
                type: 'success',
                requestId: reqId,
                summary: summaryText,
                hypaV3Data: hypaData,
                debug: debugPayload,
            };
            const durationMs = Date.now() - startedAt;
            logLLMExecutionEnd({
                reqId,
                endpoint,
                mode: 'memory',
                provider: '-',
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
                provider: null,
                characterId: characterId || null,
                chatId: chatId || null,
                streaming: false,
                status: 200,
                ok: true,
                durationMs,
                request: buildHypaV3AuditRequestPayload(endpoint, body),
                response: buildHypaV3AuditResponsePayload(endpoint, successPayload),
            });
            await appendMemoryTraceAudit({
                req,
                reqId,
                endpoint,
                mode: 'memory',
                provider: summaryModelMeta.provider,
                characterId,
                chatId,
                status: 200,
                ok: true,
                durationMs,
                promptMessages: promptMessagesForTrace,
                request: buildHypaV3AuditRequestPayload(endpoint, body),
                path: `${req.originalUrl}/trace`,
                traceTitle: 'HypaV3 Manual Summarization',
            });
            sendJson(res, 200, successPayload);
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
            if (promptMessagesForTrace.length > 0) {
                await appendMemoryTraceAudit({
                    req,
                    reqId,
                    endpoint,
                    mode: 'memory',
                    provider: summaryModelMeta.provider,
                    characterId: characterIdFromBody || null,
                    chatId: chatIdFromBody || null,
                    status: response.status,
                    ok: false,
                    durationMs,
                    promptMessages: promptMessagesForTrace,
                    request: buildHypaV3AuditRequestPayload(endpoint, body),
                    path: `${req.originalUrl}/trace`,
                    traceTitle: 'HypaV3 Manual Summarization',
                    error: response.payload,
                });
            }
            sendJson(res, response.status, response.payload);
        }
    });
}

module.exports = {
    registerHypaV3ManualRoutes,
};
