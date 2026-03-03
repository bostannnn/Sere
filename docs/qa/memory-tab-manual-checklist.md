# Memory Tab Manual QA Checklist

Date: __________
Tester: __________
Branch/Build: __________

## Instructions
- Mark each item as `PASS`, `FAIL`, or `BLOCKED`.
- Add a short note for each `FAIL` or `BLOCKED`.
- Reply to assistant in batches using this format:
`TC-01 PASS`, `TC-02 FAIL - menu clipped`, etc.

## Batch 1: Navigation and Layout
- [ ] `TC-01` Desktop right sidebar shows 3 tabs: `Chat`, `Character`, `Memory`.
- [ ] `TC-02` Clicking `Memory` opens Memory panel without visual overlap/clipping.
- [ ] `TC-03` `Memory` tab selection does **not** persist after page reload (returns to last saved `Chat`/`Character` tab behavior).
- [ ] `TC-04` Mobile sidebar topbar shows 3 options: `Chat`, `Character`, `Memory` (no developer tab).
- [ ] `TC-05` Mobile switching works for all 3 options.

## Batch 2: Header Actions and Menu
- [ ] `TC-06` Clicking `...` opens actions menu and it is fully readable.
- [ ] `TC-07` Actions menu closes after selecting an action.
- [ ] `TC-08` Search toggle opens/closes search bar correctly.
- [ ] `TC-09` Important filter (star) toggles summary filtering behavior.
- [ ] `TC-10` Bulk mode button toggles bulk selection mode correctly.

## Batch 3: Tools and Prompt Override
- [ ] `TC-11` `Tools` section expands/collapses smoothly.
- [ ] `TC-12` Prompt override inputs are visible under Memory -> Tools for normal characters.
- [ ] `TC-13` Prompt override inputs are hidden for group characters.
- [ ] `TC-14` Prompt overrides differ per character (A/B isolation check).
- [ ] `TC-15` Prompt overrides persist after reload.

## Batch 4: Memory Operations
- [ ] `TC-16` Manual summarize with valid range adds summary successfully.
- [ ] `TC-17` Invalid manual range shows error and does not crash.
- [ ] `TC-18` Re-summarize flow works for selected summaries.
- [ ] `TC-19` Reset memory action clears memory data as expected.
- [ ] `TC-20` Empty state renders cleanly when no summaries exist.

## Batch 5: Data Integrity
- [ ] `TC-21` Character export/import preserves prompt override values.
- [ ] `TC-22` Switching chats within same character keeps expected chat memory state.
- [ ] `TC-23` No console/runtime errors during common Memory interactions.
