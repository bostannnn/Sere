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
    failures.push(`[charconfig-rulebook-contract] Missing pattern in ${file}: ${pattern}`);
  }
}

const failures = [];

const charConfigFile = path.join(ROOT, "src/lib/SideBars/CharConfig.svelte");
const lorebookFile = path.join(ROOT, "src/lib/SideBars/LoreBook/LoreBookSetting.svelte");
const lorebookDataFile = path.join(ROOT, "src/lib/SideBars/LoreBook/LoreBookData.svelte");
const lorebookListFile = path.join(ROOT, "src/lib/SideBars/LoreBook/LoreBookList.svelte");
const rulebookRagSettingFile = path.join(ROOT, "src/lib/SideBars/LoreBook/RulebookRagSetting.svelte");

const charConfigContent = readFile(charConfigFile);
const lorebookContent = readFile(lorebookFile);
const lorebookDataContent = readFile(lorebookDataFile);
const lorebookListContent = readFile(lorebookListFile);
const rulebookRagSettingContent = readFile(rulebookRagSettingFile);

ensureIncludes(charConfigContent, charConfigFile, "import { tick, untrack } from 'svelte';", failures);
ensureIncludes(charConfigContent, charConfigFile, "import RulebookRagSetting from \"./LoreBook/RulebookRagSetting.svelte\";", failures);
ensureIncludes(charConfigContent, charConfigFile, "<LoreBook includeRulebookTab={false} />", failures);
ensureIncludes(charConfigContent, charConfigFile, "DBState.db.characters[$selectedCharID]!.type === 'character'", failures);
ensureIncludes(charConfigContent, charConfigFile, "<RulebookRagSetting />", failures);
ensureIncludes(charConfigContent, charConfigFile, "const charConfigTabsForCharacter: CharConfigTabId[] = [0, 1, 3, 8, 5, 4, 2, 7, 6]", failures);
ensureIncludes(charConfigContent, charConfigFile, "const charConfigTabsForGroup: CharConfigTabId[] = [0, 1, 3, 2, 7]", failures);
ensureIncludes(charConfigContent, charConfigFile, "const handleCharConfigTabKeydown = async (event: KeyboardEvent, currentTab: CharConfigTabId = $CharConfigSubMenu as CharConfigTabId) => {", failures);
ensureIncludes(charConfigContent, charConfigFile, "if (event.key === \"Home\") {", failures);
ensureIncludes(charConfigContent, charConfigFile, "if (event.key === \"End\") {", failures);
ensureIncludes(charConfigContent, charConfigFile, "role=\"tablist\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "role=\"tab\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "role=\"tabpanel\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-empty empty-state\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-tabs seg-tabs\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-tab seg-tab\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-subtabs seg-tabs\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-subtab seg-tab\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-pressed={viewSubMenu === 0}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-pressed={viewSubMenu === 1}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-pressed={viewSubMenu === 2}", failures);
ensureIncludes(charConfigContent, charConfigFile, "title={DBState.db.characters[$selectedCharID]!.type !== 'group' ? language.charIcon : language.groupIcon}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label={language.viewScreen}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label={language.additionalAssets}", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-card panel-shell\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-icon-gallery panel-shell\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-group-grid char-config-group-layout panel-shell\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-script-actions action-rail\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-emotion-actions action-rail\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-icon-action icon-btn icon-btn--sm", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-icon-remove-button icon-btn icon-btn--sm\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-group-add-button icon-btn icon-btn--sm\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "class=\"char-config-group-talk-segment\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "title={`Set talk weight to ${barIndex} of 6`}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label={`Set talk weight to ${barIndex} of 6`}", failures);
ensureIncludes(charConfigContent, charConfigFile, "title=\"Add character to group\" aria-label=\"Add character to group\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label=\"Toggle icon remove mode\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label={iconRemoveMode ? \"Remove selected icon\" : \"Current icon\"}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label={iconRemoveMode ? `Remove icon asset ${i + 1}` : `Select icon asset ${i + 1}`}", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label=\"Add additional assets\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label=\"Add regex script row\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label=\"Export regex scripts\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "aria-label=\"Import regex scripts\"", failures);
ensureIncludes(charConfigContent, charConfigFile, "onkeydown={(event) => handleCharConfigTabKeydown(event, 0)}", failures);
ensureIncludes(charConfigContent, charConfigFile, "onkeydown={(event) => handleCharConfigTabKeydown(event, 7)}", failures);
ensureIncludes(charConfigContent, charConfigFile, "onkeydown={(event) => handleCharConfigTabKeydown(event, 8)}", failures);
ensureIncludes(charConfigContent, charConfigFile, "if(selected.type === 'group' && ($CharConfigSubMenu === 4 || $CharConfigSubMenu === 5 || $CharConfigSubMenu === 6 || $CharConfigSubMenu === 8)){", failures);

ensureIncludes(lorebookContent, lorebookFile, "includeRulebookTab?: boolean;", failures);
ensureIncludes(lorebookContent, lorebookFile, "includeRulebookTab = true", failures);
ensureIncludes(lorebookContent, lorebookFile, "if (!includeRulebookTab && submenu === 3) {", failures);
ensureIncludes(lorebookContent, lorebookFile, "class=\"lorebook-setting-tabs seg-tabs\"", failures);
ensureIncludes(lorebookContent, lorebookFile, "class=\"lorebook-setting-tab seg-tab\"", failures);
ensureIncludes(lorebookContent, lorebookFile, "class:active={submenu === 0}", failures);
ensureIncludes(lorebookContent, lorebookFile, "class:active={submenu === 1}", failures);
ensureIncludes(lorebookContent, lorebookFile, "class:active={submenu === 2}", failures);
ensureIncludes(lorebookContent, lorebookFile, "class:active={submenu === 3}", failures);
ensureIncludes(lorebookContent, lorebookFile, "{#if includeRulebookTab}", failures);
ensureIncludes(lorebookContent, lorebookFile, "{:else if includeRulebookTab && submenu === 3}", failures);
ensureIncludes(lorebookContent, lorebookFile, "{#if submenu !== 2 && submenu !== 3}", failures);
ensureIncludes(
  lorebookContent,
  lorebookFile,
  "class=\"lorebook-setting-action-btn icon-btn icon-btn--md\"",
  failures,
);
ensureIncludes(
  lorebookContent,
  lorebookFile,
  "class=\"lorebook-setting-action-btn icon-btn icon-btn--md lorebook-setting-action-btn-gap\"",
  failures,
);
ensureIncludes(
  lorebookDataContent,
  lorebookDataFile,
  "class=\"lorebook-data-toggle-btn lorebook-data-icon-btn icon-btn icon-btn--sm\"",
  failures,
);
ensureIncludes(
  lorebookDataContent,
  lorebookDataFile,
  "class=\"lorebook-data-action-btn lorebook-data-icon-btn icon-btn icon-btn--sm\"",
  failures,
);
ensureIncludes(
  lorebookDataContent,
  lorebookDataFile,
  "class=\"lorebook-data-action-btn lorebook-data-action-btn-muted lorebook-data-icon-btn icon-btn icon-btn--sm\"",
  failures,
);
ensureIncludes(lorebookDataContent, lorebookDataFile, "data-testid=\"lorebook-data-toggle-btn\"", failures);
ensureIncludes(lorebookDataContent, lorebookDataFile, "data-testid=\"lorebook-data-remove-btn\"", failures);
ensureIncludes(lorebookDataContent, lorebookDataFile, "data-testid=\"lorebook-data-remove-child-btn\"", failures);
ensureIncludes(lorebookDataContent, lorebookDataFile, "data-testid=\"lorebook-data-add-in-folder-btn\"", failures);
ensureIncludes(lorebookListContent, lorebookListFile, "class=\"lorebook-list-root list-shell\"", failures);
ensureIncludes(lorebookListContent, lorebookListFile, "class=\"lorebook-list-empty empty-state\"", failures);
ensureIncludes(lorebookListContent, lorebookListFile, "data-testid=\"lorebook-list-shell\"", failures);
ensureIncludes(lorebookListContent, lorebookListFile, "data-testid=\"lorebook-list-empty\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "class=\"rag-rulebook-list list-shell\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "class=\"rag-rulebook-actions action-rail\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "class=\"ds-settings-card panel-shell rag-rulebook-item\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "class=\"ds-settings-card panel-shell rag-result-item\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "class=\"rag-empty empty-state\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "class=\"rag-result-list list-shell\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "className={`rag-rulebook-toggle-btn icon-btn icon-btn--sm", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "data-testid=\"rulebook-rag-list\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "data-testid=\"rulebook-rag-empty\"", failures);
ensureIncludes(rulebookRagSettingContent, rulebookRagSettingFile, "data-testid=\"rulebook-rag-result-list\"", failures);

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log("[charconfig-rulebook-contract] OK");
