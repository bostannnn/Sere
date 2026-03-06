const { LLMHttpError } = require('./errors.cjs');
const { loadServerSettings } = require('./settings_cache.cjs');

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

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

function parseResponseText(data) {
    const contents = Array.isArray(data?.content) ? data.content : [];
    let result = '';
    let inThinking = false;

    for (const content of contents) {
        if (content?.type === 'text') {
            if (inThinking) {
                result += '</Thoughts>\n\n';
                inThinking = false;
            }
            result += content.text || '';
        }
        if (content?.type === 'thinking') {
            if (!inThinking) {
                result += '<Thoughts>\n';
                inThinking = true;
            }
            result += content.thinking || '';
        }
        if (content?.type === 'redacted_thinking') {
            if (!inThinking) {
                result += '<Thoughts>\n';
                inThinking = true;
            }
            result += '\n{{redacted_thinking}}\n';
        }
    }

    if (inThinking) {
        result += '</Thoughts>\n\n';
    }
    return result;
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
        requestBody.model = 'claude-3-5-sonnet-latest';
    }
    if (!requestBody.max_tokens || !Number.isFinite(Number(requestBody.max_tokens))) {
        requestBody.max_tokens = 1024;
    }
    if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        throw new LLMHttpError(400, 'INVALID_MESSAGES', 'Anthropic request requires non-empty messages.');
    }

    requestBody.stream = !!input.streaming;

    const apiKey = typeof settings?.claudeAPIKey === 'string' ? settings.claudeAPIKey.trim() : '';
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'ANTHROPIC_KEY_MISSING', 'Anthropic key is not configured on server settings.');
    }

    const headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || '[MISSING]',
        'anthropic-version': '2023-06-01',
        accept: 'application/json',
    };

    const betas = [];
    if (Number(requestBody.max_tokens) > 8192) {
        betas.push('output-128k-2025-02-19');
    }
    if (betas.length > 0) {
        headers['anthropic-beta'] = betas.join(',');
    }

    return {
        url: ANTHROPIC_MESSAGES_URL,
        headers,
        body: requestBody,
    };
}

function sanitizeHeaders(headers) {
    return {
        ...headers,
        'x-api-key': '[REDACTED]',
    };
}

async function previewAnthropicExecution(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
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

async function executeAnthropic(input, ctx = {}) {
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
            'UPSTREAM_ANTHROPIC_ERROR',
            'Anthropic request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Anthropic returned non-JSON response.');
    }

    return {
        type: 'success',
        result: parseResponseText(parsed),
        model: built.body.model,
    };
}

module.exports = {
    previewAnthropicExecution,
    executeAnthropic,
};
