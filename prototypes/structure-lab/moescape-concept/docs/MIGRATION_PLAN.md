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

## Phase 0: Baseline
- Freeze prototype contracts (`DESIGN_RULES.md`, `UI_CHANGE_CHECKLIST.md`).
- Snapshot current app behavior for Home/Chat/Library/Settings.
- Gate: `pnpm run check:prototype` clean.

## Phase 1: Shell Frame in Real App
- Introduce new topbar, stage, scrim, and drawer scaffolding behind `ui_shell_v2`.
- Keep existing route content mounted with no behavior changes.
- Exit criteria:
  - navigation still works
  - no modal/drawer z-index regressions

## Phase 2: Right Sidebar Host
- Mount current `SideChatList` and `CharConfig` into new right drawer tab host.
- Keep current data paths and callbacks unchanged.
- Exit criteria:
  - chat list actions work
  - character config tabs render existing content 1:1

## Phase 3: Home + Global Drawer
- Migrate home character directory to shell composition.
- Add recent chats quick-open in global drawer.
- Exit criteria:
  - character -> chat entry rules preserved
  - recent chats reflects latest activity

## Phase 4: Primitive/Token Convergence
- Replace feature-scoped duplicates with shared primitives.
- Ensure token contracts are complete in production styles.
- Exit criteria:
  - no ghost class dependencies
  - focus-visible and active-state rules pass

## Phase 5: Deferred Theme/Background Integration
- Implement chat theme/background in the original app display/chat modules only.
- Reuse original app settings keys and persistence.
- Exit criteria:
  - theme changes affect chat runtime only
  - background has color fallback and mobile parity

## Testing Plan
- Automated:
  - prototype checks (`pnpm run check:prototype`)
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
