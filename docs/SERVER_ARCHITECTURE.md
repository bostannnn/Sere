# Server Architecture

Last updated: 2026-03-02

## Overview

RisuAI uses a server-first architecture where a Node.js/Express server handles:
- All LLM execution (prompt assembly, provider routing, streaming)
- All storage (characters, chats, settings, assets)
- RAG (document ingestion, embedding, semantic search)
- HypaV3 memory (periodic summarization, re-summarization, trace)
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

### Storage (`server/node/routes/storage_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/data/settings` | Read app settings |
| PUT | `/data/settings` | Write app settings (ETag conflict handling) |
| GET | `/data/characters` | List all characters |
| POST | `/data/characters` | Create character |
| GET | `/data/characters/:id` | Read character |
| PUT | `/data/characters/:id` | Update character (ETag) |
| DELETE | `/data/characters/:id` | Delete character |
| GET | `/data/characters/:id/chats` | List chats for character |
| POST | `/data/characters/:id/chats` | Create chat |
| GET | `/data/characters/:id/chats/:chatId` | Read chat |
| PUT | `/data/characters/:id/chats/:chatId` | Update chat (ETag) |
| DELETE | `/data/characters/:id/chats/:chatId` | Delete chat |

### Content (`server/node/routes/content_routes.cjs`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/data/assets` | Upload asset |
| GET | `/data/assets/*` | Serve asset file |
| GET/PUT | `/data/plugins/manifest` | Plugin manifest CRUD |
| GET/PUT/DELETE | `/data/plugins/:name` | Individual plugin CRUD |
| DELETE | `/data/plugins/by-name/:name` | Delete plugin by name |
| POST | `/data/plugins/log` | Plugin log entry |
| GET/PUT/DELETE | `/data/{prompts,themes,color_schemes}/:id` | Prompt/theme/color scheme CRUD |

### RAG (`server/node/routes/rag_routes.cjs`)

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

### Memory — HypaV3 (`server/node/routes/`)

| Method | Path | File | Description |
|--------|------|------|-------------|
| POST | `/data/memory/hypav3/manual-summarize` | `hypav3_manual_routes.cjs` | Manual summarization of selected messages. Supports optional request `promptOverride` and returns scoped `debug` payload: `timestamp`, `model`, `isResummarize`, `prompt`, `input`, `formatted`, `rawResponse`, `characterId`, `chatId`, `start`, `end`, `source`, `promptSource` |
| POST | `/data/memory/hypav3/manual-summarize/trace` | `hypav3_trace_routes.cjs` | Trace/preview manual summarization. Supports optional request `promptOverride` |
| POST | `/data/memory/hypav3/resummarize-preview` | `hypav3_resummary_routes.cjs` | Preview re-summarization of existing summaries |
| POST | `/data/memory/hypav3/resummarize-apply` | `hypav3_resummary_routes.cjs` | Apply re-summarization |
| POST | `/data/memory/hypav3/resummarize-preview/trace` | `hypav3_trace_routes.cjs` | Trace re-summarization |
| POST | `/data/memory/hypav3/periodic-summarize/trace` | `hypav3_trace_routes.cjs` | Trace periodic summarization |

### Other Routes

| File | Endpoints | Description |
|------|-----------|-------------|
| `memory_routes.cjs` | Memory-related endpoints | Memory system management |
| `proxy_routes.cjs` | `/data/proxy` | Reverse proxy passthrough |
| `integration_routes.cjs` | `/data/integrations/comfy/*` | Core Comfy Commander proxy (`/cw`, `/comfy`) |
| `legacy_routes.cjs` | `/data/auth/*`, `/data/storage/*`, `/data/oauth/*` | Legacy auth and raw storage |
| `system_routes.cjs` | `/` | Root handler, retired endpoint stubs |

Core ownership note for Comfy Commander:

- Client runtime lives in `src/ts/integrations/comfy/*`.
- Core commands (`/cw`, `/comfy`) dispatch through this server route.
- No legacy `/proxy`/`/proxy2` path is used for Comfy Commander.

## LLM Pipeline (`server/node/llm/`)

### Core Pipeline

| File | LOC | Purpose |
|------|-----|---------|
| `engine.cjs` | 393 | Provider router — dispatches to correct handler by provider name |
| `prompt.cjs` | 778 | Server-side prompt assembly: system prompt, lorebook, memory, depth prompts, format order |
| `lorebook.cjs` | 95 | Keyword/regex lorebook matching against chat history |
| `scripts.cjs` | 171 | Regex script processing, `risuChatParser` variable substitution, thought block stripping |
| `tokenizer.cjs` | 51 | Token counting for prompt budget management |
| `memory.cjs` | 590 | HypaV3 memory: summary selection (important + recent + similar + random), embedding |
| `generate_helpers.cjs` | 391 | Generate-mode orchestration: periodic HypaV3 triggers, payload building |
| `execute_route_handler.cjs` | 465 | `/data/llm/execute` handler: raw execution + `[SYSTEM]` game-state extraction |
| `execution_helpers.cjs` | — | Mode normalization, provider/model selection, internal execution detection |

### Provider Handlers

| File | LOC | Provider |
|------|-----|----------|
| `openrouter.cjs` | 468 | OpenRouter (streaming + non-streaming) |
| `openai.cjs` | 193 | OpenAI-compatible APIs |
| `anthropic.cjs` | 203 | Anthropic Claude (message format conversion) |
| `google.cjs` | 168 | Google Gemini |
| `deepseek.cjs` | 196 | DeepSeek |
| `mistral.cjs` | 182 | Mistral AI |
| `ollama.cjs` | 211 | Ollama (local) |
| `ooba.cjs` | 156 | Text Generation WebUI |
| `kobold.cjs` | 153 | KoboldAI |
| `novelai.cjs` | 148 | NovelAI |
| `horde.cjs` | 174 | AI Horde |
| `reverse_proxy.cjs` | 315 | User-configured reverse proxy |
| `custom.cjs` | 307 | Custom `xcustom:::` endpoints |

### Supporting

| File | LOC | Purpose |
|------|-----|---------|
| `audit.cjs` | 304 | Durable JSONL audit log append/read |
| `audit_payloads.cjs` | 207 | Audit request/response payload builders |
| `trace_audit.cjs` | 145 | Generate/memory trace audit appenders |
| `hypa_helpers.cjs` | 195 | HypaV3 summarization helpers (prompt building, embedding, persistence) |
| `constants.cjs` | — | Provider constants, migrated provider set |
| `errors.cjs` | — | `LLMHttpError` class |
| `index.cjs` | — | Module re-exports |
| `logger.cjs` | — | Structured logging |

## RAG Pipeline (`server/node/rag/`)

| File | LOC | Purpose |
|------|-----|---------|
| `engine.cjs` | 418 | Core RAG: chunking, cosine similarity search, rulebook caching, metadata updates |
| `embedding.cjs` | 67 | HuggingFace Transformers embedding pipeline (server-side, CPU) |
| `aux_transformers.cjs` | — | Server-side summarization and image-caption pipelines |
| `pdf.cjs` | 322 | PDF text extraction with column awareness, table detection, low-signal line filtering |
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
  │                               │  ├─ HypaV3 memory injection
  │                               │  ├─ RAG search + context injection
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
├── users/default/
│   ├── settings.json
│   ├── characters/
│   │   └── {characterId}/
│   │       ├── character.json
│   │       └── chats/
│   │           └── {chatId}.json
│   ├── assets/other/          # Uploaded images/files
│   ├── plugins/               # Plugin files
│   ├── prompts/               # Prompt presets
│   ├── themes/                # UI themes
│   ├── color_schemes/         # Color schemes
│   └── rag/
│       └── rulebooks/
│           └── {rulebookId}.json  # Chunks + embeddings
├── models/                    # Cached embedding models
└── logs/
    └── llm-audit.jsonl        # Durable LLM execution logs
```

## Client-Server Gating

The client uses server-only runtime (`isNodeServer` is forced `true` in `src/ts/platform.ts`).

| Module | Active path |
|--------|-------------|
| `request.ts` | Calls `/data/llm/generate` or `/data/llm/execute` |
| `openAI.ts` | Routes through `requestServerExecution()` |
| `rag/rag.ts` | Calls `/data/rag/ingest`, `/data/rag/search` |
| `rag/storage.ts` | Calls `/data/rag/rulebooks` CRUD |
| `serverDb.ts` | REST wrapper for `/data/*` storage |
| `index.svelte.ts` | Server flushes chat snapshots, syncs game state |

## Dependency Injection

The server uses a factory/DI pattern: `server.cjs` creates helper instances and passes them as arguments to route registration functions. This avoids circular requires and makes testing possible.

Example: `registerRagRoutes({ app, fs, dataDirs, generateEmbeddings, ... })`

Each route module receives only the dependencies it needs.
