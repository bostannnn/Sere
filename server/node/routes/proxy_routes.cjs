function registerProxyRoutes(arg = {}) {
    const {
        app,
        pipeline,
        getOAuthAccessToken,
        requirePasswordAuth,
    } = arg;

    const blockedForwardRequestHeaders = new Set([
        'host',
        'connection',
        'content-length',
        'transfer-encoding',
        'risu-url',
        'risu-header',
        'risu-auth',
        'x-risu-node-path',
    ]);
    const blockedForwardResponseHeaders = new Set([
        'content-encoding',
        'content-length',
        'transfer-encoding',
        'content-security-policy',
        'content-security-policy-report-only',
        'clear-site-data',
        'cache-control',
    ]);

    const parseHostAllowlist = (raw) => {
        return String(raw || '')
            .split(',')
            .map((entry) => entry.trim().toLowerCase())
            .filter(Boolean);
    };

    const proxyAllowedHosts = parseHostAllowlist(process.env.RISU_PROXY_ALLOWED_HOSTS);

    const setProxyCors = (res) => {
        res.set({
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'risu-url, risu-header, risu-auth, x-risu-client-id, content-type, x-risu-tk, risu-location',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        });
    };

    const decodeURIComponentSafe = (value) => {
        if (typeof value !== 'string') return '';
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    };

    const parseJsonHeader = (rawHeaderValue) => {
        if (typeof rawHeaderValue !== 'string' || rawHeaderValue.length === 0) {
            return { ok: true, value: {} };
        }
        try {
            const decoded = decodeURIComponentSafe(rawHeaderValue);
            const parsed = JSON.parse(decoded);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                return { ok: false, error: 'INVALID_HEADER_PAYLOAD', message: 'risu-header must encode a JSON object.' };
            }
            return { ok: true, value: parsed };
        } catch {
            return { ok: false, error: 'INVALID_HEADER_PAYLOAD', message: 'Failed to parse risu-header.' };
        }
    };

    const isHostAllowed = (urlObj, allowedHosts) => {
        if (!Array.isArray(allowedHosts) || allowedHosts.length === 0) return false;
        if (allowedHosts.includes('*')) return true;
        const host = String(urlObj.host || '').toLowerCase();
        const hostname = String(urlObj.hostname || '').toLowerCase();
        return allowedHosts.includes(host) || allowedHosts.includes(hostname);
    };

    const parseProxyTarget = (rawTarget, options = {}) => {
        const target = decodeURIComponentSafe(String(rawTarget || '').trim());
        if (!target) {
            return {
                ok: false,
                status: 400,
                payload: {
                    error: 'PROXY_TARGET_REQUIRED',
                    message: `${options.label || 'Proxy target URL'} is required.`,
                },
            };
        }
        let urlObj;
        try {
            urlObj = new URL(target);
        } catch {
            return {
                ok: false,
                status: 400,
                payload: {
                    error: 'PROXY_TARGET_INVALID',
                    message: `${options.label || 'Proxy target URL'} is invalid.`,
                },
            };
        }
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            return {
                ok: false,
                status: 400,
                payload: {
                    error: 'PROXY_PROTOCOL_INVALID',
                    message: 'Proxy target must use http or https.',
                },
            };
        }
        if (!isHostAllowed(urlObj, options.allowedHosts)) {
            return {
                ok: false,
                status: 403,
                payload: {
                    error: 'PROXY_TARGET_FORBIDDEN',
                    message: `Proxy target host "${urlObj.host}" is not allowed.`,
                },
            };
        }
        return { ok: true, url: urlObj };
    };

    const sanitizeForwardHeaders = (headersInput, req, options = {}) => {
        const out = {};
        const entries = Object.entries(headersInput || {});
        for (const [rawKey, rawValue] of entries) {
            const key = String(rawKey || '').trim().toLowerCase();
            if (!key || blockedForwardRequestHeaders.has(key)) continue;
            if (options.dropAuthorization === true && key === 'authorization') continue;
            const value = Array.isArray(rawValue) ? rawValue.join(', ') : rawValue;
            if (typeof value !== 'string') continue;
            out[key] = value;
        }
        if (!out['x-forwarded-for']) {
            out['x-forwarded-for'] = req.ip;
        }
        return out;
    };

    const buildRequestBody = (req) => {
        if (req.method === 'GET' || req.method === 'HEAD') return undefined;
        if (Buffer.isBuffer(req.body)) return req.body;
        if (typeof req.body === 'string') return req.body;
        if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
        return undefined;
    };

    const forwardProxyResponse = async (upstream, res) => {
        for (const [key, value] of upstream.headers.entries()) {
            if (blockedForwardResponseHeaders.has(key.toLowerCase())) continue;
            res.setHeader(key, value);
        }
        res.status(upstream.status);
        if (upstream.body) {
            await pipeline(upstream.body, res);
        } else {
            res.end();
        }
    };

    const reverseProxyFunc = async (req, res) => {
        if (!requirePasswordAuth(req, res)) return;
        setProxyCors(res);

        const rawTarget = typeof req.headers['risu-url'] === 'string'
            ? req.headers['risu-url']
            : req.query.url;
        const parsedTarget = parseProxyTarget(rawTarget, {
            label: 'Proxy target URL',
            allowedHosts: proxyAllowedHosts.length > 0 ? proxyAllowedHosts : ['localhost', '127.0.0.1', '::1', '[::1]'],
        });
        if (!parsedTarget.ok) {
            res.status(parsedTarget.status).send(parsedTarget.payload);
            return;
        }

        const parsedHeader = parseJsonHeader(req.headers['risu-header']);
        if (!parsedHeader.ok) {
            res.status(400).send({
                error: parsedHeader.error,
                message: parsedHeader.message,
            });
            return;
        }
        const forwardedHeaders = sanitizeForwardHeaders(parsedHeader.value, req);
        const incomingAuthorization = typeof req.headers['authorization'] === 'string'
            ? req.headers['authorization']
            : '';
        if (incomingAuthorization.startsWith('X-SERVER-REGISTER')) {
            const authCode = typeof getOAuthAccessToken === 'function'
                ? String(getOAuthAccessToken() || '').trim()
                : '';
            if (!authCode) {
                delete forwardedHeaders.authorization;
            } else {
                forwardedHeaders.authorization = `Bearer ${authCode}`;
            }
        }

        try {
            const upstream = await fetch(parsedTarget.url.toString(), {
                method: req.method,
                headers: forwardedHeaders,
                body: buildRequestBody(req),
            });
            await forwardProxyResponse(upstream, res);
        } catch (err) {
            console.log('[Proxy] fetch failed', parsedTarget.url.toString(), err);
            res.status(502).send({
                error: 'PROXY_FETCH_FAILED',
                message: String(err?.message || err),
            });
        }
    };

    app.options('/data/proxy', (req, res) => {
        setProxyCors(res);
        res.sendStatus(204);
    });
    app.get('/data/proxy', reverseProxyFunc);
    app.post('/data/proxy', reverseProxyFunc);
}

module.exports = {
    registerProxyRoutes,
};
