function registerContentRoutes(arg = {}) {
    const {
        app,
        path,
        fs,
        existsSync,
        crypto,
        dataDirs,
        safeResolve,
        readJsonWithEtag,
        writeJsonWithEtag,
        requireIfMatch,
        isIfMatchAny,
        sendConflict,
        sendJson,
        requireSafeSegment,
        computeEtag,
        isSafePathSegment,
    } = arg;
    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[ContentRoutes] ${routeLabel} failed:`, error);
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

    app.post('/data/assets', withAsyncRoute('POST /data/assets', async (req, res) => {
        const folder = (req.query.folder || 'other').toString();
        const ext = (req.query.ext || '').toString().replace(/[^a-zA-Z0-9]/g, '');
        const safeFolder = ['backgrounds', 'generated', 'other'].includes(folder) ? folder : 'other';
        const rawId = (req.query.id || '').toString();
        const safeId = /^[a-zA-Z0-9_-]{6,128}$/.test(rawId) ? rawId : '';
        const id = safeId || crypto.randomUUID();
        const fileName = ext ? `${id}.${ext}` : id;
        const relPath = path.join('assets', safeFolder, fileName);
        const absPath = safeResolve(dataDirs.root, relPath);
        const buffer = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf-8');
        await fs.writeFile(absPath, buffer);
        res.status(201).send({ path: relPath.replace(/\\/g, '/') });
    }));

    app.get('/data/assets/*', withAsyncRoute('GET /data/assets/*', async (req, res) => {
        const relPath = req.path.replace(/^\/data\//, '');
        const absPath = safeResolve(dataDirs.root, relPath);
        if (!existsSync(absPath)) {
            res.status(404).send({ error: 'NOT_FOUND' });
            return;
        }
        res.sendFile(absPath);
    }));

    app.get('/data/plugins/manifest', withAsyncRoute('GET /data/plugins/manifest', async (req, res) => {
        const manifestPath = path.join(dataDirs.plugins, 'manifest.json');
        if (!existsSync(manifestPath)) {
            sendJson(res, 404, { error: 'NOT_FOUND' });
            return;
        }
        const { json, etag } = await readJsonWithEtag(manifestPath);
        sendJson(res, 200, json, etag);
    }));

    app.put('/data/plugins/manifest', withAsyncRoute('PUT /data/plugins/manifest', async (req, res) => {
        const manifestPath = path.join(dataDirs.plugins, 'manifest.json');
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (existsSync(manifestPath)) {
            if (isIfMatchAny(ifMatch)) {
                res.status(412).send({
                    error: 'PRECONDITION_REQUIRED',
                    message: 'If-Match must be a valid ETag when resource exists.',
                });
                return;
            }
            const { etag } = await readJsonWithEtag(manifestPath);
            if (etag !== ifMatch) {
                await sendConflict(res, manifestPath);
                return;
            }
        }
        const { json, etag } = await writeJsonWithEtag(manifestPath, req.body || {});
        res.setHeader('ETag', etag);
        res.send(json);
    }));

    app.get('/data/plugins/:name', withAsyncRoute('GET /data/plugins/:name', async (req, res) => {
        const pluginName = requireSafeSegment(res, req.params.name, 'plugin name');
        if (!pluginName) return;
        const pluginPath = safeResolve(dataDirs.plugins, `${pluginName}.js`);
        if (!existsSync(pluginPath)) {
            res.status(404).send({ error: 'NOT_FOUND' });
            return;
        }
        const buf = await fs.readFile(pluginPath);
        res.setHeader('Content-Type', 'application/javascript');
        res.send(buf);
    }));

    app.put('/data/plugins/:name', withAsyncRoute('PUT /data/plugins/:name', async (req, res) => {
        const pluginName = requireSafeSegment(res, req.params.name, 'plugin name');
        if (!pluginName) return;
        const pluginPath = safeResolve(dataDirs.plugins, `${pluginName}.js`);
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (existsSync(pluginPath)) {
            if (isIfMatchAny(ifMatch)) {
                res.status(412).send({
                    error: 'PRECONDITION_REQUIRED',
                    message: 'If-Match must be a valid ETag when resource exists.',
                });
                return;
            }
            const buf = await fs.readFile(pluginPath);
            const etag = computeEtag(buf);
            if (etag !== ifMatch) {
                res.locals.conflictReason = 'ETAG_MISMATCH';
                res.status(409).send({
                    error: 'ETAG_MISMATCH',
                    message: 'Stale write rejected. Fetch latest and retry.',
                });
                return;
            }
        }
        let buffer;
        if (Buffer.isBuffer(req.body)) {
            buffer = req.body;
        } else if (typeof req.body === 'string') {
            buffer = Buffer.from(req.body, 'utf-8');
        } else if (req.body === null || req.body === undefined) {
            buffer = Buffer.from('', 'utf-8');
        } else if (typeof req.body === 'object' && typeof req.body.script === 'string') {
            buffer = Buffer.from(req.body.script, 'utf-8');
        } else {
            res.status(400).send({
                error: 'INVALID_PLUGIN_BODY',
                message: 'Plugin body must be text or an object with a string "script" field.',
            });
            return;
        }
        await fs.writeFile(pluginPath, buffer);
        res.setHeader('ETag', computeEtag(buffer));
        res.send({ ok: true });
    }));

    app.delete('/data/plugins/:name', withAsyncRoute('DELETE /data/plugins/:name', async (req, res) => {
        const pluginName = requireSafeSegment(res, req.params.name, 'plugin name');
        if (!pluginName) return;
        const pluginPath = safeResolve(dataDirs.plugins, `${pluginName}.js`);
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (!existsSync(pluginPath)) {
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
        const buf = await fs.readFile(pluginPath);
        const etag = computeEtag(buf);
        if (etag !== ifMatch) {
            res.locals.conflictReason = 'ETAG_MISMATCH';
            res.status(409).send({
                error: 'ETAG_MISMATCH',
                message: 'Stale write rejected. Fetch latest and retry.',
            });
            return;
        }
        await fs.rm(pluginPath, { force: true });
        res.status(204).end();
    }));

    app.delete('/data/plugins/by-name/:name', withAsyncRoute('DELETE /data/plugins/by-name/:name', async (req, res) => {
        const pluginName = requireSafeSegment(res, req.params.name, 'plugin name');
        if (!pluginName) return;

        const manifestPath = path.join(dataDirs.plugins, 'manifest.json');
        const ifMatch = requireIfMatch(req, res);
        if (!ifMatch) return;
        if (!existsSync(manifestPath)) {
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
        let removedEntries = [];
        let responseEtag = '';

        const { json: manifest, etag: manifestEtag } = await readJsonWithEtag(manifestPath);
        if (manifestEtag !== ifMatch) {
            await sendConflict(res, manifestPath);
            return;
        }
        const plugins = Array.isArray(manifest?.plugins) ? manifest.plugins : [];
        removedEntries = plugins.filter((p) => p && p.name === pluginName);
        if (removedEntries.length > 0) {
            const nextManifest = {
                ...manifest,
                plugins: plugins.filter((p) => !(p && p.name === pluginName)),
            };
            const { etag: nextEtag } = await writeJsonWithEtag(manifestPath, nextManifest);
            responseEtag = nextEtag;
        } else {
            responseEtag = manifestEtag;
        }

        for (const entry of removedEntries) {
            const fileId = typeof entry?.fileId === 'string' ? entry.fileId.trim() : '';
            if (!fileId || !isSafePathSegment(fileId)) continue;
            const pluginPath = safeResolve(dataDirs.plugins, `${fileId}.js`);
            await fs.rm(pluginPath, { force: true });
        }

        if (responseEtag) {
            res.setHeader('ETag', responseEtag);
        }
        res.status(200).send({
            ok: true,
            removed: removedEntries.length,
        });
    }));

    app.post('/data/plugins/log', withAsyncRoute('POST /data/plugins/log', async (req, res) => {
        try {
            const plugin = req.body?.plugin ?? 'unknown';
            const level = req.body?.level ?? 'info';
            const message = req.body?.message ?? '';
            const data = req.body?.data;
            const ts = new Date().toISOString();
            if (data !== undefined) {
                console.log(`[PluginLog] ${ts} [${level}] [${plugin}] ${message}`, data);
            } else {
                console.log(`[PluginLog] ${ts} [${level}] [${plugin}] ${message}`);
            }
            res.send({ ok: true });
        } catch (error) {
            res.status(500).send({ ok: false, error: String(error) });
        }
    }));

    const jsonResourceHandlers = (resourceDir) => {
        app.get(`/data/${resourceDir}/:id`, withAsyncRoute(`GET /data/${resourceDir}/:id`, async (req, res) => {
            const safeId = requireSafeSegment(res, req.params.id, 'resource id');
            if (!safeId) return;
            const filePath = path.join(dataDirs[resourceDir], `${safeId}.json`);
            if (!existsSync(filePath)) {
                sendJson(res, 404, { error: 'NOT_FOUND' });
                return;
            }
            const { json, etag } = await readJsonWithEtag(filePath);
            sendJson(res, 200, json, etag);
        }));

        app.put(`/data/${resourceDir}/:id`, withAsyncRoute(`PUT /data/${resourceDir}/:id`, async (req, res) => {
            const safeId = requireSafeSegment(res, req.params.id, 'resource id');
            if (!safeId) return;
            const filePath = path.join(dataDirs[resourceDir], `${safeId}.json`);
            const ifMatch = requireIfMatch(req, res);
            if (!ifMatch) return;
            if (existsSync(filePath)) {
                if (isIfMatchAny(ifMatch)) {
                    res.status(412).send({
                        error: 'PRECONDITION_REQUIRED',
                        message: 'If-Match must be a valid ETag when resource exists.',
                    });
                    return;
                }
                const { etag } = await readJsonWithEtag(filePath);
                if (etag !== ifMatch) {
                    await sendConflict(res, filePath);
                    return;
                }
            }
            const { json, etag } = await writeJsonWithEtag(filePath, req.body || {});
            res.setHeader('ETag', etag);
            res.send(json);
        }));

        app.delete(`/data/${resourceDir}/:id`, withAsyncRoute(`DELETE /data/${resourceDir}/:id`, async (req, res) => {
            const safeId = requireSafeSegment(res, req.params.id, 'resource id');
            if (!safeId) return;
            const filePath = path.join(dataDirs[resourceDir], `${safeId}.json`);
            const ifMatch = requireIfMatch(req, res);
            if (!ifMatch) return;
            if (!existsSync(filePath)) {
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
            const { etag } = await readJsonWithEtag(filePath);
            if (etag !== ifMatch) {
                await sendConflict(res, filePath);
                return;
            }
            await fs.rm(filePath, { force: true });
            res.status(204).end();
        }));
    };

    jsonResourceHandlers('prompts');
    jsonResourceHandlers('themes');
    jsonResourceHandlers('color_schemes');
}

module.exports = {
    registerContentRoutes,
};
