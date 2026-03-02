const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

const COHERE_CHAT_URL = 'https://api.cohere.com/v1/chat';

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

function buildExecutionRequest(input, settings, arg = {}) {
    const requireKey = arg.requireKey !== false;
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (!requestBody.message && typeof payload.prompt === 'string' && payload.prompt.trim()) {
        requestBody.message = payload.prompt.trim();
    }
    if (typeof requestBody.message !== 'string' || !requestBody.message.trim()) {
        throw new LLMHttpError(400, 'INVALID_PROMPT', 'Cohere request requires a non-empty message.');
    }

    if (input.streaming) {
        throw new LLMHttpError(400, 'STREAMING_NOT_SUPPORTED', 'Cohere server migration path does not support streaming yet.');
    }

    const apiKey = typeof settings?.cohereAPIKey === 'string' ? settings.cohereAPIKey.trim() : '';
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'COHERE_KEY_MISSING', 'Cohere key is not configured on server settings.');
    }

    return {
        url: COHERE_CHAT_URL,
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

async function previewCohereExecution(input, ctx = {}) {
    const settings = await loadSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings, { requireKey: false });
    return {
        url: built.url,
        body: built.body,
        headers: sanitizeHeaders(built.headers),
        warnings: [
            'Phase B1: prompt assembly is still client-side; upstream execution and auth are server-side.',
        ],
    };
}

async function executeCohere(input, ctx = {}) {
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
            'UPSTREAM_COHERE_ERROR',
            'Cohere request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Cohere returned non-JSON response.');
    }

    const result = typeof parsed.text === 'string' ? parsed.text : '';
    if (!result) {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Cohere response did not contain text.');
    }

    return {
        type: 'success',
        result,
    };
}

module.exports = {
    previewCohereExecution,
    executeCohere,
};
