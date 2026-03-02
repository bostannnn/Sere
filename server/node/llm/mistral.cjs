const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions';

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
    const text = data?.choices?.[0]?.text;
    if (typeof text === 'string') {
        return text;
    }

    const message = data?.choices?.[0]?.message;
    if (typeof message?.content === 'string') {
        return message.content;
    }
    if (Array.isArray(message?.content)) {
        return message.content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    return '';
}

function buildExecutionRequest(input, settings, arg = {}) {
    const requireKey = arg.requireKey !== false;
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (!requestBody.messages && Array.isArray(payload.messages)) {
        requestBody.messages = safeClone(payload.messages);
    }
    if (!requestBody.max_tokens && Number.isFinite(Number(payload.maxTokens))) {
        requestBody.max_tokens = Number(payload.maxTokens);
    }
    if (!requestBody.model && typeof payload.model === 'string' && payload.model.trim()) {
        requestBody.model = payload.model.trim();
    }
    if (!requestBody.model) {
        requestBody.model = 'mistral-small-latest';
    }

    if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        throw new LLMHttpError(
            400,
            'INVALID_MESSAGES',
            'Mistral request requires non-empty messages.'
        );
    }

    requestBody.stream = !!input.streaming;

    const apiKey = typeof settings?.mistralKey === 'string' ? settings.mistralKey.trim() : '';
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'MISTRAL_KEY_MISSING', 'Mistral key is not configured on server settings.');
    }

    return {
        url: MISTRAL_CHAT_URL,
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

async function previewMistralExecution(input, ctx = {}) {
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

async function executeMistral(input, ctx = {}) {
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
            'UPSTREAM_MISTRAL_ERROR',
            'Mistral request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Mistral returned non-JSON response.');
    }

    const result = parseResponseText(parsed);
    if (typeof result !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Mistral response did not contain text content.');
    }

    return {
        type: 'success',
        result,
        model: built.body.model,
    };
}

module.exports = {
    previewMistralExecution,
    executeMistral,
};
