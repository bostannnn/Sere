const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

function safeClone(value) {
    if (value === null || value === undefined) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return value;
    }
}

async function loadSettings(dataRoot) {
    const settingsPath = path.join(dataRoot, 'settings.json');
    if (!existsSync(settingsPath)) {
        throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
    }
    const raw = await fs.readFile(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
        return parsed.data;
    }
    return parsed;
}

function getRequestPayload(input) {
    const request = input?.request;
    if (request && typeof request === 'object' && request.request && typeof request.request === 'object') {
        return request.request;
    }
    return request && typeof request === 'object' ? request : {};
}

function resolveOobaCompletionsUrl(rawUrl) {
    const source = typeof rawUrl === 'string' ? rawUrl.trim() : '';
    if (!source) {
        throw new LLMHttpError(400, 'OOBA_URL_MISSING', 'Ooba URL is not configured.');
    }
    let parsed = null;
    try {
        parsed = new URL(source);
    } catch {
        throw new LLMHttpError(400, 'OOBA_URL_INVALID', `Invalid Ooba URL: ${source}`);
    }
    parsed.pathname = '/v1/completions';
    return parsed.toString();
}

function buildExecutionRequest(input, settings) {
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (typeof requestBody.prompt !== 'string' || !requestBody.prompt.trim()) {
        throw new LLMHttpError(400, 'INVALID_PROMPT', 'Ooba request requires a non-empty prompt.');
    }
    if (input.streaming) {
        throw new LLMHttpError(400, 'STREAMING_NOT_SUPPORTED', 'Ooba server migration path does not support streaming yet.');
    }

    const rawUrl = (typeof requestBody.ooba_url === 'string' && requestBody.ooba_url.trim())
        ? requestBody.ooba_url.trim()
        : (typeof settings?.textgenWebUIBlockingURL === 'string' ? settings.textgenWebUIBlockingURL.trim() : '');
    const url = resolveOobaCompletionsUrl(rawUrl);
    delete requestBody.ooba_url;

    const headers = {
        'Content-Type': 'application/json',
    };
    const apiKey = typeof settings?.mancerHeader === 'string' ? settings.mancerHeader.trim() : '';
    if (apiKey) {
        headers['X-API-KEY'] = apiKey;
    }

    return {
        url,
        headers,
        body: requestBody,
    };
}

function sanitizeHeaders(headers) {
    const next = { ...headers };
    if (next['X-API-KEY']) {
        next['X-API-KEY'] = '[REDACTED]';
    }
    return next;
}

async function previewOobaExecution(input, ctx = {}) {
    const settings = await loadSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings);
    return {
        url: built.url,
        body: built.body,
        headers: sanitizeHeaders(built.headers),
        warnings: [
            'Phase B1: prompt assembly is still client-side; upstream execution and auth are server-side.',
        ],
    };
}

async function executeOoba(input, ctx = {}) {
    const settings = await loadSettings(ctx.dataRoot);
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
            'UPSTREAM_OOBA_ERROR',
            'Ooba request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Ooba returned non-JSON response.');
    }

    const result = parsed?.choices?.[0]?.text;
    if (typeof result !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Ooba response did not contain text.');
    }

    return {
        type: 'success',
        result: result.replace(/##\n/g, ''),
    };
}

module.exports = {
    previewOobaExecution,
    executeOoba,
};
