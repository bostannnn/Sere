# Code Review Results

Date: 2026-02-06  
Project: `/Users/andrewbostan/Documents/RisuAII`

## Scope

- Re-validated current diagnostics with `pnpm check` (0 errors, 2 warnings).
- Reviewed server-first storage and auth paths in:
  - `server/node/server.cjs`
  - `src/ts/storage/serverDb.ts`
  - `src/lib/UI/GUI/SliderInput.svelte`
  - `src/lib/Others/HypaV3Modal.svelte`

## Findings

### P1

1. `server/node/server.cjs:182`  
   Password is logged in plaintext on auth failure (`expected: password`), exposing secrets in logs.

2. `server/node/server.cjs:517`  
   Missing `risu-auth` header can crash legacy API routes because code calls `.trim()` without null checks.

3. `server/node/server.cjs:710`  
   Character/chat file paths use unsanitized IDs, allowing path traversal risk via crafted IDs.

### P2

4. `server/node/server.cjs:636`  
   `/data` logs still miss required `resource id` and `conflict reason` fields from policy.

5. `server/node/server.cjs:513`  
   `/api/set_password` always responds with `400`; first-time setup can succeed internally while client sees failure.

6. `src/ts/storage/serverDb.ts:205`  
   Prompt/theme/color persistence has split source of truth (`/data/settings` plus `/data/prompts|themes|color_schemes`), which can drift.

### P3

7. `src/lib/UI/GUI/SliderInput.svelte:26`  
   Slider uses an interactive `div` without semantic slider role/keyboard behavior (a11y warning remains).

8. `src/lib/Others/HypaV3Modal.svelte:984`  
   Manual summarize label is not associated with a control (`for`/`id` mismatch), weakening screen-reader support.

## Answers To Your Questions

### 1) Legacy `/api/*` routes (`read/remove/list/write`) in server-first mode

You can remove them. Keeping both legacy file APIs and server-first `/data/*` APIs increases attack surface, test matrix size, and behavior ambiguity.

Recommended direction:
- Keep `/data/*` as the only persistence API.
- Deprecate then remove legacy `/api/read|write|remove|list` endpoints.
- Keep compatibility only if an identified client still depends on them.

### 2) Source-of-truth differences for prompt/theme/color

Current behavior writes these fields into both:
- `/data/settings` (because settings save serializes most DB fields), and
- dedicated resources (`/data/prompts`, `/data/themes`, `/data/color_schemes`).

This creates two canonical candidates.

#### Option A: Settings is canonical

- Store prompt/theme/color only in `/data/settings`.
- Dedicated endpoints become derived views or are removed.

Pros:
- Simpler implementation and fewer moving parts.
- Single write for most settings.

Cons:
- Larger conflict scope (one settings ETag protects many unrelated fields).
- Harder independent versioning/sharing per prompt/theme/scheme.

#### Option B: Resource endpoints are canonical (recommended for server-first)

- `/data/settings` keeps only lightweight references (e.g., selected theme id), not full prompt/color payloads.
- Full prompt/theme/color data lives only in dedicated resource endpoints.

Pros:
- Clear ownership per resource.
- Better concurrency and smaller conflict domains.
- Cleaner long-term multi-client behavior.

Cons:
- Requires migration and loader/save refactor.
- Slightly more API calls.

## Rewrite / Tech Change Recommendations (Why / Benefit / If Not Done)

1. Split `server/node/server.cjs` into modules (auth, proxy, data routes, logging utilities).
Why: Single large file mixes concerns, raising regression risk.  
Better: Easier ownership, tests, and safer changes.  
If not: Every change remains high-blast-radius and review cost keeps increasing.

2. Introduce shared request validation for IDs and params (e.g., strict ID schema) and enforce safe path resolution everywhere.
Why: Repeated manual checks are inconsistent and currently incomplete.  
Better: Removes traversal/null-check classes of bugs at one boundary.  
If not: Security defects likely recur in future endpoints.

3. Move to structured logging with enforced fields (`reqId`, `method`, `path`, `resourceId`, `etag`, `ifMatch`, `status`, `durationMs`, `conflictReason`).
Why: Current string logs are inconsistent and miss policy fields.  
Better: Reliable debugging, compliance, and log querying.  
If not: Conflict analysis and incident triage stay slow/incomplete.

4. Unify prompt/theme/color persistence to one canonical model (prefer resource-canonical for server-first).
Why: Dual-write models drift under partial failures and multi-client writes.  
Better: Deterministic reads/writes and fewer reconciliation bugs.  
If not: Intermittent state mismatch issues will continue.

5. Replace custom slider `div` with semantic input/ARIA-complete slider pattern.
Why: Current control is pointer-only and fails accessibility checks.  
Better: Keyboard/screen-reader support and fewer custom-event edge cases.  
If not: A11y debt remains and UX regressions persist for non-pointer users.

