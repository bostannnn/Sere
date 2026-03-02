function createServerRuntimeHelpers(arg = {}) {
    const app = arg.app;
    const path = arg.path;
    const fs = arg.fs;
    const https = arg.https;
    const sslPath = arg.sslPath;

    if (!app || typeof app.use !== 'function' || typeof app.listen !== 'function') {
        throw new Error('createServerRuntimeHelpers requires an Express app instance.');
    }

    function installGlobalErrorHandler() {
        app.use((err, req, res, next) => {
            console.error(`[ServerError] ${req.method} ${req.originalUrl}:`, err);
            if (res.headersSent) {
                return next(err);
            }
            if (err?.type === 'entity.too.large') {
                return res.status(413).send({ error: 'Payload too large. The rulebook is too big for the current server limit.' });
            }
            return res.status(500).send({ error: 'Internal Server Error' });
        });
    }

    async function getHttpsOptions() {
        const keyPath = path.join(sslPath, 'server.key');
        const certPath = path.join(sslPath, 'server.crt');

        try {
            await fs.access(keyPath);
            await fs.access(certPath);

            const [key, cert] = await Promise.all([
                fs.readFile(keyPath),
                fs.readFile(certPath),
            ]);

            return { key, cert };
        } catch (error) {
            console.error('[Server] SSL setup errors:', error?.message || error);
            console.log('[Server] Start the server with HTTP instead of HTTPS...');
            return null;
        }
    }

    async function startServer() {
        try {
            const port = process.env.PORT || 6001;
            const httpsOptions = await getHttpsOptions();

            if (httpsOptions) {
                https.createServer(httpsOptions, app).listen(port, () => {
                    console.log('[Server] HTTPS server is running.');
                    console.log(`[Server] https://localhost:${port}/`);
                });
            } else {
                app.listen(port, () => {
                    console.log('[Server] HTTP server is running.');
                    console.log(`[Server] http://localhost:${port}/`);
                });
            }
        } catch (error) {
            console.error('[Server] Failed to start server :', error);
            process.exit(1);
        }
    }

    return {
        installGlobalErrorHandler,
        getHttpsOptions,
        startServer,
    };
}

module.exports = {
    createServerRuntimeHelpers,
};
