const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

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

function parseResponseText(data) {
    const candidates = Array.isArray(data?.candidates) ? data.candidates : [];
    let content = '';
    for (const candidate of candidates) {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        for (const part of parts) {
            if (!part || typeof part !== 'object') continue;
            if (typeof part.text !== 'string' || !part.text) continue;
            if (part.thought === true) continue;
            content += (content ? '\n\n' : '') + part.text;
        }
    }
    return content;
}

function buildExecutionRequest(input, settings, arg = {}) {
    const requireKey = arg.requireKey !== false;
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    const modelFromPayload =
        (typeof payload.model === 'string' && payload.model.trim()) ||
        (typeof requestBody.model === 'string' && requestBody.model.trim()) ||
        'gemini-2.0-flash';

    delete requestBody.model;

    const endpoint = input.streaming ? 'streamGenerateContent' : 'generateContent';
    const url = new URL(`${GOOGLE_BASE_URL}/${modelFromPayload}:${endpoint}`);
    if (input.streaming) {
        url.searchParams.set('alt', 'sse');
    }

    if (!requestBody.contents || !Array.isArray(requestBody.contents) || requestBody.contents.length === 0) {
        throw new LLMHttpError(400, 'INVALID_MESSAGES', 'Google request requires non-empty contents.');
    }

    const apiKey = (
        typeof settings?.google?.accessToken === 'string' ? settings.google.accessToken.trim() :
        (typeof settings?.googleCloudKey === 'string' ? settings.googleCloudKey.trim() : '')
    );
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'GOOGLE_KEY_MISSING', 'Google key is not configured on server settings.');
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey || '[MISSING]',
    };

    return {
        url: url.toString(),
        headers,
        body: requestBody,
        model: modelFromPayload,
    };
}

function sanitizeHeaders(headers) {
    return {
        ...headers,
        'x-goog-api-key': '[REDACTED]',
    };
}

async function previewGoogleExecution(input, ctx = {}) {
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

async function executeGoogle(input, ctx = {}) {
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
            'UPSTREAM_GOOGLE_ERROR',
            'Google request failed.',
            {
                status: upstream.status,
                statusText: upstream.statusText,
                body: parsed || responseText,
            }
        );
    }

    if (input.streaming) {
        return upstream.body;
    }

    const responseText = await upstream.text();
    let parsed = null;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        parsed = null;
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Google returned non-JSON response.');
    }

    return {
        type: 'success',
        result: parseResponseText(parsed),
        model: built.model,
    };
}

module.exports = {
    previewGoogleExecution,
    executeGoogle,
};
