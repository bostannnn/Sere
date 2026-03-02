# UI Rewrite Plan (Server-First Product)

## Baseline Gate (Blocking)
1. No net-new UI feature work before UI baseline is complete.
2. "UI baseline complete" means both settings and non-settings surfaces are standardized:
   - shared tokens are used (no ad-hoc values where token exists),
   - shared primitives are used (no page-level one-off control styling),
   - desktop + mobile behavior is validated,
   - smoke checks pass in `pnpm dev` and `pnpm run runserver` (after `pnpm build`).
3. Settings stabilization (`SETTINGS_REFACTOR_PLAN.md`) is one track inside this baseline, not the full baseline.
4. Progress tracking is mandatory in `UI_BASELINE_MATRIX.md`.
5. Every UI slice must update `UI_BASELINE_MATRIX.md` status rows for touched surfaces.

## Why Rewrite
- Current UI is functional but visually flat and inconsistent across desktop/mobile.
- Navigation state is fragile on mobile and can produce dead-end screens.
- Product direction is server-first; UI should prioritize fast chat flow, context visibility, and reliability.
- Governance for this rewrite is defined in `DESIGN_SYSTEM_RULES.md`.
- Baseline token contract is defined in `TOKENS_BASELINE.md`.
- Normalized target token set is `TOKENS_NORMALIZED_V1.md`.
- Primitive and layout constraints are in `COMPONENT_RULES.md`.

## Product Goals
1. Make chat the primary surface.
2. Keep context visible without modal hopping.
3. Unify desktop and mobile information architecture.
4. Preserve existing theme engine compatibility.
5. Remove legacy/unused surfaces during rewrite.

## Target IA

### Desktop (primary)
1. Far-left strip: global navigation and quick character switch.
2. Main center pane: chat timeline + composer.
3. Right pane (collapsible): chat list and character panel as tabs.

### Home (no character selected)
1. Keep far-left strip visible.
2. Replace onboarding feed with product-meaningful landing (or direct character list).
3. No empty secondary sidebars.

### Mobile
1. Bottom nav as top-level IA (`Realm`, `Character`, `Settings`).
2. In-chat panel switching must be explicit and state-safe (no hidden overlapping panes).
3. No gesture path should require stale state assumptions.

## Visual Directions

### Direction 1: Structured 3-Pane Productivity
- Dense but readable.
- Emphasis on hierarchy, compact controls, and fast switching.
- Best fit for heavy daily use.

### Direction 2: Minimal Focus Chat
- Fewer visible controls, low-noise interface.
- Context panes hidden by default.
- Best fit for roleplay immersion.

### Direction 3: Editorial/Cinematic
- Strong typography and richer visual rhythm.
- More expressive cards, spacing, and background treatment.
- Best fit if the product should feel premium and distinct.

## Example References (Requested: #1 and #3)

### Examples for Direction 1 (Structured 3-pane)
1. Telegram Desktop (split panes and chat-first flow): [telegram.org](https://telegram.org/apps)
2. Discord desktop IA and channel/context separation: [discord.com/app](https://discord.com/app)
3. Intercom inbox (multi-pane support tooling): [intercom.com](https://www.intercom.com/help/en/articles/1200970-use-the-inbox)
4. Dribbble: desktop chat dashboard references: [dribbble.com/tags/chat-dashboard](https://dribbble.com/tags/chat-dashboard)

### Examples for Direction 3 (Editorial/Cinematic)
1. Dribbble: glassmorphism desktop app concepts: [dribbble.com/tags/glassmorphism-app](https://dribbble.com/tags/glassmorphism-app)
2. Dribbble: chat app visual explorations: [dribbble.com/tags/chat-app](https://dribbble.com/tags/chat-app)
3. Behance: messaging app UI case studies: [behance.net/search/projects?search=messaging%20app%20ui](https://www.behance.net/search/projects?search=messaging%20app%20ui)
4. Apple HIG (visual hierarchy, spacing, navigation): [developer.apple.com/design/human-interface-guidelines](https://developer.apple.com/design/human-interface-guidelines/)

## Rewrite Scope

### In Scope
1. Desktop pane architecture and panel behavior.
2. Mobile navigation and state transitions.
3. Home/landing replacement (remove empty onboarding shell).
4. Component-level visual system refresh (layout, spacing, typography, cards, controls).

### Out of Scope (for first rewrite pass)
1. Full feature redesign of memory/models/plugins.
2. Provider/network pipeline changes.
3. New data model migrations.

## Execution Phases
1. Stabilization:
   - Fix mobile runtime errors and broken transitions first.
   - Add guardrails for pane state.
   - Settings stabilization and anti-regression sequencing: `SETTINGS_REFACTOR_PLAN.md`.
2. Design System Reset (recommended starting point):
   - Define token layers first: spacing, radius, elevation, color roles, type scale, motion durations.
   - Rebuild core primitives: `Button`, `Input`, `Tab`, `Panel`, `ListRow`, `MessageBubble`.
   - Rebuild screens in order: `Chat`, `Character`, `Settings`, `Mobile Nav`.
   - For Settings, enforce:
     - behavior freeze contract: `SETTINGS_BEHAVIOR_CONTRACT.md`
     - per-slice smoke checks: `SETTINGS_SMOKE_CHECKLIST.md`
3. Full baseline standardization (all UI surfaces):
   - Settings pages (all): align to shared token/primitive contracts.
   - Chat surfaces: timeline, composer, chat list rows, character panel, side panels.
   - Navigation surfaces: left strip, top bars, mobile bottom nav, in-chat panel switches.
   - Overlay surfaces: modals, dropdowns/selects, menus, toasts, tooltips.
   - Utility surfaces: playground-visible controls that remain in product scope.
4. IA consolidation:
   - Desktop 3-pane normalization.
   - Mobile nav parity with desktop information architecture.
5. Visual pass:
   - Apply one chosen visual direction.
   - Theme compatibility validation.
6. Cleanup:
   - Remove legacy onboarding and obsolete layout code paths.

## Post-Baseline Consolidation (After Gate Closure)
1. Consolidate thin wrapper components and duplicate one-off UI files into shared surfaces where behavior is equivalent.
2. Remove duplicate style islands and route styling to shared token/primitive contracts.
3. Keep behavior frozen during consolidation (no UX or feature changes).
4. Run regression smoke after each consolidation batch (desktop + mobile, dev + runserver).
5. Track consolidation batches separately from baseline slices to avoid mixing stability work and structural reduction.

## Baseline Acceptance (Global)
1. Settings and non-settings controls use one consistent control sizing model.
2. No duplicate tab/select/button paradigms remain unless explicitly documented exception.
3. No screen shows mixed legacy/new control styles in the same interaction path.
4. UI smoke checks pass on desktop and mobile in dev + server mode.

## Validation Checklist
1. Desktop: no empty sidebars in home or chat.
2. Desktop: right pane switches between chats/character reliably.
3. Mobile: no runtime error when tapping current tab repeatedly.
4. Mobile: no dead-end navigation state.
5. Server mode and dev mode both render consistent pane behavior.
