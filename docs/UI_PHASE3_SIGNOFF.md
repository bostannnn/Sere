# UI Phase 3 Sign-Off Evidence

Last run: 2026-02-24 19:54:40 +0300  
Scope: Phase 3 Home + Shell Navigation (`ui_shell_v2`) migration parity.

## Automated Gate Results

| Check | Result | Notes |
|---|---|---|
| `pnpm run check:ui-shell-smoke` | PASS | Includes `check-ui-shell-contract`, `check-chat-sidebar-contract`, `check-charconfig-rulebook-contract`, `ui-shell-runtime-smoke`, `home-character-directory-runtime-smoke`, `chat-runtime-smoke`, `chat-sidebar-runtime-smoke`, `chat-sidebar-integration-runtime-smoke`, `lorebook-runtime-smoke`. |
| `pnpm check` | PASS | `svelte-check` reports 0 errors and 0 warnings. |
| `pnpm run check:settings-smoke` | PASS | Re-run after shell-routing/state fix touch; settings desktop/mobile smoke is green. |
| `pnpm exec vitest run dev/server-db-runtime-smoke.test.ts` | PASS | Covers server-side character delete reconciliation regression (`Q9`). |

## Checklist Status (Phase 3 Focus)

Reference: `docs/MIGRATION_PLAN.md` (Phase 3: Home + Global Drawer)

| Area | Status | Evidence |
|---|---|---|
| Home directory is shell-composed (`AppShellStage` route) | PASS | `src/lib/UI/AppShellStage.svelte` |
| Character directory controls (`Active/Trash/Add`) hosted in topbar | PASS | `src/lib/UI/AppShellTopbar.svelte` + `src/lib/UI/AppShellV2.svelte` + `dev/ui-shell-runtime-smoke.test.ts` |
| Portrait card home directory with compact card metadata + topbar search binding | PASS | `src/lib/UI/HomeCharacterDirectory.svelte` + `dev/ui-shell-runtime-smoke.test.ts` |
| Character selection preserves chat-entry behavior (`changeChar` + remembered chat fallback) | PASS | `src/lib/UI/HomeCharacterDirectory.svelte` + `src/lib/UI/AppShellV2.svelte` + `dev/ui-shell-runtime-smoke.test.ts` |
| Home -> Chats always opens chat inspector tab after character click (`Q4` fix) | PASS | `src/lib/UI/AppShellV2.svelte` + `dev/ui-shell-runtime-smoke.test.ts` |
| Home directory preserves create/import entry | PASS | `src/lib/UI/HomeCharacterDirectory.svelte` + `dev/home-character-directory-runtime-smoke.test.ts` |
| Home directory preserves delete/trash/restore flows | PASS | `src/lib/UI/HomeCharacterDirectory.svelte` + `dev/home-character-directory-runtime-smoke.test.ts` |
| Permanent delete from trash persists after refresh in node-server mode (`Q9` fix) | PASS | `src/ts/storage/serverDb.ts` + `dev/server-db-runtime-smoke.test.ts` |
| Topbar `More` overflow routes to secondary shell actions | PASS | `src/lib/UI/AppShellTopbar.svelte` + `dev/ui-shell-runtime-smoke.test.ts` |
| Chat sidebar quick-open/fallback behavior remains stable | PASS | `src/lib/ChatScreens/ChatScreen.svelte` + `dev/chat-sidebar-runtime-smoke.test.ts` |
| Legacy global launcher surface is removed from runtime composition | PASS | `src/lib/UI/AppShellStage.svelte` + `dev/check-ui-shell-contract.js` |

## Sign-Off Questionnaire Snapshot (2026-02-24)

| Item | Status | Notes |
|---|---|---|
| Q1 | PASS | Confirmed by owner. |
| Q2 | PASS | Confirmed by owner. |
| Q3 | PASS | Confirmed by owner. |
| Q4 | FAIL -> PASS | Initially inconsistent (`character` tab sometimes opened); fixed in shell transition logic and revalidated by owner. |
| Q5 | NOT TESTED | Owner asked to skip. |
| Q6 | NOT TESTED | Owner asked to skip. |
| Q7 | PASS | Confirmed by owner. |
| Q8 | PASS | Confirmed by owner. |
| Q9 | FAIL -> PASS | Permanent delete regression reproduced and fixed with server reconciliation; owner revalidated. |
| Q10 | PASS | Confirmed by owner. |
| Q11 | PASS | Confirmed by owner. |
| Q12 | NOT TESTED | Owner could not reliably validate keyboard focus visibility; defer focus-visibility polish to Phase 4. |

Follow-up owner acceptance:
- Final owner confirmation after blocker fixes: **"All looks correct"**.

## Phase 3 Sign-Off Decision

Current state: **PASS**  
- Automated contract/runtime gates are green.  
- Owner-reported blockers (`Q4`, `Q9`) are fixed and accepted.  
- Remaining focus-visibility polish is explicitly tracked for Phase 4.
