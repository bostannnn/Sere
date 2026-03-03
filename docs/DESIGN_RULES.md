# Design Rules (Moescape Concept)

These rules are mandatory for every next iteration in this concept.

## 1) Product shell contract

- `Home` view shows the Character Library only.
- Shell topbar is the only title bar; do not add a second per-view title/header bar in content.
- Top-level navigation lives in shell topbar icon controls (`Home`, `Rulebooks`, `Settings`) plus `More` overflow.
- `Playground` is routed from `More` overflow and must not duplicate as a separate primary topbar icon.
- Search for `Home` and `Library` lives in a shared shell topbar component, not inside per-view content.
- `Chat` view shows message runtime only.
- Shell-level cross-workspace navigation is topbar-only (`Home`, `Rulebooks`, `Settings`, `More` overflow); no left global drawer.
- Right workspace drawer is the single place for character-scoped chat list/actions and character settings.
- Library workspace follows the same shell-parity model: no internal content header/title/search bars, and no duplicated in-content toolbar row.
- Library workspace controls (`grid/list`, `Add Documents`, sidebar toggle) live in the shared topbar right lane.
- Library filters/settings live in the right workspace drawer with two tabs: `Library` and `Settings`.
- No duplicate character-scoped chat selector in topbar or home cards.

## 2) Layout invariants

- Every major layout container must define an explicit row/column contract.
- Row/column contracts must be updated in the same change whenever child structure changes.
- Header/profile/tab chrome is fixed-height, non-scrolling UI.
- Only content regions scroll.
- Never allow horizontal scrolling on any chrome (topbar, tab bars, drawer headers, settings sub-tabs, and shell controls).
- Shell chrome responsiveness must be component-scoped: topbar and overflow/popover density changes use `@container` rules, not viewport-wide `@media` breakpoints.
- Shell containers that drive responsive chrome must declare `container-type: inline-size` with a stable `container-name`.
- All view sections must be exclusively toggled via `hidden` class through dedicated `enterXView()` functions.
- No view may be shown/hidden outside `enterXView()` functions.
- View visibility is controlled only via `.hidden` class toggles; inline `display` styles are forbidden in HTML/templates and JS.
- Top-level view show/hide operations (`homeView`, `chatView`, `libraryView`, `playgroundView`, `settingsView`) must occur only inside `enterXView()` functions.
- `enterXView()` is the single place responsible for subtitle text, `topSidebarBtn` visibility, drawer state, and `setWorkspaceNavActive()` call.
- Shell layering order is tokenized and documented: `--z-view` < `--z-scrim` < `--z-topbar` < `--z-drawer` < `--z-overlay` < `--z-toast`.
- `#scrim` remains in `.app-shell` and must visually sit above stage content but below topbar and drawers.

## 3) Overlay architecture

- Topbar `More` overflow and workspace sidebar are independent surfaces with separate contracts.
- Overflow open/close controls are idempotent: click once open, click again close.
- `Escape` and outside-click close topbar overflow deterministically.
- Right workspace sidebar toggle is idempotent: click once open, click again close.
- Scrim state must reflect actual open overlays only.

## 4) Tab system contract

- Workspace tabs are persistent shell controls, not tab-content.
- Tab switching replaces only the tab-content container.
- Tab-strip visibility is mode-driven: show strip when a mode has 2+ tabs; hide strip when a mode has exactly 1 tab.
- Sidebar mode switch (`Chat`/`Character`/`State`) is a borderless grouped control and must not reuse `.seg-tabs`; only the lower tab strip uses `.seg-tabs`.
- Sidebar mode switch grid must be future-proofed (`repeat(auto-fit, minmax(0, 1fr))`), not hardcoded to a fixed mode count.
- Tab buttons are equal-width, fill full row width, and never scroll.
- Icon tabs require `aria-label` and `title`.

## 5) State model rules

Single source of truth:

- `selectedCharacterId`
- `selectedChatId`
- `selectedSidebarTab`
- `lastChatByCharacter`

Behavior rules:

- Character click opens remembered last chat for that character.
- Selecting a chat updates `lastChatByCharacter`.
- Tab switch does not mutate character/chat selection.
- Per-tab sub-panel state (for example `sidebarDisplayViewSubmenu`, `sidebarLorebookSubmenu`, `sidebarTriggerMode`, `sidebarVoiceMode`) must reset to defaults whenever `selectedCharacterId` changes.
- `sidebarChatQuery` must be reset to `''` whenever `selectedCharacterId` changes, and is part of `resetSidebarCharacterSubpanels()`.
- `selectedPlaygroundTool` persists across view transitions and is reset only by explicit user action (Back button). `enterPlaygroundView()` must not reset it.
- Context drawer open/closed preference is persisted in `sessionStorage` under `moescape.contextDrawerOpen`.
- All drawer open/close operations must go through `openDrawer()` / `closeDrawer()`; never direct `classList` open/close mutations.
- `closeAllDrawers()` must call `closeDrawer()` for each drawer and must not bypass preference/scrim logic.

## 6) Rendering boundaries

- `replaceMarkup(target, markup)` is the required rendering helper for persistent containers.
- `replaceMarkup()` must guard against null targets.
- `renderXxx()` functions must use `replaceMarkup()` for persistent containers.
- The only permitted call site for `htmlToFragment()` is inside `replaceMarkup()`.
- The only permitted `innerHTML =` assignment is `template.innerHTML = markup` inside `htmlToFragment()`.
- `innerHTML` is only permitted for leaf content nodes fully owned by one render function and with no delegated listeners on that container.
- Any `innerHTML` exception must be documented inline.
- Re-render only scoped content sections.
- Event listeners attach to stable roots; use delegation for dynamic rows.
- After tab switch, reset content scroll region to top.

## 7) Component composition rules

- No unnecessary nested cards for the same semantic block.
- Use consistent section pattern: title -> controls -> content.
- Settings title/action rows must use a dedicated row container (for example `.ds-settings-page-title-row`); do not use heading tags as flex action wrappers.
- Persona profile uses explicit two-column layout: fixed avatar column + flexible editor column.
- Reuse spacing, radius, and border tokens; no ad-hoc one-off values.

## 8) Accessibility baseline

- All icon-only controls must have accessible names.
- Focus states must remain visible on all interactive elements.
- Hit targets should remain usable at narrow drawer widths.
- Composer Enter-to-send handling must ignore IME composition events (`event.isComposing` / keycode `229` fallback) to avoid accidental submits during CJK input.

## 9) Visual consistency rules

- Keep shell density and spacing consistent between tabs.
- Avoid introducing new visual styles in one tab only without design intent.
- New UI blocks must match existing component language in the concept.

## 10) Change safety rule

Any layout-affecting change must include:

- Updated docs/checklist status
- Full tab-switch regression pass
- Confirmation there are no new unintended scrollbars or overlay artifacts

## 11) View routing contract

- Global drawer navigation is the only entry point for top-level view changes (`Library`, `Settings`), except character-card clicks that enter `Chat`.
- Navigation targets are declared via `data-*` attributes on trigger elements (for example `data-workspace-view`).
- Routing logic must read target values from `dataset`; never infer destination from text labels, DOM order, or element position.
- Every top-level view must have exactly one `enterXView()` function.
- `enterXView()` functions must always: (1) update `topbarSubtitle`, (2) toggle `topSidebarBtn`, (3) hide all other views, (4) show the target view, (5) call `setWorkspaceNavActive()`, and (6) manage drawer state via `closeAllDrawers()` or explicit context-specific drawer logic.

## 12) Prototype label policy

- All user-visible labels must be human-readable English strings.
- Internal key names (`camelCase`, `snake_case`) must not be used directly as UI labels.
- For prototype builds, a label map or label transform helper is acceptable; raw key strings are not.

## 13) Null safety contract

- All DOM element references obtained at startup via `getElementById()` must be checked for null before use if there is any possibility the element could be absent.
- `replaceMarkup()` must silently no-op on a null target.
- `enterXView()` functions must guard against null `selectedCharacterId` before entering views that require character context.

## 14) Playground state contract

- Playground tool selection (`selectedPlaygroundTool`) is preserved across view transitions.
- `enterPlaygroundView()` does not reset `selectedPlaygroundTool`.
- The Back button inside Playground is the only mechanism that returns tool selection to `'menu'`.
- Tool panel content is stateless and fully re-rendered on every `renderPlaygroundView()` call.

## 15) Label resolution contract

- All user-visible labels derived from data keys must be resolved through `settingLabel(key)` or an equivalent label map before rendering.
- This applies to `SETTINGS_ADVANCED_INPUTS`, `SETTINGS_ADVANCED_TOGGLES`, `SETTINGS_ACCESSIBILITY_TOGGLES`, and `HOTKEY_ROWS[].action`.
- Raw `camelCase` or `snake_case` keys must never appear in rendered HTML as user-facing text.

## 16) Layer token contract

- Shell depth must use layer tokens only: `--surface-topbar`, `--surface`, `--surface-raised`, `--surface-overlay`, `--surface-recessed`.
- Layer/chat tokens must exist in both `shared/base.css` (fallback baseline) and `styles.css` (concept-owned final values).
- Topbar is the lightest/most transparent shell layer; overlay drawers are the strongest/most opaque shell layer.
- Chat bubbles must use tokens (`--chat-assistant-bg`, `--chat-user-bg`) and must not use hardcoded `#ffffff` / `#e8f0ff` values.
- New components must not introduce hardcoded white/blue surface fills for shell layers.
- Shell chrome highlights (borders, divider glints, inset sheens) must be token-derived (`var(--ds-*)` + `color-mix`), not hardcoded `rgb(255 255 255 / ...)` literals.

## 17) Active-state contract

- Two active-state patterns are allowed and must not be mixed within the same control family:
  - `tab-pattern`: accent edge treatment (inset underline/bar), optional subtle fill.
  - `list-pattern`: filled active surface (`--ds-surface-active`) with stronger text, no accent edge underline.
- `tab-pattern` is required for tab-like controls: `.seg-tab.active`, `.item-btn.active`, sidebar mode/group buttons (via `.seg-tab` composition), settings sub-tabs.
- `list-pattern` is required for list/chip selections: `.ds-settings-nav-item.is-active`, `.ds-settings-key-chip.active`, `.rag-system-row.is-active`.
- Baseline `.item-btn.active` styling must include accent edge treatment and may not rely on flat `accent-soft` fill only.
- Hover and active states must be visually distinct for both patterns.
- Visual tile selections (for example portrait tiles) use an outer selection ring, not a tab-style inset underline.

## 18) Primitive contract (layout controls)

- Use shared primitives before creating feature-scoped variants: `.panel-shell`, `.control-field`, `.control-chip`, `.drawer-elevation--left`, `.drawer-elevation--right`.
- If a shared primitive exists for a UI pattern, it is mandatory in markup (for example `.icon-btn`, `.item-btn`, `.seg-tabs`/`.seg-tab`, `.list-shell`, `.empty-state`, `.action-rail`, `.panel-shell`, `.control-field`, `.control-chip`); feature classes are modifiers only.
- Feature-scoped classes may extend primitives but must not duplicate primitive baseline styles.
- Primitive fallback class definitions must exist in `shared/base.css`; concept-owned definitions live in `styles.css`.
- Drawer elevation must have a single source of truth per surface: use either `.drawer-elevation--*` primitives or component-local `box-shadow`, never both on the same drawer.
- Full-viewport view-root layout shells (for example `#libraryView.rag-dashboard`, `#settingsView.ds-settings-shell`) may omit `.panel-shell`; internal panel/card surfaces must still use primitives.
- Rule 18 is a composition/enforcement contract; this hardening does not introduce visual redesign requirements by itself.
- New shell/card containers should include `.panel-shell`; new form controls should include `.control-field`; chip/toggle buttons should include `.control-chip` where applicable.
- Text inputs and dropdowns must share the same control height through `.control-field` (`input`/`select` parity); do not style one-off select heights per feature.

## 19) Shell alignment contract

- Topbar is a single control lane: no second content header bars for Home or other views.
- Topbar must keep fixed control geometry across workspace switches; avoid dynamic title blocks that shift navigation controls.
- In the topbar lane, interactive controls align to a shared height token (`--chrome-btn-h`).
- Topbar search (`.topbar-search`) must match chrome control height, be centered in the right topbar lane, and use constrained width (`clamp(...)`) so it stays smaller than full-lane width on desktop.
- Topbar shared search visibility is view-driven: visible in `Home` (character filter) and `Library` (rulebook filter), hidden in `Chat`, `Playground`, and `Settings`.

## 20) Tokens reference (required)

Required CSS custom properties for shell contracts:

- Layer surfaces: `--surface-topbar`, `--surface`, `--surface-raised`, `--surface-overlay`, `--surface-recessed`
- Chat surfaces: `--chat-assistant-bg`, `--chat-user-bg`
- Layering stack: `--z-view`, `--z-scrim`, `--z-topbar`, `--z-drawer`, `--z-overlay`, `--z-toast`
- Shell sizing: `--topbar-h`, `--chrome-btn-h`
- Control sizing: `--ds-height-control-sm`, `--ds-height-control-md`, `--ds-icon-action-size`
- Radius sizing: `--ds-radius-sm`, `--ds-radius-md`, `--ds-radius-lg`, `--ds-radius-xl`
- Avatar placeholder: `--avatar-placeholder-bg`

Definition ownership:

- `shared/base.css` must include fallback definitions for required layer and chat tokens.
- `styles.css` is the concept-owned source of final token values and visual tuning.

## 21) Color scheme contract

- Prototype color-scheme switching must mirror the original app scheme set: `default`, `dark`, `light`, `cherry`, `galaxy`, `nature`, `realblack`, `monokai-light`, `monokai-black`, `lite`.
- Color-scheme selection source of truth is the `Display -> Theme -> Color Scheme` control.
- Scheme changes must be applied through CSS custom properties (root token updates), not feature-local hardcoded color swaps.
- Scheme preference is persisted in `sessionStorage` under `moescape.colorScheme` and hydrated on startup.

## 22) Expanded palette contract

- The 9 seed color fields are inputs; runtime must generate full ramps for `primary`, `secondary`, `danger`, `success`, `warning`, and `neutral` (`50..900` steps).
- Generated ramps must be exposed as both `--theme-<family>-<step>` and `--color-<family>-<step>` CSS variables.
- Shell-level tokens (`--ink`, `--ink-soft`, `--accent-strong`, `--ds-text-*`, `--ds-border-*`) must map to generated ramp values, not hardcoded hex literals.
- Feature accents (for example folder gradients and scrim tint) must be token-driven so they adapt when the scheme changes.

## 23) Chat theme + background scope

- Chat runtime theme selection is driven by `DBState.db.theme` and must keep existing runtime keys (`''/classic`, `waifu`, `mobilechat`, `cardboard`, `customHTML`, `waifuMobile`).
- Theme-specific presentation rules belong in shared chat runtime CSS (`styles.css`) and should be scoped via `data-chat-theme` contracts on the chat shell.
- Custom background behavior must continue using existing storage/runtime paths (`DBState.db.customBackground`) instead of introducing parallel prototype-only keys.
- Theme changes must not break shell layout contracts: no horizontal overflow in shell chrome, and no detached message controls.

## 24) Reading mode contract

- Display settings expose exactly two reading modes: `normal` and `focus`.
- `focusPlus` is removed from UI/runtime contracts and is treated as unsupported data.
- Effective reading mode is forced to `normal` when viewport width is below `1024px`.
- Effective reading mode is forced to `normal` for `customHTML` and `waifuMobile` chat themes.
- `focus` mode is supported for `standard` (resolved runtime key: `classic`), `waifu`, `mobilechat`, and `cardboard`.
- In `focus` mode, the chat content uses a centered reading lane: message rows, message body/title/action controls, and composer width all follow the same constrained column.
- Message action controls remain on the message title row and must not drift into a detached right-side column.
