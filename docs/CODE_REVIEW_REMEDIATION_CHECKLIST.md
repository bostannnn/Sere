# Code Review Remediation Checklist

Last updated: 2026-03-01

Source: full code-review against `docs/ONBOARDING.md` and referenced rule docs.

---

## CR-001 — UI Shell Runtime Loop / Full-Suite Failure

Severity: P1  
Status: DONE (2026-03-01)  
Owner: Unassigned

Objective:
Eliminate `effect_update_depth_exceeded` and the reproducible `pnpm test` failure in `dev/ui-shell-runtime-smoke.test.ts`.

Files in scope:
- `src/lib/UI/AppShellV2.svelte`
- `src/lib/UI/AppShellStage.svelte`
- `dev/ui-shell-runtime-smoke.test.ts`

Tasks:
- [x] Remove state writes from route derivation paths (`$derived`/resolver code must stay pure).
- [x] Move chat-page normalization and side effects to controlled non-derived logic.
- [x] Ensure route-sync effect does not create write-after-read loops against route state.
- [x] Add/adjust runtime test coverage for repeated mount/unmount and workspace transitions in full-suite context.

Acceptance criteria:
1. `pnpm test` passes in a clean workspace.
2. `pnpm run check:ui-shell-smoke` passes.
3. No `effect_update_depth_exceeded` in test output.

Validation commands:
- `pnpm exec vitest run dev/ui-shell-runtime-smoke.test.ts`
- `pnpm test`
- `pnpm run check:ui-shell-smoke`

---

## CR-002 — Alert Stack-Trace XSS Hardening

Severity: P1  
Status: DONE (2026-03-01)  
Owner: Unassigned

Objective:
Remove unsafe HTML rendering path for stack traces.

Files in scope:
- `src/lib/Others/AlertComp.svelte`
- `src/ts/sourcemap.ts`
- `dev/alert-requestlogs-runtime-smoke.test.ts` (or new alert-focused test file)

Tasks:
- [x] Replace raw `{@html}` stack-trace rendering with plain text render path where possible.
- [x] Keep translated/original trace readability using `<pre>` text rendering.
- [x] Add regression test with script/event-handler payload in stack trace to assert inert output.

Acceptance criteria:
1. Stack traces cannot execute injected HTML/JS payloads.
2. Rendered output preserves readability for normal traces.
3. Alert smoke/runtime tests pass.

Validation commands:
- `pnpm exec vitest run dev/alert-requestlogs-runtime-smoke.test.ts`
- `pnpm test`

---

## CR-003 — RAG Error Contract Compliance

Severity: P1  
Status: DONE (2026-03-01)  
Owner: Unassigned

Objective:
Align RAG endpoint errors with server rule contract and avoid leaking internal exception strings.

Files in scope:
- `server/node/routes/rag_routes.cjs`
- `server/node/check-server-contracts.cjs` (only if rule check needs extension)
- `scripts/test-server-rag.js`

Tasks:
- [x] Convert all RAG error responses to `{ error, message }` shape.
- [x] Remove direct `String(e)` payload exposure to clients.
- [x] Keep detailed diagnostics in server logs/audit only.
- [x] Extend tests/checks for RAG error-response shape consistency.

Acceptance criteria:
1. Every RAG error response includes machine code (`error`) and safe text (`message`).
2. No raw stack/internal exception string in API response bodies.
3. Server contract checks and RAG smoke tests pass.

Validation commands:
- `pnpm run check:server`
- `pnpm run check:server:contracts`
- `pnpm run smoke:rag:api`

---

## CR-004 — RAG Metadata Optimistic Concurrency

Severity: P2  
Status: DONE (2026-03-01)  
Owner: Unassigned

Objective:
Prevent lost updates on RAG rulebook metadata mutation.

Files in scope:
- `server/node/routes/rag_routes.cjs`
- `server/node/rag/engine.cjs`
- `scripts/test-server-rag.js`

Tasks:
- [x] Add `If-Match` requirement for mutable RAG metadata write path.
- [x] Compare provided ETag to current stored resource ETag before write.
- [x] Return conflict/precondition responses per existing repository pattern.
- [x] Add smoke tests for missing, stale, and valid `If-Match`.

Acceptance criteria:
1. Missing `If-Match` is rejected.
2. Stale `If-Match` returns conflict/precondition failure.
3. Valid `If-Match` updates succeed and produce updated ETag.

Validation commands:
- `pnpm run check:server:contracts`
- `pnpm run smoke:rag:api`

---

## CR-005 — Strict Type Debt Reduction (Tranche 1)

Severity: P2  
Status: DONE (2026-03-01)  
Owner: Unassigned

Objective:
Reduce strict-mode debt in a controlled slice without regressions.

Files in scope (initial tranche):
- `src/ts/translator/bergamotTranslator.ts`
- `src/ts/translator/translator.ts`
- `src/ts/process/tts.ts`
- `src/lib/Others/RulebookManager/RulebookLibrary.svelte`

Tasks:
- [x] Fix null/undefined and implicit-any errors in selected tranche files.
- [x] Avoid adding new `any`, `@ts-ignore`, or `@ts-nocheck`.
- [x] Keep strict error count non-increasing repo-wide via ratchet.
- [x] Record strict debt progress in `plan.md` after tranche merge.

Acceptance criteria:
1. `pnpm run check:strict:ratchet` passes.
2. Strict error count decreases from current baseline for touched tranche.
3. Functional tests around translator/TTS/rulebook settings still pass.

Progress note:
- Strict ratchet baseline improved from `915` to `848` after tranche fixes.

Validation commands:
- `pnpm run check:strict`
- `pnpm run check:strict:ratchet`
- `pnpm test`

---

## Execution Order

- [x] CR-001
- [x] CR-002
- [x] CR-003
- [x] CR-004
- [x] CR-005

Rationale:
CR-001 and CR-002 are immediate P1 quality/security risks. CR-003 and CR-004 bring server contracts in line and reduce data integrity risk. CR-005 is ongoing debt reduction with ratchet control.
