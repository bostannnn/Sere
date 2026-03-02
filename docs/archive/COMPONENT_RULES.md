# Component Rules V1

Last updated: 2026-02-10

## Scope
These rules are mandatory for primitives and migrated screens.

## 1) Tabs
1. All tabs in the same group must have equal height.
2. Use center alignment for labels and consistent horizontal padding.
3. Active state must only change semantic tokens (surface/text/border), not layout.

## 2) List Rows
1. Row height must be stable (`--ds-height-list-row`) unless content requires multiline mode.
2. Left content area and right action area must be separately aligned.
3. Actions must be in a fixed-width right rail.
4. No row-specific margin hacks (`mt/ml` offsets) for visual centering.

## 3) Action Rail
1. Every action icon uses same hit size (`--ds-icon-action-size`).
2. Icon glyphs use same size (`--ds-icon-size`) unless explicit exception.
3. Hover/focus states may change color/background only.

## 4) Buttons/Inputs
1. Use control height tokens (`--ds-height-control-sm|md`).
2. Border radius comes from normalized radius tokens only.
3. Focus ring style must be consistent across components.
4. `SelectInput` uses explicit tokenized control heights (not `min-height + py`) to avoid Safari/WebKit text clipping.
5. `OptionInput` must not use extra vertical padding classes; keep native option metrics stable.

## 5) Panel Structure
1. Panel header, content, footer spacing must use spacing tokens only.
2. Borders and separators must use semantic border tokens only.
3. Panel scroll behavior is defined at content container only.

## 6) Text Alignment
1. Component text alignment must be intentional and explicit (`left` or `center` by component role).
2. Mixed alignment in a component block is disallowed unless specified in design.

## 7) Check Alignment
1. Check controls are left-aligned by default.
2. This applies to checkbox/toggle rows and check-style action rows in settings.
3. Centered check alignment requires an explicit documented exception in `UI_BASELINE_MATRIX.md`.

## 8) Prohibited Patterns
1. New hardcoded pixel values when an equivalent token exists.
2. One-off utility combinations used once and never reused.
3. Duplicated action-button styles across files.

## 9) Navbar Icon Alignment
1. Navbar icon slots must center icon glyphs on both axes.
2. Do not offset navbar icon slots with one-sided margin hacks (`ml`, `mr`, `margin-inline-start`) for visual placement.
3. If a navbar includes text and icon segments, the icon segment must use the same centering contract as text segments (centered content, not edge-pushed content).
4. Mixed text/icon navbar rows must define explicit slot widths (for example, equal grid columns) so centering is structural, not incidental.

## 10) Mobile Navbar Height and Overflow
1. Mobile header/top-switcher/footer navigation bars must use explicit tokenized heights (not growth-prone `min-height + large padding` combinations).
2. Mobile navbar shells must use `box-sizing: border-box` so borders/padding do not change visual bar height across tabs.
3. Mobile navbar tracks should center when content fits and remain horizontally scrollable when content overflows.
4. Breakpoint overrides that force left alignment for centered nav tracks are disallowed unless documented as an exception in `UI_BASELINE_MATRIX.md`.
