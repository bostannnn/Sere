const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');
const { loadServerSettings } = require('./settings_cache.cjs');

const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const OPENROUTER_MODELS_CACHE_FILE = path.join('logs', 'openrouter-models-cache.json');
const OPENROUTER_MODELS_TIMEOUT_MS = 12000;
const OPENROUTER_MODELS_MEMORY_TTL_MS = 60 * 1000;
const DEEPSEEK_V32_SPECIALE_MODEL_ID = 'deepseek/deepseek-v3.2-speciale';
const openRouterModelsMemoryCache = new Map();

function safeClone(value) {
    if (value === null || value === undefined) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

function getRequestPayload(input) {
    const request = input?.request;
    if (request && typeof request === 'object' && request.request && typeof request.request === 'object') {
        return request.request;
    }
    return request && typeof request === 'object' ? request : {};
}

function getProviderConfig(settings) {
    const source = settings?.openrouterProvider;
    if (!source || typeof source !== 'object') return null;
    const provider = {};
    if (Array.isArray(source.order) && source.order.length > 0) provider.order = source.order;
    if (Array.isArray(source.only) && source.only.length > 0) provider.only = source.only;
    if (Array.isArray(source.ignore) && source.ignore.length > 0) provider.ignore = source.ignore;
    return Object.keys(provider).length > 0 ? provider : null;
}

function isDeepSeekV32SpecialeModel(model) {
    return typeof model === 'string' && model.trim().toLowerCase() === DEEPSEEK_V32_SPECIALE_MODEL_ID;
}

function appendWithOverlapDedup(base, incoming) {
    const current = typeof base === 'string' ? base : '';
    const next = typeof incoming === 'string' ? incoming : '';
    if (!next) return current;
    if (!current) return next;
    if (current.endsWith(next)) return current;
    const maxOverlap = Math.min(current.length, next.length);
    for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
        if (current.slice(-overlap) === next.slice(0, overlap)) {
            return current + next.slice(overlap);
        }
    }
    return current + next;
}

function extractReasoningChunksFromDetails(details) {
    if (!Array.isArray(details)) return '';
    let combined = '';
    for (const detail of details) {
        if (typeof detail === 'string') {
            combined = appendWithOverlapDedup(combined, detail);
            continue;
        }
        if (!detail || typeof detail !== 'object') continue;
        if (typeof detail.text === 'string') {
            combined = appendWithOverlapDedup(combined, detail.text);
        } else if (Array.isArray(detail.text)) {
            for (const textPart of detail.text) {
                if (typeof textPart === 'string') {
                    combined = appendWithOverlapDedup(combined, textPart);
                } else if (textPart && typeof textPart === 'object' && typeof textPart.text === 'string') {
                    combined = appendWithOverlapDedup(combined, textPart.text);
                }
            }
        }
        if (typeof detail.reasoning === 'string') {
            combined = appendWithOverlapDedup(combined, detail.reasoning);
        }
        if (typeof detail.content === 'string') {
            combined = appendWithOverlapDedup(combined, detail.content);
        } else if (Array.isArray(detail.content)) {
            for (const contentPart of detail.content) {
                if (typeof contentPart === 'string') {
                    combined = appendWithOverlapDedup(combined, contentPart);
                } else if (contentPart && typeof contentPart === 'object' && typeof contentPart.text === 'string') {
                    combined = appendWithOverlapDedup(combined, contentPart.text);
                }
            }
        }
    }
    return combined;
}

function parseResponseText(data, opts = {}) {
    const text = data?.choices?.[0]?.text;
    if (typeof text === 'string') {
        return text;
    }

    const choice = data?.choices?.[0];
    const message = choice?.message;
    const content = typeof message?.content === 'string' ? message.content : '';
    let reasoning = '';
    reasoning = appendWithOverlapDedup(reasoning, choice?.reasoning_content);
    reasoning = appendWithOverlapDedup(reasoning, message?.reasoning_content);
    reasoning = appendWithOverlapDedup(reasoning, message?.reasoning);
    reasoning = appendWithOverlapDedup(reasoning, extractReasoningChunksFromDetails(choice?.reasoning_details));
    reasoning = appendWithOverlapDedup(reasoning, extractReasoningChunksFromDetails(message?.reasoning_details));

    if (opts.treatReasoningAsContent === true) {
        const merged = appendWithOverlapDedup(reasoning, content);
        return merged || content;
    }

    if (typeof reasoning === 'string' && reasoning.trim()) {
        return `<Thoughts>\n${reasoning}\n</Thoughts>\n${content}`;
    }
    return content;
}

function parseModelPrice(model) {
    const promptCost = Number(model?.pricing?.prompt);
    const completionCost = Number(model?.pricing?.completion);
    const candidate = ((promptCost * 3) + completionCost) / 4;
    if (!Number.isFinite(candidate) || candidate < 0) {
        return 0;
    }
    return candidate;
}

function mapOpenRouterModels(data) {
    if (!Array.isArray(data?.data)) {
        return [];
    }

    return data.data
        .filter((model) => model && typeof model.id === 'string' && model.id.trim())
        .map((model) => {
            const price = parseModelPrice(model);
            const modelId = model.id.trim();
            const baseName = typeof model.name === 'string' && model.name.trim() ? model.name.trim() : modelId;
            const displayName =
                price > 0 ? `${baseName} - $${(price * 1000).toFixed(5)}/1k` : `${baseName} - Free`;

            return {
                id: modelId,
                name: displayName,
                price,
                context_length: Number.isFinite(Number(model.context_length)) ? Number(model.context_length) : 0,
            };
        })
        .sort((a, b) => {
            if (a.price !== b.price) {
                return a.price - b.price;
            }
            return a.name.localeCompare(b.name);
        });
}

function getModelsCachePath(dataRoot) {
    if (!dataRoot) {
        return '';
    }
    return path.join(dataRoot, OPENROUTER_MODELS_CACHE_FILE);
}

function getMemoryCacheKey(dataRoot) {
    return dataRoot || '__default__';
}

function getFreshMemoryModels(dataRoot) {
    const key = getMemoryCacheKey(dataRoot);
    const cached = openRouterModelsMemoryCache.get(key);
    if (!cached) {
        return null;
    }
    if ((Date.now() - cached.cachedAtMs) > OPENROUTER_MODELS_MEMORY_TTL_MS) {
        openRouterModelsMemoryCache.delete(key);
        return null;
    }
    return cached;
}

function setMemoryModelsCache(dataRoot, entry) {
    const key = getMemoryCacheKey(dataRoot);
    openRouterModelsMemoryCache.set(key, {
        ...entry,
        cachedAtMs: Date.now(),
    });
}

async function writeModelsCache(dataRoot, payload) {
    const cachePath = getModelsCachePath(dataRoot);
    if (!cachePath) {
        return;
    }
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8');
}

async function readModelsCache(dataRoot) {
    const cachePath = getModelsCachePath(dataRoot);
    if (!cachePath || !existsSync(cachePath)) {
        return null;
    }
    const raw = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.models)) {
        return null;
    }
    return {
        models: parsed.models,
        updatedAt: typeof parsed.updatedAt === 'string' && parsed.updatedAt ? parsed.updatedAt : null,
    };
}

async function parseResponseBody(response) {
    const text = await response.text();
    if (!text) {
        return null;
    }
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

function toModelsErrorSummary(error) {
    if (error instanceof LLMHttpError) {
        return {
            code: error.code,
            status: error.status,
            message: error.message,
        };
    }
    return {
        code: 'OPENROUTER_MODELS_FETCH_FAILED',
        message: String(error?.message || error || 'OpenRouter models request failed.'),
    };
}

async function fetchOpenRouterModelsUpstream(apiKey) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OPENROUTER_MODELS_TIMEOUT_MS);
    try {
        const upstream = await fetch(OPENROUTER_MODELS_URL, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
        });

        const body = await parseResponseBody(upstream);
        if (!upstream.ok) {
            throw new LLMHttpError(
                upstream.status,
                'OPENROUTER_MODELS_UPSTREAM_ERROR',
                'OpenRouter models request failed.',
                {
                    status: upstream.status,
                    statusText: upstream.statusText,
                    body,
                }
            );
        }

        return mapOpenRouterModels(body);
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new LLMHttpError(504, 'OPENROUTER_MODELS_TIMEOUT', 'OpenRouter models request timed out.');
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

async function listOpenRouterModels(ctx = {}) {
    const forceRefresh = !!ctx.forceRefresh;
    if (!forceRefresh) {
        const memory = getFreshMemoryModels(ctx.dataRoot);
        if (memory) {
            return {
                models: memory.models,
                stale: !!memory.stale,
                source: memory.source || 'memory',
                updatedAt: memory.updatedAt || null,
                error: memory.error || null,
            };
        }
    }

    const settings = await loadServerSettings(ctx.dataRoot);
    const apiKey = typeof settings?.openrouterKey === 'string' ? settings.openrouterKey.trim() : '';
    if (!apiKey) {
        const cached = await readModelsCache(ctx.dataRoot);
        if (cached && Array.isArray(cached.models) && cached.models.length > 0) {
            const stalePayload = {
                models: cached.models,
                stale: true,
                source: 'cache',
                updatedAt: cached.updatedAt || null,
                error: {
                    code: 'OPENROUTER_KEY_MISSING',
                    status: 400,
                    message: 'OpenRouter key is not configured on server settings.',
                },
            };
            setMemoryModelsCache(ctx.dataRoot, stalePayload);
            return stalePayload;
        }
        throw new LLMHttpError(400, 'OPENROUTER_KEY_MISSING', 'OpenRouter key is not configured on server settings.');
    }

    try {
        const models = await fetchOpenRouterModelsUpstream(apiKey);
        const updatedAt = new Date().toISOString();
        const payload = {
            models,
            stale: false,
            source: 'upstream',
            updatedAt,
            error: null,
        };
        setMemoryModelsCache(ctx.dataRoot, payload);
        try {
            await writeModelsCache(ctx.dataRoot, payload);
        } catch (cacheWriteError) {
            console.warn('[OpenRouter] Failed to write models cache file:', cacheWriteError);
        }
        return payload;
    } catch (error) {
        const cached = await readModelsCache(ctx.dataRoot);
        if (cached && Array.isArray(cached.models) && cached.models.length > 0) {
            const stalePayload = {
                models: cached.models,
                stale: true,
                source: 'cache',
                updatedAt: cached.updatedAt || null,
                error: toModelsErrorSummary(error),
            };
            setMemoryModelsCache(ctx.dataRoot, stalePayload);
            return stalePayload;
        }
        if (error instanceof LLMHttpError) {
            throw error;
        }
        throw new LLMHttpError(
            502,
            'OPENROUTER_MODELS_FETCH_FAILED',
            'Failed to fetch OpenRouter models.',
            { reason: String(error?.message || error || 'Unknown error') }
        );
    }
}

function buildExecutionRequest(input, settings, arg = {}) {
    const requireKey = arg.requireKey !== false;
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (!requestBody.messages && Array.isArray(payload.messages)) {
        requestBody.messages = safeClone(payload.messages);
    }
    if (!requestBody.prompt && typeof payload.prompt === 'string') {
        requestBody.prompt = payload.prompt;
    }
    if (!requestBody.tools && Array.isArray(payload.tools) && payload.tools.length > 0) {
        requestBody.tools = safeClone(payload.tools);
    }
    if (!requestBody.max_tokens && Number.isFinite(Number(payload.maxTokens))) {
        requestBody.max_tokens = Number(payload.maxTokens);
    }

    const modelFromPayload = typeof payload.model === 'string' && payload.model.trim()
        ? payload.model.trim()
        : '';
    const modelFromSettings = input.mode === 'model'
        ? settings?.openrouterRequestModel
        : (settings?.openrouterSubRequestModel || settings?.openrouterRequestModel);
    const normalizedSettingsModel = typeof modelFromSettings === 'string' && modelFromSettings.trim()
        ? modelFromSettings.trim()
        : '';

    // Preserve the explicit model chosen by request payload when present.
    // This prevents server settings from overriding client-resolved models.
    if (!requestBody.model && modelFromPayload) {
        requestBody.model = modelFromPayload;
    } else if (!requestBody.model && normalizedSettingsModel) {
        requestBody.model = normalizedSettingsModel;
    }

    // `risu/free` is a local alias and invalid for upstream OpenRouter calls.
    if (requestBody.model === 'risu/free') {
        requestBody.model =
            normalizedSettingsModel && normalizedSettingsModel !== 'risu/free'
                ? normalizedSettingsModel
                : 'openrouter/auto';
    }

    if (!requestBody.model) {
        requestBody.model = 'openai/gpt-3.5-turbo';
    }

    if (settings?.openrouterFallback) {
        requestBody.route = 'fallback';
    } else {
        delete requestBody.route;
    }
    requestBody.transforms = settings?.openrouterMiddleOut ? ['middle-out'] : [];

    const provider = getProviderConfig(settings);
    if (provider) {
        requestBody.provider = provider;
    } else {
        delete requestBody.provider;
    }

    const useInstructPrompt = !!settings?.useInstructPrompt;
    if (useInstructPrompt) {
        if (typeof requestBody.prompt !== 'string' || !requestBody.prompt.trim()) {
            throw new LLMHttpError(
                400,
                'INVALID_PROMPT',
                'Instruct prompt is enabled, but no prompt payload was provided.'
            );
        }
        delete requestBody.messages;
    } else if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        throw new LLMHttpError(
            400,
            'INVALID_MESSAGES',
            'OpenRouter request requires non-empty messages.'
        );
    }

    requestBody.stream = !!input.streaming;

    const apiKey = typeof settings?.openrouterKey === 'string' ? settings.openrouterKey.trim() : '';
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'OPENROUTER_KEY_MISSING', 'OpenRouter key is not configured on server settings.');
    }

    return {
        url: OPENROUTER_CHAT_URL,
        headers: {
            Authorization: `Bearer ${apiKey || '[MISSING]'}`,
            'Content-Type': 'application/json',
            'X-Title': 'RisuAI',
            'HTTP-Referer': 'https://risuai.xyz',
        },
        body: requestBody,
    };
}

function sanitizeHeaders(headers) {
    return {
        ...headers,
        Authorization: 'Bearer [REDACTED]',
    };
}

async function previewOpenRouterExecution(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings, { requireKey: false });
    return {
        url: built.url,
        body: built.body,
        headers: sanitizeHeaders(built.headers),
    };
}

async function executeOpenRouter(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings);
    const allowReasoningOnlyForDeepSeekV32Speciale = input?.request?.allowReasoningOnlyForDeepSeekV32Speciale === true;
    const treatReasoningAsContent = allowReasoningOnlyForDeepSeekV32Speciale && isDeepSeekV32SpecialeModel(built?.body?.model);

    const upstream = await fetch(built.url, {
        method: 'POST',
        headers: built.headers,
        body: JSON.stringify(built.body),
    });

    if (!upstream.ok) {
        const responseText = await upstream.text();
        let parsed = null;
        try { parsed = JSON.parse(responseText); } catch {}
        throw new LLMHttpError(
            upstream.status,
            'UPSTREAM_OPENROUTER_ERROR',
            'OpenRouter request failed.',
            {
                status: upstream.status,
                statusText: upstream.statusText,
                body: parsed || responseText,
            }
        );
    }

    if (input.streaming) {
        return upstream.body; // Return the stream directly to the caller
    }

    const responseText = await upstream.text();
    let parsed = null;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        parsed = null;
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'OpenRouter returned non-JSON response.');
    }

    const result = parseResponseText(parsed, { treatReasoningAsContent });
    if (typeof result !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'OpenRouter response did not contain text content.');
    }

    return {
        type: 'success',
        result,
        model: built.body.model,
    };
}

module.exports = {
    previewOpenRouterExecution,
    executeOpenRouter,
    listOpenRouterModels,
};
