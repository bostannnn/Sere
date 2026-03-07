const { LLMHttpError } = require('./errors.cjs');
const { loadServerSettings } = require('./settings_cache.cjs');

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/beta/chat/completions';

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
    const text = data?.choices?.[0]?.text;
    if (typeof text === 'string') {
        return text;
    }

    const message = data?.choices?.[0]?.message;
    let content = '';
    if (typeof message?.content === 'string') {
        content = message.content;
    } else if (Array.isArray(message?.content)) {
        content = message.content
            .map((part) => {
                if (typeof part === 'string') return part;
                if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
                return '';
            })
            .filter(Boolean)
            .join('\n');
    }

    const reasoning =
        data?.choices?.[0]?.reasoning_content ||
        data?.choices?.[0]?.message?.reasoning_content ||
        data?.choices?.[0]?.message?.reasoning;

    if (typeof reasoning === 'string' && reasoning.trim()) {
        return `<Thoughts>\n${reasoning}\n</Thoughts>\n${content}`;
    }
    return content;
}

function buildExecutionRequest(input, settings, arg = {}) {
    const requireKey = arg.requireKey !== false;
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (!requestBody.messages && Array.isArray(payload.messages)) {
        requestBody.messages = safeClone(payload.messages);
    }
    if (!requestBody.tools && Array.isArray(payload.tools) && payload.tools.length > 0) {
        requestBody.tools = safeClone(payload.tools);
    }
    if (!requestBody.max_tokens && Number.isFinite(Number(payload.maxTokens))) {
        requestBody.max_tokens = Number(payload.maxTokens);
    }
    if (!requestBody.model && typeof payload.model === 'string' && payload.model.trim()) {
        requestBody.model = payload.model.trim();
    }
    if (!requestBody.model) {
        requestBody.model = 'deepseek-chat';
    }

    if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        throw new LLMHttpError(
            400,
            'INVALID_MESSAGES',
            'DeepSeek request requires non-empty messages.'
        );
    }

    requestBody.stream = !!input.streaming;

    const apiKey = typeof settings?.OaiCompAPIKeys?.deepseek === 'string'
        ? settings.OaiCompAPIKeys.deepseek.trim()
        : '';
    if (!apiKey && requireKey) {
        throw new LLMHttpError(400, 'DEEPSEEK_KEY_MISSING', 'DeepSeek key is not configured on server settings.');
    }

    return {
        url: DEEPSEEK_CHAT_URL,
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

async function previewDeepSeekExecution(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings, { requireKey: false });
    return {
        url: built.url,
        body: built.body,
        headers: sanitizeHeaders(built.headers),
    };
}

async function executeDeepSeek(input, ctx = {}) {
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
            'UPSTREAM_DEEPSEEK_ERROR',
            'DeepSeek request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'DeepSeek returned non-JSON response.');
    }

    const result = parseResponseText(parsed);
    if (typeof result !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'DeepSeek response did not contain text content.');
    }

    return {
        type: 'success',
        result,
        model: built.body.model,
    };
}

module.exports = {
    previewDeepSeekExecution,
    executeDeepSeek,
};
