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
const { estimateTextTokens, extractTextFromMessageContent } = require('./tokenizer.cjs');
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

function formatRulebookCitation(metadata = {}) {
    let citation = metadata.source_file || 'Unknown source';
    if (metadata.system) citation = `${metadata.system} - ${citation}`;
    if (metadata.edition) citation = `${citation} (${metadata.edition})`;
    if (metadata.page) citation = `${citation}, p. ${metadata.page}`;
    return citation;
}

function buildRuleContextBlock(result) {
    return `[Source: ${formatRulebookCitation(result?.chunk?.metadata)}]\n${result?.chunk?.content || ''}\n\n`;
}

function trimResultToBudget(result, budget) {
    if (!result || !result.chunk || typeof result.chunk.content !== 'string') return null;
    const normalizedBudget = Number.isFinite(Number(budget)) ? Math.max(0, Math.floor(Number(budget))) : 0;
    if (normalizedBudget <= 0) return null;

    const metadata = result.chunk.metadata || {};
    const content = result.chunk.content.trim();
    if (!content) return null;
    const truncationMarker = '\n[Context truncated to fit budget]';
    let maxChars = Math.max(1, normalizedBudget * 4);

    while (maxChars > 0) {
        let truncated = content.slice(0, maxChars);
        const sentenceBreak = Math.max(
            truncated.lastIndexOf('. '),
            truncated.lastIndexOf('? '),
            truncated.lastIndexOf('! '),
            truncated.lastIndexOf('\n')
        );
        if (sentenceBreak >= Math.floor(maxChars * 0.6)) {
            truncated = truncated.slice(0, sentenceBreak + 1);
        }
        truncated = truncated.trim();
        if (!truncated) {
            maxChars -= 8;
            continue;
        }

        const candidate = {
            ...result,
            chunk: {
                ...result.chunk,
                content: `${truncated}${truncationMarker}`,
            },
        };
        const totalTokens = estimateTextTokens(`<Rules Context>\n${buildRuleContextBlock(candidate)}</Rules Context>\n`);
        if (totalTokens <= normalizedBudget) {
            return candidate;
        }
        maxChars = Math.min(maxChars - 8, truncated.length - 1);
    }

    return null;
}

function buildUserOnlyRagQuery(messages) {
    if (!Array.isArray(messages)) return '';
    const userTurns = messages
        .filter((message) => message?.role === 'user')
        .map((message) => extractTextFromMessageContent(message.content))
        .map((content) => content.trim())
        .filter(Boolean);
    if (userTurns.length === 0) return '';

    const selected = [];
    for (let i = userTurns.length - 1; i >= 0 && selected.length < 3; i -= 1) {
        selected.unshift(userTurns[i]);
        const combined = selected.join('\n\n');
        if (estimateTextTokens(combined) >= 48) {
            break;
        }
    }
    return selected.join('\n\n').slice(0, 1500).trim();
}

function applyRagBudget(results, budget) {
    if (!Array.isArray(results) || results.length === 0) return [];
    const normalizedBudget = Number.isFinite(Number(budget)) ? Math.max(0, Math.floor(Number(budget))) : 0;
    if (normalizedBudget <= 0) return results;

    const kept = [];
    let usedTokens = estimateTextTokens('<Rules Context>\n</Rules Context>\n');

    for (const result of results) {
        const blockTokens = estimateTextTokens(buildRuleContextBlock(result));
        if (usedTokens + blockTokens > normalizedBudget) {
            if (kept.length === 0) {
                const trimmed = trimResultToBudget(result, normalizedBudget);
                if (trimmed) {
                    kept.push(trimmed);
                }
            }
            break;
        }
        kept.push(result);
        usedTokens += blockTokens;
    }

    return kept;
}

function resolveEffectiveRagSettings(charRag = {}, globalRag = {}) {
    const enabledRulebooks = Array.from(new Set(
        (Array.isArray(charRag.enabledRulebooks) ? charRag.enabledRulebooks : [])
            .map((id) => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean)
    ));

    return {
        enabled: charRag.enabled === true,
        enabledRulebooks,
        topK: Number.isFinite(Number(charRag.topK)) ? Number(charRag.topK)
            : (Number.isFinite(Number(globalRag.topK)) ? Number(globalRag.topK) : 3),
        minScore: Number.isFinite(Number(charRag.minScore)) ? Number(charRag.minScore)
            : (Number.isFinite(Number(globalRag.minScore)) ? Number(globalRag.minScore) : 0.1),
        budget: Number.isFinite(Number(charRag.budget)) ? Number(charRag.budget)
            : (Number.isFinite(Number(globalRag.budget)) ? Number(globalRag.budget) : 0),
        model: (typeof charRag.model === 'string' && charRag.model.trim()) ? charRag.model.trim()
            : ((typeof globalRag.model === 'string' && globalRag.model.trim()) ? globalRag.model.trim() : 'MiniLM'),
    };
}

function renderContextForTemplateSlot(slotBlock, content) {
    const innerFormat = typeof slotBlock?.innerFormat === 'string' ? slotBlock.innerFormat.trim() : '';
    if (!innerFormat) return content;
    if (innerFormat.includes('{{slot}}')) {
        return innerFormat.replace('{{slot}}', content);
    }
    return `${innerFormat}\n${content}`;
}

function injectContextAtTemplateSlot(messagesArray, promptBlocks, slotName, content, source) {
    if (!content || !Array.isArray(messagesArray) || !Array.isArray(promptBlocks)) {
        return false;
    }
    const slotBlock = promptBlocks.find((block) => block && block.slot === slotName && Number.isInteger(Number(block.index)));
    if (!slotBlock) {
        return false;
    }
    const insertIndex = Math.max(0, Math.min(messagesArray.length, Number(slotBlock.index)));
    shiftPromptBlockIndices(promptBlocks, insertIndex, 1);
    messagesArray.splice(insertIndex, 0, {
        role: 'system',
        content: renderContextForTemplateSlot(slotBlock, content),
    });
    slotBlock.index = insertIndex;
    slotBlock.role = 'system';
    slotBlock.source = source;
    delete slotBlock.slot;
    delete slotBlock.skipped;
    delete slotBlock.reason;
    return true;
}

function hasTemplatePromptBlocks(promptBlocks) {
    if (!Array.isArray(promptBlocks)) return false;
    return promptBlocks.some((block) => block && (block.source === 'template' || block.source === 'template-slot'));
}

function prependInjectedContext(messagesArray, promptBlocks, rulesContext, gameStateContext) {
    const injectedContext = [rulesContext, gameStateContext].filter(Boolean).join('\n\n');
    if (!injectedContext) {
        return;
    }

    if (messagesArray && Array.isArray(messagesArray) && messagesArray.length > 0) {
        const systemMsg = messagesArray.find((m) => m.role === 'system' || m.role === 'developer');
        if (systemMsg) {
            systemMsg.content = injectedContext + "\n\n" + systemMsg.content;
            if (Array.isArray(promptBlocks)) {
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
            return;
        }

        messagesArray.unshift({ role: 'system', content: injectedContext });
        if (Array.isArray(promptBlocks)) {
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
        return;
    }
}

function injectServerContexts(messagesArray, promptBlocks, rulesContext, gameStateContext) {
    const templateDriven = hasTemplatePromptBlocks(promptBlocks);
    let remainingRulesContext = rulesContext;
    let remainingGameStateContext = gameStateContext;

    if (Array.isArray(messagesArray) && Array.isArray(promptBlocks)) {
        if (remainingRulesContext && injectContextAtTemplateSlot(messagesArray, promptBlocks, 'rulebookRag', remainingRulesContext, 'server-rag')) {
            remainingRulesContext = '';
        }
        if (remainingGameStateContext && injectContextAtTemplateSlot(messagesArray, promptBlocks, 'gameState', remainingGameStateContext, 'server-gamestate')) {
            remainingGameStateContext = '';
        }
    }

    if (templateDriven) {
        if (remainingRulesContext) {
            promptBlocks.push({
                role: 'system',
                title: 'Rulebook RAG',
                source: 'server-rag',
                skipped: true,
                reason: 'no_template_slot',
            });
        }
        if (remainingGameStateContext) {
            promptBlocks.push({
                role: 'system',
                title: 'Game State',
                source: 'server-gamestate',
                skipped: true,
                reason: 'no_template_slot',
            });
        }
        return;
    }

    prependInjectedContext(messagesArray, promptBlocks, remainingRulesContext, remainingGameStateContext);
}

function getExecutionRequestPayload(input) {
    let current = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
    let depth = 0;
    while (
        current &&
        typeof current.request === 'object' &&
        current.request &&
        !Array.isArray(current.request) &&
        depth < 4
    ) {
        current = current.request;
        depth += 1;
    }
    return current && typeof current === 'object' && !Array.isArray(current) ? current : {};
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
        promptBlocks: Array.isArray(body.promptBlocks) ? body.promptBlocks : undefined,
        request: body,
    };
}

async function assembleServerPrompt(input, ctx) {
    const start = Date.now();
    if (input?.request?.internalNoAssembly === true || input?.request?.request?.internalNoAssembly === true) {
        return;
    }
    if (!input.characterId) return;

    const requestContainer = (input?.request && typeof input.request === 'object' && !Array.isArray(input.request))
        ? input.request
        : {};
    const requestPayload = getExecutionRequestPayload(requestContainer);
    const preloadedContext = (
        (requestContainer && typeof requestContainer.__serverContext === 'object' && requestContainer.__serverContext)
        || (requestPayload && typeof requestPayload.__serverContext === 'object' && requestPayload.__serverContext)
    );

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
    const charRag = (requestContainer.ragSettings && typeof requestContainer.ragSettings === 'object')
        ? requestContainer.ragSettings
        : (char.ragSettings || {});
    const globalRag = (requestContainer.globalRagSettings && typeof requestContainer.globalRagSettings === 'object')
        ? requestContainer.globalRagSettings
        : (settings.globalRagSettings || {});
    const effectiveRag = resolveEffectiveRagSettings(charRag, globalRag);
    const ragEnabled = effectiveRag.enabled;
    const enabledRulebooks = effectiveRag.enabledRulebooks;

    const DEBUG = process.env.RISU_DEBUG === '1';
    if (DEBUG) console.log(`[Server-Assembly] RAG Check: charRag.enabled=${charRag.enabled}, ragEnabled=${ragEnabled}`);
    if (DEBUG) console.log(`[Server-Assembly] Rulebooks: enabledRulebooks.length=${enabledRulebooks.length}`);

    if (ragEnabled && enabledRulebooks.length > 0) {
        // Find messages in either path
        const messages =
            requestPayload.requestBody?.messages
            || requestPayload.messages
            || requestContainer.requestBody?.messages
            || requestContainer.messages
            || [];

        const ragQuery = buildUserOnlyRagQuery(messages);

        if (DEBUG) console.log(`[Server-Assembly] Message Check: msgCount=${messages.length}, ragQuery length=${ragQuery.length}`);

        if (ragQuery) {
            const topK = effectiveRag.topK;
            const minScore = effectiveRag.minScore;
            const budget = effectiveRag.budget;
            const ragModel = effectiveRag.model;

            const rawResults = await searchRulebooks(
                ragQuery,
                enabledRulebooks,
                topK,
                minScore,
                ragModel,
                { ragRulebooks: path.join(ctx.dataRoot, 'rag', 'rulebooks') }
            );
            const results = applyRagBudget(rawResults, budget);

            if (results.length > 0) {
                rulesContext = "<Rules Context>\n";
                for (const res of results) {
                    rulesContext += buildRuleContextBlock(res);
                }
                rulesContext += "</Rules Context>\n";

                input._ragMeta = {
                    query: ragQuery.substring(0, 200),
                    resultCount: results.length,
                    trimmedByBudget: rawResults.length > results.length,
                    budget,
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
        if (Array.isArray(input?.promptBlocks)) {
            return input.promptBlocks;
        }
        if (requestPayload && typeof requestPayload === 'object' && !Array.isArray(requestPayload)) {
            if (!Array.isArray(requestPayload.promptBlocks)) {
                requestPayload.promptBlocks = [];
            }
            return requestPayload.promptBlocks;
        }
        return null;
    };

    // 3. Inject into messages
    if (rulesContext || gameStateContext) {
        // Find the messages array — client nests it as payload.request.requestBody.messages
        // After parseExecutionInput, input.request = payload, so messages are at input.request.request.requestBody.messages
        const messagesArray = requestPayload.requestBody?.messages
            || requestPayload.messages
            || requestContainer.requestBody?.messages
            || requestContainer.messages
            || null;
        const promptBlocks = ensurePromptBlocks();

        if (messagesArray && Array.isArray(messagesArray) && messagesArray.length > 0) {
            injectServerContexts(messagesArray, promptBlocks, rulesContext, gameStateContext);
        } else {
            const injectedContext = [rulesContext, gameStateContext].filter(Boolean).join('\n\n');
            // No messages found — create a system message in the most likely location
            const newMessages = [{ role: 'system', content: injectedContext }];
            if (requestPayload?.requestBody && typeof requestPayload.requestBody === 'object') {
                requestPayload.requestBody.messages = newMessages;
            } else if (requestPayload && typeof requestPayload === 'object') {
                requestPayload.messages = newMessages;
            } else if (requestContainer?.requestBody && typeof requestContainer.requestBody === 'object') {
                requestContainer.requestBody.messages = newMessages;
            } else if (requestContainer && typeof requestContainer === 'object') {
                requestContainer.messages = newMessages;
            }
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
    __test: {
        applyRagBudget,
        buildRuleContextBlock,
        buildUserOnlyRagQuery,
        formatRulebookCitation,
        trimResultToBudget,
        resolveEffectiveRagSettings,
        injectContextAtTemplateSlot,
        injectServerContexts,
    },
};
