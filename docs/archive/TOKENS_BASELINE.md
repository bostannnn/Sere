# Tokens Baseline (Current UI Contract)

Last updated: 2026-02-06  
Status: `LOCKED BASELINE` for design-system reset phase 1.

## Purpose
This file freezes the current token contract so component rewrites can happen without inventing new visual values.

Use with:
1. `DESIGN_SYSTEM_RULES.md`
2. `ui_rewrite_plan.md`
3. `plan.md`

## Source Files (authoritative)
1. `/Users/andrewbostan/Documents/RisuAII/src/styles.css`
2. `/Users/andrewbostan/Documents/RisuAII/src/ts/gui/colorscheme.ts`
3. `/Users/andrewbostan/Documents/RisuAII/src/ts/storage/database.svelte.ts`
4. `/Users/andrewbostan/Documents/RisuAII/src/ts/gui/guisize.ts`
5. `/Users/andrewbostan/Documents/RisuAII/src/ts/gui/animation.ts`
6. `/Users/andrewbostan/Documents/RisuAII/src/lib/SideBars/BarIcon.svelte`

## 1) Color Tokens

### 1.1 Semantic theme roles (required in UI code)
Defined in `/Users/andrewbostan/Documents/RisuAII/src/styles.css` and set at runtime in `/Users/andrewbostan/Documents/RisuAII/src/ts/gui/colorscheme.ts`.

- `--risu-theme-bgcolor`
- `--risu-theme-darkbg`
- `--risu-theme-borderc`
- `--risu-theme-selected`
- `--risu-theme-draculared`
- `--risu-theme-textcolor`
- `--risu-theme-textcolor2`
- `--risu-theme-darkborderc`
- `--risu-theme-darkbutton`

Default scheme values (baseline):
- `bgcolor`: `#282a36`
- `darkbg`: `#21222c`
- `borderc`: `#6272a4`
- `selected`: `#44475a`
- `draculared`: `#ff5555`
- `textcolor`: `#f8f8f2`
- `textcolor2`: `#64748b`
- `darkBorderc`: `#4b5563`
- `darkbutton`: `#374151`

### 1.2 Palette scales
Also exposed via CSS variables:
- Primary `50..900`
- Secondary `50..900`
- Neutral `50..900`
- Danger `50..900`
- Success `50..900`

Rule: new component colors should use semantic roles first; palette tokens are secondary.

## 2) Typography Tokens

### 2.1 Font family
- `--risu-font-family` baseline: `Arial, sans-serif`
- Alternate built-in option: `Times New Roman, serif`
- Custom font set via DB (`font: custom`, `customFont`)

### 2.2 Text color roles
- `--FontColorStandard`
- `--FontColorBold`
- `--FontColorItalic`
- `--FontColorItalicBold`
- `--FontColorQuote1`
- `--FontColorQuote2`

### 2.3 Line height
- DB default: `lineHeight = 1.25`

### 2.4 Allowed text-size utilities (baseline usage set)
Observed usage includes:
- `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-4xl`, `text-6xl`

Rule: do not introduce new size utilities during primitive migration unless documented.

## 3) Spacing Tokens

Baseline utility usage is concentrated on this set:
- `0`, `1`, `2`, `3`, `4`, `5`, `6`, `8`, `9`, `10`, `12`, `14`

Canonical rem mapping (Tailwind scale baseline):
- `0`=`0rem`
- `1`=`0.25rem`
- `2`=`0.5rem`
- `3`=`0.75rem`
- `4`=`1rem`
- `5`=`1.25rem`
- `6`=`1.5rem`
- `8`=`2rem`
- `9`=`2.25rem`
- `10`=`2.5rem`
- `12`=`3rem`
- `14`=`3.5rem`

Rule: new spacing values outside this set require token-spec update first.

## 4) Radius Tokens

Baseline radius utilities used:
- `rounded-xs`
- `rounded-sm`
- `rounded`
- `rounded-md`
- `rounded-lg`
- `rounded-xl`
- `rounded-full`
- directional: `rounded-t`, `rounded-r`, `rounded-b`, `rounded-l`, `rounded-tl`, `rounded-tr`, `rounded-bl`, `rounded-br`

Rule: primitives must map to one of these existing radius roles in phase 1.

## 5) Elevation Tokens

Baseline elevation utilities used:
- `shadow-2xs`
- `shadow-xs`
- `shadow`
- `shadow-md`
- `shadow-lg`
- `shadow-xl`

Rule: prefer `shadow-xs`/`shadow`/`shadow-lg` for primitive defaults; avoid adding new custom shadows in phase 1.

## 6) Motion Tokens

### 6.1 Global animation speed
- CSS root fallback: `--risu-animation-speed: 0.2s`
- DB default applied at bootstrap: `animationSpeed = 0.4` (seconds)
- Runtime setter: `updateAnimationSpeed()`

### 6.2 Transition durations in active usage
- `duration-200`
- `duration-300`
- custom local usage: `150ms` in `BarIcon.svelte`

Rule:
1. Prefer token-driven/global timing where possible.
2. No new arbitrary durations until motion token table is expanded.

## 7) Layout Sizing Tokens

Existing layout-related globals:
- `--sidebar-size = (24 + 4 * sideBarSize)rem`
- `textAreaSize`, `sideBarSize`, `textAreaTextSize` defaults: `0`

Rule: pane widths/heights in rewrite should derive from layout tokens and responsive breakpoints, not ad-hoc fixed values.

## 8) Primitive Baseline Mapping (for phase 2)

Use existing baseline style as seed:
- Button seed: `.x-risu-button-default` in `/Users/andrewbostan/Documents/RisuAII/src/styles.css`
- Inputs seed: `TextInput.svelte`, `TextAreaInput.svelte`, `SelectInput.svelte`, `NumberInput.svelte`
- Tab/Panel/ListRow/MessageBubble: map to existing chat/side panel classes before visual redesign.

## 9) Change Procedure

Any token change must include:
1. Entry update in this file.
2. Link/update in `ui_rewrite_plan.md`.
3. Brief rationale in `plan.md` (if behavior or style meaning changed).
