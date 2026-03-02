# Frontend Design Audit PR Plan

Date: 2026-03-01
Scope: Incremental design-system cleanup based on the frontend audit.

## PR1: Token Hygiene + Color Safety (Completed)

Objective:
- Remove hardcoded pure black/white (`#000`, `#fff`, `#ffffff`) from core UI styles.
- Route those values through existing design tokens and `color-mix(...)`.

Planned changes:
- [x] Replace hardcoded pure black/white values in modal/scrim surfaces.
- [x] Replace hardcoded pure black/white values in Prompt Diff UI states.
- [x] Replace hardcoded pure black/white values in text stroke helpers.
- [x] Remove inline hex icon colors in April shell markup.
- [x] Run validation grep to confirm no pure black/white hex remains in `src/styles.css` and `src/App.svelte`.
- [x] Replace remaining color keyword literals (`black`, `white`, `text-white`) in PR1 scope with tokenized equivalents.
- [x] Run `pnpm run check` and `pnpm run check:ui-shell-runtime`.

Acceptance criteria:
- No `#000`, `#fff`, or `#ffffff` remain in `src/styles.css` and `src/App.svelte`.
- Existing dark-theme readability and contrast remain intact.
- No behavior changes; styling-only update.

## PR2: Typography System Upgrade (Completed)

Objective:
- Move away from generic Arial default and improve type hierarchy.

Planned changes:
- [x] Add display/body typography tokens and apply to shell primitives.
- [x] Preserve existing user custom font overrides.
- [x] Replace blanket global `* { font-family: ... }` with semantic typography rules for body, controls, and headings.
- [x] Run `pnpm run check` and `pnpm run check:ui-shell-runtime`.

## PR3: Visual Unification of Shell (Completed)

Objective:
- Align topbar + global launcher treatment with home directory card quality.

Planned changes:
- [x] Harmonize surface depth, borders, accents, and hover/active language.
- [x] Align topbar controls and nav rail items with the character-card gradient/elevation treatment.
- [x] Keep existing component selectors and interaction behavior unchanged.
- [x] Run `pnpm run check` and `pnpm run check:ui-shell-runtime`.

## PR4: Responsive Modernization (Completed)

Objective:
- Introduce container-query behavior for key shell components.

Planned changes:
- [x] Add `container-type` + `container-name` on shell containers (`AppShellV2`, `AppShellStage`, topbar, global rail).
- [x] Add component-scoped `@container` responsive rules for topbar density/search sizing.
- [x] Add component-scoped `@container` responsive rules for global rail density/label behavior.
- [x] Update shell docs/checklist per onboarding requirements.
- [x] Run onboarding-required checks for UI-shell changes.

## PR5: Motion + Accessibility Polish (Completed)

Objective:
- Keep motion expressive but controlled with reduced-motion parity.

Planned changes:
- [x] Normalize easing/duration usage via shared motion/easing tokens.
- [x] Remove noisy transitions (layout-heavy and non-interpolable transition targets).
- [x] Polish home directory focus-visible consistency for keyboard users.
- [x] Preserve reduced-motion parity (`prefers-reduced-motion`) for both CSS transitions and tilt behavior.
- [x] Run onboarding-required checks for this UI slice.
