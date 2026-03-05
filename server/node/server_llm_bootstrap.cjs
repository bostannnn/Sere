function createServerLlmBootstrap(arg = {}) {
    const {
        createAuditPayloadBuilders,
        createExecutionHelpers,
        createGenerateHelpers,
        createHypaHelpers,
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
        planPeriodicHypaV3Summarization,
        applyPeriodicHypaV3Summary,
        generateSummaryEmbedding,
        buildServerMemoryMessages,
        resolveHypaV3Settings,
        cleanSummaryOutput,
        appendLLMAudit,
        getReqIdFromResponse,
        readJsonWithEtag,
        writeJsonWithEtag,
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
        buildHypaV3AuditRequestPayload,
        buildHypaV3AuditResponsePayload,
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
        resolveGenerateModelSelection,
        normalizeProvider,
        planPeriodicHypaV3Summarization,
        applyPeriodicHypaV3Summary,
        generateSummaryEmbedding,
        buildServerMemoryMessages,
        applyStateCommands,
    });

    const {
        resolveHypaSummaryProviderModel,
        sanitizeHypaSummarizationContent,
        convertStoredMessageForHypaSummary,
        buildHypaSummarizationPromptMessages,
        normalizeHypaV3DataForEdit,
        persistChatDataToRaw,
        executeHypaSummaryFromMessages,
    } = createHypaHelpers({
        toStringOrEmpty,
        resolveHypaV3Settings,
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
        writeJsonWithEtag,
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
        buildHypaV3AuditRequestPayload,
        buildHypaV3AuditResponsePayload,
        buildMemoryTraceResponsePayload,
        resolveHypaSummaryProviderModel,
        sanitizeHypaSummarizationContent,
        convertStoredMessageForHypaSummary,
        buildHypaSummarizationPromptMessages,
        normalizeHypaV3DataForEdit,
        persistChatDataToRaw,
        executeHypaSummaryFromMessages,
        appendMemoryTraceAudit,
        buildGenerateExecutionPayload,
        handleLLMExecutePost,
    };
}

module.exports = {
    createServerLlmBootstrap,
};
