function registerEvolutionRoutes(arg = {}) {
    const {
        app,
        dataDirs,
        existsSync,
        LLMHttpError,
        requirePasswordAuth,
        safeResolve,
        sendJson,
        logLLMExecutionStart,
        executeInternalLLMTextCompletion,
        applyStateCommands,
        readStateLastEventId,
        applyCharacterEvolutionItemMetadata = require('../llm/character_evolution/items.cjs').applyCharacterEvolutionItemMetadata,
        mergeAcceptedCharacterEvolutionState = require('../llm/character_evolution/items.cjs').mergeAcceptedCharacterEvolutionState,
        resolveCharacterEvolutionStateConflicts = require('../llm/character_evolution/conflicts.cjs').resolveCharacterEvolutionStateConflicts,
        createCharacterEvolutionRepository = require('../services/character_evolution_repository.cjs').createCharacterEvolutionRepository,
        createCharacterEvolutionHistoryResolver = require('../services/character_evolution_history_resolver.cjs').createCharacterEvolutionHistoryResolver,
        createCharacterEvolutionVersionStore = require('../services/character_evolution_version_store.cjs').createCharacterEvolutionVersionStore,
        createEvolutionRouteHelpers = require('./evolution_routes.helpers.cjs').createEvolutionRouteHelpers,
        registerEvolutionVersionRoutes = require('./evolution_version_routes.cjs').registerEvolutionVersionRoutes,
        buildCharacterEvolutionPromptMessages = require('../llm/character_evolution.cjs').buildCharacterEvolutionPromptMessages,
        clone = require('../llm/character_evolution.cjs').clone,
        getEffectiveCharacterEvolutionSettings = require('../llm/character_evolution.cjs').getEffectiveCharacterEvolutionSettings,
        getCharacterEvolutionProposalValidationError = require('../llm/character_evolution/proposal.cjs').getCharacterEvolutionProposalValidationError,
        normalizeCharacterEvolutionProposal = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionProposal,
        normalizeCharacterEvolutionProposalState = require('../llm/character_evolution/proposal.cjs').normalizeCharacterEvolutionProposalState,
        normalizeCharacterEvolutionPrivacy = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionPrivacy,
        normalizeCharacterEvolutionRangeRef = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionRangeRef,
        normalizeCharacterEvolutionSectionConfigs = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionSectionConfigs,
        normalizeCharacterEvolutionSettings = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionSettings,
        normalizeCharacterEvolutionState = require('../llm/character_evolution.cjs').normalizeCharacterEvolutionState,
        safeParseEvolutionJson = require('../llm/character_evolution.cjs').safeParseEvolutionJson,
        sanitizeProposalStateForEvolution = require('../llm/character_evolution/proposal.cjs').sanitizeProposalStateForEvolution,
        sanitizeStateForEvolution = require('../llm/character_evolution.cjs').sanitizeStateForEvolution,
        buildMemoryPromptTrace = require('../llm/audit_payloads.cjs').createAuditPayloadBuilders({}).buildMemoryPromptTrace,
        getChatLastMessageIndex = require('../llm/character_evolution.cjs').getChatLastMessageIndex,
        getCharacterEvolutionProcessedRanges = require('../llm/character_evolution.cjs').getCharacterEvolutionProcessedRanges,
        getLastProcessedMessageIndexForChat = require('../llm/character_evolution.cjs').getLastProcessedMessageIndexForChat,
        getReqIdFromResponse,
        isRangeFullyCoveredByProcessedRanges = require('../llm/character_evolution.cjs').isRangeFullyCoveredByProcessedRanges,
        isSafePathSegment,
        logLLMExecutionEnd,
        appendLLMAudit,
        buildExecutionAuditRequest,
        rangesOverlap = require('../llm/character_evolution.cjs').rangesOverlap,
        toLLMErrorResponse,
        toStringOrEmpty,
        truncatePromptMessagesForAudit = require('../llm/prompt.cjs').truncatePromptMessagesForAudit,
        fs,
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
    const evolutionHistory = createCharacterEvolutionHistoryResolver({
        normalizeCharacterEvolutionRangeRef,
    });
    const {
        buildEvolutionAuditRequest,
        ensureCharacterChatInput,
        makeProposalId,
        resolveEffectiveEvolutionSettings,
        resolveHandoffSourceRange,
        withAsyncRoute,
    } = createEvolutionRouteHelpers({
        appendLLMAudit,
        buildExecutionAuditRequest,
        buildMemoryPromptTrace,
        getCharacterEvolutionProcessedRanges,
        getChatLastMessageIndex,
        getEffectiveCharacterEvolutionSettings,
        getLastProcessedMessageIndexForChat,
        getReqIdFromResponse,
        isRangeFullyCoveredByProcessedRanges,
        isSafePathSegment,
        LLMHttpError,
        logLLMExecutionEnd,
        normalizeCharacterEvolutionRangeRef,
        rangesOverlap,
        requirePasswordAuth,
        sendJson,
        toLLMErrorResponse,
        toStringOrEmpty,
        truncatePromptMessagesForAudit,
    });

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
        const { chat } = await loadChat(characterId, chatId);
        const sourceRange = resolveHandoffSourceRange(currentEvolution, chatId, chat, body.sourceRange, forceReplay);
        req._characterEvolutionAudit.metadata = {
            model: evolution.extractionModel,
            maxTokens: evolution.extractionMaxTokens,
            replayed: forceReplay,
            sourceRange,
        };
        const promptMessages = buildCharacterEvolutionPromptMessages({
            settings,
            character: {
                ...character,
                characterEvolution: evolution,
            },
            chat,
            sourceRange,
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
        const { settings: latestSettings, character: latestCharacter } = await loadCharacterAndSettings(characterId);
        const latestEffectiveEvolution = resolveEffectiveEvolutionSettings(latestSettings, latestCharacter);
        const latestEvolution = normalizeCharacterEvolutionSettings(latestCharacter.characterEvolution);
        if (latestEvolution.pendingProposal) {
            throw new LLMHttpError(409, 'PENDING_PROPOSAL_EXISTS', 'Another evolution handoff finished first. Review the current proposal before running another handoff.');
        }
        assertHandoffRangeAllowed(latestEvolution, sourceRange, getChatLastMessageIndex(chat), forceReplay);
        const proposalValidationError = getCharacterEvolutionProposalValidationError(parsed, latestEffectiveEvolution);
        if (proposalValidationError) {
            req._characterEvolutionAudit.rawResult = rawResult;
            req._characterEvolutionAudit.metadata = {
                model: evolution.extractionModel,
                maxTokens: evolution.extractionMaxTokens,
                reason: 'invalid_proposal',
                validationError: proposalValidationError,
            };
            throw new LLMHttpError(502, 'EVOLUTION_INVALID_PROPOSAL', proposalValidationError);
        }
        const proposalPayload = normalizeCharacterEvolutionProposal(parsed, latestEffectiveEvolution);
        const pendingProposalCreatedAt = Date.now();
        const normalizedProposalState = resolveCharacterEvolutionStateConflicts({
            currentState: latestEvolution.currentState,
            proposedState: applyCharacterEvolutionItemMetadata({
                state: proposalPayload.proposedState,
                baseState: latestEvolution.currentState,
                sourceChatId: chatId,
                sourceRange,
                timestamp: pendingProposalCreatedAt,
                retainOmittedSections: false,
            }),
            retainOmittedSections: false,
        });
        const stagedProposalState = mergeAcceptedCharacterEvolutionState({
            currentState: latestEvolution.currentState,
            proposedState: normalizedProposalState,
            retainOmittedSections: false,
            includeUnchangedCurrentItems: false,
        });
        const pendingProposal = {
            proposalId: makeProposalId(),
            sourceChatId: chatId,
            sourceRange,
            proposedState: stagedProposalState,
            changes: proposalPayload.changes,
            createdAt: pendingProposalCreatedAt,
        };

        const nextCharacter = clone(latestCharacter, latestCharacter);
        nextCharacter.characterEvolution = {
            ...latestEvolution,
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
                sourceRange,
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
        const acceptedAt = Date.now();
        const sourceRange = normalizeCharacterEvolutionRangeRef(pendingProposal.sourceRange);
        const proposedStateRaw = Object.prototype.hasOwnProperty.call(body, 'proposedState')
            ? body.proposedState
            : pendingProposal.proposedState;
        const proposalValidationError = getCharacterEvolutionProposalValidationError({
            proposedState: proposedStateRaw,
            changes: [],
        }, effectiveEvolution);
        if (proposalValidationError) {
            throw new LLMHttpError(400, 'EVOLUTION_INVALID_PROPOSAL', proposalValidationError);
        }
        const proposedStateDraft = sanitizeProposalStateForEvolution(
            normalizeCharacterEvolutionProposalState(proposedStateRaw),
            effectiveEvolution
        );
        const normalizedAcceptedProposalState = resolveCharacterEvolutionStateConflicts({
            currentState: storedEvolution.currentState,
            proposedState: applyCharacterEvolutionItemMetadata({
                state: proposedStateDraft,
                baseState: storedEvolution.currentState,
                sourceChatId: pendingProposal.sourceChatId,
                sourceRange,
                timestamp: acceptedAt,
                overwriteNewItemTimestamps: true,
                retainOmittedSections: false,
            }),
            retainOmittedSections: false,
        });
        const proposedState = mergeAcceptedCharacterEvolutionState({
            currentState: storedEvolution.currentState,
            proposedState: normalizedAcceptedProposalState,
        });
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
        const versionFile = await stageVersionFile(charDir, nextVersion, {
            version: nextVersion,
            chatId: pendingProposal.sourceChatId || null,
            acceptedAt,
            ...(sourceRange ? { range: sourceRange } : {}),
            state: proposedState,
            sectionConfigs: effectiveEvolution.sectionConfigs,
            privacy: effectiveEvolution.privacy,
        });
        try {
            const nextLastProcessedMessageIndexByChat = {
                ...(storedEvolution.lastProcessedMessageIndexByChat ?? {}),
                ...(sourceRange
                    ? {
                        [sourceRange.chatId]: Math.max(
                            storedEvolution.lastProcessedMessageIndexByChat?.[sourceRange.chatId] ?? -1,
                            sourceRange.endMessageIndex,
                        ),
                    }
                    : {}),
            };
            const nextProcessedRanges = [
                ...(Array.isArray(storedEvolution.processedRanges)
                    ? storedEvolution.processedRanges.filter((entry) => Number(entry?.version) !== nextVersion)
                    : []),
                ...(sourceRange
                    ? [{
                        version: nextVersion,
                        acceptedAt,
                        range: sourceRange,
                    }]
                    : []),
            ];
            const nextCharacter = clone(character, character);
            nextCharacter.characterEvolution = {
                ...storedEvolution,
                currentStateVersion: nextVersion,
                currentState: proposedState,
                pendingProposal: null,
                lastProcessedChatId: sourceRange?.chatId || pendingProposal.sourceChatId,
                lastProcessedMessageIndexByChat: nextLastProcessedMessageIndexByChat,
                processedRanges: nextProcessedRanges,
                stateVersions: [
                    ...recoveredVersions,
                    {
                        version: nextVersion,
                        chatId: pendingProposal.sourceChatId || null,
                        acceptedAt,
                        ...(sourceRange ? { range: sourceRange } : {}),
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
            ...(sourceRange ? { range: sourceRange } : {}),
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

    registerEvolutionVersionRoutes({
        app,
        dataDirs,
        fs,
        isSafePathSegment,
        LLMHttpError,
        loadCharacterAndSettings,
        normalizeCharacterEvolutionPrivacy,
        normalizeCharacterEvolutionRangeRef,
        normalizeCharacterEvolutionSectionConfigs,
        normalizeCharacterEvolutionSettings,
        normalizeCharacterEvolutionState,
        readVersionMetasFromDisk,
        requirePasswordAuth,
        resolveVersionFilePath,
        safeResolve,
        sendJson,
        toStringOrEmpty,
        versionHistory: evolutionHistory,
        withAsyncRoute,
    });
}
module.exports = { registerEvolutionRoutes };
