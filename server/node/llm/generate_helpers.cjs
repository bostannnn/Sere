function createGenerateHelpers(arg = {}) {
    const { getMemoryData, setMemoryData } = require('../memory/storage.cjs');
    const { createGenerateDataHelpers } = require('./generate_data_helpers.cjs');
    const { createGeneratePeriodicMemoryHelpers } = require('./generate_periodic_memory_helpers.cjs');
    const {
        normalizeMaxContextTokens,
        trimPromptMessagesToContext,
    } = require('./prompt_budget_helpers.cjs');
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
    const buildCharacterEvolutionSemanticRecall = typeof arg.buildCharacterEvolutionSemanticRecall === 'function'
        ? arg.buildCharacterEvolutionSemanticRecall
        : null;

    const generateSupportedProviders = arg.generateSupportedProviders instanceof Set
        ? arg.generateSupportedProviders
        : new Set(['openrouter', 'openai', 'deepseek', 'anthropic', 'google', 'ollama', 'kobold', 'novelai']);

    const {
        readJsonFileWithRetry,
        isEquivalentTailUserMessage,
        buildStoredUserMessage,
        isJsonEquivalent,
        appendUserMessageWithRetry,
        persistMemoryDataWithRetry,
    } = createGenerateDataHelpers({
        toStringOrEmpty,
        path,
        fs,
        existsSync,
        dataDirs,
        LLMHttpError,
        applyStateCommands,
        readStateLastEventId,
        setMemoryData,
        safeJsonClone,
    });

    const {
        executeInternalLLMTextCompletion,
        maybeRunServerPeriodicMemorySummarization,
    } = createGeneratePeriodicMemoryHelpers({
        toStringOrEmpty,
        safeJsonClone,
        parseLLMExecutionInput,
        executeLLM,
        dataRoot,
        resolveGenerateModelSelection,
        normalizeProvider,
        planPeriodicMemorySummarization,
        applyPeriodicMemorySummary,
        generateSummaryEmbedding,
        getMemoryData,
        setMemoryData,
    });

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
            buildCharacterEvolutionSemanticRecall: buildCharacterEvolutionSemanticRecall
                ? ({ character, chat, settings }) => buildCharacterEvolutionSemanticRecall({
                    characterId,
                    chatId,
                    character,
                    chat,
                    settings,
                })
                : null,
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
                    estimatePromptTokens,
                    LLMHttpError,
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
