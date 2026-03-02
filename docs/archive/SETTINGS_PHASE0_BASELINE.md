# Settings Phase 0 Baseline (Freeze + Inventory)

Last updated: 2026-02-06  
Status: `COMPLETE (code audit + compile baseline)` / `PARTIAL (manual screenshot capture pending)`

## 1) Compile Baseline

Command run:
- `pnpm check`

Result:
- `0` errors
- `2` existing a11y warnings (non-settings files):
  - `/Users/andrewbostan/Documents/RisuAII/src/lib/UI/GUI/SliderInput.svelte`
  - `/Users/andrewbostan/Documents/RisuAII/src/lib/Others/HypaV3Modal.svelte`

This confirms settings currently compile.

## 2) Settings Shell Inventory

Primary shell:
- `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Settings.svelte`

Shell behavior observed:
1. Left nav is driven by `SettingsMenuIndex`.
2. Right content area is keyed by `SettingsMenuIndex` and mounts page components via `{#key}`.
3. Mobile/desktop branching is controlled by viewport width and `MobileGUI`.

## 3) Settings Pages Inventory

Settings pages detected under `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages` include:
- `BotSettings.svelte`
- `OtherBotSettings.svelte`
- `DisplaySettings.svelte`
- `LanguageSettings.svelte`
- `AccessibilitySettings.svelte`
- `Module/ModuleSettings.svelte`
- `AdvancedSettings.svelte`
- plus supporting settings pages/components.

## 4) Local Tab / Submenu Patterns (Key Risk Surface)

Pages using local `submenu` tab state:
1. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/BotSettings.svelte`
2. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/OtherBotSettings.svelte`
3. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/DisplaySettings.svelte`
4. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/Module/ModuleMenu.svelte`

Legacy sentinel pattern still present:
1. `submenu !== -1` and `submenu === -1` branches in:
   - `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/BotSettings.svelte`
   - `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/OtherBotSettings.svelte`

Note:
- `submenu` is currently initialized to `0`, so `-1` branches are effectively dead/legacy paths and should be removed in migration phases.

## 5) Accordion Usage Inventory (Stability + Visual Consistency Risk)

`Accordion` is used across multiple settings pages, including:
1. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/BotSettings.svelte`
2. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/OtherBotSettings.svelte`
3. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/PromptSettings.svelte`
4. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/OpenrouterSettings.svelte`
5. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/OobaSettings.svelte`
6. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/Pages/Advanced/*`
7. `/Users/andrewbostan/Documents/RisuAII/src/lib/Setting/SettingRenderer.svelte`

This confirms settings currently mix:
1. local tab bars
2. accordion sections
3. page-specific custom wrappers

That is the main reason regressions are easy to introduce.

## 6) Removed/Deprecated Flags Audit (Settings UI)

Scan target:
- `useLegacyGUI`
- `betaMobileGUI`

Result:
- No active references detected in `src/` at this baseline snapshot.

Legacy-adjacent pattern still present:
- `submenu === -1` logic (see section 4), which should be removed as part of phase migration.

## 7) Freeze Artifacts Checklist

Completed:
1. Compile baseline recorded.
2. Shell/page/state inventory recorded.
3. Legacy/dead-pattern audit recorded.

Pending manual capture:
1. Baseline screenshots for:
   - Chat Bot settings
   - Other Bots settings
   - Display & Audio settings
   - Language settings

## 8) Immediate Next Step

Proceed to `SETTINGS_REFACTOR_PLAN.md` Phase 1 (token contract for settings surfaces), then Phase 2 (primitive hardening), before touching page logic again.
