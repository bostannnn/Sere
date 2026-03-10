#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIB_ROOT = path.join(ROOT, "src/lib");

const CONTRACT_SOURCES = [
  {
    owner: "ui-shell-contract",
    file: path.join(ROOT, "dev/check-ui-shell-contract.js"),
  },
  {
    owner: "chat-sidebar-contract",
    file: path.join(ROOT, "dev/check-chat-sidebar-contract.js"),
  },
  {
    owner: "charconfig-rulebook-contract",
    file: path.join(ROOT, "dev/check-charconfig-rulebook-contract.js"),
  },
  {
    owner: "settings-contract",
    file: path.join(ROOT, "dev/check-settings-contract.js"),
  },
  {
    owner: "settings-shell",
    file: path.join(ROOT, "dev/check-settings-shell.js"),
  },
];

const VALID_CLASSIFICATIONS = new Set(["migrate", "infra"]);
const VALID_OWNERS = new Set(CONTRACT_SOURCES.map((source) => source.owner));

/**
 * @typedef SurfaceMatrixEntry
 * @property {string} file
 * @property {"migrate" | "infra"} classification
 * @property {string} owner
 * @property {string} rationale
 * @property {string[]} [requiredPatterns]
 */

/** @type {SurfaceMatrixEntry[]} */
const PHASE4_UNCOVERED_MATRIX = [
  {
    file: "src/lib/ChatScreens/BackgroundDom.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Background markdown layer is render-only chat infrastructure with no interactive primitive surface.",
    requiredPatterns: [
      "class=\"background-dom-layer\"",
    ],
  },
  {
    file: "src/lib/ChatScreens/ChatBody.svelte",
    classification: "infra",
    owner: "chat-sidebar-contract",
    rationale: "Chat body parser host is render/runtime infrastructure and not a primitive composition target.",
    requiredPatterns: [
      "addMetadataToElement(trimMarkdown(lastParsed), modelShortName)",
    ],
  },
  {
    file: "src/lib/ChatScreens/Chats.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Chat list host is a virtualized render stack; primitive shell classes are avoided to preserve reverse-scroll behavior.",
    requiredPatterns: [
      "class=\"ds-chat-list-stack\"",
    ],
  },
  {
    file: "src/lib/ChatScreens/EmotionBox.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Emotion overlay tiles are render-only visual infrastructure and not interactive primitives.",
    requiredPatterns: [
      "class=\"emotion-box-layer\"",
    ],
  },
  {
    file: "src/lib/ChatScreens/Message.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Legacy rewrite placeholder not mounted in active chat runtime.",
    requiredPatterns: ["<!-- TODO -->"],
  },
  {
    file: "src/lib/ChatScreens/ResizeBox.svelte",
    classification: "migrate",
    owner: "chat-sidebar-contract",
    rationale: "Resize viewport shell now uses panel-shell marker and explicit accessible button semantics.",
    requiredPatterns: [
      "class=\"box resize-box-shell panel-shell\"",
      "type=\"button\"",
      "aria-label=\"Resize emotion viewport\"",
    ],
  },
  {
    file: "src/lib/ChatScreens/TransitionImage.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Transition image compositor is visual render infrastructure and out of primitive migration scope.",
    requiredPatterns: [
      "class=\"image-container\"",
    ],
  },
  {
    file: "src/lib/Others/Help.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Help trigger now composes icon-button primitive semantics.",
    requiredPatterns: [
      "class=\"help ds-help-trigger icon-btn icon-btn--sm\"",
      "type=\"button\"",
      "aria-label={getHelpLabel()}",
    ],
  },
  {
    file: "src/lib/Others/ChatBackgroundPicker.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Per-chat background controls use explicit button semantics and a dedicated tile-grid surface for shell consistency.",
    requiredPatterns: [
      "class=\"chat-bg-picker\"",
      "class=\"chat-bg-grid\"",
      "class=\"chat-bg-tile\"",
      "type=\"button\"",
    ],
  },
  {
    file: "src/lib/Others/HypaV3Progress.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Progress controls enforce explicit icon/button semantics with deterministic labels.",
    requiredPatterns: [
      "type=\"button\"",
      "title={isExpanded ? \"Collapse progress details\" : \"Expand progress details\"}",
      "aria-label={isExpanded ? \"Collapse progress details\" : \"Expand progress details\"}",
    ],
  },
  {
    file: "src/lib/Others/HypaV3Modal/modal-footer.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Hypa modal footer keeps control-field semantics for summarization target preview and explicit error-state typography.",
    requiredPatterns: [
      "class=\"hypa-footer-textarea control-field\"",
      "class=\"hypa-footer-error\"",
    ],
  },
  {
    file: "src/lib/Others/SavePopupIcon.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Saving indicator overlay now adopts panel-shell primitive marker for shell consistency.",
    requiredPatterns: [
      "class=\"save-popup-icon saving-animation panel-shell\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/AccessibilitySettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Accessibility settings page now uses flattened settings section wrappers with renderer-driven controls.",
    requiredPatterns: [
      "class=\"ds-settings-section\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/BanCharacterSetSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Ban character set accordion follows flattened section classes while preserving accordion controls.",
    requiredPatterns: [
      "className=\"ds-settings-section\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/ServerPasswordSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Server password row uses flattened settings section with action-rail composition.",
    requiredPatterns: [
      "class=\"ds-settings-section ds-settings-renderer-offset-md action-rail\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/ComfyCommanderSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Comfy Commander settings keep action-rail primitives while using flattened entity cards.",
    requiredPatterns: [
      "class=\"ds-comfy-entity\"",
      "class=\"ds-settings-inline-actions action-rail ds-comfy-entity-header\"",
      "className=\"action-rail\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/ComfyCommanderPage.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Comfy Commander is exposed as a dedicated settings page with direct section rendering.",
    requiredPatterns: [
      "class=\"ds-settings-page\"",
      ">{language.comfyCommander}</h2>",
      "<ComfyCommanderSettings />",
    ],
  },
  {
    file: "src/lib/Setting/Pages/LogsSettingsPage.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Logs page is a dedicated settings surface that keeps export actions and opens fullscreen logs modal.",
    requiredPatterns: [
      "class=\"ds-settings-page\"",
      ">{language.logs}</h2>",
      "class=\"action-rail ds-settings-export-actions\"",
      "alertRequestLogs();",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/SettingsExportButtons.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Settings export actions use flattened section wrappers and shared action-rail composition.",
    requiredPatterns: [
      "class=\"ds-settings-section\"",
      "class=\"action-rail ds-settings-export-actions\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/AdvancedSettings.svelte",
    classification: "migrate",
    owner: "settings-shell",
    rationale: "Advanced settings shell uses flattened settings page and section wrappers.",
    requiredPatterns: [
      "class=\"ds-settings-section ds-settings-section--advanced\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/ChatFormatSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Chat format settings page uses flattened section wrappers with shared renderer controls.",
    requiredPatterns: [
      "class=\"ds-settings-section\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/CustomGUISettingMenu.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Custom GUI builder uses flattened canvas wrappers and dedicated sidepanel shell utility classes.",
    requiredPatterns: [
      "class=\"ds-settings-builder-main ds-settings-builder-canvas-wrap\"",
      "class=\"ds-settings-label ds-settings-builder-sidepanel-shell ds-settings-builder-sidepanel\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/HotkeySettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Hotkey input now composes control-field semantics and explicit labeling.",
    requiredPatterns: [
      "class=\"ds-settings-hotkey-key-input control-field\"",
      "type=\"text\"",
      "aria-label={`Key for ${language.hotkeyDesc[hotkey.action as keyof typeof language.hotkeyDesc]}`}",
    ],
  },
  {
    file: "src/lib/Setting/Pages/SeparateParametersSection.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Separate parameters accordions apply flattened section classes while retaining control primitives.",
    requiredPatterns: [
      "className=\"ds-settings-section\"",
    ],
  },
  {
    file: "src/lib/Setting/SettingRenderer.svelte",
    classification: "migrate",
    owner: "settings-shell",
    rationale: "Settings renderer rows now apply control-field and action-rail primitive markers.",
    requiredPatterns: [
      "ds-settings-renderer-check-row control-field",
      "ds-settings-renderer-color-row control-field",
      "action-rail",
    ],
  },
  {
    file: "src/lib/UI/3DLoader.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Legacy 3D utility remains dormant and excluded from active shell migration.",
    requiredPatterns: ["@ts-nocheck - Legacy file, not currently in use"],
  },
  {
    file: "src/lib/UI/Accordion.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Accordion trigger semantics standardized to explicit button attributes.",
    requiredPatterns: [
      "type=\"button\"",
      "aria-expanded={open}",
      "aria-controls={panelId}",
    ],
  },
  {
    file: "src/lib/UI/BaseRoundedButton.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Base rounded button now supports semantic passthrough and default button type.",
    requiredPatterns: [
      "type?: \"button\" | \"submit\" | \"reset\";",
      "type={type}",
      "aria-label={ariaLabel}",
    ],
  },
  {
    file: "src/lib/UI/GUI/Button.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Shared GUI button now exposes semantic passthrough with default type.",
    requiredPatterns: [
      "type?: \"button\" | \"submit\" | \"reset\";",
      "type={type}",
      "aria-label={ariaLabel}",
      "aria-pressed={ariaPressed}",
    ],
  },
  {
    file: "src/lib/UI/GUI/CheckInput.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Check input wrapper now includes control-field primitive marker.",
    requiredPatterns: [
      "ds-ui-check control-field",
    ],
  },
  {
    file: "src/lib/UI/GUI/ColorInput.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Color input wrapper now includes control-field primitive marker.",
    requiredPatterns: [
      "class=\"cl color-input-shell control-field\"",
    ],
  },
  {
    file: "src/lib/UI/GUI/EmbeddingModelSelect.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Embedding model select now applies control-field class composition on select wrapper.",
    requiredPatterns: [
      "className={`${className} control-field`.trim()}",
    ],
  },
  {
    file: "src/lib/UI/GUI/LazyPortal.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Portal mounting utility is infrastructure-only and not a shell surface.",
    requiredPatterns: ["IntersectionObserver"],
  },
  {
    file: "src/lib/UI/GUI/OptionInput.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "OptionInput is a low-level option tag helper and not a standalone primitive shell target.",
    requiredPatterns: [
      "class=\"ds-ui-option\"",
    ],
  },
  {
    file: "src/lib/UI/GUI/OptionalInput.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Optional input wrapper now includes control-field primitive marker.",
    requiredPatterns: [
      "class=\"ds-ui-optional-wrap control-field\"",
    ],
  },
  {
    file: "src/lib/UI/GUI/Portal.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Portal mount helper is infrastructure and intentionally out of token migration scope.",
    requiredPatterns: ["mount(PortalConsumer"],
  },
  {
    file: "src/lib/UI/GUI/PortalConsumer.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Portal consumer is an infrastructure primitive, not a user-facing shell surface.",
    requiredPatterns: ["{@render children()}"],
  },
  {
    file: "src/lib/UI/GUI/SideBarArrow.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Desktop sidebar arrow surface is intentionally disabled in current server-first layout.",
    requiredPatterns: ["intentionally disabled for desktop server-first layout"],
  },
  {
    file: "src/lib/UI/GUI/SliderInput.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Slider wrapper now includes control-field primitive marker.",
    requiredPatterns: [
      "ds-ui-slider-wrap control-field",
    ],
  },
  {
    file: "src/lib/UI/GUI/SyntaxHighlightedTextarea.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Empty legacy helper retained as dormant editor-infra placeholder.",
  },
  {
    file: "src/lib/UI/Googli.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Ad slot bridge is environment-driven infrastructure and not a UI primitive composition surface.",
    requiredPatterns: [
      "class=\"googli-test-slot\"",
    ],
  },
  {
    file: "src/lib/UI/MainMenu.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Main menu link cards now expose explicit button semantics and panel-shell composition.",
    requiredPatterns: [
      "class=\"main-menu-link-card panel-shell\"",
      "type=\"button\"",
      "aria-label={link.title}",
    ],
  },
  {
    file: "src/lib/UI/NewGUI/Button.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "New GUI button variants now share semantic passthrough attributes.",
    requiredPatterns: [
      "type?: \"button\" | \"submit\" | \"reset\";",
      "title?: string;",
      "ariaLabel?: string;",
      "ariaPressed?: boolean;",
    ],
  },
  {
    file: "src/lib/UI/PopupButton.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Popup trigger now standardizes icon-button semantics and menu accessibility attributes.",
    requiredPatterns: [
      "class=\"ds-overlay-menu-trigger icon-btn icon-btn--sm\"",
      "type={type}",
      "aria-haspopup=\"menu\"",
      "aria-label={ariaLabel}",
    ],
  },
  {
    file: "src/lib/UI/Title.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Title surface now uses a panel-shell root marker while preserving existing seasonal behavior.",
    requiredPatterns: [
      "class=\"title-shell panel-shell\"",
    ],
  },
  {
    file: "src/lib/Evolution/ProposalPanel.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Proposal review panel is a first-class interactive workspace surface and is tracked separately from the chat-shell host.",
  },
  {
    file: "src/lib/Evolution/ProposalSectionCompare.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Section-by-section proposal diff rendering is an interactive review surface that needs explicit migration coverage.",
  },
  {
    file: "src/lib/Evolution/ReviewWorkspace.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Evolution review workspace composes proposal, editing, and approval controls outside the original chat-sidebar contracts.",
  },
  {
    file: "src/lib/Evolution/SectionConfigEditor.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Section configuration editing is a dedicated evolution settings surface and should be represented in the migration matrix.",
  },
  {
    file: "src/lib/Evolution/StateEditor.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Evolution state editing is a standalone interactive surface and not covered by the top-level chat shell contracts.",
  },
  {
    file: "src/lib/Others/AlertComp/AlertBaseModal.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Alert modal chrome is a reusable interactive shell surface that needs explicit phase-four coverage.",
  },
  {
    file: "src/lib/Others/AlertComp/AlertBranchesOverlay.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Branches overlay is an interactive alert surface layered outside the main shell contracts and must be tracked directly.",
  },
  {
    file: "src/lib/Others/AlertComp/AlertHypaV2Modal.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Legacy Hypa alert modal remains an interactive surface and needs an explicit migration matrix entry.",
  },
  {
    file: "src/lib/Others/AlertComp/AlertRequestDataModal.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Request-data alert modal is a dedicated modal surface that is outside the current shell-specific contract files.",
  },
  {
    file: "src/lib/Others/AlertComp/AlertSelectCharModal.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Character-selection alert modal is an interactive chooser surface and should be explicitly represented in phase-four coverage.",
  },
  {
    file: "src/lib/Others/AlertComp/AlertToast.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Alert toast rendering is a distinct feedback surface with UI semantics outside the main shell contracts.",
  },
  {
    file: "src/lib/Setting/Pages/EvolutionDefaultsSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Evolution defaults is a dedicated settings page and needs explicit coverage alongside the other settings surfaces.",
  },
  {
    file: "src/lib/SideBars/Evolution/EvolutionSettings.svelte",
    classification: "migrate",
    owner: "chat-sidebar-contract",
    rationale: "Evolution settings sidebar is a new right-panel workspace and must be tracked separately from the original three-tab sidebar contract.",
  },
  {
    file: "src/lib/SideBars/Evolution/EvolutionSetupPanel.svelte",
    classification: "migrate",
    owner: "chat-sidebar-contract",
    rationale: "Evolution setup panel is part of the new sidebar workspace and needs explicit migration coverage.",
  },
  {
    file: "src/lib/SideBars/Evolution/EvolutionWorkspaceTabs.svelte",
    classification: "migrate",
    owner: "chat-sidebar-contract",
    rationale: "Evolution workspace tabs extend the chat sidebar surface beyond the original contract and require direct matrix coverage.",
  },
  {
    file: "src/lib/UI/GUI/OpenRouterModelSelect.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "OpenRouter model selection is an interactive GUI control surface that should be represented in the phase-four matrix.",
  },
];

function readFile(file) {
  return fs.readFileSync(file, "utf-8");
}

function walkSvelteFiles(startDir) {
  const files = [];
  for (const entry of fs.readdirSync(startDir, { withFileTypes: true })) {
    const fullPath = path.join(startDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSvelteFiles(fullPath));
      continue;
    }
    if (!entry.name.endsWith(".svelte")) {
      continue;
    }
    files.push(path.relative(ROOT, fullPath).replaceAll(path.sep, "/"));
  }
  return files.sort();
}

function extractSveltePaths(content) {
  return Array.from(content.matchAll(/src\/lib\/[A-Za-z0-9._/-]+\.svelte/g)).map(
    (match) => match[0],
  );
}

const failures = [];

/** @type {Map<string, Set<string>>} */
const coverageByFile = new Map();
for (const source of CONTRACT_SOURCES) {
  const content = readFile(source.file);
  for (const file of extractSveltePaths(content)) {
    if (!coverageByFile.has(file)) {
      coverageByFile.set(file, new Set());
    }
    coverageByFile.get(file).add(source.owner);
  }
}

const allSvelteFiles = walkSvelteFiles(LIB_ROOT);
const preMatrixUncovered = allSvelteFiles.filter((file) => !coverageByFile.has(file));

const seenMatrixFiles = new Set();
for (const entry of PHASE4_UNCOVERED_MATRIX) {
  if (!VALID_OWNERS.has(entry.owner)) {
    failures.push(
      `[phase4-surface-coverage] Invalid owner for ${entry.file}: ${entry.owner}`,
    );
  }
  if (!VALID_CLASSIFICATIONS.has(entry.classification)) {
    failures.push(
      `[phase4-surface-coverage] Invalid classification for ${entry.file}: ${entry.classification}`,
    );
  }
  if (entry.classification === "verify") {
    failures.push(
      `[phase4-surface-coverage] verify classification is no longer allowed: ${entry.file}`,
    );
  }
  if (!entry.rationale || entry.rationale.trim().length === 0) {
    failures.push(`[phase4-surface-coverage] Missing rationale for ${entry.file}`);
  }
  if (entry.classification === "infra" && entry.rationale.trim().length < 12) {
    failures.push(
      `[phase4-surface-coverage] Infra rationale too short for ${entry.file}`,
    );
  }
  if (seenMatrixFiles.has(entry.file)) {
    failures.push(`[phase4-surface-coverage] Duplicate matrix entry: ${entry.file}`);
    continue;
  }
  seenMatrixFiles.add(entry.file);

  const absolute = path.join(ROOT, entry.file);
  if (!fs.existsSync(absolute)) {
    failures.push(`[phase4-surface-coverage] Missing file on disk: ${entry.file}`);
    continue;
  }

  const content = readFile(absolute);
  for (const pattern of entry.requiredPatterns ?? []) {
    if (!content.includes(pattern)) {
      failures.push(
        `[phase4-surface-coverage] Missing required pattern in ${entry.file}: ${pattern}`,
      );
    }
  }

  if (!coverageByFile.has(entry.file)) {
    coverageByFile.set(entry.file, new Set([entry.owner]));
  } else {
    coverageByFile.get(entry.file).add(entry.owner);
  }
}

for (const uncoveredFile of preMatrixUncovered) {
  if (!seenMatrixFiles.has(uncoveredFile)) {
    failures.push(
      `[phase4-surface-coverage] Uncovered surface missing matrix entry: ${uncoveredFile}`,
    );
  }
}

for (const matrixFile of seenMatrixFiles) {
  if (!allSvelteFiles.includes(matrixFile)) {
    failures.push(
      `[phase4-surface-coverage] Matrix entry points to non-lib or missing file: ${matrixFile}`,
    );
  }
}

const finalCovered = new Set(coverageByFile.keys());
const missingCoverage = allSvelteFiles.filter((file) => !finalCovered.has(file));
if (missingCoverage.length > 0) {
  failures.push(
    `[phase4-surface-coverage] Missing coverage for ${missingCoverage.length} surface(s):`,
  );
  for (const file of missingCoverage) {
    failures.push(`  - ${file}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

console.log(
  `[phase4-surface-coverage] OK (${allSvelteFiles.length} surfaces represented; ${PHASE4_UNCOVERED_MATRIX.length} explicit Phase 4 matrix entries)`,
);
