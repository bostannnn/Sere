function registerStorageRoutes(arg = {}) {
    const {
        app,
        path,
        fs,
        existsSync,
        crypto,
        dataDirs,
        readJsonWithEtag,
        writeJsonWithEtag,
        requireIfMatch,
        isIfMatchAny,
        sendConflict,
        sendJson,
        requireSafeSegment,
        ensureDir,
    } = arg;
    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[StorageRoutes] ${routeLabel} failed:`, error);
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
    const REDACTED_SECRET_VALUE = '[REDACTED_SECRET_STORED_ON_SERVER]';
    const LEGACY_REDACTED_SECRET_VALUES = new Set([
        '[REDACTED]',
        REDACTED_SECRET_VALUE,
    ]);
    const sensitiveLeafKeys = new Set([
        'openaikey',
        'openrouterkey',
        'claudeapikey',
        'mistralkey',
        'cohereapikey',
        'googlecloudkey',
        'proxykey',
        'mancerheader',
        'novellistapi',
        'elevenlabkey',
        'accesstoken',
        'refreshtoken',
        'clientsecret',
        'privatekey',
        'apikey',
        'token',
    ]);

    const isSensitiveSettingsValue = (pathParts, key) => {
        const keyLower = String(key || '').toLowerCase();
        if (pathParts.includes('oaicompapikeys')) {
            return true;
        }
        if (sensitiveLeafKeys.has(keyLower)) {
            return true;
        }
        if (keyLower === 'key' && pathParts.includes('custommodels')) {
            return true;
        }
        return false;
    };

    const normalizeSensitiveValue = (value) => {
        if (typeof value === 'string' && LEGACY_REDACTED_SECRET_VALUES.has(value)) {
            return '';
        }
        return value;
    };

    const shouldRedactSensitiveValue = (value) => {
        const normalized = normalizeSensitiveValue(value);
        if (typeof normalized === 'string') {
            return normalized.trim().length > 0;
        }
        if (normalized === null || normalized === undefined) {
            return false;
        }
        if (Array.isArray(normalized)) {
            return normalized.length > 0;
        }
        if (typeof normalized === 'object') {
            return Object.keys(normalized).length > 0;
        }
        return Boolean(normalized);
    };

    const redactSettingsSecrets = (value, pathParts = []) => {
        if (Array.isArray(value)) {
            return value.map((entry, index) => redactSettingsSecrets(entry, [...pathParts, String(index)]));
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        const out = {};
        for (const [key, entryValue] of Object.entries(value)) {
            const nextPath = [...pathParts, key.toLowerCase()];
            if (isSensitiveSettingsValue(pathParts, key)) {
                out[key] = shouldRedactSensitiveValue(entryValue)
                    ? REDACTED_SECRET_VALUE
                    : normalizeSensitiveValue(entryValue);
                continue;
            }
            out[key] = redactSettingsSecrets(entryValue, nextPath);
        }
        return out;
    };

    const restoreRedactedSecrets = (incoming, existing, pathParts = []) => {
        if (Array.isArray(incoming)) {
            return incoming.map((entry, index) =>
                restoreRedactedSecrets(entry, Array.isArray(existing) ? existing[index] : undefined, [...pathParts, String(index)])
            );
        }
        if (!incoming || typeof incoming !== 'object') {
            return incoming;
        }
        const out = { ...incoming };
        for (const [key, incomingValue] of Object.entries(out)) {
            const existingValueRaw = existing && typeof existing === 'object' ? existing[key] : undefined;
            const existingValue = normalizeSensitiveValue(existingValueRaw);
            if (isSensitiveSettingsValue(pathParts, key)) {
                if (LEGACY_REDACTED_SECRET_VALUES.has(incomingValue) && existingValue !== undefined) {
                    out[key] = existingValue;
                } else {
                    out[key] = normalizeSensitiveValue(incomingValue);
                }
                continue;
            }
            out[key] = restoreRedactedSecrets(incomingValue, existingValue, [...pathParts, key.toLowerCase()]);
        }
        return out;
    };

    app.get('/data/settings', withAsyncRoute('GET /data/settings', async (req, res) => {
        const settingsPath = path.join(dataDirs.root, 'settings.json');
        if (!existsSync(settingsPath)) {
            sendJson(res, 404, { error: 'NOT_FOUND' });
            return;
        }
        const { json, etag } = await readJsonWithEtag(settingsPath);
        sendJson(res, 200, redactSettingsSecrets(json), etag);
    }));

    app.put('/data/settings', withAsyncRoute('PUT /data/settings', async (req, res) => {
        const settingsPath = path.join(dataDirs.root, 'settings.json');
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        let existingSettings = null;
        if (existsSync(settingsPath)) {
            if (isIfMatchAny(ifMatch)) {
                res.status(412).send({
                    error: 'PRECONDITION_REQUIRED',
                    message: 'If-Match must be a valid ETag when resource exists.',
                });
                return;
            }
            const { json, etag } = await readJsonWithEtag(settingsPath);
            existingSettings = json;
            if (etag !== ifMatch) {
                res.locals.conflictReason = 'ETAG_MISMATCH';
                sendJson(res, 409, {
                    error: 'ETAG_MISMATCH',
                    message: 'Stale write rejected. Fetch latest and retry.',
                    latest: redactSettingsSecrets(json),
                }, etag);
                return;
            }
        }
        const incomingBody = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
        const mergedBody = restoreRedactedSecrets(incomingBody, existingSettings || {});
        const { json, etag } = await writeJsonWithEtag(settingsPath, mergedBody);
        res.setHeader('ETag', etag);
        res.send(redactSettingsSecrets(json));
    }));

    app.get('/data/characters', withAsyncRoute('GET /data/characters', async (req, res) => {
        const entries = await fs.readdir(dataDirs.characters, { withFileTypes: true });
        const items = [];
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const charId = entry.name;
            const charPath = path.join(dataDirs.characters, charId, 'character.json');
            if (!existsSync(charPath)) continue;
            try {
                const { json } = await readJsonWithEtag(charPath);
                const character = json.character || json.data || {};
                items.push({
                    id: charId,
                    name: character.name || charId,
                    updatedAt: json.updatedAt || 0,
                });
            } catch (error) {
                console.warn(`[StorageRoutes] Failed to read character metadata for ${charId}`, error);
                items.push({ id: charId, name: charId, updatedAt: 0 });
            }
        }
        sendJson(res, 200, items);
    }));

    app.post('/data/characters', withAsyncRoute('POST /data/characters', async (req, res) => {
        const body = req.body || {};
        const character = body.character || body.data || {};
        const charId = character.chaId || crypto.randomUUID();
        const safeCharId = requireSafeSegment(res, charId, 'character id');
        if (!safeCharId) return;
        if (body.character) body.character.chaId = safeCharId;
        if (body.data) body.data.chaId = safeCharId;
        const charDir = path.join(dataDirs.characters, safeCharId);
        await ensureDir(charDir);
        const charPath = path.join(charDir, 'character.json');
        if (existsSync(charPath)) {
            res.locals.conflictReason = 'ALREADY_EXISTS';
            res.status(409).send({ error: 'ALREADY_EXISTS' });
            return;
        }
        const { json, etag } = await writeJsonWithEtag(charPath, body);
        res.setHeader('ETag', etag);
        res.status(201).send(json);
    }));

    app.get('/data/characters/:id', withAsyncRoute('GET /data/characters/:id', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const charPath = path.join(dataDirs.characters, charId, 'character.json');
        if (!existsSync(charPath)) {
            sendJson(res, 404, { error: 'NOT_FOUND' });
            return;
        }
        const { json, etag } = await readJsonWithEtag(charPath);
        sendJson(res, 200, json, etag);
    }));

    app.put('/data/characters/:id', withAsyncRoute('PUT /data/characters/:id', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const charPath = path.join(dataDirs.characters, charId, 'character.json');
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;

        if (existsSync(charPath)) {
            if (isIfMatchAny(ifMatch)) {
                res.status(412).send({
                    error: 'PRECONDITION_REQUIRED',
                    message: 'If-Match must be a valid ETag when resource exists.',
                });
                return;
            }
            const { etag: diskEtag } = await readJsonWithEtag(charPath);
            if (diskEtag !== ifMatch) {
                await sendConflict(res, charPath);
                return;
            }
        }

        await ensureDir(path.dirname(charPath));
        const { json, etag } = await writeJsonWithEtag(charPath, req.body || {});
        res.setHeader('ETag', etag);
        res.send(json);
    }));

    app.delete('/data/characters/:id', withAsyncRoute('DELETE /data/characters/:id', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const charDir = path.join(dataDirs.characters, charId);
        const charPath = path.join(charDir, 'character.json');
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (!existsSync(charPath)) {
            res.status(404).send({ error: 'NOT_FOUND' });
            return;
        }
        if (isIfMatchAny(ifMatch)) {
            res.status(412).send({
                error: 'PRECONDITION_REQUIRED',
                message: 'If-Match must be a valid ETag when resource exists.',
            });
            return;
        }
        const { etag } = await readJsonWithEtag(charPath);
        if (etag !== ifMatch) {
            await sendConflict(res, charPath);
            return;
        }
        await fs.rm(charDir, { recursive: true, force: true });
        res.status(204).end();
    }));

    app.get('/data/characters/:id/chats', withAsyncRoute('GET /data/characters/:id/chats', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const chatsDir = path.join(dataDirs.characters, charId, 'chats');
        if (!existsSync(chatsDir)) {
            sendJson(res, 200, []);
            return;
        }
        const entries = await fs.readdir(chatsDir, { withFileTypes: true });
        const items = [];
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const chatId = entry.name.replace(/\.json$/, '');
            const chatPath = path.join(chatsDir, entry.name);
            try {
                const { json } = await readJsonWithEtag(chatPath);
                const chat = json.chat || json.data || {};
                items.push({
                    id: chatId,
                    name: chat.name || chatId,
                    updatedAt: json.updatedAt || 0,
                });
            } catch (error) {
                console.warn(`[StorageRoutes] Failed to read chat metadata for ${chatId}`, error);
                items.push({ id: chatId, name: chatId, updatedAt: 0 });
            }
        }
        sendJson(res, 200, items);
    }));

    app.post('/data/characters/:id/chats', withAsyncRoute('POST /data/characters/:id/chats', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const body = req.body || {};
        const chat = body.chat || body.data || {};
        const chatId = chat.id || crypto.randomUUID();
        const safeChatId = requireSafeSegment(res, chatId, 'chat id');
        if (!safeChatId) return;
        if (body.chat) body.chat.id = safeChatId;
        if (body.data) body.data.id = safeChatId;
        const chatsDir = path.join(dataDirs.characters, charId, 'chats');
        await ensureDir(chatsDir);
        const chatPath = path.join(chatsDir, `${safeChatId}.json`);
        if (existsSync(chatPath)) {
            res.locals.conflictReason = 'ALREADY_EXISTS';
            res.status(409).send({ error: 'ALREADY_EXISTS' });
            return;
        }
        const { json, etag } = await writeJsonWithEtag(chatPath, body);
        res.setHeader('ETag', etag);
        res.status(201).send(json);
    }));

    app.get('/data/characters/:id/chats/:chatId', withAsyncRoute('GET /data/characters/:id/chats/:chatId', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const chatId = requireSafeSegment(res, req.params.chatId, 'chat id');
        if (!chatId) return;
        const chatPath = path.join(dataDirs.characters, charId, 'chats', `${chatId}.json`);
        if (!existsSync(chatPath)) {
            sendJson(res, 404, { error: 'NOT_FOUND' });
            return;
        }
        const { json, etag } = await readJsonWithEtag(chatPath);
        sendJson(res, 200, json, etag);
    }));

    app.put('/data/characters/:id/chats/:chatId', withAsyncRoute('PUT /data/characters/:id/chats/:chatId', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const chatId = requireSafeSegment(res, req.params.chatId, 'chat id');
        if (!chatId) return;
        const chatPath = path.join(dataDirs.characters, charId, 'chats', `${chatId}.json`);
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (existsSync(chatPath)) {
            if (isIfMatchAny(ifMatch)) {
                res.status(412).send({
                    error: 'PRECONDITION_REQUIRED',
                    message: 'If-Match must be a valid ETag when resource exists.',
                });
                return;
            }
            const { etag } = await readJsonWithEtag(chatPath);
            if (etag !== ifMatch) {
                await sendConflict(res, chatPath);
                return;
            }
        }
        await ensureDir(path.dirname(chatPath));
        const { json, etag } = await writeJsonWithEtag(chatPath, req.body || {});
        res.setHeader('ETag', etag);
        res.send(json);
    }));

    app.delete('/data/characters/:id/chats/:chatId', withAsyncRoute('DELETE /data/characters/:id/chats/:chatId', async (req, res) => {
        const charId = requireSafeSegment(res, req.params.id, 'character id');
        if (!charId) return;
        const chatId = requireSafeSegment(res, req.params.chatId, 'chat id');
        if (!chatId) return;
        const chatPath = path.join(dataDirs.characters, charId, 'chats', `${chatId}.json`);
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (!existsSync(chatPath)) {
            res.status(404).send({ error: 'NOT_FOUND' });
            return;
        }
        if (isIfMatchAny(ifMatch)) {
            res.status(412).send({
                error: 'PRECONDITION_REQUIRED',
                message: 'If-Match must be a valid ETag when resource exists.',
            });
            return;
        }
        const { etag } = await readJsonWithEtag(chatPath);
        if (etag !== ifMatch) {
            await sendConflict(res, chatPath);
            return;
        }
        await fs.rm(chatPath, { force: true });
        res.status(204).end();
    }));
}

module.exports = {
    registerStorageRoutes,
};
