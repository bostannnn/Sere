function createGeneratePeriodicMemoryHelpers(arg = {}) {
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const safeJsonClone = typeof arg.safeJsonClone === 'function'
        ? arg.safeJsonClone
        : ((value, fallback) => value === undefined ? fallback : value);
    const parseLLMExecutionInput = typeof arg.parseLLMExecutionInput === 'function'
        ? arg.parseLLMExecutionInput
        : (() => ({}));
    const executeLLM = typeof arg.executeLLM === 'function'
        ? arg.executeLLM
        : (async () => ({}));
    const dataRoot = toStringOrEmpty(arg.dataRoot);
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
    const getMemoryData = typeof arg.getMemoryData === 'function'
        ? arg.getMemoryData
        : (() => null);
    const setMemoryData = typeof arg.setMemoryData === 'function'
        ? arg.setMemoryData
        : (() => {});

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

    function buildStructuredExecutionError(error, fallbackCode, fallbackMessage) {
        if (error && typeof error === 'object') {
            const code = toStringOrEmpty(error.code);
            const message = toStringOrEmpty(error.message);
            const details = error.details !== undefined
                ? safeJsonClone(error.details, error.details)
                : undefined;
            if (code || message || details !== undefined) {
                return {
                    error: code || fallbackCode,
                    message: message || fallbackMessage,
                    ...(details !== undefined ? { details } : {}),
                };
            }
        }

        return {
            error: fallbackCode,
            message: String(error?.message || error || fallbackMessage),
        };
    }

    function buildPeriodicDebugLog(payload = {}) {
        const chat = payload.chat && typeof payload.chat === 'object' ? payload.chat : {};
        const plan = payload.plan && typeof payload.plan === 'object' ? payload.plan : {};
        const providerModel = toStringOrEmpty(payload.model) || '-';
        const summaryText = typeof payload.summaryText === 'string' ? payload.summaryText : '';
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
            characterId: toStringOrEmpty(payload.characterId),
            chatId: toStringOrEmpty(payload.chatId),
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
                            error: buildStructuredExecutionError(
                                summaryError,
                                'MEMORY_SUMMARY_EXECUTION_FAILED',
                                'Periodic summary generation failed'
                            ),
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

    return {
        executeInternalLLMTextCompletion,
        maybeRunServerPeriodicMemorySummarization,
    };
}

module.exports = {
    createGeneratePeriodicMemoryHelpers,
};
