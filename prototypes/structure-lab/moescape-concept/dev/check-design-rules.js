#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const conceptRoot = path.resolve(scriptDir, '..');
const baseCssPath = path.join(conceptRoot, 'shared/base.css');
const cssPath = path.join(conceptRoot, 'styles.css');
const htmlPath = path.join(conceptRoot, 'index.html');
const jsPath = path.join(conceptRoot, 'app.js');

const baseCss = fs.readFileSync(baseCssPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const failures = [];

function rule(name, condition, details) {
  if (!condition) failures.push({ name, details });
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sanitizeTemplateExpressions(content) {
  return content.replace(/\$\{[\s\S]*?\}/g, (expression) =>
    expression.replace(/[^\n]/g, 'T'),
  );
}

function findIconOnlyButtonsMissingLabels(content, sourceName) {
  const sanitized = sanitizeTemplateExpressions(content);
  const buttonRegex = /<button\b[^>]*>([\s\S]*?)<\/button>/g;
  const issues = [];
  let match;
  while ((match = buttonRegex.exec(sanitized)) !== null) {
    const full = match[0];
    const openTag = (full.match(/^<button\b[^>]*>/) || [''])[0];
    const hasAccessibleName = /aria-label\s*=|aria-labelledby\s*=/.test(openTag);
    if (hasAccessibleName) continue;
    const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const isIconOnly = text === '' || (text.length <= 2 && !/[A-Za-z0-9]/.test(text));
    if (!isIconOnly) continue;
    const line = lineForIndex(sanitized, match.index);
    issues.push(`${sourceName}:${line}`);
  }
  return issues;
}

function findTextControlsMissingPrimitive(content, sourceName) {
  const sanitized = sanitizeTemplateExpressions(content);
  const controlRegex = /<(input|select|textarea)\b[^>]*>/gi;
  const ignoredInputTypes = new Set([
    'button',
    'checkbox',
    'color',
    'file',
    'hidden',
    'image',
    'radio',
    'range',
    'reset',
    'submit',
  ]);
  const issues = [];
  let match;
  while ((match = controlRegex.exec(sanitized)) !== null) {
    const tag = match[0];
    const kind = match[1].toLowerCase();
    const classes = (tag.match(/\bclass\s*=\s*["'`]([^"'`]*)["'`]/i)?.[1] || '').split(/\s+/).filter(Boolean);
    if (classes.includes('control-field')) continue;

    if (kind === 'input') {
      const type = (tag.match(/\btype\s*=\s*["'`]([^"'`]*)["'`]/i)?.[1] || 'text').toLowerCase();
      if (ignoredInputTypes.has(type)) continue;
    }

    const line = lineForIndex(sanitized, match.index);
    issues.push(`${sourceName}:${line}`);
  }
  return issues;
}

function classAttrs(content) {
  const regex = /class\s*=\s*["'`]([^"'`]*)["'`]/g;
  const attrs = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    attrs.push(match[1]);
  }
  return attrs;
}

function hasClassDependency(content, className, requiredClass) {
  return classAttrs(content)
    .filter((value) => value.split(/\s+/).includes(className))
    .every((value) => value.split(/\s+/).includes(requiredClass));
}

function hasClassDefinition(cssText, className) {
  return new RegExp(`\\.${escapeRegex(className)}\\s*(,|\\{|:)`).test(cssText);
}

function findInlineDisplayStyles(content, sourceName) {
  const sanitized = sanitizeTemplateExpressions(content);
  const styleRegex = /style\s*=\s*["'`][^"'`]*display\s*:/gi;
  const issues = [];
  let match;
  while ((match = styleRegex.exec(sanitized)) !== null) {
    issues.push(`${sourceName}:${lineForIndex(sanitized, match.index)}`);
  }
  return issues;
}

rule(
  'Focus: required focus-visible selectors exist',
  ['.chrome-btn:focus-visible', '.ds-settings-nav-item:focus-visible', '.seg-tab:focus-visible', '.ds-settings-control:focus-visible', '.side-row:focus-visible'].every((selector) => css.includes(selector)),
  'Missing at least one required focus-visible selector.',
);

rule(
  'Focus: settings controls do not suppress outline',
  !/\.ds-settings-control:focus\s*{[^}]*outline\s*:\s*none/i.test(css),
  'Found outline:none in .ds-settings-control:focus.',
);

const outlineNoneCount = (css.match(/outline\s*:\s*none/gi) || []).length;
rule(
  'Focus: outline none is forbidden',
  outlineNoneCount === 0,
  `Found ${outlineNoneCount} outline:none declarations in styles.css.`,
);

rule(
  'Ghost dependency: .small-muted is local',
  css.includes('.small-muted {'),
  '.small-muted not defined in styles.css',
);

rule(
  'Ghost dependency: .card is local',
  css.includes('.card {'),
  '.card not defined in styles.css',
);

rule(
  'Composer markup: textarea is used',
  /<textarea[^>]*id="composerInput"/.test(html) && !/<input[^>]*id="composerInput"/.test(html),
  'composerInput is not a textarea or input fallback still exists.',
);

rule(
  'Composer behavior: Enter send + Shift+Enter newline',
  /composerInput\?\.addEventListener\('keydown',[\s\S]*if \(event\.key !== 'Enter'\) return;[\s\S]*if \(event\.shiftKey\) return;[\s\S]*event\.preventDefault\(\);[\s\S]*sendMessage\(\);/.test(js),
  'composer keydown handler does not implement Enter/Shift+Enter contract.',
);

rule(
  'Composer behavior: Enter handling is IME-safe',
  /composerInput\?\.addEventListener\('keydown',[\s\S]*if \(event\.isComposing \|\| event\.keyCode === 229\) return;/.test(
    js,
  ),
  'composer keydown handler must guard IME composition (event.isComposing / keyCode 229).',
);

rule(
  'Sidebar profile block exists in markup',
  ['sidebarProfileBlock', 'sidebarProfileAvatar', 'sidebarProfileName', 'sidebarProfileArchetype', 'sidebarProfileChat'].every(
    (id) => html.includes(`id="${id}"`),
  ),
  'Context drawer profile block IDs are missing.',
);

rule(
  'Sidebar profile block is rendered from app state',
  /function renderSidebarProfile\(\)/.test(js) &&
    /renderSidebarProfile\(\);/.test(js) &&
    /const sidebarProfileName = document\.getElementById\('sidebarProfileName'\);/.test(js),
  'Profile rendering function/bindings are missing.',
);

const iconOnlyWithoutLabels = [
  ...findIconOnlyButtonsMissingLabels(html, 'index.html'),
  ...findIconOnlyButtonsMissingLabels(js, 'app.js'),
];
rule(
  'Accessibility: icon-only buttons include explicit accessible names',
  iconOnlyWithoutLabels.length === 0,
  iconOnlyWithoutLabels.length
    ? `Missing aria-label/aria-labelledby at ${iconOnlyWithoutLabels.join(', ')}`
    : '',
);

rule(
  'Accessibility: global drawer close button label is specific',
  /id="closeGlobalDrawerBtn"[^>]*aria-label="Close global sidebar"/.test(html),
  'closeGlobalDrawerBtn must use aria-label="Close global sidebar".',
);

rule(
  'Topbar control label: sidebar button uses stable ASCII label',
  /id="topSidebarBtn"[^>]*aria-label="Open workspace sidebar"[^>]*>Sidebar \+<\/button>/.test(html) &&
    !html.includes('Sidebar ⊕'),
  'topSidebarBtn must use aria-label "Open workspace sidebar" and text "Sidebar +".',
);

rule(
  'Layout invariants: no style.display assignments in app.js',
  !/style\.display\s*=/.test(js),
  'Found style.display assignment in app.js; use .hidden class toggles in enterXView() only.',
);

rule(
  'Rendering boundaries: character grid click uses stable-root delegation',
  /characterGrid\?\.addEventListener\('click',[\s\S]*closest\('\[data-character\]'\)/.test(js) &&
    !/function renderCharacterGrid\(\)[\s\S]*querySelectorAll\('\[data-character\]'\)\.forEach\([\s\S]*addEventListener\('click'/.test(
      js,
    ),
  'Character grid must use delegated click handling on characterGrid root (no per-row listener attachment in renderCharacterGrid).',
);

const inlineDisplayStyleHits = [
  ...findInlineDisplayStyles(html, 'index.html'),
  ...findInlineDisplayStyles(js, 'app.js'),
];
rule(
  'Layout invariants: no inline display styles in markup/templates',
  inlineDisplayStyleHits.length === 0,
  inlineDisplayStyleHits.length
    ? `Found inline display style usage at ${inlineDisplayStyleHits.join(', ')}`
    : '',
);

rule(
  'Layout invariants: enterXView functions own top-level view hidden toggles',
  /function enterHomeView\(\)[\s\S]*homeView\.classList\.remove\('hidden'\);[\s\S]*chatView\.classList\.add\('hidden'\);[\s\S]*libraryView\.classList\.add\('hidden'\);[\s\S]*playgroundView\.classList\.add\('hidden'\);[\s\S]*settingsView\.classList\.add\('hidden'\);/.test(js) &&
    /function enterChatView[\s\S]*homeView\.classList\.add\('hidden'\);[\s\S]*chatView\.classList\.remove\('hidden'\);[\s\S]*libraryView\.classList\.add\('hidden'\);[\s\S]*playgroundView\.classList\.add\('hidden'\);[\s\S]*settingsView\.classList\.add\('hidden'\);/.test(js) &&
    /function enterLibraryView\(\)[\s\S]*homeView\.classList\.add\('hidden'\);[\s\S]*chatView\.classList\.add\('hidden'\);[\s\S]*libraryView\.classList\.remove\('hidden'\);[\s\S]*playgroundView\.classList\.add\('hidden'\);[\s\S]*settingsView\.classList\.add\('hidden'\);/.test(js) &&
    /function enterPlaygroundView\(\)[\s\S]*homeView\.classList\.add\('hidden'\);[\s\S]*chatView\.classList\.add\('hidden'\);[\s\S]*libraryView\.classList\.add\('hidden'\);[\s\S]*playgroundView\.classList\.remove\('hidden'\);[\s\S]*settingsView\.classList\.add\('hidden'\);/.test(js) &&
    /function enterSettingsView\(\)[\s\S]*homeView\.classList\.add\('hidden'\);[\s\S]*chatView\.classList\.add\('hidden'\);[\s\S]*libraryView\.classList\.add\('hidden'\);[\s\S]*playgroundView\.classList\.add\('hidden'\);[\s\S]*settingsView\.classList\.remove\('hidden'\);/.test(js),
  'Top-level view hidden toggles must live in enterXView() functions with explicit one-visible-view contract.',
);

const topLevelHiddenMutations = [
  ...js.matchAll(
    /\b(?:homeView|chatView|libraryView|playgroundView|settingsView)\.classList\.(?:add|remove)\('hidden'\);/g,
  ),
].length;
rule(
  'Layout invariants: top-level hidden toggles are not mutated elsewhere',
  topLevelHiddenMutations === 25,
  `Expected 25 top-level hidden add/remove operations (5 views x 5 enterXView functions), found ${topLevelHiddenMutations}.`,
);

rule(
  'Accessibility: tab widgets include roving tabindex',
  /role="tab" aria-selected="\$\{isSelected\}" tabindex="\$\{isSelected \? '0' : '-1'\}"/.test(js) &&
    /role="tab" aria-selected="\$\{active\}" tabindex="\$\{active \? '0' : '-1'\}"/.test(js),
  'Settings/sidebar tabs missing tabindex roving contract.',
);

rule(
  'Accessibility: tab widgets support arrow-key navigation',
  /sidebarModeStrip\?\.addEventListener\('keydown',[\s\S]*data-sidebar-tab[\s\S]*ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/.test(
    js,
  ) &&
    /settingsContentPanel\?\.addEventListener\('keydown',[\s\S]*data-settings-subtab-key[\s\S]*ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/.test(
      js,
    ),
  'Missing keydown handlers for tablist arrow/Home/End navigation.',
);

rule(
  'Interaction: Escape closes open drawers',
  /document\.addEventListener\('keydown',[\s\S]*event\.key !== 'Escape'[\s\S]*closeAllDrawers\(\);/.test(
    js,
  ),
  'Escape key close handler for drawers is missing.',
);

const rawPrototypeLabels = [
  'emotionWarn',
  'globalLoreInfo',
  'localLoreInfo',
  'useGlobalSettings',
  'recursiveScanning',
  'fullWordMatching',
  'loreBookDepth',
  'loreBookToken',
  'lorePlus',
  'triggerV1Warning',
  'helpBlock',
  'GameStateEditor',
  'tool.name',
  'tool.description',
  'Execute tool.name',
];
const rawPrototypeLabelHits = rawPrototypeLabels.filter((token) =>
  new RegExp(`>\\s*${escapeRegex(token)}\\s*<`).test(js),
);
rule(
  'Label policy: known raw key placeholders are not rendered',
  rawPrototypeLabelHits.length === 0,
  rawPrototypeLabelHits.length
    ? `Raw placeholder labels still rendered: ${rawPrototypeLabelHits.join(', ')}`
    : '',
);

rule(
  'Label policy: content-string keys are explicitly overridden in settingLabel()',
  ['emotionWarn', 'triggerV1Warning', 'helpBlock', 'gameStateEditor'].every((key) =>
    new RegExp(`${escapeRegex(key)}\\s*:\\s*'[^']+'`).test(js),
  ),
  'SETTINGS_LABEL_OVERRIDES must include emotionWarn/triggerV1Warning/helpBlock/gameStateEditor with human-readable strings.',
);

const controlsMissingPrimitive = [
  ...findTextControlsMissingPrimitive(html, 'index.html'),
  ...findTextControlsMissingPrimitive(js, 'app.js'),
];
rule(
  'Primitive contract: text/select/textarea controls include control-field',
  controlsMissingPrimitive.length === 0,
  controlsMissingPrimitive.length
    ? `Missing control-field at ${controlsMissingPrimitive.join(', ')}`
    : '',
);

rule(
  'Primitive contract: dropdown/input height is unified via control-field',
  /\.control-field:is\(input,\s*select\)\s*{[\s\S]*height:\s*var\(--ds-height-control-md\);/.test(css),
  'control-field input/select height contract is missing or changed.',
);

rule(
  'State sync: sendMessage updates chat summary surfaces',
  /function sendMessage\(\)[\s\S]*chat\.turns[\s\S]*chat\.updatedAt[\s\S]*renderChatRuntime\(\);[\s\S]*renderSidebarContent\(\);[\s\S]*renderGlobalRecentChats\(\);[\s\S]*renderCharacterGrid\(\);/.test(
    js,
  ),
  'sendMessage does not synchronize runtime/sidebar/recent/home surfaces after message send.',
);

const innerHtmlAssignments = [...js.matchAll(/([A-Za-z_$][\w$]*)\.innerHTML\s*=/g)].map(
  (match) => match[1],
);
const forbiddenInnerHtmlTargets = innerHtmlAssignments.filter((target) => target !== 'template');
rule(
  'Rendering boundaries: no forbidden innerHTML assignments',
  forbiddenInnerHtmlTargets.length === 0,
  forbiddenInnerHtmlTargets.length
    ? `Found forbidden innerHTML target(s): ${[...new Set(forbiddenInnerHtmlTargets)].join(', ')}`
    : '',
);

const htmlToFragmentMentions = [...js.matchAll(/\bhtmlToFragment\(/g)].length;
rule(
  'Rendering boundaries: htmlToFragment is only used in replaceMarkup',
  htmlToFragmentMentions === 2 &&
    /function replaceMarkup\(target,\s*markup\)\s*{[\s\S]*target\.replaceChildren\(htmlToFragment\(html\)\);/.test(
      js,
    ),
  'htmlToFragment usage drifted outside replaceMarkup contract.',
);

rule(
  'Layer tokens: required surface depth tokens exist',
  ['--surface-topbar', '--surface', '--surface-raised', '--surface-overlay', '--surface-recessed'].every(
    (token) => css.includes(`${token}:`),
  ),
  'Missing one or more required layer surface tokens.',
);

rule(
  'Layer tokens: topbar and drawers use layer tokens',
  /\.topbar\s*{[\s\S]*background:\s*var\(--surface-topbar\);/.test(css) &&
    /\.drawer\s*{[\s\S]*background:\s*var\(--surface-overlay\);/.test(css),
  'Topbar/drawer backgrounds are not mapped to layer token contract.',
);

rule(
  'Layer tokens: chat bubbles are tokenized',
  /\.message\s*{[\s\S]*background:\s*var\(--chat-assistant-bg\);/.test(css) &&
    /\.message\.user\s*{[\s\S]*background:\s*var\(--chat-user-bg\);/.test(css),
  'Chat bubble backgrounds are not using chat layer tokens.',
);

rule(
  'Base contract: layer and chat tokens exist in shared/base.css',
  [
    '--surface-topbar',
    '--surface',
    '--surface-raised',
    '--surface-overlay',
    '--surface-recessed',
    '--chat-assistant-bg',
    '--chat-user-bg',
  ].every((token) => baseCss.includes(`${token}:`)),
  'shared/base.css is missing required layer/chat token definitions.',
);

rule(
  'Base contract: item-btn active uses accent edge treatment',
  /\.item-btn\.active\s*{[\s\S]*box-shadow:\s*inset\s+0\s+-2px\s+0\s+var\(--accent\);/.test(baseCss),
  'shared/base.css .item-btn.active must use accent edge treatment (inset underline/bar).',
);

rule(
  'Active-state contract: styles item-btn.active uses accent edge treatment',
  /\.item-btn\.active\s*{[\s\S]*box-shadow:\s*inset\s+0\s+-2px\s+0\s+var\(--accent-strong\);/.test(css),
  'styles.css .item-btn.active must include accent edge treatment.',
);

rule(
  'Active-state contract: tab-pattern controls use accent edge treatment',
  /\.seg-tab\.is-active,\s*[\s\S]*?\.seg-tab\.active[\s\S]*?{[\s\S]*box-shadow:\s*inset\s+0\s+-2px\s+0\s+var\(--accent-strong\);/.test(
    css,
  ) &&
    /class="seg-tab sidebar-group-btn/.test(js) &&
    /class="seg-tab sidebar-mode-btn/.test(js) &&
    /class="seg-tab ds-settings-tab/.test(js),
  'Tab-pattern controls must use accent-edge active state and compose from .seg-tab.',
);

rule(
  'Scripts trigger tabs: active state uses shared seg-tab .active',
  /class="seg-tab trigger-list-mode-btn \$\{sidebarTriggerMode === 'v1' \? 'active' : ''\}"/.test(js) &&
    /class="seg-tab trigger-list-mode-btn \$\{sidebarTriggerMode === 'v2' \? 'active' : ''\}"/.test(js) &&
    /class="seg-tab trigger-list-mode-btn \$\{sidebarTriggerMode === 'lua' \? 'active' : ''\}"/.test(js) &&
    !js.includes('trigger-list-mode-btn-active') &&
    !css.includes('.trigger-list-mode-btn-active'),
  'Scripts trigger mode buttons must use .active (seg-tab contract), not custom trigger-list-mode-btn-active.',
);

rule(
  'Active-state contract: list-pattern settings nav uses fill active state',
  /\.ds-settings-nav-item\.is-active\s*{[\s\S]*background:\s*var\(--ds-surface-active\);/.test(css) &&
    !/\.ds-settings-nav-item\.is-active\s*{[\s\S]*box-shadow:\s*inset\s+0\s+-2px\s+0\s+var\(--accent-strong\);/.test(
      css,
    ) &&
    /class="ds-settings-nav-item/.test(js) &&
    !/class="[^"]*ds-settings-nav-item[^"]*seg-tab/.test(js),
  'Settings nav active state must use list-pattern fill (no accent-edge underline, no seg-tab composition).',
);

rule(
  'Active-state contract: list-pattern chips/rows use fill active state',
  /\.ds-settings-key-chip\.active\s*{[\s\S]*background:\s*var\(--ds-surface-active\);/.test(css) &&
    /\.rag-system-row:hover,\s*[\s\S]*?\.rag-system-row\.is-active\s*{[\s\S]*background:\s*var\(--ds-surface-active\);/.test(
      css,
    ) &&
    !/\.ds-settings-key-chip\.active\s*{[\s\S]*box-shadow:\s*inset\s+0\s+-2px\s+0\s+var\(--accent-strong\);/.test(
      css,
    ) &&
    !/\.rag-system-row\.is-active\s*{[\s\S]*box-shadow:\s*inset\s+0\s+-2px\s+0\s+var\(--accent-strong\);/.test(
      css,
    ),
  'List-pattern chip/row active states must use fill treatment and avoid accent-edge underline.',
);

rule(
  'Tokens: radius-xl and avatar placeholder tokens exist',
  css.includes('--ds-radius-xl:') && css.includes('--avatar-placeholder-bg:'),
  'Missing --ds-radius-xl or --avatar-placeholder-bg token in styles.css.',
);

rule(
  'Radius contract: major shell containers use tokenized radii',
  /\.playground-frame\s*{[\s\S]*border-radius:\s*var\(--ds-radius-lg\);/.test(css) &&
    /\.home-header\s*{[\s\S]*border-radius:\s*var\(--ds-radius-lg\);/.test(css) &&
    /\.character-card\s*{[\s\S]*border-radius:\s*var\(--ds-radius-xl\);/.test(css) &&
    /\.chat-core\s*{[\s\S]*border-radius:\s*var\(--ds-radius-xl\);/.test(css),
  'Major shell surfaces must use tokenized large radii (lg/xl).',
);

rule(
  'Radius contract: core controls/panels use radius tokens',
  /\.chrome-btn\s*{[\s\S]*border-radius:\s*var\(--ds-radius-inset\);/.test(css) &&
    /\.control-field\s*{[\s\S]*border-radius:\s*var\(--ds-radius-inset\);/.test(css) &&
    /\.playground-tool-card\s*{[\s\S]*border-radius:\s*var\(--ds-radius-md\);/.test(css) &&
    /\.playground-panel\s*{[\s\S]*border-radius:\s*var\(--ds-radius-md\);/.test(css),
  'Core controls/panels must use tokenized radii (no raw px radius values in these primitives).',
);

rule(
  'Tokenization: sidebar portrait/table and playground surfaces use design tokens',
  /\.sidebar-portrait-tile\s*{[\s\S]*color:\s*var\(--ds-text-primary\);/.test(css) &&
    /\.sidebar-portrait-tile\.active\s*{[\s\S]*box-shadow:\s*0\s+0\s+0\s+2px\s+var\(--accent-strong\);[\s\S]*border-color:\s*var\(--line-strong\);/.test(
      css,
    ) &&
    /\.sidebar-table th\s*{[\s\S]*background:\s*var\(--ds-surface-3\);[\s\S]*color:\s*var\(--ds-text-secondary\);/.test(
      css,
    ) &&
    /\.playground-image-canvas\s*{[\s\S]*background:\s*var\(--ds-surface-active\);/.test(css) &&
    /\.playground-pre\s*{[\s\S]*background:\s*var\(--ds-surface-1\);/.test(css),
  'Expected tokenized colors/backgrounds for portrait tiles, sidebar table head, and playground surfaces.',
);

rule(
  'Tokenization: avatar placeholder surfaces share --avatar-placeholder-bg',
  [
    '.character-avatar',
    '.sidebar-profile-avatar',
    '.sidebar-portrait-tile',
    '.sidebar-thumb',
    '.char-config-icon-tile',
  ].every((selector) =>
    new RegExp(`${escapeRegex(selector)}\\s*{[\\s\\S]*background:\\s*var\\(--avatar-placeholder-bg\\);`).test(css),
  ),
  'Avatar placeholder surfaces must use --avatar-placeholder-bg.',
);

rule(
  'Tokenization: char-config icon action hover colors use semantic tokens',
  /\.char-config-icon-action--danger:hover\s*{[\s\S]*color:\s*var\(--ds-text-danger\);/.test(css) &&
    /\.char-config-icon-action--success:hover\s*{[\s\S]*color:\s*var\(--ds-text-success\);/.test(css) &&
    /\.char-config-icon-action--accent:hover\s*{[\s\S]*color:\s*var\(--accent-strong\);/.test(css),
  'Character icon action hover states must use semantic tokens.',
);

const expectedFontStack = "font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', sans-serif;";
rule(
  'Typography contract: base.css and styles.css share the same body font stack',
  baseCss.includes(expectedFontStack) && css.includes(expectedFontStack),
  'Body font stack differs between shared/base.css and styles.css.',
);

rule(
  'Base contract: primitive fallback classes exist in shared/base.css',
  [
    'panel-shell',
    'control-field',
    'control-chip',
    'icon-btn',
    'seg-tabs',
    'seg-tab',
    'list-shell',
    'empty-state',
    'action-rail',
  ].every((name) => hasClassDefinition(baseCss, name)),
  'shared/base.css is missing one or more primitive fallback class definitions.',
);

rule(
  'Primitives: panel-shell/control-field/control-chip/drawer-elevation are defined',
  ['panel-shell', 'control-field', 'control-chip', 'drawer-elevation--left', 'drawer-elevation--right'].every(
    (name) => new RegExp(`\\.${escapeRegex(name)}\\s*(,|\\{)`).test(css),
  ),
  'Missing one or more shared primitive definitions.',
);

rule(
  'Primitives: key shell surfaces opt into panel-shell',
  ['class="chat-core card panel-shell"', 'class="playground-frame card panel-shell"'].every(
    (snippet) => html.includes(snippet),
  ),
  'Chat/playground surfaces must include panel-shell.',
);

rule(
  'Shell contract: home uses single title bar and topbar search',
  html.includes('id="shellSearchInput"') &&
    html.includes('class="control-field topbar-search hidden" id="shellSearchInput"') &&
    !html.includes('class="home-header'),
  'Home title/search contract violated: character search must be in topbar and home-header must not exist.',
);

rule(
  'Shell search: shared topbar component is used across Home and Library',
  /const SHELL_SEARCH_CONFIG\s*=\s*{[\s\S]*home:[\s\S]*library:[\s\S]*};/.test(js) &&
    /function setShellSearchMode\(mode\)/.test(js) &&
    /function enterHomeView\(\)[\s\S]*setShellSearchMode\('home'\);/.test(js) &&
    /function enterLibraryView\(\)[\s\S]*setShellSearchMode\('library'\);/.test(js) &&
    /function enterChatView[\s\S]*setShellSearchMode\('hidden'\);/.test(js) &&
    /function enterPlaygroundView\(\)[\s\S]*setShellSearchMode\('hidden'\);/.test(js) &&
    /function enterSettingsView\(\)[\s\S]*setShellSearchMode\('hidden'\);/.test(js),
  'Shared shell search contract violated: Home/Library must use setShellSearchMode and shared topbar component.',
);

rule(
  'Sidebar mode strip: mode switch is borderless (no seg-tabs) and tab strip keeps seg-tabs',
  /<div class="sidebar-mode-switch" role="group" aria-label="Sidebar Mode">/.test(js) &&
    !/<div class="seg-tabs sidebar-mode-switch" role="group" aria-label="Sidebar Mode">/.test(js) &&
    /<div class="seg-tabs sidebar-tab-strip" role="tablist"/.test(js),
  'Mode switch must not use seg-tabs; only sidebar-tab-strip uses seg-tabs.',
);

rule(
  'Sidebar mode strip: mode switch grid is future-proofed',
  /\.sidebar-mode-switch\s*{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(0,\s*1fr\)\);/.test(css),
  'sidebar-mode-switch must use repeat(auto-fit, minmax(0, 1fr)) to avoid hardcoded mode counts.',
);

const requiredColorSchemeKeys = [
  'default',
  'dark',
  'light',
  'cherry',
  'galaxy',
  'nature',
  'realblack',
  'monokai-light',
  'monokai-black',
  'lite',
];

rule(
  'Color schemes: prototype includes original app scheme set',
  requiredColorSchemeKeys.every((key) =>
    key.includes('-') ? js.includes(`'${key}': {`) : js.includes(`${key}: {`),
  ),
  'COLOR_SCHEMES is missing one or more original app scheme keys.',
);

rule(
  'Color schemes: Display page uses bound Color Scheme select control',
  /renderSettingsSelectField\('Color Scheme',\s*COLOR_SCHEME_OPTIONS,\s*selectedColorSchemeName,\s*'data-setting-color-scheme'\)/.test(
    js,
  ),
  'Display settings must bind Color Scheme select to COLOR_SCHEME_OPTIONS + selectedColorSchemeName + data-setting-color-scheme.',
);

rule(
  'Color schemes: change handler applies selected scheme from settings content',
  /settingsContentPanel\?\.addEventListener\('change',[\s\S]*const colorSchemeSelect = event\.target\.closest\('\[data-setting-color-scheme\]'\);[\s\S]*applyColorScheme\(colorSchemeSelect\.value\);/.test(
    js,
  ),
  'Missing settings content change handler for data-setting-color-scheme -> applyColorScheme(value).',
);

rule(
  'Prototype scope: chat theme/background controls are deferred to production migration',
  !/CHAT_THEME_OPTIONS|CHAT_THEME_PREF_KEY|applyChatTheme|data-setting-chat-theme/.test(js) &&
    !/CUSTOM_BG_ENABLED_PREF_KEY|CUSTOM_BG_DATA_PREF_KEY|applyCustomBackground|data-setting-custom-background-/.test(
      js,
    ) &&
    !/--chat-custom-bg|has-custom-bg|data-chat-theme/.test(css),
  'Prototype must not include chat theme/custom background runtime wiring; keep this work in migration scope only.',
);

rule(
  'Color schemes: selection persists and hydrates from sessionStorage',
  /const COLOR_SCHEME_PREF_KEY = 'moescape\.colorScheme';/.test(js) &&
    /function readColorSchemePreference\(\)/.test(js) &&
    /function applyColorScheme\(name,\s*\{\s*persist = true\s*\}\s*=\s*\{\}\)/.test(js) &&
    /selectedColorSchemeName = readColorSchemePreference\(\);[\s\S]*applyColorScheme\(selectedColorSchemeName,\s*\{\s*persist:\s*false\s*\}\);/.test(
      js,
    ),
  'Color scheme preference key/hydration contract is missing.',
);

const expandedPaletteFamilies = ['primary', 'secondary', 'danger', 'success', 'warning', 'neutral'];
const expandedPaletteSteps = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
rule(
  'Expanded palette: styles.css declares theme ramps for required families',
  expandedPaletteFamilies.every((family) =>
    expandedPaletteSteps.every((step) => css.includes(`--theme-${family}-${step}:`)),
  ),
  'styles.css is missing one or more --theme-<family>-<step> declarations.',
);

rule(
  'Expanded palette: runtime generates and applies full ramps',
  /const PALETTE_STEPS = \[50,\s*100,\s*200,\s*300,\s*400,\s*500,\s*600,\s*700,\s*800,\s*900\];/.test(js) &&
    /function buildRamp\(/.test(js) &&
    /function applyRampTokens\(/.test(js) &&
    /applyRampTokens\(root,\s*'primary',\s*primaryRamp\);/.test(js) &&
    /applyRampTokens\(root,\s*'secondary',\s*secondaryRamp\);/.test(js) &&
    /applyRampTokens\(root,\s*'danger',\s*dangerRamp\);/.test(js) &&
    /applyRampTokens\(root,\s*'success',\s*successRamp\);/.test(js) &&
    /applyRampTokens\(root,\s*'warning',\s*warningRamp\);/.test(js) &&
    /applyRampTokens\(root,\s*'neutral',\s*neutralRamp\);/.test(js),
  'applyColorScheme must generate and apply ramps for primary/secondary/danger/success/warning/neutral.',
);

rule(
  'Expanded palette: shell semantic tokens are mapped from generated ramps',
  /root\.style\.setProperty\('--ink',\s*textPrimary\);/.test(js) &&
    /root\.style\.setProperty\('--ink-soft',\s*textSecondary\);/.test(js) &&
    /root\.style\.setProperty\('--accent-strong',\s*primaryRamp\[500\]\);/.test(js) &&
    /root\.style\.setProperty\('--ds-text-danger',\s*dangerRamp\[600\]\);/.test(js) &&
    /root\.style\.setProperty\('--ds-text-success',\s*successRamp\[600\]\);/.test(js) &&
    /root\.style\.setProperty\('--ds-text-warning',\s*warningRamp\[700\]\);/.test(js),
  'Semantic shell tokens must be mapped from generated ramps in applyColorScheme.',
);

rule(
  'Expanded palette: feature accent surfaces are token driven',
  css.includes('--folder-blue-gradient:') &&
    css.includes('--folder-purple-gradient:') &&
    css.includes('--scrim-bg:') &&
    /\.sidebar-folder-blue\s*{[\s\S]*background:\s*var\(--folder-blue-gradient\);/.test(css) &&
    /\.sidebar-folder-purple\s*{[\s\S]*background:\s*var\(--folder-purple-gradient\);/.test(css) &&
    /\.scrim\s*{[\s\S]*background:\s*var\(--scrim-bg\);/.test(css) &&
    /root\.style\.setProperty\(\s*'--folder-blue-gradient',/.test(js) &&
    /root\.style\.setProperty\(\s*'--folder-purple-gradient',/.test(js) &&
    /root\.style\.setProperty\(\s*'--scrim-bg',/.test(js),
  'Folder gradients/scrim must be token-defined in styles.css and updated by applyColorScheme.',
);

rule(
  'Shell alignment: topbar search matches chrome control height',
  /\.topbar-search\s*{[\s\S]*flex:\s*0\s+1\s+clamp\([\s\S]*margin-inline:\s*auto;[\s\S]*min-height:\s*var\(--chrome-btn-h\);[\s\S]*height:\s*var\(--chrome-btn-h\);/.test(css),
  '.topbar-search must be centered constrained width (flex:0 1 clamp(...), margin-inline:auto) and use --chrome-btn-h for min-height/height.',
);

rule(
  'Primitives: drawers opt into elevation modifiers',
  html.includes('class="drawer drawer-global drawer-elevation--left"') &&
    html.includes('class="drawer drawer-chat-right drawer-elevation--right"'),
  'Global/context drawers must include drawer elevation modifier classes.',
);

rule(
  'View routing: global drawer nav buttons declare data-workspace-view targets',
  ['characters', 'library', 'playground', 'settings'].every((view) =>
    html.includes(`data-workspace-view="${view}"`),
  ),
  'Global drawer nav must include data-workspace-view for characters/library/playground/settings.',
);

rule(
  'View routing: global drawer click handler routes via dataset.workspaceView',
  /globalDrawer\?\.addEventListener\('click',[\s\S]*const button = event\.target\.closest\('\[data-workspace-view\]'\);[\s\S]*if \(!button\) return;[\s\S]*const view = button\.dataset\.workspaceView;[\s\S]*if \(view === 'characters'\)[\s\S]*else if \(view === 'library'\)[\s\S]*else if \(view === 'playground'\)[\s\S]*else if \(view === 'settings'\)/.test(
    js,
  ),
  'Global drawer routing must use [data-workspace-view] and dataset.workspaceView.',
);

rule(
  'View routing: global drawer routing does not infer from text or position',
  !/globalDrawer\?\.addEventListener\('click',[\s\S]*?(?:textContent|innerText|children\s*\[|childNodes|nth-child)/.test(
    js,
  ),
  'Detected text/order-based routing logic inside global drawer click handler.',
);

rule(
  'Drawer architecture: intentional header asymmetry is preserved',
  /<aside id="globalDrawer"[\s\S]*?<div class="drawer-head drawer-head-left">[\s\S]*?id="closeGlobalDrawerBtn"[^>]*class="[^"]*drawer-close-left[^"]*"/.test(
    html,
  ) &&
    /<aside id="contextDrawer"[\s\S]*?<div class="drawer-head drawer-head-right">[\s\S]*?id="closeContextDrawerBtn"[^>]*class="[^"]*drawer-close-right[^"]*"/.test(
      html,
    ),
  'Drawer header asymmetry contract violated (global:left, context:right).',
);

rule(
  'Label policy: model/engine options are human-readable',
  !/>\s*openai3small\s*</i.test(js) &&
    !/>\s*openai3large\s*</i.test(js) &&
    !/>\s*whisperLocal\s*</i.test(js),
  'Raw model/engine key labels are still rendered in option markup.',
);

rule(
  'Settings persona: profile uses dedicated two-column container with fixed avatar column',
  /<div class="panel-shell ds-settings-card ds-settings-persona-profile">/.test(js) &&
    /<div class="ds-settings-persona-avatar-col">/.test(js) &&
    /<div class="ds-settings-section ds-settings-persona-editor">/.test(js) &&
    /\.ds-settings-persona-avatar-col\s*{[\s\S]*flex:\s*0\s+0\s+auto;/.test(css),
  'Persona profile must use ds-settings-persona-profile + ds-settings-persona-avatar-col layout contract.',
);

rule(
  'Settings persona: add button is a tile-level sibling in wrap row',
  /ds-settings-wrap-row[\s\S]*ds-settings-persona-add-tile/.test(js) &&
    !/ds-settings-wrap-row[\s\S]*<div class="ds-settings-inline-actions">[\s\S]*Add Persona/.test(js),
  'Persona add action must be rendered as ds-settings-persona-add-tile sibling, not nested inline-actions block.',
);

rule(
  'Settings chatbot: title row uses dedicated container (not inline-actions h2)',
  /<div class="ds-settings-page-title-row">[\s\S]*<h2 class="ds-settings-page-title">Chat Bot<\/h2>/.test(js) &&
    !/<h2 class="ds-settings-page-title ds-settings-inline-actions">/.test(js),
  'Chat Bot page header must use ds-settings-page-title-row and keep h2 as title only.',
);

rule(
  'Settings danger note uses semantic danger token',
  /\.ds-settings-note-danger\s*{[\s\S]*color:\s*var\(--ds-text-danger\);/.test(css),
  '.ds-settings-note-danger must use var(--ds-text-danger).',
);

rule(
  'Topbar token exists',
  /--topbar-h:\s*66px;/.test(css),
  '--topbar-h token missing.',
);

const hardcodedTopbarCount = (css.match(/66px/g) || []).length;
rule(
  'Topbar hardcoded value appears once',
  hardcodedTopbarCount <= 1,
  `Found ${hardcodedTopbarCount} occurrences of 66px.`,
);

rule(
  'Topbar token used in all required layout calculations',
  /grid-template-rows:\s*var\(--topbar-h\)\s+1fr;/.test(css) &&
    /\.view\s*{[\s\S]*height:\s*calc\(100vh - var\(--topbar-h\)\);/.test(css) &&
    /\.chat-core\s*{[\s\S]*height:\s*calc\(100vh - var\(--topbar-h\)/.test(css) &&
    /\.playground-frame\s*{[\s\S]*height:\s*calc\(100vh - var\(--topbar-h\)/.test(css),
  'Missing --topbar-h usage in required layout selectors.',
);

rule(
  'Layering contract: z-index tokens exist',
  ['--z-view', '--z-scrim', '--z-topbar', '--z-drawer', '--z-overlay', '--z-toast'].every((token) =>
    css.includes(`${token}:`),
  ),
  'Missing one or more z-index layering tokens.',
);

rule(
  'Layering contract: topbar/drawer/scrim/views use z-index tokens',
  /\.topbar\s*{[\s\S]*z-index:\s*var\(--z-topbar\);/.test(css) &&
    /\.drawer\s*{[\s\S]*z-index:\s*var\(--z-drawer\);/.test(css) &&
    /\.scrim\s*{[\s\S]*z-index:\s*var\(--z-scrim\);/.test(css) &&
    /\.rag-dashboard\s*{[\s\S]*z-index:\s*var\(--z-view\);/.test(css) &&
    /\.ds-settings-shell\s*{[\s\S]*z-index:\s*var\(--z-view\);/.test(css) &&
    /\.rag-staging-drawer\s*{[\s\S]*z-index:\s*var\(--z-overlay\);/.test(css) &&
    /\.rag-status-toast\s*{[\s\S]*z-index:\s*var\(--z-toast\);/.test(css),
  'Shell z-index selectors are not mapped to layering tokens.',
);

rule(
  'Glass contract: topbar/panel/drawer/scrim include backdrop-filter + -webkit-backdrop-filter',
  /\.topbar\s*{[\s\S]*-webkit-backdrop-filter:\s*blur\([^)]+\);[\s\S]*backdrop-filter:\s*blur\([^)]+\);/.test(css) &&
    /\.panel-shell,\s*[\s\S]*?\.card\s*{[\s\S]*-webkit-backdrop-filter:\s*blur\([^)]+\);[\s\S]*backdrop-filter:\s*blur\([^)]+\);/.test(
      css,
    ) &&
    /\.drawer\s*{[\s\S]*-webkit-backdrop-filter:\s*blur\([^)]+\);[\s\S]*backdrop-filter:\s*blur\([^)]+\);/.test(css) &&
    /\.scrim\s*{[\s\S]*-webkit-backdrop-filter:\s*blur\([^)]+\);[\s\S]*backdrop-filter:\s*blur\([^)]+\);/.test(css),
  'Glass surfaces must define both backdrop-filter and -webkit-backdrop-filter for cross-browser consistency.',
);

rule(
  'Responsive: library and settings collapse on narrow screens',
  /@media\s*\(max-width:\s*980px\)\s*{[\s\S]*\.rag-dashboard-body\s*{[\s\S]*flex-direction:\s*column;[\s\S]*\.ds-settings-shell-inner\s*{[\s\S]*flex-direction:\s*column;/.test(
    css,
  ),
  'Responsive library/settings collapse rules not found.',
);

rule(
  'CSS hygiene: unused legacy sidebar-subtab classes are removed',
  !css.includes('.sidebar-subtabs') && !css.includes('.sidebar-subtab'),
  'Dead legacy classes .sidebar-subtabs/.sidebar-subtab must be removed from styles.css.',
);

const dependencyChecks = [
  ['side-action-btn', 'icon-btn'],
  ['char-config-icon-action', 'icon-btn'],
  ['lorebook-setting-action-btn', 'icon-btn'],
  ['regex-list-action-btn', 'icon-btn'],
  ['ds-settings-icon-action', 'icon-btn'],
  ['rag-action-btn', 'icon-btn'],
  ['char-config-icon-remove-button', 'icon-btn'],
  ['trigger-v1-list-add-btn', 'icon-btn'],
  ['rag-status-cancel', 'icon-btn'],
  ['rag-tree-toggle', 'icon-btn'],
  ['char-config-subtab', 'seg-tab'],
  ['lorebook-setting-tab', 'seg-tab'],
  ['ds-settings-tab', 'seg-tab'],
  ['sidebar-group-btn', 'seg-tab'],
  ['sidebar-mode-btn', 'seg-tab'],
  ['trigger-list-mode-btn', 'seg-tab'],
  ['sidebar-tab-strip', 'seg-tabs'],
  ['trigger-list-mode-row', 'seg-tabs'],
  ['lorebook-list-root', 'list-shell'],
  ['regex-list-container', 'list-shell'],
  ['trigger-v1-list-container', 'list-shell'],
  ['rag-rulebook-container', 'list-shell'],
  ['ds-settings-list-container', 'list-shell'],
  ['ds-settings-empty-state', 'empty-state'],
  ['lorebook-list-empty', 'empty-state'],
  ['rag-empty', 'empty-state'],
  ['rag-empty-state', 'empty-state'],
  ['ds-ui-action-rail', 'action-rail'],
  ['character-card', 'panel-shell'],
  ['playground-tool-card', 'panel-shell'],
  ['playground-doc-card', 'panel-shell'],
  ['playground-asset-card', 'panel-shell'],
  ['char-config-card', 'panel-shell'],
  ['ds-settings-card', 'panel-shell'],
  ['rag-status-card', 'panel-shell'],
  ['rag-system-item', 'item-btn'],
  ['rag-system-name', 'item-btn'],
  ['rag-edition-item', 'item-btn'],
  ['side-chat-empty', 'empty-state'],
  ['regex-list-empty', 'empty-state'],
  ['trigger-v1-list-empty', 'empty-state'],
  ['regex-list-actions', 'action-rail'],
  ['rag-book-actions', 'action-rail'],
  ['sidebar-select', 'control-field'],
  ['char-config-control', 'control-field'],
  ['playground-control', 'control-field'],
  ['ds-settings-control', 'control-field'],
  ['ds-settings-hotkey-key-input', 'control-field'],
];

for (const [className, requiredClass] of dependencyChecks) {
  rule(
    `Primitive dependency: ${className} includes ${requiredClass}`,
    hasClassDependency(html, className, requiredClass) && hasClassDependency(js, className, requiredClass),
    `At least one ${className} usage does not include ${requiredClass}.`,
  );
}

if (failures.length > 0) {
  console.error('FAIL check-design-rules');
  for (const failure of failures) {
    console.error(`  - ${failure.name}: ${failure.details}`);
  }
  process.exit(1);
}

console.log('PASS check-design-rules: design rule contract checks passed');
