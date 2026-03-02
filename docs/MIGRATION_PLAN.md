# Migration Plan: Prototype Shell -> Original App

## Goal
- Move the approved shell/navigation/layout system from the prototype into the real app without rewriting business logic.

## Scope
- In scope:
  - topbar + view routing shell
  - global drawer + right workspace drawer
  - right sidebar tab host (chat + character config surfaces)
  - primitive/token mapping (`panel-shell`, `control-field`, `seg-tab`, `icon-btn`, layer tokens)
- Out of scope for prototype runtime:
  - chat runtime themes (`standard/waifu/mobilechat/cardboard/customHTML`)
  - custom chat background upload/toggle

## Strategy
- Use incremental migration under feature flag (`ui_shell_v2`), not a full rewrite.
- Preserve existing app state/actions; swap composition and styling layer-by-layer.
- Migration constraint: transplant UI only. Do not change existing app logic or feature behavior.

## Locked Product Decisions (2026-02-21)
- Sidebar tab order remains exactly current app order: `Chats`, `Basics`, `Display`, `Lorebook`, `Voice`, `Scripts`, `Advanced`, `GameState`, `Share`.
- Default landing workspace: `characters`.
- Character card click behavior: open last selected chat for that character.
- Right inspector availability: chats only.
- Library surface: unified page (ingest + retrieval config + list).
- Playground rollout scope: full current toolset (UI transplant only).
- Settings model: single workspace with internal section tabs.
- Rollout mode for `ui_shell_v2`: dev-only -> internal QA -> optional beta -> default-on after stability.

## UI Contract to Carry Over
- View transitions only through `enterXView()` controllers.
- Top-level visibility via `.hidden` only.
- Drawer state changes via `openDrawer()` / `closeDrawer()` only.
- Global nav routing from `data-workspace-view` only.
- Persistent containers render through `replaceMarkup()` (or Svelte equivalent keyed render path).

## Pre-Migration Decisions (Required)
- Color scheme architecture:
  - Decide whether production keeps runtime JS ramp generation or moves to CSS scheme packs (`data-scheme` / class switch model).
  - Decision must be made before Phase 1 to avoid rework in token plumbing.
- Implementation module boundaries:
  - Do not mirror prototype monolith structure in production.
  - Plan production implementation as separated modules (shell frame, view controllers, sidebar host, settings/display integration, event bindings).
- Branch/worktree isolation:
  - Start migration on a clean baseline branch/worktree to keep reviewable diffs and safe rollback.

## Phases

## Per-Phase Test Gate (Required)
- Every phase must ship both of the following before sign-off:
  - unit/contract check updates for the invariants introduced in that phase (for example `node` contract scripts under `dev/`)
  - runtime smoke test updates that exercise the migrated flow for that phase (for example targeted `vitest` smoke specs)
- No phase is complete unless both test types are updated (or explicitly confirmed still sufficient) and passing.
- Required command at end of every shell phase:
  - `pnpm run check:ui-shell-smoke`
- Phase-specific checks remain mandatory in addition to shell checks (for example settings slices still run `pnpm run check:settings-smoke`).

## Per-Phase Shell Composition Gate (Required)
- `src/App.svelte` is orchestration-only for shell state, route sync, and overlay handling.
- Shell v2 orchestration must live in dedicated components (current baseline: `src/lib/UI/AppShellV2.svelte`, `src/lib/UI/AppShellTopbar.svelte`, and `src/lib/UI/AppShellStage.svelte`).
- New phase work must extend shell components or add new focused shell components; do not re-inline large workspace markup blocks into `src/App.svelte`.
- Shell composition boundaries must be protected by contract checks in `dev/check-ui-shell-contract.js`.

## Phase 0: Baseline
- Freeze prototype contracts (`DESIGN_RULES.md`, `UI_CHANGE_CHECKLIST.md`).
- Snapshot current app behavior for Home/Chat/Library/Settings.
- Gate: `pnpm run check:prototype` clean.
- Test deliverable:
  - establish baseline unit/contract checks and runtime smoke coverage for shell migration entry points.

## Phase 1: Shell Frame in Real App
- Introduce new topbar, stage, scrim, and drawer scaffolding behind `ui_shell_v2`.
- Keep existing route content mounted with no behavior changes.
- Exit criteria:
  - navigation still works
  - no modal/drawer z-index regressions
- Test deliverable:
  - add/update unit/contract checks for topbar/stage/overlay invariants
  - add/update runtime smoke for workspace transitions and transient overlay clearing

## Phase 2: Right Sidebar Host
- Mount current `SideChatList` and `CharConfig` into new right drawer tab host.
- Keep current data paths and callbacks unchanged.
- Exit criteria:
  - chat list actions work
  - character config tabs render existing content 1:1
- Test deliverable:
  - add/update unit/contract checks for right-sidebar mount/composition invariants
  - add/update runtime smoke for sidebar tab switching and open/close behavior
- Sign-off evidence:
  - `docs/UI_PHASE2_SIGNOFF.md`

## Phase 3: Home + Global Drawer
- Migrate home character directory to shell composition.
- Add recent chats quick-open in global drawer.
- Exit criteria:
  - character -> chat entry rules preserved
  - recent chats reflects latest activity
- Test deliverable:
  - add/update unit/contract checks for home/global-drawer routing invariants
  - add/update runtime smoke for character selection, last-chat entry, and recent-chat quick-open

## Phase 4: Primitive/Token Convergence
- Replace feature-scoped duplicates with shared primitives.
- Ensure token contracts are complete in production styles.
- Exit criteria:
  - no ghost class dependencies
  - focus-visible and active-state rules pass
- Test deliverable:
  - add/update unit/contract checks for primitive/token contracts introduced in the phase
  - add/update runtime smoke for high-risk UI regressions affected by primitive consolidation

## Phase 5: Mobile UI Convergence
- Focus specifically on mobile shell/navigation/layout parity across core workspaces.
- Align mobile drawer behavior, touch targets, spacing, and workspace entry/exit flows with the migrated shell model.
- Exit criteria:
  - mobile navigation model is consistent across Home, Chats, Library, Playground, and Settings
  - mobile drawer open/close/scrim/back behavior is deterministic
  - touch target sizing and spacing meet usability baseline on phone viewports
  - no mobile-only blocking regressions in composer/sidebar/workspace transitions
- Test deliverable:
  - add/update unit/contract checks for mobile shell/navigation invariants introduced in the phase
  - add/update runtime smoke for phone viewport navigation flows, drawer lifecycle, and workspace transitions

## Phase 6: Deferred Theme/Background Integration
- Implement chat theme/background in the original app display/chat modules only.
- Reuse original app settings keys and persistence.
- Exit criteria:
  - theme changes affect chat runtime only
  - background has color fallback and mobile parity
- Test deliverable:
  - add/update unit/contract checks for theme/background scope constraints
  - add/update runtime smoke for theme switching/background behavior across supported layouts

## Testing Plan
- Automated:
  - prototype checks (`pnpm run check:prototype`)
  - per-phase unit/contract checks (update with each migration phase)
  - per-phase runtime smoke checks (update with each migration phase)
  - shell phase gate (`pnpm run check:ui-shell-smoke`)
  - app lint/type/tests
  - targeted UI smoke for shell routes
- Manual:
  - desktop + narrow laptop + tablet + mobile viewport walkthrough
  - keyboard focus + drawer open/close + view transitions
  - long chat scrolling + composer behavior

## Rollout Plan
- Stage 1: dev-only flag on.
- Stage 2: internal QA + bugfix sweep.
- Stage 3: optional beta toggle.
- Stage 4: default-on after stability window.

## Rollback
- Disable `ui_shell_v2` flag.
- Keep legacy shell path until migration sign-off is complete.
