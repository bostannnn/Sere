# Memory Tab Manual QA Sign-Off Checklist

Date: __________
Tester: __________
Branch: __________
Commit: __________
Build/Env: __________

## Scope
This checklist is for the right-sidebar Memory redesign and manual summarize correctness:
- Memory as third sidebar tab (`Chat`, `Character`, `Memory`)
- Memory internal subtabs (`Summary`, `Settings`, `Log`)
- Per-character prompt override
- Manual summarize targeting correctness (character/chat/range)
- Per-chat log correctness

## Test Data Setup
- Prepare at least 2 characters:
  - `Character A` with prompt token `TRACKER_A`
  - `Character C` with prompt token `TRACKER_C`
- Prepare at least 2 chats under `Character A`:
  - `Chat A` and `Chat B`
- Ensure each chat has enough messages to run manual summarize with a small range.

## Execution Rules
- Mark each case as `PASS`, `FAIL`, or `BLOCKED`.
- For `FAIL`/`BLOCKED`, add one short note and a screenshot.
- Validate in order, batch by batch. Do not proceed to next batch until current batch is accepted.
- Keep `pnpm run check:ui-shell-smoke` green while validating; it now includes Memory sidebar runtime regressions and memory layout CSS contracts.
- Keep `pnpm run test:server:unit` green while validating server-side Hypa route contract changes.

## Batch 1: Navigation and Layout
- [ ] `TC-01` Desktop right sidebar shows exactly 3 top tabs: `Chat`, `Character`, `Memory`.
- [ ] `TC-02` Mobile top tabs show exactly 3 tabs and all 3 have equal width.
- [ ] `TC-03` No horizontal scroll appears in Memory panel on desktop or mobile.
- [ ] `TC-04` Memory panel opens without clipping/overlap artifacts.
- [ ] `TC-05` Memory panel does not show legacy `Hypa` title/header text.

## Batch 2: Memory UI Structure (Current Design)
- [ ] `TC-06` Inside Memory, second-level tabs are `Summary`, `Settings`, `Log`.
- [ ] `TC-07` `Summary` tab contains manual range controls (`Start`, `End`, `Summarize`).
- [ ] `TC-08` `Start`, `End`, and `Summarize` controls use consistent row height and alignment.
- [ ] `TC-09` `Settings` tab contains prompt override inputs (not in Summary tab).
- [ ] `TC-10` `Log` tab contains last summarize log area.
- [ ] `TC-11` Removed controls are absent: star/favorite, tags manager, translation actions.

## Batch 3: Prompt Override Correctness
- [ ] `TC-12` Editing `Character A` prompt override and immediately clicking `Summarize` (without leaving field) uses latest text.
- [ ] `TC-13` Manual summarize output style clearly reflects `TRACKER_A`.
- [ ] `TC-14` `Log` shows `prompt source: request_override` for that run.
- [ ] `TC-15` Prompt override remains character-scoped (switching to `Character C` uses `TRACKER_C`, not `TRACKER_A`).

## Batch 4: Chat/Character Targeting Correctness
- [ ] `TC-16` Manual summarize in `Character A / Chat A` creates summary in `Chat A` only.
- [ ] `TC-17` After switching to `Character A / Chat B`, manual summarize creates summary in `Chat B` only.
- [ ] `TC-18` Switching to `Character C` and summarizing does not alter `Character A` chats.
- [ ] `TC-19` Manual summarize range (`Start`/`End`) is honored for selected chat (no cross-chat mix).

## Batch 5: Log Scoping and Error Behavior
- [ ] `TC-20` `Log` in active summarized chat shows latest log details (model, time, prompt source, prompt/input/formatted).
- [ ] `TC-21` Opening `Log` in a different chat/character with no run shows: `No summarize logs yet for this chat.`
- [ ] `TC-22` Invalid manual range is rejected gracefully (no crash, clear failure behavior).
- [ ] `TC-23` No blocking runtime errors in browser console during the above flows.
- [ ] `TC-24` After a validation/summarize feedback message appears in one chat, switching to another chat clears that feedback state.

## Final Sign-Off
- [ ] All test cases passed.
- [ ] Evidence screenshots attached for each failed case (if any).
- [ ] Ready for merge approval.

Sign-off decision: `PASS / FAIL / CONDITIONAL`
Reviewer: __________
