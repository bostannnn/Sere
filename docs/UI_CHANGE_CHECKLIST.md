# UI Change Checklist (Moescape Concept)

Use this checklist for every change before moving to the next iteration.

Before starting, read the relevant sections of `docs/DESIGN_RULES.md` for the area you are changing. This checklist is for **verifying** those rules held after your change, not for re-defining them.

Run `pnpm run check:prototype` first — it automates ~70 of these checks. Only items that require visual or manual verification appear below.

## A) Shell and navigation — verify against DESIGN_RULES sections 1, 2, 3, 11

- Home/Rulebooks/Settings navigation works from topbar primary icon controls.
- Playground navigation works from topbar `More` overflow.
- Character card click enters chat. Title click returns to home.
- `More` overflow opens/closes deterministically and closes on outside click or `Escape`.
- Right workspace sidebar toggle in Chat opens/closes deterministically and persists state.
- Right workspace sidebar toggle in Library opens/closes deterministically and persists state independently from Chat.
- Topbar search is visible in Home and Library, hidden in Chat/Playground/Settings.
- Library stage contains no second title/search/toolbar lane; shared topbar search is the only search field.
- Library topbar right controls are present and functional: `grid/list`, `Add Documents`, sidebar toggle.
- Library right sidebar exposes `Library` and `Settings` tabs and both panes render correctly.
- Model picker opens as a body-level overlay (not nested in local panel containers), and remains visible when launched inside overflow-constrained settings panes.
- Narrow shell widths trigger topbar compact mode (search stays usable, controls remain reachable, no overflow clipping).
- Topbar nav row must keep a stable x-position when switching workspaces (no jumping due to dynamic title text).

## B) Workspace tabs — verify against DESIGN_RULES sections 4, 14

- Tab strip is visible for multi-tab modes, hidden for single-tab modes.
- Sidebar mode switch (Chat/Character/State) has no segmented border frame.
- Tab strip has no horizontal or vertical scrollbar at any tested viewport width.
- Switching tabs does not collapse or stretch the tab bar.
- Portrait tile active state shows outer ring, not accent underline.

## C) Content region behavior — verify against DESIGN_RULES section 2

- Only the content area scrolls — topbar, profile block, and tab strip do not scroll.
- Switching from a long tab to a short tab produces no blank spacer.
- Switching tabs resets the content scroll region to top.

## D) Chat + character state

- Character click opens remembered last chat for that character.
- Selecting chat in workspace updates remembered last chat.
- Returning to same character restores same chat.
- Tab switches do not alter selected character/chat.
- Composer Enter-to-send does not fire while IME composition is active.

## E) Reading mode behavior

- Display -> Theme shows only `Normal` and `Focus` reading modes (`Focus+` absent).
- On desktop width (`>=1024px`) with `Standard` theme, enabling `Focus` centers messages and composer into one constrained reading lane.
- On desktop width (`>=1024px`) with `Mobile Chat` theme, enabling `Focus` applies the same centered-lane readability behavior.
- In `Focus` mode, message controls stay aligned with each message row/title and do not float as a detached right-side column.
- First message in viewport follows the same lane/alignment as all subsequent messages.
- On unsupported themes (`customHTML`, `waifuMobile`) or tablet/mobile widths (`<1024px`), effective reading mode falls back to `normal`.

## F) Regression smoke checks

- Test `Chats`, `Basics`, `Display`, `Lorebook`, `Voice`, `Scripts`, `Advanced`, `GameState`, `Share`.
- Perform rapid tab switching (5-10 clicks across different tabs).
- Resize viewport to narrow width and re-test tab strip behavior.
- Confirm no unexpected scrollbars appear in shell chrome.

## G) Done criteria

- No layout jumps between tabs.
- No hidden/overlap artifacts.
- No state desync in character/chat selection.
- No accessibility regressions on icon controls.
- Tab-pattern controls (`.seg-tab`, `.item-btn` in tab contexts) use accent-edge active treatment.
- List-pattern controls (`.ds-settings-nav-item`, `.ds-settings-key-chip`, `.rag-system-row`) use filled active surface treatment.

## H) Visual depth + primitives

- Topbar is visually lighter than drawers.
- Drawers read as overlay depth (left/right edge elevation visible).
- Scrim overlays stage content but remains below topbar/drawers in stacking order.
- Cards/panels, rows/inputs, and active states each use distinct layer tokens.
- Chat bubbles use tokenized backgrounds (no hardcoded white/blue fills).
- Shell chrome highlights and inset sheens use theme tokens (`var(--ds-*)` + `color-mix`), not hardcoded `rgb(255 255 255 / ...)`.
- Each drawer uses exactly one elevation source (shared `.drawer-elevation--*` primitive or local `box-shadow`, not both).
- Topbar/global-rail responsive density changes are driven by container width (`@container`), not viewport-only breakpoints.
- Global rail compact-density breakpoint is below `--ds-nav-rail-width` so default desktop rail width keeps baseline spacing/typography.
- New shell containers use `.panel-shell`; new input/select/textarea controls use `.control-field`; chip-like controls use `.control-chip`.
- Verify dropdowns and text inputs render at the same height across shell surfaces.
- Display -> Theme -> Color Scheme uses the original app scheme list (default/dark/light/cherry/galaxy/nature/realblack/monokai-light/monokai-black/lite).
- Switching Color Scheme updates shell tokens live without reloading.
- Selected Color Scheme persists across refresh via `sessionStorage` (`moescape.colorScheme`).
- Display settings include Color Scheme and Reading Mode controls; verify both remain functional after theme/layout changes.
- Chat runtime theme/background behavior must follow `DESIGN_RULES` section 23 contracts (existing keys/paths, no shell overflow, no detached controls).
- Runtime exposes generated ramps for `primary/secondary/danger/success/warning/neutral` (`50..900`) as CSS tokens.
- Folder highlight gradients, scrim tint, and semantic text colors (`success/warning/danger`) follow scheme tokens after switching.
- Settings Persona profile keeps a fixed avatar column and flexible editor column at narrow widths.
- Settings Persona add action is a tile-level sibling in the persona tile row.
- Settings page headings are not used as layout wrappers for action buttons.
