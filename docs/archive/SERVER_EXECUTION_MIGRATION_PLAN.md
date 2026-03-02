# Server Execution Migration Plan

Last updated: 2026-02-12

## Archive Status Note (2026-02-21)

This file is retained as a historical migration snapshot. It is not the current source of truth.

Current-state deltas since this snapshot:
- Server execution is no longer OpenRouter-only; migrated providers include OpenAI/DeepSeek/Anthropic/Google/Mistral/Cohere/Ollama/Kobold/NovelAI/Horde/Ooba/Reverse Proxy/Custom.
- LLM route handlers are no longer in `server/node/server.cjs`; they live in `server/node/routes/llm_routes.cjs`.
- `/proxy2` is not an active server runtime route in the current Node server.
- The `STREAMING_NOT_IMPLEMENTED` sentinel referenced below is historical for the early B1 slice.

Use these as current references instead:
- `plan.md` (single source of truth for active work)
- `docs/ONBOARDING.md`
- `docs/SERVER_RULES.md`

## Purpose
Migrate LLM execution from client-side inference to server-authoritative execution, starting with `sendChat`, then expanding to all other LLM call sites.

This plan records agreed decisions for all agents working this track.

## Agreed Decisions (Historical snapshot)
1. Start with `sendChat` migration first. If stable, migrate remaining call sites.
2. Persistence model is **server atomic persistence**:
   - Server executes generation and persists resulting chat/memory updates itself.
   - Client must not be authoritative for generation writes after migration.
3. Move trigger/script prompt mutation to server execution path.
4. Initial provider rollout is **OpenRouter only**.
5. All other providers are blocked until explicitly migrated.
6. Prompt preview parity is required (`request` payload + `promptBlocks` style output).
7. Remove `/proxy2` entirely after migration, and update Comfy Commander to a new dedicated path.

## Current Baseline (Verified on 2026-02-12, stale)
- Main chat orchestration still runs in client:
  - `/Users/andrewbostan/Documents/RisuAII/src/ts/process/index.svelte.ts`
  - prompt assembly/lorebook/memory/request dispatch are still client-side in this phase.
- OpenRouter `sendChat` transport is server-routed in node-server mode:
  - `/Users/andrewbostan/Documents/RisuAII/src/ts/process/request/openAI.ts:136`
  - request path calls `POST /data/llm/execute`.
- Request engine runs in client:
  - `/Users/andrewbostan/Documents/RisuAII/src/ts/process/request/request.ts:289`
  - provider dispatch at `/Users/andrewbostan/Documents/RisuAII/src/ts/process/request/request.ts:564`
- Server LLM endpoints + audit:
  - `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:720` (`POST /data/llm/preview`)
  - `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:804` (`POST /data/llm/execute`)
  - `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:907` (`GET /data/llm/logs`)
  - `/Users/andrewbostan/Documents/RisuAII/server/node/llm/audit.cjs` (JSONL durable log writer/reader + redaction)
- Proxy path currently used by client transport:
  - `/Users/andrewbostan/Documents/RisuAII/src/ts/globalApi.svelte.ts:821`
  - `/Users/andrewbostan/Documents/RisuAII/src/ts/globalApi.svelte.ts:1626`
  - `/Users/andrewbostan/Documents/RisuAII/server/node/server.cjs:221`
- Comfy Commander hardcodes `/proxy2`:
  - `/Users/andrewbostan/Documents/RisuAII/src/comfy_commander.js:449`

## Target Architecture
### Server responsibilities
1. Load authoritative settings/character/chat from `/data`.
2. Build prompt context (including lorebook and memory decisions).
3. Run trigger/script prompt mutation required for request parity.
4. Execute provider call (OpenRouter in phase 1).
5. Persist assistant output and memory updates atomically.
6. Return response stream/result and execution metadata.

### Client responsibilities
1. Collect user input and invoke server execution endpoint.
2. Render streaming/output UX only.
3. Refresh/update local state from server response payload.
4. No direct model inference transport in server mode.

## Server API Plan
### New endpoints
1. `POST /data/llm/execute`
   - Runs full server execution pipeline.
   - Supports streaming and non-stream responses.
2. `POST /data/llm/preview`
   - Returns preview payload with:
     - provider request body (sanitized)
     - `promptBlocks` equivalent for UI parity

### Request shape (high-level)
- Resource IDs: `characterId`, `chatId`
- Mode: `model|submodel|memory|emotion|translate|otherAx` (phase-dependent)
- Execution options: continue, streaming, preview flags, request-specific knobs
- Optional client context hashes for diagnostics only (not as source of truth)

### Response shape (high-level)
- `type`: success | fail | streaming
- `result` or stream chunks
- `generationInfo` data
- optional updated resource snapshots/etags
- clear block error for unmigrated providers

## Atomic Persistence Strategy
1. Server computes output and memory/lorebook-derived updates.
2. Server writes updated chat resource with `If-Match` guard.
3. Message append + memory field updates are persisted together in one chat write.
4. On conflict:
   - return explicit conflict payload
   - include latest server resource
   - client shows refresh/retry flow

Notes:
- If any character-level fields need mutation for a request, write in same execution critical section after chat write with matching ETag checks.
- Add per-execution request id in logs.

## Provider Rollout and Blocking
### Phase 1
- Supported: `openrouter` only.
- Block all other providers with explicit error:
  - `"Provider not migrated to server execution yet: <provider>"`
  - status should be deterministic and testable.

### Later phases
- Add Anthropic, Google, and remaining providers one-by-one with parity tests before enabling.

## Execution Phases
### Phase A: Contract + Skeleton
1. Add endpoint scaffolding in node server for execute/preview.
2. Add server module boundaries (recommended path): `server/node/llm/*`
3. Add logging for execution:
   - request id, mode, provider, character id, chat id, status, duration, conflict reason.

### Phase A Status (2026-02-11)
- Implemented scaffold modules:
  - `/Users/andrewbostan/Documents/RisuAII/server/node/llm/constants.cjs`
  - `/Users/andrewbostan/Documents/RisuAII/server/node/llm/errors.cjs`
  - `/Users/andrewbostan/Documents/RisuAII/server/node/llm/logger.cjs`
  - `/Users/andrewbostan/Documents/RisuAII/server/node/llm/engine.cjs`
  - `/Users/andrewbostan/Documents/RisuAII/server/node/llm/index.cjs`
- Added endpoints:
  - `POST /data/llm/preview`
  - `POST /data/llm/execute`
- Added structured LLM API logs in Node server route path.
- Added LLM smoke test script:
  - `/Users/andrewbostan/Documents/RisuAII/scripts/test-server-llm-phaseA.js`

### Phase B: `sendChat` Migration (OpenRouter only)
1. Move `sendChat` model request path to `POST /data/llm/execute`.
2. Server performs prompt assembly/lorebook/memory for this path.
3. Server performs trigger/script prompt mutation needed by request path.
4. Server persists output atomically.
5. Maintain preview parity with `POST /data/llm/preview`.
6. Add provider block gate for non-OpenRouter.

### Phase B1 Status (2026-02-12)
- Implemented OpenRouter transport migration for `sendChat` request path:
  - client OpenRouter request path now targets server execution endpoint in server mode.
  - direct OpenRouter client transport is bypassed in server mode.
- Implemented server OpenRouter execution module:
  - server reads OpenRouter key/settings from server `settings.json`.
  - server builds upstream request with server-side auth and provider settings.
  - `POST /data/llm/preview` now returns concrete OpenRouter request preview payload.
- Added explicit key enforcement for execute path:
  - `OPENROUTER_KEY_MISSING` when server settings have no key.
- Added durable server LLM audit logs and UI integration:
  - durable JSONL at `/data/logs/llm-execution.jsonl` (via `server/node/llm/audit.cjs`)
  - `GET /data/llm/logs` endpoint + Request Logs modal integration.
- Added OpenRouter model list endpoint and fallback cache behavior:
  - `GET /data/openrouter/models`
  - memory cache + disk cache fallback with stale metadata.
- Added clearer OpenRouter failure context in client-visible errors:
  - includes request `mode` and `model` context in failures.
  - rate-limit 429 errors are marked no-retry.
- Current known limitation:
  - server execution in this slice is non-streaming for OpenRouter (`STREAMING_NOT_IMPLEMENTED`).
  - prompt/memory/lorebook assembly is still client-side in this slice.
  - atomic server-owned writeback for generation output is not implemented yet.
  - `scripts/test-server-llm-phaseA.js` currently validates deterministic B1 contracts (not full upstream-success parity).

### Phase B1.1 Rollback Note (2026-02-12)
- Per-model OpenRouter provider routing override experiment was reverted.
- Effective behavior now:
  - global provider routing (`settings.openrouterProvider`) only.
  - no per-model provider override selectors in settings UI.

### Phase C: Expand Remaining Call Sites
Migrate all remaining callers from local `requestChatData` to server execution:
- triggers
- scripting APIs
- translator
- plugin helper LLM calls
- suggestions/playground paths

### Phase D: Remove `/proxy2` + Comfy Commander Migration
1. Remove client `/proxy2` model transport paths.
2. Remove server `/proxy2` routes.
3. Replace Comfy Commander `/proxy2` use with dedicated endpoint:
   - suggested path: `POST /data/integrations/comfy/proxy`
   - use allowlist and explicit auth forwarding rules
   - keep plugin UX option (`use_proxy`) mapped to new endpoint

## Testing Plan
### Baseline checks before each batch
1. `pnpm check`
2. `node /Users/andrewbostan/Documents/RisuAII/scripts/test-server-storage.js`
3. `node /Users/andrewbostan/Documents/RisuAII/scripts/test-server-llm-phaseA.js`

### New integration tests to add
1. `scripts/test-server-llm-sendchat-openrouter.js`
   - non-stream success
   - stream contract (`STREAMING_NOT_IMPLEMENTED`) until streaming phase lands
   - preview payload parity (sanitized upstream request shape)
   - atomic persistence verification (future phase)
   - provider block for non-OpenRouter
   - durable log append/read verification (`/data/llm/logs`)
2. `scripts/test-server-llm-callers.js` (phase C)
   - translator/suggestion/plugin/trigger/scripting callers
   - verifies no client inference path remains for migrated callers
3. `scripts/test-comfy-proxy-endpoint.js` (phase D)
   - validates Comfy endpoint behavior after `/proxy2` removal

### Manual checkpoints
1. `pnpm dev` smoke during implementation.
2. For server-mode UI validation:
   - `pnpm build`
   - `pnpm run runserver`
3. Validate:
   - Settings -> Chat Bot -> Model, Parameters, Prompt
   - Advanced Settings -> Show Request Logs (client non-LLM + server durable LLM sections)
   - prompt preview output in DevTool/hotkey path
   - lorebook trigger behavior
   - memory injection behavior
   - conflict behavior with two clients

## Acceptance Criteria
1. `sendChat` path is fully server-executed and atomically persisted.
2. OpenRouter works end-to-end for sendChat in server mode.
3. Non-migrated providers are explicitly blocked.
4. Preview parity is preserved.
5. Remaining call sites are migrated in later phases.
6. `/proxy2` is removed after migration completion, including Comfy Commander migration.

## Risk Register
1. Parity drift from client prompt/parser behavior.
2. Trigger/script behavior mismatch between environments.
3. Multi-client conflicts during generation writeback.
4. Hidden non-chat callers still bypassing server execution.
5. Comfy Commander regression during `/proxy2` removal.

## Agent Notes
1. Follow `AGENTS.md` guardrails.
2. Any deviation from this plan or `SERVER_STORAGE_PLAN.md` must be recorded in `plan.md` with date and rationale.
3. Do not remove `/proxy2` until Comfy Commander endpoint migration is ready and validated.
