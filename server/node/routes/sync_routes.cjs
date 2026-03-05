function registerSyncRoutes(arg = {}) {
    const {
        app,
        eventJournal,
    } = arg;

    if (!app || typeof app.get !== 'function') {
        throw new Error('registerSyncRoutes requires an Express app instance.');
    }
    if (!eventJournal || typeof eventJournal.readEventsSince !== 'function') {
        throw new Error('registerSyncRoutes requires eventJournal.readEventsSince');
    }

    const withAsyncRoute = (routeLabel, handler) => async (req, res, next) => {
        try {
            await handler(req, res, next);
        } catch (error) {
            console.error(`[SyncRoutes] ${routeLabel} failed:`, error);
            if (res.headersSent) {
                if (typeof next === 'function') next(error);
                return;
            }
            res.status(500).send({
                error: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            });
        }
    };

    app.get('/data/sync/events', withAsyncRoute('GET /data/sync/events', async (req, res) => {
        const since = Number.isFinite(Number(req.query?.since))
            ? Number(req.query.since)
            : 0;
        let cursor = since;
        let closed = false;
        let pollTimer = null;
        let heartbeatTimer = null;
        let flushInFlight = false;
        let flushQueued = false;

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const close = () => {
            if (closed) return;
            closed = true;
            if (pollTimer) clearTimeout(pollTimer);
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        };
        req.on('aborted', close);
        req.on('close', close);
        res.on('close', close);

        const writeFrame = async (payload, eventName = 'message') => {
            if (closed || res.writableEnded || res.destroyed) return;
            const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
            if (res.write(frame)) return;
            await new Promise((resolve, reject) => {
                const onDrain = () => {
                    cleanup();
                    resolve();
                };
                const onClose = () => {
                    cleanup();
                    resolve();
                };
                const onError = (error) => {
                    cleanup();
                    reject(error);
                };
                const cleanup = () => {
                    res.off('drain', onDrain);
                    res.off('close', onClose);
                    res.off('error', onError);
                };
                res.on('drain', onDrain);
                res.on('close', onClose);
                res.on('error', onError);
            });
        };

        const flush = async () => {
            if (closed) return;
            const events = await eventJournal.readEventsSince(cursor, 500);
            if (events.length === 0) return;
            for (const event of events) {
                if (closed) return;
                await writeFrame(event, 'state-event');
                if (Number.isFinite(Number(event?.id))) {
                    cursor = Number(event.id);
                }
            }
        };

        const runFlush = async () => {
            if (closed) return;
            if (flushInFlight) {
                flushQueued = true;
                return;
            }
            flushInFlight = true;
            try {
                do {
                    flushQueued = false;
                    await flush();
                } while (flushQueued && !closed);
            } finally {
                flushInFlight = false;
            }
        };

        const scheduleNextPoll = () => {
            if (closed) return;
            pollTimer = setTimeout(() => {
                pollTimer = null;
                void runFlush()
                    .catch((error) => {
                        console.error('[SyncRoutes] poll flush failed:', error);
                    })
                    .finally(() => {
                        scheduleNextPoll();
                    });
            }, 1000);
        };

        await runFlush();
        heartbeatTimer = setInterval(() => {
            if (closed) return;
            res.write(`: heartbeat ${Date.now()}\n\n`);
        }, 15000);
        scheduleNextPoll();
    }));
}

module.exports = {
    registerSyncRoutes,
};
