function registerLegacyRoutes(arg = {}) {
    const {
        app,
        path,
        fs,
        existsSync,
        writeFileSync,
        crypto,
        openid,
        requirePasswordAuth,
        hasServerPassword,
        verifyPasswordToken,
        createPasswordRecord,
        getAuthLockInfo,
        recordAuthFailure,
        clearAuthFailures,
        getPassword,
        setPassword,
        passwordPath,
        savePath,
        setOAuthAccessToken,
        sendJson,
        oauthStateTtlMs,
        authCryptoRateLimitWindowMs,
        authCryptoRateLimitMax,
    } = arg;

    const oauthTransactions = new Map();
    const oauthTransactionTtlMs = Number.isFinite(Number(oauthStateTtlMs))
        ? Number(oauthStateTtlMs)
        : (10 * 60 * 1000);
    const oauthClient = {
        client_id: '',
        client_secret: '',
        config: null,
    };
    const cryptoRateLimitWindowMs = Number.isFinite(Number(authCryptoRateLimitWindowMs))
        ? Number(authCryptoRateLimitWindowMs)
        : 60_000;
    const cryptoRateLimitMax = Number.isFinite(Number(authCryptoRateLimitMax))
        ? Number(authCryptoRateLimitMax)
        : 60;
    const cryptoRateLimiter = new Map();

    const hexRegex = /^[0-9a-fA-F]+$/;
    const isHex = (str) => hexRegex.test(String(str || '').toUpperCase().trim());
    const firstHeaderValue = (headerValue) => {
        if (typeof headerValue === 'string') return headerValue;
        if (Array.isArray(headerValue) && typeof headerValue[0] === 'string') return headerValue[0];
        return '';
    };
    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[LegacyRoutes] ${routeLabel} failed:`, error);
            if (res.headersSent) {
                if (typeof next === 'function') next(error);
                return;
            }
            if (typeof sendJson === 'function') {
                sendJson(res, 500, {
                    error: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                });
                return;
            }
            res.status(500).send({
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            });
        }
    };
    const appendRateRecord = (bucketKey, nowMs) => {
        const current = cryptoRateLimiter.get(bucketKey);
        const nextHits = Array.isArray(current?.hits)
            ? current.hits.filter((ts) => (nowMs - ts) <= cryptoRateLimitWindowMs)
            : [];
        nextHits.push(nowMs);
        cryptoRateLimiter.set(bucketKey, { hits: nextHits, updatedAt: nowMs });
        return nextHits.length;
    };
    const cleanupCryptoLimiter = (nowMs) => {
        for (const [key, value] of cryptoRateLimiter.entries()) {
            const ageMs = nowMs - Number(value?.updatedAt || 0);
            if (ageMs > (cryptoRateLimitWindowMs * 3)) {
                cryptoRateLimiter.delete(key);
            }
        }
    };
    const getClientRateKey = (req) => {
        const header = firstHeaderValue(req.headers['x-forwarded-for']);
        const firstProxyIp = header.split(',')[0]?.trim();
        if (firstProxyIp) return firstProxyIp;
        const socketIp = req.socket?.remoteAddress;
        if (typeof socketIp === 'string' && socketIp.trim()) {
            return socketIp.trim();
        }
        return 'unknown';
    };
    const cleanupExpiredOAuthTransactions = (nowMs = Date.now()) => {
        for (const [state, txn] of oauthTransactions.entries()) {
            if (!txn || Number(txn.expiresAt || 0) <= nowMs) {
                oauthTransactions.delete(state);
            }
        }
    };
    const createOAuthState = () => crypto.randomBytes(24).toString('hex');
    const ensureOAuthClient = async (redirectUri, res) => {
        if (!redirectUri) {
            res.status(400).send({ error: 'redirect_uri is required' });
            return null;
        }
        if (oauthClient.client_id && oauthClient.client_secret && oauthClient.config) {
            return oauthClient;
        }

        const discovery = await openid.discovery('https://account.sionyw.com/', '', '');
        const serverMeta = discovery.serverMetadata();
        const registrationResponse = await fetch(serverMeta.registration_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serverMeta.registration_access_token || ''}`,
            },
            body: JSON.stringify({
                redirect_uris: [redirectUri],
                response_types: ['code'],
                grant_types: ['authorization_code'],
                scope: 'risuai',
                token_endpoint_auth_method: 'client_secret_basic',
                client_name: 'Risuai Node Server',
            }),
        });

        if (registrationResponse.status !== 201 && registrationResponse.status !== 200) {
            console.error('[Server] OAuth2 dynamic client registration failed:', registrationResponse.statusText);
            res.status(500).send({ error: 'OAuth2 client registration failed' });
            return null;
        }

        const registrationData = await registrationResponse.json();
        oauthClient.client_id = registrationData.client_id;
        oauthClient.client_secret = registrationData.client_secret;
        oauthClient.config = discovery;
        discovery.clientMetadata().client_id = oauthClient.client_id;
        discovery.clientMetadata().client_secret = oauthClient.client_secret;
        return oauthClient;
    };

    app.get('/data/auth/password/status', withAsyncRoute('GET /data/auth/password/status', async (req, res) => {
        const password = getPassword();
        const authToken = firstHeaderValue(req.headers['risu-auth']).trim();
        if (password === '') {
            res.send({ status: 'unset' });
            return;
        }
        const lockInfo = getAuthLockInfo(req);
        if (lockInfo.locked) {
            res.send({ status: 'incorrect', retryAfterMs: lockInfo.retryAfterMs });
            return;
        }
        if (verifyPasswordToken(authToken)) {
            if (typeof password === 'string' && !password.startsWith('scrypt$')) {
                const migratedRecord = createPasswordRecord(authToken);
                setPassword(migratedRecord);
                writeFileSync(passwordPath, migratedRecord, 'utf-8');
            }
            clearAuthFailures(req);
            res.send({ status: 'correct' });
            return;
        }
        const authAttemptHeader = firstHeaderValue(req.headers['x-risu-auth-attempt']).trim();
        // Only count explicit user-entered attempts. Passive status probes with cached/stale
        // tokens must not burn lockout quota.
        const shouldCountFailure = authAttemptHeader === '1';
        if (shouldCountFailure) {
            recordAuthFailure(req);
            const nextLockInfo = getAuthLockInfo(req);
            if (nextLockInfo.locked) {
                res.send({ status: 'incorrect', retryAfterMs: nextLockInfo.retryAfterMs });
                return;
            }
        }
        res.send({ status: 'incorrect' });
    }));

    app.post('/data/auth/crypto', withAsyncRoute('POST /data/auth/crypto', async (req, res) => {
        if (!requirePasswordAuth(req, res)) return;
        const nowMs = Date.now();
        cleanupCryptoLimiter(nowMs);
        const rateKey = getClientRateKey(req);
        const hitCount = appendRateRecord(rateKey, nowMs);
        if (hitCount > cryptoRateLimitMax) {
            res.status(429).send({
                error: 'TOO_MANY_REQUESTS',
                message: 'Too many hash requests. Please retry later.',
            });
            return;
        }
        const input = typeof req.body?.data === 'string' ? req.body.data : '';
        const hash = crypto.createHash('sha256');
        hash.update(Buffer.from(input, 'utf-8'));
        res.send(hash.digest('hex'));
    }));

    app.post('/data/auth/password', withAsyncRoute('POST /data/auth/password', async (req, res) => {
        if (hasServerPassword()) {
            res.status(409).send({
                error: 'ALREADY_SET',
                message: 'Password already set.',
            });
            return;
        }
        const nextPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
        if (!nextPassword) {
            res.status(400).send({
                error: 'PASSWORD_REQUIRED',
                message: 'password required',
            });
            return;
        }
        const record = createPasswordRecord(nextPassword);
        setPassword(record);
        writeFileSync(passwordPath, record, 'utf-8');
        clearAuthFailures(req);
        res.send({ ok: true });
    }));

    app.post('/data/auth/password/change', withAsyncRoute('POST /data/auth/password/change', async (req, res) => {
        if (!requirePasswordAuth(req, res)) return;
        const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword.trim() : '';
        const nextPassword = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
        if (!currentPassword || !nextPassword) {
            res.status(400).send({
                error: 'INVALID_REQUEST',
                message: 'currentPassword and password are required',
            });
            return;
        }
        if (currentPassword === nextPassword) {
            res.status(400).send({
                error: 'PASSWORD_UNCHANGED',
                message: 'new password must differ from current password',
            });
            return;
        }
        if (!verifyPasswordToken(currentPassword)) {
            recordAuthFailure(req);
            const lockInfo = getAuthLockInfo(req);
            if (lockInfo.locked) {
                res.status(429).send({ error: 'too_many_attempts', retryAfterMs: lockInfo.retryAfterMs });
                return;
            }
            res.status(403).send({ error: 'current_password_incorrect' });
            return;
        }
        const record = createPasswordRecord(nextPassword);
        setPassword(record);
        writeFileSync(passwordPath, record, 'utf-8');
        clearAuthFailures(req);
        res.send({ ok: true });
    }));

    app.get('/data/storage/read', withAsyncRoute('GET /data/storage/read', async (req, res, next) => {
        if (!requirePasswordAuth(req, res)) return;
        const filePath = req.headers['file-path'];
        if (!filePath) {
            res.status(400).send({
                error: 'File path required',
            });
            return;
        }
        if (!isHex(filePath)) {
            res.status(400).send({
                error: 'Invaild Path',
            });
            return;
        }
        try {
            if (!existsSync(path.join(savePath, filePath))) {
                res.send();
            } else {
                res.setHeader('Content-Type', 'application/octet-stream');
                res.sendFile(path.join(savePath, filePath));
            }
        } catch (error) {
            next(error);
        }
    }));

    app.delete('/data/storage/remove', withAsyncRoute('DELETE /data/storage/remove', async (req, res, next) => {
        if (!requirePasswordAuth(req, res)) return;
        const filePath = req.headers['file-path'];
        if (!filePath) {
            res.status(400).send({
                error: 'File path required',
            });
            return;
        }
        if (!isHex(filePath)) {
            res.status(400).send({
                error: 'Invaild Path',
            });
            return;
        }
        try {
            await fs.rm(path.join(savePath, filePath), { force: true });
            res.send({
                success: true,
            });
        } catch (error) {
            next(error);
        }
    }));

    app.get('/data/storage/list', withAsyncRoute('GET /data/storage/list', async (req, res, next) => {
        if (!requirePasswordAuth(req, res)) return;
        try {
            const data = (await fs.readdir(path.join(savePath))).map((v) => {
                return Buffer.from(v, 'hex').toString('utf-8');
            });
            res.send({
                success: true,
                content: data,
            });
        } catch (error) {
            next(error);
        }
    }));

    app.post('/data/storage/write', withAsyncRoute('POST /data/storage/write', async (req, res, next) => {
        if (!requirePasswordAuth(req, res)) return;
        const filePath = req.headers['file-path'];
        const fileContent = req.body;
        if (!filePath || !fileContent) {
            res.status(400).send({
                error: 'File path required',
            });
            return;
        }
        if (!isHex(filePath)) {
            res.status(400).send({
                error: 'Invaild Path',
            });
            return;
        }

        try {
            await fs.writeFile(path.join(savePath, filePath), fileContent);
            res.send({
                success: true,
            });
        } catch (error) {
            next(error);
        }
    }));

    app.get('/data/oauth/login', withAsyncRoute('GET /data/oauth/login', async (req, res) => {
        if (!requirePasswordAuth(req, res)) return;
        const redirect_uri = `${req.protocol}://${req.get('host')}/data/oauth/callback`;
        const client = await ensureOAuthClient(redirect_uri, res);
        if (!client) return;

        const code_verifier = openid.randomPKCECodeVerifier();
        const code_challenge = await openid.calculatePKCECodeChallenge(code_verifier);
        const state = createOAuthState();
        const expiresAt = Date.now() + oauthTransactionTtlMs;
        cleanupExpiredOAuthTransactions();
        oauthTransactions.set(state, {
            state,
            code_verifier,
            client_id: client.client_id,
            client_secret: client.client_secret,
            config: client.config,
            expiresAt,
        });

        const redirectTo = openid.buildAuthorizationUrl(client.config, {
            redirect_uri,
            code_challenge,
            code_challenge_method: 'S256',
            scope: 'risuai',
            state,
        });

        res.redirect(redirectTo.toString());
    }));

    app.get('/data/oauth/callback', withAsyncRoute('GET /data/oauth/callback', async (req, res) => {
        const params = (new URL(req.url, `http://${req.headers.host}`)).searchParams;
        const code = params.get('code');
        const state = params.get('state');

        if (!code || !state) {
            res.status(400).send({ error: 'code and state are required' });
            return;
        }
        cleanupExpiredOAuthTransactions();
        const oauthTxn = oauthTransactions.get(state);
        if (!oauthTxn || Number(oauthTxn.expiresAt || 0) <= Date.now()) {
            oauthTransactions.delete(state);
            res.status(400).send({ error: 'invalid or expired oauth state' });
            return;
        }
        oauthTransactions.delete(state);

        const callbackUrl = new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`);
        const tokens = await openid.authorizationCodeGrant(
            oauthTxn.config,
            callbackUrl,
            {
                pkceCodeVerifier: oauthTxn.code_verifier,
            },
        );

        if (typeof setOAuthAccessToken === 'function') {
            setOAuthAccessToken(tokens.access_token);
        }

        if (typeof sendJson === 'function') {
            sendJson(res, 200, { ok: true });
            return;
        }
        res.send({ ok: true });
    }));
}

module.exports = {
    registerLegacyRoutes,
};
