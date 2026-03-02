# Settings Behavior Contract (Freeze During Refactor)

Last updated: 2026-02-06  
Status: ACTIVE

## Purpose
Define behavior that must not change while settings UI is being tokenized and migrated to shared primitives.

## Refactor Rule
During token and primitive phases:
1. No feature additions.
2. No behavior changes.
3. No provider flow changes.
4. Only visual/layout normalization is allowed.

If a behavior change is required, it must be moved to a separate post-stability slice.

## Top-Level Settings Contract
`/src/lib/Setting/Settings.svelte`
1. Left nav click always renders selected page.
2. Clicking an already-selected left nav item is idempotent (no error, no blank page).
3. Close button always closes settings overlay.

## Page Contracts

### Chat Bot
`/src/lib/Setting/Pages/BotSettings.svelte`
1. Local tabs exist and are switchable:
   - `Model`
   - `Parameters`
   - `Prompt`
2. Switching tabs must not unmount the page shell unexpectedly.
3. Model/provider controls must keep current behavior and data bindings.

### Other Bots
`/src/lib/Setting/Pages/OtherBotSettings.svelte`
1. Local tabs exist and are switchable:
   - `Long Term Memory`
   - `TTS`
   - `Emotion Images`
2. TTS remains the current non-legacy implementation unless explicitly scheduled.
3. Switching tabs must not flatten unrelated sections into one long page.

### Display & Audio
`/src/lib/Setting/Pages/DisplaySettings.svelte`
1. Local tabs exist and are switchable:
   - `Theme`
   - `Size and Speed`
   - `Others`
2. Switching tabs must always render visible content for the selected tab.

## Runtime Safety Rules
1. No undefined access paths on tab clicks.
2. No blank content area after tab switch.
3. No crash modal triggered by repeated tab click.

## Enforcement Workflow
For each settings slice:
1. Apply one scoped change.
2. Run `pnpm check`.
3. Run `pnpm check:settings-contract`.
4. Run `pnpm check:settings-shell`.
5. Run `pnpm check:settings-smoke`.
6. Run `pnpm build`.
7. Run `SETTINGS_SMOKE_CHECKLIST.md`.
8. If any regression appears, revert the slice before continuing.
