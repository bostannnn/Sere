# Development Conventions

Last updated: 2026-02-20

---

These are development rules, not goals. They apply to the entire repository.

For legacy code, the scope of remediation in a specific change is decided case by case. This does not waive the rules. It only decides how much of an existing violation is fixed in that slice.

---

## I. Security Rules

### 1. Execution Safety
- `eval()` and `new Function()` are forbidden in production paths.
- Plugin/runtime execution must use explicit isolation boundaries.
- AST rewriting alone is not a security boundary.

### 2. Rendering Safety
- Content must be sanitized at the render point.
- Unsanitized `innerHTML` is forbidden.
- `{@html}` requires sanitized input with clear sanitizer ownership in the same flow.

---

## II. Architectural Integrity & Modularity

### 1. Single Responsibility & File Limits
- New files must stay <=500 LOC.
- Existing oversized files must be decomposed when touched, based on case-by-case review scope.
- Logic separation is mandatory:
  - Services are for pure logic and API interactions.
  - Stores are for reactive state.
  - Components are for presentation and local UI behavior.
- Circular dependencies are forbidden.

### 2. Svelte State Boundaries
- `$state` and `writable` stores must not be mixed ad-hoc in the same logic flow.
- Pure transformations must stay in plain TypeScript modules.
- Global state access must be centralized; no ad-hoc global stores in feature files.

---

## III. Type Safety & Data Validation

### 1. Type Policy
- `any` is forbidden.
- `as any` is forbidden.
- `@ts-ignore` and `@ts-nocheck` are forbidden unless explicitly approved case by case.
- Use `unknown` and narrow at boundaries.
- Introduce types at boundaries first: network, storage, plugins, parser IO.
- Default `pnpm check` currently runs with:
  - `strict: false`
  - `strictNullChecks: false`
  - `noImplicitAny: false`
- Strict migration is tracked with `pnpm run check:strict` (`tsconfig.strict.json`).
- Fix strict findings incrementally in touched areas; do not introduce avoidable new nullable/implicit-any risk.

### 2. Runtime Validation
- External payloads (LLM/API/plugin inputs) must be validated at the boundary.
- Use a schema library (Zod/TypeBox) for non-trivial payloads.
- Never trust success payload shape without validation.

---

## IV. Error Handling & Networking

### 1. Structured Errors
- Do not return generic string errors for domain logic.
- Use structured error contracts:

```typescript
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
```

- Prefer domain-specific error types for retry and UI handling.

### 2. Unified Networking
- Do not mix `fetch` and `globalFetch` arbitrarily in the same feature flow.
- Shared API wrapper should provide:
  - timeout,
  - logging,
  - redaction,
  - normalized error mapping.
- Provider-specific request formatting must be adapter-based, not copied across files.

### 3. Failure Visibility
- Persistence/auth failures must not be silent in user-facing flows.
- `catch` blocks around save/sync/auth operations must surface a user-visible signal (`alertToast`/`alertError`) in addition to logging.
- Background retry is allowed, but if retry fails the user must still be informed that data may be unsaved.

---

## V. Design System Rules (Token-First)

### 1. Build Order
1. Baseline token spec.
2. Primitive components.
3. Screen composition.

### 2. Token Governance
1. New visual values come from tokens.
2. No hardcoded values when token exists.
3. If token is missing, add token first, then use it.

### 3. UI Anti-Patterns
1. One-off utility combinations with no reuse.
2. New hardcoded pixel values where token exists.
3. Direct DOM queries to drive component state.

---

## VI. Development Workflow Rules

### 1. Local Validation Cadence
- Default loop: `pnpm dev`, `pnpm lint`, `pnpm check`, `pnpm test`.
- Strict migration loop (optional but recommended): `pnpm run check:strict`.
- Server contract checks: `pnpm run check:server`, `pnpm run check:server:contracts`.
- For changes under `prototypes/structure-lab/moescape-concept`, run `pnpm run check:prototype`.
- Server-mode verification must run against fresh `dist/` when relevant.

### 2. Merge Requirements
- `pnpm lint` must pass.
- `pnpm check` must pass.
- `pnpm test` must pass.
- `pnpm run check:server` must pass.
- `pnpm run check:server:contracts` must pass.
- If `prototypes/structure-lab/moescape-concept` is touched, `pnpm run check:prototype` must pass.
- No new usage of legacy `/api`, `/proxy`, `/proxy2` in core flows.

### 3. Review Checklist
1. Security: any unsafe execution or unsanitized rendering?
2. Type safety: any `any`/ignore directives?
3. Modularity: did touched files get simpler or more coupled?
4. State: no new ad-hoc mixing/pattern drift?
5. Networking/errors: structured and centralized?

### 4. Rule Enforcement Mapping
- Security rules: code review + static search + targeted tests.
- Type safety rules: `pnpm check` + review.
- Modularity/architecture rules: review + dependency checks where available.
- Prototype design contracts: `pnpm run check:prototype` + manual UI smoke.
- Any rule without automation remains mandatory and must be enforced in review.

---

## VII. Legacy Code Case-by-Case Rule

- Legacy violations are handled case by case per change.
- Case-by-case scope is decided in review.
- New code must not introduce additional violations.
- If a known legacy violation is intentionally deferred in a touched area, note the deferral in `plan.md`.

---

## VIII. Severity & Triage Policy

- `P0`: security/data-loss/crash or blocking production behavior. Must fix before merge.
- `P1`: high-impact functional or architectural regression. Must fix before merge unless explicitly approved defer.
- `P2`: moderate impact or maintainability risk. Can defer with owner + note in `plan.md`.
- `P3`: low impact polish/documentation debt. Optional defer with backlog note.

Deferred `P0/P1` requires explicit written approval in the change discussion.

---

## IX. Exception Process

- Exceptions are not implicit.
- Required fields for each exception:
  - rule being waived,
  - reason,
  - approver,
  - expiry/revisit date,
  - tracking issue or `plan.md` reference.
- Expired exceptions must be re-approved or removed.

---

## X. Scope Split: App vs Prototype

- Core app code (`src/`, `server/`, production paths) follows all conventions without relaxation.
- Prototype code (`prototypes/structure-lab/moescape-concept`) follows the same safety/type/security baselines plus prototype-specific design contracts.
- Prototype-only implementation shortcuts are allowed only when they do not violate security rules and are documented in prototype docs.

---

## XI. Documentation Update Contract

After any significant change, update impacted docs in the same change set.

Significant change includes:
- navigation/layout/routing changes,
- state model changes,
- rendering boundary or primitive changes,
- testing workflow/required checks changes.

Minimum required docs to review/update when applicable:
- `CONVENTIONS.md`
- `docs/DESIGN_RULES.md`
- `docs/UI_CHANGE_CHECKLIST.md`
- `docs/CONCEPT_COMPLETION_CHECKLIST.md`
- `docs/MIGRATION_MAP.md`
