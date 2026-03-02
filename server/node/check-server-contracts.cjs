'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs/promises');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const request = require('supertest');

const PASSWORD = 'contract-test-password';

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const info = server.address();
            const port = typeof info === 'object' && info ? info.port : null;
            server.close((closeError) => {
                if (closeError) {
                    reject(closeError);
                    return;
                }
                if (!port) {
                    reject(new Error('Failed to acquire free TCP port.'));
                    return;
                }
                resolve(port);
            });
        });
    });
}

function listenHttp(server, port) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
    });
}

function closeHttp(server) {
    return new Promise((resolve) => {
        if (!server || !server.listening) {
            resolve();
            return;
        }
        server.close(() => resolve());
    });
}

async function waitForServer(baseUrl, logRef) {
    const api = request(baseUrl);
    const deadline = Date.now() + 20000;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            const response = await api.get('/data/auth/password/status');
            if (response.status >= 200 && response.status < 500) return;
        } catch (error) {
            lastError = error;
        }
        await sleep(200);
    }
    const tail = logRef.value.slice(-4000);
    throw new Error(
        `Timed out waiting for server startup. Last error: ${String(lastError?.message || lastError || 'n/a')}\n` +
        `--- server log tail ---\n${tail}`
    );
}

function stopChild(child) {
    return new Promise((resolve) => {
        if (!child || child.exitCode !== null || child.killed) {
            resolve();
            return;
        }
        child.once('exit', () => resolve());
        child.kill('SIGTERM');
        setTimeout(() => {
            if (child.exitCode === null) {
                child.kill('SIGKILL');
            }
        }, 2000).unref();
    });
}

async function runContracts() {
    const projectRoot = path.join(__dirname, '..', '..');
    const serverScriptPath = path.join(projectRoot, 'server', 'node', 'server.cjs');
    const port = await getFreePort();
    const upstreamPort = await getFreePort();
    const dataRoot = path.join(
        os.tmpdir(),
        `risu-server-contracts-${Date.now()}-${Math.random().toString(16).slice(2)}`
    );

    await fs.mkdir(dataRoot, { recursive: true });

    const observed = {
        headers: null,
        method: null,
        url: null,
    };
    const upstream = http.createServer((req, res) => {
        observed.headers = req.headers;
        observed.method = req.method;
        observed.url = req.url;
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
    });
    await listenHttp(upstream, upstreamPort);

    const serverLogs = { value: '' };
    const appServer = spawn(process.execPath, [serverScriptPath], {
        cwd: projectRoot,
        env: {
            ...process.env,
            PORT: String(port),
            SERE_DATA_ROOT: dataRoot,
            RISU_PROXY_ALLOWED_HOSTS: `127.0.0.1:${upstreamPort},localhost:${upstreamPort}`,
            RISU_AUTH_MAX_FAILURES: '2',
            RISU_AUTH_WINDOW_MS: '60000',
            RISU_AUTH_LOCKOUT_MS: '30000',
            RISU_AUTH_DUPLICATE_WINDOW_MS: '60000',
            RISU_AUTH_CRYPTO_RATE_MAX: '3',
            RISU_AUTH_CRYPTO_RATE_WINDOW_MS: '60000',
            RISU_HTTP_JSON_LIMIT: '32kb',
            RISU_RAG_INGEST_JSON_LIMIT: '128kb',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    appServer.stdout.on('data', (chunk) => {
        serverLogs.value += chunk.toString();
    });
    appServer.stderr.on('data', (chunk) => {
        serverLogs.value += chunk.toString();
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const api = request(baseUrl);

    try {
        await waitForServer(baseUrl, serverLogs);

        const setPassword = await api
            .post('/data/auth/password')
            .send({ password: PASSWORD });
        if (setPassword.status !== 200) {
            throw new Error(`Expected password bootstrap 200, got ${setPassword.status}. Body=${JSON.stringify(setPassword.body)}`);
        }

        await api
            .post('/data/auth/crypto')
            .send({ data: 'probe' })
            .expect(401);

        for (let i = 0; i < 3; i += 1) {
            await api
                .post('/data/auth/crypto')
                .set('risu-auth', PASSWORD)
                .send({ data: `probe-${i}` })
                .expect(200);
        }
        const hashRateLimited = await api
            .post('/data/auth/crypto')
            .set('risu-auth', PASSWORD)
            .send({ data: 'probe-over' })
            .expect(429);
        if (hashRateLimited.body?.error !== 'TOO_MANY_REQUESTS') {
            throw new Error(`Expected TOO_MANY_REQUESTS from /data/auth/crypto, got ${JSON.stringify(hashRateLimited.body)}`);
        }

        // Keep LLM preview contracts deterministic by ensuring settings.json exists.
        await fs.writeFile(
            path.join(dataRoot, 'settings.json'),
            JSON.stringify({
                version: 1,
                data: {
                    customModels: [
                        {
                            id: 'xcustom:::contract-private',
                            name: 'Contract Private Target',
                            url: 'http://127.0.0.1:18080/v1/chat/completions',
                            key: '',
                            params: '',
                        },
                    ],
                },
            }, null, 2),
            'utf-8'
        );

        // Route-scoped parser should allow auth rejection before any heavy JSON parse.
        await api
            .post('/data/rag/ingest')
            .send({
                name: 'unauthorized-probe.txt',
                base64: '',
                payloadPadding: 'x'.repeat(96 * 1024),
            })
            .expect(401);
        await api
            .post('/data/rag/ingest/')
            .send({
                name: 'unauthorized-probe-slash.txt',
                base64: '',
                payloadPadding: 'x'.repeat(96 * 1024),
            })
            .expect(401);

        await api
            .get('/data/settings')
            .expect(401);

        for (let i = 0; i < 5; i++) {
            await api
                .get('/data/settings')
                .set('risu-auth', 'wrong-password')
                .expect(401);
        }

        const authSettings = await api
            .get('/data/settings')
            .set('risu-auth', PASSWORD);
        if (![200, 404].includes(authSettings.status)) {
            throw new Error(`Expected authenticated /data/settings to be 200 or 404, got ${authSettings.status}.`);
        }

        const oauthMissingState = await api
            .get('/data/oauth/callback?code=test-code')
            .expect(400);
        if (oauthMissingState.body?.error !== 'code and state are required') {
            throw new Error(`Expected missing oauth state 400, got ${JSON.stringify(oauthMissingState.body)}`);
        }
        const oauthUnknownState = await api
            .get('/data/oauth/callback?code=test-code&state=unknown-state')
            .expect(400);
        if (oauthUnknownState.body?.error !== 'invalid or expired oauth state') {
            throw new Error(`Expected invalid oauth state rejection, got ${JSON.stringify(oauthUnknownState.body)}`);
        }

        // Explicit auth attempts should consume lockout budget while passive stale
        // background requests should not.
        await api
            .get('/data/settings')
            .set('risu-auth', 'wrong-password')
            .set('x-risu-client-id', 'lockout-probe')
            .set('x-risu-auth-attempt', '1')
            .expect(401);
        await api
            .get('/data/settings')
            .set('risu-auth', 'wrong-password')
            .set('x-risu-client-id', 'lockout-probe')
            .set('x-risu-auth-attempt', '1')
            .expect(401);
        const lockedAttempt = await api
            .get('/data/settings')
            .set('risu-auth', 'wrong-password')
            .set('x-risu-client-id', 'lockout-probe')
            .set('x-risu-auth-attempt', '1')
            .expect(429);
        if (!Number.isFinite(Number(lockedAttempt.body?.retryAfterMs))) {
            throw new Error(`Expected retryAfterMs on lockout response, got ${JSON.stringify(lockedAttempt.body)}`);
        }

        const created = await api
            .post('/data/characters')
            .set('risu-auth', PASSWORD)
            .send({ character: { name: 'Contracts' } })
            .expect(201);
        const charId = created.body?.character?.chaId || created.body?.data?.chaId;
        if (!charId) {
            throw new Error(`Character creation did not return chaId. Body=${JSON.stringify(created.body)}`);
        }

        await api
            .put(`/data/characters/${encodeURIComponent(charId)}`)
            .set('risu-auth', PASSWORD)
            .send({ character: { name: 'No If-Match' } })
            .expect(412);

        const fetched = await api
            .get(`/data/characters/${encodeURIComponent(charId)}`)
            .set('risu-auth', PASSWORD)
            .expect(200);
        const etag = fetched.headers.etag;
        if (!etag) {
            throw new Error('Expected ETag on GET /data/characters/:id response.');
        }

        await api
            .put(`/data/characters/${encodeURIComponent(charId)}`)
            .set('risu-auth', PASSWORD)
            .set('If-Match', etag)
            .send({ character: { chaId: charId, name: 'Updated With ETag' } })
            .expect(200);

        await api
            .put(`/data/characters/${encodeURIComponent(charId)}`)
            .set('risu-auth', PASSWORD)
            .set('If-Match', etag)
            .send({ character: { chaId: charId, name: 'Stale ETag Update' } })
            .expect(409);

        const underLimitInvalidMode = await api
            .post('/data/llm/preview')
            .set('risu-auth', PASSWORD)
            .send({
                mode: 'invalid_mode',
                provider: 'openai',
                payloadPadding: 'x'.repeat(8 * 1024),
            })
            .expect(400);
        if (underLimitInvalidMode.body?.error !== 'INVALID_MODE') {
            throw new Error(`Expected INVALID_MODE for under-limit payload, got ${JSON.stringify(underLimitInvalidMode.body)}`);
        }

        await api
            .post('/data/llm/preview')
            .set('risu-auth', PASSWORD)
            .send({
                mode: 'invalid_mode',
                provider: 'openai',
                payloadPadding: 'x'.repeat(96 * 1024),
            })
            .expect(413);

        const ragUnderScopedLimit = await api
            .post('/data/rag/ingest')
            .set('risu-auth', PASSWORD)
            .send({
                name: 'scoped-limit-probe.txt',
                base64: '',
                payloadPadding: 'x'.repeat(96 * 1024),
            })
            .expect(400);
        if (!String(ragUnderScopedLimit.body?.error || '').includes('name and base64')) {
            throw new Error(`Expected route-level validation error from /data/rag/ingest, got ${JSON.stringify(ragUnderScopedLimit.body)}`);
        }

        const ragUnderScopedLimitTrailingSlash = await api
            .post('/data/rag/ingest/')
            .set('risu-auth', PASSWORD)
            .send({
                name: 'scoped-limit-probe-slash.txt',
                base64: '',
                payloadPadding: 'x'.repeat(96 * 1024),
            })
            .expect(400);
        if (!String(ragUnderScopedLimitTrailingSlash.body?.error || '').includes('name and base64')) {
            throw new Error(
                'Expected route-level validation error from /data/rag/ingest/ (trailing slash), ' +
                `got ${JSON.stringify(ragUnderScopedLimitTrailingSlash.body)}`
            );
        }

        await api
            .post('/data/rag/ingest')
            .set('risu-auth', PASSWORD)
            .send({
                name: 'scoped-limit-overflow.txt',
                base64: '',
                payloadPadding: 'x'.repeat(192 * 1024),
            })
            .expect(413);
        await api
            .post('/data/rag/ingest/')
            .set('risu-auth', PASSWORD)
            .send({
                name: 'scoped-limit-overflow-slash.txt',
                base64: '',
                payloadPadding: 'x'.repeat(192 * 1024),
            })
            .expect(413);

        const invalidLlmMode = await api
            .post('/data/llm/preview')
            .set('risu-auth', PASSWORD)
            .send({
                mode: 'invalid_mode',
                provider: 'openai',
            })
            .expect(400);
        if (invalidLlmMode.body?.error !== 'INVALID_MODE') {
            throw new Error(`Expected INVALID_MODE from /data/llm/preview, got ${JSON.stringify(invalidLlmMode.body)}`);
        }

        const unsupportedStreaming = await api
            .post('/data/llm/preview')
            .set('risu-auth', PASSWORD)
            .send({
                mode: 'model',
                provider: 'cohere',
                streaming: true,
            })
            .expect(400);
        if (unsupportedStreaming.body?.error !== 'STREAMING_NOT_SUPPORTED') {
            throw new Error(`Expected STREAMING_NOT_SUPPORTED from /data/llm/preview, got ${JSON.stringify(unsupportedStreaming.body)}`);
        }

        const reverseProxyPrivateTarget = await api
            .post('/data/llm/preview')
            .set('risu-auth', PASSWORD)
            .send({
                mode: 'model',
                provider: 'reverse_proxy',
                request: {
                    requestBody: {
                        model: 'gpt-4o-mini',
                        messages: [{ role: 'user', content: 'ssrf contract probe' }],
                        reverse_proxy_url: 'http://127.0.0.1:8080/v1/chat/completions',
                    },
                },
            })
            .expect(403);
        if (reverseProxyPrivateTarget.body?.error !== 'REVERSE_PROXY_TARGET_FORBIDDEN') {
            throw new Error(
                'Expected REVERSE_PROXY_TARGET_FORBIDDEN from /data/llm/preview reverse_proxy private target, ' +
                `got ${JSON.stringify(reverseProxyPrivateTarget.body)}`
            );
        }

        const customPrivateTarget = await api
            .post('/data/llm/preview')
            .set('risu-auth', PASSWORD)
            .send({
                mode: 'model',
                provider: 'custom',
                request: {
                    customModelId: 'xcustom:::contract-private',
                    requestBody: {
                        model: 'xcustom:::contract-private',
                        messages: [{ role: 'user', content: 'ssrf custom contract probe' }],
                    },
                },
            })
            .expect(403);
        if (customPrivateTarget.body?.error !== 'CUSTOM_MODEL_TARGET_FORBIDDEN') {
            throw new Error(
                'Expected CUSTOM_MODEL_TARGET_FORBIDDEN from /data/llm/preview custom private target, ' +
                `got ${JSON.stringify(customPrivateTarget.body)}`
            );
        }

        await api
            .post('/data/rag/search')
            .set('risu-auth', PASSWORD)
            .send({
                query: '',
                bookIds: [],
            })
            .expect(400);
        const ragUnsafeBookId = await api
            .post('/data/rag/search')
            .set('risu-auth', PASSWORD)
            .send({
                query: 'probe',
                bookIds: ['../../settings'],
            })
            .expect(400);
        if (ragUnsafeBookId.body?.error !== 'INVALID_REQUEST') {
            throw new Error(`Expected INVALID_REQUEST for unsafe bookIds, got ${JSON.stringify(ragUnsafeBookId.body)}`);
        }

        const tinyIngest = await api
            .post('/data/rag/ingest')
            .set('risu-auth', PASSWORD)
            .send({
                name: 'streaming-contract.txt',
                // Intentionally whitespace-only so chunking can produce 0 chunks and
                // avoid embedding model startup in this contract check.
                base64: Buffer.from(' ', 'utf-8').toString('base64'),
            })
            .expect(200);
        if (!String(tinyIngest.text || '').includes('"status":"error"')) {
            throw new Error(
                'Expected /data/rag/ingest to emit terminal error event for zero-content ingest, ' +
                `got body=${JSON.stringify(tinyIngest.text)}`
            );
        }
        if (!String(tinyIngest.text || '').includes('No usable text could be extracted')) {
            throw new Error(
                'Expected /data/rag/ingest zero-content ingest error reason, ' +
                `got body=${JSON.stringify(tinyIngest.text)}`
            );
        }

        const ragRulebooksDir = path.join(dataRoot, 'rag', 'rulebooks');
        await fs.mkdir(ragRulebooksDir, { recursive: true });
        const ragRulebookId = `contract-rag-${Date.now()}`;
        const ragRulebookPath = path.join(ragRulebooksDir, `${ragRulebookId}.json`);
        await fs.writeFile(ragRulebookPath, JSON.stringify({
            id: ragRulebookId,
            name: 'Contract Rulebook',
            metadata: { system: 'contract', edition: '1' },
            priority: 0,
            embeddingModel: 'MiniLM',
            chunks: [],
            chunkCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        }, null, 2));

        const missingIfMatch = await api
            .patch(`/data/rag/rulebooks/${encodeURIComponent(ragRulebookId)}`)
            .set('risu-auth', PASSWORD)
            .send({ name: 'Missing If-Match' })
            .expect(412);
        if (missingIfMatch.body?.error !== 'PRECONDITION_REQUIRED') {
            throw new Error(`Expected PRECONDITION_REQUIRED when If-Match is missing, got ${JSON.stringify(missingIfMatch.body)}`);
        }

        await api
            .patch(`/data/rag/rulebooks/${encodeURIComponent(ragRulebookId)}`)
            .set('risu-auth', PASSWORD)
            .set('If-Match', '*')
            .send({ name: 'Wildcard If-Match' })
            .expect(412);

        const staleUpdate = await api
            .patch(`/data/rag/rulebooks/${encodeURIComponent(ragRulebookId)}`)
            .set('risu-auth', PASSWORD)
            .set('If-Match', '"stale-etag"')
            .send({ name: 'Stale If-Match' })
            .expect(409);
        if (staleUpdate.body?.error !== 'ETAG_MISMATCH') {
            throw new Error(`Expected ETAG_MISMATCH for stale RAG update, got ${JSON.stringify(staleUpdate.body)}`);
        }
        const ragEtag = staleUpdate.headers.etag;
        if (!ragEtag) {
            throw new Error('Expected ETag header on stale RAG update response.');
        }

        const validUpdate = await api
            .patch(`/data/rag/rulebooks/${encodeURIComponent(ragRulebookId)}`)
            .set('risu-auth', PASSWORD)
            .set('If-Match', ragEtag)
            .send({
                name: 'Contract Rulebook Updated',
                metadata: { edition: '2' },
                priority: 3,
            })
            .expect(200);
        if (validUpdate.body?.name !== 'Contract Rulebook Updated') {
            throw new Error(`Expected updated rulebook name, got ${JSON.stringify(validUpdate.body)}`);
        }
        if (!validUpdate.headers.etag || validUpdate.headers.etag === ragEtag) {
            throw new Error(
                `Expected fresh ETag after valid RAG update. before=${ragEtag} after=${validUpdate.headers.etag || '<missing>'}`
            );
        }

        observed.headers = null;
        await api
            .get('/data/proxy')
            .set('risu-auth', PASSWORD)
            .set('risu-url', encodeURIComponent(`http://127.0.0.1:${upstreamPort}/probe`))
            .set(
                'risu-header',
                encodeURIComponent(JSON.stringify({
                    'x-contract-probe': 'ok',
                    'risu-auth': 'must-not-forward',
                }))
            )
            .expect(200);

        if (!observed.headers) {
            throw new Error('Proxy contract failed: upstream did not receive request.');
        }
        if (Object.prototype.hasOwnProperty.call(observed.headers, 'risu-auth')) {
            throw new Error('Proxy contract failed: risu-auth header leaked to upstream.');
        }
        if (observed.headers['x-contract-probe'] !== 'ok') {
            throw new Error('Proxy contract failed: expected x-contract-probe header was not forwarded.');
        }

        console.log('✓ check-server-contracts: runtime contracts pass');
    } finally {
        await stopChild(appServer);
        await closeHttp(upstream);
        await fs.rm(dataRoot, { recursive: true, force: true });
    }
}

runContracts().catch((error) => {
    console.error(`\n✗ check-server-contracts failed:\n${String(error?.stack || error)}`);
    process.exit(1);
});
