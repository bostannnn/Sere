# Migration Map: Concept -> Real App

Purpose: map prototype UI to actual app surfaces before coding production integration.

## A) Core Principle
- Move shell/navigation first.
- Keep existing business logic and data flows.
- Replace visuals and composition incrementally under a feature flag.
- UI transplant only: no behavior or feature scope expansion during migration slices.

## A1) Phase Test Gate (Required)
- Every migration slice/phase must include:
  - unit/contract check updates for new invariants introduced in that slice
  - runtime smoke test updates for the migrated interactions in that slice
- Required shell-phase gate command:
  - `pnpm run check:ui-shell-smoke`
- Feature-specific phase checks remain mandatory in addition to shell checks (for example settings slices still run `pnpm run check:settings-smoke`).

## Decision Lock (2026-02-21)
- Landing workspace is `characters`.
- Character select opens last selected chat.
- Inspector panel is chat-only.
- Library stays unified in one workspace surface.
- Settings stays single-workspace with internal tabs.
- Rollout uses `ui_shell_v2` staged enablement (dev -> QA -> beta -> default-on).

## B) Concept-to-Component Mapping

## 1) Shell / Layout
- Concept: top bar + home view + chat view + global drawer + right workspace drawer
- Real app candidates:
  - `src/lib/SideBars/*` and shell containers currently used by main app routes
  - `src/styles.css` design-system layout classes (`ds-...`)

## 2) Chat List in Right Sidebar
- Concept: `Chats` tab in right sidebar for character-scoped chat list/actions, with left drawer `Recent Chats` as global quick-open
- Real app source of truth:
  - `src/lib/SideBars/SideChatList.svelte`
- Migration rule:
  - Reuse `SideChatList` logic; re-skin and place inside right drawer tab panel

## 3) Character Config Tabs
- Concept tabs: Basics, Display, Lorebook, Voice, Scripts, Advanced, GameState, Share
- Real app source of truth:
  - `src/lib/SideBars/CharConfig.svelte`
  - `src/lib/SideBars/LoreBook/*`
  - `src/lib/SideBars/GameStateEditor.svelte`
  - `src/lib/SideBars/GameStateHUD.svelte`
- Migration rule:
  - Reuse existing tab logic/state (`CharConfigSubMenu`) and adapt visual wrapper to new tab strip

## 4) Global Note Replacement and Advanced
- Real app source of truth:
  - `CharConfig.svelte` (`replaceGlobalNote` and advanced fields)
- Migration rule:
  - Preserve exact field keys/data paths; visual migration only
  - Resolve UI labels from app language/settings metadata (for example `src/lang/*` and settings schemas), not raw storage keys/camelCase identifiers.

## 5) Home Character Cards
- Concept: portrait card library
- Real app candidates:
  - existing character list/grid components used in home/main route
- Migration rule:
  - replace list presentation with portrait cards while preserving selection/create/import logic

## 6) Last Chat Per Character
- Concept behavior:
  - clicking character opens remembered last chat
- Real app integration target:
  - state handling around character selection + `chatPage` switching
- Migration rule:
  - reuse existing chat index state where possible; add deterministic fallback if remembered chat missing

## 7) Display Theme + Background
- Prototype status:
  - Intentionally deferred from prototype runtime.
  - Implement in production migration only.
- Real app source of truth:
  - `src/lib/Setting/Pages/DisplaySettings.svelte`
  - `src/lib/ChatScreens/ChatScreen.svelte`
  - `src/lib/ChatScreens/Chat.svelte`
- Migration rule:
  - preserve original app option list and keys
  - keep scope chat-only (do not apply theme/background to library/settings/home shells)
  - map persisted values to existing display settings state, not concept-specific storage keys
  - follow `MIGRATION_PLAN.md` phase sequencing and rollout gates

## C) Implementation Slices

## Slice 1: New Shell Frame (Low-Med Risk)
- Add top bar + drawer scaffolding under feature flag.
- Keep current content components mounted inside new shell.

## Slice 2: Right Sidebar Tabs (Med Risk)
- Mount `SideChatList` and `CharConfig` into right-sidebar tab host.
- Preserve existing actions and data-binding unchanged.

## Slice 3: Home + Global Drawer (Med Risk)
- Re-skin character directory to portrait cards.
- Add recent chats quick-open in the global drawer.
- Keep existing create/import/delete/select behavior.

## Slice 4: Last-Chat Memory (Med Risk)
- Ensure selection opens last chat for character.
- Add fallback for deleted/missing chat.

## Slice 5: Interaction Hardening (Med-High Risk)
- Drawer toggle consistency, scrim behavior, keyboard behavior.
- Responsive fixes and overflow management.

## D) Feature Flag Plan
- Flag name example: `ui_shell_v2`.
- Default: off.
- Enable for dev and targeted QA first.
- Rollout steps:
  1. Dev only
  2. Internal QA
  3. Optional beta toggle
  4. Default on after stability window

## E) Risks to Watch
- Regressions in chat actions from `SideChatList` after relocation.
- Broken bindings in `CharConfig` if wrapper changes lifecycle.
- Mobile overflow from wide right-sidebar tab strip.
- Inconsistent focus management between drawers and modals.

## F) Pre-Implementation Gate
Start production integration only when:
- Concept checklist is fully approved.
- This mapping is validated against current codebase paths.
- Slice order and feature flag plan are approved.
