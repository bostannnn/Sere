const nodeCrypto = require('crypto');

function toStringOrEmpty(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function safeJsonClone(value, fallback = {}) {
    if (value === null || value === undefined) return fallback;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function sendJson(res, status, payload, etag) {
    const body = JSON.stringify(payload);
    res.status(status);
    res.setHeader('Content-Type', 'application/json');
    if (etag) {
        res.setHeader('ETag', etag);
    }
    res.end(body);
}

function sendSSE(res, payload) {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
}

function getReqIdFromResponse(res) {
    const reqId = res.getHeader('x-risu-req-id');
    return typeof reqId === 'string' || typeof reqId === 'number' ? String(reqId) : '-';
}

function isSafePathSegment(segment) {
    return typeof segment === 'string' &&
        segment.length > 0 &&
        segment.length <= 128 &&
        !segment.includes('/') &&
        !segment.includes('\\') &&
        !segment.includes('\0') &&
        !segment.includes('..') &&
        segment !== '.';
}

function requireSafeSegment(res, segment, fieldName = 'id') {
    if (!isSafePathSegment(segment)) {
        res.status(400).send({
            error: 'INVALID_ID',
            message: `Invalid ${fieldName}`,
        });
        return null;
    }
    return segment;
}

function getDataResourceId(req) {
    const params = req.params || {};
    if (params.id && params.chatId) return `${params.id}/chats/${params.chatId}`;
    if (params.id) return params.id;
    if (params.name) return params.name;
    const queryId = req.query?.id;
    if (typeof queryId === 'string' && queryId.length > 0) return queryId;
    return '-';
}

function createAppendLLMAudit(arg = {}) {
    const dataRoot = arg.dataRoot || '';
    const appendExecutionLog = typeof arg.appendExecutionLog === 'function'
        ? arg.appendExecutionLog
        : null;
    const onError = typeof arg.onError === 'function'
        ? arg.onError
        : ((error) => console.error('[LLMAPI] Failed to persist audit log', error));

    return async function appendLLMAudit(entry) {
        if (!appendExecutionLog) return;
        try {
            await appendExecutionLog(dataRoot, entry);
        } catch (error) {
            onError(error);
        }
    };
}

function createPasswordAuthHelpers(arg = {}) {
    const getPassword = typeof arg.getPassword === 'function'
        ? arg.getPassword
        : (() => '');
    const persistPasswordRecord = typeof arg.persistPasswordRecord === 'function'
        ? arg.persistPasswordRecord
        : null;
    const onWarn = typeof arg.onWarn === 'function'
        ? arg.onWarn
        : ((message) => console.warn(message));
    const authWindowMs = Number.isFinite(Number(process.env.RISU_AUTH_WINDOW_MS))
        ? Math.max(1000, Number(process.env.RISU_AUTH_WINDOW_MS))
        : 5 * 60 * 1000;
    const authLockoutMs = Number.isFinite(Number(process.env.RISU_AUTH_LOCKOUT_MS))
        ? Math.max(1000, Number(process.env.RISU_AUTH_LOCKOUT_MS))
        : 10 * 60 * 1000;
    const authMaxFailures = Number.isFinite(Number(process.env.RISU_AUTH_MAX_FAILURES))
        ? Math.max(1, Math.floor(Number(process.env.RISU_AUTH_MAX_FAILURES)))
        : 10;
    const authDuplicateFailureWindowMs = Number.isFinite(Number(process.env.RISU_AUTH_DUPLICATE_WINDOW_MS))
        ? Math.max(250, Number(process.env.RISU_AUTH_DUPLICATE_WINDOW_MS))
        : authWindowMs;
    const authFailuresByClient = new Map();
    const firstHeaderValue = (headerValue) => {
        if (typeof headerValue === 'string') return headerValue;
        if (Array.isArray(headerValue) && typeof headerValue[0] === 'string') return headerValue[0];
        return '';
    };

    function hasServerPassword() {
        const password = toStringOrEmpty(getPassword());
        return password.length > 0;
    }

    function isLegacyPasswordRecord() {
        const password = toStringOrEmpty(getPassword());
        return password.length > 0 && !password.startsWith('scrypt$');
    }

    function getAuthClientKey(req) {
        const explicitClientId = toStringOrEmpty(firstHeaderValue(req?.headers?.['x-risu-client-id']));
        if (explicitClientId) {
            return `client:${explicitClientId}`;
        }
        const trustProxy = !!(req?.app && typeof req.app.get === 'function' && req.app.get('trust proxy'));
        let ip = '';
        if (trustProxy) {
            const forwardedRaw = toStringOrEmpty(req?.headers?.['x-forwarded-for']);
            ip = forwardedRaw.split(',').map((part) => part.trim()).filter(Boolean)[0] || '';
        }
        if (!ip) {
            ip = toStringOrEmpty(req?.ip) || toStringOrEmpty(req?.socket?.remoteAddress);
        }
        const userAgent = toStringOrEmpty(req?.headers?.['user-agent']).toLowerCase().slice(0, 160) || '-';
        return `ip:${ip || 'unknown'}|ua:${userAgent}`;
    }

    function shouldCountAuthFailure(req) {
        // Count explicit user-entered attempts and invalid explicit auth headers.
        // Missing headers from passive bootstrap probes should not consume lockout budget.
        const attemptHeader = toStringOrEmpty(firstHeaderValue(req?.headers?.['x-risu-auth-attempt']));
        if (attemptHeader === '1') return true;
        const authHeader = toStringOrEmpty(req?.headers?.['risu-auth']);
        return authHeader.length > 0;
    }

    function getAuthFailureFingerprint(req) {
        const authHeader = toStringOrEmpty(req?.headers?.['risu-auth']);
        if (!authHeader) return '';
        return nodeCrypto.createHash('sha256').update(authHeader).digest('hex').slice(0, 16);
    }

    function getAuthLockInfo(req) {
        const key = getAuthClientKey(req);
        const now = Date.now();
        const entry = authFailuresByClient.get(key);
        if (!entry) {
            return { locked: false, retryAfterMs: 0 };
        }
        if (entry.lockedUntilMs > now) {
            return { locked: true, retryAfterMs: entry.lockedUntilMs - now };
        }
        if ((now - entry.firstFailureAtMs) > authWindowMs) {
            authFailuresByClient.delete(key);
        }
        return { locked: false, retryAfterMs: 0 };
    }

    function recordAuthFailure(req) {
        const key = getAuthClientKey(req);
        const now = Date.now();
        const fingerprint = getAuthFailureFingerprint(req);
        const explicitAttempt = toStringOrEmpty(firstHeaderValue(req?.headers?.['x-risu-auth-attempt'])) === '1';
        const existing = authFailuresByClient.get(key);
        if (!existing || (now - existing.firstFailureAtMs) > authWindowMs) {
            authFailuresByClient.set(key, {
                firstFailureAtMs: now,
                failures: 1,
                lockedUntilMs: 0,
                lastFailureFingerprint: fingerprint,
                lastFailureAtMs: now,
            });
            return;
        }
        if (
            !explicitAttempt &&
            fingerprint &&
            existing.lastFailureFingerprint === fingerprint &&
            (now - existing.lastFailureAtMs) < authDuplicateFailureWindowMs
        ) {
            return;
        }
        existing.failures += 1;
        existing.lastFailureFingerprint = fingerprint;
        existing.lastFailureAtMs = now;
        if (existing.failures >= authMaxFailures) {
            existing.lockedUntilMs = now + authLockoutMs;
            existing.failures = 0;
            existing.firstFailureAtMs = now;
            existing.lastFailureFingerprint = '';
            existing.lastFailureAtMs = now;
        }
    }

    function clearAuthFailures(req) {
        authFailuresByClient.delete(getAuthClientKey(req));
    }

    function parsePasswordRecord(storedRecord) {
        const raw = toStringOrEmpty(storedRecord);
        if (!raw.startsWith('scrypt$')) {
            return null;
        }
        const parts = raw.split('$');
        if (parts.length !== 3) {
            return null;
        }
        try {
            const salt = Buffer.from(parts[1], 'base64');
            const hash = Buffer.from(parts[2], 'base64');
            if (salt.length === 0 || hash.length === 0) return null;
            return { salt, hash };
        } catch {
            return null;
        }
    }

    function timingSafeEqualBuffers(a, b) {
        if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) return false;
        const maxLen = Math.max(a.length, b.length, 1);
        const left = Buffer.alloc(maxLen, 0);
        const right = Buffer.alloc(maxLen, 0);
        a.copy(left);
        b.copy(right);
        const equal = nodeCrypto.timingSafeEqual(left, right);
        return equal && a.length === b.length;
    }

    function createPasswordRecord(authToken) {
        const token = toStringOrEmpty(authToken);
        if (!token) return '';
        const salt = nodeCrypto.randomBytes(16);
        const hash = nodeCrypto.scryptSync(token, salt, 64);
        return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
    }

    function verifyPasswordToken(rawToken) {
        const storedRecord = toStringOrEmpty(getPassword());
        const token = toStringOrEmpty(rawToken);
        if (!storedRecord || !token) return false;

        const parsed = parsePasswordRecord(storedRecord);
        if (parsed) {
            const derived = nodeCrypto.scryptSync(token, parsed.salt, parsed.hash.length);
            return timingSafeEqualBuffers(derived, parsed.hash);
        }

        // Legacy mode: stored record is the previous unsalted digest/token string.
        return timingSafeEqualBuffers(
            Buffer.from(token, 'utf-8'),
            Buffer.from(storedRecord, 'utf-8')
        );
    }

    function isPasswordHeaderValid(req) {
        const authHeader = toStringOrEmpty(req?.headers?.['risu-auth']);
        const valid = verifyPasswordToken(authHeader);
        const shouldWarnAuthFailure = authHeader.length > 0 || shouldCountAuthFailure(req);
        if (valid && isLegacyPasswordRecord()) {
            if (!persistPasswordRecord) {
                onWarn('[Auth] Legacy password format detected but no persistence callback configured.');
            } else {
                try {
                    persistPasswordRecord(createPasswordRecord(authHeader));
                } catch (error) {
                    onWarn(`[Auth] Failed to auto-migrate legacy password format: ${String(error?.message || error)}`);
                }
            }
        }
        if (!valid && hasServerPassword() && shouldWarnAuthFailure) {
            onWarn(`[Auth] Header Mismatch. Received: ${authHeader ? 'present' : 'missing'}. Server has password.`);
        }
        return valid;
    }

    if (isLegacyPasswordRecord()) {
        onWarn('[Auth] Legacy password format detected; it will be migrated to scrypt on next successful auth.');
    }

    function requirePasswordAuth(req, res) {
        if (!hasServerPassword()) return true;
        const lockInfo = getAuthLockInfo(req);
        if (lockInfo.locked) {
            res.status(429).send({
                error: 'AUTH_RATE_LIMITED',
                message: 'Too many failed authentication attempts. Please try again later.',
                retryAfterMs: lockInfo.retryAfterMs,
            });
            return false;
        }
        const isValid = isPasswordHeaderValid(req);
        if (isValid) {
            clearAuthFailures(req);
            return true;
        }
        const authHeader = toStringOrEmpty(req?.headers?.['risu-auth']);
        const shouldRecordFailure = shouldCountAuthFailure(req);
        const shouldWarnAuthFailure = authHeader.length > 0 || shouldRecordFailure;
        if (shouldRecordFailure) {
            recordAuthFailure(req);
        }
        if (shouldWarnAuthFailure) {
            onWarn(`[Auth] Password check failed. Header present: ${!!req?.headers?.['risu-auth']}`);
        }
        res.status(401).send({
            error: 'UNAUTHORIZED',
            message: 'Password incorrect or missing.',
        });
        return false;
    }

    return {
        hasServerPassword,
        isPasswordHeaderValid,
        verifyPasswordToken,
        createPasswordRecord,
        getAuthLockInfo,
        recordAuthFailure,
        clearAuthFailures,
        requirePasswordAuth,
    };
}

module.exports = {
    toStringOrEmpty,
    safeJsonClone,
    sendJson,
    sendSSE,
    getReqIdFromResponse,
    isSafePathSegment,
    requireSafeSegment,
    getDataResourceId,
    createAppendLLMAudit,
    createPasswordAuthHelpers,
};
