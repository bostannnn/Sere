function registerIntegrationRoutes(arg = {}) {
    const {
        app,
        pipeline,
    } = arg;

    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[IntegrationRoutes] ${routeLabel} failed:`, error);
            if (res.headersSent) {
                if (typeof next === 'function') next(error);
                return;
            }
            res.status(502).send({
                error: 'COMFY_PROXY_FAILED',
                message: String(error?.message || error),
            });
        }
    };

    const sendComfyError = (res, status, error, message) => {
        res.status(status).send({
            error,
            message,
        });
    };

    const comfyAllowedHosts = String(process.env.RISU_COMFY_ALLOWED_HOSTS || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
    const resolvedComfyAllowlist = comfyAllowedHosts.length > 0
        ? comfyAllowedHosts
        : ['localhost', '127.0.0.1', '::1', '[::1]'];

    app.all('/data/integrations/comfy/*', withAsyncRoute('ALL /data/integrations/comfy/*', async (req, res) => {
        const excludedHeaders = [
            'content-encoding',
            'content-length',
            'transfer-encoding',
        ];

        const rawBase = typeof req.headers['x-risu-comfy-base'] === 'string'
            ? req.headers['x-risu-comfy-base']
            : (typeof req.query?.base === 'string' ? req.query.base : '');
        if (!rawBase) {
            sendComfyError(res, 400, 'COMFY_BASE_REQUIRED', 'Missing comfy base URL');
            return;
        }

        const rawPath = (req.params?.[0] || '').toString().replace(/^\/+/, '');
        if (!rawPath) {
            sendComfyError(res, 400, 'COMFY_PATH_REQUIRED', 'Missing comfy subpath');
            return;
        }

        let comfyBase = '';
        try {
            comfyBase = decodeURIComponent(rawBase);
        } catch {
            comfyBase = String(rawBase);
        }

        let baseUrl;
        try {
            baseUrl = new URL(comfyBase);
        } catch {
            sendComfyError(res, 400, 'COMFY_BASE_INVALID', 'Invalid comfy base URL');
            return;
        }

        if (!['http:', 'https:'].includes(baseUrl.protocol)) {
            sendComfyError(res, 400, 'COMFY_BASE_PROTOCOL_INVALID', 'Comfy base URL must use http or https');
            return;
        }

        if (!resolvedComfyAllowlist.includes('*')
            && !resolvedComfyAllowlist.includes(baseUrl.host.toLowerCase())
            && !resolvedComfyAllowlist.includes(baseUrl.hostname.toLowerCase())) {
            sendComfyError(
                res,
                403,
                'COMFY_BASE_FORBIDDEN',
                `Comfy base host "${baseUrl.host}" is not allowed.`,
            );
            return;
        }

        const targetUrl = new URL(`${baseUrl.toString().replace(/\/+$/, '')}/${rawPath}`);
        for (const [key, value] of Object.entries(req.query || {})) {
            if (key === 'base' || value === undefined || value === null) continue;
            if (Array.isArray(value)) {
                for (const item of value) {
                    targetUrl.searchParams.append(key, String(item));
                }
                continue;
            }
            targetUrl.searchParams.append(key, String(value));
        }

        const headersToSend = {};
        const rawHeaderPayload = req.headers['x-risu-comfy-headers'];
        if (typeof rawHeaderPayload === 'string' && rawHeaderPayload.length > 0) {
            try {
                const decoded = decodeURIComponent(rawHeaderPayload);
                const parsed = JSON.parse(decoded);
                if (parsed && typeof parsed === 'object') {
                    for (const [key, value] of Object.entries(parsed)) {
                        const normalizedKey = key.trim().toLowerCase();
                        if (!normalizedKey) continue;
                        if (normalizedKey.startsWith('risu-')) continue;
                        if (normalizedKey === 'host' || normalizedKey === 'connection' || normalizedKey === 'content-length') continue;
                        if (typeof value === 'string') {
                            headersToSend[normalizedKey] = value;
                        }
                    }
                }
            } catch {
                sendComfyError(res, 400, 'COMFY_HEADERS_INVALID', 'Invalid forwarded headers');
                return;
            }
        }

        if (!headersToSend['x-forwarded-for']) {
            headersToSend['x-forwarded-for'] = req.ip;
        }

        let requestBody = undefined;
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            if (Buffer.isBuffer(req.body)) {
                requestBody = req.body;
            } else if (typeof req.body === 'string') {
                requestBody = req.body;
            } else if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
                requestBody = JSON.stringify(req.body);
            }
        }

        const response = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: headersToSend,
            body: requestBody,
            redirect: 'manual',
        });

        for (const [key, value] of response.headers.entries()) {
            if (excludedHeaders.includes(key.toLowerCase())) continue;
            res.setHeader(key, value);
        }
        res.status(response.status);
        if (response.body) {
            await pipeline(response.body, res);
        } else {
            res.end();
        }
    }));
}

module.exports = {
    registerIntegrationRoutes,
};
