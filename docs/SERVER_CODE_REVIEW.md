# Server Code Review

Date: 2026-02-19
Scope: `server/node/` — post-decomposition state (after Feb 2026 server-first commit)
Reviewer: Claude Sonnet

---

## Update (2026-02-19, post-hardening pass)

The following items from this review are now implemented:
- Path traversal guard for JSON content resources (`/data/prompts/:id`, `/data/themes/:id`, `/data/color_schemes/:id`) via `requireSafeSegment`.
- Central `/data/*` auth boundary with explicit public bootstrap exceptions only.
- Password handling upgraded from plaintext token storage to `scrypt$<salt>$<hash>` records with legacy auto-migration on successful auth.
- Auth comparison hardened with timing-safe comparison and lockout/rate-limit controls.
- Added authenticated password rotation endpoint: `POST /data/auth/password/change`.
- Settings secret redaction on read + redacted placeholder restore on write to avoid leaking keys in normal settings fetch paths.
- Proxy/integration hardening: URL validation, optional host allowlists, and safer forwarded headers.

This review list remains useful for remaining non-auth debt; do not treat resolved items as open.

---

## Summary

The server decomposition is complete and the architecture is sound. The DI pattern is applied consistently, module boundaries are clear, and the route-to-service separation is working. This review documents the remaining issues found in the current codebase so they can be tracked and fixed systematically.

**No critical execution safety risks** exist in the server code (no `eval`, no `new Function`, no shell execution). The risks below are a path-safety gap, missing try/catch coverage, and response shape inconsistencies.

---

## P0 — Fix Before Shipping to Users

### 1. [Resolved] Path traversal risk in `content_routes.cjs` dynamic handler

**Location:** `server/node/routes/content_routes.cjs`, `jsonResourceHandlers()`, lines ~224, 234, 257

**Status:** Resolved on 2026-02-19 by validating `req.params.id` with `requireSafeSegment` before `path.join()`.

**Original problem:** `req.params.id` was used directly in `path.join()` without `requireSafeSegment` validation:

```javascript
// Current (unsafe)
const filePath = path.join(dataDirs[resourceDir], `${req.params.id}.json`);

// Required (safe)
const safeId = requireSafeSegment(res, req.params.id, 'resource id');
if (!safeId) return;
const filePath = path.join(dataDirs[resourceDir], `${safeId}.json`);
```

This affects `GET /data/prompts/:id`, `PUT /data/prompts/:id`, `DELETE /data/prompts/:id`, and the equivalent `/themes` and `/color_schemes` endpoints — 9 handlers in total.

Note: `resourceDir` itself is safe (always a hardcoded string from the call site, never from user input). Only the `:id` segment is exposed.

**Result:** Fixed in all prompt/theme/color-scheme handlers (9 call sites).

---

## P1 — Fix Before Next Significant Feature

### 2. Async handlers missing try/catch in several route files

**Problem:** 50 async route handlers exist across route files; only ~34 try/catch blocks are present. Handlers without try/catch will cause unhandled promise rejections if an unexpected error occurs (e.g. disk full, JSON parse failure on a corrupt file). Express will log them but the client gets no response.

**Affected files** (spot-checked):
- `content_routes.cjs` — several handlers, especially the dynamic `jsonResourceHandlers` body
- `legacy_routes.cjs` — older handlers written before the pattern was established
- `trace_routes.cjs` — memory trace handlers

**Pattern to apply:**
```javascript
app.get('/data/foo/:id', async (req, res) => {
  try {
    // ... handler body
  } catch (err) {
    console.error('[foo] GET error', err);
    sendJson(res, 500, { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
  }
});
```

### 3. Inconsistent response shapes across older handlers

**Problem:** Some handlers (mostly in `legacy_routes.cjs` and `system_routes.cjs`) use `res.send()` and `res.status().send()` directly instead of `sendJson`. This means:
- No `Content-Type: application/json` header on some error responses
- Error shape varies (`{ ok: false, error: String(err) }` vs `{ error: 'CODE', message: '...' }`)

**Examples:**
- Several legacy handlers use raw `res.send()`

**Fix:** Replace direct `res.send()` calls with `sendJson` in all route handlers. Standardise error shape to `{ error: 'CODE', message: '...' }`.

### 4. `execute_route_handler.cjs` is at 465 lines — approaching split threshold

**Location:** `server/node/llm/execute_route_handler.cjs`

This file handles the `/data/llm/execute` endpoint and also contains the `[SYSTEM]` game-state extraction logic (~100 lines). It is not yet over the 500-line limit but is close. When the next change touches it, extract the game-state update logic into `llm/game_state.cjs`.

---

## P2 — Moderate Debt, Can Defer with Note

### 5. No structured runtime validation on LLM request payloads

**Location:** `server/node/llm/execution_helpers.cjs`, `parseLLMExecutionInput()`

LLM request payloads are validated with manual type checks (`typeof x === 'string'`, null coalescing). There is no schema-based validation. This means:
- Malformed payloads fail deep in the pipeline with cryptic errors rather than a clear 400
- Adding new payload fields requires careful manual validation each time

**Recommendation:** Introduce a lightweight schema validator (Zod or TypeBox) for `LLMExecutionInput`. This doesn't require a full migration — start at the `parseLLMExecutionInput` boundary.

### 6. RAG routes (`rag_routes.cjs`) at 402 lines with inline embedding orchestration

**Location:** `server/node/routes/rag_routes.cjs`

The ingest handler (~150 lines inline) does: request parsing → PDF detection → chunking → embedding → save. This is service logic living in a route file, violating the route-handler-only rule. It's close to the 500-line limit.

**Recommendation:** Extract the ingest orchestration into `server/node/rag/ingest_service.cjs`. The route handler becomes ~20 lines.

### 7. Console logging is unstructured

**Location:** Throughout `server/node/`

Logging uses raw `console.log`/`console.error` with ad-hoc prefixes like `[RAG]` and `[LLM]`. There's no structured log format, no severity levels tied to the prefix, and no way to filter by component in production.

The LLM audit trail (`llm/audit.cjs`) is good and writes structured JSONL. The operational logs are not at that standard.

**Recommendation:** This is low urgency but when a logging library is introduced (even a thin wrapper), it should replace the ad-hoc prefixes with a consistent `{ level, component, message, ...meta }` shape.

---

## P3 — Low Priority / Polish

### 8. No server-side input length limits on text fields

Free-text fields in request bodies (e.g. character names, chat messages in legacy endpoints) have no maximum length validation. This can't cause data loss but can affect performance if someone sends extremely large payloads to non-streaming endpoints.

### 9. `server_data_helpers.cjs` `sendConflict` reads the file twice on conflict

On an ETag mismatch, `sendConflict` reads the file again to return the current state. This is a minor redundancy — the file was already read earlier in the handler. Not a correctness issue.

### 10. `legacy_routes.cjs` OAuth handler has no CSRF protection

`GET /data/oauth/login` and `GET /data/oauth/callback` exist but have no state parameter validation. OAuth flows without CSRF token validation are technically vulnerable to CSRF attacks on the login initiation. Low risk in this deployment model (local server) but worth noting for any hosted deployment.

---

## What Is Working Well

- **DI pattern is applied consistently** across all 12 route files and all bootstrap helpers. No module imports infrastructure at module scope.
- **`requireSafeSegment` and `safeResolve` are used correctly** in `storage_routes.cjs`, `rag_routes.cjs`, and asset handlers. The gap in `content_routes.cjs` is isolated.
- **ETag concurrency is correct** in `storage_routes.cjs` (settings, characters, chats). The pattern is well-established.
- **Streaming is clean** — NDJSON terminal events (`done`/`error`) are sent consistently in `rag_routes.cjs` and `llm_routes.cjs`.
- **No `eval`, `new Function`, or shell execution** anywhere in the server codebase.
- **Audit trail** (`llm/audit.cjs`) writes structured JSONL with sensitive field redaction. Good foundation.
- **Module sizes** are well within limits except for `execute_route_handler.cjs` (465 lines, watch it).

---

## Fix Priority Order

| # | Issue | Priority | Effort |
|---|-------|----------|--------|
| 1 | Path traversal in `content_routes.cjs` | Resolved (2026-02-19) | Small (9 call sites) |
| 2 | Missing try/catch on async handlers | P1 | Medium (scan all routes) |
| 3 | Inconsistent response shapes | P1 | Medium |
| 4 | `execute_route_handler.cjs` split | P1 | Small (when next touched) |
| 5 | Schema validation for LLM payloads | P2 | Large |
| 6 | Extract RAG ingest to service module | P2 | Medium |
| 7 | Structured logging | P2 | Large |
| 8 | Input length limits | P3 | Small |
| 9 | Double read on conflict | P3 | Trivial |
| 10 | OAuth CSRF | P3 | Small |
