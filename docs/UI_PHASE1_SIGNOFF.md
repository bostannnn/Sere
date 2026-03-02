# UI Phase 1 Sign-Off Evidence

Last run: 2026-02-22 15:04:11 +0300
Scope: Phase 1 shell frame stability (`ui_shell_v2`) before new component migration.

## Automated Gate Results

| Check | Result | Notes |
|---|---|---|
| `pnpm run check:ui-shell-smoke` | PASS | Includes `check-ui-shell-contract`, `ui-shell-runtime-smoke`, `chat-runtime-smoke` |
| `pnpm check` | PASS | `svelte-check` 0 errors, 0 warnings |
| `pnpm run check:settings-smoke` | PASS | `settings-contract`, `settings-shell`, runtime desktop/mobile smoke, `chat-runtime-smoke` |

## Checklist Status (Phase 1 Focus)

Reference checklist: `docs/UI_CHANGE_CHECKLIST.md`

| Area | Status | Evidence |
|---|---|---|
| Shell route transitions stable | PASS | `dev/ui-shell-runtime-smoke.test.ts` |
| Workspace switch clears transient overlays | PASS | `dev/ui-shell-runtime-smoke.test.ts` |
| Topbar persists in `Settings` and `Library` under `ui_shell_v2` | PASS | `dev/ui-shell-runtime-smoke.test.ts` |
| Topbar/search visibility contract (`Home/Library` visible only) | PASS | `dev/check-ui-shell-contract.js` + `src/App.svelte` gate patterns |
| Drawer/tab contract regressions in settings shell | PASS | `dev/check-settings-shell.js` + settings runtime smoke tests |
| Chat runtime state stability (`state_unsafe_mutation` guard) | PASS | `dev/chat-runtime-smoke.test.ts` |

## Manual Validation Items (Still Required For Final Sign-Off)

| Item | Status |
|---|---|
| Desktop/laptop/tablet/mobile visual walkthrough | PENDING |
| Overlay depth and scrim layering visual confirmation | PENDING |
| No unexpected chrome scrollbars across target viewports | PENDING |
| Rapid tab switching visual parity across right-sidebar tabs | PENDING |
| Keyboard/Esc close behavior end-to-end walkthrough | PENDING |

## Sign-Off Questionnaire Snapshot (2026-02-22)

Owner responses:
- `1` scope agreement (shell/title bar only for Phase 1): **YES**
- `2` topbar persistence in settings/library: **YES**
- `3` topbar search visibility: **YES**, with blocker noted (search not wired)
- `4` workspace switch overlay clear: **YES**
- `5` drawer open/close determinism: **YES**
- `6` scrim/layer depth: **YES**
- `7` mobile parity concern: **QUESTION RAISED** (current mobile nav differs from desktop shell)
- `8` rapid tab switching stability: **YES**
- `9` Esc close behavior: **NO** (blocker)
- `10` obvious shell regressions: **NO**
- `11` automated gate evidence accepted: **YES**

Blockers raised during questionnaire:
- Topbar search input was not wired to library filtering.
- `Esc` had no shell-level close behavior.
- Global sidebar was unavailable in `Library` and `Settings`, blocking manual drawer validation.
- `Esc` still not closing overlays/rail in real runtime when other listeners call `preventDefault()`.

Blocker resolution run (2026-02-22):
- Wired topbar search binding into library surface via `shellSearchQuery`.
- Added shell-level `Escape` handling for active overlays and nav rail.
- Added smoke assertions for both behaviors in `dev/ui-shell-runtime-smoke.test.ts`.
- Enabled shell-global sidebar host in `Library` and `Settings` (topbar rail toggle now works in both).
- Tightened global rail navigation state resets in `GlobalLauncher` for cross-workspace transitions.
- Updated shell `Escape` listener to capture phase and removed early `defaultPrevented` short-circuit.
- Added smoke regression for `Escape` behavior when another listener calls `preventDefault()`.
- Re-ran `pnpm run check:ui-shell-smoke`, `pnpm run check:settings-smoke`, and `pnpm check`: **PASS**.

## Phase 1 Sign-Off Decision

Current state: **Conditional pass**  
- Automated Phase 1 shell gates are green.  
- Final Phase 1 sign-off still requires:
  - explicit owner confirmation that `Esc` behavior is now acceptable after fix
  - explicit owner decision on mobile shell parity expectation for Phase 1 vs later phases
