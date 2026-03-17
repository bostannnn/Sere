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

    function resolveStorageFolder(folder) {
        if (folder === 'character-images') {
            return path.join('characters', 'images');
        }
        if (['backgrounds', 'generated', 'other'].includes(folder)) {
            return path.join('assets', folder);
        }
        return path.join('assets', 'other');
    }

    app.post('/data/assets', withAsyncRoute('POST /data/assets', async (req, res) => {
        const folder = (req.query.folder || 'other').toString();
        const ext = (req.query.ext || '').toString().replace(/[^a-zA-Z0-9]/g, '');
        const safeFolder = ['backgrounds', 'generated', 'other', 'character-images'].includes(folder) ? folder : 'other';
        const rawId = (req.query.id || '').toString();
        const safeId = /^[a-zA-Z0-9_-]{6,128}$/.test(rawId) ? rawId : '';
        const id = safeId || crypto.randomUUID();
        const fileName = ext ? `${id}.${ext}` : id;
        const relPath = path.join(resolveStorageFolder(safeFolder), fileName);
        const absPath = safeResolve(dataDirs.root, relPath);
        const buffer = Buffer.isBuffer(req.body)
            ? req.body
            : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf-8');
        await fs.writeFile(absPath, buffer);
        res.status(201).send({ path: relPath.replace(/\\/g, '/') });
    }));

    app.post('/data/characters/:charId/images', withAsyncRoute('POST /data/characters/:charId/images', async (req, res) => {
        const safeCharId = requireSafeSegment(res, req.params.charId, 'character id');
        if (!safeCharId) return;
        const ext = (req.query.ext || '').toString().replace(/[^a-zA-Z0-9]/g, '');
        const rawId = (req.query.id || '').toString();
        const safeId = /^[a-zA-Z0-9_-]{6,128}$/.test(rawId) ? rawId : '';
        const id = safeId || crypto.randomUUID();
        const fileName = ext ? `${id}.${ext}` : id;
        const charDir = safeResolve(dataDirs.characters, safeCharId);
        const imagesDir = safeResolve(charDir, 'images');
        await fs.mkdir(imagesDir, { recursive: true });
        const absPath = safeResolve(imagesDir, fileName);
        const relPath = path.join('characters', safeCharId, 'images', fileName);
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

    app.delete('/data/assets/*', withAsyncRoute('DELETE /data/assets/*', async (req, res) => {
        const relPath = req.path.replace(/^\/data\//, '');
        const absPath = safeResolve(dataDirs.root, relPath);
        await fs.rm(absPath, { force: true });
        res.status(204).end();
    }));

    app.get('/data/characters/images/*', withAsyncRoute('GET /data/characters/images/*', async (req, res) => {
        const relPath = req.path.replace(/^\/data\//, '');
        const absPath = safeResolve(dataDirs.root, relPath);
        if (!existsSync(absPath)) {
            res.status(404).send({ error: 'NOT_FOUND' });
            return;
        }
        res.sendFile(absPath);
    }));

    app.delete('/data/characters/images/*', withAsyncRoute('DELETE /data/characters/images/*', async (req, res) => {
        const relPath = req.path.replace(/^\/data\//, '');
        const absPath = safeResolve(dataDirs.root, relPath);
        await fs.rm(absPath, { force: true });
        res.status(204).end();
    }));

    app.get('/data/characters/:charId/images/*', withAsyncRoute('GET /data/characters/:charId/images/*', async (req, res) => {
        const safeCharId = requireSafeSegment(res, req.params.charId, 'character id');
        if (!safeCharId) return;
        const relSuffix = (req.params[0] || '').toString();
        const safeName = relSuffix.split('/').pop() || '';
        if (!safeName || safeName.includes('/') || safeName.includes('\\')) {
            res.status(400).send({ error: 'INVALID_PATH' });
            return;
        }
        const charDir = safeResolve(dataDirs.characters, safeCharId);
        const imagesDir = safeResolve(charDir, 'images');
        const absPath = safeResolve(imagesDir, safeName);
        if (!existsSync(absPath)) {
            res.status(404).send({ error: 'NOT_FOUND' });
            return;
        }
        res.sendFile(absPath);
    }));

    app.delete('/data/characters/:charId/images/*', withAsyncRoute('DELETE /data/characters/:charId/images/*', async (req, res) => {
        const safeCharId = requireSafeSegment(res, req.params.charId, 'character id');
        if (!safeCharId) return;
        const relSuffix = (req.params[0] || '').toString();
        const safeName = relSuffix.split('/').pop() || '';
        if (!safeName || safeName.includes('/') || safeName.includes('\\')) {
            res.status(400).send({ error: 'INVALID_PATH' });
            return;
        }
        const charDir = safeResolve(dataDirs.characters, safeCharId);
        const imagesDir = safeResolve(charDir, 'images');
        const absPath = safeResolve(imagesDir, safeName);
        await fs.rm(absPath, { force: true });
        res.status(204).end();
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
