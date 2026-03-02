function registerHypaV3ResummaryRoutes(arg = {}) {
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
        appendMemoryTraceAudit,
        buildHypaV3AuditRequestPayload,
        buildHypaV3AuditResponsePayload,
        sendJson,
        toLLMErrorResponse,
        resolveHypaV3Settings,
        normalizeHypaV3DataForEdit,
        sanitizeHypaSummarizationContent,
        buildHypaSummarizationPromptMessages,
        executeHypaSummaryFromMessages,
        cleanSummaryOutput,
        generateSummaryEmbedding,
        persistChatDataToRaw,
    } = arg;

app.post('/data/memory/hypav3/resummarize-preview', async (req, res) => {
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'hypav3_resummarize_preview';
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
        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(settingsPath)) throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        if (!existsSync(chatPath)) throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);

        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = (settingsRaw && typeof settingsRaw === 'object' && settingsRaw.data && typeof settingsRaw.data === 'object')
            ? settingsRaw.data
            : settingsRaw;
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

        const hypaSettings = resolveHypaV3Settings(settings);
        const promptMessages = buildHypaSummarizationPromptMessages(
            promptSource,
            hypaSettings.reSummarizationPrompt,
            true
        );
        if (!promptMessages) throw new LLMHttpError(400, 'EMPTY_PROMPT_MESSAGES', 'Failed to build re-summarization prompt.');
        promptMessagesForTrace = promptMessages;

        const summaryText = await executeHypaSummaryFromMessages({
            settings,
            characterId,
            chatId,
            promptMessages,
            isResummarize: true,
            meta: summaryModelMeta,
        });
        if (!summaryText) throw new LLMHttpError(500, 'EMPTY_SUMMARY', 'Re-summarization returned empty output.');

        const mergedChatMemos = [...new Set(
            selectedSummaries.flatMap((summary) => Array.isArray(summary.chatMemos) ? summary.chatMemos : [])
                .map((v) => toStringOrEmpty(v))
                .filter(Boolean)
        )];

        const successPayload = {
            type: 'success',
            requestId: reqId,
            summary: summaryText,
            selectedIndices: summaryIndices,
            mergedChatMemos,
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
            traceTitle: 'HypaV3 Re-summarization Preview',
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
                traceTitle: 'HypaV3 Re-summarization Preview',
                error: response.payload,
            });
        }
        sendJson(res, response.status, response.payload);
    }
});

app.post('/data/memory/hypav3/resummarize-apply', async (req, res) => {
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const endpoint = 'hypav3_resummarize_apply';
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
        const summaryText = cleanSummaryOutput(body.summary);
        const summaryIndices = Array.isArray(body.summaryIndices)
            ? [...new Set(body.summaryIndices.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v >= 0))].sort((a, b) => a - b)
            : [];
        const mergedChatMemosInput = Array.isArray(body.mergedChatMemos)
            ? [...new Set(body.mergedChatMemos.map((v) => toStringOrEmpty(v)).filter(Boolean))]
            : null;

        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId is required and must be a safe id.');
        }
        if (!chatId || !isSafePathSegment(chatId)) {
            throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId is required and must be a safe id.');
        }
        if (summaryIndices.length < 2) {
            throw new LLMHttpError(400, 'INVALID_SUMMARY_SELECTION', 'Select at least two summaries to apply re-summarization.');
        }
        if (!summaryText) {
            throw new LLMHttpError(400, 'EMPTY_SUMMARY', 'summary is required.');
        }

        const settingsPath = path.join(dataDirs.root, 'settings.json');
        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(settingsPath)) throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        if (!existsSync(chatPath)) throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);

        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = (settingsRaw && typeof settingsRaw === 'object' && settingsRaw.data && typeof settingsRaw.data === 'object')
            ? settingsRaw.data
            : settingsRaw;
        const chatRaw = JSON.parse(await fs.readFile(chatPath, 'utf-8'));
        const chat = chatRaw.chat || chatRaw.data || chatRaw || {};
        const hypaData = normalizeHypaV3DataForEdit(chat.hypaV3Data);
        const selectedSummaries = summaryIndices.map((index) => hypaData.summaries[index]).filter(Boolean);
        if (selectedSummaries.length !== summaryIndices.length) {
            throw new LLMHttpError(400, 'SUMMARY_INDEX_OUT_OF_RANGE', 'One or more selected summary indices are out of range.');
        }

        const mergedChatMemos = mergedChatMemosInput && mergedChatMemosInput.length > 0
            ? mergedChatMemosInput
            : [...new Set(
                selectedSummaries.flatMap((summary) => Array.isArray(summary.chatMemos) ? summary.chatMemos : [])
                    .map((v) => toStringOrEmpty(v))
                    .filter(Boolean)
            )];

        const minIndex = summaryIndices[0];
        const baseSummary = hypaData.summaries[minIndex];
        let summaryEmbedding = null;
        try {
            summaryEmbedding = await generateSummaryEmbedding(summaryText, settings);
        } catch {
            summaryEmbedding = null;
        }
        hypaData.summaries[minIndex] = {
            text: summaryText,
            chatMemos: mergedChatMemos,
            isImportant: baseSummary?.isImportant === true,
            categoryId: toStringOrEmpty(baseSummary?.categoryId) || undefined,
            tags: Array.isArray(baseSummary?.tags) ? baseSummary.tags : [],
            ...(Array.isArray(summaryEmbedding) && summaryEmbedding.length > 0 ? { embedding: summaryEmbedding } : {}),
        };
        for (let i = summaryIndices.length - 1; i > 0; i--) {
            hypaData.summaries.splice(summaryIndices[i], 1);
        }

        chat.hypaV3Data = hypaData;
        await fs.writeFile(chatPath, JSON.stringify(persistChatDataToRaw(chatRaw, chat), null, 2), 'utf-8');

        const successPayload = {
            type: 'success',
            requestId: reqId,
            summary: summaryText,
            mergedChatMemos,
            hypaV3Data: hypaData,
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
        sendJson(res, response.status, response.payload);
    }
});
}

module.exports = {
    registerHypaV3ResummaryRoutes,
};
