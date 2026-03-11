function createServerLlmBootstrap(arg = {}) {
    const {
        createAuditPayloadBuilders,
        createExecutionHelpers,
        createGenerateHelpers,
        createMemoryHelpers,
        createTraceAuditors,
        createExecuteRouteHandler,
        toStringOrEmpty,
        promptPipeline,
        extractTextFromMessageContent,
        normalizeProvider,
        stripThoughtBlocks,
        parseLLMExecutionInput,
        executeLLM,
        dataRoot,
        LLMHttpError,
        isSafePathSegment,
        path,
        fs,
        existsSync,
        dataDirs,
        safeJsonClone,
        planPeriodicMemorySummarization,
        applyPeriodicMemorySummary,
        generateSummaryEmbedding,
        buildServerMemoryMessages,
        resolveMemorySettings,
        cleanSummaryOutput,
        appendLLMAudit,
        getReqIdFromResponse,
        readJsonWithEtag,
        readStateLastEventId,
        applyStateCommands,
        logLLMExecutionStart,
        logLLMExecutionEnd,
        toLLMErrorResponse,
        sendSSE,
        sendJson,
    } = arg;

    const {
        buildMemoryPromptTrace,
        buildExecutionAuditRequest,
        buildMemoryAuditRequestPayload,
        buildMemoryAuditResponsePayload,
        buildMemoryTraceResponsePayload,
    } = createAuditPayloadBuilders({
        toStringOrEmpty,
        estimatePromptTokens: promptPipeline.estimatePromptTokens,
        extractTextFromMessageContent,
    });

    const {
        sanitizeOutputByMode,
        getGenerateMode,
        resolveGenerateModelSelection,
        isInternalExecutionRequest,
    } = createExecutionHelpers({
        toStringOrEmpty,
        normalizeProvider,
        stripThoughtBlocks,
    });

    const {
        executeInternalLLMTextCompletion,
        buildGenerateExecutionPayload,
    } = createGenerateHelpers({
        toStringOrEmpty,
        promptPipeline,
        parseLLMExecutionInput,
        executeLLM,
        dataRoot,
        LLMHttpError,
        getGenerateMode,
        isSafePathSegment,
        path,
        fs,
        existsSync,
        dataDirs,
        safeJsonClone,
        readStateLastEventId,
        resolveGenerateModelSelection,
        normalizeProvider,
        planPeriodicMemorySummarization,
        applyPeriodicMemorySummary,
        generateSummaryEmbedding,
        buildServerMemoryMessages,
        applyStateCommands,
    });

    const {
        resolveMemorySummaryProviderModel,
        sanitizeMemorySummarizationContent,
        convertStoredMessageForMemorySummary,
        buildMemorySummarizationPromptMessages,
        normalizeMemoryDataForEdit,
        persistChatDataToRaw,
        executeMemorySummaryFromMessages,
    } = createMemoryHelpers({
        toStringOrEmpty,
        resolveMemorySettings,
        resolveGenerateModelSelection,
        normalizeProvider,
        executeInternalLLMTextCompletion,
        cleanSummaryOutput,
        LLMHttpError,
    });

    const {
        appendGenerateTraceAudit,
        appendMemoryTraceAudit,
    } = createTraceAuditors({
        appendLLMAudit,
        promptPipeline,
        toStringOrEmpty,
        buildMemoryPromptTrace,
    });

    const {
        handleLLMExecutePost,
    } = createExecuteRouteHandler({
        path,
        dataDirs,
        existsSync,
        readJsonWithEtag,
        readStateLastEventId,
        applyStateCommands,
        isSafePathSegment,
        getReqIdFromResponse,
        parseLLMExecutionInput,
        isInternalExecutionRequest,
        LLMHttpError,
        logLLMExecutionStart,
        executeLLM,
        dataRoot,
        logLLMExecutionEnd,
        appendLLMAudit,
        buildExecutionAuditRequest,
        appendGenerateTraceAudit,
        sanitizeOutputByMode,
        toLLMErrorResponse,
        sendSSE,
        sendJson,
    });

    return {
        buildExecutionAuditRequest,
        buildMemoryAuditRequestPayload,
        buildMemoryAuditResponsePayload,
        buildMemoryTraceResponsePayload,
        resolveMemorySummaryProviderModel,
        sanitizeMemorySummarizationContent,
        convertStoredMessageForMemorySummary,
        buildMemorySummarizationPromptMessages,
        normalizeMemoryDataForEdit,
        persistChatDataToRaw,
        executeInternalLLMTextCompletion,
        executeMemorySummaryFromMessages,
        appendMemoryTraceAudit,
        buildGenerateExecutionPayload,
        handleLLMExecutePost,
    };
}

module.exports = {
    createServerLlmBootstrap,
};
