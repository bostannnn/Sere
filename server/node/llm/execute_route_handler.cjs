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
    const readStateLastEventId = typeof arg.readStateLastEventId === 'function'
        ? arg.readStateLastEventId
        : (async () => 0);
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
        const maxOverlap = Math.min(existing.length, incoming.length);
        for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
            if (existing.slice(-overlap) === incoming.slice(0, overlap)) {
                if (overlap >= incoming.length) {
                    return '';
                }
                return incoming.slice(overlap);
            }
        }
        return incoming;
    }

    function isObjectRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function extractExecutionResultText(result) {
        const executionResult = (result && typeof result === 'object') ? result : null;
        return typeof executionResult?.result === 'string'
            ? executionResult.result
            : (typeof result === 'string' ? result : '');
    }

    function cloneExecutionRequestChain(value) {
        if (Array.isArray(value)) {
            return value.map((entry) => cloneExecutionRequestChain(entry));
        }
        if (!isObjectRecord(value)) {
            return value;
        }

        const clone = {};
        Object.defineProperties(clone, Object.getOwnPropertyDescriptors(value));

        if (Object.prototype.hasOwnProperty.call(value, 'request') && isObjectRecord(value.request)) {
            clone.request = cloneExecutionRequestChain(value.request);
        }
        if (Object.prototype.hasOwnProperty.call(value, 'requestBody') && isObjectRecord(value.requestBody)) {
            clone.requestBody = cloneExecutionRequestChain(value.requestBody);
        }
        if (Array.isArray(value.messages)) {
            clone.messages = value.messages.map((entry) => cloneExecutionRequestChain(entry));
        }
        if (Array.isArray(value.contents)) {
            clone.contents = value.contents.map((entry) => cloneExecutionRequestChain(entry));
        }

        return clone;
    }

    function findInnermostRequestBodyOwner(request) {
        let current = isObjectRecord(request) ? request : null;
        let owner = current && isObjectRecord(current.requestBody) ? current : null;
        let depth = 0;
        while (current && isObjectRecord(current.request) && depth < 6) {
            current = current.request;
            if (isObjectRecord(current.requestBody)) {
                owner = current;
            }
            depth += 1;
        }
        return owner;
    }

    function clampRetryNumber(currentValue, fallback, comparator) {
        const parsed = Number(currentValue);
        if (!Number.isFinite(parsed)) {
            return fallback;
        }
        return comparator(parsed, fallback);
    }

    function applyMalformedOutputRetryOverrides(request) {
        if (!isObjectRecord(request)) {
            return {
                request,
                effectiveRetryDecodingParams: null,
            };
        }
        const clonedRequest = cloneExecutionRequestChain(request);
        const owner = findInnermostRequestBodyOwner(clonedRequest);
        const targetBody = isObjectRecord(owner?.requestBody)
            ? owner.requestBody
            : (isObjectRecord(clonedRequest.requestBody) ? clonedRequest.requestBody : null);

        if (!isObjectRecord(targetBody)) {
            return {
                request: clonedRequest,
                effectiveRetryDecodingParams: null,
            };
        }

        targetBody.temperature = clampRetryNumber(targetBody.temperature, 0.7, Math.min);
        targetBody.top_p = clampRetryNumber(targetBody.top_p, 0.9, Math.min);
        targetBody.repetition_penalty = clampRetryNumber(targetBody.repetition_penalty, 1.2, Math.max);
        targetBody.frequency_penalty = clampRetryNumber(targetBody.frequency_penalty, 0.5, Math.max);
        targetBody.presence_penalty = clampRetryNumber(targetBody.presence_penalty, 0.2, Math.max);
        targetBody.stream = false;
        const effectiveRetryDecodingParams = {
            temperature: targetBody.temperature,
            top_p: targetBody.top_p,
            repetition_penalty: targetBody.repetition_penalty,
            frequency_penalty: targetBody.frequency_penalty,
            presence_penalty: targetBody.presence_penalty,
            stream: targetBody.stream,
        };

        if (isObjectRecord(targetBody.generation_config)) {
            targetBody.generation_config.temperature = clampRetryNumber(targetBody.generation_config.temperature, 0.7, Math.min);
            targetBody.generation_config.topP = clampRetryNumber(targetBody.generation_config.topP, 0.9, Math.min);
            effectiveRetryDecodingParams.generation_config = {
                temperature: targetBody.generation_config.temperature,
                topP: targetBody.generation_config.topP,
            };
        }

        return {
            request: clonedRequest,
            effectiveRetryDecodingParams,
        };
    }

    function looksLikeMalformedRepetition(text) {
        const raw = typeof text === 'string' ? text.trim() : '';
        const compact = raw.replace(/\s+/g, '');
        if (/^([A-Za-z]{2,24})(?:\1){4,}/.test(compact)) {
            return true;
        }
        if (raw.length < 24) {
            return false;
        }

        const words = (raw.match(/[A-Za-z][A-Za-z'-]*/g) || [])
            .slice(0, 20)
            .map((word) => word.toLowerCase());
        if (words.length < 6) {
            return false;
        }

        const firstWord = words[0];
        let wordRun = 1;
        while (wordRun < words.length && words[wordRun] === firstWord) {
            wordRun += 1;
        }
        if (wordRun >= 5) {
            return true;
        }

        if (words.length >= 8) {
            const firstBigram = `${words[0]} ${words[1]}`;
            let bigramRun = 1;
            for (let index = 2; index + 1 < words.length; index += 2) {
                if (`${words[index]} ${words[index + 1]}` !== firstBigram) {
                    break;
                }
                bigramRun += 1;
            }
            if (bigramRun >= 4) {
                return true;
            }
        }

        return new Set(words).size <= Math.max(2, Math.floor(words.length * 0.25));
    }

    async function executeWithMalformedOutputRetry(normalized) {
        const firstResult = await executeLLM(normalized, { dataRoot: arg.dataRoot });
        if (normalized.mode !== 'model' || normalized.streaming) {
            return {
                result: firstResult,
                retryAuditMetadata: {
                    malformedOutputRetryAttempted: false,
                    retryReason: null,
                    effectiveRetryDecodingParams: null,
                },
            };
        }

        const firstText = sanitizeOutputByMode(normalized.mode, extractExecutionResultText(firstResult));
        if (!looksLikeMalformedRepetition(firstText)) {
            return {
                result: firstResult,
                retryAuditMetadata: {
                    malformedOutputRetryAttempted: false,
                    retryReason: null,
                    effectiveRetryDecodingParams: null,
                },
            };
        }

        const retryReason = 'malformed_repetition_prefix';
        const { request: retryRequest, effectiveRetryDecodingParams } = applyMalformedOutputRetryOverrides(normalized.request);
        const retryAuditMetadata = {
            malformedOutputRetryAttempted: true,
            retryReason,
            effectiveRetryDecodingParams,
        };
        const retryNormalized = {
            ...normalized,
            request: retryRequest,
        };
        try {
            return {
                result: await executeLLM(retryNormalized, { dataRoot: arg.dataRoot }),
                retryAuditMetadata,
            };
        } catch (error) {
            if (error && typeof error === 'object') {
                error.retryAuditMetadata = retryAuditMetadata;
            }
            throw error;
        }
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

    function isStaleBaseConflict(error) {
        const conflicts = Array.isArray(error?.result?.conflicts) ? error.result.conflicts : [];
        return conflicts.some((entry) => entry && typeof entry === 'object' && entry.code === 'STALE_BASE_EVENT');
    }

    function toStoredChatObject(chatRaw) {
        return chatRaw?.chat || chatRaw?.data || chatRaw || {};
    }

    function getMessageText(message) {
        if (!message || typeof message !== 'object') return '';
        if (typeof message.data === 'string') return message.data;
        if (typeof message.content === 'string') return message.content;
        return '';
    }

    function isAssistantLikeRole(role) {
        const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
        return normalized === 'char' || normalized === 'assistant' || normalized === 'model';
    }

    function findMessageIndexByGenerationId(messages, generationId) {
        if (!Array.isArray(messages) || !generationId) return -1;
        return messages.findIndex((entry) => entry?.chatId === generationId || entry?.id === generationId);
    }

    function findLatestAssistantMessageIndex(messages) {
        if (!Array.isArray(messages)) return -1;
        for (let index = messages.length - 1; index >= 0; index -= 1) {
            if (isAssistantLikeRole(messages[index]?.role)) {
                return index;
            }
        }
        return -1;
    }

    function clonePlainMessage(message) {
        if (!message || typeof message !== 'object') {
            return {};
        }
        try {
            return JSON.parse(JSON.stringify(message));
        } catch {
            return { ...message };
        }
    }

    function buildStoredAssistantMessage({ characterId, text, generationId, baseMessage }) {
        const nextMessage = clonePlainMessage(baseMessage);
        nextMessage.role = 'char';
        nextMessage.data = typeof text === 'string' ? text : '';
        nextMessage.saying = characterId;
        nextMessage.time = Date.now();
        if (generationId) {
            nextMessage.chatId = generationId;
            const currentGenerationInfo = (nextMessage.generationInfo && typeof nextMessage.generationInfo === 'object')
                ? { ...nextMessage.generationInfo }
                : {};
            currentGenerationInfo.generationId = generationId;
            nextMessage.generationInfo = currentGenerationInfo;
        }
        return nextMessage;
    }

    function resolveDisconnectContinuationOptions(normalized) {
        const request = (normalized?.request && typeof normalized.request === 'object' && !Array.isArray(normalized.request))
            ? normalized.request
            : {};
        const generationId = typeof request.generationId === 'string' ? request.generationId.trim() : '';
        const enabled =
            normalized?.endpoint === 'generate'
            && normalized?.mode === 'model'
            && normalized?.requestedStreaming === true
            && request.continueGenerationOnDisconnect === true
            && typeof applyStateCommands === 'function'
            && !!normalized?.characterId
            && !!normalized?.chatId
            && !!generationId
            && isSafePathSegment(normalized.characterId)
            && isSafePathSegment(normalized.chatId)
            && isSafePathSegment(generationId);
        return {
            enabled,
            generationId,
        };
    }

    async function persistAssistantMessageWithRetry({
        characterId,
        chatId,
        generationId,
        text,
        continueMode,
    }) {
        if (!characterId || !chatId || !generationId || typeof applyStateCommands !== 'function') {
            return false;
        }

        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(chatPath)) {
            throw new LLMHttpError(
                404,
                'CHAT_NOT_FOUND',
                `Chat not found: ${chatId}`
            );
        }

        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            const { json: chatRaw } = await readJsonWithEtag(chatPath);
            const storedChat = toStoredChatObject(chatRaw);
            const messages = Array.isArray(storedChat?.message) ? storedChat.message : [];

            let targetIndex = findMessageIndexByGenerationId(messages, generationId);
            if (targetIndex < 0 && continueMode) {
                targetIndex = findLatestAssistantMessageIndex(messages);
            }

            const baseMessage = targetIndex >= 0 ? messages[targetIndex] : null;
            const baseMessageMatchesGeneration = targetIndex >= 0
                && (baseMessage?.chatId === generationId || baseMessage?.id === generationId);
            const persistedText = continueMode
                ? (
                    baseMessageMatchesGeneration
                        ? getMessageText(baseMessage)
                        : `${getMessageText(baseMessage)}${typeof text === 'string' ? text : ''}`
                )
                : (typeof text === 'string' ? text : '');

            if (!persistedText) {
                return false;
            }

            if (targetIndex >= 0) {
                const existing = messages[targetIndex];
                if ((existing?.chatId === generationId || existing?.id === generationId) && getMessageText(existing) === persistedText) {
                    return true;
                }
            }

            const message = buildStoredAssistantMessage({
                characterId,
                text: persistedText,
                generationId,
                baseMessage,
            });

            const command = targetIndex >= 0
                ? {
                    type: 'chat.message.replace',
                    charId: characterId,
                    chatId,
                    messageId: generationId,
                    index: targetIndex,
                    message,
                }
                : {
                    type: 'chat.message.append',
                    charId: characterId,
                    chatId,
                    message,
                };

            try {
                await applyStateCommands([command], 'llm.execute.assistant-message', { baseEventId });
                return true;
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
            }
        }

        return false;
    }

    async function applyCharacterGameStateWithRetry(charId, gameStatePatch) {
        if (typeof applyStateCommands !== 'function') {
            throw new Error('STATE_COMMANDS_UNAVAILABLE');
        }
        const charPath = path.join(dataDirs.characters, charId, 'character.json');
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            const { json: charData } = await readJsonWithEtag(charPath);
            const char = charData.character || charData.data || charData;
            const nextCharacter = (char && typeof char === 'object') ? { ...char } : {};
            nextCharacter.gameState = { ...(nextCharacter.gameState || {}), ...gameStatePatch };
            try {
                await applyStateCommands([
                    {
                        type: 'character.replace',
                        charId,
                        character: nextCharacter,
                    },
                ], 'llm.execute.game-state', { baseEventId });
                return;
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
            }
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
                await applyCharacterGameStateWithRetry(charId, updates);
                console.log(`[RAG-State] Server Autonomous Update for ${charId}:`, updates);
            }
        });
    }

    function applySSEHeaders(res) {
        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
    }

    async function updateGameStateAndReadEtagSafely(characterId, text) {
        if (!characterId || !text) {
            return null;
        }

        try {
            await updateGameStateFromMessage(characterId, text);
        } catch (error) {
            console.warn(`[LLMAPI] Failed to update game state for ${characterId}:`, error);
            return null;
        }

        try {
            const charPath = path.join(dataDirs.characters, characterId, 'character.json');
            const { etag } = await readJsonWithEtag(charPath);
            return etag;
        } catch {
            return null;
        }
    }

    async function handleLLMExecutePost(req, res, requestBody, endpointName = 'execute') {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        let normalized = null;
        let wantsStream = !!requestBody?.streaming;
        let retryAuditMetadata = {
            malformedOutputRetryAttempted: false,
            retryReason: null,
            effectiveRetryDecodingParams: null,
        };
        let disconnectContinuationAuditMetadata = {
            completedAfterClientDisconnect: false,
            serverPersistedAssistantMessage: false,
        };
        try {
            normalized = parseLLMExecutionInput(requestBody, { endpoint: endpointName });
            wantsStream = !!normalized.requestedStreaming;
            const allowReasoningOnlyOutput = shouldAllowReasoningOnlyOutput(normalized);
            const treatOpenRouterReasoningAsContent = allowReasoningOnlyOutput && isDeepSeekV32SpecialeModel(normalized.model);
            const disconnectContinuation = resolveDisconnectContinuationOptions(normalized);
            const auditEndpointForRequest = endpointName === 'generate' ? 'generate' : normalized.endpoint;
            const traceAuditEndpoint = normalized.endpoint === 'generate'
                ? 'generate_trace'
                : `${normalized.endpoint}_trace`;
            const traceAuditPath = normalized.endpoint === 'generate'
                ? '/data/llm/generate/trace'
                : (req?.originalUrl || `/data/llm/${normalized.endpoint}`);
            const persistSuccessOutcome = async ({ durationMs, streaming, response }) => {
                try {
                    await appendLLMAudit({
                        requestId: reqId,
                        method: req.method,
                        path: req.originalUrl,
                        endpoint: normalized.endpoint,
                        mode: normalized.mode,
                        provider: normalized.provider,
                        characterId: normalized.characterId || null,
                        chatId: normalized.chatId || null,
                        streaming,
                        status: 200,
                        ok: true,
                        durationMs,
                        ragMeta: normalized._ragMeta || null,
                        ...retryAuditMetadata,
                        ...disconnectContinuationAuditMetadata,
                        request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                        response,
                    });
                } catch (auditError) {
                    console.error('[LLMAPI] Failed to persist success audit:', auditError);
                }
                try {
                    await appendGenerateTraceAudit({
                        req,
                        reqId,
                        normalized,
                        endpoint: traceAuditEndpoint,
                        path: traceAuditPath,
                        durationMs,
                        status: 200,
                        ok: true,
                        auditMetadata: {
                            ...retryAuditMetadata,
                            ...disconnectContinuationAuditMetadata,
                        },
                    });
                } catch (traceError) {
                    console.error('[LLMAPI] Failed to persist success trace audit:', traceError);
                }
                try {
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
                } catch (logError) {
                    console.error('[LLMAPI] Failed to write success execution log:', logError);
                }
            };
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

            const execution = await executeWithMalformedOutputRetry(normalized);
            retryAuditMetadata = execution?.retryAuditMetadata && typeof execution.retryAuditMetadata === 'object'
                ? execution.retryAuditMetadata
                : retryAuditMetadata;
            const result = execution?.result;

            if (normalized.streaming && result && typeof result.getReader === 'function') {
                applySSEHeaders(res);

                const reader = result.getReader();
                const decoder = new TextDecoder();
                let fullText = '';
                let anthropicThinkingOpen = false;
                let openrouterReasoningOpen = false;
                let openrouterReasoningText = '';
                let sseBuffer = '';
                let sawExplicitStreamCompletion = false;
                let clientDisconnected = false;
                let terminalStateCommitted = false;
                const continueAfterDisconnect = disconnectContinuation.enabled === true;

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
                        if (continueAfterDisconnect) {
                            return false;
                        }
                        throw toDisconnectError();
                    }
                    const frame = `data: ${JSON.stringify(payload)}\n\n`;
                    if (res.write(frame)) {
                        return true;
                    }
                    await new Promise((resolve, reject) => {
                        const onDrain = () => {
                            cleanup();
                            resolve();
                        };
                        const onClose = () => {
                            cleanup();
                            if (continueAfterDisconnect) {
                                clientDisconnected = true;
                                resolve();
                                return;
                            }
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
                    return !clientDisconnected;
                };

                const hasExplicitStreamCompletion = (data) => {
                    if (!data || typeof data !== 'object') {
                        return false;
                    }

                    const eventType = typeof data.type === 'string'
                        ? data.type.trim().toLowerCase()
                        : '';
                    if (eventType === 'message_stop' || eventType === 'response.completed') {
                        return true;
                    }

                    const choice = data?.choices?.[0];
                    if (choice && typeof choice === 'object') {
                        const finishReason = typeof choice.finish_reason === 'string'
                            ? choice.finish_reason.trim()
                            : '';
                        if (finishReason) {
                            return true;
                        }
                    }

                    const deltaStopReason = typeof data?.delta?.stop_reason === 'string'
                        ? data.delta.stop_reason.trim()
                        : '';
                    if (deltaStopReason) {
                        return true;
                    }

                    const stopReason = typeof data?.stop_reason === 'string'
                        ? data.stop_reason.trim()
                        : '';
                    if (stopReason) {
                        return true;
                    }

                    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
                    return candidates.some((candidate) => {
                        if (!candidate || typeof candidate !== 'object') return false;
                        const finishReason = typeof candidate.finishReason === 'string'
                            ? candidate.finishReason.trim()
                            : '';
                        return !!finishReason;
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
                    const lines = rawEvent.split(/\r?\n/);
                    const dataLines = [];
                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            dataLines.push(line.slice(5).trimStart());
                        }
                    }
                    if (dataLines.length === 0) return;
                    const payload = dataLines.join('\n').trim();
                    if (!payload) return;
                    if (payload === '[DONE]') {
                        sawExplicitStreamCompletion = true;
                        return;
                    }
                    let data = null;
                    try {
                        data = JSON.parse(payload);
                    } catch {
                        return;
                    }
                    if (hasExplicitStreamCompletion(data)) {
                        sawExplicitStreamCompletion = true;
                    }
                    const text = extractTextFromEvent(data);
                    if (!text) return;
                    const choice = data?.choices?.[0];
                    const delta = (choice && typeof choice.delta === 'object') ? choice.delta : {};
                    const openRouterReasoning = normalized.provider === 'openrouter'
                        ? extractOpenRouterReasoningDelta(delta)
                        : '';
                    const openRouterContent = normalized.provider === 'openrouter' && typeof delta.content === 'string'
                        ? delta.content
                        : '';
                    const shouldDedupeOpenRouterChunk = normalized.provider === 'openrouter'
                        && (treatOpenRouterReasoningAsContent || (!!openRouterReasoning && !openRouterContent));
                    const emittedText = shouldDedupeOpenRouterChunk
                        ? dedupeChunkByExistingSuffix(openrouterReasoningText, text)
                        : text;
                    if (!emittedText) return;
                    if (shouldDedupeOpenRouterChunk) {
                        openrouterReasoningText += emittedText;
                    } else if (normalized.provider === 'openrouter' && openRouterContent) {
                        openrouterReasoningText = '';
                    }
                    fullText += emittedText;
                    await writeSSEEvent({ type: 'chunk', text: emittedText });
                };

                const flushSSEBuffer = async (flushTrailing = false) => {
                    let boundaryMatch = /\r?\n\r?\n/.exec(sseBuffer);
                    while (boundaryMatch) {
                        const boundaryIndex = boundaryMatch.index;
                        const boundaryLength = boundaryMatch[0].length;
                        const eventBlock = sseBuffer.slice(0, boundaryIndex);
                        sseBuffer = sseBuffer.slice(boundaryIndex + boundaryLength);
                        await handleSSEEventBlock(eventBlock);
                        boundaryMatch = /\r?\n\r?\n/.exec(sseBuffer);
                    }
                    if (flushTrailing && sseBuffer.trim()) {
                        const trailingEvent = sseBuffer;
                        sseBuffer = '';
                        await handleSSEEventBlock(trailingEvent);
                    }
                };

                try {
                    while (true) {
                        if (clientDisconnected && !continueAfterDisconnect) {
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
                        if (!clientDisconnected || !continueAfterDisconnect) {
                            await writeSSEEvent({ type: 'chunk', text: '</Thoughts>\n\n' });
                        }
                        anthropicThinkingOpen = false;
                    }
                    if (openrouterReasoningOpen && !treatOpenRouterReasoningAsContent) {
                        fullText += '</Thoughts>\n\n';
                        if (!clientDisconnected || !continueAfterDisconnect) {
                            await writeSSEEvent({ type: 'chunk', text: '</Thoughts>\n\n' });
                        }
                        openrouterReasoningOpen = false;
                    }

                    if (!sawExplicitStreamCompletion) {
                        throw new LLMHttpError(
                            502,
                            'UPSTREAM_STREAM_INCOMPLETE',
                            'Upstream stream ended before an explicit completion signal.'
                        );
                    }

                    assertVisibleModelOutput(normalized.mode, fullText, {
                        allowReasoningOnly: allowReasoningOnlyOutput,
                    });

                    const newCharEtag = await updateGameStateAndReadEtagSafely(normalized.characterId, fullText);
                    const successResponse = {
                        type: 'success',
                        requestId: reqId,
                        result: fullText,
                        ...(typeof newCharEtag === 'string' && newCharEtag ? { newCharEtag } : {}),
                    };

                    if (continueAfterDisconnect) {
                        try {
                            disconnectContinuationAuditMetadata.serverPersistedAssistantMessage = await persistAssistantMessageWithRetry({
                                characterId: normalized.characterId,
                                chatId: normalized.chatId,
                                generationId: disconnectContinuation.generationId,
                                text: fullText,
                                continueMode: normalized.continue === true,
                            });
                        } catch (persistError) {
                            disconnectContinuationAuditMetadata.serverPersistedAssistantMessage = false;
                            if (clientDisconnected) {
                                throw persistError;
                            }
                            console.warn('[LLMAPI] Failed to persist streamed assistant message after visible output:', persistError);
                        }
                        if (clientDisconnected) {
                            disconnectContinuationAuditMetadata.completedAfterClientDisconnect = true;
                        } else {
                            await writeSSEEvent({
                                type: 'done',
                                ...(typeof newCharEtag === 'string' && newCharEtag ? { newCharEtag } : {}),
                            });
                        }
                    } else {
                        await writeSSEEvent({
                            type: 'done',
                            ...(typeof newCharEtag === 'string' && newCharEtag ? { newCharEtag } : {}),
                        });
                    }
                    terminalStateCommitted = true;
                    const durationMs = Date.now() - startedAt;
                    await persistSuccessOutcome({
                        durationMs,
                        streaming: true,
                        response: successResponse,
                    });
                } catch (err) {
                    if (terminalStateCommitted) {
                        console.error('[LLMAPI] Post-stream success bookkeeping failed:', err);
                        return;
                    }
                    const disconnected = clientDisconnected || err?.code === 'CLIENT_DISCONNECTED';
                    const fatalDisconnect = disconnected && !continueAfterDisconnect;
                    const durationMs = Date.now() - startedAt;
                    const errorResponse = fatalDisconnect
                        ? {
                            status: 499,
                            code: 'CLIENT_DISCONNECTED',
                            payload: {
                                error: 'CLIENT_DISCONNECTED',
                                message: 'Client disconnected during streaming response.',
                                requestId: reqId,
                                endpoint: normalized.endpoint,
                                durationMs,
                            },
                        }
                        : toLLMErrorResponse(err, {
                            requestId: reqId,
                            endpoint: normalized.endpoint,
                            durationMs,
                        });
                    const status = Number.isFinite(Number(errorResponse?.status)) ? Number(errorResponse.status) : 500;
                    const errorCode = typeof errorResponse?.code === 'string' && errorResponse.code
                        ? errorResponse.code
                        : 'STREAM_ERROR';
                    if (!fatalDisconnect) {
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
                        ...retryAuditMetadata,
                        ...disconnectContinuationAuditMetadata,
                        request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                        error: errorResponse.payload,
                    });
                    await appendGenerateTraceAudit({
                        req,
                        reqId,
                        normalized,
                        endpoint: traceAuditEndpoint,
                        path: traceAuditPath,
                        durationMs,
                        status,
                        ok: false,
                        error: errorResponse.payload,
                        auditMetadata: {
                            ...retryAuditMetadata,
                            ...disconnectContinuationAuditMetadata,
                        },
                    });
                    if (!fatalDisconnect && !res.writableEnded && !res.destroyed) {
                        try {
                            await writeSSEEvent({
                                type: 'fail',
                                status: errorResponse.status,
                                ...errorResponse.payload,
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
            const newCharEtag = await updateGameStateAndReadEtagSafely(normalized.characterId, sanitizedResponseText);
            const successPayload = {
                type: responseType,
                requestId: reqId,
                result: sanitizedResponseText,
                ...(responseModel ? { model: responseModel } : {}),
                ...(typeof newCharEtag === 'string' && newCharEtag ? { newCharEtag } : {}),
            };

            if (normalized.requestedStreaming) {
                applySSEHeaders(res);
                let clientDisconnected = false;
                let terminalStateCommitted = false;
                const continueAfterDisconnect = disconnectContinuation.enabled === true;
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

                const writeRawFrame = async (frame) => {
                    if (clientDisconnected || res.writableEnded || res.destroyed) {
                        if (continueAfterDisconnect) {
                            return false;
                        }
                        throw toDisconnectError();
                    }
                    if (res.write(frame)) {
                        return true;
                    }
                    await new Promise((resolve, reject) => {
                        const onDrain = () => {
                            cleanup();
                            resolve();
                        };
                        const onClose = () => {
                            cleanup();
                            if (continueAfterDisconnect) {
                                clientDisconnected = true;
                                resolve();
                                return;
                            }
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
                    return !clientDisconnected;
                };

                try {
                    if (sanitizedResponseText && (!clientDisconnected || !continueAfterDisconnect)) {
                        await writeRawFrame(`data: ${JSON.stringify({ type: 'chunk', text: sanitizedResponseText })}\n\n`);
                    }
                    if (continueAfterDisconnect) {
                        try {
                            disconnectContinuationAuditMetadata.serverPersistedAssistantMessage = await persistAssistantMessageWithRetry({
                                characterId: normalized.characterId,
                                chatId: normalized.chatId,
                                generationId: disconnectContinuation.generationId,
                                text: sanitizedResponseText,
                                continueMode: normalized.continue === true,
                            });
                        } catch (persistError) {
                            disconnectContinuationAuditMetadata.serverPersistedAssistantMessage = false;
                            if (clientDisconnected) {
                                throw persistError;
                            }
                            console.warn('[LLMAPI] Failed to persist fallback streamed assistant message after visible output:', persistError);
                        }
                        if (clientDisconnected) {
                            disconnectContinuationAuditMetadata.completedAfterClientDisconnect = true;
                        } else {
                            await writeRawFrame(`data: ${JSON.stringify({
                                type: 'done',
                                ...(typeof newCharEtag === 'string' && newCharEtag ? { newCharEtag } : {}),
                            })}\n\n`);
                            await writeRawFrame('data: [DONE]\n\n');
                        }
                    } else {
                        await writeRawFrame(`data: ${JSON.stringify({
                            type: 'done',
                            ...(typeof newCharEtag === 'string' && newCharEtag ? { newCharEtag } : {}),
                        })}\n\n`);
                        await writeRawFrame('data: [DONE]\n\n');
                    }
                    terminalStateCommitted = true;
                    const durationMs = Date.now() - startedAt;
                    await persistSuccessOutcome({
                        durationMs,
                        streaming: true,
                        response: successPayload,
                    });
                } catch (streamWriteError) {
                    if (terminalStateCommitted) {
                        console.error('[LLMAPI] Post-stream success bookkeeping failed:', streamWriteError);
                    } else {
                        const disconnected = clientDisconnected || streamWriteError?.code === 'CLIENT_DISCONNECTED';
                        const fatalDisconnect = disconnected && !continueAfterDisconnect;
                        const durationMs = Date.now() - startedAt;
                        const errorResponse = fatalDisconnect
                            ? {
                                status: 499,
                                code: 'CLIENT_DISCONNECTED',
                                payload: {
                                    error: 'CLIENT_DISCONNECTED',
                                    message: 'Client disconnected during streaming response.',
                                    requestId: reqId,
                                    endpoint: normalized.endpoint,
                                    durationMs,
                                },
                            }
                            : toLLMErrorResponse(streamWriteError, {
                                requestId: reqId,
                                endpoint: normalized.endpoint,
                                durationMs,
                            });
                        const status = Number.isFinite(Number(errorResponse?.status)) ? Number(errorResponse.status) : 500;
                        const errorCode = typeof errorResponse?.code === 'string' && errorResponse.code
                            ? errorResponse.code
                            : 'STREAM_ERROR';
                        if (!fatalDisconnect) {
                            console.error('[LLMAPI] Fallback SSE write error:', streamWriteError);
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
                            ...retryAuditMetadata,
                            ...disconnectContinuationAuditMetadata,
                            request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                            error: errorResponse.payload,
                        });
                        await appendGenerateTraceAudit({
                            req,
                            reqId,
                            normalized,
                            endpoint: traceAuditEndpoint,
                            path: traceAuditPath,
                            durationMs,
                            status,
                            ok: false,
                            error: errorResponse.payload,
                            auditMetadata: {
                                ...retryAuditMetadata,
                                ...disconnectContinuationAuditMetadata,
                            },
                        });
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

            const durationMs = Date.now() - startedAt;
            await persistSuccessOutcome({
                durationMs,
                streaming: false,
                response: successPayload,
            });
            sendJson(res, 200, successPayload);
        } catch (error) {
            if (error?.retryAuditMetadata && typeof error.retryAuditMetadata === 'object') {
                retryAuditMetadata = error.retryAuditMetadata;
            }
            const durationMs = Date.now() - startedAt;
            const endpoint = normalized?.endpoint || endpointName;
            const auditEndpointForRequest = endpointName === 'generate' ? 'generate' : endpoint;
            const traceAuditEndpoint = endpoint === 'generate'
                ? 'generate_trace'
                : `${endpoint}_trace`;
            const traceAuditPath = endpoint === 'generate'
                ? '/data/llm/generate/trace'
                : (req?.originalUrl || `/data/llm/${endpoint}`);
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
                ...retryAuditMetadata,
                request: buildExecutionAuditRequest(auditEndpointForRequest, requestBody),
                error: response.payload,
            });
            await appendGenerateTraceAudit({
                req,
                reqId,
                normalized,
                endpoint: traceAuditEndpoint,
                path: traceAuditPath,
                durationMs,
                status: response.status,
                ok: false,
                error: response.payload,
                auditMetadata: retryAuditMetadata,
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
