# Migration Smoke Checklist

Last reviewed: 2026-02-14

## 1. API Smoke Pack (Automated)

Start an isolated node server (separate terminal). Do not run the smoke pack against `pnpm run runserver`, because that uses the live `data/` root:

```bash
pnpm run runserver:test
# or: pnpm run runserver:tmp
```

Run migration smoke pack:

```bash
pnpm run smoke:migration:api
# or: RISU_STORAGE_TEST_ALLOW_WRITE=1 RISU_DATA_TEST_URL=http://localhost:6001 node dev/run-migration-smoke-pack.js
```

This pack currently validates:
- server-first storage contract (`scripts/test-server-storage.js`)
- migrated LLM providers preview/execute contracts (`scripts/test-server-llm-phaseA.js`)
- Memory endpoint contracts (`scripts/test-server-memory.js`)
- fixture character/chat/assets lifecycle (`dev/test-server-fixture-flow.js`)

One-command full automated smoke (settings runtime + API pack, auto server start/stop):

```bash
pnpm run smoke:app:auto
```

## 2. Browser Export/Import Smoke (Manual + Playwright-Assisted)

These are the highest-value UI checks for migration regressions:
- character export (`png`, `json`, `charx`)
- character re-import from exported files
- character image/asset rendering after import

### Playwright-assisted setup

Use the local Playwright wrapper:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
```

Open app and snapshot:

```bash
"$PWCLI" open http://localhost:5173 --headed
"$PWCLI" snapshot
```

Then drive UI with `click`/`fill`/`snapshot` loop and verify:
1. Export does not throw runtime modal errors.
2. Files are downloaded successfully.
3. Import of exported files succeeds.
4. Imported character appears in list with expected avatar/content.

Store screenshots in:

```bash
output/playwright/
```

## 3. Pass Criteria

- All API smoke scripts return `OK`.
- No blocking runtime modal during export/import flow.
- Re-imported character has valid image and chat opens.
- `/data/llm/logs` contains expected migrated provider entries from smoke runs.
- No smoke command writes to the live `data/` root.

## 4. Known Gaps (Track)

- Browser export/import is not fully headless-automated yet.
- We still need a permanent provider-capability policy (current UI filtering is temporary).
