const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

const HORDE_ASYNC_URL = 'https://stablehorde.net/api/v2/generate/text/async';
const HORDE_STATUS_BASE_URL = 'https://stablehorde.net/api/v2/generate/text/status/';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildExecutionRequest(input, settings) {
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};

    if (typeof requestBody.prompt !== 'string' || !requestBody.prompt.trim()) {
        throw new LLMHttpError(400, 'INVALID_PROMPT', 'Horde request requires a non-empty prompt.');
    }
    if (!requestBody.params || typeof requestBody.params !== 'object') {
        throw new LLMHttpError(400, 'INVALID_BODY', 'Horde request requires params object.');
    }
    if (input.streaming) {
        throw new LLMHttpError(400, 'STREAMING_NOT_SUPPORTED', 'Horde server migration path does not support streaming yet.');
    }

    let apiKey = typeof settings?.hordeConfig?.apiKey === 'string' ? settings.hordeConfig.apiKey.trim() : '';
    if (!apiKey) {
        apiKey = '0000000000';
    }

    return {
        url: HORDE_ASYNC_URL,
        statusBaseUrl: HORDE_STATUS_BASE_URL,
        headers: {
            'content-type': 'application/json',
            apikey: apiKey,
        },
        body: requestBody,
    };
}

function sanitizeHeaders(headers) {
    return {
        ...headers,
        apikey: '[REDACTED]',
    };
}

async function previewHordeExecution(input, ctx = {}) {
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

async function executeHorde(input, ctx = {}) {
    const settings = await loadSettings(ctx.dataRoot);
    const built = buildExecutionRequest(input, settings);

    const start = await fetch(built.url, {
        method: 'POST',
        headers: built.headers,
        body: JSON.stringify(built.body),
    });

    if (start.status !== 202) {
        const responseText = await start.text();
        let parsed = null;
        try { parsed = JSON.parse(responseText); } catch {}
        throw new LLMHttpError(
            start.status,
            'UPSTREAM_HORDE_ERROR',
            'Horde async start request failed.',
            {
                status: start.status,
                statusText: start.statusText,
                body: parsed || responseText,
            }
        );
    }

    const started = await start.json();
    const requestId = typeof started?.id === 'string' ? started.id : '';
    if (!requestId) {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Horde start response did not contain request id.');
    }

    const warnMessage = started?.message ? ` with ${started.message}` : '';

    const maxPolls = 120;
    for (let i = 0; i < maxPolls; i++) {
        await sleep(2000);
        const statusRes = await fetch(`${built.statusBaseUrl}${requestId}`);
        if (!statusRes.ok) {
            const statusText = await statusRes.text();
            let parsed = null;
            try { parsed = JSON.parse(statusText); } catch {}
            throw new LLMHttpError(
                statusRes.status,
                'UPSTREAM_HORDE_ERROR',
                'Horde status request failed.',
                {
                    status: statusRes.status,
                    statusText: statusRes.statusText,
                    body: parsed || statusText,
                }
            );
        }

        const statusData = await statusRes.json();
        if (statusData && statusData.is_possible === false) {
            try {
                await fetch(`${built.statusBaseUrl}${requestId}`, { method: 'DELETE' });
            } catch {}
            throw new LLMHttpError(502, 'UPSTREAM_HORDE_ERROR', `Response not possible${warnMessage}`);
        }

        if (statusData && statusData.done) {
            const generations = Array.isArray(statusData.generations) ? statusData.generations : [];
            const text = generations?.[0]?.text;
            if (typeof text === 'string') {
                return {
                    type: 'success',
                    result: text,
                };
            }
            throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Horde returned done with no generations.');
        }
    }

    throw new LLMHttpError(504, 'UPSTREAM_TIMEOUT', 'Horde generation timed out while polling status.');
}

module.exports = {
    previewHordeExecution,
    executeHorde,
};
