function createGenerateHelpers(arg = {}) {
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const promptPipeline = arg.promptPipeline || {};
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
    const planPeriodicHypaV3Summarization = typeof arg.planPeriodicHypaV3Summarization === 'function'
        ? arg.planPeriodicHypaV3Summarization
        : (() => ({ shouldRun: false, reason: 'not_planned' }));
    const applyPeriodicHypaV3Summary = typeof arg.applyPeriodicHypaV3Summary === 'function'
        ? arg.applyPeriodicHypaV3Summary
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
        const previousLastIndex = Number.isFinite(Number(plan?.hypaData?.lastSummarizedMessageIndex))
            ? Number(plan.hypaData.lastSummarizedMessageIndex)
            : 0;
        const chunkEndIndex = Number.isFinite(Number(plan?.chunkEndIndex))
            ? Number(plan.chunkEndIndex)
            : previousLastIndex;
        const interval = Math.max(1, chunkEndIndex - previousLastIndex);
        const newMessages = Math.max(0, totalChats - previousLastIndex);

        return {
            timestamp: Date.now(),
            model: providerModel,
            isResummarize: false,
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

    async function appendUserMessageWithRetry({
        characterId,
        chatId,
        userMessage,
        source,
    }) {
        if (!existsSync(path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`))) {
            return;
        }
        const normalizedUserMessage = toStringOrEmpty(userMessage);
        if (!normalizedUserMessage) {
            return;
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
                return;
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
            }
        }
    }

    async function persistHypaDataWithRetry({
        characterId,
        chatId,
        chatPath,
        hypaV3Data,
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
            nextChat.hypaV3Data = safeJsonClone(hypaV3Data, hypaV3Data);
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
                internalTask: 'hypav3_periodic_summary',
            },
        };

        const parsed = parseLLMExecutionInput(internalBody, { endpoint: 'execute' });
        const executionResult = await executeLLM(parsed, { dataRoot });
        return extractExecutionResultText(executionResult).trim();
    }

    async function maybeRunServerPeriodicHypaV3Summarization(payload = {}) {
        const character = payload.character || {};
        const chat = payload.chat || {};
        const settings = payload.settings || {};
        const characterId = toStringOrEmpty(payload.characterId);
        const chatId = toStringOrEmpty(payload.chatId);

        const plan = planPeriodicHypaV3Summarization({
            character,
            chat,
            settings,
        });

        if (!plan || plan.shouldRun !== true) {
            if (plan && plan.shouldAdvanceIndex === true) {
                const advanceResult = applyPeriodicHypaV3Summary({
                    chat,
                    plan,
                    summaryText: '',
                });
                return {
                    updated: advanceResult.updated === true,
                    reason: plan.reason || advanceResult.reason || 'index_advanced',
                    trace: null,
                };
            }
            return {
                updated: false,
                reason: plan?.reason || 'not_planned',
                trace: null,
            };
        }

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
                updated: false,
                reason: 'unsupported_summary_provider_or_model',
                trace: {
                    endpoint: 'hypav3_periodic_summarize',
                    provider: provider || null,
                    model: model || null,
                    promptMessages: plan.promptMessages,
                    status: 400,
                    ok: false,
                    error: {
                        error: 'HYPAV3_MODEL_UNAVAILABLE',
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
                updated: false,
                reason: 'periodic_summary_execution_failed',
                trace: {
                    endpoint: 'hypav3_periodic_summarize',
                    provider,
                    model,
                    promptMessages: plan.promptMessages,
                    status: 500,
                    ok: false,
                    error: {
                        error: 'HYPAV3_SUMMARY_EXECUTION_FAILED',
                        message: String(summaryError?.message || summaryError || 'Periodic summary generation failed'),
                    },
                },
            };
        }

        let summaryEmbedding = null;
        try {
            summaryEmbedding = await generateSummaryEmbedding(summaryText, settings);
        } catch (embeddingError) {
            console.error('[HypaV3] Summary embedding generation failed:', embeddingError);
            summaryEmbedding = null;
        }

        const applyResult = applyPeriodicHypaV3Summary({
            chat,
            plan,
            summaryText,
            summaryEmbedding,
        });

        if (applyResult?.hypaV3Data && typeof applyResult.hypaV3Data === 'object') {
            applyResult.hypaV3Data.lastPeriodicDebug = buildPeriodicDebugLog({
                chat,
                plan,
                model,
                summaryText,
                characterId,
                chatId,
            });
            chat.hypaV3Data = applyResult.hypaV3Data;
        }

        return {
            updated: applyResult.updated === true,
            reason: applyResult.reason || 'summary_applied',
            trace: {
                endpoint: 'hypav3_periodic_summarize',
                provider,
                model,
                promptMessages: plan.promptMessages,
                status: 200,
                ok: true,
            },
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

        const charRaw = await readJsonFileWithRetry(charPath);
        const chatRaw = existsSync(chatPath)
            ? await readJsonFileWithRetry(chatPath)
            : { chat: { message: [] } };
        const character = charRaw.character || charRaw.data || charRaw || {};
        const chat = chatRaw.chat || chatRaw.data || chatRaw || {};

        // Hard invariant: user message must be durable before generation.
        if (!readOnlyTrace && !rawBody.continue && existsSync(chatPath) && toStringOrEmpty(userMessage)) {
            if (!isEquivalentTailUserMessage(chat, userMessage)) {
                try {
                    await appendUserMessageWithRetry({
                        characterId,
                        chatId,
                        userMessage,
                        source: 'llm.generate.user-message',
                    });
                } catch (persistError) {
                    throw new LLMHttpError(
                        409,
                        'USER_MESSAGE_PERSIST_FAILED',
                        'Failed to persist user message before generation.',
                        { reason: String(persistError?.message || persistError || 'unknown_error') }
                    );
                }
                const messages = Array.isArray(chat.message) ? chat.message : [];
                messages.push(buildStoredUserMessage(userMessage));
                chat.message = messages;
            }
        }

        let shouldPersistServerChat = false;
        if (!readOnlyTrace && existsSync(chatPath)) {
            try {
                const periodicResult = await maybeRunServerPeriodicHypaV3Summarization({
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
                        console.error('[HypaV3] Failed to persist periodic summary trace:', traceError);
                    }
                }
                if (periodicResult.updated === true) {
                    shouldPersistServerChat = true;
                }
            } catch (periodicError) {
                console.error('[HypaV3] Server periodic summarization failed:', periodicError);
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

        // buildServerMemoryMessages may update chat.hypaV3Data.metrics (selection tracking).
        // Persist these back so similarity-based selection improves over time.
        if (existsSync(chatPath) && chat.hypaV3Data?.summaries?.length > 0) {
            shouldPersistServerChat = true;
        }
        if (!readOnlyTrace && existsSync(chatPath) && shouldPersistServerChat) {
            try {
                await persistHypaDataWithRetry({
                    characterId,
                    chatId,
                    chatPath,
                    hypaV3Data: chat.hypaV3Data,
                    source: 'llm.generate.hypav3',
                });
            } catch (metricsWriteError) {
                console.error('[HypaV3] Failed to persist memory selection metrics:', metricsWriteError);
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
        const resolvedMaxTokens = Number.isFinite(Number(maxTokens))
            ? Number(maxTokens)
            : (Number.isFinite(Number(settings?.maxResponse)) ? Number(settings.maxResponse) : 1024);

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
        maybeRunServerPeriodicHypaV3Summarization,
        buildGenerateExecutionPayload,
    };
}

module.exports = {
    createGenerateHelpers,
};
