# RisuAI Node Server

Last reviewed: 2026-02-15

> Warning: Node server is planned to be deprecated in future versions, replaced with [Hono](https://hono.dev/) based server for broader runtime support.

## What This Server Handles Today
- Server-first storage API (`/data/*`) for settings, characters, chats, assets, prompts/themes/color schemes, plugin data.
- LLM migration endpoints (provider rollout phase):
  - `POST /data/llm/preview`
  - `POST /data/llm/execute`
  - `POST /data/llm/generate` (Phase 2 scaffold: server-side minimal message assembly from `characterId` + `chatId` + `userMessage`)
  - `GET /data/llm/logs` (durable JSONL execution logs)
- OpenRouter model catalog endpoint:
  - `GET /data/openrouter/models` (upstream fetch + cache fallback)
- Server-side local model utilities:
  - `POST /data/embeddings`
  - `POST /data/transformers/summarize`
  - `POST /data/transformers/image-caption`

## Start
```bash
pnpm run runserver
```

Default port: `6001`.

If HTTPS cert files are missing, server falls back to HTTP automatically.

## Dev Mode Integration
When using `pnpm dev`, Vite proxies `/data` to `http://localhost:6001`.

By default, the frontend treats `pnpm dev` as node-server mode (`__RISU_DEV_NODE_SERVER__` enabled).  
Set `RISU_DEV_NODE_API=0` before `pnpm dev` to disable this behavior.

## Server Password Flow
- Password bootstrap endpoints stay public:
  - `POST /data/auth/crypto`
  - `GET /data/auth/password/status`
  - `POST /data/auth/password`
- All other `/data/*` routes require `risu-auth` once password is set.
- First run in node-server mode:
  - If no password exists, client prompts to set one on the first protected API call.
  - Password record is saved to `<dataRoot>/save/__password` as a `scrypt$...` hash record.
    - default data root: `data/users/default`
    - legacy fallback for existing installs: `./save/__password`
- Change password in UI:
  - Open **Settings -> Advanced -> Server password status -> Change Server Password**.
  - Change requires entering the current password, then the new password (with confirmation).
- For API/smoke scripts, pass the auth token with:
  - `RISU_AUTH_TOKEN=<sha256 password digest>`

## Durable LLM Logs
- Log file: `data/logs/llm-execution.jsonl`
- Endpoint: `GET /data/llm/logs`
- Filters: `limit`, `chatId`, `requestId`, `endpoint`, `provider`, `status`, `since`
- Sensitive fields (keys/tokens/password-like fields) are redacted in persisted logs.
- Optional log mode env vars:
  - `RISU_LLM_LOG_MODE=full|compact|metadata` (default: `full`)
  - `RISU_LLM_LOG_SPLIT_DAILY=1` to write daily files (`llm-execution-YYYY-MM-DD.jsonl`)
  - `RISU_LLM_LOG_RETENTION_DAYS=<N>` to purge old log files
  - `RISU_AUDIT_INCLUDE_FULL_GENERATE_REQUEST=1` to keep full `/data/llm/generate` request payloads in durable logs (default: compact summary only)

## Current LLM Migration Limits
- Provider support in server execution is currently OpenRouter + OpenAI + DeepSeek + Anthropic + Google + Mistral + Cohere + Ollama + Kobold + NovelAI + Horde + Ooba + Reverse Proxy + Custom (`xcustom:::`).
- Non-migrated providers return `PROVIDER_NOT_MIGRATED`.
- Streaming on server path is implemented on `POST /data/llm/execute` (SSE).
- Streaming is also available on `POST /data/llm/generate` because it reuses the execute pipeline.
- `POST /data/llm/generate` now does server-side baseline assembly from stored character/chat data:
  - main/system prompt
  - chat history
  - global note
  - author note
  - current user message
  - character depth prompt injection
- Full parity prompt-template/lorebook/memory assembly is still pending; client-side assembly can be used explicitly via `useClientAssembledRequest: true` during transition.
- `POST /data/llm/generate` currently supports scaffolded raw-assembly provider set: OpenRouter/OpenAI/DeepSeek/Anthropic/Google/Mistral.
- Node-server client routing now uses `/data/llm/generate` broadly:
  - raw server-assembly path for scaffolded providers
  - compatibility path (`useClientAssembledRequest: true`) for providers that still depend on client-assembled provider-specific request shapes (e.g. `reverse_proxy`, `custom`, `novelai`, `ooba`, `kobold`, `ollama`, `cohere`, `horde`).
- Model picker now shows all providers/models in UI; execution migration state is enforced server-side.

## Smoke Tests

Always use an isolated temp data root — never point smoke tests at `data/users/default`.

**Terminal 1 — start clean server:**

```bash
SERE_DATA_ROOT=/tmp/risu-smoke-data node server/node/server.cjs
# or: pnpm runserver:tmp
```

**Terminal 2 — run tests:**

```bash
# Storage CRUD
RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-storage.js

# LLM migration phase A
RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-llm-phaseA.js

# HypaV3 memory pipeline (unit — no server needed)
node scripts/test-memory-unit.cjs

# HypaV3 memory pipeline (integration — requires server)
RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-memory.js

# Auth flow
RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-auth.js

# Migration smoke pack
RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node dev/run-migration-smoke-pack.js
```

**Or via npm scripts (server must already be running on :6001):**

```bash
pnpm run smoke:memory:api     # HypaV3 memory integration tests
pnpm run smoke:server:auth    # Auth flow
pnpm run smoke:server:safe    # Storage + LLM + memory (combined)
```

**Auth token (when server has a password set):**

```bash
RISU_TEST_AUTH_TOKEN=<sha256-digest> RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-memory.js
```

See `docs/TESTING_RULES.md` Section 4 for the full testing mandate.

## Dist vs Dev
- `pnpm run runserver` serves `dist/` static client files, so rebuild UI with `pnpm build` after frontend changes.
- `pnpm dev` serves live source via Vite (no rebuild required for UI changes).
