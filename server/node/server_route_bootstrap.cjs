function registerServerRoutes(arg = {}) {
    const {
        registerSystemRoutes,
        registerProxyRoutes,
        registerIntegrationRoutes,
        registerMemoryRoutes,
        registerMemoryTraceRoutes,
        registerMemoryManualRoutes,
        registerLLMRoutes,
        registerContentRoutes,
        registerAuthRoutes,
        registerStateRoutes,
        registerSyncRoutes,
        registerRagRoutes,
        registerEvolutionRoutes,
    } = arg;

    registerSystemRoutes({
        app: arg.app,
        path: arg.path,
        fs: arg.fs,
        existsSync: arg.existsSync,
        htmlparser: arg.htmlparser,
    });

    registerProxyRoutes({
        app: arg.app,
        pipeline: arg.pipeline,
        getOAuthAccessToken: arg.getOAuthAccessToken,
        requirePasswordAuth: arg.requirePasswordAuth,
    });

    registerIntegrationRoutes({
        app: arg.app,
        pipeline: arg.pipeline,
    });

    registerMemoryRoutes({
        app: arg.app,
        fs: arg.fs,
        dataDirs: arg.dataDirs,
        existsSync: arg.existsSync,
        LLMHttpError: arg.LLMHttpError,
        isSafePathSegment: arg.isSafePathSegment,
        requirePasswordAuth: arg.requirePasswordAuth,
        safeResolve: arg.safeResolve,
        getReqIdFromResponse: arg.getReqIdFromResponse,
        toStringOrEmpty: arg.toStringOrEmpty,
        logLLMExecutionStart: arg.logLLMExecutionStart,
        logLLMExecutionEnd: arg.logLLMExecutionEnd,
        appendLLMAudit: arg.appendLLMAudit,
        appendMemoryTraceAudit: arg.appendMemoryTraceAudit,
        buildMemoryAuditRequestPayload: arg.buildMemoryAuditRequestPayload,
        buildMemoryAuditResponsePayload: arg.buildMemoryAuditResponsePayload,
        sendJson: arg.sendJson,
        toLLMErrorResponse: arg.toLLMErrorResponse,
        resolveMemorySettings: arg.resolveMemorySettings,
        convertStoredMessageForMemorySummary: arg.convertStoredMessageForMemorySummary,
        buildMemorySummarizationPromptMessages: arg.buildMemorySummarizationPromptMessages,
        resolveMemorySummaryProviderModel: arg.resolveMemorySummaryProviderModel,
        buildMemoryTraceResponsePayload: arg.buildMemoryTraceResponsePayload,
        normalizeMemoryDataForEdit: arg.normalizeMemoryDataForEdit,
        planPeriodicMemorySummarization: arg.planPeriodicMemorySummarization,
        executeMemorySummaryFromMessages: arg.executeMemorySummaryFromMessages,
        persistChatDataToRaw: arg.persistChatDataToRaw,
        cleanSummaryOutput: arg.cleanSummaryOutput,
        generateSummaryEmbedding: arg.generateSummaryEmbedding,
        normalizePromptOverride: arg.normalizePromptOverride,
        applyPromptOverride: arg.applyPromptOverride,
        resolveManualPromptSource: arg.resolveManualPromptSource,
        applyStateCommands: arg.applyStateCommands,
        traceRoutes: registerMemoryTraceRoutes,
        manualRoutes: registerMemoryManualRoutes,
    });

    registerLLMRoutes({
        app: arg.app,
        dataRoot: arg.dataRoot,
        promptPipeline: arg.promptPipeline,
        listOpenRouterModels: arg.listOpenRouterModels,
        parseLLMExecutionInput: arg.parseLLMExecutionInput,
        previewLLMExecution: arg.previewLLMExecution,
        handleLLMExecutePost: arg.handleLLMExecutePost,
        buildGenerateExecutionPayload: arg.buildGenerateExecutionPayload,
        appendMemoryTraceAudit: arg.appendMemoryTraceAudit,
        toStringOrEmpty: arg.toStringOrEmpty,
        getReqIdFromResponse: arg.getReqIdFromResponse,
        toLLMErrorResponse: arg.toLLMErrorResponse,
        logLLMExecutionStart: arg.logLLMExecutionStart,
        logLLMExecutionEnd: arg.logLLMExecutionEnd,
        appendLLMAudit: arg.appendLLMAudit,
        buildExecutionAuditRequest: arg.buildExecutionAuditRequest,
        sendSSE: arg.sendSSE,
        sendJson: arg.sendJson,
        assembleLLMServerPrompt: arg.assembleLLMServerPrompt,
        readLLMExecutionLogs: arg.readLLMExecutionLogs,
    });

    registerContentRoutes({
        app: arg.app,
        path: arg.path,
        fs: arg.fs,
        existsSync: arg.existsSync,
        crypto: arg.crypto,
        dataDirs: arg.dataDirs,
        safeResolve: arg.safeResolve,
        readJsonWithEtag: arg.readJsonWithEtag,
        writeJsonWithEtag: arg.writeJsonWithEtag,
        requireIfMatch: arg.requireIfMatch,
        isIfMatchAny: arg.isIfMatchAny,
        sendConflict: arg.sendConflict,
        sendJson: arg.sendJson,
        requireSafeSegment: arg.requireSafeSegment,
        computeEtag: arg.computeEtag,
        isSafePathSegment: arg.isSafePathSegment,
    });

    registerAuthRoutes({
        app: arg.app,
        crypto: arg.crypto,
        sendJson: arg.sendJson,
        requirePasswordAuth: arg.requirePasswordAuth,
        hasServerPassword: arg.hasServerPassword,
        verifyPasswordToken: arg.verifyPasswordToken,
        createPasswordRecord: arg.createPasswordRecord,
        getAuthLockInfo: arg.getAuthLockInfo,
        recordAuthFailure: arg.recordAuthFailure,
        clearAuthFailures: arg.clearAuthFailures,
        getPassword: arg.getPassword,
        setPassword: arg.setPassword,
        writeFileSync: arg.writeFileSync,
        passwordPath: arg.passwordPath,
        authCryptoRateLimitWindowMs: arg.authCryptoRateLimitWindowMs,
        authCryptoRateLimitMax: arg.authCryptoRateLimitMax,
    });

    registerStateRoutes({
        app: arg.app,
        sendJson: arg.sendJson,
        snapshotService: arg.snapshotService,
        commandService: arg.commandService,
    });

    registerSyncRoutes({
        app: arg.app,
        eventJournal: arg.eventJournal,
    });

    registerRagRoutes({
        app: arg.app,
        express: arg.express,
        requirePasswordAuth: arg.requirePasswordAuth,
        requireIfMatch: arg.requireIfMatch,
        isIfMatchAny: arg.isIfMatchAny,
        dataDirs: arg.dataDirs,
        getReqIdFromResponse: arg.getReqIdFromResponse,
        fs: arg.fs,
        computeEtag: arg.computeEtag,
        getCachedRulebook: arg.getCachedRulebook,
        appendLLMAudit: arg.appendLLMAudit,
        searchRulebooks: arg.searchRulebooks,
        generateEmbeddings: arg.generateEmbeddings,
        summarizeTextWithTransformers: arg.summarizeTextWithTransformers,
        captionImageWithTransformers: arg.captionImageWithTransformers,
        extractTextFromPdf: arg.extractTextFromPdf,
        chunkText: arg.chunkText,
        crypto: arg.crypto,
        path: arg.path,
        ragIngestJsonLimit: arg.ragIngestJsonLimit,
        requireSafeSegment: arg.requireSafeSegment,
        updateRulebookMetadata: arg.updateRulebookMetadata,
    });

    if (typeof registerEvolutionRoutes === 'function') {
        registerEvolutionRoutes({
            app: arg.app,
            fs: arg.fs,
            dataDirs: arg.dataDirs,
            existsSync: arg.existsSync,
            LLMHttpError: arg.LLMHttpError,
            isSafePathSegment: arg.isSafePathSegment,
            requirePasswordAuth: arg.requirePasswordAuth,
            safeResolve: arg.safeResolve,
            getReqIdFromResponse: arg.getReqIdFromResponse,
            toStringOrEmpty: arg.toStringOrEmpty,
            sendJson: arg.sendJson,
            toLLMErrorResponse: arg.toLLMErrorResponse,
            logLLMExecutionStart: arg.logLLMExecutionStart,
            logLLMExecutionEnd: arg.logLLMExecutionEnd,
            appendLLMAudit: arg.appendLLMAudit,
            buildExecutionAuditRequest: arg.buildExecutionAuditRequest,
            executeInternalLLMTextCompletion: arg.executeInternalLLMTextCompletion,
            applyStateCommands: arg.applyStateCommands,
            readStateLastEventId: arg.readStateLastEventId,
        });
    }
}

module.exports = {
    registerServerRoutes,
};
