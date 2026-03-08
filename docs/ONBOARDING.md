# Developer Onboarding

Last updated: 2026-02-21

This document is the starting point for anyone working on this codebase. Read it before reading anything else.

---

## 1. What Is This App

RisuAI is a server-first AI chat application.

| Mode | How it runs | LLM execution |
|------|-------------|---------------|
| **Web (Server-only)** | Browser SPA | Node.js server (required) |

The Node.js server owns all LLM execution, prompt assembly, RAG, and memory. The client is a Svelte 5 SPA that renders results and delegates work to the server via HTTP.

---

## 2. Repo Layout

```
/
├── src/                        # Svelte 5 client SPA
│   ├── lib/                    # UI components
│   │   ├── ChatScreens/        # Chat runtime (Chat.svelte, Message.svelte, etc.)
│   │   ├── SideBars/           # Right sidebar (CharConfig, SideChatList, GameState, LoreBook)
│   │   ├── Setting/            # Settings pages
│   │   ├── Others/             # Modals, RulebookManager, AlertComp, etc.
│   │   └── UI/                 # Shared UI primitives
│   └── ts/                     # TypeScript logic
│       ├── process/            # Core processing pipeline
│       │   ├── index.svelte.ts # Chat orchestration (large — active split target)
│       │   ├── request/        # LLM request handlers (openAI.ts, request.ts, etc.)
│       │   ├── rag/            # Client-side RAG (rag.ts, chunker.ts, ingest-stream.ts)
│       │   ├── memory/         # HypaV3 memory client
│       │   ├── mcp/            # MCP integration
│       │   └── prompt.ts       # Prompt assembly types
│       ├── storage/            # Storage layer (database.svelte.ts, serverDb.ts, etc.)
│       ├── plugins/            # Plugin system (API v3, sandbox)
│       ├── platform.ts         # isNodeServer flag — THE client/server gate
│       └── globalApi.svelte.ts # globalFetch and shared API helpers
│
├── server/node/                # Node.js / Express server
│   ├── server.cjs              # Entry point and bootstrap orchestrator
│   ├── server_*.cjs            # Infrastructure helpers (paths, http, DI bootstrap)
│   ├── storage_utils.cjs       # ETag + safe path primitives
│   ├── routes/                 # HTTP route registration (one file per domain)
│   │   ├── llm_routes.cjs      # /data/llm/*
│   │   ├── storage_routes.cjs  # /data/settings, /data/characters, /data/chats
│   │   ├── rag_routes.cjs      # /data/rag/* + /data/embeddings + /data/transformers/*
│   │   ├── content_routes.cjs  # /data/assets, /data/plugins, /data/prompts, etc.
│   │   ├── memory_routes.cjs   # /data/memory/hypav3/*
│   │   ├── proxy_routes.cjs    # /data/proxy
│   │   ├── legacy_routes.cjs   # /data/auth/*, /data/storage/* (backward compat)
│   │   ├── system_routes.cjs   # /, retired /api/* (410)
│   │   └── integration_routes.cjs  # /data/integrations/comfy/*
│   └── llm/                    # LLM domain logic
│       ├── engine.cjs          # Provider dispatch
│       ├── prompt.cjs          # Prompt assembly
│       ├── lorebook.cjs        # Lorebook injection
│       ├── memory.cjs          # HypaV3 memory
│       ├── audit.cjs           # Durable JSONL execution log
│       ├── [provider].cjs      # One file per LLM provider (openai, anthropic, etc.)
│       └── ...
│   └── rag/                    # RAG domain logic
│       ├── engine.cjs          # Search, chunking, caching
│       ├── embedding.cjs       # HuggingFace transformers embedding pipeline
│       ├── pdf.cjs             # PDF text extraction
│       └── model.cjs           # Embedding model name resolver
│
├── prototypes/structure-lab/moescape-concept/   # UI Shell V2 prototype (vanilla JS)
│   ├── app.js                  # Prototype app logic
│   ├── index.html              # Prototype shell
│   ├── styles.css              # Prototype design system CSS
│   └── docs/                   # Prototype-local copies of docs (kept in sync with docs/)
│
├── docs/                       # All canonical project documentation (← you are here)
├── data/                       # Runtime data — gitignored (characters, chats, settings)
├── CONVENTIONS.md              # Repo-wide development rules — read this
├── plan.md                     # Current priorities and task tracking
└── plugins.md                  # Plugin system developer guide
```

---

## 3. The Client/Server Gate

The single most important concept in this codebase is `isNodeServer` in `src/ts/platform.ts`:

```typescript
export const isNodeServer: boolean = true;
```

**This flag determines everything:** the app always runs against the Node server. Client delegates LLM, RAG, memory, and storage to server endpoints.

Any code should treat server endpoints as the source of truth:

```typescript
import { isNodeServer } from 'src/ts/platform';

if (isNodeServer) {
  // call the server endpoint — no logic here, just delegation
  return globalFetch('/data/some/endpoint', { ... });
}
throw new Error('Server-only runtime is required.');
```

See `docs/SERVER_RULES.md` section I for the full boundary contract.

---

## 4. Development Commands

```bash
# Install dependencies
pnpm install

# Client dev server (hot reload)
pnpm dev

# Node.js server (separate terminal)
pnpm run runserver

# Lint (must pass before commit)
pnpm lint

# Type check (must pass before commit)
pnpm check

# Strict type migration check (optional, tracked debt)
pnpm run check:strict

# Strict migration ratchet (fails only when strict error count increases)
pnpm run check:strict:ratchet

# Tests (must pass before commit)
pnpm test

# Server static contracts (must pass before commit)
pnpm run check:server

# Server runtime contracts (must pass before commit)
pnpm run check:server:contracts

# LOC warning check (warns when files exceed 500 lines)
pnpm run check:loc

# Server unit tests — no server needed, run before every commit that touches server/node/llm/
node scripts/test-memory-unit.cjs

# Server smoke tests — requires running server (see Section 10 for safe workflow)
RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node scripts/test-server-memory.js
# Or via npm: pnpm run smoke:memory:api

# Prototype type/design checks
pnpm run check:prototype

# Build for production
pnpm build
```

For server-first mode locally: run both `pnpm dev` and `pnpm run runserver`. The client at `localhost:5173` proxies API calls to the server at `localhost:6001`.

Memory sidebar note: in embedded right-sidebar Memory mode, manual HypaV3 summarize (`Start/End + Summarize`) always targets the currently active chat (`chatPage`).

### Git Hook Setup (one-time per clone)

Enable repository-managed hooks so the LOC warning check runs on every commit:

```bash
git config core.hooksPath .githooks
```

### Data Safety — Read Before Running Any Server Script

> **WARNING:** `data/` is live user data — characters, chats, settings, embeddings, and API keys. It is gitignored and never backed up by git. Smoke scripts that use `RISU_STORAGE_TEST_ALLOW_WRITE=1` will write to whatever server is running. If that server is pointed at `data/`, your production data will be modified or overwritten.

| Command | Data root | Safe for testing? |
|---------|-----------|-------------------|
| `pnpm run runserver` | `data/users/default/` | **No — production data** |
| `pnpm run runserver:tmp` | `/tmp/risu-smoke-data` | Yes, but may persist across reboots |
| `pnpm run runserver:test` | `.dev-test-data/` | **Yes — isolated, gitignored** |

**Rules:**
1. **Run smoke tests against `runserver:test`, not `runserver`.**
2. `smoke:server:auth` requires a clean data root (no password set). If it fails on startup, run `pnpm run smoke:reset-test` and restart `runserver:test`.
3. `pnpm check` is `svelte-check` — a read-only type checker. It never touches `data/` or any runtime files.
4. Back up `data/` manually before any experiment that touches the live server.

### Required Pre-PR Checks
- `pnpm lint --max-warnings 0` — zero warnings allowed; CI fails on any warning
- `pnpm check`
- `pnpm test`
- `pnpm run check:server`
- `pnpm run check:server:contracts`
- `pnpm run check:settings-smoke` — if you touched anything in `src/lib/Setting/` or setting-related TS files
- `pnpm run check:ui-shell-smoke` — if you touched shell routing/layout in `src/App.svelte`, `src/lib/UI/AppShellV2.svelte`, or workspace shell wrappers
- `node scripts/test-*-unit.cjs` — if you touched any pure function in `server/node/`
- `node scripts/test-server-*.js` (against `runserver:test`) — if you added or changed any server endpoint

### TypeScript Strictness Policy
- The repository is in staged strict migration mode:
  - `strict: false`
  - `strictNullChecks: false`
  - `noImplicitAny: false`
- Strict migration is tracked separately with `pnpm run check:strict` (`tsconfig.strict.json`).
- Use `pnpm run check:strict:ratchet` to ensure strict errors never increase above baseline (`dev/strict-baseline.json`).
- Treat strict-check findings as migration debt and fix them in dedicated slices.

### Node Server Password (First Run)
- On first protected `/data/*` request, if no password is configured, the UI prompts to set one.
- Password auth token is stored per-tab in `sessionStorage.risuauth` (legacy `localStorage.risuauth` is auto-migrated and cleared).
- Server stores password record in `<dataRoot>/save/__password` as `scrypt$...` (`data/users/default` by default).
- Change password from UI in:
  - `Settings -> Advanced -> Server password status -> Change Server Password`
  - Change flow asks for current password, then new password + confirmation.
- For script-based API calls, pass:
  - `RISU_AUTH_TOKEN=<sha256(password)>`

---

## 5. Rules — Where to Read Them

There are four rule documents. Read them in this order:

### 1. `CONVENTIONS.md` (repo root) — start here
Applies to all code. Covers:
- Security (no eval, no unsanitized innerHTML)
- File size limits (500 LOC max for new files)
- Type safety (no `any`)
- Error handling (structured Result types)
- State management (no mixed Svelte 4/5 patterns)
- Merge requirements (`pnpm check` + `pnpm test` must pass)
- Severity triage (P0–P3)

### 2. `docs/SERVER_RULES.md` — for any server work
Applies to `server/node/`. Covers:
- What belongs on the server vs. client
- Dependency injection pattern (how all server modules are wired)
- Route handler contract (validation, response helpers, error shape, try/catch)
- File I/O safety (requireSafeSegment, safeResolve, ETag concurrency)
- Streaming NDJSON contract
- Security (path traversal, no secrets in responses, no shell exec)
- New endpoint checklist

### 3. `docs/DESIGN_RULES.md` — for any UI work
Applies to the prototype and guides production UI migration. Covers:
- Shell/navigation contract (enterXView, drawer architecture, view routing)
- Layout invariants (what scrolls, z-index stack, layer tokens)
- State model (selectedCharacterId, selectedChatId, sidebar state)
- Rendering boundaries (replaceMarkup, innerHTML rules)
- Component composition, accessibility baseline
- Active-state patterns (tab-pattern vs. list-pattern)
- Full CSS token reference

### 4. `docs/TESTING_RULES.md` — testing mandate
Covers the mandatory server-feature test requirement (Section 4 — unit tests + smoke tests for every server change) and the prototype/UI manual smoke pass steps.

---

## 6. Documentation Map

| Document | What it covers |
|----------|---------------|
| `CONVENTIONS.md` | All repo rules (security, types, architecture, workflow) |
| `plan.md` | Current priorities, risk register, task tracking |
| `docs/ONBOARDING.md` | This file |
| `docs/SERVER_ARCHITECTURE.md` | Full server endpoint catalog, module descriptions, request flows |
| `docs/SERVER_RULES.md` | Server coding rules and contracts |
| `docs/SERVER_CODE_REVIEW.md` | Current server audit (known issues, fix priorities) |
| `docs/DESIGN_RULES.md` | UI design contracts (shell, navigation, tokens, state) |
| `docs/TESTING_RULES.md` | Server-feature test mandate (unit + smoke required) and prototype smoke pass checklist |
| `docs/UI_CHANGE_CHECKLIST.md` | Per-change UI verification checklist |
| `docs/CONCEPT_COMPLETION_CHECKLIST.md` | Gate checklist before UI migration from prototype to production |
| `docs/MIGRATION_PLAN.md` | UI Shell V2 migration phases and rollout strategy |
| `docs/MIGRATION_MAP.md` | Prototype component → real Svelte component mapping |
| `docs/CORE_PRODUCT_SPEC.md` | Product pillars, domain model, workspace contracts |
| `docs/UI_SYSTEM_REDESIGN_RFC.md` | Unified app shell design spec |
| `docs/MOBILE_NAV_PLAN.md` | Mobile navigation redesign spec |
| `docs/MIGRATION_SMOKE_CHECKLIST.md` | API smoke pack and export/import regression gates |
| `docs/EMOTION_GENERATION_SYSTEM_FLOW.md` | Emotion detection pipeline |
| `plugins.md` | Plugin system developer guide (API v3) |
| `COMFY_COMMANDER.md` | Comfy Commander plugin setup |

---

## 7. Key Files to Know

### Client

| File | What it is |
|------|-----------|
| `src/ts/platform.ts` | `isNodeServer` flag — the client/server gate |
| `src/ts/globalApi.svelte.ts` | `globalFetch` — all client HTTP calls go through here |
| `src/ts/process/index.svelte.ts` | Chat orchestration — large, active split target |
| `src/ts/process/request/request.ts` | LLM request router (delegates to server endpoints) |
| `src/ts/storage/database.svelte.ts` | DB schema, migrations, and reactive DB state |
| `src/ts/process/rag/rag.ts` | RAG class (delegates to server in server-first mode) |
| `src/lib/SideBars/CharConfig.svelte` | Character config sidebar (Basics/Display/Lorebook/etc.) |
| `src/lib/ChatScreens/Chat.svelte` | Chat message runtime |

### Server

| File | What it is |
|------|-----------|
| `server/node/server.cjs` | Entry point — bootstrap and wiring only (283 lines) |
| `server/node/routes/llm_routes.cjs` | `/data/llm/*` endpoints |
| `server/node/routes/storage_routes.cjs` | `/data/settings`, `/data/characters`, `/data/chats` |
| `server/node/routes/rag_routes.cjs` | `/data/rag/*`, `/data/embeddings`, `/data/transformers/*` endpoints |
| `server/node/llm/engine.cjs` | LLM provider dispatch |
| `server/node/llm/prompt.cjs` | Server-side prompt assembly |
| `server/node/llm/audit.cjs` | Durable LLM execution log (JSONL) |
| `server/node/rag/engine.cjs` | RAG search and chunk management |
| `server/node/rag/embedding.cjs` | HuggingFace embedding pipeline |
| `server/node/server_helpers.cjs` | `sendJson`, `sendSSE`, `requireSafeSegment` |
| `server/node/storage_utils.cjs` | `safeResolve`, `computeEtag`, `requireIfMatch` |

---

## 8. Current State and Active Work

### What is complete
- **Server-first architecture**: Node.js server handles all LLM execution (15+ providers), prompt assembly, RAG ingestion and search, HypaV3 memory summarization
- **Server decomposition**: `server.cjs` decomposed from 5k+ LOC into 40+ focused modules using DI pattern
- **Client gating**: `isNodeServer` is forced `true` for server-only runtime
- **Type/test gates green**: `pnpm check` = 0 errors, `pnpm test` = all passing
- **Lint gate**: `pnpm lint --max-warnings 0` is enforced in CI. There is an existing backlog of warnings being resolved in dedicated fix branches — do not add new ones

### What is in progress / next
See `plan.md` for the full priority list. Short version:

**P0 — fix before shipping:**
- `RulebookRagSetting` not yet wired into `CharConfig.svelte`
- Validate first-run/password UX across LAN multi-device usage (server auth hardening landed on 2026-02-19)

**P1 — fix before next feature:**
- Missing try/catch on ~16 async server handlers
- Inconsistent response shapes in older route files

**P2 — UI migration (blocked on concept checklist):**
- UI Shell V2 migration from prototype to production (see `docs/MIGRATION_PLAN.md`)
- Gate: `docs/CONCEPT_COMPLETION_CHECKLIST.md` must be fully signed off first

**Security debt (address before any public deployment):**
- Direct `innerHTML` assignments without `DOMPurify.sanitize()` — now flagged automatically by `no-restricted-syntax` lint rule; fix violations as you touch affected files

---

## 9. Before You Commit

1. `pnpm lint --max-warnings 0` — must show 0 warnings (CI gate; do not introduce new warnings)
2. `pnpm check` — must show 0 errors
3. `pnpm test` — must show all tests passing
4. `pnpm run check:server` + `pnpm run check:server:contracts` — server static and runtime checks
5. If you touched `server/node/` pure functions: run `node scripts/test-*-unit.cjs` — all must pass
6. If you added or changed a server endpoint: run `node scripts/test-server-*.js` against `runserver:test` — all must pass; new endpoints need new smoke tests (see `docs/TESTING_RULES.md` Section 4)
7. If you touched `src/lib/Setting/` or setting-related TS: `pnpm run check:settings-smoke`
8. If you touched `prototypes/structure-lab/moescape-concept/`: `pnpm run check:prototype`
9. If you changed UI shell/navigation/routing: run `pnpm run check:ui-shell-smoke`
10. If you changed server endpoints: update `docs/SERVER_ARCHITECTURE.md`
11. If you changed UI shell/navigation/routing: update `docs/DESIGN_RULES.md` and `docs/UI_CHANGE_CHECKLIST.md`
12. No new `any`, `console.log`, unsanitized `innerHTML`, or files over 500 LOC

Full rules: `CONVENTIONS.md`. Server-feature test spec: `docs/TESTING_RULES.md` Section 4.

---

## 10. Smoke Scripts

Smoke scripts make live HTTP calls to a running server. They must always be run against an isolated test server — **never against `runserver` (production data)**.

### Safe workflow

```bash
# Terminal 1 — start isolated test server
pnpm run runserver:test

# Terminal 2 — run smoke tests against it
pnpm run smoke:server:safe
pnpm run smoke:migration:api
```

### `smoke:server:auth` — special case

The auth smoke requires the server to have **no password set**. It will exit immediately with a clear message if a password already exists:

```
auth smoke needs clean data root (expected unset, got correct).
Use SERE_DATA_ROOT=/tmp/... when starting server.
```

Reset and restart before running it:

```bash
pnpm run smoke:reset-test   # wipes .dev-test-data/
# restart runserver:test in Terminal 1
pnpm run smoke:server:auth
```

### Script reference

| Script / command | What it tests | Writes data? | Needs clean root? |
|-----------------|--------------|-------------|-------------------|
| `node scripts/test-memory-unit.cjs` | HypaV3 memory pipeline — pure functions, no server | No | No |
| `smoke:server:safe` | Storage CRUD, LLM phase A dispatch, memory API | Yes (`RISU_STORAGE_TEST_ALLOW_WRITE=1`) | No |
| `smoke:server:auth` | Password set / change / lockout flow | Yes (sets a server password) | **Yes** |
| `smoke:memory:api` | HypaV3 memory trace endpoints | Yes | No |
| `smoke:migration:api` | Migration smoke pack | Yes | No |
| `smoke:app:auto` | Full app smoke (automated) | Read-heavy | No |

### Helper scripts

| Script | What it does |
|--------|-------------|
| `runserver:test` | Starts server with `.dev-test-data/` as data root (gitignored, safe to wipe) |
| `runserver:tmp` | Starts server with `/tmp/risu-smoke-data` (may persist between reboots) |
| `smoke:reset-test` | Deletes `.dev-test-data/` — run before `smoke:server:auth` for a clean slate |
