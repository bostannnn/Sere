function createGenerateHelpers(arg = {}) {
    const { getMemoryData, setMemoryData } = require('../memory/storage.cjs');
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const promptPipeline = arg.promptPipeline || {};
    const estimatePromptTokens = typeof promptPipeline.estimatePromptTokens === 'function'
        ? promptPipeline.estimatePromptTokens
        : (() => 0);
    const parseLLMExecutionInput = typeof arg.parseLLMExecutionInput === 'function'
        ? arg.parseLLMExecutionInput
        : (() => ({}));
    const executeLLM = typeof arg.executeLLM === 'function'
        ? arg.executeLLM
        : (async () => ({}));
    const dataRoot = toStringOrEmpty(arg.dataRoot);
    const LLMHttpError = arg.LLMHttpError;
    const getGenerateMode = typeof arg.getGenerateMode === 'function'
        ? arg.getGenerateMode
        : (() => 'model');
    const isSafePathSegment = typeof arg.isSafePathSegment === 'function'
        ? arg.isSafePathSegment
        : (() => false);
    const path = arg.path;
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const dataDirs = arg.dataDirs || {};
    const safeJsonClone = typeof arg.safeJsonClone === 'function'
        ? arg.safeJsonClone
        : ((value, fallback) => {
            try {
                if (value === undefined) return fallback;
                return JSON.parse(JSON.stringify(value));
            } catch {
                return fallback;
            }
        });
    const resolveGenerateModelSelection = typeof arg.resolveGenerateModelSelection === 'function'
        ? arg.resolveGenerateModelSelection
        : (() => ({ provider: '', model: '', selectedModelId: '' }));
    const normalizeProvider = typeof arg.normalizeProvider === 'function'
        ? arg.normalizeProvider
        : (() => 'unknown');
    const planPeriodicMemorySummarization = typeof arg.planPeriodicMemorySummarization === 'function'
        ? arg.planPeriodicMemorySummarization
        : (() => ({ shouldRun: false, reason: 'not_planned' }));
    const applyPeriodicMemorySummary = typeof arg.applyPeriodicMemorySummary === 'function'
        ? arg.applyPeriodicMemorySummary
        : (() => ({ updated: false, reason: 'not_applied' }));
    const generateSummaryEmbedding = typeof arg.generateSummaryEmbedding === 'function'
        ? arg.generateSummaryEmbedding
        : (async () => null);
    const buildServerMemoryMessages = typeof arg.buildServerMemoryMessages === 'function'
        ? arg.buildServerMemoryMessages
        : (async () => []);
    const applyStateCommands = typeof arg.applyStateCommands === 'function'
        ? arg.applyStateCommands
        : null;
    const readStateLastEventId = typeof arg.readStateLastEventId === 'function'
        ? arg.readStateLastEventId
        : (async () => 0);

    const generateSupportedProviders = arg.generateSupportedProviders instanceof Set
        ? arg.generateSupportedProviders
        : new Set(['openrouter', 'openai', 'deepseek', 'anthropic', 'google', 'ollama', 'kobold', 'novelai']);

    function extractExecutionResultText(result) {
        if (typeof result === 'string') {
            return result;
        }
        if (result && typeof result === 'object' && typeof result.result === 'string') {
            return result.result;
        }
        return '';
    }

    function toPromptMessageRows(promptMessages) {
        if (!Array.isArray(promptMessages)) return [];
        return promptMessages
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const role = toStringOrEmpty(entry.role) || 'user';
                const content = toStringOrEmpty(entry.content);
                if (!content) return null;
                return { role, content };
            })
            .filter(Boolean);
    }

    function resolvePromptTextFromRows(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return '';
        const system = rows.find((row) => row.role === 'system' && toStringOrEmpty(row.content));
        if (system) return toStringOrEmpty(system.content);
        if (rows.length === 1) return toStringOrEmpty(rows[0].content);
        return '';
    }

    function buildPeriodicDebugLog(arg = {}) {
        const chat = arg.chat && typeof arg.chat === 'object' ? arg.chat : {};
        const plan = arg.plan && typeof arg.plan === 'object' ? arg.plan : {};
        const providerModel = toStringOrEmpty(arg.model) || '-';
        const summaryText = typeof arg.summaryText === 'string' ? arg.summaryText : '';
        const promptRows = toPromptMessageRows(plan.promptMessages);
        const inputText = Array.isArray(plan.summarizable)
            ? plan.summarizable
                .map((msg) => {
                    if (!msg || typeof msg !== 'object') return '';
                    const role = toStringOrEmpty(msg.role) || 'user';
                    const content = toStringOrEmpty(msg.content);
                    if (!content) return '';
                    return `${role}: ${content}`;
                })
                .filter(Boolean)
                .join('\n')
            : '';
        const totalChats = Array.isArray(chat?.message) ? chat.message.length : 0;
        const previousLastIndex = Number.isFinite(Number(plan?.memoryData?.lastSummarizedMessageIndex))
            ? Number(plan.memoryData.lastSummarizedMessageIndex)
            : 0;
        const chunkEndIndex = Number.isFinite(Number(plan?.chunkEndIndex))
            ? Number(plan.chunkEndIndex)
            : previousLastIndex;
        const interval = Math.max(1, chunkEndIndex - previousLastIndex);
        const newMessages = Math.max(0, totalChats - previousLastIndex);

        return {
            timestamp: Date.now(),
            model: providerModel,
            prompt: resolvePromptTextFromRows(promptRows),
            input: inputText,
            formatted: promptRows,
            rawResponse: summaryText || undefined,
            characterId: toStringOrEmpty(arg.characterId),
            chatId: toStringOrEmpty(arg.chatId),
            start: Math.max(1, previousLastIndex + 1),
            end: Math.max(previousLastIndex + 1, chunkEndIndex),
            source: 'periodic',
            promptSource: 'preset_or_default',
            periodic: {
                totalChats,
                lastIndex: previousLastIndex,
                newMessages,
                interval,
                toSummarizeCount: Array.isArray(plan.summarizable) ? plan.summarizable.length : 0,
                chatName: toStringOrEmpty(chat?.name),
            },
        };
    }

    function normalizeMaxContextTokens(rawBody, settings) {
        const candidates = [
            rawBody?.maxContext,
            rawBody?.request?.maxContext,
            settings?.maxContext,
        ];
        for (const candidate of candidates) {
            const value = Number(candidate);
            if (Number.isFinite(value) && value > 0) {
                return Math.max(256, Math.floor(value));
            }
        }
        return 0;
    }

    function getOldestChatMessageIndex(promptBlocks, messagesLength) {
        if (!Array.isArray(promptBlocks)) {
            return null;
        }
        let best = null;
        for (const block of promptBlocks) {
            if (!block || typeof block !== 'object') continue;
            if (block.source !== 'chat') continue;
            const index = Number(block.index);
            if (!Number.isInteger(index) || index < 0 || index >= messagesLength) continue;
            if (best === null || index < best) {
                best = index;
            }
        }
        return best;
    }

    function removePromptMessageAtIndex(messages, promptBlocks, targetIndex) {
        if (!Array.isArray(messages)) {
            return;
        }
        messages.splice(targetIndex, 1);
        if (!Array.isArray(promptBlocks)) {
            return;
        }
        for (let i = promptBlocks.length - 1; i >= 0; i -= 1) {
            const block = promptBlocks[i];
            if (!block || typeof block !== 'object') continue;
            const index = Number(block.index);
            if (!Number.isInteger(index)) continue;
            if (index === targetIndex) {
                promptBlocks.splice(i, 1);
                continue;
            }
            if (index > targetIndex) {
                block.index = index - 1;
            }
        }
    }

    async function trimPromptMessagesToContext(messages, promptBlocks, maxInputTokens, options = {}) {
        if (!Array.isArray(messages) || messages.length === 0 || !Number.isFinite(Number(maxInputTokens))) {
            return 0;
        }
        let inputTokens = Number(await Promise.resolve(estimatePromptTokens(messages))) || 0;
        while (inputTokens > maxInputTokens) {
            const trimIndex = getOldestChatMessageIndex(promptBlocks, messages.length);
            if (!Number.isInteger(trimIndex)) {
                const reservedOutputTokens = Number(options.reservedOutputTokens);
                const maxContextTokens = Number(options.maxContextTokens);
                const reserveSuffix = Number.isFinite(reservedOutputTokens) && reservedOutputTokens > 0
                    ? ` after reserving ${reservedOutputTokens} output tokens`
                    : '';
                const contextSuffix = Number.isFinite(maxContextTokens) && maxContextTokens > 0
                    ? ` within max context size (${maxContextTokens})`
                    : '';
                throw new LLMHttpError(
                    400,
                    'MAX_CONTEXT_EXCEEDED',
                    `Input token count (${inputTokens}) exceeds allowed prompt budget (${maxInputTokens})${contextSuffix}${reserveSuffix}, but no removable chat history remains.`
                );
            }
            removePromptMessageAtIndex(messages, promptBlocks, trimIndex);
            inputTokens = Number(await Promise.resolve(estimatePromptTokens(messages))) || 0;
        }
        return inputTokens;
    }

    async function readJsonFileWithRetry(filePath, retries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                const raw = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(raw);
            } catch (error) {
                lastError = error;
                const message = String(error?.message || '');
                const likelyTransientParseError =
                    error instanceof SyntaxError
                    && (
                        message.includes('Unexpected end of JSON input')
                        || message.includes('Unexpected token')
                    );
                if (!likelyTransientParseError || attempt >= retries) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
            }
        }
        throw lastError;
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
        return toStringOrEmpty(message.data) || toStringOrEmpty(message.content);
    }

    function isEquivalentTailUserMessage(chat, userMessage) {
        const normalizedUserMessage = toStringOrEmpty(userMessage);
        if (!normalizedUserMessage) return false;
        const messages = Array.isArray(chat?.message) ? chat.message : [];
        if (messages.length === 0) return false;
        const tail = messages[messages.length - 1];
        const role = toStringOrEmpty(tail?.role).toLowerCase();
        if (role !== 'user' && role !== 'human') return false;
        return getMessageText(tail) === normalizedUserMessage;
    }

    function buildStoredUserMessage(userMessage) {
        return {
            role: 'user',
            data: toStringOrEmpty(userMessage),
            time: Date.now(),
        };
    }

    function isJsonEquivalent(left, right) {
        try {
            return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
        } catch {
            return false;
        }
    }

    async function appendUserMessageWithRetry({
        characterId,
        chatId,
        chatPath,
        userMessage,
        source,
    }) {
        const resolvedChatPath = toStringOrEmpty(chatPath) || path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(resolvedChatPath)) {
            throw new LLMHttpError(
                404,
                'CHAT_NOT_FOUND',
                `Chat not found: ${chatId}`
            );
        }
        const normalizedUserMessage = toStringOrEmpty(userMessage);
        if (!normalizedUserMessage) {
            return {
                appended: false,
                chat: null,
            };
        }
        if (typeof applyStateCommands !== 'function') {
            throw new LLMHttpError(
                500,
                'STATE_COMMANDS_UNAVAILABLE',
                'Internal state command service is unavailable for server-side user message persistence.'
            );
        }
        const messagePayload = buildStoredUserMessage(normalizedUserMessage);
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            try {
                await applyStateCommands([
                    {
                        type: 'chat.message.append',
                        charId: characterId,
                        chatId,
                        message: messagePayload,
                    },
                ], source, { baseEventId });
                const latestRaw = await readJsonFileWithRetry(resolvedChatPath);
                return {
                    appended: true,
                    chat: toStoredChatObject(latestRaw),
                };
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
                const latestRaw = await readJsonFileWithRetry(resolvedChatPath);
                const latestChat = toStoredChatObject(latestRaw);
                if (isEquivalentTailUserMessage(latestChat, normalizedUserMessage)) {
                    return {
                        appended: false,
                        chat: latestChat,
                    };
                }
            }
        }
        return {
            appended: false,
            chat: null,
        };
    }

    async function persistMemoryDataWithRetry({
        characterId,
        chatId,
        chatPath,
        memoryData,
        source,
    }) {
        if (!existsSync(chatPath) || typeof applyStateCommands !== 'function') {
            return;
        }
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            const latestRaw = await readJsonFileWithRetry(chatPath);
            const latestChat = toStoredChatObject(latestRaw);
            const nextChat = (latestChat && typeof latestChat === 'object') ? { ...latestChat } : {};
            nextChat.id = toStringOrEmpty(nextChat.id) || chatId;
            setMemoryData(nextChat, safeJsonClone(memoryData, memoryData));
            try {
                await applyStateCommands([
                    {
                        type: 'chat.replace',
                        charId: characterId,
                        chatId,
                        chat: nextChat,
                    },
                ], source, { baseEventId });
                return;
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
            }
        }
    }

    async function executeInternalLLMTextCompletion(payload = {}) {
        const provider = toStringOrEmpty(payload.provider);
        const model = toStringOrEmpty(payload.model);
        const mode = toStringOrEmpty(payload.mode) || 'memory';
        const characterId = toStringOrEmpty(payload.characterId);
        const chatId = toStringOrEmpty(payload.chatId);
        const maxTokens = Number.isFinite(Number(payload.maxTokens)) ? Number(payload.maxTokens) : 512;
        const messages = Array.isArray(payload.messages) ? payload.messages : [];
        if (!provider || !model || messages.length === 0) {
            return '';
        }

        const requestBody = {
            model,
            messages,
            max_tokens: maxTokens,
            stream: false,
        };

        const internalBody = {
            mode,
            provider,
            characterId,
            chatId,
            streaming: false,
            request: {
                model,
                maxTokens,
                requestBody,
                internalNoAssembly: true,
                internalTask: 'memory_periodic_summary',
            },
        };

        const parsed = parseLLMExecutionInput(internalBody, { endpoint: 'execute' });
        const executionResult = await executeLLM(parsed, { dataRoot });
        return extractExecutionResultText(executionResult).trim();
    }

    async function maybeRunServerPeriodicMemorySummarization(payload = {}) {
        const character = payload.character || {};
        const chat = payload.chat || {};
        const settings = payload.settings || {};
        const characterId = toStringOrEmpty(payload.characterId);
        const chatId = toStringOrEmpty(payload.chatId);

        const initialPlan = planPeriodicMemorySummarization({
            character,
            chat,
            settings,
        });

        if (!initialPlan || initialPlan.shouldRun !== true) {
            if (initialPlan && initialPlan.shouldAdvanceIndex === true) {
                const advanceResult = applyPeriodicMemorySummary({
                    chat,
                    plan: initialPlan,
                    summaryText: '',
                    settings,
                    character,
                });
                return {
                    updated: advanceResult.updated === true,
                    reason: initialPlan.reason || advanceResult.reason || 'index_advanced',
                    trace: null,
                };
            }
            return {
                updated: false,
                reason: initialPlan?.reason || 'not_planned',
                trace: null,
            };
        }

        const dueWindowEndIndex = Number.isFinite(Number(initialPlan.windowEndIndex))
            ? Number(initialPlan.windowEndIndex)
            : Number(initialPlan.chunkEndIndex || 0);

        let plan = initialPlan;
        let updatedAny = false;
        let lastReason = initialPlan.reason || 'ready';
        let lastTrace = null;
        let iterations = 0;

        while (plan && iterations < 16) {
            iterations += 1;

            if (plan.shouldRun !== true) {
                if (plan.shouldAdvanceIndex === true) {
                    const advanceResult = applyPeriodicMemorySummary({
                        chat,
                        plan,
                        summaryText: '',
                        settings,
                        character,
                    });
                    updatedAny = updatedAny || advanceResult.updated === true;
                    lastReason = plan.reason || advanceResult.reason || 'index_advanced';
                } else {
                    break;
                }
            } else {
                const selectedModel = toStringOrEmpty(plan.selectedModel) || 'subModel';
                let provider = '';
                let model = '';
                if (selectedModel === 'subModel') {
                    const selected = resolveGenerateModelSelection({ mode: 'memory' }, settings);
                    provider = toStringOrEmpty(selected.provider);
                    model = toStringOrEmpty(selected.model);
                } else {
                    provider = normalizeProvider('', selectedModel);
                    model = selectedModel;
                }

                if (!provider || provider === 'unknown' || !model) {
                    return {
                        updated: updatedAny,
                        reason: 'unsupported_summary_provider_or_model',
                        trace: {
                            endpoint: 'memory_periodic_summarize',
                            provider: provider || null,
                            model: model || null,
                            promptMessages: plan.promptMessages,
                            status: 400,
                            ok: false,
                            error: {
                                error: 'MEMORY_MODEL_UNAVAILABLE',
                                message: 'Unable to resolve summarization model/provider for periodic summary.',
                            },
                        },
                    };
                }

                let summaryText = '';
                try {
                    summaryText = await executeInternalLLMTextCompletion({
                        provider,
                        model,
                        mode: 'memory',
                        characterId,
                        chatId,
                        maxTokens: 1024,
                        messages: plan.promptMessages,
                    });
                } catch (summaryError) {
                    return {
                        updated: updatedAny,
                        reason: 'periodic_summary_execution_failed',
                        trace: {
                            endpoint: 'memory_periodic_summarize',
                            provider,
                            model,
                            promptMessages: plan.promptMessages,
                            status: 500,
                            ok: false,
                            error: {
                                error: 'MEMORY_SUMMARY_EXECUTION_FAILED',
                                message: String(summaryError?.message || summaryError || 'Periodic summary generation failed'),
                            },
                        },
                    };
                }

                let summaryEmbedding = null;
                try {
                    summaryEmbedding = await generateSummaryEmbedding(summaryText, settings);
                } catch (embeddingError) {
                    console.error('[Memory] Summary embedding generation failed:', embeddingError);
                    summaryEmbedding = null;
                }

                const applyResult = applyPeriodicMemorySummary({
                    chat,
                    plan,
                    summaryText,
                    summaryEmbedding,
                    settings,
                    character,
                });

                const applyResultMemoryData = applyResult?.memoryData || null;
                if (applyResultMemoryData && typeof applyResultMemoryData === 'object') {
                    applyResultMemoryData.lastPeriodicDebug = buildPeriodicDebugLog({
                        chat,
                        plan,
                        model,
                        summaryText,
                        characterId,
                        chatId,
                    });
                    setMemoryData(chat, applyResultMemoryData);
                }

                updatedAny = updatedAny || applyResult.updated === true;
                lastReason = applyResult.reason || 'summary_applied';
                lastTrace = {
                    endpoint: 'memory_periodic_summarize',
                    provider,
                    model,
                    promptMessages: plan.promptMessages,
                    status: 200,
                    ok: true,
                };
            }

            const currentIndex = Number(getMemoryData(chat)?.lastSummarizedMessageIndex || 0);
            if (!Number.isFinite(dueWindowEndIndex) || currentIndex >= dueWindowEndIndex) {
                break;
            }

            plan = planPeriodicMemorySummarization({
                character,
                chat,
                settings,
                forceWindowEndIndex: dueWindowEndIndex,
            });
        }

        return {
            updated: updatedAny,
            reason: lastReason,
            trace: lastTrace,
        };
    }

    async function buildGenerateExecutionPayload(rawBody, options = {}) {
        if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
            throw new LLMHttpError(400, 'INVALID_BODY', 'Request body must be a JSON object.');
        }

        const characterId = toStringOrEmpty(rawBody.characterId);
        const chatId = toStringOrEmpty(rawBody.chatId);
        const readOnlyTrace = options.readOnlyTrace === true;
        const userMessage = promptPipeline.extractLatestUserMessage(rawBody);
        const mode = getGenerateMode(rawBody);
        if (mode !== 'model') {
            throw new LLMHttpError(
                400,
                'GENERATE_MODE_UNSUPPORTED',
                '/data/llm/generate only supports mode=model. Use /data/llm/execute for non-model modes.'
            );
        }

        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId is required and must be a safe id.');
        }
        if (!chatId || !isSafePathSegment(chatId)) {
            throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId is required and must be a safe id.');
        }

        const settingsPath = path.join(dataDirs.root, 'settings.json');
        if (!existsSync(settingsPath)) {
            throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        }
        const settingsParsed = await readJsonFileWithRetry(settingsPath);
        const settings = (settingsParsed && typeof settingsParsed === 'object' && settingsParsed.data && typeof settingsParsed.data === 'object')
            ? settingsParsed.data
            : settingsParsed;

        const explicitModelFromRequest = toStringOrEmpty(rawBody?.request?.model) || toStringOrEmpty(rawBody?.request?.requestBody?.model);
        const selection = resolveGenerateModelSelection({
            ...rawBody,
            mode,
            model: toStringOrEmpty(rawBody?.model) || explicitModelFromRequest,
        }, settings);
        if (!selection.provider || selection.provider === 'unknown') {
            throw new LLMHttpError(400, 'GENERATE_PROVIDER_UNKNOWN', `Unable to resolve provider for model "${selection.selectedModelId || '(unset)'}".`);
        }
        if (!generateSupportedProviders.has(selection.provider)) {
            throw new LLMHttpError(
                400,
                'GENERATE_PROVIDER_UNSUPPORTED',
                `Provider "${selection.provider}" is not yet supported by /data/llm/generate scaffold.`
            );
        }
        if (!selection.model) {
            throw new LLMHttpError(400, 'GENERATE_MODEL_MISSING', 'Resolved model is empty. Provide "model" or configure model settings.');
        }

        const charPath = path.join(dataDirs.characters, characterId, 'character.json');
        if (!existsSync(charPath)) {
            throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        }
        const chatPath = path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(chatPath)) {
            throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);
        }

        const charRaw = await readJsonFileWithRetry(charPath);
        const chatRaw = await readJsonFileWithRetry(chatPath);
        const character = charRaw.character || charRaw.data || charRaw || {};
        let chat = chatRaw.chat || chatRaw.data || chatRaw || {};
        const baselineMemoryData = safeJsonClone(getMemoryData(chat), null);

        // Hard invariant: user message must be durable before generation.
        if (!readOnlyTrace && !rawBody.continue && toStringOrEmpty(userMessage)) {
            if (!isEquivalentTailUserMessage(chat, userMessage)) {
                try {
                    const appendResult = await appendUserMessageWithRetry({
                        characterId,
                        chatId,
                        chatPath,
                        userMessage,
                        source: 'llm.generate.user-message',
                    });
                    if (appendResult?.chat && typeof appendResult.chat === 'object') {
                        chat = appendResult.chat;
                    }
                    if (appendResult?.appended) {
                        const messages = Array.isArray(chat.message) ? chat.message : [];
                        if (!isEquivalentTailUserMessage(chat, userMessage)) {
                            messages.push(buildStoredUserMessage(userMessage));
                            chat.message = messages;
                        }
                    }
                } catch (persistError) {
                    throw new LLMHttpError(
                        409,
                        'USER_MESSAGE_PERSIST_FAILED',
                        'Failed to persist user message before generation.',
                        { reason: String(persistError?.message || persistError || 'unknown_error') }
                    );
                }
            }
        }

        let shouldPersistServerChat = false;
        if (!readOnlyTrace) {
            try {
                const periodicResult = await maybeRunServerPeriodicMemorySummarization({
                    character,
                    chat,
                    settings,
                    characterId,
                    chatId,
                });
                if (typeof options.onPeriodicSummaryTrace === 'function' && periodicResult?.trace) {
                    try {
                        await options.onPeriodicSummaryTrace(periodicResult.trace);
                    } catch (traceError) {
                        console.error('[Memory] Failed to persist periodic summary trace:', traceError);
                    }
                }
                if (periodicResult.updated === true) {
                    shouldPersistServerChat = true;
                }
            } catch (periodicError) {
                console.error('[Memory] Server periodic summarization failed:', periodicError);
            }
        }

        const assembled = await promptPipeline.buildGeneratePromptMessages({
            character,
            chat,
            settings,
            historyLimit: rawBody.historyLimit,
            userMessage,
            buildServerMemoryMessages,
        });
        const messages = Array.isArray(assembled?.messages) ? assembled.messages : [];
        const promptBlocks = Array.isArray(assembled?.promptBlocks) ? assembled.promptBlocks : [];

        // buildServerMemoryMessages may update chat memory metrics (selection tracking).
        // Persist these back so similarity-based selection improves over time.
        const currentMemoryData = getMemoryData(chat);
        const memoryDataChanged = !isJsonEquivalent(baselineMemoryData, currentMemoryData);
        if (memoryDataChanged) {
            shouldPersistServerChat = true;
        }
        if (!readOnlyTrace && shouldPersistServerChat) {
            try {
                await persistMemoryDataWithRetry({
                    characterId,
                    chatId,
                    chatPath,
                    memoryData: currentMemoryData,
                    source: 'llm.generate.memory',
                });
            } catch (metricsWriteError) {
                console.error('[Memory] Failed to persist memory selection metrics:', metricsWriteError);
            }
        }

        if (messages.length === 0) {
            throw new LLMHttpError(400, 'INVALID_MESSAGES', 'No messages available for generation. Provide userMessage or existing chat history.');
        }

        const requestTemplateBody = safeJsonClone(rawBody?.request?.requestBody, {});
        const maxTokensFromRequestTemplate =
            Number(rawBody?.request?.maxTokens) ||
            Number(requestTemplateBody?.max_tokens) ||
            Number(requestTemplateBody?.max_completion_tokens) ||
            Number(requestTemplateBody?.generation_config?.maxOutputTokens);

        const maxTokens = Number.isFinite(Number(rawBody.maxTokens))
            ? Number(rawBody.maxTokens)
            : (Number.isFinite(maxTokensFromRequestTemplate) ? Number(maxTokensFromRequestTemplate) : null);
        let resolvedMaxTokens = Number.isFinite(Number(maxTokens))
            ? Number(maxTokens)
            : (Number.isFinite(Number(settings?.maxResponse)) ? Number(settings.maxResponse) : 1024);
        const maxContextTokens = normalizeMaxContextTokens(rawBody, settings);
        const reservedOutputTokens = resolvedMaxTokens > 0 ? resolvedMaxTokens : 0;
        const inputTokens = maxContextTokens > 0
            ? await trimPromptMessagesToContext(
                messages,
                promptBlocks,
                Math.max(0, maxContextTokens - reservedOutputTokens),
                {
                    maxContextTokens,
                    reservedOutputTokens,
                }
            )
            : (Number(await Promise.resolve(estimatePromptTokens(messages))) || 0);
        if (maxContextTokens > 0 && inputTokens > 0 && (inputTokens + resolvedMaxTokens) > maxContextTokens) {
            const remainingBudget = maxContextTokens - inputTokens;
            if (remainingBudget <= 0) {
                throw new LLMHttpError(
                    400,
                    'MAX_CONTEXT_EXCEEDED',
                    `Input token count (${inputTokens}) exceeds max context size (${maxContextTokens}), leaving no room for output tokens.`
                );
            }
            resolvedMaxTokens = remainingBudget;
        }

        const request = promptPipeline.buildGenerateProviderRequest(
            selection.provider,
            selection.model,
            messages,
            resolvedMaxTokens,
            !!rawBody.streaming,
            requestTemplateBody
        );

        const allowReasoningOnlyForDeepSeekV32Speciale =
            rawBody?.allowReasoningOnlyForDeepSeekV32Speciale === true ||
            rawBody?.request?.allowReasoningOnlyForDeepSeekV32Speciale === true;

        Object.defineProperty(request, '__serverContext', {
            value: {
                character: safeJsonClone(character, character),
                settings: safeJsonClone(settings, settings),
            },
            enumerable: false,
            configurable: true,
        });

        const output = {
            mode,
            provider: selection.provider,
            characterId,
            chatId,
            continue: !!rawBody.continue,
            streaming: !!rawBody.streaming,
            allowReasoningOnlyForDeepSeekV32Speciale,
            ragSettings: character.ragSettings || undefined,
            globalRagSettings: settings.globalRagSettings || undefined,
            request,
        };
        if (Array.isArray(promptBlocks) && promptBlocks.length > 0) {
            output.promptBlocks = promptBlocks;
        }
        return output;
    }

    return {
        executeInternalLLMTextCompletion,
        maybeRunServerPeriodicMemorySummarization,
        buildGenerateExecutionPayload,
    };
}

module.exports = {
    createGenerateHelpers,
};
