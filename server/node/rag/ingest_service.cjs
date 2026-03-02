const { resolveEmbeddingModel } = require('./model.cjs');

function createRagIngestService(arg = {}) {
    const {
        fs,
        path,
        crypto,
        dataDirs,
        extractTextFromPdf,
        chunkText,
        generateEmbeddings,
        appendLLMAudit,
        getReqIdFromResponse,
    } = arg;
    const MAX_FIELD_LENGTH = 1024;
    const CONTROL_CHAR_RE = /[\p{Cc}]/gu;
    const sanitizeTextField = (value) => {
        if (typeof value !== 'string') return '';
        return value.replace(CONTROL_CHAR_RE, '').trim();
    };

    async function ingestRulebook(req, res) {
        req.setTimeout(600000); // 10 minutes
        const startedAt = Date.now();
        const reqId = getReqIdFromResponse(res);
        const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) ? req.body : null;
        if (!body) {
            return res.status(400).send({ error: 'invalid request body' });
        }
        const { name, base64, model, source_file, metadata } = body;
        const resolvedModel = resolveEmbeddingModel(model || 'MiniLM');
        const normalizedName = sanitizeTextField(name);
        const normalizedSourceFile = sanitizeTextField(source_file || normalizedName);
        if (!normalizedName || !base64) {
            return res.status(400).send({ error: 'name and base64 file data required' });
        }
        if (normalizedName.length > MAX_FIELD_LENGTH || normalizedSourceFile.length > MAX_FIELD_LENGTH) {
            return res.status(400).send({ error: 'name/source_file too long (max 1024 chars)' });
        }

        // Set up streaming response
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');

        let isClosed = false;
        const abortController = new AbortController();
        const markClientDisconnected = () => {
            if (isClosed) return;
            isClosed = true;
            abortController.abort();
            console.log(`[RAG] Client disconnected, canceling ingestion for: ${normalizedName}`);
        };
        // `req.close` also fires on normal request completion; treat only genuine
        // abort/response close-before-end as disconnect signals.
        req.on('aborted', markClientDisconnected);
        res.on('close', () => {
            if (!res.writableEnded) {
                markClientDisconnected();
            }
        });

        const sendProgress = (data) => {
            if (!isClosed) res.write(JSON.stringify(data) + '\n');
        };

        console.log(`[RAG] Received ingestion request for: ${normalizedName}`);
        try {
            const id = (crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'));
            const buffer = Buffer.from(base64, 'base64');

            sendProgress({ status: 'processing', message: 'Extracting text from PDF...' });
            let input = '';
            if (normalizedName.toLowerCase().endsWith('.pdf')) {
                console.log(`[RAG] Extracting text from PDF: ${normalizedName} (${buffer.length} bytes)`);
                input = await extractTextFromPdf(buffer); // Array of {text, page}
                if (isClosed) return;
                console.log(`[RAG] Extraction complete: ${input.length} pages found.`);
            } else {
                input = buffer.toString('utf-8');
            }

            const chunks = [];
            const sections = typeof input === 'string' ? [{ text: input }] : input;
            for (const section of sections) {
                if (isClosed) return;
                const chunkList = chunkText(section.text, normalizedSourceFile || normalizedName, section.page);
                // Apply global metadata to each chunk
                if (metadata) {
                    chunkList.forEach((chunk) => {
                        chunk.metadata.system = metadata.system;
                        chunk.metadata.edition = metadata.edition;
                    });
                }
                chunks.push(...chunkList);
            }
            if (chunks.length === 0) {
                throw new Error(
                    'No usable text could be extracted from this document. ' +
                    'It may be image-only/scanned or too sparse after filtering.'
                );
            }

            sendProgress({ status: 'processing', message: `Generated ${chunks.length} chunks. Initializing model...` });
            if (isClosed) return;
            console.log(
                `[RAG] Ingesting ${normalizedName}: generated ${chunks.length} chunks. Embedding with requested=${resolvedModel.requestedKey} resolved=${resolvedModel.modelName}...`
            );

            // Embed chunks in batches of 10
            const batchSize = 10;
            let lastDownloadMsg = '';

            for (let i = 0; i < chunks.length; i += batchSize) {
                if (isClosed) break;
                const batch = chunks.slice(i, i + batchSize);
                const embeddings = await generateEmbeddings(batch.map((chunk) => chunk.content), resolvedModel.key, (progress) => {
                    if (isClosed) return;
                    if (progress.type === 'download') {
                        let msg = '';
                        if (progress.status === 'initiate') {
                            msg = `Initiating download: ${progress.file || '...'}`;
                        } else if (progress.status === 'progress') {
                            msg = `Downloading model: ${progress.file || '...'} (${Math.round(progress.progress || 0)}%)`;
                        } else if (progress.status === 'done') {
                            msg = `Downloaded: ${progress.file || '...'}`;
                        } else {
                            msg = `Processing model: ${progress.file || '...'}`;
                        }

                        if (msg !== lastDownloadMsg) {
                            sendProgress({
                                status: 'downloading',
                                message: msg,
                                file: progress.file,
                                progress: progress.progress !== undefined ? progress.progress : 0,
                            });
                            lastDownloadMsg = msg;
                        }
                    }
                }, abortController.signal);

                for (let j = 0; j < batch.length; j++) {
                    batch[j].embedding = embeddings[j];
                }
                sendProgress({
                    status: 'embedding',
                    message: 'Embedding chunks...',
                    current: Math.min(i + batchSize, chunks.length),
                    total: chunks.length,
                });
                console.log(`[RAG] Progress: ${Math.min(i + batchSize, chunks.length)}/${chunks.length}`);
            }

            if (isClosed) {
                console.log(`[RAG] Ingestion for ${normalizedName} cleaned up after disconnect.`);
                return;
            }

            const rulebook = {
                id,
                name: normalizedName,
                chunks,
                embeddingModel: resolvedModel.key,
                metadata,
                chunkCount: chunks.length,
                thumbnail: body.thumbnail,
                updatedAt: Date.now(),
            };

            await fs.writeFile(path.join(dataDirs.ragRulebooks, `${id}.json`), JSON.stringify(rulebook, null, 2));
            console.log(`[RAG] Ingestion successful for ${normalizedName}. Saved as ${id}.json`);

            const responseData = { id, name: normalizedName, chunkCount: chunks.length };
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: 'rag',
                mode: 'ingest',
                status: 200,
                ok: true,
                durationMs: Date.now() - startedAt,
                request: {
                    name: normalizedName,
                    modelRequested: resolvedModel.requestedKey,
                    modelResolved: resolvedModel.modelName,
                    source_file: normalizedSourceFile,
                    metadata,
                    dataSize: buffer.length,
                },
                response: {
                    ...responseData,
                    modelRequested: resolvedModel.requestedKey,
                    modelResolved: resolvedModel.modelName,
                },
            });

            sendProgress({ status: 'done', ...responseData });
            res.end();
        } catch (e) {
            console.error('[RAG] Ingestion failed for ' + normalizedName + ':', e);
            const errorMsg = e instanceof Error ? e.message : String(e);
            await appendLLMAudit({
                requestId: reqId,
                method: req.method,
                path: req.originalUrl,
                endpoint: 'rag',
                mode: 'ingest',
                status: 500,
                ok: false,
                durationMs: Date.now() - startedAt,
                request: { name: normalizedName, modelRequested: resolvedModel.requestedKey, modelResolved: resolvedModel.modelName, source_file: normalizedSourceFile },
                error: errorMsg,
            });
            sendProgress({ status: 'error', error: errorMsg });
            res.end();
        }
    }

    return {
        ingestRulebook,
    };
}

module.exports = {
    createRagIngestService,
};
