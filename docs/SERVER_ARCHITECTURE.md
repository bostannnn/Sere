# Server Architecture

Last updated: 2026-03-09

## Overview

RisuAI uses a server-first architecture where a Node.js/Express server handles:
- All LLM execution (prompt assembly, provider routing, streaming)
- All storage (characters, chats, settings, assets)
- RAG (document ingestion, embedding, semantic search)
- Memory (periodic summarization and trace)
- Durable audit logging

The client (Svelte SPA) is a thin UI that sends high-level intents and renders responses. The runtime is server-only: `isNodeServer` is forced true in `src/ts/platform.ts`, and local-only/Tauri execution paths are not supported.

## Server Entry Point

`server/node/server.cjs` (283 lines) — Orchestrator only. Imports all modules, creates DI context, delegates to bootstrap helpers:

1. `server_paths.cjs` — Resolves `dataRoot`, `dataDirs`, `sslPath`
2. `server_http_setup.cjs` — Configures Express middleware (body parsers, static serving, CORS), with scoped parser bypass for large RAG ingest
3. `server_data_helpers.cjs` — Creates `ensureDir`, `readJsonWithEtag`, `writeJsonWithEtag`, data middleware
4. `server_password_state.cjs` — Password/auth bootstrap state
5. `server_helpers.cjs` — Shared utilities: `sendJson`, `sendSSE`, `isSafePathSegment`, `createAppendLLMAudit`, auth helpers
6. `server_llm_bootstrap.cjs` — Composes all LLM pipeline helpers (engine, prompt, memory, scripts, tokenizer) into one DI bag
7. `server_route_bootstrap.cjs` — Registers all route modules with the Express app
8. `server_runtime.cjs` — Global error middleware, SSL loading, HTTP/HTTPS server start
9. `storage_utils.cjs` — `safeResolve`, `computeEtag`, `requireIfMatch`, `isIfMatchAny`

## API Endpoints

### LLM (`server/node/routes/llm_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/data/llm/execute` | Raw LLM execution (client-assembled prompt). Used for `memory`, `emotion`, `submodel` modes |
| POST | `/data/llm/preview` | Preview assembled prompt without executing |
| POST | `/data/llm/generate` | Full pipeline: server loads char/chat, builds prompt, lorebook, memory, RAG, executes LLM |
| POST | `/data/llm/generate/trace` | Same as generate but returns trace/debug info instead of executing |
| GET | `/data/llm/logs` | Retrieve durable LLM audit logs |
| GET | `/data/openrouter/models` | Proxy OpenRouter model list |

**Key distinction:** `/data/llm/generate` is the main endpoint — server does everything. `/data/llm/execute` is the fallback for when the client has already assembled the prompt (legacy path or special modes).

### Auth (`server/node/routes/auth_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/data/auth/password/status` | Check whether password auth is unset, correct, or incorrect |
| POST | `/data/auth/crypto` | Server-side SHA-256 helper for password fallback hashing |
| POST | `/data/auth/password` | Set initial server password |
| POST | `/data/auth/password/change` | Rotate existing server password |

### State (`server/node/routes/state_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/data/state/snapshot` | Return the authoritative app snapshot |
| POST | `/data/state/commands` | Apply event-journaled state commands |

### Sync (`server/node/routes/sync_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/data/sync/events` | SSE stream of state journal events since `?since=` |

### Character Evolution (`server/node/routes/evolution_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/data/character-evolution/handoff` | Run extraction handoff for a character/chat and stage a pending proposal |
| POST | `/data/character-evolution/:charId/proposal/accept` | Accept a pending proposal and persist the next versioned state |
| POST | `/data/character-evolution/:charId/proposal/reject` | Reject the pending proposal for a character |
| GET | `/data/character-evolution/:charId/versions` | List saved character-evolution versions |
| GET | `/data/character-evolution/:charId/versions/:version` | Load one saved character-evolution version payload |

### Content (`server/node/routes/content_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/data/assets` | Upload asset |
| GET | `/data/assets/*` | Serve asset file |
| GET/PUT/DELETE | `/data/{prompts,themes,color_schemes}/:id` | Prompt/theme/color scheme CRUD |

### RAG (`server/node/routes/rag_routes.cjs`)

Scope contract:
- Character-level RAG controls only `enabled` and `enabledRulebooks`.
- Retrieval tuning (`topK`, `minScore`, `budget`, `model`) is global-only via `globalRagSettings`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/data/rag/rulebooks` | List all rulebooks with metadata |
| POST | `/data/rag/search` | Semantic search across rulebooks. Body: `{ query, bookIds, topK, minScore, model }` |
| POST | `/data/embeddings` | Generate embeddings server-side. Body: `{ input, model }` |
| POST | `/data/transformers/summarize` | Run DistilBART summarization server-side. Body: `{ text }` |
| POST | `/data/transformers/image-caption` | Run image captioning server-side. Body: `{ dataUrl }` |
| POST | `/data/rag/ingest` | Ingest document (base64). Streams NDJSON progress. Returns `{ id, chunkCount }` |
| PATCH | `/data/rag/rulebooks/:id` | Update rulebook metadata |
| DELETE | `/data/rag/rulebooks/:id` | Delete rulebook |

### Memory (`server/node/memory/`)

| Method | Path | File | Description |
|--------|------|------|-------------|
| POST | `/data/memory/manual-summarize` | `manual_routes.cjs` | Manual summarization of selected messages. Supports optional request `promptOverride` and returns scoped `debug` payload: `timestamp`, `model`, `prompt`, `input`, `formatted`, `rawResponse`, `characterId`, `chatId`, `start`, `end`, `source`, `promptSource` |
| POST | `/data/memory/manual-summarize/trace` | `trace_routes.cjs` | Trace/preview manual summarization. Supports optional request `promptOverride` |
| POST | `/data/memory/periodic-summarize/trace` | `trace_routes.cjs` | Trace periodic summarization |

### Other Routes

| File | Endpoints | Description |
|------|-----------|-------------|
| `auth_routes.cjs` | `/data/auth/*` | Password auth and auth hashing helpers |
| `state_routes.cjs` | `/data/state/*` | Authoritative snapshot + command gateway |
| `sync_routes.cjs` | `/data/sync/events` | Event journal streaming |
| `memory_routes.cjs` | Memory-related endpoints | Memory system management |
| `evolution_routes.cjs` | `/data/character-evolution/*` | Character evolution handoff, proposal review, and version history |
| `proxy_routes.cjs` | `/data/proxy` | Reverse proxy passthrough |
| `integration_routes.cjs` | `/data/integrations/comfy/*` | Core Comfy Commander proxy (`/cw`, `/comfy`) |
| `system_routes.cjs` | `/` | Root handler |

Core ownership note for Comfy Commander:

- Client runtime lives in `src/ts/integrations/comfy/*`.
- Core commands (`/cw`, `/comfy`) dispatch through this server route.
- No legacy `/proxy`/`/proxy2` path is used for Comfy Commander.
- Legacy `/data/settings`, `/data/characters*`, and `/data/storage/*` routes are removed; state writes go through `/data/state/commands`.

## LLM Pipeline (`server/node/llm/`)

### Core Pipeline

| File | LOC | Purpose |
|------|-----|---------|
| `engine.cjs` | 393 | Provider router — dispatches to correct handler by provider name |
| `prompt.cjs` | 778 | Server-side prompt assembly: system prompt, lorebook, memory, depth prompts, format order |
| `lorebook.cjs` | 95 | Keyword/regex lorebook matching against chat history |
| `scripts.cjs` | 171 | Regex script processing, `risuChatParser` variable substitution, thought block stripping |
| `tokenizer.cjs` | 51 | Token counting for prompt budget management |
| `memory.cjs` | 590 | Memory summary selection (important + recent + similar + random), embedding |
| `generate_helpers.cjs` | 391 | Generate-mode orchestration: periodic memory triggers, payload building |
| `execute_route_handler.cjs` | 465 | `/data/llm/execute` handler: raw execution + `[SYSTEM]` game-state extraction |
| `execution_helpers.cjs` | — | Mode normalization, provider/model selection, internal execution detection |

### Provider Handlers

| File | Provider |
|------|----------|
| `openrouter.cjs` | OpenRouter |
| `openai.cjs` | OpenAI-compatible APIs |
| `anthropic.cjs` | Anthropic Claude |
| `google.cjs` | Google Gemini |
| `deepseek.cjs` | DeepSeek |
| `ollama.cjs` | Ollama (local) |
| `kobold.cjs` | KoboldAI |
| `novelai.cjs` | NovelAI |

Current server execution support is defined by `server/node/llm/engine.cjs` and `server/node/llm/constants.cjs`. If that provider set changes, update this section from those files rather than from older migration notes.

### Supporting

| File | LOC | Purpose |
|------|-----|---------|
| `audit.cjs` | 304 | Durable JSON audit log append/read |
| `audit_payloads.cjs` | 207 | Audit request/response payload builders |
| `trace_audit.cjs` | 145 | Generate/memory trace audit appenders |
| `server/node/memory/helpers.cjs` | 195 | Memory summarization helpers (prompt building, embedding, persistence) |
| `constants.cjs` | — | Provider constants, migrated provider set |
| `errors.cjs` | — | `LLMHttpError` class |
| `index.cjs` | — | Module re-exports |
| `logger.cjs` | — | Structured logging |

## RAG Pipeline (`server/node/rag/`)

| File | LOC | Purpose |
|------|-----|---------|
| `engine.cjs` | 418 | Core RAG: chunking, ranking, semantic search, rulebook caching, metadata updates |
| `embedding.cjs` | 67 | HuggingFace Transformers embedding pipeline (server-side, CPU) |
| `aux_transformers.cjs` | — | Server-side summarization and image-caption pipelines |
| `pdf.cjs` | 322 | PDF text extraction with column awareness, fragment clustering, table detection, low-signal line filtering |
| `model.cjs` | 37 | Embedding model name resolution (MiniLM, BGE, Nomic, etc.) |

## Request Flow

### Chat message (server-first, `/data/llm/generate`)

```
Client                          Server
  │                               │
  ├─ POST /data/llm/generate ────→│
  │  { characterId, chatId,       │
  │    provider, streaming,       │
  │    ragSettings, ... }         │
  │                               ├─ Load character + chat from disk
  │                               ├─ Run server prompt.cjs assembly:
  │                               │  ├─ System prompt + personality
  │                               │  ├─ Chat history (token-budgeted)
  │                               │  ├─ Lorebook matching
  │                               │  ├─ Memory injection
  │                               │  ├─ RAG search + context injection into `rulebookRag` template slot
  │                               │  ├─ Depth prompts
  │                               │  └─ Format order enforcement
  │                               ├─ Route to provider handler (engine.cjs)
  │                               ├─ Execute LLM call
  │                               ├─ Stream response (SSE) or return JSON
  │                               ├─ Append durable audit log
  │                               └─ Persist updated chat + game state
  │←──── SSE stream / JSON ──────│
```

### RAG ingest (`/data/rag/ingest`)

```
Client                          Server
  │                               │
  ├─ POST /data/rag/ingest ──────→│
  │  { name, base64, model,       │
  │    metadata, thumbnail }      │
  │                               ├─ Decode base64
  │                               ├─ Extract text (pdf.cjs or raw)
  │                               ├─ Chunk text (engine.cjs)
  │                               ├─ Generate embeddings (embedding.cjs)
  │                               │  (streams NDJSON progress)
  │                               ├─ Save rulebook JSON to disk
  │                               └─ Send final { id, chunkCount }
  │←──── NDJSON progress ────────│
```

## Data Directory Structure

```
data/
├── settings.json
├── characters/
│   └── {characterId}/
│       ├── character.json
│       └── chats/
│           └── {chatId}.json
├── assets/other/          # Uploaded images/files
├── prompts/               # Prompt presets
├── themes/                # UI themes
├── color_schemes/         # Color schemes
└── rag/
    └── rulebooks/
│           └── {rulebookId}.json  # Chunks + embeddings
├── models/                    # Cached embedding models
└── logs/
    └── llm-execution/
        └── YYYY-MM-DD/
            └── *.json         # Durable LLM execution logs
```

## Client-Server Gating

The client uses server-only runtime (`isNodeServer` is forced `true` in `src/ts/platform.ts`).

| Module | Active path |
|--------|-------------|
| `request.ts` | Calls `/data/llm/generate` or `/data/llm/execute` |
| `openAI.ts` | Routes through `requestServerExecution()` |
| `rag/rag.ts` | Calls `/data/rag/ingest`, `/data/rag/search` (no local chunking/search fallback) |
| `rag/storage.ts` | Calls `/data/rag/rulebooks` CRUD |
| `serverDb.ts` | REST wrapper for `/data/*` storage |
| `index.svelte.ts` | Server flushes chat snapshots, syncs game state |

## Dependency Injection

The server uses a factory/DI pattern: `server.cjs` creates helper instances and passes them as arguments to route registration functions. This avoids circular requires and makes testing possible.

Example: `registerRagRoutes({ app, fs, dataDirs, generateEmbeddings, ... })`

Each route module receives only the dependencies it needs.
