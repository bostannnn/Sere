const { ALLOWED_MODES, normalizeProvider, getStreamingPolicy } = require('./constants.cjs');
const { LLMHttpError } = require('./errors.cjs');
const { previewOpenRouterExecution, executeOpenRouter } = require('./openrouter.cjs');
const { previewOpenAIExecution, executeOpenAI } = require('./openai.cjs');
const { previewDeepSeekExecution, executeDeepSeek } = require('./deepseek.cjs');
const { previewAnthropicExecution, executeAnthropic } = require('./anthropic.cjs');
const { previewGoogleExecution, executeGoogle } = require('./google.cjs');
const { previewOllamaExecution, executeOllama } = require('./ollama.cjs');
const { previewKoboldExecution, executeKobold } = require('./kobold.cjs');
const { previewNovelAIExecution, executeNovelAI } = require('./novelai.cjs');
const { searchRulebooks } = require('../rag/engine.cjs');
const path = require('path');
const { existsSync } = require('fs');
const fs = require('fs/promises');

function isSafePathSegment(segment) {
    return typeof segment === 'string' &&
        segment.length > 0 &&
        segment.length <= 128 &&
        !segment.includes('/') &&
        !segment.includes('\\') &&
        !segment.includes('\0') &&
        !segment.includes('..') &&
        segment !== '.';
}

function escapePromptBrackets(value) {
    return String(value ?? '')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]');
}

function shiftPromptBlockIndices(promptBlocks, startIndex, delta) {
    if (!Array.isArray(promptBlocks)) return;
    const normalizedStart = Number.isInteger(Number(startIndex)) ? Number(startIndex) : 0;
    const normalizedDelta = Number.isInteger(Number(delta)) ? Number(delta) : 0;
    if (normalizedDelta === 0) return;
    for (const block of promptBlocks) {
        if (!block || typeof block !== 'object') continue;
        const idx = Number(block.index);
        if (!Number.isInteger(idx) || idx < normalizedStart) continue;
        block.index = idx + normalizedDelta;
    }
}

function parseExecutionInput(body, arg = {}) {
    const endpoint = arg.endpoint || 'execute';
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new LLMHttpError(400, 'INVALID_BODY', 'Request body must be a JSON object.', {
            endpoint,
        });
    }

    const mode = typeof body.mode === 'string' ? body.mode.trim() : 'model';
    if (!ALLOWED_MODES.has(mode)) {
        throw new LLMHttpError(400, 'INVALID_MODE', `Invalid mode "${mode}".`, {
            endpoint,
            allowedModes: Array.from(ALLOWED_MODES),
        });
    }

    const nestedRequestModel =
        (typeof body?.request?.model === 'string' ? body.request.model : '') ||
        (typeof body?.request?.requestBody?.model === 'string' ? body.request.requestBody.model : '');
    const provider = normalizeProvider(body.provider, body.model || nestedRequestModel);
    const characterId = typeof body.characterId === 'string' ? body.characterId.trim() : '';
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
    if (characterId && !isSafePathSegment(characterId)) {
        throw new LLMHttpError(400, 'INVALID_CHARACTER_ID', 'characterId must be a safe id.', { endpoint });
    }
    if (chatId && !isSafePathSegment(chatId)) {
        throw new LLMHttpError(400, 'INVALID_CHAT_ID', 'chatId must be a safe id.', { endpoint });
    }

    const requestedStreaming = !!body.streaming;
    const streamingPolicy = getStreamingPolicy(provider);
    if (requestedStreaming && streamingPolicy === 'error') {
        throw new LLMHttpError(
            400,
            'STREAMING_NOT_SUPPORTED',
            `${provider} server migration path does not support streaming yet.`,
            {
                endpoint,
                provider,
                streamingPolicy,
            }
        );
    }

    return {
        endpoint,
        mode,
        provider,
        model: typeof body.model === 'string'
            ? body.model.trim()
            : (typeof nestedRequestModel === 'string' ? nestedRequestModel.trim() : ''),
        characterId,
        chatId,
        requestedStreaming,
        streaming: requestedStreaming && streamingPolicy === 'native',
        streamingPolicy,
        continue: !!body.continue,
        dryRun: !!body.dryRun,
        request: body,
    };
}

async function assembleServerPrompt(input, ctx) {
    const start = Date.now();
    if (input?.request?.internalNoAssembly === true || input?.request?.request?.internalNoAssembly === true) {
        return;
    }
    if (!input.characterId) return;

    const preloadedContext = (input?.request && typeof input.request === 'object')
        ? input.request.__serverContext
        : null;

    let char = null;
    if (preloadedContext && typeof preloadedContext === 'object' && preloadedContext.character && typeof preloadedContext.character === 'object') {
        char = preloadedContext.character;
    } else {
        const charPath = path.join(ctx.dataRoot, 'characters', input.characterId, 'character.json');
        if (!existsSync(charPath)) return;
        const charDataRaw = await fs.readFile(charPath, 'utf-8');
        const charData = JSON.parse(charDataRaw);
        char = charData.character || charData.data || charData;
    }

    let settings = null;
    if (preloadedContext && typeof preloadedContext === 'object' && preloadedContext.settings && typeof preloadedContext.settings === 'object') {
        settings = preloadedContext.settings;
    } else {
        const settingsPath = path.join(ctx.dataRoot, 'settings.json');
        const settingsRaw = await fs.readFile(settingsPath, 'utf-8');
        const settingsParsed = JSON.parse(settingsRaw);
        settings = (settingsParsed && typeof settingsParsed === 'object' && settingsParsed.data && typeof settingsParsed.data === 'object')
            ? settingsParsed.data
            : settingsParsed;
    }

    let rulesContext = "";
    let gameStateContext = "";

    // 1. RAG Search
    // Source of truth policy:
    // - Character scope: enabled + selected rulebooks.
    // - Global scope: retrieval tuning (topK/minScore/model/budget).
    const charRag = (input.request?.ragSettings && typeof input.request.ragSettings === 'object')
        ? input.request.ragSettings
        : (char.ragSettings || {});
    const globalRag = (input.request?.globalRagSettings && typeof input.request.globalRagSettings === 'object')
        ? input.request.globalRagSettings
        : (settings.globalRagSettings || {});
    const ragEnabled = charRag.enabled === true;
    const enabledRulebooks = Array.from(new Set(
        (Array.isArray(charRag.enabledRulebooks) ? charRag.enabledRulebooks : [])
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean)
    ));

    const DEBUG = process.env.RISU_DEBUG === '1';
    if (DEBUG) console.log(`[Server-Assembly] RAG Check: charRag.enabled=${charRag.enabled}, ragEnabled=${ragEnabled}`);
    if (DEBUG) console.log(`[Server-Assembly] Rulebooks: enabledRulebooks.length=${enabledRulebooks.length}`);

    if (ragEnabled && enabledRulebooks.length > 0) {
        // Find messages in either path
        const messages = input.request?.request?.requestBody?.messages || input.request?.request?.messages || input.request?.requestBody?.messages || input.request?.messages || [];

        // Build RAG query from sliding window of last 3 non-system turns
        // Short user messages like "a)" or "3" are useless for semantic search,
        // so we pull recent assistant context too.
        const recentTurns = messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .slice(-3)
            .map(m => typeof m.content === 'string' ? m.content.substring(0, 500) : '')
            .filter(Boolean);
        const ragQuery = recentTurns.join('\n').trim();

        if (DEBUG) console.log(`[Server-Assembly] Message Check: msgCount=${messages.length}, ragQuery length=${ragQuery.length}`);

        if (ragQuery) {
            const topK = Number.isFinite(Number(globalRag.topK)) ? Number(globalRag.topK) : 3;
            const minScore = Number.isFinite(Number(globalRag.minScore)) ? Number(globalRag.minScore) : 0.1;
            const ragModel = (typeof globalRag.model === 'string' && globalRag.model.trim()) ? globalRag.model.trim() : 'MiniLM';

            const results = await searchRulebooks(
                ragQuery,
                enabledRulebooks,
                topK,
                minScore,
                ragModel,
                { ragRulebooks: path.join(ctx.dataRoot, 'rag', 'rulebooks') }
            );

            if (results.length > 0) {
                rulesContext = "<Rules Context>\n";
                for (const res of results) {
                    const meta = res.chunk.metadata;
                    let citation = meta.source_file;
                    if (meta.system) citation = `${meta.system} - ${citation}`;
                    if (meta.page) citation = `${citation}, p. ${meta.page}`;
                    rulesContext += `[Source: ${citation}]\n${res.chunk.content}\n\n`;
                }
                rulesContext += "</Rules Context>\n";

                input._ragMeta = {
                    query: ragQuery.substring(0, 200),
                    resultCount: results.length,
                    sources: results.map(r => r.chunk.metadata.source_file),
                };
            }
        }
    }

    // 2. Game State
    if (char.gameState && Object.keys(char.gameState).length > 0) {
        gameStateContext = "[Active Game State]\n";
        for (const [key, value] of Object.entries(char.gameState)) {
            const safeKey = escapePromptBrackets(key);
            const valueText = (typeof value === 'string')
                ? value
                : (typeof value === 'number' || typeof value === 'boolean')
                    ? String(value)
                    : JSON.stringify(value);
            const safeValue = escapePromptBrackets(valueText);
            gameStateContext += `[${safeKey}: ${safeValue}]\n`;
        }
        gameStateContext += "\n";
    }

    const ensurePromptBlocks = () => {
        const request = input?.request;
        if (!request || typeof request !== 'object') return null;
        if (!Array.isArray(request.promptBlocks)) {
            request.promptBlocks = [];
        }
        return request.promptBlocks;
    };

    // 3. Inject into messages
    if (rulesContext || gameStateContext) {
        const injectedContext = [rulesContext, gameStateContext].filter(Boolean).join('\n\n');

        // Find the messages array — client nests it as payload.request.requestBody.messages
        // After parseExecutionInput, input.request = payload, so messages are at input.request.request.requestBody.messages
        const messagesArray = input.request?.request?.requestBody?.messages
            || input.request?.request?.messages
            || input.request?.requestBody?.messages
            || input.request?.messages
            || null;

        if (messagesArray && Array.isArray(messagesArray) && messagesArray.length > 0) {
            const systemMsg = messagesArray.find(m => m.role === 'system' || m.role === 'developer');
            if (systemMsg) {
                systemMsg.content = injectedContext + "\n\n" + systemMsg.content;
                const promptBlocks = ensurePromptBlocks();
                if (promptBlocks) {
                    if (rulesContext) {
                        promptBlocks.push({
                            role: 'system',
                            title: 'Rulebook RAG',
                            source: 'server-rag',
                            mergedInto: 'first-system',
                        });
                    }
                    if (gameStateContext) {
                        promptBlocks.push({
                            role: 'system',
                            title: 'Game State',
                            source: 'server-gamestate',
                            mergedInto: 'first-system',
                        });
                    }
                }
            } else {
                messagesArray.unshift({ role: 'system', content: injectedContext });
                const promptBlocks = ensurePromptBlocks();
                if (promptBlocks) {
                    shiftPromptBlockIndices(promptBlocks, 0, 1);
                    const title = rulesContext && gameStateContext
                        ? 'Rulebook RAG + Game State'
                        : (rulesContext ? 'Rulebook RAG' : 'Game State');
                    promptBlocks.push({
                        index: 0,
                        role: 'system',
                        title,
                        source: 'server-assembly',
                    });
                }
            }
        } else if (injectedContext) {
            // No messages found — create a system message in the most likely location
            const newMessages = [{ role: 'system', content: injectedContext }];
            if (input.request?.request?.requestBody) {
                input.request.request.requestBody.messages = newMessages;
            } else if (input.request?.requestBody) {
                input.request.requestBody.messages = newMessages;
            }
            const promptBlocks = ensurePromptBlocks();
            if (promptBlocks) {
                const title = rulesContext && gameStateContext
                    ? 'Rulebook RAG + Game State'
                    : (rulesContext ? 'Rulebook RAG' : 'Game State');
                promptBlocks.push({
                    index: 0,
                    role: 'system',
                    title,
                    source: 'server-assembly',
                });
            }
        }
    }
    if (DEBUG) console.log(`[Server-Assembly] Total assembly time: ${Date.now() - start}ms`);
}

async function previewExecution(input, ctx = {}) {
    await assembleServerPrompt(input, ctx);
    if (input.provider === 'openrouter') {
        return await previewOpenRouterExecution(input, ctx);
    }
    if (input.provider === 'openai') {
        return await previewOpenAIExecution(input, ctx);
    }
    if (input.provider === 'deepseek') {
        return await previewDeepSeekExecution(input, ctx);
    }
    if (input.provider === 'anthropic') {
        return await previewAnthropicExecution(input, ctx);
    }
    if (input.provider === 'google') {
        return await previewGoogleExecution(input, ctx);
    }
    if (input.provider === 'ollama') {
        return await previewOllamaExecution(input, ctx);
    }
    if (input.provider === 'kobold') {
        return await previewKoboldExecution(input, ctx);
    }
    if (input.provider === 'novelai') {
        return await previewNovelAIExecution(input, ctx);
    }
    throw new LLMHttpError(409, 'PROVIDER_NOT_MIGRATED', `Provider not migrated: ${input.provider}`);
}

async function execute(input, ctx = {}) {
    await assembleServerPrompt(input, ctx);
    if (input.provider === 'openrouter') {
        return await executeOpenRouter(input, ctx);
    }
    if (input.provider === 'openai') {
        return await executeOpenAI(input, ctx);
    }
    if (input.provider === 'deepseek') {
        return await executeDeepSeek(input, ctx);
    }
    if (input.provider === 'anthropic') {
        return await executeAnthropic(input, ctx);
    }
    if (input.provider === 'google') {
        return await executeGoogle(input, ctx);
    }
    if (input.provider === 'ollama') {
        return await executeOllama(input, ctx);
    }
    if (input.provider === 'kobold') {
        return await executeKobold(input, ctx);
    }
    if (input.provider === 'novelai') {
        return await executeNovelAI(input, ctx);
    }
    throw new LLMHttpError(409, 'PROVIDER_NOT_MIGRATED', `Provider not migrated: ${input.provider}`);
}

module.exports = {
    parseExecutionInput,
    assembleServerPrompt,
    previewExecution,
    execute,
};
