function createServerDataHelpers(arg = {}) {
    const app = arg.app;
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const dataDirs = arg.dataDirs || {};
    const computeEtag = typeof arg.computeEtag === 'function'
        ? arg.computeEtag
        : (() => '');
    const sendJson = typeof arg.sendJson === 'function'
        ? arg.sendJson
        : (() => {});
    const getDataResourceId = typeof arg.getDataResourceId === 'function'
        ? arg.getDataResourceId
        : (() => '-');
    const requirePasswordAuth = typeof arg.requirePasswordAuth === 'function'
        ? arg.requirePasswordAuth
        : null;

    let reqCounter = 0;

    async function ensureDir(dirPath) {
        if (!existsSync(dirPath)) {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    async function ensureDataDirs() {
        await ensureDir(dataDirs.root);
        await ensureDir(dataDirs.characters);
        await ensureDir(dataDirs.assets);
        await ensureDir(`${dataDirs.assets}/backgrounds`);
        await ensureDir(`${dataDirs.assets}/generated`);
        await ensureDir(`${dataDirs.assets}/other`);
        await ensureDir(dataDirs.prompts);
        await ensureDir(dataDirs.themes);
        await ensureDir(dataDirs.color_schemes);
        await ensureDir(dataDirs.logs);
        await ensureDir(dataDirs.ragRulebooks);
    }

    async function readJsonWithEtag(filePath) {
        const buf = await fs.readFile(filePath);
        const etag = computeEtag(buf);
        const json = JSON.parse(buf.toString('utf-8'));
        return { json, etag };
    }

    async function writeJsonWithEtag(filePath, body) {
        const payload = {
            ...body,
            version: body?.version ?? 1,
            updatedAt: Date.now(),
        };
        const buf = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');
        await fs.writeFile(filePath, buf);
        return { json: payload, etag: computeEtag(buf) };
    }

    async function sendConflict(res, filePath) {
        res.locals.conflictReason = 'ETAG_MISMATCH';
        try {
            const { json, etag } = await readJsonWithEtag(filePath);
            sendJson(res, 409, {
                error: 'ETAG_MISMATCH',
                message: 'Stale write rejected. Fetch latest and retry.',
                latest: json,
            }, etag);
        } catch {
            sendJson(res, 409, {
                error: 'ETAG_MISMATCH',
                message: 'Stale write rejected. Fetch latest and retry.',
            });
        }
    }

    function installDataApiMiddleware() {
        const publicAuthPaths = new Set([
            '/auth/crypto',
            '/auth/password',
            '/auth/password/status',
            '/oauth/callback',
        ]);

        app.use('/data', async (req, res, next) => {
            const reqId = ++reqCounter;
            const start = Date.now();
            res.setHeader('x-risu-req-id', String(reqId));
            res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.on('finish', () => {
                const durationMs = Date.now() - start;
                const ifMatch = req.headers['if-match'] || '';
                const etag = res.getHeader('ETag') || '';
                const resourceId = getDataResourceId(req);
                const conflictReason = res.locals.conflictReason || (res.statusCode === 409 ? 'UNKNOWN' : '-');
                console.log(
                    `[DataAPI] id=${reqId} ${req.method} ${req.originalUrl} status=${res.statusCode} ` +
                    `resourceId=${resourceId} if-match=${ifMatch} etag=${etag} ` +
                    `conflictReason=${conflictReason} durationMs=${durationMs}`
                );
            });

            // Global auth boundary for /data routes. Keep only bootstrap endpoints public.
            if (requirePasswordAuth) {
                const isPreflight = req.method === 'OPTIONS';
                const reqPath = typeof req.path === 'string' ? req.path : '';
                const isPublicPath = publicAuthPaths.has(reqPath);
                if (!isPreflight && !isPublicPath) {
                    if (!requirePasswordAuth(req, res)) return;
                }
            }

            try {
                await ensureDataDirs();
                next();
            } catch (error) {
                next(error);
            }
        });
    }

    return {
        ensureDir,
        ensureDataDirs,
        readJsonWithEtag,
        writeJsonWithEtag,
        sendConflict,
        installDataApiMiddleware,
    };
}

module.exports = {
    createServerDataHelpers,
};
