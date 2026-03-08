# UI System Redesign RFC (Unified App Model)

Last updated: 2026-02-17
Status: Draft for approval

## 1. Problem Statement
The current app behaves like multiple unrelated products stitched together:
- Characters, Chats, Library, and Settings use different layout and interaction models.
- Selection and navigation contracts differ per surface (modal/overlay/full-page/hybrid).
- Cross-surface state is not governed by one canonical route model.

Result: users cannot predict what a click does, and fixes in one surface regress another.

## 2. Redesign Goal
Create one coherent product shell with one interaction contract for all major workspaces.

Non-goals:
- No backend/provider migration in this initiative.
- No feature expansion beyond parity and coherence.

## 3. Product Information Architecture
Top-level workspaces:
1. Home
2. Characters
3. Chats
4. Library (RAG)
5. Settings

Single shell layout:
1. Left rail: global workspace navigation + quick context status.
2. Main content frame: active workspace view.
3. Optional right inspector: workspace-specific details, using a shared inspector pattern.

No top-level workspace uses ad-hoc overlays as primary navigation.
Overlays are allowed only for transient actions (confirmations, import/export dialogs, quick pickers).

## 4. Canonical Navigation State (Single Source)
Define one app-route store used by all surfaces.

```ts
interface AppRoute {
  workspace: "home" | "characters" | "chats" | "library" | "settings";
  selectedCharacterId: string | null;
  selectedChatId: string | null;
  inspector: "none" | "details" | "chat" | "character";
}
```

Rules:
1. Workspace switch clears transient UI overlays.
2. `selectedChatId` must belong to `selectedCharacterId` when both are set.
3. Invalid selection auto-repairs to `null` with non-blocking toast/log entry.
4. Back navigation follows route transitions, not component-local booleans.

## 5. Unified Entity Interaction Contract
Apply to Characters, Chats, Rulebooks:
1. List pane + detail pane model.
2. Same commands: `Create`, `Select`, `Rename/Edit`, `Delete`, `Import`, `Export`.
3. Same empty/loading/error patterns.
4. Same search/sort/filter toolbar behavior.

Entity pages should differ by content only, not by control semantics.

## 6. Workspace Contracts
### 6.1 Characters
- Left section: character collection.
- Main detail: character overview + actions.
- Optional inspector: metadata/history.
- Selecting a character does not implicitly open overlays.

### 6.2 Chats
- Requires selected character context.
- If no character selected: inline state with clear CTA to select/create character.
- Chat list and timeline stay in one stable frame; no modal-first navigation.

### 6.3 Library (RAG)
- Rulebook collection, ingest jobs, and retrieval settings in one workspace.
- No separate hidden panel for core RAG controls.

### 6.4 Settings
- Keep current sections, but render through shared workspace primitives.
- Settings remains top-level workspace, not a separate shell paradigm.

## 7. Design System and Components
Token-first (per `CONVENTIONS.md`):
1. Tokens
- spacing, sizing, radius, borders, motion, color roles.
2. Primitives
- `AppShell`, `PageHeader`, `Toolbar`, `CollectionPane`, `DetailPane`, `InspectorPane`, `EmptyState`.
3. Composites
- `EntityList`, `EntityRow`, `EntityGridCard`, `EntityActions`.

Prohibited in new slices:
- one-off hardcoded geometry when token exists,
- direct DOM state querying,
- feature-specific navigation booleans as global routing substitute.

## 8. Migration Strategy (Safe Slices)
### Slice 0: Architecture lock (this RFC)
- Approve IA and route contract before implementation.

### Slice 1: Shell + route store
- Add canonical route store and app-shell wiring.
- Keep existing feature internals, only adapt entry points.
- Acceptance: workspace switching deterministic; no ghost overlays.

### Slice 2: Characters + Chats convergence
- Rebuild Characters and Chats pages on shared layout primitives.
- Acceptance: same command model and predictable selection behavior.

### Slice 3: Library convergence
- Move rulebook/RAG controls into unified workspace scaffolding.
- Acceptance: no detached flows for ingest/search/settings.

### Slice 4: Settings convergence
- Render sections using same shell/page primitives.
- Acceptance: settings no longer feel like a separate app.

### Slice 5: Legacy removal
- Remove orphaned/duplicate navigation and overlay paths.
- Add regression smoke coverage for route transitions.

## 9. Regression Gates per Slice
1. `pnpm check` passes.
2. `pnpm test` passes.
3. Unit/contract checks are updated (or explicitly confirmed sufficient) for invariants introduced in the slice.
4. Desktop smoke:
- switch all top-level workspaces sequentially,
- select character, open chat, return home, reopen chats,
- verify no stale panel remains mounted.
5. Mobile smoke:
- top-level navigation parity,
- no dead-end states.
6. For shell-phase slices, run `pnpm run check:ui-shell-smoke` as a required phase gate.

## 10. Resolved Decisions (Product Lock 2026-02-21)
1. Landing workspace: `characters`.
2. Character select behavior: auto-open latest chat (`yes`).
3. Right inspector scope: chat-only.
4. Library composition: unified (ingest + retrieval config + list).
5. Settings composition: single workspace with internal section tabs.
6. Migration constraint: no logic/feature changes, UI transplant only.
7. Rollout mode: `ui_shell_v2` staged (dev -> QA -> optional beta -> default-on).
