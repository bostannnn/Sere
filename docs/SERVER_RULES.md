# Server-Side Rules

Last updated: 2026-03-12

---

These rules govern all code under `server/node/`. They complement `CONVENTIONS.md` (which applies repo-wide). Server-specific rules always take precedence over general conventions for server paths.

---

## I. Architecture: What Lives Where

### 1. Server vs. client boundary

The server owns all execution that requires:
- API keys or credentials
- Persistent file I/O (characters, chats, settings, assets)
- LLM execution (prompt assembly, tokenization, provider dispatch)
- RAG (ingestion, embedding, similarity search)
- Memory summarization

The client is allowed to:
- Call server endpoints via `globalFetch` or `fetch`
- Render results returned by the server
- Gate behaviour with `isNodeServer` from `src/ts/platform.ts`

**Rule: no logic that requires secrets, disk access, or LLM execution may live on the client path.**

### 2. `isNodeServer` gating on the client

When a client module has both a server path and a local fallback:

```typescript
if (isNodeServer) {
  // call server endpoint — no logic here, just delegation
  return globalFetch('/data/some/endpoint', { ... });
}
// local fallback (Tauri / browser)
```

- The server branch must be a pure delegation (call endpoint, return result).
- No prompt assembly, embedding, or data transformation in the server branch on the client.
- If there is no valid local fallback, the function must throw or return an empty result — not silently do nothing.

### 3. Module responsibilities

| Layer | Responsibility | Examples |
|-------|---------------|---------|
| `routes/*.cjs` | HTTP handler entrypoint — parse request, call service/orchestration helpers, send response | `llm_routes.cjs`, `state_routes.cjs` |
| `llm/*.cjs` | Domain logic — prompt, tokenizer, lorebook, provider dispatch | `engine.cjs`, `prompt.cjs` |
| `rag/*.cjs` | RAG domain — ingest, embed, search | `engine.cjs`, `embedding.cjs` |
| `server_*.cjs` | Bootstrap and cross-cutting infrastructure | `server_helpers.cjs`, `server_paths.cjs` |
| `storage_utils.cjs` | Path safety and ETag primitives only | `safeResolve`, `computeEtag` |

**Rule: keep route files thin.** Avoid adding new business logic directly in route files. If a handler grows beyond ~20-40 lines or mixes validation, persistence, and domain orchestration, extract a service/helper module. Existing heavier route files are refactor debt, not a pattern to copy.

---

## II. Dependency Injection Pattern

All server modules use explicit dependency injection. Nothing is imported at module scope that creates side effects or hard dependencies.

### How it works

Every module exports a registration or factory function that receives its dependencies as a plain object argument:

```javascript
function registerFooRoutes(arg = {}) {
  const { app, sendJson, readJsonWithEtag, dataDirs } = arg;

  if (!app || typeof app.post !== 'function') {
    throw new Error('registerFooRoutes requires an Express app instance.');
  }

  app.get('/data/foo', async (req, res) => {
    // ...
  });
}

module.exports = { registerFooRoutes };
```

### Rules

- **Always destructure from `arg` at the top of the function.** Do not access `arg.x` deep in handler bodies.
- **Always guard the required dependencies.** Throw a clear error if a critical dep is missing (see example above).
- **Never `require()` infrastructure modules inside handlers.** All deps come in through `arg`.
- **No module-level mutable state.** State lives in `server_password_state.cjs` (auth) or external files. Handlers are stateless.
- **Pass only what the module needs.** Do not pass the full `arg` object down into sub-functions — destructure and pass specific values.

---

## III. Route Handler Contract

### Request validation

Every handler that reads from `req.body` or `req.params` must validate before use:

```javascript
// Path segment validation — always use requireSafeSegment for IDs from URL
const safeId = requireSafeSegment(res, req.params.id, 'character id');
if (!safeId) return; // requireSafeSegment already sent 400

// Body field validation — do not trust shape
const body = req.body || {};
const name = typeof body.name === 'string' ? body.name.trim() : '';
if (!name) {
  sendJson(res, 400, { error: 'MISSING_FIELD', message: 'name is required' });
  return;
}
```

**Rule: never pass `req.params.*` or `req.body.*` directly to `path.join()` or file operations without `safeResolve`/`requireSafeSegment` validation.**

### Response helpers

Prefer the provided helpers for JSON APIs and shared contracts. In current code, some routes still use `res.send()` / `res.status().send()` for simple JSON or plain-text responses, but new endpoint code should default to `sendJson` for JSON responses and should never send raw exception objects directly.

| Helper | When to use |
|--------|-------------|
| `sendJson(res, status, payload, etag?)` | Preferred helper for JSON responses |
| `sendSSE(res, payload)` | Single-event SSE (non-streaming) |
| `res.write()` / `res.end()` | Streaming NDJSON only |
| `sendConflict(res, filePath)` | ETag mismatch on PUT/PATCH |

### Error response shape

All error responses must use this shape:

```javascript
sendJson(res, 400, { error: 'ERROR_CODE', message: 'Human-readable description' });
```

- `error`: screaming snake case machine-readable code.
- `message`: human-readable, safe to surface to the client.
- Never include stack traces, file paths, or internal state in error responses.

### Async error handling

Every async handler must catch and respond, either inline or through a route wrapper such as `withAsyncRoute` — never let unhandled rejections crash the process:

```javascript
app.post('/data/foo', async (req, res) => {
  try {
    // ...
    sendJson(res, 200, result);
  } catch (err) {
    console.error('[foo] handler error', err);
    sendJson(res, 500, { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
});
```

---

## IV. File I/O and Storage Rules

### Path safety — mandatory

All user-supplied IDs used in file paths must be validated before use:

```javascript
// Correct
const safeId = requireSafeSegment(res, req.params.id, 'character id');
if (!safeId) return;
const filePath = path.join(dataDirs.characters, safeId, 'character.json');

// FORBIDDEN — directory traversal risk
const filePath = path.join(dataDirs.characters, req.params.id, 'character.json');
```

`requireSafeSegment` rejects: empty strings, strings with `/`, `\`, `..`, `\0`, and strings over 128 chars.

For nested paths built from multiple segments, use `safeResolve(baseDir, relPath)` from `storage_utils.cjs`.

### ETag-based concurrency for mutable resources

All `PUT` and `PATCH` handlers that write JSON files must enforce optimistic concurrency:

```javascript
app.put('/data/prompts/:id', async (req, res) => {
  const ifMatch = requireIfMatch(req, res); // sends 412 if header missing
  if (!ifMatch) return;

  const { etag } = await readJsonWithEtag(filePath);
  if (!isIfMatchAny(ifMatch) && etag !== ifMatch) {
    await sendConflict(res, filePath); // sends 409
    return;
  }

  const { json, etag: newEtag } = await writeJsonWithEtag(filePath, req.body);
  sendJson(res, 200, json, newEtag);
});
```

**Rule: `GET` responses for mutable resources must include an `ETag` header. `PUT`/`PATCH` must require `If-Match`.**

### Never write outside `dataDirs`

All file writes must resolve under `dataRoot`. Use `safeResolve` to enforce this. Never construct absolute paths from user input.

---

## V. Streaming (NDJSON / SSE)

Use streaming for:
- LLM generation responses (token-by-token or chunk-by-chunk)
- RAG ingestion progress

### NDJSON streaming contract

```javascript
// Set headers before first write
res.setHeader('Content-Type', 'application/x-ndjson');
res.setHeader('Transfer-Encoding', 'chunked');
res.setHeader('X-Accel-Buffering', 'no');

// Each progress event: one JSON object per line
res.write(JSON.stringify({ status: 'processing', message: 'Embedding...', current: 1, total: 10 }) + '\n');

// Terminal success event
res.write(JSON.stringify({ status: 'done', id: rulebookId, chunkCount: n }) + '\n');
res.end();

// Terminal error event (instead of HTTP error status mid-stream)
res.write(JSON.stringify({ status: 'error', error: 'Embedding model failed to load' }) + '\n');
res.end();
```

**Rules:**
- Always send a `{ status: 'done' }` or `{ status: 'error' }` as the final line before `res.end()`.
- Never throw after headers are sent — write an error event and end cleanly.
- The client must not rely on HTTP status for stream success/failure — read the terminal event.

---

## VI. Security Rules (Server-Specific)

### Authentication

Password-protected routes must check auth before any logic:

```javascript
const { requirePasswordAuth } = arg; // injected auth helper

app.post('/data/sensitive', async (req, res) => {
  if (!requirePasswordAuth(req, res)) return; // sends 401 if unauthenticated
  // ...
});
```

### No secrets in responses

- Never echo back API keys, tokens, or password hashes in any response.
- Never include `settings.json` fields that contain credentials in list/summary endpoints.
- Audit payloads must redact sensitive fields before writing to disk.

### Input size limits

Global body parser limits must stay conservative and are environment-configurable:
- `RISU_HTTP_JSON_LIMIT` (default: `20mb`)
- `RISU_HTTP_RAW_LIMIT` (default: `20mb`)
- `RISU_HTTP_TEXT_LIMIT` (default: `20mb`)

Large JSON payload parsing is only allowed on dedicated endpoints. For RAG ingestion:
- `POST /data/rag/ingest` uses a route-scoped JSON parser with `RISU_RAG_INGEST_JSON_LIMIT` (default: `500mb`).
- The global JSON parser is intentionally skipped for this endpoint so `/data` auth can run before large-body parsing.

For all other routes:
- Reject unusually large payloads early (before processing).
- Large binary uploads (PDFs) must come via the dedicated `/data/rag/ingest` endpoint, not generic storage routes.

### No shell execution

`child_process.exec`, `spawn`, or `eval` are forbidden in server code. All LLM provider calls must go through the `engine.cjs` dispatch — never execute arbitrary strings.

---

## VII. Module File Limits

The 500 LOC limit from `CONVENTIONS.md` still applies as the target for new work, but several existing server modules are already over the limit and should be split incrementally when touched. Current high-signal reference sizes:

| Module | Lines | Status |
|--------|-------|--------|
| `server.cjs` | ~430 | ✅ within limit |
| `routes/llm_routes.cjs` | ~370 | ✅ within limit |
| `llm/engine.cjs` | ~620 | Debt — split when touched |
| `llm/execute_route_handler.cjs` | ~1030 | Debt — split before adding more behavior |

If a module exceeds 500 lines, split by responsibility: extract a service module, a helpers module, or a sub-router (following existing slice naming: `_helpers.cjs`, `_routes.cjs`).

---

## VIII. Adding a New Endpoint — Checklist

Before shipping a new server endpoint:

- [ ] Route registered in appropriate `routes/*.cjs` file, not in `server.cjs`
- [ ] Route file receives all deps via DI `arg` object
- [ ] Path segments validated with `requireSafeSegment` or `safeResolve`
- [ ] Request body validated (type checks, required field checks)
- [ ] Error responses use `{ error, message }` shape via `sendJson`
- [ ] Async handler wrapped in try/catch or a shared async route wrapper
- [ ] Mutable resource writes use ETag concurrency (`requireIfMatch`)
- [ ] Streaming responses send `{ status: 'done' }` or `{ status: 'error' }` terminal event
- [ ] No secrets in response payloads
- [ ] Auth checked where required
- [ ] Route registered in `server_route_bootstrap.cjs`
- [ ] Endpoint documented in `docs/SERVER_ARCHITECTURE.md`
- [ ] **Unit tests** written for all new pure functions (`scripts/test-<domain>-unit.cjs`) — must pass with `node scripts/test-<domain>-unit.cjs`
- [ ] **Smoke tests** written for all new HTTP endpoints (`scripts/test-server-<domain>.js`) — must pass against a clean server (`RISU_DATA_ROOT=/tmp/... node server/node/server.cjs`)
- [ ] If the new test file matches ignored `/scripts/*` patterns, `.gitignore` exceptions are updated and committed alongside the feature

---

## IX. When Client Code Needs a New Server Capability

1. Add the endpoint in the appropriate route file.
2. Add the client call behind `isNodeServer` in the relevant client module.
3. Provide a local fallback (or throw with a clear message if none is possible).
4. Update `docs/SERVER_ARCHITECTURE.md` with the new endpoint.
5. Update the client-server gating table if the gating pattern is new.
