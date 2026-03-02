const { existsSync } = require('fs');
const fs = require('fs/promises');
const dns = require('dns/promises');
const net = require('net');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

const reverseProxyAllowedHosts = String(process.env.RISU_REVERSE_PROXY_ALLOWED_HOSTS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
const allowPrivateReverseProxyTargets = String(process.env.RISU_REVERSE_PROXY_ALLOW_PRIVATE || '').trim() === '1';

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

function toPrimitiveValue(raw) {
    if (typeof raw !== 'string') return raw;
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        return raw.slice(1, -1);
    }
    if (raw === 'true' || raw === 'false') {
        return raw === 'true';
    }
    if (raw === 'null') {
        return null;
    }
    if (raw.startsWith('json::')) {
        const parsed = raw.slice('json::'.length);
        try {
            return JSON.parse(parsed);
        } catch {
            return parsed;
        }
    }
    const n = Number(raw);
    if (!Number.isNaN(n)) {
        return n;
    }
    return raw;
}

function setObjectByPath(target, dottedPath, value) {
    const segments = String(dottedPath).split('.').filter(Boolean);
    if (segments.length === 0) return;
    let cursor = target;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i];
        if (!cursor[key] || typeof cursor[key] !== 'object' || Array.isArray(cursor[key])) {
            cursor[key] = {};
        }
        cursor = cursor[key];
    }
    cursor[segments[segments.length - 1]] = value;
}

function deleteObjectByPath(target, dottedPath) {
    const segments = String(dottedPath).split('.').filter(Boolean);
    if (segments.length === 0) return;
    let cursor = target;
    for (let i = 0; i < segments.length - 1; i += 1) {
        const key = segments[i];
        if (!cursor[key] || typeof cursor[key] !== 'object') {
            return;
        }
        cursor = cursor[key];
    }
    delete cursor[segments[segments.length - 1]];
}

function applyAdditionalParams(body, headers, additionalParams) {
    if (!Array.isArray(additionalParams)) return;
    for (const pair of additionalParams) {
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const rawKey = typeof pair[0] === 'string' ? pair[0].trim() : '';
        const rawValue = typeof pair[1] === 'string' ? pair[1] : pair[1] == null ? '' : String(pair[1]);
        if (!rawKey || rawValue === '') continue;

        if (rawValue === '{{none}}') {
            if (rawKey.startsWith('header::')) {
                const headerKey = rawKey.slice('header::'.length);
                if (headerKey) delete headers[headerKey];
            } else {
                deleteObjectByPath(body, rawKey);
            }
            continue;
        }

        if (rawKey.startsWith('header::')) {
            const headerKey = rawKey.slice('header::'.length);
            if (headerKey) headers[headerKey] = rawValue;
            continue;
        }

        setObjectByPath(body, rawKey, toPrimitiveValue(rawValue));
    }
}

function ensureChatCompletionsPath(rawUrl) {
    let parsed = null;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new LLMHttpError(400, 'INVALID_PROXY_URL', `Invalid reverse proxy URL: ${rawUrl}`);
    }
    const pathValue = parsed.pathname || '/';
    if (pathValue.endsWith('/chat/completions') || pathValue.endsWith('/chat/completions/')) {
        return parsed.toString();
    }
    if (pathValue.endsWith('/v1')) {
        parsed.pathname = `${pathValue}/chat/completions`;
        return parsed.toString();
    }
    if (pathValue.endsWith('/v1/')) {
        parsed.pathname = `${pathValue}chat/completions`;
        return parsed.toString();
    }
    if (pathValue.endsWith('/')) {
        parsed.pathname = `${pathValue}v1/chat/completions`;
        return parsed.toString();
    }
    parsed.pathname = `${pathValue}/v1/chat/completions`;
    return parsed.toString();
}

function ensureValidUrl(rawUrl) {
    try {
        return new URL(rawUrl).toString();
    } catch {
        throw new LLMHttpError(400, 'INVALID_PROXY_URL', `Invalid reverse proxy URL: ${rawUrl}`);
    }
}

function normalizeHostname(raw) {
    const source = String(raw || '').trim().toLowerCase().replace(/\.+$/, '');
    if (source.startsWith('[') && source.endsWith(']')) {
        return source.slice(1, -1);
    }
    return source;
}

function normalizeIpCandidate(raw) {
    const source = normalizeHostname(raw);
    const zoneIndex = source.indexOf('%');
    return zoneIndex >= 0 ? source.slice(0, zoneIndex) : source;
}

function isPrivateIpv4Address(ipv4) {
    const parts = String(ipv4 || '').split('.').map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }
    const [a, b] = parts;
    if (a === 0) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // RFC 6598
    return false;
}

function isPrivateIpv6Address(ipv6) {
    const ip = normalizeIpCandidate(ipv6);
    if (ip === '::' || ip === '::1') return true;
    if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // fc00::/7
    if (ip.startsWith('fe8') || ip.startsWith('fe9') || ip.startsWith('fea') || ip.startsWith('feb')) return true; // fe80::/10
    if (ip.startsWith('fec') || ip.startsWith('fed') || ip.startsWith('fee') || ip.startsWith('fef')) return true; // fec0::/10 (legacy site-local)
    if (ip.startsWith('::ffff:')) {
        const mapped = ip.slice('::ffff:'.length);
        return net.isIP(mapped) === 4 && isPrivateIpv4Address(mapped);
    }
    return false;
}

function isPrivateIpAddress(raw) {
    const ip = normalizeIpCandidate(raw);
    const version = net.isIP(ip);
    if (version === 4) return isPrivateIpv4Address(ip);
    if (version === 6) return isPrivateIpv6Address(ip);
    return false;
}

function isHostAllowed(urlObj, allowedHosts) {
    if (!Array.isArray(allowedHosts) || allowedHosts.length === 0) return true;
    if (allowedHosts.includes('*')) return true;
    const host = String(urlObj.host || '').toLowerCase();
    const hostNoBrackets = host.replace(/^\[(.*)\](:\d+)?$/u, '$1$2');
    const hostname = normalizeHostname(urlObj.hostname);
    return allowedHosts.includes(host) || allowedHosts.includes(hostNoBrackets) || allowedHosts.includes(hostname);
}

async function ensureSafeRemoteUrl(rawUrl, options = {}) {
    const normalizedUrl = options.autofillPath
        ? ensureChatCompletionsPath(rawUrl)
        : ensureValidUrl(rawUrl);
    const parsed = new URL(normalizedUrl);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new LLMHttpError(
            400,
            'REVERSE_PROXY_PROTOCOL_INVALID',
            'Reverse proxy URL must use http or https.'
        );
    }

    if (!isHostAllowed(parsed, options.allowedHosts)) {
        throw new LLMHttpError(
            403,
            'REVERSE_PROXY_TARGET_FORBIDDEN',
            `Reverse proxy host "${parsed.host}" is not allowed by RISU_REVERSE_PROXY_ALLOWED_HOSTS.`
        );
    }

    const hostname = normalizeHostname(parsed.hostname);
    const isLocalhostName = hostname === 'localhost' || hostname.endsWith('.localhost');
    if (!options.allowPrivateTargets) {
        if (isLocalhostName || isPrivateIpAddress(hostname)) {
            throw new LLMHttpError(
                403,
                'REVERSE_PROXY_TARGET_FORBIDDEN',
                `Reverse proxy host "${parsed.host}" resolves to a private or loopback address.`
            );
        }
        try {
            const resolved = await dns.lookup(hostname, { all: true, verbatim: true });
            if (Array.isArray(resolved) && resolved.some((entry) => isPrivateIpAddress(entry?.address))) {
                throw new LLMHttpError(
                    403,
                    'REVERSE_PROXY_TARGET_FORBIDDEN',
                    `Reverse proxy host "${parsed.host}" resolves to a private or loopback address.`
                );
            }
        } catch (error) {
            if (error instanceof LLMHttpError) {
                throw error;
            }
            // Best-effort DNS validation: unresolved hosts fail later in fetch().
        }
    }

    return parsed.toString();
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
    if (typeof data?.result === 'string') {
        return data.result;
    }
    if (typeof data?.response === 'string') {
        return data.response;
    }
    return JSON.stringify(data);
}

async function buildExecutionRequest(input, settings) {
    const payload = getRequestPayload(input);
    const requestBody = safeClone(payload.requestBody && typeof payload.requestBody === 'object' ? payload.requestBody : {}) || {};
    const proxyRequest = payload.proxyRequest && typeof payload.proxyRequest === 'object' ? payload.proxyRequest : {};

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

    const hasMessages = Array.isArray(requestBody.messages) && requestBody.messages.length > 0;
    const hasPrompt = typeof requestBody.prompt === 'string' && requestBody.prompt.trim().length > 0;
    if (!hasMessages && !hasPrompt) {
        throw new LLMHttpError(400, 'INVALID_MESSAGES', 'Reverse proxy request requires non-empty messages or prompt.');
    }

    const candidateUrl =
        (typeof proxyRequest.url === 'string' && proxyRequest.url.trim())
            ? proxyRequest.url.trim()
            : ((typeof requestBody.reverse_proxy_url === 'string' && requestBody.reverse_proxy_url.trim())
                ? requestBody.reverse_proxy_url.trim()
                : (typeof settings?.forceReplaceUrl === 'string' ? settings.forceReplaceUrl.trim() : ''));
    if (!candidateUrl) {
        throw new LLMHttpError(400, 'INVALID_PROXY_URL', 'Reverse proxy URL is missing.');
    }

    const url = await ensureSafeRemoteUrl(candidateUrl, {
        autofillPath: !!settings?.autofillRequestUrl,
        allowedHosts: reverseProxyAllowedHosts,
        allowPrivateTargets: allowPrivateReverseProxyTargets,
    });
    delete requestBody.reverse_proxy_url;
    requestBody.stream = !!input.streaming;

    const headers = {
        'Content-Type': 'application/json',
    };
    const proxyKey = typeof settings?.proxyKey === 'string' ? settings.proxyKey.trim() : '';
    if (proxyKey) {
        headers.Authorization = `Bearer ${proxyKey}`;
    }

    applyAdditionalParams(requestBody, headers, settings?.additionalParams);

    return {
        url,
        method: 'POST',
        headers,
        body: requestBody,
    };
}

function sanitizeHeaders(headers) {
    const next = { ...headers };
    if (typeof next.Authorization === 'string') {
        next.Authorization = 'Bearer [REDACTED]';
    }
    return next;
}

async function previewReverseProxyExecution(input, ctx = {}) {
    const settings = await loadSettings(ctx.dataRoot);
    const built = await buildExecutionRequest(input, settings);
    return {
        url: built.url,
        body: built.body,
        headers: sanitizeHeaders(built.headers),
        warnings: [
            'Phase B1: prompt assembly is still client-side; upstream execution and auth are server-side.',
        ],
    };
}

async function executeReverseProxy(input, ctx = {}) {
    const settings = await loadSettings(ctx.dataRoot);
    const built = await buildExecutionRequest(input, settings);

    const upstream = await fetch(built.url, {
        method: built.method,
        headers: built.headers,
        body: JSON.stringify(built.body),
    });

    if (!upstream.ok) {
        const responseText = await upstream.text();
        let parsed = null;
        try { parsed = JSON.parse(responseText); } catch {}
        throw new LLMHttpError(
            upstream.status,
            'UPSTREAM_REVERSE_PROXY_ERROR',
            'Reverse proxy request failed.',
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
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Reverse proxy returned non-JSON response.');
    }

    const result = parseResponseText(parsed);
    if (typeof result !== 'string') {
        throw new LLMHttpError(502, 'INVALID_UPSTREAM_RESPONSE', 'Reverse proxy response did not contain text content.');
    }

    return {
        type: 'success',
        result,
        model: built.body.model || null,
    };
}

module.exports = {
    previewReverseProxyExecution,
    executeReverseProxy,
};
