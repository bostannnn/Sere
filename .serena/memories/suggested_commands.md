# Suggested Commands

## Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Client dev server (localhost:5173, hot reload)
pnpm run runserver    # Node.js server (localhost:6001, production data)
pnpm run runserver:test  # Server with isolated test data (.dev-test-data/)
pnpm run runserver:tmp   # Server with /tmp/risu-smoke-data
pnpm build            # Production build
```

## Quality Checks (run before commit)
```bash
pnpm lint --max-warnings 0    # ESLint — must be 0 warnings (CI gate)
pnpm check                    # svelte-check type check — must be 0 errors
pnpm test                     # Vitest unit tests — must all pass
pnpm run check:server         # Server static contracts (routes, deps, errors, api)
pnpm run check:server:contracts  # Server runtime contracts
```

## Conditional Checks
```bash
# If touched src/lib/Setting/ or setting-related TS:
pnpm run check:settings-smoke

# If touched UI shell/navigation/routing:
pnpm run check:ui-shell-smoke

# If touched prototypes/structure-lab/moescape-concept/:
pnpm run check:prototype

# If touched pure functions in server/node/:
node scripts/test-memory-unit.cjs
node scripts/test-server-http-setup-unit.cjs

# If added/changed server endpoints (against runserver:test):
pnpm run smoke:server:safe
```

## Smoke Tests (require running server against test data)
```bash
# Terminal 1:
pnpm run runserver:test

# Terminal 2:
pnpm run smoke:server:safe     # Storage CRUD, LLM dispatch, memory API
pnpm run smoke:server:auth     # Auth flow (needs clean root — run smoke:reset-test first)
pnpm run smoke:memory:api      # HypaV3 memory trace
pnpm run smoke:rag:api         # RAG endpoints
pnpm run smoke:migration:api   # Migration smoke pack

# Reset test data (before smoke:server:auth):
pnpm run smoke:reset-test
```

## Strict Type Migration
```bash
pnpm run check:strict          # Full strict check (tracked debt)
pnpm run check:strict:ratchet  # Fails only if strict error count increases
```
