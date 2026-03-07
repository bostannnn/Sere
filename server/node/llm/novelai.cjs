const { LLMHttpError } = require('./errors.cjs');
const { loadServerSettings } = require('./settings_cache.cjs');

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

function resolveNovelAIUrl(model) {
    if (model === 'kayra-v1') {
        return 'https://text.novelai.net/ai/generate';
    }
    return 'https://api.novelai.net/ai/generate';
}

function normalizeNovelAIModelName(model) {
    const raw = typeof model === 'string' ? model.trim() : '';
    if (!raw) return 'clio-v1';
    const normalized = raw.toLowerCase();
    if (normalized === 'novelai_kayra' || normalized === 'kayra' || normalized === 'kayra-v1') {
        return 'kayra-v1';
    }
    if (normalized === 'novelai' || normalized === 'novelai_clio' || normalized === 'clio' || normalized === 'clio-v1') {
        return 'clio-v1';
    }
    return raw;
}

function buildExecutionRequest(input, settings, arg = {}) {
    const requireKey = arg.requireKey !== false;
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (typeof requestBody.input !== 'string' || !requestBody.input.trim()) {
        throw new LLMHttpError(400, 'INVALID_PROMPT', 'NovelAI request requires a non-empty input.');
    }
    requestBody.model = normalizeNovelAIModelName(requestBody.model);
    if (!requestBody.parameters || typeof requestBody.parameters !== 'object') {
        throw new LLMHttpError(400, 'INVALID_BODY', 'NovelAI request requires parameters object.');
    }
    if (input.streaming) {
        throw new LLMHttpError(400, 'STREAMING_NOT_SUPPORTED', 'NovelAI server migration path does not support streaming yet.');
    }

    const apiKey = typeof settings?.novelai?.token === 'string' ? settings.novelai.token.trim() : '';
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'NOVELAI_KEY_MISSING', 'NovelAI key is not configured on server settings.');
    }

    return {
        url: resolveNovelAIUrl(requestBody.model),
        headers: {
            Authorization: `Bearer ${apiKey || '[MISSING]'}`,
            'Content-Type': 'application/json',
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

async function previewNovelAIExecution(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings, { requireKey: false });
    return {
        url: built.url,
        body: built.body,
        headers: sanitizeHeaders(built.headers),
    };
}

async function executeNovelAI(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings);

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
            'UPSTREAM_NOVELAI_ERROR',
            'NovelAI request failed.',
            {
                status: upstream.status,
                statusText: upstream.statusText,
                body: parsed || responseText,
            }
        );
    }

    const responseText = await upstream.text();
    let parsed = null;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        parsed = null;
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'NovelAI returned non-JSON response.');
    }

    if (typeof parsed.output !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'NovelAI response did not contain output.');
    }

    return {
        type: 'success',
        result: parsed.output,
        model: built.body.model,
    };
}

module.exports = {
    previewNovelAIExecution,
    executeNovelAI,
};
