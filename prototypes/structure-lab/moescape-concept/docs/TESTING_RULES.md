# Testing Rules

Last updated: 2026-02-19

---

## 1. General App Tests

Run from repo root before every commit:

```bash
pnpm check    # TypeScript / Svelte type check — must show 0 errors
pnpm test     # Vitest unit test suite — must show all tests passing
```

Both must pass. No exceptions. See `CONVENTIONS.md` section VI for merge requirements.

---

## 2. Prototype Checks (`pnpm run check:prototype`)

Run after every non-trivial change to the moescape concept prototype:

```bash
pnpm run check:prototype
```

This is a composite command that runs three checks in sequence:

```
node --check prototypes/structure-lab/moescape-concept/app.js
pnpm run check:prototype:classes
pnpm run check:prototype:design
```

### Check 1: Syntax (`node --check`)

Validates that `app.js` parses as valid JavaScript. Fails immediately on any syntax error.

### Check 2: Template Classes (`check:prototype:classes`)

**Script:** `prototypes/structure-lab/moescape-concept/dev/check-template-classes.js`

Scans all `class="..."` attributes in `index.html` and `app.js` templates, extracts every class name used, and verifies each one is defined in `styles.css`.

**Fails when:** Any class name used in a template has no matching selector in `styles.css`.

**What to do when it fails:** Either define the missing class in `styles.css`, or remove it from the template. No ghost class dependencies.

### Check 3: Design Rules (`check:prototype:design`)

**Script:** `prototypes/structure-lab/moescape-concept/dev/check-design-rules.js`

Enforces ~70 named design contract rules across 11 categories. Rules are checked via regex and AST-lite pattern matching against `index.html`, `app.js`, `styles.css`, and `shared/base.css`.

#### Rule categories and what each enforces

**Focus / Accessibility**
- Required `focus-visible` selectors exist for `.chrome-btn`, `.ds-settings-nav-item`, `.seg-tab`, `.ds-settings-control`, `.side-row`
- `outline: none` is forbidden everywhere in `styles.css`
- All icon-only `<button>` elements must have `aria-label` or `aria-labelledby`
- Global drawer close button must use `aria-label="Close global sidebar"`
- Topbar sidebar button must use `aria-label="Open workspace sidebar"` and text `"Sidebar +"`
- Tab widgets must use roving tabindex (`tabindex="0"` for active, `"-1"` for inactive)
- Tab widgets must support ArrowRight / ArrowLeft / Home / End keyboard navigation
- Escape key must close all open drawers

**Ghost Dependencies**
- `.small-muted` and `.card` must be defined locally in `styles.css` (not assumed from external)

**Composer Contract**
- `composerInput` must be a `<textarea>`, not an `<input>`
- Keydown handler must implement Enter-to-send + Shift+Enter-for-newline
- Keydown handler must guard IME composition events (`event.isComposing || event.keyCode === 229`)

**Sidebar Profile Block**
- `sidebarProfileBlock`, `sidebarProfileAvatar`, `sidebarProfileName`, `sidebarProfileArchetype`, `sidebarProfileChat` must all exist as IDs in markup
- `renderSidebarProfile()` function must exist and be called

**Layout Invariants**
- No `style.display =` assignments anywhere in `app.js` — use `.hidden` class toggles only
- No inline `style="... display: ..."` attributes in `index.html` or JS templates
- `enterHomeView()`, `enterChatView()`, `enterLibraryView()`, `enterPlaygroundView()`, `enterSettingsView()` must each be the only place that shows/hides the 5 top-level views
- Exactly 25 top-level hidden add/remove operations are expected (5 views × 5 `enterXView` functions) — any more or fewer means view toggle logic has leaked out

**Rendering Boundaries**
- `innerHTML =` assignment is only permitted on `template` — all other targets are forbidden
- `htmlToFragment()` must only be called from inside `replaceMarkup()` — exactly 2 references
- Character grid click events must use stable-root delegation on `characterGrid`, not per-row listeners

**Layer Tokens**
- Required surface depth tokens must exist in `styles.css`: `--surface-topbar`, `--surface`, `--surface-raised`, `--surface-overlay`, `--surface-recessed`
- Topbar background must use `var(--surface-topbar)`, drawer background must use `var(--surface-overlay)`
- Chat bubbles must use `var(--chat-assistant-bg)` and `var(--chat-user-bg)`
- All 7 layer/chat tokens must also be defined in `shared/base.css` as fallbacks
- `shared/base.css` `.item-btn.active` must use accent edge treatment (`inset 0 -2px 0 var(--accent)`)

**Active-State Contract**
- `styles.css` `.item-btn.active` must use `inset 0 -2px 0 var(--accent-strong)` (tab-pattern)
- `.seg-tab.active` / `.seg-tab.is-active` must use accent edge treatment
- Sidebar group buttons, mode buttons, settings tabs must all compose from `.seg-tab`
- Scripts trigger mode buttons must use `.active` class on `.seg-tab`, not a custom class
- Settings nav (`.ds-settings-nav-item.is-active`) must use list-pattern fill (`--ds-surface-active`) — no accent edge
- Key chips (`.ds-settings-key-chip.active`) and RAG system rows (`.rag-system-row.is-active`) must use list-pattern fill — no accent edge

**Label Policy**
- Known raw storage key names (`emotionWarn`, `globalLoreInfo`, `triggerV1Warning`, etc.) must not appear as rendered text content in templates
- `settingLabel()` overrides must include human-readable strings for `emotionWarn`, `triggerV1Warning`, `helpBlock`, `gameStateEditor`
- Raw model/engine keys (`openai3small`, `openai3large`, `whisperLocal`) must not appear as rendered option labels

**Primitive Contracts**
- All `<input>`, `<select>`, `<textarea>` elements (except button/checkbox/color/file/hidden/image/radio/range/reset/submit types) must include `control-field` class
- `.control-field:is(input, select)` must use `height: var(--ds-height-control-md)` — unified control height
- `panel-shell`, `control-field`, `control-chip`, `drawer-elevation--left`, `drawer-elevation--right` must be defined in `styles.css`
- All 9 primitive fallback classes (`panel-shell`, `control-field`, `control-chip`, `icon-btn`, `seg-tabs`, `seg-tab`, `list-shell`, `empty-state`, `action-rail`) must be defined in `shared/base.css`
- ~40 feature class / primitive composition pairs are checked — e.g. every `side-action-btn` must co-occur with `icon-btn`, every `ds-settings-tab` with `seg-tab`, every `ds-settings-card` with `panel-shell`, etc.
- Chat and playground root surfaces must include `panel-shell`
- Drawers must include `drawer-elevation--left` / `drawer-elevation--right` modifier classes

**Token Contracts**
- `--ds-radius-xl` and `--avatar-placeholder-bg` must exist in `styles.css`
- Major shell containers (`.playground-frame`, `.home-header`, `.character-card`, `.chat-core`) must use tokenized radii (`--ds-radius-lg` / `--ds-radius-xl`)
- Core controls (`.chrome-btn`, `.control-field`, `.playground-tool-card`, `.playground-panel`) must use tokenized radii
- Avatar placeholder surfaces (`.character-avatar`, `.sidebar-profile-avatar`, `.sidebar-portrait-tile`, `.sidebar-thumb`, `.char-config-icon-tile`) must use `--avatar-placeholder-bg`
- Portrait tile active state must use outer ring (`box-shadow: 0 0 0 2px var(--accent-strong)`)
- Sidebar table header must use `--ds-surface-3` / `--ds-text-secondary`
- Char-config icon action hover states must use `--ds-text-danger`, `--ds-text-success`, `--ds-accent-strong`
- `body` font stack must be identical in both `shared/base.css` and `styles.css`
- `--topbar-h: 66px` must be defined exactly once; `66px` raw value must not appear elsewhere in CSS
- `--topbar-h` must be used in grid row, view height, chat-core height, and playground-frame height calculations
- Z-index tokens must exist: `--z-view`, `--z-scrim`, `--z-topbar`, `--z-drawer`, `--z-overlay`, `--z-toast`
- Topbar, drawer, scrim, and view shells must use z-index tokens

**Shell / Navigation Contracts**
- Home must use single topbar search (`id="shellSearchInput"`) — no `home-header` element
- Shared shell search config (`SHELL_SEARCH_CONFIG`, `setShellSearchMode()`) must exist; `enterXView` functions must call it correctly
- Sidebar mode switch must not use `.seg-tabs`; only tab strip uses `.seg-tabs`
- Sidebar mode switch grid must use `repeat(auto-fit, minmax(0, 1fr))`
- Global drawer nav buttons must declare `data-workspace-view` targets for `characters`, `library`, `playground`, `settings`
- Global drawer click handler must route via `dataset.workspaceView` — no text/order-based routing
- Drawer header asymmetry must be preserved (global: `drawer-head-left` / `drawer-close-left`; context: `drawer-head-right` / `drawer-close-right`)

**State Sync**
- `sendMessage()` must call `renderChatRuntime()`, `renderSidebarContent()`, `renderGlobalRecentChats()`, and `renderCharacterGrid()` after updating chat state

**Color Schemes**
- All 10 original app color scheme keys must be defined in `COLOR_SCHEMES` (`default`, `dark`, `light`, `cherry`, `galaxy`, `nature`, `realblack`, `monokai-light`, `monokai-black`, `lite`)
- Display settings must bind Color Scheme select to `COLOR_SCHEME_OPTIONS` + `data-setting-color-scheme`
- Settings change handler must call `applyColorScheme(value)` on `data-setting-color-scheme` change
- Color scheme preference must persist to and hydrate from `sessionStorage` under `moescape.colorScheme`
- `applyColorScheme()` must generate full ramps (`buildRamp`, `applyRampTokens`) for all 6 families
- `styles.css` must declare `--theme-<family>-<step>` for all 6 families × 10 steps
- Shell semantic tokens (`--ink`, `--ink-soft`, `--accent-strong`, `--ds-text-danger`, etc.) must be mapped from generated ramps
- Folder gradients and scrim must be token-driven (`--folder-blue-gradient`, `--folder-purple-gradient`, `--scrim-bg`) and updated by `applyColorScheme()`

**Prototype Scope**
- Chat theme/background runtime wiring must NOT exist in the prototype (`CHAT_THEME_OPTIONS`, `applyChatTheme`, `--chat-custom-bg`, etc.) — deferred to production migration

**Glass / Visual**
- Topbar, `.panel-shell`/`.card`, drawers, and scrim must define both `backdrop-filter` and `-webkit-backdrop-filter`

**Responsive**
- At `max-width: 980px`: `.rag-dashboard-body` and `.ds-settings-shell-inner` must switch to `flex-direction: column`

**CSS Hygiene**
- Dead legacy classes `.sidebar-subtabs` and `.sidebar-subtab` must not exist in `styles.css`

**Settings Layout**
- Persona profile must use `ds-settings-persona-profile` + `ds-settings-persona-avatar-col` two-column layout
- Persona add action must be a tile-level sibling (`ds-settings-persona-add-tile`), not nested in inline-actions
- Chat Bot page header must use `ds-settings-page-title-row` — heading must not be a flex wrapper
- `.ds-settings-note-danger` must use `var(--ds-text-danger)`
- Topbar search must use `flex: 0 1 clamp(...)`, `margin-inline: auto`, and `height: var(--chrome-btn-h)`

---

#### When a rule fails after a safe refactor

Some rules use regex sequence matching on `app.js` and are sensitive to statement ordering. If a rule fails after a refactor that doesn't change behavior:

1. Keep the behavior correct and update the checker pattern in the same change, **or**
2. Replace the sequence regex with a targeted invariant check.

Do not skip failing checks. Do not reorder code solely to satisfy a regex without verifying the behavior contract still holds.

---

## 3. Manual Smoke Pass (required when UI changed)

After all command checks pass, open the prototype in a browser and verify:

1. Home → Chat → Library → Settings navigation flows work end-to-end
2. Both drawers open, close, and toggle idempotently
3. Opening one drawer closes the other
4. Keyboard focus is visible on all major interactive controls
5. Responsive behavior holds at ~600px, 768px, 980px viewport widths
6. Visual layer hierarchy: topbar lighter than drawers, overlays stronger than panels, active states distinct

Use `docs/UI_CHANGE_CHECKLIST.md` as the pass/fail criteria for each step.
