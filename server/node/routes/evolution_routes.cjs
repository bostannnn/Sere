const path = require('path');
const {
    buildCharacterEvolutionPromptMessages,
    clone,
    getEffectiveCharacterEvolutionSettings,
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionProposal,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
    sanitizeStateForEvolution,
} = require('../llm/character_evolution.cjs');

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
    } = arg;

    if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
        throw new Error('registerEvolutionRoutes requires an Express app instance.');
    }
    if (typeof safeResolve !== 'function') {
        throw new Error('registerEvolutionRoutes requires safeResolve.');
    }

    async function readJsonFile(filePath) {
        const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        return raw?.character || raw?.chat || raw?.data || raw || {};
    }

    async function loadCharacterAndSettings(characterId) {
        const settingsPath = safeResolve(dataDirs.root, 'settings.json');
        const charDir = safeResolve(dataDirs.characters, characterId);
        const charPath = safeResolve(charDir, 'character.json');
        if (!existsSync(settingsPath)) {
            throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        }
        if (!existsSync(charPath)) {
            throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        }
        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = settingsRaw?.data || settingsRaw || {};
        const character = await readJsonFile(charPath);
        return {
            settings: {
                ...settings,
                characterEvolutionDefaults: normalizeCharacterEvolutionDefaults(settings.characterEvolutionDefaults),
            },
            character: {
                ...character,
                characterEvolution: normalizeCharacterEvolutionSettings(character.characterEvolution),
            },
            charDir,
            charPath,
        };
    }

    async function loadChat(characterId, chatId) {
        const chatPath = safeResolve(dataDirs.characters, `${characterId}/chats/${chatId}.json`);
        if (!existsSync(chatPath)) {
            throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);
        }
        return {
            chat: await readJsonFile(chatPath),
            chatPath,
        };
    }

    function makeProposalId() {
        return `evo_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    async function replaceCharacterWithRetry(characterId, nextCharacter, source) {
        if (typeof applyStateCommands !== 'function') {
            throw new LLMHttpError(500, 'STATE_COMMANDS_UNAVAILABLE', 'Internal state command service is unavailable.');
        }
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            try {
                await applyStateCommands([
                    {
                        type: 'character.replace',
                        charId: characterId,
                        character: nextCharacter,
                    },
                ], source, { baseEventId });
                return;
            } catch (error) {
                const conflicts = Array.isArray(error?.result?.conflicts) ? error.result.conflicts : [];
                const isStale = conflicts.some((entry) => entry?.code === 'STALE_BASE_EVENT');
                if (!isStale || attempt >= 1) {
                    throw error;
                }
            }
        }
    }

    async function writeVersionFile(characterDir, version, payload) {
        const statesDir = path.join(characterDir, 'states');
        await fs.mkdir(statesDir, { recursive: true });
        await fs.writeFile(
            path.join(statesDir, `v${version}.json`),
            JSON.stringify(payload, null, 2),
            'utf-8'
        );
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

    const withAsyncRoute = (endpoint, handler) => async (req, res) => {
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        try {
            await handler(req, res, reqId, startedAt);
        } catch (error) {
            const response = toLLMErrorResponse(error, {
                requestId: reqId,
                endpoint,
                durationMs: Date.now() - startedAt,
            });
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
        ensureCharacterChatInput(characterId, chatId);

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
        if (evolution.lastProcessedChatId && evolution.lastProcessedChatId === chatId) {
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
        if (!evolution.extractionProvider || !evolution.extractionModel) {
            throw new LLMHttpError(400, 'EXTRACTION_MODEL_MISSING', 'Configure an extraction provider and model before running handoff.');
        }

        const rawResult = await executeInternalLLMTextCompletion({
            provider: evolution.extractionProvider,
            model: evolution.extractionModel,
            mode: 'memory',
            characterId,
            chatId,
            maxTokens: 2400,
            messages: promptMessages,
            taskLabel: 'character_evolution_handoff',
        });
        const parsed = require('../llm/character_evolution.cjs').safeParseEvolutionJson(rawResult);
        if (!parsed) {
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
            request: buildExecutionAuditRequest('character_evolution_handoff', body),
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
        const { character, charDir } = await loadCharacterAndSettings(characterId);
        if (character.type === 'group') {
            throw new LLMHttpError(400, 'GROUP_CHAT_UNSUPPORTED', 'Character evolution is only supported for single-character chats.');
        }
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        const pendingProposal = evolution.pendingProposal;
        if (!pendingProposal) {
            throw new LLMHttpError(404, 'PENDING_PROPOSAL_NOT_FOUND', 'No pending proposal exists for this character.');
        }
        if (evolution.lastProcessedChatId && evolution.lastProcessedChatId === pendingProposal.sourceChatId) {
            throw new LLMHttpError(409, 'CHAT_ALREADY_PROCESSED', 'This chat has already been accepted.');
        }

        const body = (req.body && typeof req.body === 'object') ? req.body : {};
        const proposedState = sanitizeStateForEvolution(
            normalizeCharacterEvolutionState(body.proposedState || pendingProposal.proposedState),
            evolution
        );
        const nextVersion = Math.max(
            evolution.currentStateVersion || 0,
            ...evolution.stateVersions.map((entry) => Number(entry.version) || 0),
        ) + 1;
        const acceptedAt = Date.now();
        await writeVersionFile(charDir, nextVersion, {
            version: nextVersion,
            chatId: pendingProposal.sourceChatId || null,
            acceptedAt,
            state: proposedState,
        });

        const nextCharacter = clone(character, character);
        nextCharacter.characterEvolution = {
            ...evolution,
            currentStateVersion: nextVersion,
            currentState: proposedState,
            pendingProposal: null,
            lastProcessedChatId: pendingProposal.sourceChatId,
            stateVersions: [
                ...evolution.stateVersions,
                {
                    version: nextVersion,
                    chatId: pendingProposal.sourceChatId || null,
                    acceptedAt,
                },
            ],
        };
        await replaceCharacterWithRetry(characterId, nextCharacter, 'character-evolution.accept');
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
        const { character } = await loadCharacterAndSettings(characterId);
        const evolution = normalizeCharacterEvolutionSettings(character.characterEvolution);
        sendJson(res, 200, {
            ok: true,
            currentStateVersion: evolution.currentStateVersion,
            versions: [...evolution.stateVersions].sort((left, right) => right.version - left.version),
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
        const versionPath = safeResolve(dataDirs.characters, `${characterId}/states/v${Math.floor(version)}.json`);
        if (!existsSync(versionPath)) {
            throw new LLMHttpError(404, 'VERSION_NOT_FOUND', `Evolution version not found: ${version}`);
        }
        const payload = JSON.parse(await fs.readFile(versionPath, 'utf-8'));
        sendJson(res, 200, {
            ok: true,
            version: payload,
        });
    }));
}

module.exports = {
    registerEvolutionRoutes,
};
