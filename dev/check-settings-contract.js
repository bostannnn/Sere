#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    file: path.join(ROOT, "src/lib/Setting/Settings.svelte"),
    patterns: [
      "selectMenu(1)",
      "selectMenu(2)",
      "selectMenu(3)",
      "selectMenu(16)",
      "selectMenu(17)",
      "{#if $SettingsMenuIndex === 1}",
      "{:else if $SettingsMenuIndex === 2}",
      "{:else if $SettingsMenuIndex === 3}",
      "{:else if $SettingsMenuIndex === 16}",
      "{:else if $SettingsMenuIndex === 17}",
      "title={language.chatBot}",
      "aria-label={language.chatBot}",
      "aria-pressed={$SettingsMenuIndex === 1 || $SettingsMenuIndex === 13}",
      "title={language.comfyCommander}",
      "title={language.logs}",
      "type=\"button\"",
    ],
    forbiddenPatterns: ["ds-settings-panel-close-button", "selectMenu(4)", "title={language.plugin}"],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/BotSettings.svelte"),
    patterns: [
      "<SettingsSubTabs",
      "{ id: 0, label: language.model }",
      "{ id: 1, label: language.parameters }",
      "{ id: 2, label: language.prompt }",
      "{#if submenu === 0 || submenu === -1}",
      "{#if submenu === 1 || submenu === -1}",
      "{#if submenu === 2 || submenu === -1}",
      "class=\"ds-settings-page-title ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-inline-actions ds-settings-inline-actions-fluid action-rail\"",
      "class=\"ds-settings-section ds-settings-card\"",
      "class=\"ds-settings-card ds-settings-card-stack\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/OtherBotSettings.svelte"),
    patterns: [
      "<SettingsSubTabs",
      "{ id: 0, label: language.longTermMemory }",
      "{ id: 1, label: \"TTS\" }",
      "{ id: 2, label: language.emotionImage }",
      "{#if submenu === 0}",
      "{#if submenu === 1}",
      "{#if submenu === 2}",
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-card ds-settings-density-compact\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/DisplaySettings.svelte"),
    patterns: [
      "<SettingsSubTabs",
      "{ id: 0, label: language.theme }",
      "{ id: 1, label: language.sizeAndSpeed }",
      "{ id: 2, label: language.others }",
      "{#if submenu === 0}",
      "{#if submenu === 1}",
      "{#if submenu === 2}",
      "class=\"ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail\"",
      "class=\"ds-settings-card\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/PromptSettings.svelte"),
    patterns: [
      "class=\"ds-settings-card ds-settings-list-shell\"",
      "class=\"ds-settings-section ds-settings-card ds-settings-warning-card ds-settings-card-stack-start\"",
      "className=\"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm\"",
      "class=\"ds-settings-inline-actions ds-settings-inline-actions-nowrap action-rail\"",
      "class=\"ds-settings-inline-actions action-rail\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/OobaSettings.svelte"),
    patterns: [
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-inline-actions ds-settings-inline-actions-fluid action-rail\"",
      "class=\"ds-settings-section ds-settings-card\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/OpenrouterSettings.svelte"),
    patterns: [
      "class=\"ds-settings-inline-actions action-rail\"",
      "className=\"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/Module/ModuleSettings.svelte"),
    patterns: [
      "className=\"control-field\"",
      "className=\"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm\"",
      "class=\"ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail\"",
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-list-container ds-settings-list-shell ds-settings-list-shell-scroll\"",
      "class=\"ds-settings-empty-state empty-state\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/Module/ModuleChatMenu.svelte"),
    patterns: [
      "className=\"control-field\"",
      "className=\"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm",
      "class=\"ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail\"",
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-list-container ds-settings-list-shell\"",
      "class=\"ds-settings-empty-state empty-state\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/Module/ModuleMenu.svelte"),
    patterns: [
      "class=\"ds-settings-empty-state empty-state\"",
      "class=\"ds-settings-inline-actions action-rail\"",
      "className=\"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm\"",
      "class=\"ds-settings-card ds-settings-table-container\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/UI/OpenrouterProviderList.svelte"),
    patterns: [
      "class=\"ds-settings-inline-actions action-rail\"",
      "className=\"ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm ds-settings-shrink-0\"",
      "className=\"ds-settings-provider-trigger\"",
      "className=\"ds-settings-provider-option\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/botpreset.svelte"),
    patterns: [
      "class=\"ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail\"",
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-index-badge control-chip\"",
      "ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm",
      "ds-settings-icon-link icon-btn icon-btn--sm",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/lorepreset.svelte"),
    patterns: [
      "class=\"ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail\"",
      "class=\"ds-settings-inline-actions action-rail\"",
      "ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm",
      "class=\"ds-settings-icon-link icon-btn icon-btn--sm\"",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/listedPersona.svelte"),
    patterns: [
      "class=\"ds-settings-grow-min ds-settings-inline-actions ds-settings-inline-actions-end action-rail\"",
      "ds-settings-icon-action ds-settings-icon-action-compact icon-btn icon-btn--sm",
    ],
  },
  {
    file: path.join(ROOT, "src/lib/Setting/Pages/PersonaSettings.svelte"),
    patterns: [
      "class=\"ds-settings-inline-actions action-rail\"",
      "class=\"ds-settings-inline-actions ds-settings-inline-actions-fluid action-rail\"",
      "class=\"ds-settings-section ds-settings-card ds-settings-wrap-row\"",
      "class=\"ds-settings-section ds-settings-card ds-settings-persona-profile\"",
      "className={\"ds-settings-icon-action ds-settings-persona-tile icon-btn \" + (i === DBState.db.selectedPersona ? \"ds-settings-persona-tile-selected\" : \"\")}",
      "className=\"ds-settings-icon-action ds-settings-persona-user-tile icon-btn\"",
    ],
  },
];

let failed = false;

for (const check of checks) {
  const content = fs.readFileSync(check.file, "utf-8");
  for (const pattern of check.patterns) {
    if (!content.includes(pattern)) {
      failed = true;
      console.error(`[settings-contract] Missing pattern in ${check.file}: ${pattern}`);
    }
  }
  for (const pattern of check.forbiddenPatterns ?? []) {
    if (content.includes(pattern)) {
      failed = true;
      console.error(`[settings-contract] Forbidden pattern present in ${check.file}: ${pattern}`);
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("[settings-contract] OK");
