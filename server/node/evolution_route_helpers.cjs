function createEvolutionRouteHelpers(arg = {}) {
    const {
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
        sendJson,
        toLLMErrorResponse,
        toStringOrEmpty,
        truncatePromptMessagesForAudit,
        appendLLMAudit,
    } = arg;

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

    function normalizeRequestedSourceRange(chatId, sourceRangeRaw) {
        if (sourceRangeRaw === undefined) {
            return null;
        }
        const sourceRange = normalizeCharacterEvolutionRangeRef(sourceRangeRaw);
        if (!sourceRange) {
            throw new LLMHttpError(400, 'INVALID_SOURCE_RANGE', 'sourceRange must be a valid chat message range.');
        }
        if (sourceRange.chatId !== chatId) {
            throw new LLMHttpError(400, 'INVALID_SOURCE_RANGE', 'sourceRange.chatId must match chatId.');
        }
        return sourceRange;
    }

    function assertHandoffRangeAllowed(evolution, sourceRange, latestMessageIndex, forceReplay) {
        if (!sourceRange) {
            throw new LLMHttpError(400, 'INVALID_SOURCE_RANGE', 'sourceRange is required.');
        }
        if (sourceRange.startMessageIndex < 0 || sourceRange.endMessageIndex < sourceRange.startMessageIndex) {
            throw new LLMHttpError(400, 'INVALID_SOURCE_RANGE', 'sourceRange must have a valid contiguous start and end.');
        }
        if (sourceRange.endMessageIndex > latestMessageIndex) {
            throw new LLMHttpError(400, 'INVALID_SOURCE_RANGE', 'sourceRange must stay within the current chat message bounds.');
        }
        const processedRanges = getCharacterEvolutionProcessedRanges(evolution);
        const overlappingRange = processedRanges.find((entry) => rangesOverlap(entry.range, sourceRange));
        if (forceReplay) {
            if (!isRangeFullyCoveredByProcessedRanges(processedRanges, sourceRange)) {
                throw new LLMHttpError(409, 'RANGE_REPLAY_REQUIRES_ACCEPTED_RANGE', 'Replay is only allowed for a range already covered by accepted evolution coverage.');
            }
            return;
        }

        const nextStart = getLastProcessedMessageIndexForChat(evolution, sourceRange.chatId) + 1;
        if (nextStart > latestMessageIndex) {
            throw new LLMHttpError(409, 'RANGE_ALREADY_PROCESSED', 'This chat has no unprocessed messages left to hand off.');
        }
        if (sourceRange.startMessageIndex !== nextStart) {
            throw new LLMHttpError(409, 'NON_CONTIGUOUS_RANGE', 'V1 handoff only supports the next contiguous unprocessed message range.');
        }

        if (overlappingRange) {
            throw new LLMHttpError(409, 'RANGE_ALREADY_PROCESSED', 'This message range overlaps an accepted evolution range. Use replay to reprocess it.');
        }
    }

    function resolveHandoffSourceRange(evolution, chatId, chat, sourceRangeRaw, forceReplay) {
        const latestMessageIndex = getChatLastMessageIndex(chat);
        if (latestMessageIndex < 0) {
            throw new LLMHttpError(400, 'EMPTY_CHAT', 'Cannot run evolution handoff on an empty chat.');
        }

        const requestedSourceRange = normalizeRequestedSourceRange(chatId, sourceRangeRaw);
        const sourceRange = requestedSourceRange || (forceReplay
            ? {
                chatId,
                startMessageIndex: 0,
                endMessageIndex: latestMessageIndex,
            }
            : {
                chatId,
                startMessageIndex: getLastProcessedMessageIndexForChat(evolution, chatId) + 1,
                endMessageIndex: latestMessageIndex,
            });

        assertHandoffRangeAllowed(evolution, sourceRange, latestMessageIndex, forceReplay);
        return sourceRange;
    }

    function withAsyncRoute(endpoint, handler) {
        return async (req, res) => {
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
    }

    return {
        assertHandoffRangeAllowed,
        buildEvolutionAuditRequest,
        ensureCharacterChatInput,
        makeProposalId,
        resolveEffectiveEvolutionSettings,
        resolveHandoffSourceRange,
        withAsyncRoute,
    };
}

module.exports = {
    createEvolutionRouteHelpers,
};
