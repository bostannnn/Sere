function registerAuthRoutes(arg = {}) {
    const {
        app,
        crypto,
        sendJson,
        requirePasswordAuth,
        hasServerPassword,
        verifyPasswordToken,
        createPasswordRecord,
        getAuthLockInfo,
        recordAuthFailure,
        clearAuthFailures,
        getPassword,
        setPassword,
        writeFileSync,
        passwordPath,
        authCryptoRateLimitWindowMs,
        authCryptoRateLimitMax,
    } = arg;

    if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
        throw new Error('registerAuthRoutes requires an Express app instance.');
    }

    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[AuthRoutes] ${routeLabel} failed:`, error);
            if (res.headersSent) {
                if (typeof next === 'function') next(error);
                return;
            }
            sendJson(res, 500, {
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            });
        }
    };

    const firstHeaderValue = (headerValue) => {
        if (typeof headerValue === 'string') return headerValue;
        if (Array.isArray(headerValue) && typeof headerValue[0] === 'string') return headerValue[0];
        return '';
    };

    const cryptoWindowMs = Number.isFinite(Number(authCryptoRateLimitWindowMs))
        ? Number(authCryptoRateLimitWindowMs)
        : 60000;
    const cryptoMax = Number.isFinite(Number(authCryptoRateLimitMax))
        ? Number(authCryptoRateLimitMax)
        : 60;
    const cryptoRateLimiter = new Map();

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

    const appendRateRecord = (bucketKey, nowMs) => {
        const current = cryptoRateLimiter.get(bucketKey);
        const nextHits = Array.isArray(current?.hits)
            ? current.hits.filter((ts) => (nowMs - ts) <= cryptoWindowMs)
            : [];
        nextHits.push(nowMs);
        cryptoRateLimiter.set(bucketKey, { hits: nextHits, updatedAt: nowMs });
        return nextHits.length;
    };

    const cleanupCryptoLimiter = (nowMs) => {
        for (const [key, value] of cryptoRateLimiter.entries()) {
            const ageMs = nowMs - Number(value?.updatedAt || 0);
            if (ageMs > (cryptoWindowMs * 3)) {
                cryptoRateLimiter.delete(key);
            }
        }
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
        const nowMs = Date.now();
        cleanupCryptoLimiter(nowMs);
        const rateKey = getClientRateKey(req);
        const hitCount = appendRateRecord(rateKey, nowMs);
        if (hitCount > cryptoMax) {
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
}

module.exports = {
    registerAuthRoutes,
};
