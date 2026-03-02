const { resolveEmbeddingModel } = require('../rag/model.cjs');
const { createRagIngestService } = require('../rag/ingest_service.cjs');

function registerRagRoutes(arg = {}) {
    const {
        app,
        express,
        requirePasswordAuth,
        requireIfMatch,
        isIfMatchAny,
        dataDirs,
        getReqIdFromResponse,
        fs,
        computeEtag,
        getCachedRulebook,
        appendLLMAudit,
        searchRulebooks,
        generateEmbeddings,
        summarizeTextWithTransformers,
        captionImageWithTransformers,
        extractTextFromPdf,
        chunkText,
        crypto,
        path,
        ragIngestJsonLimit,
        requireSafeSegment,
        updateRulebookMetadata,
    } = arg;
    const parseRagIngestJson = (express && typeof express.json === 'function')
        ? express.json({ limit: (typeof ragIngestJsonLimit === 'string' ? ragIngestJsonLimit : '500mb') })
        : ((req, res, next) => next());
    const requireRagUploadAuth = (req, res, next) => {
        if (!requirePasswordAuth(req, res)) return;
        next();
    };
    const { ingestRulebook } = createRagIngestService({
        fs,
        path,
        crypto,
        dataDirs,
        extractTextFromPdf,
        chunkText,
        generateEmbeddings,
        appendLLMAudit,
        getReqIdFromResponse,
    });
    const ensureIfMatch = typeof requireIfMatch === 'function'
        ? requireIfMatch
        : ((req, res) => {
            const ifMatch = req.headers['if-match'];
            if (!ifMatch) {
                res.status(412).send({
                    error: 'PRECONDITION_REQUIRED',
                    message: 'If-Match is required for this operation.',
                });
                return null;
            }
            return ifMatch;
        });
    const isWildcardIfMatch = typeof isIfMatchAny === 'function'
        ? isIfMatchAny
        : ((ifMatch) => ifMatch === '*');
    const isSafePathSegment = (segment) => (
        typeof segment === 'string' &&
        segment.length > 0 &&
        segment.length <= 128 &&
        !segment.includes('/') &&
        !segment.includes('\\') &&
        !segment.includes('\0') &&
        !segment.includes('..') &&
        segment !== '.'
    );
    const normalizeRulebookId = (id) => (typeof id === 'string' ? id.trim() : '');
    const createInvalidRulebookIdError = (id) => {
        const error = new Error(`Invalid rulebook ID: ${id}`);
        error.code = 'INVALID_RULEBOOK_ID';
        return error;
    };
    const normalizeRulebookIds = (bookIds) => {
        if (!Array.isArray(bookIds)) return null;
        const normalized = [];
        for (const raw of bookIds) {
            const id = normalizeRulebookId(raw);
            if (!isSafePathSegment(id)) {
                return null;
            }
            normalized.push(id);
        }
        return normalized;
    };

    function sendRagError(res, status, error, message) {
        res.status(status).send({ error, message });
    }

    function toRulebookSummary(content) {
        return {
            id: content.id,
            name: content.name,
            metadata: content.metadata,
            chunkCount: content.chunkCount || content.chunks?.length || 0,
            thumbnail: content.thumbnail,
            priority: content.priority || 0,
            embeddingModel: content.embeddingModel || null,
        };
    }

    function isNotFoundError(error) {
        return !!(error && typeof error === 'object' && error.code === 'ENOENT');
    }

    async function readRulebookWithEtag(id) {
        if (!isSafePathSegment(id)) {
            throw createInvalidRulebookIdError(id);
        }
        const filePath = path.join(dataDirs.ragRulebooks, `${id}.json`);
        const raw = await fs.readFile(filePath);
        const content = JSON.parse(raw.toString('utf-8'));
        const etag = typeof computeEtag === 'function' ? computeEtag(raw) : '';
        return { filePath, content, etag };
    }

app.get('/data/rag/rulebooks', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    console.log(`[RAG] Listing rulebooks from ${dataDirs.ragRulebooks}...`);
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    try {
        const files = await fs.readdir(dataDirs.ragRulebooks);
        const list = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                try {
                    const bookId = file.replace('.json', '');
                    const content = await getCachedRulebook(bookId, dataDirs);
                    
                    if (!content || !content.id || !content.name) {
                        console.warn(`[RAG] Skipping invalid rulebook file: ${file}`);
                        continue;
                    }

                    list.push(toRulebookSummary(content));
                } catch (e) {
                    console.error(`[RAG] Failed to parse rulebook file ${file}:`, e.message);
                    // Continue to next file so one bad file doesn't break the whole UI
                }
            }
        }
        console.log(`[RAG] List complete. Found ${list.length} rulebook(s).`);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'list',
            status: 200,
            ok: true,
            durationMs: Date.now() - startedAt,
            response: list,
        });
        res.send(list);
    } catch (e) {
        console.error(`[RAG] Failed to list rulebooks:`, e);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'list',
            status: 500,
            ok: false,
            durationMs: Date.now() - startedAt,
            error: String(e),
        });
        sendRagError(res, 500, 'RAG_LIST_FAILED', 'Failed to list rulebooks.');
    }
});

app.post('/data/rag/search', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const { query, bookIds, topK, minScore, model } = body;
    const normalizedQuery = (typeof query === 'string') ? query.trim() : '';
    const resolvedModel = resolveEmbeddingModel(model || 'MiniLM');
    const bookCount = Array.isArray(bookIds) ? bookIds.length : 0;
    console.log(
        `[RAG] Searching ${bookCount} book(s) for query: "${normalizedQuery.substring(0, 50)}${normalizedQuery.length > 50 ? '...' : ''}" using requested=${resolvedModel.requestedKey} resolved=${resolvedModel.modelName}...`
    );
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const normalizedBookIds = normalizeRulebookIds(bookIds);
    if (!normalizedQuery || !normalizedBookIds) {
        return sendRagError(res, 400, 'INVALID_REQUEST', 'query and bookIds are required.');
    }
    try {
        const normalizedTopK = Number.isFinite(Number(topK)) ? Number(topK) : 3;
        const normalizedMinScore = Number.isFinite(Number(minScore)) ? Number(minScore) : 0.1;
        const results = await searchRulebooks(normalizedQuery, normalizedBookIds, normalizedTopK, normalizedMinScore, resolvedModel.key, dataDirs);
        console.log(`[RAG] Search complete. Retrieved ${results.length} result(s) in ${Date.now() - startedAt}ms.`);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'search',
            status: 200,
            ok: true,
            durationMs: Date.now() - startedAt,
            request: { query: normalizedQuery, bookIds: normalizedBookIds, topK: normalizedTopK, minScore: normalizedMinScore, modelRequested: resolvedModel.requestedKey, modelResolved: resolvedModel.modelName },
            response: {
                modelRequested: resolvedModel.requestedKey,
                modelResolved: resolvedModel.modelName,
                resultCount: results.length,
                results,
            },
        });
        res.send(results);
    } catch (e) {
        console.error(`[RAG] Search failed:`, e);
        if (e && typeof e === 'object' && e.code === 'INVALID_RULEBOOK_ID') {
            sendRagError(res, 400, 'INVALID_REQUEST', 'query and bookIds are required.');
            return;
        }
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'search',
            status: 500,
            ok: false,
            durationMs: Date.now() - startedAt,
            request: { query: normalizedQuery, bookIds: normalizedBookIds || bookIds, topK, minScore, modelRequested: resolvedModel.requestedKey, modelResolved: resolvedModel.modelName },
            error: String(e),
        });
        sendRagError(res, 500, 'RAG_SEARCH_FAILED', 'Failed to search rulebooks.');
    }
});

app.post('/data/embeddings', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const rawInput = body.input ?? body.inputs;
    const model = typeof body.model === 'string' ? body.model : 'MiniLM';
    const resolvedModel = resolveEmbeddingModel(model);

    let inputs = [];
    if (typeof rawInput === 'string') {
        inputs = [rawInput];
    } else if (Array.isArray(rawInput)) {
        inputs = rawInput.filter((value) => typeof value === 'string');
    }

    if (inputs.length === 0) {
        sendRagError(res, 400, 'INVALID_REQUEST', 'input is required and must be a string or string[]');
        return;
    }
    if (inputs.length > 200) {
        sendRagError(res, 400, 'INVALID_REQUEST', 'input supports at most 200 items per request');
        return;
    }

    try {
        const vectors = await generateEmbeddings(inputs, resolvedModel.key);
        const responsePayload = {
            vectors,
            modelRequested: resolvedModel.requestedKey,
            modelResolved: resolvedModel.modelName,
        };
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'embed',
            status: 200,
            ok: true,
            durationMs: Date.now() - startedAt,
            request: {
                modelRequested: resolvedModel.requestedKey,
                modelResolved: resolvedModel.modelName,
                inputCount: inputs.length,
            },
            response: {
                modelRequested: resolvedModel.requestedKey,
                modelResolved: resolvedModel.modelName,
                vectorCount: Array.isArray(vectors) ? vectors.length : 0,
            },
        });
        res.send(responsePayload);
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('[RAG] Embedding generation failed:', e);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'embed',
            status: 500,
            ok: false,
            durationMs: Date.now() - startedAt,
            request: {
                modelRequested: resolvedModel.requestedKey,
                modelResolved: resolvedModel.modelName,
                inputCount: inputs.length,
            },
            error: errorMsg,
        });
        sendRagError(res, 500, 'EMBEDDING_GENERATION_FAILED', 'Failed to generate embeddings.');
    }
});

app.post('/data/transformers/summarize', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const text = typeof body.text === 'string' ? body.text : '';
    const normalizedText = text.trim();

    if (!normalizedText) {
        sendRagError(res, 400, 'INVALID_REQUEST', 'text is required');
        return;
    }
    if (normalizedText.length > 200000) {
        sendRagError(res, 400, 'INVALID_REQUEST', 'text is too long (max 200000 chars)');
        return;
    }

    try {
        const summary = await summarizeTextWithTransformers(normalizedText);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'transformers',
            mode: 'summarize',
            status: 200,
            ok: true,
            durationMs: Date.now() - startedAt,
            request: {
                inputChars: normalizedText.length,
            },
            response: {
                outputChars: summary.length,
            },
        });
        res.send({ summary });
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('[RAG] Transformer summarize failed:', e);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'transformers',
            mode: 'summarize',
            status: 500,
            ok: false,
            durationMs: Date.now() - startedAt,
            request: {
                inputChars: normalizedText.length,
            },
            error: errorMsg,
        });
        sendRagError(res, 500, 'TRANSFORMER_SUMMARY_FAILED', 'Failed to summarize text.');
    }
});

app.post('/data/transformers/image-caption', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const dataUrl = typeof body.dataUrl === 'string' ? body.dataUrl : '';
    const normalizedDataUrl = dataUrl.trim();

    if (!normalizedDataUrl) {
        sendRagError(res, 400, 'INVALID_REQUEST', 'dataUrl is required');
        return;
    }
    if (normalizedDataUrl.length > 15_000_000) {
        sendRagError(res, 400, 'INVALID_REQUEST', 'dataUrl is too large (max 15MB string length)');
        return;
    }

    try {
        const output = await captionImageWithTransformers(normalizedDataUrl);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'transformers',
            mode: 'image-caption',
            status: 200,
            ok: true,
            durationMs: Date.now() - startedAt,
            request: {
                inputChars: normalizedDataUrl.length,
            },
            response: {
                output,
            },
        });
        res.send({ output });
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('[RAG] Transformer image caption failed:', e);
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'transformers',
            mode: 'image-caption',
            status: 500,
            ok: false,
            durationMs: Date.now() - startedAt,
            request: {
                inputChars: normalizedDataUrl.length,
            },
            error: errorMsg,
        });
        sendRagError(res, 500, 'IMAGE_CAPTION_FAILED', 'Failed to generate image caption.');
    }
});

app.post('/data/rag/ingest', requireRagUploadAuth, parseRagIngestJson, ingestRulebook);

app.patch('/data/rag/rulebooks/:id', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const id = requireSafeSegment(res, req.params.id, 'rulebook id');
    if (!id) return;
    const ifMatch = ensureIfMatch(req, res);
    if (!ifMatch) return;
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : {};
    const { name, metadata, priority } = body;

    try {
        const current = await readRulebookWithEtag(id);
        if (isWildcardIfMatch(ifMatch)) {
            sendRagError(res, 412, 'PRECONDITION_REQUIRED', 'If-Match must be a valid ETag when resource exists.');
            return;
        }
        if (current.etag && current.etag !== ifMatch) {
            res.locals.conflictReason = 'ETAG_MISMATCH';
            res.setHeader('ETag', current.etag);
            res.status(409).send({
                error: 'ETAG_MISMATCH',
                message: 'Stale write rejected. Fetch latest and retry.',
                latest: toRulebookSummary(current.content),
            });
            return;
        }
        const updated = await updateRulebookMetadata(id, name, metadata, dataDirs, priority);
        let responseEtag = '';
        try {
            const refreshed = await readRulebookWithEtag(id);
            responseEtag = refreshed.etag;
        } catch (reloadError) {
            console.warn(`[RAG] Failed to refresh ETag after update for ${id}:`, reloadError);
        }
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'update',
            status: 200,
            ok: true,
            durationMs: Date.now() - startedAt,
            request: { id, name, metadata, priority },
            response: updated,
        });
        if (responseEtag) {
            res.setHeader('ETag', responseEtag);
        }
        res.send(updated);
    } catch (e) {
        console.error('[RAG] Rulebook metadata update failed:', e);
        if (e && typeof e === 'object' && e.code === 'INVALID_RULEBOOK_ID') {
            sendRagError(res, 400, 'INVALID_REQUEST', 'Invalid rulebook id.');
            return;
        }
        const isNotFound = isNotFoundError(e);
        const status = isNotFound ? 404 : 500;
        const errorCode = isNotFound ? 'NOT_FOUND' : 'RAG_UPDATE_FAILED';
        const message = isNotFound ? 'Rulebook not found.' : 'Failed to update rulebook metadata.';
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'update',
            status,
            ok: false,
            durationMs: Date.now() - startedAt,
            request: { id, name, metadata, priority },
            error: String(e),
        });
        sendRagError(res, status, errorCode, message);
    }
});

app.delete('/data/rag/rulebooks/:id', async (req, res) => {
    if (!requirePasswordAuth(req, res)) return;
    const startedAt = Date.now();
    const reqId = getReqIdFromResponse(res);
    const id = requireSafeSegment(res, req.params.id, 'rulebook id');
    if (!id) return;
    try {
        await fs.unlink(path.join(dataDirs.ragRulebooks, `${id}.json`));
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'delete',
            status: 204,
            ok: true,
            durationMs: Date.now() - startedAt,
            request: { id },
        });
        res.status(204).end();
    } catch (e) {
        console.error('[RAG] Rulebook delete failed:', e);
        const isNotFound = isNotFoundError(e);
        const status = isNotFound ? 404 : 500;
        const errorCode = isNotFound ? 'NOT_FOUND' : 'RAG_DELETE_FAILED';
        const message = isNotFound ? 'Rulebook not found.' : 'Failed to delete rulebook.';
        await appendLLMAudit({
            requestId: reqId,
            method: req.method,
            path: req.originalUrl,
            endpoint: 'rag',
            mode: 'delete',
            status,
            ok: false,
            durationMs: Date.now() - startedAt,
            request: { id },
            error: String(e),
        });
        sendRagError(res, status, errorCode, message);
    }
});
}

module.exports = {
    registerRagRoutes,
};
