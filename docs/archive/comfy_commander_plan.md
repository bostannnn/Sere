# Comfy Commander Plan & Progress

Last updated: 2026-02-12

## Scope
- Implement finalized Comfy Commander logic per COMFY_COMMANDER.md plus latest requirements.
- Keep negative prompt template-only, add `%negative_prompt%` alias.
- Add terminal logging for key stages.
- Add a separate “thinking” bar in the input area (location TBD).
- Ensure `/cw` does not post any text; only image is inserted as a character message.

## Open Questions (must be resolved)
- Proxy migration path after `/proxy2` removal:
  - Phase D target in `SERVER_EXECUTION_MIGRATION_PLAN.md` proposes `POST /data/integrations/comfy/proxy`.
  - Need final request/response contract and allowlist policy before implementation.

## Plan
1. Confirm UI placement/spec for the separate “thinking bar” (relative to existing LLM indicator).
2. Update Comfy Commander command parsing: trigger prefix match + longest trigger selection.
3. Add `%negative_prompt%` alias to workflow macro replacement, template-only.
4. Ensure command message is always suppressed; only character image message is inserted.
5. Add terminal logging for: LLM prompt, LLM output, Comfy payload (workflow after macro replace).
6. Note in docs/plan that full chat history is not used by `runMainLLM` for now (revisit later).
7. Update COMFY_COMMANDER.md to reflect final behavior and new options.

## Progress
- 2026-02-03: Plan created.
- 2026-02-03: Confirmed: template-only negative prompt with `%negative_prompt%` alias; full terminal logging required; prefix `[Comfy Commander]` ok; full chat history for `runMainLLM` is acceptable for now but must be revisited.
- 2026-02-03: Added Comfy Commander indicator in input area near send button (colorized loadmove spinner).
- 2026-02-03: Updated Comfy Commander command handling: trigger prefix matching (longest), terminal logging for LLM prompt/output and Comfy payload, negative prompt field in template UI, `%negative_prompt%` alias, and cleanup on all outcomes.
- 2026-02-03: Hid lower plugin progress bar for Comfy Commander; documented behavior updates in `COMFY_COMMANDER.md`.
- 2026-02-03: Switched Comfy Commander indicator color to theme-based value.
- 2026-02-03: Added LLM output cleanup (strip thoughts blocks) and improved proxy error responses (502 with URL + message).
- 2026-02-03: Cleanup now removes empty user/char messages near tail; docs updated with hot-reload tip.
- 2026-02-03: Image insertion now uses data URL for web rendering; docs updated.
- 2026-02-03: Restored fullscreen settings container (inline settings not supported by plugin API).
- 2026-02-03: Documented plugin-only status in `COMFY_COMMANDER.md` and created `DEV_RULES.md` with shared rules/best practices.
- 2026-02-03: Expanded `DEV_RULES.md` with conventions, versioning, error handling, testing, performance, security, UX, and release process.
- 2026-02-03: Bumped Comfy Commander to 1.7.0, added changelog, and added workflow JSON validation.
- 2026-02-03: Renamed settings label to "Comfy Commander", added settings icon, and added web→Tauri validation checklist to `DEV_RULES.md`.
- 2026-02-03: Added per-template chat menu buttons with custom names; bumped version to 1.7.1 and updated docs.
- 2026-02-03: Settings UI now honors app theme; chat menu buttons no longer force a plus icon; workflows stored separately with template dropdown selection; bumped version to 1.8.0.
- 2026-02-03: Theme sync now updates live; workflow name edits keep focus; workflows/templates are collapsible; template list moved into its own card; bumped version to 1.8.1.
- 2026-02-03: Color scheme vars now read from app root CSS; collapse arrows added; bumped version to 1.8.2.
- 2026-02-03: Color scheme sync now parses root style attribute for CSS vars; added expand/collapse tips; bumped version to 1.8.3.
- 2026-02-03: Fixed chat menu buttons to register in hamburger with iconType none; bumped version to 1.8.4.
- 2026-02-03: Restored chat menu buttons to input hamburger location; color scheme sync checks html/body inline styles; bumped version to 1.8.5.
- 2026-02-03: Settings now pull color scheme from database (fallback to CSS vars) and spacing/alignment of collapsible rows fixed; bumped version to 1.8.6.
- 2026-02-03: Menu buttons now refresh on trigger edits; theme polling uses minimal DB keys and clears on unload; bumped version to 1.8.7.
- 2026-02-05: `/cw` now ignores image-only messages for `lastMessage` resolution.
- 2026-02-05: Image display prefers inlay assets to avoid base64 in chat exports (fallback to data URLs).
- 2026-02-12: Confirmed Comfy Commander still depends on `/proxy2`; migration deferred until server execution Phase D. No behavior change shipped for Comfy in this slice.
