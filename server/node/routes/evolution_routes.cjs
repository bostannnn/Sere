function registerEvolutionRoutes(arg = {}) {
    const {
        app,
        fs,
        dataDirs,
        existsSync,
        LLMHttpError,
        isSafePathSegment,
        requirePasswordAuth,
        safeResolve,
        getReqIdFromResponse,
        toStringOrEmpty,
        sendJson,
        toLLMErrorResponse,
        logLLMExecutionStart,
        logLLMExecutionEnd,
        appendLLMAudit,
        buildExecutionAuditRequest,
        executeInternalLLMTextCompletion,
        applyStateCommands,
        readStateLastEventId,
        buildMemoryPromptTrace = require('../llm/audit_payloads.cjs').createAuditPayloadBuilders({}).buildMemoryPromptTrace,
        truncatePromptMessagesForAudit = require('../llm/prompt.cjs').truncatePromptMessagesForAudit,
        createCharacterEvolutionRepository = require('../services/character_evolution_repository.cjs').createCharacterEvolutionRepository,
        createCharacterEvolutionVersionStore = require('../services/character_evolution_version_store.cjs').createCharacterEvolutionVersionStore,
        buildCharacterEvolutionPromptMessages = require('../llm/character_evolution.cjs').buildCharacterEvolutionPromptMessages,
        clone = require('../llm/character_evolution.cjs').clone,
        getEffectiveCharacterEvolutionSettings = require('../llm/character_evolution.cjs').getEffectiveCharacterEvolutionSettings,
        normalizeCharacterEvolutionProposal = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionProposal,
        normalizeCharacterEvolutionPrivacy = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionPrivacy,
        normalizeCharacterEvolutionSectionConfigs = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionSectionConfigs,
        normalizeCharacterEvolutionSettings = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionSettings,
        normalizeCharacterEvolutionState = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionState,
        safeParseEvolutionJson = require('../llm/character_evolution.cjs').safeParseEvolutionJson,
        sanitizeStateForEvolution = require('../llm/character_evolution.cjs').sanitizeStateForEvolution,
    } = arg;

    if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
        throw new Error('registerEvolutionRoutes requires an Express app instance.');
    }
    if (typeof safeResolve !== 'function') {
        throw new Error('registerEvolutionRoutes requires safeResolve.');
    }

    const repository = createCharacterEvolutionRepository({
        applyStateCommands,
        dataDirs,
        existsSync,
        fs,
        LLMHttpError,
        readStateLastEventId,
        safeResolve,
    });
    const versionStore = createCharacterEvolutionVersionStore({
        existsSync,
        fs,
    });
    const { loadCharacterAndSettings, loadChat, replaceCharacterWithRetry } = repository;
    const {
        cleanupStagedVersionFile,
        finalizeVersionFile,
        mergeVersionMetas,
        readVersionMetasFromDisk,
        resolveVersionFilePath,
        stageVersionFile,
    } = versionStore;

    function makeProposalId() {
        return `evo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    function resolveEffectiveEvolutionSettings(settings, character) {
        const evolution = getEffectiveCharacterEvolutionSettings(settings, character);
        if (!evolution.enabled) {
            throw new LLMHttpError(400, 'EVOLUTION_DISABLED', 'Character evolution is disabled for this character.');
        }
        return evolution;
    }

    function ensureCharacterChatInput(characterId, chatId) {
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId is required and must be a safe id.');
        }
        if (!chatId || !isSafePathSegment(chatId)) {
            throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId is required and must be a safe id.');
        }
    }

    function buildEvolutionAuditRequest(endpoint, requestBody, promptMessages) {
        const baseRequest = buildExecutionAuditRequest(endpoint, requestBody);
        const tracedMessages = buildMemoryPromptTrace(promptMessages, 'Character Evolution Prompt');
        const {
            promptMessages: promptMessagesForAudit,
            omittedMessageCount,
        } = truncatePromptMessagesForAudit(tracedMessages);
        const auditRequest = (baseRequest && typeof baseRequest === 'object' && !Array.isArray(baseRequest))
            ? { ...baseRequest }
            : { requestBody: baseRequest };

        auditRequest.promptMessageCount = tracedMessages.length;
        auditRequest.promptMessages = promptMessagesForAudit;
        auditRequest.promptMessagesTruncated = promptMessagesForAudit.length !== tracedMessages.length
            || omittedMessageCount > 0
            || promptMessagesForAudit.some((msg) => msg?.contentTruncated === true);
        auditRequest.omittedPromptMessageCount = omittedMessageCount;

        return auditRequest;
    }

    const withAsyncRoute = (endpoint, handler) => async (req, res) => {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        try {
            await handler(req, res, reqId, startedAt);
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const audit = (req && typeof req === 'object' && req._characterEvolutionAudit && typeof req._characterEvolutionAudit === 'object')
                ? req._characterEvolutionAudit
                : {};
            const response = toLLMErrorResponse(error, {
                requestId: reqId,
                endpoint,
                durationMs,
            });
            try {
                logLLMExecutionEnd({
                    reqId,
                    endpoint,
                    mode: toStringOrEmpty(audit.mode) || '-',
                    provider: toStringOrEmpty(audit.provider) || '-',
                    characterId: toStringOrEmpty(audit.characterId) || '-',
                    chatId: toStringOrEmpty(audit.chatId) || '-',
                    status: response.status,
                    code: response.code,
                    durationMs,
                });
            } catch (logError) {
                console.warn('[character-evolution] Failed to write execution end log.', {
                    endpoint,
                    requestId: reqId,
                    error: logError instanceof Error ? logError.message : String(logError),
                });
            }
            try {
                await appendLLMAudit({
                    requestId: reqId,
                    method: req?.method,
                    path: req?.originalUrl,
                    endpoint,
                    mode: toStringOrEmpty(audit.mode) || null,
                    provider: toStringOrEmpty(audit.provider) || null,
                    characterId: toStringOrEmpty(audit.characterId) || null,
                    chatId: toStringOrEmpty(audit.chatId) || null,
                    streaming: false,
                    status: response.status,
                    ok: false,
                    durationMs,
                    metadata: (audit.metadata && typeof audit.metadata === 'object') ? audit.metadata : null,
                    request: buildEvolutionAuditRequest(
                        endpoint,
                        (audit.requestBody && typeof audit.requestBody === 'object') ? audit.requestBody : req?.body,
                        audit.promptMessages,
                    ),
                    ...(typeof audit.rawResult === 'string' && audit.rawResult
                        ? {
                            response: {
                                type: 'raw_text',
                                result: audit.rawResult,
                            },
                        }
                        : {}),
                    error: response.payload,
                });
            } catch (auditError) {
                console.warn('[character-evolution] Failed to append audit log.', {
                    endpoint,
                    requestId: reqId,
                    error: auditError instanceof Error ? auditError.message : String(auditError),
                });
            }
            sendJson(res, response.status, response.payload);
        }
    };

    app.post('/data/character-evolution/handoff', withAsyncRoute('character_evolution_handoff', async (req, res, reqId, startedAt) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const characterId = toStringOrEmpty(body.characterId);
        const chatId = toStringOrEmpty(body.chatId);
        const forceReplay = body.forceReplay === true;
        ensureCharacterChatInput(characterId, chatId);
        req._characterEvolutionAudit = {
            mode: 'memory',
            provider: '',
            model: '',
            characterId,
            chatId,
            requestBody: body,
            promptMessages: [],
            metadata: null,
        };

        logLLMExecutionStart({
            reqId,
            endpoint: 'character_evolution_handoff',
            mode: 'memory',
            provider: '-',
            characterId,
            chatId,
            streaming: false,
        });

        const { settings, character } = await loadCharacterAndSettings(characterId);
        if (character.type === 'group') {
            throw new LLMHttpError(400, 'GROUP_CHAT_UNSUPPORTED', 'Character evolution is only supported for single-character chats.');
        }
        const evolution = resolveEffectiveEvolutionSettings(settings, character);
        const currentEvolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        req._characterEvolutionAudit.provider = evolution.extractionProvider;
        req._characterEvolutionAudit.model = evolution.extractionModel;
        req._characterEvolutionAudit.metadata = {
            model: evolution.extractionModel,
            maxTokens: evolution.extractionMaxTokens,
            replayed: forceReplay,
        };
        if (currentEvolution.pendingProposal) {
            throw new LLMHttpError(409, 'PENDING_PROPOSAL_EXISTS', 'Resolve the current evolution proposal before running another handoff.');
        }
        if (!forceReplay && evolution.lastProcessedChatId && evolution.lastProcessedChatId === chatId) {
            throw new LLMHttpError(409, 'CHAT_ALREADY_PROCESSED', 'This chat has already been handed off and accepted.');
        }
        const { chat } = await loadChat(characterId, chatId);
        const promptMessages = buildCharacterEvolutionPromptMessages({
            settings,
            character: {
                ...character,
                characterEvolution: evolution,
            },
            chat,
        });
        req._characterEvolutionAudit.promptMessages = promptMessages;
        if (!evolution.extractionProvider || !evolution.extractionModel) {
            throw new LLMHttpError(400, 'EXTRACTION_MODEL_MISSING', 'Configure an extraction provider and model before running handoff.');
        }

        const rawResult = await executeInternalLLMTextCompletion({
            provider: evolution.extractionProvider,
            model: evolution.extractionModel,
            mode: 'memory',
            characterId,
            chatId,
            maxTokens: evolution.extractionMaxTokens,
            messages: promptMessages,
            taskLabel: 'character_evolution_handoff',
        });
        const parsed = safeParseEvolutionJson(rawResult);
        if (!parsed) {
            req._characterEvolutionAudit.rawResult = rawResult;
            req._characterEvolutionAudit.metadata = {
                model: evolution.extractionModel,
                maxTokens: evolution.extractionMaxTokens,
                reason: 'parse_failed',
            };
            throw new LLMHttpError(502, 'EVOLUTION_PARSE_FAILED', 'Extraction model returned invalid JSON.');
        }
        const proposalPayload = normalizeCharacterEvolutionProposal(parsed, evolution);
        const pendingProposal = {
            proposalId: makeProposalId(),
            sourceChatId: chatId,
            proposedState: proposalPayload.proposedState,
            changes: proposalPayload.changes,
            createdAt: Date.now(),
        };

        const nextCharacter = clone(character, character);
        nextCharacter.characterEvolution = {
            ...character.characterEvolution,
            pendingProposal,
        };
        await replaceCharacterWithRetry(characterId, nextCharacter, 'character-evolution.handoff');

        const payload = {
            ok: true,
            replayed: forceReplay,
            proposal: pendingProposal,
        };
        const durationMs = Date.now() - startedAt;
        logLLMExecutionEnd({
            reqId,
            endpoint: 'character_evolution_handoff',
            mode: 'memory',
            provider: evolution.extractionProvider,
            characterId,
            chatId,
            status: 200,
            code: 'OK',
            durationMs,
        });
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'character_evolution_handoff',
            mode: 'memory',
            provider: evolution.extractionProvider,
            characterId,
            chatId,
            streaming: false,
            status: 200,
            ok: true,
            durationMs,
            metadata: {
                model: evolution.extractionModel,
                maxTokens: evolution.extractionMaxTokens,
                replayed: forceReplay,
            },
            request: buildEvolutionAuditRequest('character_evolution_handoff', body, promptMessages),
            response: payload,
        });
        sendJson(res, 200, payload);
    }));

    app.post('/data/character-evolution/:charId/proposal/accept', withAsyncRoute('character_evolution_accept', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        const { settings, character, charDir } = await loadCharacterAndSettings(characterId);
        if (character.type === 'group') {
            throw new LLMHttpError(400, 'GROUP_CHAT_UNSUPPORTED', 'Character evolution is only supported for single-character chats.');
        }
        const storedEvolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const effectiveEvolution = getEffectiveCharacterEvolutionSettings(settings, character);
        const pendingProposal = storedEvolution.pendingProposal;
        if (!pendingProposal) {
            throw new LLMHttpError(404, 'PENDING_PROPOSAL_NOT_FOUND', 'No pending proposal exists for this character.');
        }
        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const proposedState = sanitizeStateForEvolution(
            normalizeCharacterEvolutionState(body.proposedState || pendingProposal.proposedState),
            effectiveEvolution,
            storedEvolution.currentState
        );
        const recoveredVersions = mergeVersionMetas(
            storedEvolution.stateVersions,
            await readVersionMetasFromDisk(charDir, {
                includeStagedThroughVersion: storedEvolution.currentStateVersion || 0,
            }),
        );
        const nextVersion = Math.max(
            storedEvolution.currentStateVersion || 0,
            ...recoveredVersions.map((entry) => Number(entry.version) || 0),
        ) + 1;
        const acceptedAt = Date.now();
        const versionFile = await stageVersionFile(charDir, nextVersion, {
            version: nextVersion,
            chatId: pendingProposal.sourceChatId || null,
            acceptedAt,
            state: proposedState,
            sectionConfigs: effectiveEvolution.sectionConfigs,
            privacy: effectiveEvolution.privacy,
        });
        try {
            const nextCharacter = clone(character, character);
            nextCharacter.characterEvolution = {
                ...storedEvolution,
                currentStateVersion: nextVersion,
                currentState: proposedState,
                pendingProposal: null,
                lastProcessedChatId: pendingProposal.sourceChatId,
                stateVersions: [
                    ...recoveredVersions,
                    {
                        version: nextVersion,
                        chatId: pendingProposal.sourceChatId || null,
                        acceptedAt,
                    },
                ],
            };
            await replaceCharacterWithRetry(characterId, nextCharacter, 'character-evolution.accept');
        } catch (error) {
            await cleanupStagedVersionFile(versionFile.stagedPath);
            console.warn('[character-evolution] Failed to persist accepted evolution state after staging version file.', {
                characterId,
                version: nextVersion,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
        await finalizeVersionFile(versionFile);
        sendJson(res, 200, {
            ok: true,
            version: nextVersion,
            acceptedAt,
            state: proposedState,
        });
    }));

    app.post('/data/character-evolution/:charId/proposal/reject', withAsyncRoute('character_evolution_reject', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        const { character } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        if (!evolution.pendingProposal) {
            sendJson(res, 200, { ok: true, cleared: false });
            return;
        }
        const nextCharacter = clone(character, character);
        nextCharacter.characterEvolution = {
            ...evolution,
            pendingProposal: null,
        };
        await replaceCharacterWithRetry(characterId, nextCharacter, 'character-evolution.reject');
        sendJson(res, 200, { ok: true, cleared: true });
    }));

    app.get('/data/character-evolution/:charId/versions', withAsyncRoute('character_evolution_versions', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        const { character, charDir } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const versions = mergeVersionMetas(
            evolution.stateVersions,
            await readVersionMetasFromDisk(charDir, {
                includeStagedThroughVersion: evolution.currentStateVersion || 0,
            }),
        );
        sendJson(res, 200, {
            ok: true,
            currentStateVersion: evolution.currentStateVersion,
            versions: [...versions].sort((left, right) => right.version - left.version),
        });
    }));

    app.get('/data/character-evolution/:charId/versions/:version', withAsyncRoute('character_evolution_version', async (req, res) => {
        if (typeof requirePasswordAuth === 'function' && !requirePasswordAuth(req, res)) {
            return;
        }
        const characterId = toStringOrEmpty(req.params?.charId);
        const version = Number(req.params?.version);
        if (!characterId || !isSafePathSegment(characterId)) {
            throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'charId is required and must be a safe id.');
        }
        if (!Number.isFinite(version) || version < 0) {
            throw new LLMHttpError(400, 'INVALID_VERSION', 'version must be a positive number.');
        }
        const { character } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const committedVersion = (version > 0 && version <= evolution.currentStateVersion)
            || evolution.stateVersions.some((entry) => Number(entry?.version) === Math.floor(version));
        const versionPath = await resolveVersionFilePath(
            safeResolve(dataDirs.characters, characterId),
            Math.floor(version),
            { allowStaged: committedVersion },
        );
        if (!versionPath) {
            throw new LLMHttpError(404, 'VERSION_NOT_FOUND', `Evolution version not found: ${version}`);
        }
        const payload = JSON.parse(await fs.readFile(versionPath, 'utf-8'));
        sendJson(res, 200, {
            ok: true,
            version: {
                ...payload,
                state: normalizeCharacterEvolutionState(payload?.state),
                ...(Array.isArray(payload?.sectionConfigs)
                    ? { sectionConfigs: normalizeCharacterEvolutionSectionConfigs(payload.sectionConfigs) }
                    : {}),
                ...(payload?.privacy && typeof payload.privacy === 'object'
                    ? { privacy: normalizeCharacterEvolutionPrivacy(payload.privacy) }
                    : {}),
            },
        });
    }));
}

module.exports = {
    registerEvolutionRoutes,
};
