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

function resolveKoboldGenerateUrl(rawUrl) {
    const source = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!source) {
        throw new LLMHttpError(400, 'KOBOLD_URL_MISSING', 'Kobold URL is not configured.');
    }
    let parsed = null;
    try {
        parsed = new URL(source);
    } catch {
        throw new LLMHttpError(400, 'KOBOLD_URL_INVALID', `Invalid Kobold URL: ${source}`);
    }

    const pathname = parsed.pathname || '/';
    if (
        pathname === '/' ||
        pathname.length < 3 ||
        pathname === '/api/v1' ||
        pathname === '/api/v1/'
    ) {
        parsed.pathname = '/api/v1/generate';
    }
    return parsed.toString();
}

function buildExecutionRequest(input, settings) {
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (typeof requestBody.prompt !== 'string' || !requestBody.prompt.trim()) {
        throw new LLMHttpError(400, 'INVALID_PROMPT', 'Kobold request requires a non-empty prompt.');
    }
    if (input.streaming) {
        throw new LLMHttpError(400, 'STREAMING_NOT_SUPPORTED', 'Kobold server migration path does not support streaming yet.');
    }

    const koboldUrl = (
        (typeof requestBody.kobold_url === 'string' && requestBody.kobold_url.trim())
            ? requestBody.kobold_url.trim()
            : (typeof settings?.koboldURL === 'string' ? settings.koboldURL.trim() : '')
    );
    const url = resolveKoboldGenerateUrl(koboldUrl);
    delete requestBody.kobold_url;

    return {
        url,
        headers: {
            'Content-Type': 'application/json',
        },
        body: requestBody,
    };
}

async function previewKoboldExecution(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings);
    return {
        url: built.url,
        body: built.body,
        headers: built.headers,
        warnings: [
            'Phase B1: prompt assembly is still client-side; upstream execution and auth are server-side.',
        ],
    };
}

async function executeKobold(input, ctx = {}) {
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
            'UPSTREAM_KOBOLD_ERROR',
            'Kobold request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Kobold returned non-JSON response.');
    }

    const result = parsed?.results?.[0]?.text;
    if (typeof result !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Kobold response did not contain text.');
    }

    return {
        type: 'success',
        result,
    };
}

module.exports = {
    previewKoboldExecution,
    executeKobold,
};
