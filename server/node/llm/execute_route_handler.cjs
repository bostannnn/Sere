function createExecuteRouteHandler(arg = {}) {
    const path = arg.path;
    const dataDirs = arg.dataDirs || {};
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const readJsonWithEtag = typeof arg.readJsonWithEtag === 'function'
        ? arg.readJsonWithEtag
        : (async () => ({ json: {}, etag: '' }));
    const writeJsonWithEtag = typeof arg.writeJsonWithEtag === 'function'
        ? arg.writeJsonWithEtag
        : (async () => ({}));
    const isSafePathSegment = typeof arg.isSafePathSegment === 'function'
        ? arg.isSafePathSegment
        : (() => false);
    const getReqIdFromResponse = typeof arg.getReqIdFromResponse === 'function'
        ? arg.getReqIdFromResponse
        : (() => '-');
    const parseLLMExecutionInput = typeof arg.parseLLMExecutionInput === 'function'
        ? arg.parseLLMExecutionInput
        : (() => ({}));
    const isInternalExecutionRequest = typeof arg.isInternalExecutionRequest === 'function'
        ? arg.isInternalExecutionRequest
        : (() => false);
    const LLMHttpError = arg.LLMHttpError;
    const logLLMExecutionStart = typeof arg.logLLMExecutionStart === 'function'
        ? arg.logLLMExecutionStart
        : (() => {});
    const executeLLM = typeof arg.executeLLM === 'function'
        ? arg.executeLLM
        : (async () => ({}));
    const logLLMExecutionEnd = typeof arg.logLLMExecutionEnd === 'function'
        ? arg.logLLMExecutionEnd
        : (() => {});
    const appendLLMAudit = typeof arg.appendLLMAudit === 'function'
        ? arg.appendLLMAudit
        : (async () => {});
    const buildExecutionAuditRequest = typeof arg.buildExecutionAuditRequest === 'function'
        ? arg.buildExecutionAuditRequest
        : ((_, body) => body);
    const appendGenerateTraceAudit = typeof arg.appendGenerateTraceAudit === 'function'
        ? arg.appendGenerateTraceAudit
        : (async () => {});
    const sanitizeOutputByMode = typeof arg.sanitizeOutputByMode === 'function'
        ? arg.sanitizeOutputByMode
        : ((_, text) => text);
    const toLLMErrorResponse = typeof arg.toLLMErrorResponse === 'function'
        ? arg.toLLMErrorResponse
        : ((error) => ({
            status: 500,
            code: 'INTERNAL_ERROR',
            payload: {
                error: 'INTERNAL_ERROR',
                message: String(error?.message || error || 'Internal Error'),
            },
        }));
    const sendSSE = typeof arg.sendSSE === 'function'
        ? arg.sendSSE
        : (() => {});
    const sendJson = typeof arg.sendJson === 'function'
        ? arg.sendJson
        : (() => {});
    const gameStateWriteQueue = new Map();

    async function enqueueGameStateWrite(characterId, task) {
        const prev = gameStateWriteQueue.get(characterId) || Promise.resolve();
        const next = prev
            .then(() => task(), () => task())
            .finally(() => {
                if (gameStateWriteQueue.get(characterId) === next) {
                    gameStateWriteQueue.delete(characterId);
                }
            });
        gameStateWriteQueue.set(characterId, next);
        return next;
    }

    async function updateGameStateFromMessage(charId, text) {
        if (!isSafePathSegment(charId)) return;
        const charPath = path.join(dataDirs.characters, charId, 'character.json');
        await enqueueGameStateWrite(charId, async () => {
            if (!existsSync(charPath)) return;

            const systemMatch = text.match(/\[SYSTEM\]:?\s*([\s\S]+)$/i);
            if (!systemMatch) return;

            const systemBlock = systemMatch[1];
            if (!systemBlock) return;

            const { json: charData } = await readJsonWithEtag(charPath);
            const char = charData.character || charData.data || charData;

            const stateRegex = /\[([^:\]]+):\s*([^\]]+?)(?=\s*\](?:\s*\[|$))/g;
            const fallbackRegex = /\[([^:\]]+):\s*([^\]]+)\]/g;

            let match;
            const updates = {};

            const processMatch = (m) => {
                const key = String(m[1] || '').trim();
                let value = String(m[2] || '').trim();
                if (key.toLowerCase().includes('source') || key.toLowerCase().includes('page')) return;
                if (value.toLowerCase().includes(' p.') || (value.includes(',') && key.toLowerCase().includes('source'))) return;

                let normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
                const prefixesToStrip = ['active_', 'current_', 'remaining_', 'main_'];
                for (const prefix of prefixesToStrip) {
                    if (normalizedKey.startsWith(prefix)) {
                        normalizedKey = normalizedKey.slice(prefix.length);
                        break;
                    }
                }

                if (!isNaN(Number(value)) && value !== '' && !value.includes('/')) {
                    value = Number(value);
                }
                updates[normalizedKey] = value;
            };

            while ((match = stateRegex.exec(systemBlock)) !== null) processMatch(match);
            if (Object.keys(updates).length === 0) {
                while ((match = fallbackRegex.exec(systemBlock)) !== null) processMatch(match);
            }

            if (Object.keys(updates).length > 0) {
                char.gameState = { ...(char.gameState || {}), ...updates };
                await writeJsonWithEtag(charPath, charData);
                console.log(`[RAG-State] Server Autonomous Update for ${charId}:`, updates);
            }
        });
    }

    async function handleLLMExecutePost(req, res, requestBody, endpointName = 'execute') {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        let normalized = null;
        let wantsStream = !!requestBody?.streaming;
        try {
            normalized = parseLLMExecutionInput(requestBody, { endpoint: endpointName });
            wantsStream = !!normalized.requestedStreaming;
            const auditEndpointForRequest = endpointName === 'generate' ? 'generate' : normalized.endpoint;
            logLLMExecutionStart({
                reqId,
                endpoint: normalized.endpoint,
                mode: normalized.mode,
                provider: normalized.provider,
                characterId: normalized.characterId,
                chatId: normalized.chatId,
                streaming: !!normalized.requestedStreaming,
            });

            if (
                normalized.endpoint === 'execute' &&
                normalized.mode === 'model' &&
                normalized.characterId &&
                normalized.chatId &&
                !isInternalExecutionRequest(normalized.request)
            ) {
                throw new LLMHttpError(
                    400,
                    'MODEL_MODE_REQUIRES_GENERATE',
                    'Use /data/llm/generate for mode=model requests with characterId and chatId.'
                );
            }

            const result = await executeLLM(normalized, { dataRoot: arg.dataRoot });

            if (normalized.streaming && result && typeof result.getReader === 'function') {
                res.status(200);
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                const reader = result.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let anthropicThinkingOpen = false;

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');
                        for (const line of lines) {
                            if (!line.trim() || line.includes('[DONE]')) continue;
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    let text = data.choices?.[0]?.delta?.content || '';
                                    if (!text && normalized.provider === 'anthropic') {
                                        const dtype = data?.delta?.type;
                                        if (dtype === 'text' || dtype === 'text_delta') {
                                            if (anthropicThinkingOpen) {
                                                text += '</Thoughts>\n\n';
                                                anthropicThinkingOpen = false;
                                            }
                                            text += data?.delta?.text || '';
                                        } else if (dtype === 'thinking' || dtype === 'thinking_delta') {
                                            if (!anthropicThinkingOpen) {
                                                text += '<Thoughts>\n';
                                                anthropicThinkingOpen = true;
                                            }
                                            text += data?.delta?.thinking || '';
                                        } else if (dtype === 'redacted_thinking') {
                                            if (!anthropicThinkingOpen) {
                                                text += '<Thoughts>\n';
                                                anthropicThinkingOpen = true;
                                            }
                                            text += '\n{{redacted_thinking}}\n';
                                        }
                                    }
                                    if (!text && normalized.provider === 'google') {
                                        const parts = Array.isArray(data?.candidates?.[0]?.content?.parts)
                                            ? data.candidates[0].content.parts
                                            : [];
                                        for (const part of parts) {
                                            if (!part || typeof part !== 'object' || typeof part.text !== 'string' || !part.text) {
                                                continue;
                                            }
                                            if (part.thought === true) continue;
                                            text += part.text;
                                        }
                                    }
                                    fullText += text;
                                    res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
                                } catch {}
                            }
                        }
                    }

                    if (anthropicThinkingOpen) {
                        fullText += '</Thoughts>\n\n';
                        res.write(`data: ${JSON.stringify({ type: 'chunk', text: '</Thoughts>\n\n' })}\n\n`);
                        anthropicThinkingOpen = false;
                    }

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

                    let newCharEtag = null;
                    if (normalized.characterId && fullText) {
                        await updateGameStateFromMessage(normalized.characterId, fullText);
                        try {
                            const charPath = path.join(dataDirs.characters, normalized.characterId, 'character.json');
                            const { etag } = await readJsonWithEtag(charPath);
                            newCharEtag = etag;
                        } catch {}
                    }

                    await appendLLMAudit({
                        requestId: reqId,
                        method: req.method,
                        path: req.originalUrl,
                        endpoint: normalized.endpoint,
                        mode: normalized.mode,
                        provider: normalized.provider,
                        characterId: normalized.characterId || null,
                        chatId: normalized.chatId || null,
                        streaming: true,
                        status: 200,
                        ok: true,
                        durationMs,
                        ragMeta: normalized._ragMeta || null,
                        request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                        response: {
                            type: 'success',
                            requestId: reqId,
                            result: fullText,
                            newCharEtag,
                        },
                    });
                    await appendGenerateTraceAudit({
                        req,
                        reqId,
                        normalized,
                        durationMs,
                        status: 200,
                        ok: true,
                    });

                    res.write(`data: ${JSON.stringify({ type: 'done', newCharEtag })}\n\n`);
                    res.end();
                } catch (err) {
                    console.error('[LLMAPI] Stream error:', err);
                    const durationMs = Date.now() - startedAt;
                    logLLMExecutionEnd({
                        reqId,
                        endpoint: normalized.endpoint,
                        mode: normalized.mode,
                        provider: normalized.provider,
                        characterId: normalized.characterId,
                        chatId: normalized.chatId,
                        status: 500,
                        code: 'STREAM_ERROR',
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
                        streaming: true,
                        status: 500,
                        ok: false,
                        durationMs,
                        ragMeta: normalized._ragMeta || null,
                        request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                        error: {
                            error: 'STREAM_ERROR',
                            message: String(err),
                        },
                    });
                    await appendGenerateTraceAudit({
                        req,
                        reqId,
                        normalized,
                        durationMs,
                        status: 500,
                        ok: false,
                        error: {
                            error: 'STREAM_ERROR',
                            message: String(err),
                        },
                    });
                    res.write(`data: ${JSON.stringify({ type: 'error', message: String(err) })}\n\n`);
                    res.end();
                }
                return;
            }

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

            const executionResult = (result && typeof result === 'object') ? result : null;
            const responseText =
                typeof executionResult?.result === 'string'
                    ? executionResult.result
                    : (typeof result === 'string' ? result : '');
            let sanitizedResponseText = sanitizeOutputByMode(normalized.mode, responseText);
            if (normalized.mode === 'emotion' && !sanitizedResponseText) {
                sanitizedResponseText = 'neutral';
            }
            const responseType =
                typeof executionResult?.type === 'string'
                    ? executionResult.type
                    : 'success';
            const responseModel =
                typeof executionResult?.model === 'string'
                    ? executionResult.model
                    : null;

            const successPayload = {
                type: responseType,
                requestId: reqId,
                result: sanitizedResponseText,
                ...(responseModel ? { model: responseModel } : {}),
            };

            let newCharEtag = null;
            if (normalized.characterId && sanitizedResponseText) {
                await updateGameStateFromMessage(normalized.characterId, sanitizedResponseText);
                try {
                    const charPath = path.join(dataDirs.characters, normalized.characterId, 'character.json');
                    const { etag } = await readJsonWithEtag(charPath);
                    newCharEtag = etag;
                } catch {}
            }

            successPayload.newCharEtag = newCharEtag;

            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: normalized.endpoint,
                mode: normalized.mode,
                provider: normalized.provider,
                characterId: normalized.characterId || null,
                chatId: normalized.chatId || null,
                streaming: !!normalized.requestedStreaming,
                status: 200,
                ok: true,
                durationMs,
                ragMeta: normalized._ragMeta || null,
                request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                response: successPayload,
            });
            await appendGenerateTraceAudit({
                req,
                reqId,
                normalized,
                durationMs,
                status: 200,
                ok: true,
            });

            if (normalized.requestedStreaming) {
                res.status(200);
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                if (sanitizedResponseText) {
                    res.write(`data: ${JSON.stringify({ type: 'chunk', text: sanitizedResponseText })}\n\n`);
                }
                res.write(`data: ${JSON.stringify({ type: 'done', newCharEtag })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            }

            sendJson(res, 200, successPayload);
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const endpoint = normalized?.endpoint || endpointName;
            const auditEndpointForRequest = endpointName === 'generate' ? 'generate' : endpoint;
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
                streaming: wantsStream,
                status: response.status,
                ok: false,
                durationMs,
                request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                error: response.payload,
            });
            await appendGenerateTraceAudit({
                req,
                reqId,
                normalized,
                durationMs,
                status: response.status,
                ok: false,
                error: response.payload,
            });
            if (wantsStream) {
                sendSSE(res, {
                    type: 'fail',
                    status: response.status,
                    ...response.payload,
                });
                return;
            }
            sendJson(res, response.status, response.payload);
        }
    }

    return {
        updateGameStateFromMessage,
        handleLLMExecutePost,
    };
}

module.exports = {
    createExecuteRouteHandler,
};
