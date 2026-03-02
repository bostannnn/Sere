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
    file: "src/lib/Others/PluginAlertModal.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Plugin risk modal actions now use explicit button semantics and action-rail composition.",
    requiredPatterns: [
      "class=\"ds-plugin-alert-actions action-rail\"",
      "type=\"button\"",
      "aria-label={language.continueAnyway}",
      "aria-label={language.doNotInstall}",
    ],
  },
  {
    file: "src/lib/Others/PluginDefinedIcon.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Plugin icon sanitizer/renderer is infrastructure-only and not a user-facing primitive shell.",
    requiredPatterns: [
      "DOMPurify.sanitize",
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
    file: "src/lib/Playground/PlaygroundDocs.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Docs playground now composes panel/list/empty-state primitives for consistent surface structure.",
    requiredPatterns: [
      "class=\"playground-docs-root panel-shell\"",
      "list-shell",
      "empty-state",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundEmbedding.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Embedding playground now composes panel/list/action-rail markers and control-field semantics.",
    requiredPatterns: [
      "class=\"playground-embedding-root panel-shell\"",
      "action-rail",
      "empty-state",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundImageTrans.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Image translation playground now carries panel/list/action-rail primitive composition markers.",
    requiredPatterns: [
      "class=\"playground-image-trans-root panel-shell\"",
      "action-rail",
      "list-shell",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundInlayExplorer.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Inlay explorer now applies panel/list/empty/action primitives across grid and controls.",
    requiredPatterns: [
      "class=\"playground-inlay-root panel-shell\"",
      "list-shell",
      "empty-state",
      "action-rail",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundJinja.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Jinja playground now marks panel-shell root for primitive convergence.",
    requiredPatterns: [
      "class=\"playground-jinja-root panel-shell\"",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundMCP.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "MCP playground now composes panel/list/action-rail primitives for tool cards and controls.",
    requiredPatterns: [
      "class=\"playground-mcp-root panel-shell\"",
      "list-shell",
      "action-rail",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundMenu.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Playground menu cards now use panel-shell and explicit button semantics.",
    requiredPatterns: [
      "playground-menu-grid",
      "list-shell",
      "playground-menu-card panel-shell",
      "type=\"button\"",
      "aria-label={entry.label}",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundParser.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Parser playground now marks panel-shell root for primitive convergence.",
    requiredPatterns: [
      "class=\"playground-parser-root panel-shell\"",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundRegex.svelte",
    classification: "infra",
    owner: "ui-shell-contract",
    rationale: "Empty placeholder surface retained only as dormant playground slot.",
  },
  {
    file: "src/lib/Playground/PlaygroundSubtitle.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Subtitle playground now composes panel/list/action-rail primitive markers.",
    requiredPatterns: [
      "class=\"playground-subtitle-root panel-shell\"",
      "action-rail",
      "list-shell",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundSyntax.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Syntax playground now marks panel-shell root for primitive convergence.",
    requiredPatterns: [
      "class=\"playground-syntax-root panel-shell\"",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundTokenizer.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Tokenizer playground now marks panel-shell root for primitive convergence.",
    requiredPatterns: [
      "class=\"playground-tokenizer-root panel-shell\"",
    ],
  },
  {
    file: "src/lib/Playground/PlaygroundTranslation.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Translation playground now applies panel-shell root and action-rail primitive composition.",
    requiredPatterns: [
      "class=\"playground-translation-root panel-shell\"",
      "action-rail",
    ],
  },
  {
    file: "src/lib/Playground/ToolConversion.svelte",
    classification: "migrate",
    owner: "ui-shell-contract",
    rationale: "Tool conversion playground now composes panel/list/action-rail primitives.",
    requiredPatterns: [
      "class=\"playground-tool-conversion-root panel-shell\"",
      "list-shell",
      "action-rail",
    ],
  },
  {
    file: "src/lib/Setting/Pages/AccessibilitySettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Accessibility settings page now marks section shells with panel/list primitives.",
    requiredPatterns: [
      "class=\"ds-settings-section panel-shell list-shell\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/BanCharacterSetSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Ban character set accordion now uses panel/list shell primitives.",
    requiredPatterns: [
      "className=\"ds-settings-section panel-shell list-shell\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/ServerPasswordSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Server password card now uses panel-shell and action-rail primitive markers.",
    requiredPatterns: [
      "panel-shell action-rail",
    ],
  },
  {
    file: "src/lib/Setting/Pages/Advanced/SettingsExportButtons.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Settings export actions now use panel-shell and action-rail primitive composition.",
    requiredPatterns: [
      "class=\"ds-settings-section panel-shell\"",
      "class=\"action-rail ds-settings-export-actions\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/AdvancedSettings.svelte",
    classification: "migrate",
    owner: "settings-shell",
    rationale: "Advanced settings shell now marks section with panel/list primitives.",
    requiredPatterns: [
      "class=\"ds-settings-section ds-settings-section--advanced panel-shell list-shell\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/ChatFormatSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Chat format settings page now marks section shell with panel/list primitives.",
    requiredPatterns: [
      "class=\"ds-settings-section panel-shell list-shell\"",
    ],
  },
  {
    file: "src/lib/Setting/Pages/CustomGUISettingMenu.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Custom GUI builder now uses panel/list shell markers for canvas and sidepanel surfaces.",
    requiredPatterns: [
      "class=\"ds-settings-builder-main ds-settings-builder-canvas-wrap panel-shell\"",
      "panel-shell list-shell",
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
    file: "src/lib/Setting/Pages/LanguageSettings.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Language settings now composes list-shell and panel-shell section markers.",
    requiredPatterns: [
      "class=\"ds-settings-page list-shell\"",
      "panel-shell list-shell",
    ],
  },
  {
    file: "src/lib/Setting/Pages/SeparateParametersSection.svelte",
    classification: "migrate",
    owner: "settings-contract",
    rationale: "Separate parameters accordions now apply panel/list shell primitive composition.",
    requiredPatterns: [
      "className=\"ds-settings-section panel-shell list-shell\"",
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
