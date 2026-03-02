# Task Completion Checklist

Run these before every commit (from docs/ONBOARDING.md Section 9):

1. `pnpm lint --max-warnings 0` — must show 0 warnings (CI gate)
2. `pnpm check` — must show 0 errors
3. `pnpm test` — must show all tests passing
4. `pnpm run check:server` — server static checks (routes, deps, errors, api)
5. `pnpm run check:server:contracts` — server runtime contracts

### If you touched server/node/ pure functions:
- `node scripts/test-memory-unit.cjs`
- `node scripts/test-server-http-setup-unit.cjs`

### If you added/changed a server endpoint:
- Run `node scripts/test-server-*.js` against `runserver:test`
- New endpoints require new smoke tests (see docs/TESTING_RULES.md Section 4)
- Update `docs/SERVER_ARCHITECTURE.md`

### If you touched src/lib/Setting/ or setting-related TS:
- `pnpm run check:settings-smoke`

### If you changed UI shell/navigation/routing:
- `pnpm run check:ui-shell-smoke`
- Update `docs/DESIGN_RULES.md` and `docs/UI_CHANGE_CHECKLIST.md`

### If you touched prototypes/structure-lab/moescape-concept/:
- `pnpm run check:prototype`

### Never:
- Add new `any`, `console.log`, unsanitized `innerHTML`
- Create files over 500 LOC
- Run smoke tests against `runserver` (production data) — use `runserver:test`
