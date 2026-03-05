function registerStateRoutes(arg = {}) {
    const {
        app,
        sendJson,
        snapshotService,
        commandService,
    } = arg;

    if (!app || typeof app.get !== 'function' || typeof app.post !== 'function') {
        throw new Error('registerStateRoutes requires an Express app instance.');
    }
    if (!snapshotService || typeof snapshotService.buildSnapshot !== 'function') {
        throw new Error('registerStateRoutes requires snapshotService.buildSnapshot');
    }
    if (!commandService || typeof commandService.applyCommands !== 'function') {
        throw new Error('registerStateRoutes requires commandService.applyCommands');
    }

    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[StateRoutes] ${routeLabel} failed:`, error);
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

    app.get('/data/state/snapshot', withAsyncRoute('GET /data/state/snapshot', async (_req, res) => {
        const snapshot = await snapshotService.buildSnapshot();
        sendJson(res, 200, snapshot);
    }));

    app.post('/data/state/commands', withAsyncRoute('POST /data/state/commands', async (req, res) => {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const result = await commandService.applyCommands(body);
        sendJson(res, result.ok ? 200 : 409, result);
    }));
}

module.exports = {
    registerStateRoutes,
};
