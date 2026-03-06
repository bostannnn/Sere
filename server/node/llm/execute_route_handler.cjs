function createExecuteRouteHandler(arg = {}) {
    const path = arg.path;
    const dataDirs = arg.dataDirs || {};
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const readJsonWithEtag = typeof arg.readJsonWithEtag === 'function'
        ? arg.readJsonWithEtag
        : (async () => ({ json: {}, etag: '' }));
    const isSafePathSegment = typeof arg.isSafePathSegment === 'function'
        ? arg.isSafePathSegment
        : (() => false);
    const applyStateCommands = typeof arg.applyStateCommands === 'function'
        ? arg.applyStateCommands
        : null;
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
    const THOUGHT_BLOCK_REGEX = /<Thoughts>[\s\S]*?<\/Thoughts>\s*/gi;
    const THINK_BLOCK_REGEX = /<think>[\s\S]*?<\/think>\s*/gi;
    const DEEPSEEK_V32_SPECIALE_MODEL_ID = 'deepseek/deepseek-v3.2-speciale';

    function stripHiddenReasoningBlocks(text) {
        if (typeof text !== 'string') {
            return '';
        }
        return text
            .replace(THOUGHT_BLOCK_REGEX, '')
            .replace(THINK_BLOCK_REGEX, '')
            .trim();
    }

    function isDeepSeekV32SpecialeModel(model) {
        return typeof model === 'string' && model.trim().toLowerCase() === DEEPSEEK_V32_SPECIALE_MODEL_ID;
    }

    function shouldAllowReasoningOnlyOutput(normalized) {
        if (!normalized || normalized.mode !== 'model' || normalized.provider !== 'openrouter') {
            return false;
        }
        if (!isDeepSeekV32SpecialeModel(normalized.model)) {
            return false;
        }
        const request = (normalized.request && typeof normalized.request === 'object')
            ? normalized.request
            : {};
        return request.allowReasoningOnlyForDeepSeekV32Speciale === true;
    }

    function dedupeChunkByExistingSuffix(existing, incoming) {
        if (typeof incoming !== 'string' || !incoming) {
            return '';
        }
        if (typeof existing !== 'string' || !existing) {
            return incoming;
        }
        if (existing.endsWith(incoming)) {
            return '';
        }
        const maxOverlap = Math.min(existing.length, incoming.length);
        for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
            if (existing.slice(-overlap) === incoming.slice(0, overlap)) {
                return incoming.slice(overlap);
            }
        }
        return incoming;
    }

    function extractOpenRouterReasoningDelta(delta) {
        if (!delta || typeof delta !== 'object') {
            return '';
        }
        const chunks = [];
        if (typeof delta.reasoning === 'string' && delta.reasoning) {
            chunks.push(delta.reasoning);
        }
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
            chunks.push(delta.reasoning_content);
        }
        if (Array.isArray(delta.reasoning_details)) {
            for (const detail of delta.reasoning_details) {
                if (typeof detail === 'string') {
                    chunks.push(detail);
                    continue;
                }
                if (!detail || typeof detail !== 'object') continue;
                if (typeof detail.text === 'string' && detail.text) {
                    chunks.push(detail.text);
                } else if (Array.isArray(detail.text)) {
                    for (const textPart of detail.text) {
                        if (typeof textPart === 'string' && textPart) {
                            chunks.push(textPart);
                        } else if (textPart && typeof textPart === 'object' && typeof textPart.text === 'string' && textPart.text) {
                            chunks.push(textPart.text);
                        }
                    }
                }
                if (typeof detail.reasoning === 'string' && detail.reasoning) {
                    chunks.push(detail.reasoning);
                }
                if (typeof detail.content === 'string' && detail.content) {
                    chunks.push(detail.content);
                } else if (Array.isArray(detail.content)) {
                    for (const contentPart of detail.content) {
                        if (typeof contentPart === 'string' && contentPart) {
                            chunks.push(contentPart);
                        } else if (contentPart && typeof contentPart === 'object' && typeof contentPart.text === 'string' && contentPart.text) {
                            chunks.push(contentPart.text);
                        }
                    }
                }
            }
        }
        return chunks.join('');
    }

    function assertVisibleModelOutput(mode, text, opts = {}) {
        if (mode !== 'model') {
            return;
        }
        if (opts.allowReasoningOnly === true) {
            return;
        }
        const visible = stripHiddenReasoningBlocks(text);
        if (!visible) {
            throw new LLMHttpError(
                502,
                'EMPTY_VISIBLE_OUTPUT',
                'Model returned no visible content (empty or reasoning-only output).'
            );
        }
    }

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
                const nextCharacter = (char && typeof char === 'object') ? { ...char } : {};
                nextCharacter.gameState = { ...(nextCharacter.gameState || {}), ...updates };
                if (typeof applyStateCommands !== 'function') {
                    throw new Error('STATE_COMMANDS_UNAVAILABLE');
                }
                await applyStateCommands([
                    {
                        type: 'character.replace',
                        charId,
                        character: nextCharacter,
                    },
                ], 'llm.execute.game-state');
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
            const allowReasoningOnlyOutput = shouldAllowReasoningOnlyOutput(normalized);
            const treatOpenRouterReasoningAsContent = allowReasoningOnlyOutput && isDeepSeekV32SpecialeModel(normalized.model);
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
                let openrouterReasoningOpen = false;
                let sseBuffer = '';
                let clientDisconnected = false;

                const markClientDisconnected = () => {
                    clientDisconnected = true;
                };
                req.on('aborted', markClientDisconnected);
                req.on('close', markClientDisconnected);
                res.on('close', markClientDisconnected);

                const toDisconnectError = () => {
                    const disconnectError = new Error('Client disconnected during streaming response.');
                    disconnectError.code = 'CLIENT_DISCONNECTED';
                    return disconnectError;
                };

                const writeSSEEvent = async (payload) => {
                    if (clientDisconnected || res.writableEnded || res.destroyed) {
                        throw toDisconnectError();
                    }
                    const frame = `data: ${JSON.stringify(payload)}\n\n`;
                    if (res.write(frame)) {
                        return;
                    }
                    await new Promise((resolve, reject) => {
                        const onDrain = () => {
                            cleanup();
                            resolve();
                        };
                        const onClose = () => {
                            cleanup();
                            reject(toDisconnectError());
                        };
                        const onError = (error) => {
                            cleanup();
                            reject(error);
                        };
                        const cleanup = () => {
                            res.off('drain', onDrain);
                            res.off('close', onClose);
                            res.off('error', onError);
                        };
                        res.on('drain', onDrain);
                        res.on('close', onClose);
                        res.on('error', onError);
                    });
                };

                const extractTextFromEvent = (data) => {
                    const choice = data?.choices?.[0];
                    const delta = (choice && typeof choice.delta === 'object') ? choice.delta : {};
                    if (normalized.provider === 'openrouter') {
                        const reasoning = extractOpenRouterReasoningDelta(delta);
                        const content = typeof delta.content === 'string' ? delta.content : '';
                        if (treatOpenRouterReasoningAsContent) {
                            return `${reasoning || ''}${content || ''}`;
                        }
                        let openRouterText = '';
                        if (reasoning) {
                            if (!openrouterReasoningOpen) {
                                openRouterText += '<Thoughts>\n';
                                openrouterReasoningOpen = true;
                            }
                            openRouterText += reasoning;
                        }
                        if (content) {
                            if (openrouterReasoningOpen) {
                                openRouterText += '</Thoughts>\n\n';
                                openrouterReasoningOpen = false;
                            }
                            openRouterText += content;
                        }
                        if (openRouterText) {
                            return openRouterText;
                        }
                    }

                    let text = typeof delta.content === 'string' ? delta.content : '';
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
                    return text;
                };

                const handleSSEEventBlock = async (rawEvent) => {
                    if (!rawEvent || !rawEvent.trim()) return;
                    const lines = rawEvent.split('\n');
                    const dataLines = [];
                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            dataLines.push(line.slice(5).trimStart());
                        }
                    }
                    if (dataLines.length === 0) return;
                    const payload = dataLines.join('\n').trim();
                    if (!payload || payload === '[DONE]') return;
                    let data = null;
                    try {
                        data = JSON.parse(payload);
                    } catch {
                        return;
                    }
                    const text = extractTextFromEvent(data);
                    if (!text) return;
                    const emittedText = treatOpenRouterReasoningAsContent
                        ? dedupeChunkByExistingSuffix(fullText, text)
                        : text;
                    if (!emittedText) return;
                    fullText += emittedText;
                    await writeSSEEvent({ type: 'chunk', text: emittedText });
                };

                const flushSSEBuffer = async (flushTrailing = false) => {
                    let splitIndex = sseBuffer.indexOf('\n\n');
                    while (splitIndex !== -1) {
                        const eventBlock = sseBuffer.slice(0, splitIndex);
                        sseBuffer = sseBuffer.slice(splitIndex + 2);
                        await handleSSEEventBlock(eventBlock);
                        splitIndex = sseBuffer.indexOf('\n\n');
                    }
                    if (flushTrailing && sseBuffer.trim()) {
                        const trailingEvent = sseBuffer;
                        sseBuffer = '';
                        await handleSSEEventBlock(trailingEvent);
                    }
                };

                try {
                    while (true) {
                        if (clientDisconnected) {
                            throw toDisconnectError();
                        }
                        const { done, value } = await reader.read();
                        if (done) break;
                        sseBuffer += decoder.decode(value, { stream: true });
                        await flushSSEBuffer(false);
                    }
                    sseBuffer += decoder.decode();
                    await flushSSEBuffer(true);

                    if (anthropicThinkingOpen) {
                        fullText += '</Thoughts>\n\n';
                        await writeSSEEvent({ type: 'chunk', text: '</Thoughts>\n\n' });
                        anthropicThinkingOpen = false;
                    }
                    if (openrouterReasoningOpen && !treatOpenRouterReasoningAsContent) {
                        fullText += '</Thoughts>\n\n';
                        await writeSSEEvent({ type: 'chunk', text: '</Thoughts>\n\n' });
                        openrouterReasoningOpen = false;
                    }

                    assertVisibleModelOutput(normalized.mode, fullText, {
                        allowReasoningOnly: allowReasoningOnlyOutput,
                    });

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

                    await writeSSEEvent({ type: 'done', newCharEtag });
                } catch (err) {
                    const disconnected = clientDisconnected || err?.code === 'CLIENT_DISCONNECTED';
                    const durationMs = Date.now() - startedAt;
                    const status = disconnected
                        ? 499
                        : (err instanceof LLMHttpError && Number.isFinite(Number(err.status))
                            ? Number(err.status)
                            : 500);
                    const errorCode = disconnected
                        ? 'CLIENT_DISCONNECTED'
                        : (err instanceof LLMHttpError && typeof err.code === 'string' && err.code
                            ? err.code
                            : 'STREAM_ERROR');
                    if (!disconnected) {
                        console.error('[LLMAPI] Stream error:', err);
                    }
                    logLLMExecutionEnd({
                        reqId,
                        endpoint: normalized.endpoint,
                        mode: normalized.mode,
                        provider: normalized.provider,
                        characterId: normalized.characterId,
                        chatId: normalized.chatId,
                        status,
                        code: errorCode,
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
                        status,
                        ok: false,
                        durationMs,
                        ragMeta: normalized._ragMeta || null,
                        request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                        error: {
                            error: errorCode,
                            message: String(err),
                        },
                    });
                    await appendGenerateTraceAudit({
                        req,
                        reqId,
                        normalized,
                        durationMs,
                        status,
                        ok: false,
                        error: {
                            error: errorCode,
                            message: String(err),
                        },
                    });
                    if (!disconnected && !res.writableEnded && !res.destroyed) {
                        try {
                            await writeSSEEvent({
                                type: 'fail',
                                status,
                                error: errorCode,
                                message: String(err),
                            });
                        } catch {}
                    }
                } finally {
                    req.off('aborted', markClientDisconnected);
                    req.off('close', markClientDisconnected);
                    res.off('close', markClientDisconnected);
                    try {
                        await reader.cancel();
                    } catch {}
                    try {
                        reader.releaseLock();
                    } catch {}
                    if (!res.writableEnded && !res.destroyed) {
                        try {
                            res.end();
                        } catch {}
                    }
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
            assertVisibleModelOutput(normalized.mode, responseText, {
                allowReasoningOnly: allowReasoningOnlyOutput,
            });
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
                let clientDisconnected = false;
                const markClientDisconnected = () => {
                    clientDisconnected = true;
                };
                req.on('aborted', markClientDisconnected);
                req.on('close', markClientDisconnected);
                res.on('close', markClientDisconnected);

                const writeRawFrame = async (frame) => {
                    if (clientDisconnected || res.writableEnded || res.destroyed) {
                        return;
                    }
                    if (res.write(frame)) {
                        return;
                    }
                    await new Promise((resolve, reject) => {
                        const onDrain = () => {
                            cleanup();
                            resolve();
                        };
                        const onClose = () => {
                            cleanup();
                            resolve();
                        };
                        const onError = (error) => {
                            cleanup();
                            reject(error);
                        };
                        const cleanup = () => {
                            res.off('drain', onDrain);
                            res.off('close', onClose);
                            res.off('error', onError);
                        };
                        res.on('drain', onDrain);
                        res.on('close', onClose);
                        res.on('error', onError);
                    });
                };

                try {
                    if (sanitizedResponseText) {
                        await writeRawFrame(`data: ${JSON.stringify({ type: 'chunk', text: sanitizedResponseText })}\n\n`);
                    }
                    await writeRawFrame(`data: ${JSON.stringify({ type: 'done', newCharEtag })}\n\n`);
                    await writeRawFrame('data: [DONE]\n\n');
                } catch (streamWriteError) {
                    if (!clientDisconnected) {
                        console.error('[LLMAPI] Fallback SSE write error:', streamWriteError);
                    }
                } finally {
                    req.off('aborted', markClientDisconnected);
                    req.off('close', markClientDisconnected);
                    res.off('close', markClientDisconnected);
                    if (!res.writableEnded && !res.destroyed) {
                        try {
                            res.end();
                        } catch {}
                    }
                }
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
