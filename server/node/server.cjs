const express = require('express');
const { installTimestampedConsole } = require('./console_timestamp.cjs');
installTimestampedConsole();
const app = express();
const path = require('path');
const htmlparser = require('node-html-parser');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const fs = require('fs/promises')
const nodeCrypto = require('crypto')
const {pipeline} = require('stream/promises')
const https = require('https');
const {
    parseExecutionInput: parseLLMExecutionInput,
    assembleServerPrompt: assembleLLMServerPrompt,
    previewExecution: previewLLMExecution,
    execute: executeLLM,
    toErrorResponse: toLLMErrorResponse,
    logExecutionStart: logLLMExecutionStart,
    logExecutionEnd: logLLMExecutionEnd,
    appendExecutionLog: appendLLMExecutionLog,
    readExecutionLogs: readLLMExecutionLogs,
} = require('./llm/index.cjs');
const { registerLLMRoutes } = require('./routes/llm_routes.cjs');
const { registerMemoryRoutes } = require('./routes/memory_routes.cjs');
const { registerHypaV3TraceRoutes } = require('./routes/hypav3_trace_routes.cjs');
const { registerHypaV3ManualRoutes } = require('./routes/hypav3_manual_routes.cjs');
const { registerHypaV3ResummaryRoutes } = require('./routes/hypav3_resummary_routes.cjs');
const { registerRagRoutes } = require('./routes/rag_routes.cjs');
const { registerContentRoutes } = require('./routes/content_routes.cjs');
const { registerAuthRoutes } = require('./routes/auth_routes.cjs');
const { registerStateRoutes } = require('./routes/state_routes.cjs');
const { registerSyncRoutes } = require('./routes/sync_routes.cjs');
const { registerEvolutionRoutes } = require('./routes/evolution_routes.cjs');
const { registerProxyRoutes } = require('./routes/proxy_routes.cjs');
const { registerIntegrationRoutes } = require('./routes/integration_routes.cjs');
const { registerSystemRoutes } = require('./routes/system_routes.cjs');
const { safeResolve, computeEtag, requireIfMatch, isIfMatchAny } = require('./storage_utils.cjs');
const { LLMHttpError } = require('./llm/errors.cjs');
const { normalizeProvider } = require('./llm/constants.cjs');
const { listOpenRouterModels } = require('./llm/openrouter.cjs');
const {
    buildServerMemoryMessages,
    planPeriodicHypaV3Summarization,
    applyPeriodicHypaV3Summary,
    generateSummaryEmbedding,
    resolveHypaV3Settings,
    cleanSummaryOutput,
} = require('./llm/memory.cjs');
const {
    normalizePromptOverride,
    applyPromptOverride,
    resolveManualPromptSource,
} = require('./llm/hypav3_prompt_override.cjs');
const promptPipeline = require('./llm/prompt.cjs');
const { extractTextFromMessageContent } = require('./llm/tokenizer.cjs');
const { stripThoughtBlocks } = require('./llm/scripts.cjs');
const { createAuditPayloadBuilders } = require('./llm/audit_payloads.cjs');
const { createExecutionHelpers } = require('./llm/execution_helpers.cjs');
const { createGenerateHelpers } = require('./llm/generate_helpers.cjs');
const { createExecuteRouteHandler } = require('./llm/execute_route_handler.cjs');
const { createHypaHelpers } = require('./llm/hypa_helpers.cjs');
const { createTraceAuditors } = require('./llm/trace_audit.cjs');
const { createServerRuntimeHelpers } = require('./server_runtime.cjs');
const { createServerDataHelpers } = require('./server_data_helpers.cjs');
const { createServerPasswordState } = require('./server_password_state.cjs');
const { configureServerHttpApp } = require('./server_http_setup.cjs');
const { registerServerRoutes } = require('./server_route_bootstrap.cjs');
const { createServerLlmBootstrap } = require('./server_llm_bootstrap.cjs');
const { createServerPaths } = require('./server_paths.cjs');
const { createResourceLocks } = require('./state/resource_locks.cjs');
const { createEventJournal } = require('./state/event_journal.cjs');
const { createSnapshotService } = require('./state/snapshot_service.cjs');
const { createCommandService } = require('./state/command_service.cjs');
const {
    toStringOrEmpty,
    safeJsonClone,
    sendJson,
    sendSSE,
    getReqIdFromResponse,
    isSafePathSegment,
    requireSafeSegment,
    getDataResourceId,
    createAppendLLMAudit,
    createPasswordAuthHelpers,
} = require('./server_helpers.cjs');

const globalJsonLimit = process.env.RISU_HTTP_JSON_LIMIT || '20mb';
const globalRawLimit = process.env.RISU_HTTP_RAW_LIMIT || '20mb';
const globalTextLimit = process.env.RISU_HTTP_TEXT_LIMIT || '20mb';
const ragIngestJsonLimit = process.env.RISU_RAG_INGEST_JSON_LIMIT || '500mb';
const authCryptoRateLimitWindowMs = Number.isFinite(Number(process.env.RISU_AUTH_CRYPTO_RATE_WINDOW_MS))
    ? Number(process.env.RISU_AUTH_CRYPTO_RATE_WINDOW_MS)
    : 60_000;
const authCryptoRateLimitMax = Number.isFinite(Number(process.env.RISU_AUTH_CRYPTO_RATE_MAX))
    ? Number(process.env.RISU_AUTH_CRYPTO_RATE_MAX)
    : 60;

configureServerHttpApp({
    app,
    express,
    path,
    httpBodyLimits: {
        json: globalJsonLimit,
        raw: globalRawLimit,
        text: globalTextLimit,
    },
    skipJsonBodyParserFor: [{ method: 'POST', path: '/data/rag/ingest' }],
});

const {
    sslPath,
    dataRoot,
    isCustomDataRoot,
    dataDirs,
} = createServerPaths({
    path,
});
const { generateEmbeddings } = require('./rag/embedding.cjs');
const {
    summarizeTextWithTransformers,
    captionImageWithTransformers,
} = require('./rag/aux_transformers.cjs');
const { chunkText, searchRulebooks, getCachedRulebook, updateRulebookMetadata } = require('./rag/engine.cjs');
const { extractTextFromPdf } = require('./rag/pdf.cjs');

const appendLLMAudit = createAppendLLMAudit({
    dataRoot,
    appendExecutionLog: appendLLMExecutionLog,
    onError: (error) => console.error('[LLMAPI] Failed to persist audit log', error),
});
const {
    savePath,
    passwordPath,
    authCodePath,
    getOAuthAccessToken,
    getPassword,
    setPassword,
} = createServerPasswordState({
    path,
    existsSync,
    mkdirSync,
    readFileSync,
    dataRoot,
    preferDataRoot: isCustomDataRoot,
});
if (authCodePath && existsSync(authCodePath)) {
    fs.rm(authCodePath, { force: true }).catch((error) => {
        console.warn('[Server] Failed to remove legacy OAuth token file:', error);
    });
}

const {
    hasServerPassword,
    verifyPasswordToken,
    createPasswordRecord,
    getAuthLockInfo,
    recordAuthFailure,
    clearAuthFailures,
    requirePasswordAuth,
} = createPasswordAuthHelpers({
    getPassword,
    persistPasswordRecord: (record) => {
        setPassword(record);
        writeFileSync(passwordPath, record, 'utf-8');
    },
    onWarn: (message) => console.warn(message),
});

const {
    ensureDir,
    readJsonWithEtag,
    writeJsonWithEtag,
    sendConflict,
    installDataApiMiddleware,
} = createServerDataHelpers({
    app,
    fs,
    existsSync,
    dataDirs,
    computeEtag,
    sendJson,
    getDataResourceId,
    requirePasswordAuth,
});

const resourceLocks = createResourceLocks();
const eventJournal = createEventJournal({
    fs,
    existsSync,
    dataDirs,
});
const snapshotService = createSnapshotService({
    fs,
    existsSync,
    dataDirs,
    readJsonWithEtag,
    eventJournal,
});
const commandService = createCommandService({
    fs,
    existsSync,
    dataDirs,
    readJsonWithEtag,
    writeJsonWithEtag,
    ensureDir,
    isSafePathSegment,
    resourceLocks,
    eventJournal,
});

function createInternalStateCommandApplier(arg = {}) {
    const applyCommands = typeof arg.applyCommands === 'function'
        ? arg.applyCommands
        : null;
    const readLastEventId = typeof arg.readLastEventId === 'function'
        ? arg.readLastEventId
        : (async () => 0);

    if (!applyCommands) {
        throw new Error('createInternalStateCommandApplier requires applyCommands');
    }

    return async function applyStateCommands(commands, source = 'internal', options = {}) {
        const commandList = Array.isArray(commands) ? commands : [];
        if (commandList.length === 0) {
            return {
                ok: true,
                lastEventId: await readLastEventId(),
                applied: [],
                conflicts: [],
            };
        }
        const sourceLabel = String(source || 'internal').replace(/[^a-zA-Z0-9._-]/g, '-');
        const clientMutationId = `srv-${sourceLabel}-${Date.now()}-${nodeCrypto.randomUUID()}`;
        const rawBaseEventId = options && typeof options === 'object' ? options.baseEventId : null;
        const baseEventId = Number.isFinite(Number(rawBaseEventId)) ? Number(rawBaseEventId) : undefined;
        const result = await applyCommands({
            clientMutationId,
            ...(Number.isFinite(baseEventId) ? { baseEventId } : {}),
            commands: commandList,
        });
        if (!result?.ok) {
            const error = new Error(`Internal state command failed (${sourceLabel})`);
            error.code = 'INTERNAL_STATE_COMMAND_FAILED';
            error.result = result;
            throw error;
        }
        return result;
    };
}

const applyStateCommands = createInternalStateCommandApplier({
    applyCommands: commandService.applyCommands.bind(commandService),
    readLastEventId: eventJournal.readLastEventId.bind(eventJournal),
});

// Server-first storage API
installDataApiMiddleware();

const {
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
    executeInternalLLMTextCompletion,
    executeHypaSummaryFromMessages,
    appendMemoryTraceAudit,
    buildGenerateExecutionPayload,
    handleLLMExecutePost,
} = createServerLlmBootstrap({
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
    readStateLastEventId: eventJournal.readLastEventId.bind(eventJournal),
    applyStateCommands,
    logLLMExecutionStart,
    logLLMExecutionEnd,
    toLLMErrorResponse,
    sendSSE,
    sendJson,
});
const {
    installGlobalErrorHandler,
    startServer,
} = createServerRuntimeHelpers({
    app,
    path,
    fs,
    https,
    sslPath,
});

registerServerRoutes({
    app,
    express,
    path,
    fs,
    existsSync,
    htmlparser,
    pipeline,
    savePath,
    readFileSync,
    writeFileSync,
    requirePasswordAuth,
    dataDirs,
    LLMHttpError,
    isSafePathSegment,
    getReqIdFromResponse,
    toStringOrEmpty,
    logLLMExecutionStart,
    logLLMExecutionEnd,
    appendLLMAudit,
    appendMemoryTraceAudit,
    buildHypaV3AuditRequestPayload,
    buildHypaV3AuditResponsePayload,
    sendJson,
    toLLMErrorResponse,
    resolveHypaV3Settings,
    convertStoredMessageForHypaSummary,
    buildHypaSummarizationPromptMessages,
    resolveHypaSummaryProviderModel,
    buildMemoryTraceResponsePayload,
    normalizeHypaV3DataForEdit,
    sanitizeHypaSummarizationContent,
    planPeriodicHypaV3Summarization,
    executeHypaSummaryFromMessages,
    persistChatDataToRaw,
    cleanSummaryOutput,
    generateSummaryEmbedding,
    normalizePromptOverride,
    applyPromptOverride,
    resolveManualPromptSource,
    dataRoot,
    promptPipeline,
    listOpenRouterModels,
    parseLLMExecutionInput,
    previewLLMExecution,
    handleLLMExecutePost,
    buildGenerateExecutionPayload,
    buildExecutionAuditRequest,
    sendSSE,
    assembleLLMServerPrompt,
    readLLMExecutionLogs,
    crypto: nodeCrypto,
    readJsonWithEtag,
    writeJsonWithEtag,
    requireIfMatch,
    isIfMatchAny,
    sendConflict,
    requireSafeSegment,
    ensureDir,
    safeResolve,
    computeEtag,
    hasServerPassword,
    verifyPasswordToken,
    createPasswordRecord,
    getAuthLockInfo,
    recordAuthFailure,
    clearAuthFailures,
    getPassword,
    setPassword,
    getOAuthAccessToken,
    authCryptoRateLimitWindowMs,
    authCryptoRateLimitMax,
    passwordPath,
    snapshotService,
    commandService,
    eventJournal,
    applyStateCommands,
    readStateLastEventId: eventJournal.readLastEventId.bind(eventJournal),
    executeInternalLLMTextCompletion,
    getCachedRulebook,
    searchRulebooks,
    generateEmbeddings,
    summarizeTextWithTransformers,
    captionImageWithTransformers,
    extractTextFromPdf,
    chunkText,
    ragIngestJsonLimit,
    updateRulebookMetadata,
    registerSystemRoutes,
    registerProxyRoutes,
    registerIntegrationRoutes,
    registerMemoryRoutes,
    registerHypaV3TraceRoutes,
    registerHypaV3ManualRoutes,
    registerHypaV3ResummaryRoutes,
    registerLLMRoutes,
    registerContentRoutes,
    registerAuthRoutes,
    registerStateRoutes,
    registerSyncRoutes,
    registerEvolutionRoutes,
    registerRagRoutes,
});

installGlobalErrorHandler();

(async () => {
    await startServer();
})();
