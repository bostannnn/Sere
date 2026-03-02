# Tokens Normalized V1

Last updated: 2026-02-06  
Status: `ACTIVE TARGET` for primitive rebuild.

## Intent
Normalized tokens replace ad-hoc spacing and control sizing while preserving current theme compatibility.

## Source of Truth
1. `/Users/andrewbostan/Documents/RisuAII/TOKENS_BASELINE.md`
2. `/Users/andrewbostan/Documents/RisuAII/DESIGN_SYSTEM_RULES.md`

## 1) Spacing Scale

Use only these values for component internals and layout gaps.

| Token | Value |
|---|---|
| `--ds-space-1` | `4px` |
| `--ds-space-2` | `8px` |
| `--ds-space-3` | `12px` |
| `--ds-space-4` | `16px` |
| `--ds-space-5` | `24px` |
| `--ds-space-6` | `32px` |

## 2) Radius Scale

| Token | Value |
|---|---|
| `--ds-radius-sm` | `6px` |
| `--ds-radius-md` | `10px` |
| `--ds-radius-lg` | `14px` |
| `--ds-radius-pill` | `999px` |

## 3) Control and Row Heights

| Token | Value | Usage |
|---|---|---|
| `--ds-height-control-sm` | `36px` | Compact input/button |
| `--ds-height-control-md` | `44px` | Default button/tab/input |
| `--ds-height-list-row` | `52px` | Chat list row |
| `--ds-icon-action-size` | `28px` | Row action hit target |
| `--ds-icon-size` | `18px` | Icon glyph size |

## 4) Typography Roles

| Token | Value |
|---|---|
| `--ds-font-size-xs` | `12px` |
| `--ds-font-size-sm` | `14px` |
| `--ds-font-size-md` | `16px` |
| `--ds-font-weight-regular` | `400` |
| `--ds-font-weight-medium` | `500` |
| `--ds-font-weight-semibold` | `600` |

## 5) Semantic Color Roles (Mapped to Existing Theme)

| Token | Maps to |
|---|---|
| `--ds-surface-1` | `var(--risu-theme-bgcolor)` |
| `--ds-surface-2` | `var(--risu-theme-darkbg)` |
| `--ds-surface-3` | `var(--risu-theme-darkbutton)` |
| `--ds-surface-active` | `var(--risu-theme-selected)` |
| `--ds-border-subtle` | `var(--risu-theme-darkborderc)` |
| `--ds-border-strong` | `var(--risu-theme-borderc)` |
| `--ds-text-primary` | `var(--risu-theme-textcolor)` |
| `--ds-text-secondary` | `var(--risu-theme-textcolor2)` |
| `--ds-text-danger` | `var(--risu-theme-draculared)` |

## 6) Motion Tokens

| Token | Value |
|---|---|
| `--ds-motion-fast` | `150ms` |
| `--ds-motion-base` | `200ms` |
| `--ds-motion-slow` | `300ms` |
| `--ds-ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` |

## 7) Settings Tokens (Phase 1)

| Token | Value | Usage |
|---|---|---|
| `--ds-settings-tab-height` | `var(--ds-height-control-md)` | Settings top tab bars |
| `--ds-settings-tab-min-width` | `120px` | Prevent tab label clipping |
| `--ds-settings-tab-padding-x` | `var(--ds-space-3)` | Horizontal tab label padding |
| `--ds-settings-section-gap` | `var(--ds-space-4)` | Standard section spacing |
| `--ds-settings-panel-padding` | `var(--ds-space-4)` | Settings panel padding |
| `--ds-settings-label-gap` | `var(--ds-space-2)` | Label-to-control spacing |

## 8) Immediate Rules
1. New component work must use these normalized tokens.
2. Existing screens being touched should be migrated opportunistically.
3. No additional size/spacing scale values without doc update.
