#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readFile(file) {
  return fs.readFileSync(file, "utf-8");
}

function ensureIncludes(content, file, pattern, failures) {
  if (!content.includes(pattern)) {
    failures.push(`[settings-shell] Missing pattern in ${file}: ${pattern}`);
  }
}

const failures = [];

const settingsShellFile = path.join(ROOT, "src/lib/Setting/Settings.svelte");
const settingsSubTabsFile = path.join(ROOT, "src/lib/Setting/SettingsSubTabs.svelte");
const settingsStylesFile = path.join(ROOT, "src/styles.css");

const shellContent = readFile(settingsShellFile);
const subTabsContent = readFile(settingsSubTabsFile);
const stylesContent = readFile(settingsStylesFile);

// Settings host guardrails
ensureIncludes(
  shellContent,
  settingsShellFile,
  "const allowedSettingsMenus = new Set(",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "function selectMenu(index: number)",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "if ($SettingsMenuIndex === index) {",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "function closeSettingsPanel()",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "settingsOpen.set(false);",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "$SettingsMenuIndex = -1;",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "if (!allowedSettingsMenus.has($SettingsMenuIndex)) {",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "class:ds-settings-nav-shell-force-single-column={isStackedSettings}",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "class:ds-settings-nav-shell-stacked={isStackedSettings}",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "class=\"ds-settings-nav-item\"",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "type=\"button\"",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "title={language.chatBot}",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "aria-label={language.chatBot}",
  failures,
);
ensureIncludes(
  shellContent,
  settingsShellFile,
  "aria-pressed={$SettingsMenuIndex === 1 || $SettingsMenuIndex === 13}",
  failures,
);

// Shared subtab primitive guardrails
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "class=\"ds-settings-tabs seg-tabs\"",
  failures,
);
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "class=\"ds-settings-tab seg-tab\"",
  failures,
);
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "type=\"button\"",
  failures,
);
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "class:active={selectedId === item.id}",
  failures,
);
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "title={item.label}",
  failures,
);
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "aria-label={item.label}",
  failures,
);
ensureIncludes(
  subTabsContent,
  settingsSubTabsFile,
  "onclick={() => onSelect(item.id)}",
  failures,
);

// Settings nav layout guardrails (single item per row, top-to-bottom)
ensureIncludes(
  stylesContent,
  settingsStylesFile,
  ".ds-settings-shell .ds-settings-nav-shell.ds-settings-nav-panel:not(.ds-settings-nav-shell-stacked) {",
  failures,
);
ensureIncludes(
  stylesContent,
  settingsStylesFile,
  "width: var(--ds-settings-nav-width-desktop) !important;",
  failures,
);
ensureIncludes(
  stylesContent,
  settingsStylesFile,
  ".ds-settings-shell .ds-settings-nav-shell-force-single-column.ds-settings-nav-panel {",
  failures,
);
ensureIncludes(
  stylesContent,
  settingsStylesFile,
  "grid-template-columns: minmax(0, 1fr) !important;",
  failures,
);
ensureIncludes(
  stylesContent,
  settingsStylesFile,
  ".ds-settings-shell .ds-settings-nav-shell-force-single-column .ds-settings-nav-item {",
  failures,
);
ensureIncludes(
  stylesContent,
  settingsStylesFile,
  "justify-self: stretch !important;",
  failures,
);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[settings-shell] OK");
