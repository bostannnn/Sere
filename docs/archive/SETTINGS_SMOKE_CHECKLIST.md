# Settings Smoke Checklist

Last updated: 2026-02-06

## Goal
Catch settings navigation regressions immediately after each UI slice.

## Commands

### Dev mode (live source)
```bash
pnpm check
pnpm check:settings-contract
pnpm check:settings-shell
pnpm check:settings-smoke
pnpm dev
```

### Server mode (dist)
```bash
pnpm check
pnpm check:settings-contract
pnpm check:settings-shell
pnpm check:settings-smoke
pnpm build
pnpm run runserver
```

## Manual Checks (Required)

### A) Top-level settings navigation
1. Open Settings.
2. Click each left nav item once.
3. Click each left nav item again (idempotency check).
4. Confirm each top-level settings item renders one row at a time from top to bottom (no multi-column wrapping).
5. Confirm no blank content area and no error modal.

### B) Chat Bot local tabs
1. Open `Chat Bot`.
2. Switch: `Model -> Parameters -> Prompt -> Model`.
3. Re-click each selected tab.
4. Confirm content is visible after each click.

### C) Other Bots local tabs
1. Open `Other Bots`.
2. Switch: `Long Term Memory -> TTS -> Emotion Images -> Long Term Memory`.
3. Re-click each selected tab.
4. Confirm no flattening of all sections into a single page.

### D) Display & Audio local tabs
1. Open `Display & Audio`.
2. Switch: `Theme -> Size and Speed -> Others -> Theme`.
3. Re-click each selected tab.
4. Confirm selected tab always shows visible content.

### E) Mobile viewport
1. Set viewport to mobile size.
2. Repeat checks A-D.
3. Confirm no crash modal and no dead-end state.

## Pass Criteria
1. `pnpm check` succeeds.
2. `pnpm check:settings-contract` succeeds.
3. `pnpm check:settings-shell` succeeds.
4. `pnpm check:settings-smoke` succeeds.
5. `pnpm build` succeeds for server-mode validation.
6. No runtime settings error modal.
7. No blank settings page after any tab/nav click.
8. `UI_BASELINE_MATRIX.md` rows for touched settings surfaces are updated.

## Failure Handling
1. Stop further edits.
2. Revert current slice.
3. Re-run checklist before retrying with smaller scope.
