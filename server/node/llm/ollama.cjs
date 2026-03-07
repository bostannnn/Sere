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

function resolveOllamaChatUrl(rawUrl) {
    const source = (typeof rawUrl === 'string' ? rawUrl.trim() : '') || 'http://localhost:11434';
    let parsed = null;
    try {
        parsed = new URL(source);
    } catch {
        throw new LLMHttpError(400, 'OLLAMA_URL_INVALID', `Invalid Ollama URL: ${source}`);
    }

    if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname.trim() === '') {
        parsed.pathname = '/api/chat';
        return parsed.toString();
    }
    if (parsed.pathname.endsWith('/api')) {
        parsed.pathname = `${parsed.pathname}/chat`;
        return parsed.toString();
    }
    if (!parsed.pathname.endsWith('/api/chat')) {
        parsed.pathname = '/api/chat';
    }
    return parsed.toString();
}

function buildExecutionRequest(input, settings) {
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (!requestBody.messages && Array.isArray(payload.messages)) {
        requestBody.messages = safeClone(payload.messages);
    }

    if (!requestBody.model && typeof payload.model === 'string' && payload.model.trim()) {
        requestBody.model = payload.model.trim();
    }
    if (!requestBody.model && typeof settings?.ollamaModel === 'string' && settings.ollamaModel.trim()) {
        requestBody.model = settings.ollamaModel.trim();
    }
    if (!requestBody.model) {
        throw new LLMHttpError(400, 'OLLAMA_MODEL_MISSING', 'Ollama model is not configured.');
    }

    if (!Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
        throw new LLMHttpError(400, 'INVALID_MESSAGES', 'Ollama request requires non-empty messages.');
    }

    const ollamaBaseUrl = (
        (typeof requestBody.ollama_url === 'string' && requestBody.ollama_url.trim()) ?
            requestBody.ollama_url.trim() :
            (typeof settings?.ollamaURL === 'string' && settings.ollamaURL.trim() ? settings.ollamaURL.trim() : '')
    );
    const url = resolveOllamaChatUrl(ollamaBaseUrl);
    delete requestBody.ollama_url;

    requestBody.stream = !!input.streaming;

    return {
        url,
        headers: {
            'Content-Type': 'application/json',
        },
        body: requestBody,
    };
}

async function previewOllamaExecution(input, ctx = {}) {
    const settings = await loadServerSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings);
    return {
        url: built.url,
        body: built.body,
        headers: built.headers,
    };
}

function buildOpenAIDataLine(text) {
    return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
}

async function executeOllama(input, ctx = {}) {
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
            'UPSTREAM_OLLAMA_ERROR',
            'Ollama request failed.',
            {
                status: upstream.status,
                statusText: upstream.statusText,
                body: parsed || responseText,
            }
        );
    }

    if (input.streaming) {
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const reader = upstream.body?.getReader();
        if (!reader) {
            throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Ollama returned an empty stream.');
        }

        let buffer = '';
        const stream = new ReadableStream({
            async pull(controller) {
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                    return;
                }
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const chunk = JSON.parse(trimmed);
                        const text = chunk?.message?.content;
                        if (typeof text === 'string' && text.length > 0) {
                            controller.enqueue(encoder.encode(buildOpenAIDataLine(text)));
                        }
                    } catch {
                        // Ignore malformed line and continue parsing.
                    }
                }
            },
            cancel() {
                try { reader.cancel(); } catch {}
            }
        });

        return stream;
    }

    const responseText = await upstream.text();
    let parsed = null;
    try {
        parsed = JSON.parse(responseText);
    } catch {
        parsed = null;
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Ollama returned non-JSON response.');
    }

    const result = typeof parsed?.message?.content === 'string' ? parsed.message.content : '';
    if (!result) {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Ollama response did not contain text content.');
    }

    return {
        type: 'success',
        result,
        model: built.body.model,
    };
}

module.exports = {
    previewOllamaExecution,
    executeOllama,
};
