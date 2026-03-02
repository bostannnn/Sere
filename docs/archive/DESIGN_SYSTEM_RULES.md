# Design System Rules (Token-First)

Last updated: 2026-02-10

## Purpose
This document defines mandatory UI governance for all core UI changes.
Goal: stop ad-hoc spacing, color, radius, and component variants from being invented during feature work.

## Source of Truth
1. UI rewrite execution order: `ui_rewrite_plan.md`
2. Product plan priority: `plan.md`
3. Agent behavior rules: `AGENTS.md` and `DEV_RULES.md`
4. Current token contract: `TOKENS_BASELINE.md`
5. Normalized token target: `TOKENS_NORMALIZED_V1.md`
6. Component constraints: `COMPONENT_RULES.md`
7. Settings behavior freeze: `SETTINGS_BEHAVIOR_CONTRACT.md`
8. Settings smoke verification: `SETTINGS_SMOKE_CHECKLIST.md`
9. Full UI baseline tracker: `UI_BASELINE_MATRIX.md`

## Mandatory Build Order
1. Baseline token spec (current UI values and mappings).
2. Primitive components (`Button`, `Input`, `Tab`, `Panel`, `ListRow`, `MessageBubble`).
3. Screen composition (`Chat`, `Character`, `Settings`, `Mobile Nav`).

No screen-level redesign work is allowed before steps 1 and 2 are documented.

## Baseline Completion Gate (Blocking)
1. New UI feature work is blocked until baseline standardization is complete across all UI surfaces.
2. This includes:
   - settings pages,
   - non-settings chat screens,
   - navigation surfaces (desktop + mobile),
   - overlays (dropdowns/selects/modals/menus/toasts/tooltips),
   - shared list and panel patterns.
3. "Complete" requires:
   - token-first usage,
   - primitive-first usage,
   - no unmanaged legacy styling branches in active paths,
   - desktop/mobile smoke validation in both dev and server modes.
4. `UI_BASELINE_MATRIX.md` must show all baseline rows as `DONE` or approved `EXCEPTION`.

## Token Governance
1. All new visual values must come from tokens.
2. Direct hard-coded values in components are disallowed when a token exists.
3. If a needed token does not exist:
   - Add it to the token spec.
   - Document why.
   - Use it in component code.
4. Token layers must stay separated:
   - Foundation: raw values (color, spacing, radius, type scale, motion).
   - Semantic: intent roles (`surface.primary`, `text.muted`, `border.subtle`, etc.).
   - Component: optional aliases for specific primitives.

## Primitive Governance
1. New UI should use primitives first, not one-off markup styles.
2. Primitive API changes must be documented before mass adoption.
3. New primitive variants require:
   - a concrete use case,
   - token mapping,
   - update note in `plan.md` or `ui_rewrite_plan.md`.

## Change Control
1. Every UI slice must include:
   - files changed,
   - token impact,
   - primitive impact,
   - test steps (desktop + mobile if relevant).
2. If visual behavior changes, update docs in the same slice.
3. Do not introduce new spacing/radius/font scales without token spec update.
4. If a slice touches one UI surface while leaving adjacent surfaces inconsistent, record a follow-up in `ui_rewrite_plan.md` before merging.

## Validation Cadence (Dev-First)
1. Default UI slice loop is `pnpm dev` + `pnpm check` (and `pnpm check:settings-smoke` for settings slices).
2. `pnpm build` + `pnpm run runserver` are required at checkpoint slices, before final server-mode signoff, or when explicitly requested.
3. Any server-mode manual verification must be done against a freshly rebuilt `dist/`.

## Review Checklist (Required)
1. Does this change use tokens instead of literal values?
2. Does it use primitives where available?
3. Did it add any new variant/value without updating docs?
4. Does it preserve desktop/mobile behavior?
5. Was `pnpm check` run?
6. If this was a server-mode validation checkpoint, were `pnpm build` and `pnpm run runserver` run?
7. Are check controls left-aligned unless a documented exception exists?
8. Are navbar icon slots centered without one-sided spacing offsets?
9. For mixed text/icon navbar rows, are slot widths explicit (for example, equal grid columns) so centering remains stable across breakpoints?
10. For mobile header/top/footer nav bars, are heights explicit tokenized shell heights (not `min-height + large padding` growth)?
11. For mobile nav tracks, do they center when content fits and scroll horizontally when overflowing, without breakpoint-only forced left alignment?

## Exception Path
If a one-off value is unavoidable, add a short inline comment and create a follow-up item in `plan.md` to replace it with a token.
