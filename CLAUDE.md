# CLAUDE.md — Claude Agent Context

This file is read automatically by Claude Code at the start of every session.

**Primary source of truth: [`docs/ONBOARDING.md`](docs/ONBOARDING.md)**

Read that document first. It covers the project overview, dev commands, testing mandate, rules references, and smoke script workflow. Everything in this file is additive — it does not replace ONBOARDING.md.

---

## Session initialization
At the start of every session, activate the Serena project by calling `mcp__serena__activate_project` with path `/Users/andrewbostan/Documents/RisuAII`.

---

## Claude-specific operational notes

### Use TodoWrite for complex tasks
When a task has 3+ steps or touches multiple files, use the `TodoWrite` tool to track progress. Mark tasks `in_progress` before starting, `completed` immediately after finishing. Only one task `in_progress` at a time.

### Before committing anything
Run the full check sequence from `docs/ONBOARDING.md` Section 9. Never skip checks. Pay special attention to the server-feature test requirement if you touched `server/node/`.

### Testing mandate (non-negotiable)
Every server-side feature (new endpoint, bug fix, pipeline change) requires **both** unit tests and smoke tests before the change is done. See `docs/TESTING_RULES.md` Section 4 for the full spec. The short version:

| Type | Location | When required |
|------|----------|---------------|
| Unit tests | `scripts/test-<domain>-unit.cjs` | Any new/changed pure function in `server/node/llm/*.cjs` |
| Smoke tests | `scripts/test-server-<domain>.js` | Any new/changed HTTP endpoint |

### `.gitignore` rule for test files
`/scripts/*` is blocked by `.gitignore` — scripts are ignored by default. Add explicit exceptions for every new test file you create:

```gitignore
!/scripts/test-my-feature-unit.cjs
!/scripts/test-server-my-feature.js
```

### Code check cadence during server work
After writing or editing a server file, read it back and verify:
- DI pattern: all deps destructured from `arg` at the top, not accessed inline
- Path safety: `requireSafeSegment` / `safeResolve` on every user-supplied ID
- Error handling: `try/catch` wrapping every async handler
- Response helpers: `sendJson` used, never `res.json()` / `res.send()` directly
- No business logic in route files — extract to service modules if a handler grows beyond ~20 lines
