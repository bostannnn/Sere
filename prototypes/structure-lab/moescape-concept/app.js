const { characters, chats, rulebooks } = window.StructureLabData;

const globalMenuBtn = document.getElementById('globalMenuBtn');
const closeGlobalDrawerBtn = document.getElementById('closeGlobalDrawerBtn');
const globalDrawer = document.getElementById('globalDrawer');

const titleHomeBtn = document.getElementById('titleHomeBtn');
const topSidebarBtn = document.getElementById('topSidebarBtn');

const homeView = document.getElementById('homeView');
const chatView = document.getElementById('chatView');
const libraryView = document.getElementById('libraryView');
const playgroundView = document.getElementById('playgroundView');
const settingsView = document.getElementById('settingsView');
const topbarSubtitle = document.getElementById('topbarSubtitle');

const shellSearchInput = document.getElementById('shellSearchInput');
const characterGrid = document.getElementById('characterGrid');

const closeContextDrawerBtn = document.getElementById('closeContextDrawerBtn');
const contextDrawer = document.getElementById('contextDrawer');
const sidebarProfileAvatar = document.getElementById('sidebarProfileAvatar');
const sidebarProfileName = document.getElementById('sidebarProfileName');
const sidebarProfileArchetype = document.getElementById('sidebarProfileArchetype');
const sidebarProfileChat = document.getElementById('sidebarProfileChat');
const sidebarModeStrip = document.getElementById('sidebarModeStrip');
const sidebarContent = document.getElementById('sidebarContent');

const chatTitle = document.getElementById('chatTitle');
const chatMeta = document.getElementById('chatMeta');
const messageList = document.getElementById('messageList');
const composerInput = document.getElementById('composerInput');
const sendBtn = document.getElementById('sendBtn');

const librarySystemList = document.getElementById('librarySystemList');
const libraryStats = document.getElementById('libraryStats');
const libraryToolbarInfo = document.getElementById('libraryToolbarInfo');
const libraryGridBtn = document.getElementById('libraryGridBtn');
const libraryListBtn = document.getElementById('libraryListBtn');
const libraryContentArea = document.getElementById('libraryContentArea');
const settingsNavPanel = document.getElementById('settingsNavPanel');
const settingsContentPanel = document.getElementById('settingsContentPanel');
const globalRecentChatsList = document.getElementById('globalRecentChatsList');
const playgroundContent = document.getElementById('playgroundContent');

const scrim = document.getElementById('scrim');

const SIDEBAR_TABS = [
  { key: 'chats', label: 'Chats', icon: 'chat' },
  { key: 'basic', label: 'Basics', icon: 'user' },
  { key: 'display', label: 'Display', icon: 'image' },
  { key: 'lorebook', label: 'Lorebook', icon: 'book' },
  { key: 'voice', label: 'Voice', icon: 'audio' },
  { key: 'scripts', label: 'Scripts', icon: 'code' },
  { key: 'advanced', label: 'Advanced', icon: 'sliders' },
  { key: 'gamestate', label: 'GameState', icon: 'database' },
  { key: 'share', label: 'Share', icon: 'share' },
];

const SIDEBAR_MODES = [
  { key: 'chat', label: 'Chat', tabs: ['chats'] },
  { key: 'character', label: 'Character', tabs: ['basic', 'display', 'lorebook', 'voice', 'scripts', 'advanced'] },
  { key: 'state', label: 'State', tabs: ['gamestate', 'share'] },
];

const TAB_TO_MODE = Object.fromEntries(
  SIDEBAR_MODES.flatMap((mode) => mode.tabs.map((tab) => [tab, mode.key])),
);

const TAB_ICONS = {
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16v10H8l-4 4z"/></svg>',
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="M21 16l-5-5-6 6-3-3-4 4"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h7a3 3 0 0 1 3 3v11H7a3 3 0 0 0-3 3z"/><path d="M20 5h-7a3 3 0 0 0-3 3v11h7a3 3 0 0 1 3 3z"/></svg>',
  audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14h4l5 4V6l-5 4H5z"/><path d="M16 9c1.2 1 1.2 5 0 6"/><path d="M18.5 7c2.5 2 2.5 8 0 10"/></svg>',
  code: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l-4 4 4 4"/><path d="M16 8l4 4-4 4"/><path d="M14 4l-4 16"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h6"/><path d="M14 6h6"/><circle cx="12" cy="6" r="2"/><path d="M4 12h2"/><path d="M10 12h10"/><circle cx="8" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/></svg>',
  database: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.8l6.8-3.6"/><path d="M8.6 13.2l6.8 3.6"/></svg>',
};

const SETTINGS_ICONS = {
  bot: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6"/><path d="M12 3v3"/><rect x="5" y="6" width="14" height="12" rx="3"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><path d="M9 16h6"/></svg>',
  persona: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6"/></svg>',
  otherBots: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h8l4-6v12l-4-6z"/><path d="M15 12h6"/></svg>',
  display: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>',
  language: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3 3 15 0 18"/><path d="M12 3c-3 3-3 15 0 18"/></svg>',
  accessibility: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="4.5" r="1.5"/><path d="M7 8h10"/><path d="M12 8v12"/><path d="M8.5 20l3.5-5 3.5 5"/><path d="M8.5 12l3.5 2.5 3.5-2.5"/></svg>',
  modules: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>',
  plugin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6a2 2 0 1 1 4 0v2h2a2 2 0 1 1 0 4h-2v2a2 2 0 1 1-4 0v-2H8a2 2 0 1 1 0-4h2z"/></svg>',
  hotkey: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h1"/><path d="M9 10h1"/><path d="M12 10h1"/><path d="M15 10h1"/><path d="M6 14h12"/></svg>',
  advanced: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h4"/><path d="M10 18h10"/><circle cx="9" cy="18" r="1.5"/><path d="M4 12h10"/><path d="M16 12h4"/><circle cx="14" cy="12" r="1.5"/><path d="M4 6h6"/><path d="M12 6h8"/><circle cx="11" cy="6" r="1.5"/></svg>',
};

const SETTINGS_MENU = [
  { index: 1, label: 'Chat Bot', icon: 'bot' },
  { index: 12, label: 'Persona', icon: 'persona' },
  { index: 2, label: 'Other Bots', icon: 'otherBots' },
  { index: 3, label: 'Display', icon: 'display' },
  { index: 10, label: 'Language', icon: 'language' },
  { index: 11, label: 'Accessibility', icon: 'accessibility' },
  { index: 14, label: 'Modules', icon: 'modules' },
  { index: 4, label: 'Plugin', icon: 'plugin' },
  { index: 15, label: 'Hotkey', icon: 'hotkey' },
  { index: 6, label: 'Advanced Settings', icon: 'advanced' },
];

const SETTINGS_SUBMENUS = {
  chatBot: [
    { id: 0, label: 'Model' },
    { id: 1, label: 'Parameters' },
    { id: 2, label: 'Prompt' },
  ],
  prompt: [
    { id: 0, label: 'Template' },
    { id: 1, label: 'Settings' },
  ],
  display: [
    { id: 0, label: 'Theme' },
    { id: 1, label: 'Size and Speed' },
    { id: 2, label: 'Others' },
  ],
  otherBots: [
    { id: 0, label: 'Long Term Memory' },
    { id: 1, label: 'TTS' },
    { id: 2, label: 'Emotion Image' },
  ],
};

const SETTINGS_SUBTAB_DEFAULTS = {
  chatBot: 0,
  prompt: 0,
  otherBots: 0,
  display: 0,
};

const COLOR_SCHEMES = {
  default: {
    label: 'Default',
    bgcolor: '#282a36',
    darkbg: '#21222c',
    borderc: '#6272a4',
    selected: '#44475a',
    draculared: '#ff5555',
    textcolor: '#f8f8f2',
    textcolor2: '#64748b',
    darkBorderc: '#4b5563',
    darkbutton: '#374151',
    type: 'dark',
  },
  dark: {
    label: 'Dark',
    bgcolor: '#1a1a1a',
    darkbg: '#141414',
    borderc: '#525252',
    selected: '#3d3d3d',
    draculared: '#ff5555',
    textcolor: '#f5f5f5',
    textcolor2: '#a3a3a3',
    darkBorderc: '#404040',
    darkbutton: '#2e2e2e',
    type: 'dark',
  },
  light: {
    label: 'Light',
    bgcolor: '#ffffff',
    darkbg: '#f0f0f0',
    borderc: '#0f172a',
    selected: '#e0e0e0',
    draculared: '#ff5555',
    textcolor: '#0f172a',
    textcolor2: '#64748b',
    darkBorderc: '#d1d5db',
    darkbutton: '#e5e7eb',
    type: 'light',
  },
  cherry: {
    label: 'Cherry',
    bgcolor: '#450a0a',
    darkbg: '#7f1d1d',
    borderc: '#ea580c',
    selected: '#d97706',
    draculared: '#ff5555',
    textcolor: '#f8f8f2',
    textcolor2: '#fca5a5',
    darkBorderc: '#92400e',
    darkbutton: '#b45309',
    type: 'dark',
  },
  galaxy: {
    label: 'Galaxy',
    bgcolor: '#0f172a',
    darkbg: '#1f2a48',
    borderc: '#8be9fd',
    selected: '#457b9d',
    draculared: '#ff5555',
    textcolor: '#f8f8f2',
    textcolor2: '#8be9fd',
    darkBorderc: '#457b9d',
    darkbutton: '#1f2a48',
    type: 'dark',
  },
  nature: {
    label: 'Nature',
    bgcolor: '#1b4332',
    darkbg: '#2d6a4f',
    borderc: '#a8dadc',
    selected: '#4d908e',
    draculared: '#ff5555',
    textcolor: '#f8f8f2',
    textcolor2: '#4d908e',
    darkBorderc: '#457b9d',
    darkbutton: '#2d6a4f',
    type: 'dark',
  },
  realblack: {
    label: 'Real Black',
    bgcolor: '#000000',
    darkbg: '#000000',
    borderc: '#6272a4',
    selected: '#44475a',
    draculared: '#ff5555',
    textcolor: '#f8f8f2',
    textcolor2: '#64748b',
    darkBorderc: '#4b5563',
    darkbutton: '#374151',
    type: 'dark',
  },
  'monokai-light': {
    label: 'Monokai Light',
    bgcolor: '#f8f8f2',
    darkbg: '#e8e8e3',
    borderc: '#75715e',
    selected: '#d8d8d0',
    draculared: '#f92672',
    textcolor: '#272822',
    textcolor2: '#75715e',
    darkBorderc: '#c0c0b8',
    darkbutton: '#d0d0c8',
    type: 'light',
  },
  'monokai-black': {
    label: 'Monokai Black',
    bgcolor: '#272822',
    darkbg: '#1e1f1a',
    borderc: '#75715e',
    selected: '#3e3d32',
    draculared: '#f92672',
    textcolor: '#f8f8f2',
    textcolor2: '#a6a68a',
    darkBorderc: '#3e3d32',
    darkbutton: '#3e3d32',
    type: 'dark',
  },
  lite: {
    label: 'Lite',
    bgcolor: '#1f2937',
    darkbg: '#1c2533',
    borderc: '#475569',
    selected: '#475569',
    draculared: '#ff5555',
    textcolor: '#f8f8f2',
    textcolor2: '#64748b',
    darkBorderc: '#030712',
    darkbutton: '#374151',
    type: 'dark',
  },
};
const COLOR_SCHEME_KEYS = Object.keys(COLOR_SCHEMES);
const COLOR_SCHEME_OPTIONS = COLOR_SCHEME_KEYS.map((key) => ({ value: key, label: COLOR_SCHEMES[key].label }));

const SETTINGS_ADVANCED_INPUTS = [
  'loreBookDepth',
  'loreBookToken',
  'autoContinueMinTokens',
  'additionalPrompt',
  'descriptionPrefix',
  'requestretrys',
  'genTimes',
];

const SETTINGS_ADVANCED_TOGGLES = [
  'useSayNothing',
  'showUnrecommended',
  'imageCompression',
  'useExperimental',
  'autoContinueChat',
  'removeIncompleteResponse',
  'dynamicAssets',
  'enableDevTools',
  'enableBookmark',
  'pluginDevelopMode',
];

const SETTINGS_ACCESSIBILITY_TOGGLES = [
  'askRemoval',
  'SwipeRegenerate',
  'instantRemove',
  'sendWithEnter',
  'fixedChatTextarea',
  'clickToEdit',
  'botSettingAtStart',
  'showMenuChatList',
  'showMenuHypaMemoryModal',
  'sideMenuRerollButton',
  'localActivationInGlobalLorebook',
  'requestInfoInsideChat',
  'inlayErrorResponse',
  'bulkEnabling',
  'showTranslationLoading',
  'autoScrollToNewMessage',
  'createFolderOnBranch',
];

const HOTKEY_ROWS = [
  { action: 'reroll', ctrl: true, alt: true, shift: false, key: 'R' },
  { action: 'unreroll', ctrl: true, alt: true, shift: false, key: 'F' },
  { action: 'translate', ctrl: true, alt: true, shift: false, key: 'T' },
  { action: 'remove', ctrl: true, alt: true, shift: false, key: 'D' },
  { action: 'edit', ctrl: true, alt: true, shift: false, key: 'E' },
  { action: 'copy', ctrl: true, alt: true, shift: false, key: 'C' },
  { action: 'send', ctrl: true, alt: true, shift: false, key: 'ENTER' },
  { action: 'settings', ctrl: true, alt: false, shift: false, key: 'S' },
  { action: 'home', ctrl: true, alt: false, shift: false, key: 'H' },
  { action: 'presets', ctrl: true, alt: false, shift: false, key: 'P' },
  { action: 'persona', ctrl: true, alt: false, shift: false, key: 'E' },
  { action: 'toggleCSS', ctrl: true, alt: false, shift: false, key: '.' },
  { action: 'prevChar', ctrl: true, alt: false, shift: false, key: '[' },
  { action: 'nextChar', ctrl: true, alt: false, shift: false, key: ']' },
  { action: 'quickMenu', ctrl: true, alt: false, shift: false, key: '`' },
  { action: 'quickSettings', ctrl: true, alt: false, shift: false, key: 'Q' },
  { action: 'toggleLog', ctrl: true, alt: false, shift: false, key: 'L' },
  { action: 'previewRequest', ctrl: true, alt: false, shift: false, key: 'U' },
  { action: 'focusInput', ctrl: false, alt: false, shift: false, key: 'SPACE' },
  { action: 'scrollToActiveChar', ctrl: true, alt: false, shift: false, key: 'G' },
];

const PLAYGROUND_TOOLS = [
  { key: 'chat', label: 'Chat', wide: true },
  { key: 'docs', label: 'CBS Doc' },
  { key: 'embedding', label: 'Embedding' },
  { key: 'tokenizer', label: 'Tokenizer' },
  { key: 'syntax', label: 'Syntax' },
  { key: 'parser', label: 'Parser' },
  { key: 'subtitles', label: 'Subtitles' },
  { key: 'imageTranslation', label: 'Image Translation' },
  { key: 'translator', label: 'Translator' },
  { key: 'mcp', label: 'MCP' },
  { key: 'inlayExplorer', label: 'Inlay Assets Explorer' },
];

const CONTEXT_DRAWER_PREF_KEY = 'moescape.contextDrawerOpen';
const COLOR_SCHEME_PREF_KEY = 'moescape.colorScheme';
const DEFAULT_CHARACTER_IMAGE_SRC = './assets/char.png';
const DEFAULT_EMOTION_IMAGE_SRC = './assets/emotion.png';

let selectedSidebarTab = 'chats';
let selectedSidebarMode = TAB_TO_MODE[selectedSidebarTab] ?? SIDEBAR_MODES[0].key;
let sidebarChatQuery = '';
let sidebarDisplayViewSubmenu = 0;
let sidebarLorebookSubmenu = 0;
let sidebarTriggerMode = 'v1';
let sidebarViewScreenMode = 'none';
let sidebarVoiceMode = '';
let selectedCharacterId = characters[0]?.id ?? null;
let selectedWorkspaceView = 'characters';
let selectedSettingsMenuIndex = 1;
let settingsActiveSubtab = { ...SETTINGS_SUBTAB_DEFAULTS };
let selectedPlaygroundTool = 'menu';
let selectedColorSchemeName = 'default';

let homeSearchQuery = '';
let librarySearchQuery = '';
let libraryViewMode = 'grid';
let selectedSystemFilter = 'All';
let selectedEditionFilter = 'All';
let expandedSystems = new Set(['Unknown']);
let editingLibraryBookId = null;
let editingLibraryBookDraft = { name: '', system: '', edition: '' };
let libraryBooks = rulebooks.map((book) => ({
  id: book.id,
  name: book.name,
  chunkCount: 0,
  metadata: {
    system: 'Unknown',
    edition: 'Standard',
  },
  priority: 0,
}));

const lastChatByCharacter = Object.fromEntries(
  characters.map((character) => {
    const firstChat = chats.find((chat) => chat.characterId === character.id);
    return [character.id, firstChat?.id ?? null];
  }),
);

let selectedChatId = lastChatByCharacter[selectedCharacterId] ?? null;
let contextDrawerPreferredOpen = false;
let shellSearchMode = 'hidden';

try {
  contextDrawerPreferredOpen = sessionStorage.getItem(CONTEXT_DRAWER_PREF_KEY) === '1';
} catch (error) {
  contextDrawerPreferredOpen = false;
}

const quickReplies = [
  'Can you make this scene more tense?',
  'Continue with shorter paragraphs.',
  'Shift to first-person this turn.',
  'Summarize this interaction for memory.',
  'Retrieve relevant lorebook context.',
];

const SHELL_SEARCH_CONFIG = {
  home: {
    placeholder: 'Search characters',
    getValue: () => homeSearchQuery,
    onInput: (value) => {
      homeSearchQuery = value;
      renderCharacterGrid();
    },
  },
  library: {
    placeholder: 'Search by name, system, or edition...',
    getValue: () => librarySearchQuery,
    onInput: (value) => {
      librarySearchQuery = value;
      renderLibraryContentArea();
    },
  },
};

function escapeHtml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlToFragment(markup) {
  const template = document.createElement('template');
  // Rule #6 exception: this leaf parser uses template.innerHTML only to build a fragment for replaceChildren().
  template.innerHTML = markup;
  return template.content;
}

function replaceMarkup(target, markup) {
  if (!target) return;
  const html = typeof markup === 'string' ? markup.trim() : '';
  if (html) target.replaceChildren(htmlToFragment(html));
  else target.replaceChildren();
}

function normalizeHexColor(color) {
  const value = String(color || '').trim();
  const short = value.match(/^#([0-9a-f]{3})$/i);
  if (short) {
    return `#${short[1]
      .split('')
      .map((char) => `${char}${char}`)
      .join('')}`;
  }
  return /^#([0-9a-f]{6})$/i.test(value) ? value.toLowerCase() : '#000000';
}

function hexToRgbTuple(color) {
  const hex = normalizeHexColor(color).slice(1);
  return [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function rgbTupleToHex([r, g, b]) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(colorA, colorB, ratioB) {
  const clamped = Math.max(0, Math.min(1, Number(ratioB) || 0));
  const rgbA = hexToRgbTuple(colorA);
  const rgbB = hexToRgbTuple(colorB);
  const mixed = rgbA.map((channel, index) => channel * (1 - clamped) + rgbB[index] * clamped);
  return rgbTupleToHex(mixed);
}

function rgbaFromHex(color, alpha = 1) {
  const [r, g, b] = hexToRgbTuple(color);
  const clamped = Math.max(0, Math.min(1, Number(alpha) || 0));
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

const PALETTE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

function buildRamp(base, textAnchor, darkAnchor) {
  const normalizedBase = normalizeHexColor(base);
  return {
    50: mixHex(normalizedBase, textAnchor, 0.08),
    100: mixHex(normalizedBase, textAnchor, 0.16),
    200: mixHex(normalizedBase, textAnchor, 0.3),
    300: mixHex(normalizedBase, textAnchor, 0.46),
    400: mixHex(normalizedBase, textAnchor, 0.68),
    500: normalizedBase,
    600: mixHex(normalizedBase, darkAnchor, 0.14),
    700: mixHex(normalizedBase, darkAnchor, 0.28),
    800: mixHex(normalizedBase, darkAnchor, 0.44),
    900: mixHex(normalizedBase, darkAnchor, 0.58),
  };
}

function buildNeutralRamp(scheme, darkMode) {
  if (darkMode) {
    return {
      50: mixHex(scheme.textcolor, '#ffffff', 0.08),
      100: mixHex(scheme.textcolor, scheme.darkbg, 0.12),
      200: mixHex(scheme.textcolor, scheme.darkbg, 0.22),
      300: mixHex(scheme.textcolor, scheme.darkbg, 0.35),
      400: mixHex(scheme.textcolor2, scheme.darkbg, 0.12),
      500: normalizeHexColor(scheme.textcolor2),
      600: mixHex(scheme.textcolor2, scheme.darkbg, 0.26),
      700: mixHex(scheme.textcolor2, scheme.darkbg, 0.4),
      800: mixHex(scheme.darkbutton, scheme.darkbg, 0.34),
      900: mixHex(scheme.darkbg, '#000000', 0.44),
    };
  }
  return {
    50: mixHex(scheme.bgcolor, '#ffffff', 0.5),
    100: mixHex(scheme.bgcolor, '#ffffff', 0.34),
    200: mixHex(scheme.darkbg, '#ffffff', 0.22),
    300: mixHex(scheme.darkbg, '#000000', 0.04),
    400: mixHex(scheme.textcolor2, '#ffffff', 0.12),
    500: normalizeHexColor(scheme.textcolor2),
    600: mixHex(scheme.textcolor2, '#000000', 0.2),
    700: mixHex(scheme.textcolor, '#000000', 0.08),
    800: mixHex(scheme.textcolor, '#000000', 0.16),
    900: normalizeHexColor(scheme.textcolor),
  };
}

function applyRampTokens(root, family, ramp) {
  for (const step of PALETTE_STEPS) {
    const value = ramp[step];
    root.style.setProperty(`--theme-${family}-${step}`, value);
    root.style.setProperty(`--color-${family}-${step}`, value);
  }
}

function resolveColorSchemeName(name) {
  return COLOR_SCHEME_KEYS.includes(name) ? name : 'default';
}

function readColorSchemePreference() {
  try {
    return resolveColorSchemeName(sessionStorage.getItem(COLOR_SCHEME_PREF_KEY));
  } catch (error) {
    return 'default';
  }
}

function persistColorSchemePreference(name) {
  try {
    sessionStorage.setItem(COLOR_SCHEME_PREF_KEY, name);
  } catch (error) {
    // noop
  }
}

function applyColorScheme(name, { persist = true } = {}) {
  const resolvedName = resolveColorSchemeName(name);
  selectedColorSchemeName = resolvedName;
  if (persist) persistColorSchemePreference(resolvedName);

  const scheme = COLOR_SCHEMES[resolvedName];
  if (!scheme || !document.documentElement) return;
  const root = document.documentElement;
  const darkMode = scheme.type === 'dark';
  const accentRgb = hexToRgbTuple(scheme.borderc).join(', ');
  const primaryRamp = buildRamp(scheme.borderc, scheme.textcolor, scheme.darkbg);
  const successRamp = buildRamp(scheme.selected, scheme.textcolor, scheme.darkbg);
  const dangerRamp = buildRamp(scheme.draculared, scheme.textcolor, scheme.darkbg);
  const secondaryBase = mixHex('#8b5cf6', scheme.borderc, darkMode ? 0.22 : 0.14);
  const secondaryRamp = buildRamp(secondaryBase, scheme.textcolor, scheme.darkbg);
  const warningBase = mixHex('#d97706', scheme.borderc, darkMode ? 0.1 : 0.06);
  const warningRamp = buildRamp(warningBase, scheme.textcolor, scheme.darkbg);
  const neutralRamp = buildNeutralRamp(scheme, darkMode);

  const bgA = darkMode ? mixHex(scheme.bgcolor, '#ffffff', 0.08) : mixHex(scheme.bgcolor, '#ffffff', 0.22);
  const bgB = darkMode ? mixHex(scheme.darkbg, '#000000', 0.12) : mixHex(scheme.darkbg, '#ffffff', 0.1);
  const surfaceTopbar = darkMode ? rgbaFromHex(scheme.darkbg, 0.72) : 'rgba(255, 255, 255, 0.72)';
  const surface = darkMode ? rgbaFromHex(scheme.bgcolor, 0.72) : 'rgba(255, 255, 255, 0.58)';
  const surfaceRaised = darkMode ? rgbaFromHex(scheme.darkbutton, 0.84) : 'rgba(255, 255, 255, 0.78)';
  const surfaceOverlay = darkMode ? rgbaFromHex(scheme.darkbg, 0.93) : 'rgba(255, 255, 255, 0.94)';
  const surfaceRecessed = darkMode ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.06)';
  const dsSurfaceActive = rgbaFromHex(scheme.borderc, darkMode ? 0.3 : 0.16);
  const textPrimary = darkMode ? neutralRamp[100] : neutralRamp[900];
  const textSecondary = darkMode ? neutralRamp[400] : neutralRamp[600];
  const borderSubtle = darkMode ? rgbaFromHex(neutralRamp[600], 0.7) : rgbaFromHex(neutralRamp[300], 0.58);
  const borderStrong = darkMode ? rgbaFromHex(primaryRamp[500], 0.72) : rgbaFromHex(primaryRamp[500], 0.5);

  applyRampTokens(root, 'primary', primaryRamp);
  applyRampTokens(root, 'secondary', secondaryRamp);
  applyRampTokens(root, 'danger', dangerRamp);
  applyRampTokens(root, 'success', successRamp);
  applyRampTokens(root, 'neutral', neutralRamp);
  applyRampTokens(root, 'warning', warningRamp);

  root.style.setProperty('--bg', scheme.bgcolor);
  root.style.setProperty('--panel', scheme.darkbg);
  root.style.setProperty('--panel-alt', scheme.darkbutton);
  root.style.setProperty('--line', neutralRamp[300]);
  root.style.setProperty('--line-strong', primaryRamp[500]);
  root.style.setProperty('--text', textPrimary);
  root.style.setProperty('--muted', textSecondary);
  root.style.setProperty('--accent', primaryRamp[500]);
  root.style.setProperty('--accent-soft', scheme.selected);
  root.style.setProperty('--warn', warningRamp[700]);
  root.style.setProperty('--accent-rgb', accentRgb);

  root.style.setProperty('--bg-a', bgA);
  root.style.setProperty('--bg-b', bgB);
  root.style.setProperty('--surface-topbar', surfaceTopbar);
  root.style.setProperty('--surface', surface);
  root.style.setProperty('--surface-raised', surfaceRaised);
  root.style.setProperty('--surface-overlay', surfaceOverlay);
  root.style.setProperty('--surface-recessed', surfaceRecessed);
  root.style.setProperty('--ink', textPrimary);
  root.style.setProperty('--ink-soft', textSecondary);
  root.style.setProperty('--line-soft', borderSubtle);
  root.style.setProperty('--accent-strong', primaryRamp[500]);

  root.style.setProperty('--ds-surface-1', mixHex(scheme.bgcolor, darkMode ? '#ffffff' : '#000000', darkMode ? 0.05 : 0.02));
  root.style.setProperty('--ds-surface-2', mixHex(scheme.darkbg, darkMode ? '#ffffff' : '#000000', darkMode ? 0.1 : 0.04));
  root.style.setProperty('--ds-surface-3', mixHex(scheme.darkbutton, darkMode ? '#ffffff' : '#000000', darkMode ? 0.12 : 0.08));
  root.style.setProperty('--ds-surface-active', dsSurfaceActive);
  root.style.setProperty('--ds-text-primary', textPrimary);
  root.style.setProperty('--ds-text-secondary', textSecondary);
  root.style.setProperty('--ds-border-subtle', borderSubtle);
  root.style.setProperty('--ds-border-strong', borderStrong);
  root.style.setProperty('--ds-text-danger', dangerRamp[600]);
  root.style.setProperty('--ds-text-success', successRamp[600]);
  root.style.setProperty('--ds-text-warning', warningRamp[700]);
  root.style.setProperty('--ds-text-warning-rgb', hexToRgbTuple(warningRamp[700]).join(', '));
  root.style.setProperty(
    '--avatar-placeholder-bg',
    `linear-gradient(140deg, ${mixHex(scheme.darkbutton, '#ffffff', darkMode ? 0.18 : 0.04)}, ${mixHex(scheme.selected, '#ffffff', darkMode ? 0.12 : 0.02)})`,
  );
  root.style.setProperty('--folder-blue-gradient', `linear-gradient(120deg, ${rgbaFromHex(primaryRamp[200], 0.55)}, ${rgbaFromHex(primaryRamp[100], 0.36)})`);
  root.style.setProperty(
    '--folder-purple-gradient',
    `linear-gradient(120deg, ${rgbaFromHex(secondaryRamp[300], 0.5)}, ${rgbaFromHex(secondaryRamp[100], 0.34)})`,
  );
  root.style.setProperty('--scrim-bg', darkMode ? 'rgba(0, 0, 0, 0.52)' : 'rgba(0, 0, 0, 0.18)');
  root.style.setProperty('--chat-assistant-bg', darkMode ? rgbaFromHex(scheme.darkbutton, 0.78) : 'rgba(255, 255, 255, 0.92)');
  root.style.setProperty('--chat-user-bg', rgbaFromHex(primaryRamp[500], darkMode ? 0.26 : 0.16));
}

function setShellSearchMode(mode) {
  if (!shellSearchInput) return;
  const config = SHELL_SEARCH_CONFIG[mode];
  if (!config) {
    shellSearchMode = 'hidden';
    shellSearchInput.classList.add('hidden');
    shellSearchInput.placeholder = 'Search';
    shellSearchInput.value = '';
    return;
  }

  shellSearchMode = mode;
  shellSearchInput.classList.remove('hidden');
  shellSearchInput.placeholder = config.placeholder;
  shellSearchInput.value = config.getValue();
}

function chatsForCharacter(characterId) {
  return chats.filter((chat) => chat.characterId === characterId);
}

function characterImageSrc(character) {
  const src = character?.avatar;
  if (typeof src === 'string' && src.trim()) return src.trim();
  return DEFAULT_CHARACTER_IMAGE_SRC;
}

function parseRelativeAgeToMinutes(updatedAt) {
  const value = String(updatedAt || '').trim().toLowerCase();
  if (!value) return Number.POSITIVE_INFINITY;
  if (value === 'now' || value === 'just now') return 0;
  const match = value.match(/^(\d+)\s*([mhd])\s*ago$/);
  if (!match) return Number.POSITIVE_INFINITY;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return Number.POSITIVE_INFINITY;
  if (match[2] === 'm') return amount;
  if (match[2] === 'h') return amount * 60;
  return amount * 1440;
}

function recentChats(limit = 5) {
  return [...chats]
    .sort((a, b) => {
      const aAge = parseRelativeAgeToMinutes(a.updatedAt);
      const bAge = parseRelativeAgeToMinutes(b.updatedAt);
      if (aAge !== bAge) return aAge - bAge;
      return b.turns - a.turns;
    })
    .slice(0, limit);
}

function renderGlobalRecentChats() {
  if (!globalRecentChatsList) return;
  const rows = recentChats(5);
  const markup = rows
    .map((chat) => {
      const character = characters.find((item) => item.id === chat.characterId);
      return `
        <button class="item-btn global-recent-chat ${chat.id === selectedChatId ? 'active' : ''}" data-global-chat-id="${chat.id}">
          <span class="global-recent-chat-title">${escapeHtml(chat.title)}</span>
          <span class="small-muted">${escapeHtml(character?.name ?? 'Unknown')} • ${escapeHtml(chat.updatedAt)}</span>
        </button>
      `;
    })
    .join('');
  replaceMarkup(globalRecentChatsList, markup);
}

function buildFakeThread(chat) {
  const name = characters.find((character) => character.id === chat.characterId)?.name ?? 'Character';
  return [
    {
      id: `${chat.id}-m1`,
      role: 'user',
      content: `Open ${chat.title.toLowerCase()} and continue the current thread.`,
      time: '20:41',
    },
    {
      id: `${chat.id}-m2`,
      role: 'assistant',
      content: `${name} picks up the thread from the last beat, keeping continuity with: ${chat.preview}`,
      time: '20:41',
    },
    {
      id: `${chat.id}-m3`,
      role: 'user',
      content: quickReplies[(chat.turns + chat.unread) % quickReplies.length],
      time: '20:42',
    },
    {
      id: `${chat.id}-m4`,
      role: 'assistant',
      content: 'Applied. I kept the same mood, tightened pacing, and preserved prior context in this response.',
      time: '20:42',
    },
  ];
}

const threadByChatId = Object.fromEntries(chats.map((chat) => [chat.id, buildFakeThread(chat)]));

function syncScrim() {
  if (!scrim) return;
  const anyOpen = [globalDrawer, contextDrawer]
    .filter(Boolean)
    .some((drawer) => drawer.classList.contains('open'));
  scrim.classList.toggle('hidden', !anyOpen);
}

function setContextDrawerPreference(isOpen) {
  contextDrawerPreferredOpen = isOpen;
  try {
    sessionStorage.setItem(CONTEXT_DRAWER_PREF_KEY, isOpen ? '1' : '0');
  } catch (error) {
    // noop
  }
}

function openDrawer(drawer) {
  if (!drawer) return;
  if (drawer === globalDrawer) renderGlobalRecentChats();
  drawer.classList.add('open');
  if (drawer === contextDrawer) setContextDrawerPreference(true);
  syncScrim();
}

function closeDrawer(drawer) {
  if (!drawer) return;
  drawer.classList.remove('open');
  if (drawer === contextDrawer) setContextDrawerPreference(false);
  syncScrim();
}

function toggleDrawer(drawer) {
  if (!drawer) return;
  if (drawer.classList.contains('open')) {
    closeDrawer(drawer);
    return;
  }

  if (drawer === globalDrawer) closeDrawer(contextDrawer);
  else closeDrawer(globalDrawer);

  openDrawer(drawer);
}

function closeAllDrawers() {
  closeDrawer(globalDrawer);
  closeDrawer(contextDrawer);
}

const TOP_LEVEL_VIEW_REFS = [
  ['homeView', homeView],
  ['chatView', chatView],
  ['libraryView', libraryView],
  ['playgroundView', playgroundView],
  ['settingsView', settingsView],
];

function handleMissingTopLevelViews(source, targetView) {
  const missing = TOP_LEVEL_VIEW_REFS.filter(([, element]) => !element).map(([name]) => name);
  if (!missing.length) return false;
  console.warn(`[${source}] missing top-level view refs: ${missing.join(', ')}`);
  TOP_LEVEL_VIEW_REFS.forEach(([, element]) => element?.classList.add('hidden'));
  targetView?.classList.remove('hidden');
  return true;
}

function applyChatDrawerState() {
  // Intentional asymmetry: chat view restores remembered context drawer preference.
  closeDrawer(globalDrawer);
  if (contextDrawerPreferredOpen) openDrawer(contextDrawer);
  else closeDrawer(contextDrawer);
}

function setWorkspaceNavActive(view) {
  selectedWorkspaceView = view;
  if (!globalDrawer) return;
  globalDrawer.querySelectorAll('[data-workspace-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.workspaceView === view);
  });
}

function visibleSettingsMenu() {
  return SETTINGS_MENU.filter((item) => item.index !== 15 || window.innerWidth >= 768);
}

function settingsMenuLabel(index) {
  const item = SETTINGS_MENU.find((row) => row.index === index);
  return item?.label ?? '';
}

function getSettingsSubtabValue(subtabKey) {
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_SUBTAB_DEFAULTS, subtabKey)) return 0;
  const value = Number(settingsActiveSubtab[subtabKey]);
  return Number.isFinite(value) ? value : SETTINGS_SUBTAB_DEFAULTS[subtabKey];
}

function setSettingsSubtabValue(subtabKey, nextValue) {
  if (!Object.prototype.hasOwnProperty.call(SETTINGS_SUBTAB_DEFAULTS, subtabKey)) return;
  settingsActiveSubtab = {
    ...settingsActiveSubtab,
    [subtabKey]: nextValue,
  };
}

function resetSidebarCharacterSubpanels() {
  sidebarDisplayViewSubmenu = 0;
  sidebarLorebookSubmenu = 0;
  sidebarTriggerMode = 'v1';
  sidebarViewScreenMode = 'none';
  sidebarVoiceMode = '';
  sidebarChatQuery = '';
}

function resetSettingsSubtabs() {
  settingsActiveSubtab = { ...SETTINGS_SUBTAB_DEFAULTS };
}

const SETTINGS_LABEL_OVERRIDES = {
  requestretrys: 'Request Retries',
  genTimes: 'Generation Times',
  emotionWarn: 'Only available when View Screen is set to Emotion.',
  triggerV1Warning: 'V1 trigger scripts are deprecated. Migrate to V2 or Lua.',
  helpBlock: 'Help',
  gameStateEditor: 'Open Game State Editor',
};

function settingLabel(key) {
  const value = String(key || '').trim();
  if (!value) return '';
  if (SETTINGS_LABEL_OVERRIDES[value]) return SETTINGS_LABEL_OVERRIDES[value];
  const withSpaces = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function renderSettingsNavPanel() {
  const menu = visibleSettingsMenu();
  if (!menu.some((item) => item.index === selectedSettingsMenuIndex)) {
    selectedSettingsMenuIndex = menu[0]?.index ?? 1;
  }

  const markup = menu
    .map((item) => {
      const active = item.index === selectedSettingsMenuIndex ? 'is-active' : '';
      return `
        <button class="ds-settings-nav-item ${active}" data-settings-menu-index="${item.index}">
          <span class="ds-settings-nav-icon" aria-hidden="true">${SETTINGS_ICONS[item.icon]}</span>
          <span>${item.label}</span>
        </button>
      `;
    })
    .join('');
  replaceMarkup(settingsNavPanel, markup);
}

function renderSettingsSubTabs(items, selectedId, subtabKey) {
  return `
    <div class="seg-tabs ds-settings-tabs" role="tablist" aria-orientation="horizontal">
      ${items
        .map((item) => {
          const active = item.id === selectedId ? 'active' : '';
          const isSelected = item.id === selectedId;
          return `<button class="seg-tab ds-settings-tab ${active}" role="tab" aria-selected="${isSelected}" tabindex="${isSelected ? '0' : '-1'}" data-settings-subtab-key="${subtabKey}" data-settings-subtab-index="${item.id}"><span>${escapeHtml(item.label)}</span></button>`;
        })
        .join('')}
    </div>
  `;
}

function renderSettingsTextField(label, value = '', type = 'text') {
  return `
    <div class="ds-settings-section">
      <span class="ds-settings-label">${escapeHtml(label)}</span>
      <input class="ds-settings-control control-field" type="${type}" value="${escapeHtml(value)}" />
    </div>
  `;
}

function renderSettingsSelectField(label, options, selected = 0, attrs = '') {
  const normalizedOptions = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option,
  );
  const selectedValue =
    typeof selected === 'number'
      ? normalizedOptions[selected]?.value ?? normalizedOptions[0]?.value ?? ''
      : String(selected);
  return `
    <div class="ds-settings-section">
      <span class="ds-settings-label">${escapeHtml(label)}</span>
      <select class="ds-settings-control control-field" ${attrs}>
        ${normalizedOptions
          .map(
            (option) =>
              `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`,
          )
          .join('')}
      </select>
    </div>
  `;
}

function renderSettingsTextareaField(label, value = '', rows = 4) {
  return `
    <div class="ds-settings-section">
      <span class="ds-settings-label">${escapeHtml(label)}</span>
      <textarea class="ds-settings-control control-field" rows="${rows}">${escapeHtml(value)}</textarea>
    </div>
  `;
}

function renderSettingsCheckRow(label, checked = false) {
  return `
    <label class="ds-settings-row-center ds-settings-check-row">
      <input type="checkbox" ${checked ? 'checked' : ''} />
      <span class="ds-settings-label">${escapeHtml(label)}</span>
    </label>
  `;
}

function renderChatBotModelSettings() {
  return `
    <div class="ds-settings-section">
      ${renderSettingsSelectField('Model', ['OpenAI', 'Claude', 'Gemini', 'OpenRouter'])}
      ${renderSettingsSelectField('Submodel', ['Default', 'Fast', 'Balanced', 'High Quality'])}
      ${renderSettingsTextField('OpenAI API Key', '••••••••••••')}
      ${renderSettingsTextField('Proxy API Key', '')}
      ${renderSettingsTextField('Proxy Request Model', '')}
      ${renderSettingsSelectField('Tokenizer', ['default', 'cl100k_base', 'llama'])}
      ${renderSettingsTextField('Max Context', '8192', 'number')}
      ${renderSettingsTextField('Max Response', '1024', 'number')}
      ${renderSettingsTextField('Temperature', '0.8', 'number')}
      ${renderSettingsTextField('Top P', '0.95', 'number')}
      ${renderSettingsTextareaField('Main Prompt', '', 5)}
      ${renderSettingsTextareaField('Jailbreak', '', 4)}
      ${renderSettingsTextareaField('Global Note', '', 3)}
    </div>
  `;
}

function renderChatBotParameterSettings() {
  return `
    <div class="ds-settings-section">
      ${renderSettingsTextField('Temperature', '0.8', 'number')}
      ${renderSettingsTextField('Top K', '40', 'number')}
      ${renderSettingsTextField('Top P', '0.95', 'number')}
      ${renderSettingsTextField('Repetition Penalty', '1.05', 'number')}
      ${renderSettingsTextField('Min P', '0.05', 'number')}
      ${renderSettingsTextField('Top A', '0', 'number')}
      ${renderSettingsTextField('Frequency Penalty', '0', 'number')}
      ${renderSettingsTextField('Presence Penalty', '0', 'number')}
      ${renderSettingsTextField('Thinking Tokens', '0', 'number')}
      ${renderSettingsTextField('Verbosity', '0', 'number')}
    </div>
  `;
}

function renderPromptTemplateSettings() {
  return `
    <div class="panel-shell ds-settings-card ds-settings-list-shell">
      <div class="empty-state ds-settings-empty-state">No Format</div>
    </div>
    <div class="ds-settings-inline-actions">
      <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Add">＋</button>
      <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Expand All">◫</button>
    </div>
    <div class="ds-settings-inline-actions">
      <span class="ds-settings-label-muted-sm">0 fixed tokens</span>
      <span class="ds-settings-label-muted-sm">0 exact tokens</span>
    </div>
  `;
}

function renderPromptBehaviorSettings() {
  return `
    <div class="ds-settings-section">
      ${renderSettingsTextField('Post End Inner Format', '')}
      ${renderSettingsCheckRow('Send Chat As System')}
      ${renderSettingsCheckRow('Format Group In Single')}
      ${renderSettingsCheckRow('Trim Start New Chat')}
      ${renderSettingsCheckRow('Util Override')}
      ${renderSettingsCheckRow('Enable Json Schema')}
      ${renderSettingsCheckRow('Output Image Modal')}
      ${renderSettingsCheckRow('Strict Json Schema')}
      ${renderSettingsTextField('Max Thought Tag Depth', '0', 'number')}
      ${renderSettingsTextareaField('Custom Prompt Template Toggle', '', 3)}
      ${renderSettingsTextareaField('Default Variables', '', 3)}
      ${renderSettingsTextareaField('Predicted Output', '', 3)}
      ${renderSettingsTextareaField('Auto Suggest', '', 3)}
      ${renderSettingsTextareaField('Group Inner Format', '', 3)}
      ${renderSettingsTextareaField('System Content Replacement', '', 3)}
      ${renderSettingsTextareaField('System Role Replacement', '', 3)}
    </div>
  `;
}

function renderChatBotPromptSettings() {
  const activePromptSubtab = getSettingsSubtabValue('prompt');
  return `
    ${renderSettingsSubTabs(SETTINGS_SUBMENUS.prompt, activePromptSubtab, 'prompt')}
    <div class="ds-settings-section">
      ${activePromptSubtab === 0 ? renderPromptTemplateSettings() : renderPromptBehaviorSettings()}
    </div>
  `;
}

function renderSettingsChatBotPage() {
  const activeChatBotSubtab = getSettingsSubtabValue('chatBot');
  return `
    <div class="ds-settings-page">
      <div class="ds-settings-page-title-row">
        <h2 class="ds-settings-page-title">Chat Bot</h2>
        <button class="chrome-btn ds-settings-title-action">Presets</button>
      </div>
      ${renderSettingsSubTabs(SETTINGS_SUBMENUS.chatBot, activeChatBotSubtab, 'chatBot')}
      ${
        activeChatBotSubtab === 0
          ? renderChatBotModelSettings()
          : activeChatBotSubtab === 1
            ? renderChatBotParameterSettings()
            : renderChatBotPromptSettings()
      }
    </div>
  `;
}

function renderSettingsPersonaPage() {
  const tiles = characters
    .slice(0, 6)
    .map(
      (character, index) => `
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-persona-tile ${index === 0 ? 'ds-settings-persona-tile-selected' : ''}" aria-label="Select persona ${escapeHtml(character.name)}" title="${escapeHtml(character.name)}">
          ${escapeHtml(character.name.slice(0, 1).toUpperCase())}
        </button>
      `,
    )
    .join('');

  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Persona</h2>
      <div class="ds-settings-section panel-shell ds-settings-card ds-settings-wrap-row">
        ${tiles}
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact ds-settings-persona-tile ds-settings-persona-add-tile" aria-label="Add Persona" title="Add Persona">＋</button>
      </div>
      <div class="panel-shell ds-settings-card ds-settings-persona-profile">
        <div class="ds-settings-persona-avatar-col">
          <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-persona-user-tile" aria-label="Select User Portrait" title="Select User Portrait">◎</button>
        </div>
        <div class="ds-settings-section ds-settings-persona-editor">
          <span class="ds-settings-label-muted-sm">Name</span>
          <input class="ds-settings-control control-field" type="text" value="User" />
          <span class="ds-settings-label-muted-sm">Note</span>
          <input class="ds-settings-control control-field" type="text" value="" />
          <span class="ds-settings-label-muted-sm">Description</span>
          <textarea class="ds-settings-control control-field" rows="5"></textarea>
          <div class="ds-settings-inline-actions ds-settings-inline-actions-fluid">
            <button class="item-btn">Export</button>
            <button class="item-btn">Import</button>
            <button class="item-btn">Remove</button>
            ${renderSettingsCheckRow('Large Portrait')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsOtherBotsPage() {
  const activeOtherBotsSubtab = getSettingsSubtabValue('otherBots');
  const longTermMemory = `
    <div class="ds-settings-section">
      ${renderSettingsSelectField('Preset', ['Default'])}
      <div class="ds-settings-inline-actions">
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Add Preset" title="Add Preset">＋</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Edit Preset" title="Edit Preset">✎</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Delete Preset" title="Delete Preset">🗑</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Export Preset" title="Export Preset">⤓</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Import Preset" title="Import Preset">⤒</button>
      </div>
      ${renderSettingsSelectField('Summarization Model', ['Auxiliary Model'])}
      ${renderSettingsTextareaField('Summarization Prompt', '', 4)}
      ${renderSettingsTextareaField('Re-Summarization Prompt', '', 4)}
      ${renderSettingsTextField('Summarize Every X Messages', '20', 'number')}
      ${renderSettingsTextField('Memory Tokens Ratio', '0.4', 'number')}
      ${renderSettingsTextField('Recent Memory Ratio', '0.3', 'number')}
      ${renderSettingsTextField('Similar Memory Ratio', '0.3', 'number')}
      ${renderSettingsCheckRow('Preserve Orphaned Memory')}
      ${renderSettingsCheckRow('Apply Regex Script When Rerolling')}
      ${renderSettingsCheckRow('Do Not Summarize User Message')}
      ${renderSettingsSelectField('Embedding', ['MiniLM', 'OpenAI 3 Small', 'OpenAI 3 Large', 'Custom'])}
    </div>
  `;

  const tts = `
    <div class="ds-settings-section">
      ${renderSettingsCheckRow('Auto Speech')}
      ${renderSettingsTextField('ElevenLabs API key', '')}
      ${renderSettingsTextField('VOICEVOX URL', '')}
      ${renderSettingsTextField('OpenAI Key', '')}
      ${renderSettingsTextField('NovelAI API key', '')}
      ${renderSettingsTextField('Huggingface Key', '')}
      ${renderSettingsTextField('fish-speech API Key', '')}
    </div>
  `;

  const emotion = `
    <div class="ds-settings-section">
      ${renderSettingsSelectField('Emotion Method', ['Auxiliary Model', 'Embedding Model'])}
      ${renderSettingsSelectField('Emotion Embedding Model', ['MiniLM', 'OpenAI 3 Small', 'OpenAI 3 Large', 'Custom'])}
      ${renderSettingsTextareaField('Emotion Prompt', '', 4)}
      ${renderSettingsSelectField('Emotion List Character', characters.map((character) => character.name), 0)}
      <span class="ds-settings-label">Emotion List</span>
      <div class="panel-shell ds-settings-card">
        <div class="ds-settings-emotion-preview-row">
          <img class="ds-settings-emotion-preview" src="${escapeHtml(DEFAULT_EMOTION_IMAGE_SRC)}" alt="Emotion placeholder preview" loading="lazy" />
          <span class="ds-settings-label-muted-sm">Neutral</span>
        </div>
      </div>
    </div>
  `;

  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Other Bots</h2>
      ${renderSettingsSubTabs(SETTINGS_SUBMENUS.otherBots, activeOtherBotsSubtab, 'otherBots')}
      ${
        activeOtherBotsSubtab === 0
          ? longTermMemory
          : activeOtherBotsSubtab === 1
            ? tts
            : emotion
      }
    </div>
  `;
}

function renderSettingsDisplayPage() {
  const activeDisplaySubtab = getSettingsSubtabValue('display');
  const themePanel = `
    <div class="ds-settings-section">
      ${renderSettingsSelectField('Color Scheme', COLOR_SCHEME_OPTIONS, selectedColorSchemeName, 'data-setting-color-scheme')}
      ${renderSettingsSelectField('Text Color', ['Classic Risu', 'High Contrast', 'Custom'])}
      ${renderSettingsSelectField('Font', ['Default', 'Times New Roman', 'Custom'])}
      ${renderSettingsTextareaField('Custom CSS', '', 5)}
    </div>
  `;

  const sizePanel = `
    <div class="ds-settings-section">
      ${renderSettingsTextField('UI Size', '100', 'number')}
      ${renderSettingsTextField('Line Height', '1.4', 'number')}
      ${renderSettingsTextField('Icon Size', '100', 'number')}
      ${renderSettingsTextField('Text Area Size', '0', 'number')}
      ${renderSettingsTextField('Text Area Text Size', '0', 'number')}
      ${renderSettingsTextField('Side Bar Size', '100', 'number')}
      ${renderSettingsTextField('Asset Width', '100', 'number')}
      ${renderSettingsTextField('Animation Speed', '100', 'number')}
      ${renderSettingsTextField('Memory Limit Thickness', '1', 'number')}
      ${renderSettingsTextField('Settings Close Button Size', '24', 'number')}
    </div>
  `;

  const otherPanel = `
    <div class="ds-settings-section">
      ${renderSettingsCheckRow('Fullscreen')}
      ${renderSettingsCheckRow('Show Memory Limit')}
      ${renderSettingsCheckRow('Show First Message Pages')}
      ${renderSettingsCheckRow('Hide All Images')}
      ${renderSettingsCheckRow('Show Folder Name In Icon')}
      ${renderSettingsCheckRow('Play Message')}
      ${renderSettingsCheckRow('Play Message On Translate End')}
      ${renderSettingsCheckRow('Round Icons')}
      ${renderSettingsCheckRow('Text Backgrounds')}
      ${renderSettingsCheckRow('Text Border')}
      ${renderSettingsCheckRow('Text Screen Round')}
      ${renderSettingsCheckRow('Show Saving Icon')}
      ${renderSettingsCheckRow('Show Prompt Comparison')}
      ${renderSettingsCheckRow('Use Chat Copy')}
      ${renderSettingsCheckRow('Log Share')}
      ${renderSettingsCheckRow('Use Additional Assets Preview')}
      ${renderSettingsCheckRow('Hide API Keys')}
      ${renderSettingsCheckRow('Unformat Quotes')}
      ${renderSettingsCheckRow('Custom Quotes')}
      ${renderSettingsCheckRow('Menu Side Bar')}
      ${renderSettingsCheckRow('Notification')}
      ${renderSettingsCheckRow('Use Chat Sticker')}
    </div>
  `;

  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Display</h2>
      ${renderSettingsSubTabs(SETTINGS_SUBMENUS.display, activeDisplaySubtab, 'display')}
      ${activeDisplaySubtab === 0 ? themePanel : activeDisplaySubtab === 1 ? sizePanel : otherPanel}
    </div>
  `;
}

function renderSettingsLanguagePage() {
  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Language</h2>
      <div class="ds-settings-section">
        ${renderSettingsSelectField('UI Language', ['Deutsch', 'English', '한국어', '中文', '中文(繁體)', 'Tiếng Việt'])}
        ${renderSettingsSelectField('Translator Language', ['Disabled', 'Korean', 'Russian', 'Chinese', 'Japanese', 'French', 'Spanish', 'German'])}
        ${renderSettingsSelectField('Translator Type', ['Google', 'DeepL', 'Ax. Model', 'DeepL X', 'Firefox'])}
        ${renderSettingsTextField('DeepL Key', '')}
        ${renderSettingsTextField('DeepL X URL', '')}
        ${renderSettingsTextField('DeepL X Token', '')}
        ${renderSettingsTextField('Translation Response Size', '512', 'number')}
        ${renderSettingsTextareaField('Translator Prompt', 'You are a translator. translate the following html or text into {{slot}}. do not output anything other than the translation.', 4)}
        ${renderSettingsSelectField('Source Language', ['Auto', 'English', 'Chinese', 'Japanese', 'Korean', 'French', 'Spanish', 'German', 'Russian'])}
        ${renderSettingsCheckRow('HTML Translation')}
        ${renderSettingsCheckRow('Auto Translation')}
        ${renderSettingsCheckRow('Combine Translation')}
        ${renderSettingsCheckRow('Legacy Translation')}
        ${renderSettingsCheckRow('Translate Before HTML Formatting')}
        ${renderSettingsCheckRow('Auto Translate Cached Only')}
      </div>
    </div>
  `;
}

function renderSettingsAccessibilityPage() {
  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Accessibility</h2>
      <div class="ds-settings-section">
        ${SETTINGS_ACCESSIBILITY_TOGGLES.map((item) => renderSettingsCheckRow(settingLabel(item))).join('')}
      </div>
    </div>
  `;
}

function renderSettingsModulesPage() {
  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Modules</h2>
      ${renderSettingsTextField('Search', '')}
      <div class="list-shell ds-settings-list-container ds-settings-list-shell ds-settings-list-shell-scroll">
        <div class="empty-state ds-settings-empty-state">No modules available.</div>
      </div>
      <div class="ds-settings-inline-actions">
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Add Module" title="Add Module">＋</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Sync Modules" title="Sync Modules">⇄</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Import Module" title="Import Module">⤒</button>
      </div>
    </div>
  `;
}

function renderSettingsPluginPage() {
  return `
    <div class="ds-settings-page">
      <h2 class="ds-settings-page-title">Plugin</h2>
      <span class="ds-settings-note-danger">Plugins can run arbitrary code. Install only from trusted sources.</span>
      <div class="ds-settings-section panel-shell ds-settings-card">
        <span class="ds-settings-label-muted">No plugins installed.</span>
      </div>
      <div class="ds-settings-inline-actions">
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Add Plugin" title="Add Plugin">＋</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Import Plugin" title="Import Plugin">⤒</button>
        <button class="icon-btn icon-btn--bordered ds-settings-icon-action ds-settings-icon-action-compact" aria-label="Refresh Plugins" title="Refresh Plugins">↻</button>
      </div>
    </div>
  `;
}

function renderSettingsHotkeyPage() {
  if (window.innerWidth < 768) {
    return `
      <div class="ds-settings-page">
        <div class="ds-settings-section">
          <span class="ds-settings-note-danger">Hotkey editor is available on desktop widths only.</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="ds-settings-page">
      <div class="ds-settings-section">
        <table class="ds-settings-hotkey-table">
          <thead>
            <tr>
              <th>Hotkey</th>
              <th>Ctrl</th>
              <th>Shift</th>
              <th>Alt</th>
              <th>Key</th>
            </tr>
          </thead>
          <tbody>
            ${HOTKEY_ROWS.map(
              (row) => `
                <tr>
                  <td>${escapeHtml(settingLabel(row.action))}</td>
                  <td><button class="ds-settings-key-chip control-chip ${row.ctrl ? 'active' : ''}">Ctrl</button></td>
                  <td><button class="ds-settings-key-chip control-chip ${row.shift ? 'active' : ''}">Shift</button></td>
                  <td><button class="ds-settings-key-chip control-chip ${row.alt ? 'active' : ''}">Alt</button></td>
                  <td><input class="ds-settings-hotkey-key-input control-field" value="${escapeHtml(row.key)}" /></td>
                </tr>
              `,
            ).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderSettingsAdvancedPage() {
  return `
    <div class="ds-settings-page ds-settings-page--advanced">
      <div class="ds-settings-section ds-settings-section--advanced">
        <h2 class="ds-settings-page-title">Advanced Settings</h2>
        <span class="ds-settings-note-danger">Advanced settings can break runtime behavior if misconfigured.</span>
        ${SETTINGS_ADVANCED_INPUTS.map((item) => renderSettingsTextField(settingLabel(item), '', 'text')).join('')}
        ${SETTINGS_ADVANCED_TOGGLES.map((item) => renderSettingsCheckRow(settingLabel(item))).join('')}
      </div>
    </div>
  `;
}

function renderSettingsContentPanel() {
  let html = '';
  if (selectedSettingsMenuIndex === 1) html = renderSettingsChatBotPage();
  else if (selectedSettingsMenuIndex === 12) html = renderSettingsPersonaPage();
  else if (selectedSettingsMenuIndex === 2) html = renderSettingsOtherBotsPage();
  else if (selectedSettingsMenuIndex === 3) html = renderSettingsDisplayPage();
  else if (selectedSettingsMenuIndex === 10) html = renderSettingsLanguagePage();
  else if (selectedSettingsMenuIndex === 11) html = renderSettingsAccessibilityPage();
  else if (selectedSettingsMenuIndex === 14) html = renderSettingsModulesPage();
  else if (selectedSettingsMenuIndex === 4) html = renderSettingsPluginPage();
  else if (selectedSettingsMenuIndex === 15) html = renderSettingsHotkeyPage();
  else if (selectedSettingsMenuIndex === 6) html = renderSettingsAdvancedPage();
  else {
    html = `
      <div class="ds-settings-page">
        <h2 class="ds-settings-page-title">${escapeHtml(settingsMenuLabel(selectedSettingsMenuIndex))}</h2>
      </div>
    `;
  }

  replaceMarkup(settingsContentPanel, html);
}

function renderSettingsView() {
  renderSettingsNavPanel();
  renderSettingsContentPanel();
}

function ensureSelectedChatForCharacter() {
  if (!selectedCharacterId) {
    selectedChatId = null;
    return;
  }

  const charChats = chatsForCharacter(selectedCharacterId);
  if (!charChats.length) {
    selectedChatId = null;
    return;
  }

  const remembered = lastChatByCharacter[selectedCharacterId];
  if (remembered && charChats.some((chat) => chat.id === remembered)) {
    selectedChatId = remembered;
  } else {
    selectedChatId = charChats[0].id;
    lastChatByCharacter[selectedCharacterId] = selectedChatId;
  }
}

function filteredCharacters() {
  const q = homeSearchQuery.trim().toLowerCase();
  if (!q) return characters;
  return characters.filter(
    (character) =>
      character.name.toLowerCase().includes(q) || character.archetype.toLowerCase().includes(q),
  );
}

function renderCharacterGrid() {
  if (!characterGrid) return;
  const rows = filteredCharacters();

  const markup = rows
    .map((character) => {
      const charChats = chatsForCharacter(character.id);
      const latest = charChats[0]?.updatedAt ?? 'No chats';
      const lastChat =
        charChats.find((chat) => chat.id === lastChatByCharacter[character.id]) ?? charChats[0];
      const avatarSrc = characterImageSrc(character);

      return `
        <button class="panel-shell character-card" data-character="${character.id}">
          <div class="character-avatar">
            <img class="character-avatar-img" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(character.name)} portrait" loading="lazy" />
          </div>
          <div>
            <h3>${escapeHtml(character.name)}</h3>
            <p class="small-muted">${escapeHtml(character.archetype)}</p>
          </div>
          <div class="character-meta">
            <span>${charChats.length} chats</span>
            <span>${escapeHtml(latest)}</span>
          </div>
          <div class="small-muted">Last chat: ${escapeHtml(lastChat?.title ?? 'None')}</div>
        </button>
      `;
    })
    .join('');
  replaceMarkup(characterGrid, markup);
}

function filteredSidebarChats() {
  const q = sidebarChatQuery.trim().toLowerCase();
  return chatsForCharacter(selectedCharacterId).filter((chat) => {
    if (!q) return true;
    return chat.title.toLowerCase().includes(q) || chat.preview.toLowerCase().includes(q);
  });
}

function ensureSidebarTabForMode() {
  const mode = SIDEBAR_MODES.find((item) => item.key === selectedSidebarMode) ?? SIDEBAR_MODES[0];
  if (!mode.tabs.includes(selectedSidebarTab)) {
    selectedSidebarTab = mode.tabs[0];
  }
}

function syncSidebarModeWithTab() {
  selectedSidebarMode = TAB_TO_MODE[selectedSidebarTab] ?? SIDEBAR_MODES[0].key;
}

function renderSidebarModeStrip() {
  ensureSidebarTabForMode();
  const mode = SIDEBAR_MODES.find((item) => item.key === selectedSidebarMode) ?? SIDEBAR_MODES[0];
  const byKey = Object.fromEntries(SIDEBAR_TABS.map((tab) => [tab.key, tab]));
  const visibleTabs = mode.tabs.map((key) => byKey[key]).filter(Boolean);
  const shouldShowTabStrip = visibleTabs.length > 1;

  const modeButtons = SIDEBAR_MODES.map((item) => {
    const active = item.key === selectedSidebarMode;
    return `<button class="seg-tab sidebar-group-btn ${active ? 'active' : ''}" data-sidebar-group="${item.key}" aria-pressed="${active}">${item.label}</button>`;
  }).join('');

  const tabButtons = visibleTabs
    .map((item) => {
      const active = item.key === selectedSidebarTab;
      return `<button class="seg-tab sidebar-mode-btn ${active ? 'active' : ''}" role="tab" aria-selected="${active}" tabindex="${active ? '0' : '-1'}" aria-label="${item.label}" title="${item.label}" data-sidebar-tab="${item.key}"><span class="sidebar-mode-icon">${TAB_ICONS[item.icon]}</span></button>`;
    })
    .join('');

  const tabStripHtml = shouldShowTabStrip
    ? `<div class="seg-tabs sidebar-tab-strip" role="tablist" aria-label="${mode.label} Tabs">${tabButtons}</div>`
    : '';

  replaceMarkup(sidebarModeStrip, `
    <div class="sidebar-mode-switch" role="group" aria-label="Sidebar Mode">
      ${modeButtons}
    </div>
    ${tabStripHtml}
  `);
}

function selectChat(chatId) {
  selectedChatId = chatId;
  lastChatByCharacter[selectedCharacterId] = chatId;
  renderChatRuntime();
  renderSidebarContent();
  renderGlobalRecentChats();
  renderCharacterGrid();
}

function renderSidebarToggleRows(scroll = false) {
  const shellOpen = scroll ? '<div class="sidebar-toggle-scroll-shell">' : '';
  const shellClose = scroll ? '</div>' : '';
  return `
    ${shellOpen}
    <div class="sidebar-toggle-row">
      <label class="sidebar-toggle-checkline">
        <input type="checkbox" />
        <span>Jailbreak Toggle</span>
      </label>
    </div>
    <div class="sidebar-toggle-row">
      <label class="sidebar-toggle-checkline">
        <input type="checkbox" />
        <span>Toggle HypaMemory</span>
      </label>
    </div>
    ${shellClose}
  `;
}

function renderChatsTab() {
  const rows = filteredSidebarChats();

  const chatListHtml = rows
    .map(
      (chat) => `
        <div class="side-row side-chat-row ds-ui-list-row ${chat.id === selectedChatId ? 'side-row-selected' : ''}" data-chat-id="${chat.id}" role="button" tabindex="0" aria-pressed="${chat.id === selectedChatId}" aria-label="Open chat ${escapeHtml(chat.title)}">
          <span class="side-row-text">${escapeHtml(chat.title)}</span>
          <div class="side-row-actions action-rail ds-ui-action-rail">
            <button type="button" class="icon-btn side-action-btn" data-chat-action aria-label="Chat Menu" title="Chat Menu">☰</button>
            <button type="button" class="icon-btn side-action-btn" data-chat-action aria-label="Rename" title="Rename">✎</button>
            <button type="button" class="icon-btn side-action-btn" data-chat-action aria-label="Export" title="Export">⤓</button>
            <button type="button" class="icon-btn side-action-btn" data-chat-action aria-label="Delete" title="Delete">🗑</button>
          </div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="side-chat-list-root">
      <button class="item-btn side-new-chat-button">New Chat</button>
      <div class="side-chat-list-scroll">
        <div class="side-folder-list"></div>
        <div class="side-chat-group side-chat-group--flat">
          ${chatListHtml || '<span class="empty-state side-chat-empty">No chats</span>'}
        </div>
      </div>
      <div class="side-footer">
        <div class="side-footer-actions action-rail ds-ui-action-rail">
          <button class="icon-btn side-action-btn" aria-label="Export All">⤓</button>
          <button class="icon-btn side-action-btn" aria-label="Import">⤒</button>
          <button class="icon-btn side-action-btn" aria-label="Edit Mode">✎</button>
          <button class="icon-btn side-action-btn" aria-label="Branches">⑂</button>
          <button class="icon-btn side-action-btn" aria-label="Bookmarks">✓</button>
          <button class="icon-btn side-action-btn side-action-btn-end" aria-label="New Folder">📁</button>
        </div>
        ${renderSidebarToggleRows(true)}
      </div>
    </div>
  `;
}

function renderBasicsTab() {
  const character = characters.find((c) => c.id === selectedCharacterId);
  const chat = chats.find((c) => c.id === selectedChatId);
  const descTokens = Math.max(1, (character?.name.length ?? 1) * 16);
  const firstMsgTokens = Math.max(1, (chat?.turns ?? 1) * 2);
  const noteTokens = Math.max(1, (chat?.title.length ?? 1) * 4);

  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <input class="char-config-control control-field" type="text" value="${escapeHtml(character?.name ?? '')}" placeholder="Character Name" />
        <span class="char-config-label">Description</span>
        <textarea class="char-config-control control-field" rows="6">${escapeHtml(character?.archetype ?? '')}</textarea>
        <span class="char-config-token-note">${descTokens} tokens</span>
        <span class="char-config-label">Personality</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Scenario</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Replace Global Note</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">First Message</span>
        <textarea class="char-config-control control-field" rows="5"></textarea>
        <span class="char-config-token-note">${firstMsgTokens} tokens</span>
        <span class="char-config-label">Chat Notes</span>
        <textarea class="char-config-control control-field" rows="4">${escapeHtml(chat?.preview ?? '')}</textarea>
        <span class="char-config-token-note">${noteTokens} tokens</span>
        ${renderSidebarToggleRows(false)}
      </div>
    </div>
  `;
}

function renderDisplayTab() {
  const isIconPanel = sidebarDisplayViewSubmenu === 0;
  const isViewScreenPanel = sidebarDisplayViewSubmenu === 1;
  const isAssetsPanel = sidebarDisplayViewSubmenu === 2;

  const iconPanel = `
    <div class="char-config-icon-gallery">
      <button type="button" aria-label="Select Character Portrait" title="Select Character Portrait"><div class="char-config-icon-tile char-config-icon-tile-selected"></div></button>
      <button type="button" aria-label="Add Character Portrait" title="Add Character Portrait"><div class="char-config-icon-add-tile">＋</div></button>
    </div>
    <div class="char-config-icon-remove-row">
      <button class="icon-btn char-config-icon-remove-button" aria-label="Remove Character Portrait" title="Remove Character Portrait">🗑</button>
    </div>
    <div class="char-config-check-row">
      <label class="sidebar-toggle-checkline">
        <input type="checkbox" />
        <span>Large Portrait</span>
      </label>
    </div>
  `;

  const viewScreenPanel = `
    <select id="sidebarViewScreenMode" class="char-config-control control-field">
      <option value="none" ${sidebarViewScreenMode === 'none' ? 'selected' : ''}>None</option>
      <option value="emotion" ${sidebarViewScreenMode === 'emotion' ? 'selected' : ''}>Emotion</option>
    </select>
    ${
      sidebarViewScreenMode === 'emotion'
        ? `
      <span class="char-config-label">Emotion Image</span>
      <span class="char-config-note-xs">${settingLabel('emotionWarn')}</span>
      <div class="panel-shell char-config-card">
        <table class="char-config-table-fixed char-config-table char-config-table-full">
          <tbody>
            <tr>
              <th class="char-config-table-head char-config-table-col-image">Image</th>
              <th class="char-config-table-head char-config-table-col-emotion">Emotion</th>
              <th class="char-config-table-head"></th>
            </tr>
            <tr>
              <td>
                <img class="char-config-emotion-preview" src="${escapeHtml(DEFAULT_EMOTION_IMAGE_SRC)}" alt="Emotion image placeholder" loading="lazy" />
              </td>
              <td class="char-config-emotion-name">Neutral</td>
              <td>
                <button class="icon-btn icon-btn--md char-config-icon-action char-config-icon-action--danger" aria-label="Remove Emotion Image" title="Remove Emotion Image">🗑</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="char-config-emotion-actions">
        <button class="icon-btn icon-btn--md char-config-icon-action char-config-icon-action--success" aria-label="Add Emotion Image" title="Add Emotion Image">＋</button>
      </div>
      <div class="char-config-check-row">
        <label class="sidebar-toggle-checkline">
          <input type="checkbox" />
          <span>Inlay View Screen</span>
        </label>
      </div>
      `
        : ''
    }
  `;

  const assetsPanel = `
    <div class="char-config-check-row">
      <label class="sidebar-toggle-checkline">
        <input type="checkbox" />
        <span>Insert Asset Prompt</span>
      </label>
    </div>
    <span class="char-config-label">Asset Style</span>
    <select class="char-config-control control-field">
      <option>Static</option>
      <option>Dynamic</option>
    </select>
    <div class="panel-shell char-config-card">
      <table class="char-config-table-contained char-config-table-fixed char-config-table char-config-table-full">
        <tbody>
          <tr>
            <th class="char-config-table-head">Value</th>
            <th class="char-config-table-head char-config-table-action-head">
              <button class="icon-btn icon-btn--md char-config-icon-action char-config-icon-action--success" aria-label="Add Asset Value" title="Add Asset Value">＋</button>
            </th>
          </tr>
          <tr>
            <td class="char-config-empty-cell">No Assets</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <h2 class="char-config-title">Character Display</h2>
        <div class="seg-tabs char-config-subtabs">
          <button class="seg-tab char-config-subtab ${isIconPanel ? 'active' : ''}" data-display-view-submenu="0">Char Icon</button>
          <button class="seg-tab char-config-subtab ${isViewScreenPanel ? 'active' : ''}" data-display-view-submenu="1">View Screen</button>
          <button class="seg-tab char-config-subtab ${isAssetsPanel ? 'active' : ''}" data-display-view-submenu="2">Additional Assets</button>
        </div>
        ${isIconPanel ? iconPanel : ''}
        ${isViewScreenPanel ? viewScreenPanel : ''}
        ${isAssetsPanel ? assetsPanel : ''}
      </div>
    </div>
  `;
}

function renderLorebookTab() {
  const onCharacter = sidebarLorebookSubmenu === 0;
  const onChat = sidebarLorebookSubmenu === 1;
  const onRulebooks = sidebarLorebookSubmenu === 2;
  const onSettings = sidebarLorebookSubmenu === 3;

  const info = onCharacter
    ? settingLabel('globalLoreInfo')
    : onChat
      ? settingLabel('localLoreInfo')
      : '';

  const rulebookItems = libraryBooks
    .map(
      (book) => `
        <div class="panel-shell ds-settings-card rag-rulebook-item">
          <div class="rag-rulebook-info">
            <span class="rag-rulebook-icon">${TAB_ICONS.book}</span>
            <div class="rag-rulebook-meta">
              <span class="rag-rulebook-name">${escapeHtml(book.name)}</span>
              <span class="rag-chunk-count">${book.chunkCount ?? 0} chunks</span>
            </div>
          </div>
          <div class="rag-rulebook-actions">
            <button class="icon-btn icon-btn--md char-config-icon-action rag-toggle-btn-enabled" aria-label="Toggle Rulebook">✓</button>
          </div>
        </div>
      `,
    )
    .join('');

  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <div class="seg-tabs lorebook-setting-tabs">
          <button class="seg-tab lorebook-setting-tab ${onCharacter ? 'is-active' : ''}" data-lorebook-submenu="0"><span>Character</span></button>
          <button class="seg-tab lorebook-setting-tab ${onChat ? 'is-active' : ''}" data-lorebook-submenu="1"><span>Chat</span></button>
          <button class="seg-tab lorebook-setting-tab ${onRulebooks ? 'is-active' : ''}" data-lorebook-submenu="2"><span>Rulebooks</span></button>
          <button class="seg-tab lorebook-setting-tab ${onSettings ? 'is-active' : ''}" data-lorebook-submenu="3"><span>Settings</span></button>
        </div>

        ${
          !onSettings && !onRulebooks
            ? `
          <span class="lorebook-setting-info">${info}</span>
          <div class="list-shell lorebook-list-root">
            <span class="empty-state lorebook-list-empty">No Lorebook</span>
          </div>
        `
            : ''
        }

        ${
          onRulebooks
            ? `
          <div class="list-shell rag-rulebook-container">
            <div class="rag-rulebook-list">
              ${
                rulebookItems ||
                '<div class="empty-state rag-empty">No rulebooks in library. Use the Library icon in the main menu to upload PDFs or text files.</div>'
              }
            </div>
            <div class="ds-settings-divider ds-settings-divider-spaced"></div>
            <div class="rag-settings-form">
              <div class="rag-setting-row">
                <label class="sidebar-toggle-checkline">
                  <input type="checkbox" />
                  <span>Enable Rulebook RAG</span>
                </label>
              </div>
            </div>
          </div>
        `
            : ''
        }

        ${
          onSettings
            ? `
          <div class="lorebook-setting-check-row">
            <label class="sidebar-toggle-checkline">
              <input type="checkbox" checked />
              <span>${settingLabel('useGlobalSettings')}</span>
            </label>
          </div>
          <div class="lorebook-setting-check-row">
            <label class="sidebar-toggle-checkline">
              <input type="checkbox" />
              <span>${settingLabel('recursiveScanning')}</span>
            </label>
          </div>
          <div class="lorebook-setting-check-row">
            <label class="sidebar-toggle-checkline">
              <input type="checkbox" />
              <span>${settingLabel('fullWordMatching')}</span>
            </label>
          </div>
          <span class="lorebook-setting-label lorebook-setting-label-spaced">${settingLabel('loreBookDepth')}</span>
          <input class="char-config-control control-field" type="number" min="0" max="20" value="4" />
          <span class="lorebook-setting-label">${settingLabel('loreBookToken')}</span>
          <input class="char-config-control control-field" type="number" min="0" max="4096" value="1024" />
          <div class="lorebook-setting-check-row">
            <label class="sidebar-toggle-checkline">
              <input type="checkbox" />
              <span>${settingLabel('lorePlus')}</span>
            </label>
          </div>
        `
            : ''
        }

        ${
          !onSettings
            ? `
          <div class="lorebook-setting-actions">
            <button class="icon-btn lorebook-setting-action-btn" aria-label="Add">＋</button>
            <button class="icon-btn lorebook-setting-action-btn lorebook-setting-action-btn-gap-sm" aria-label="Export">⤓</button>
            <button class="icon-btn lorebook-setting-action-btn lorebook-setting-action-btn-gap" aria-label="Add Folder">📁</button>
            <button class="icon-btn lorebook-setting-action-btn lorebook-setting-action-btn-gap" aria-label="Import">⤒</button>
            <button class="icon-btn lorebook-setting-action-btn lorebook-setting-action-btn-gap lorebook-setting-action-btn-with-label" aria-label="Toggle Character">
              <span>☀</span>
              <span class="lorebook-setting-action-caption">CHAR</span>
            </button>
            <button class="icon-btn lorebook-setting-action-btn lorebook-setting-action-btn-gap lorebook-setting-action-btn-with-label" aria-label="Toggle Chat">
              <span>☀</span>
              <span class="lorebook-setting-action-caption">CHAT</span>
            </button>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

function renderVoiceTab() {
  const provider = sidebarVoiceMode;

  const providerFields =
    provider === 'webspeech'
      ? `
        <span class="char-config-label">Speech</span>
        <select class="char-config-control control-field">
          <option>Auto</option>
        </select>
      `
      : provider === 'elevenlab'
        ? `
        <span class="char-config-note-sm">Please set the ElevenLabs API key in global Settings → Other Bots</span>
        <span class="char-config-label">Speech</span>
        <select class="char-config-control control-field">
          <option>Unset</option>
        </select>
      `
        : provider === 'VOICEVOX'
          ? `
        <span class="char-config-label">Speaker</span>
        <select class="char-config-control control-field"><option>Speaker</option></select>
        <span class="char-config-label-muted">Style</span>
        <select class="char-config-control control-field"><option>Style</option></select>
        <span class="char-config-label">Speed scale</span>
        <input class="char-config-control control-field" type="number" value="1" />
        <span class="char-config-label">Pitch scale</span>
        <input class="char-config-control control-field" type="number" value="0" />
        <span class="char-config-label">Volume scale</span>
        <input class="char-config-control control-field" type="number" value="1" />
        <span class="char-config-label">Intonation scale</span>
        <input class="char-config-control control-field" type="number" value="1" />
      `
          : provider === 'novelai'
            ? `
        <span class="char-config-label">Custom Voice Seed</span>
        <div class="char-config-check-row"><input type="checkbox" /></div>
        <span class="char-config-label">Voice</span>
        <select class="char-config-control control-field"><option>Aini</option></select>
        <span class="char-config-label">Version</span>
        <select class="char-config-control control-field"><option>v1</option><option selected>v2</option></select>
      `
            : provider === 'openai'
              ? `
        <select class="char-config-control control-field">
          <option>Unset</option>
          <option>alloy</option>
          <option>echo</option>
          <option>fable</option>
          <option>onyx</option>
          <option>nova</option>
          <option>shimmer</option>
        </select>
      `
              : provider === 'huggingface'
                ? `
        <span class="char-config-label">Model</span>
        <input class="char-config-control control-field" type="text" />
        <span class="char-config-label">Language</span>
        <input class="char-config-control control-field" type="text" value="en" />
      `
                : provider === 'vits'
                  ? `
        <span class="char-config-label">No Model</span>
        <button class="item-btn">Select Model</button>
      `
                  : provider === 'gptsovits'
                    ? `
        <span class="char-config-label">Volume</span>
        <input class="char-config-control control-field" type="range" min="0" max="1" step="0.01" value="1" />
        <span class="char-config-label">URL</span>
        <input class="char-config-control control-field" type="text" />
        <span class="char-config-label">Use Auto Path</span>
        <div class="char-config-check-row"><input type="checkbox" /></div>
        <span class="char-config-label">Reference Audio Data (3~10s audio file)</span>
        <button class="item-btn">Select File</button>
        <span class="char-config-label">Text Language</span>
        <select class="char-config-control control-field">
          <option>auto</option>
          <option>en</option>
          <option>zh</option>
          <option>ja</option>
          <option>ko</option>
        </select>
        <span class="char-config-label">Top P</span>
        <input class="char-config-control control-field" type="range" min="0" max="1" step="0.05" value="1" />
        <span class="char-config-label">Temperature</span>
        <input class="char-config-control control-field" type="range" min="0" max="1" step="0.05" value="0.7" />
        <span class="char-config-label">Speed</span>
        <input class="char-config-control control-field" type="range" min="0.6" max="1.65" step="0.05" value="1" />
        <span class="char-config-label">Top K</span>
        <input class="char-config-control control-field" type="range" min="1" max="100" step="1" value="5" />
      `
                    : provider === 'fishspeech'
                      ? `
        <span class="char-config-label">Model</span>
        <select class="char-config-control control-field"><option>Not selected</option></select>
        <span class="char-config-label">Chunk Length</span>
        <input class="char-config-control control-field" type="number" value="200" />
        <span class="char-config-label">Normalize</span>
        <div class="char-config-check-row"><input type="checkbox" /></div>
      `
                      : '';

  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <h2 class="char-config-title">TTS</h2>
        <span class="char-config-label">Provider</span>
        <select id="sidebarVoiceProvider" class="char-config-control control-field">
          <option value="" ${provider === '' ? 'selected' : ''}>Disabled</option>
          <option value="elevenlab" ${provider === 'elevenlab' ? 'selected' : ''}>ElevenLabs</option>
          <option value="webspeech" ${provider === 'webspeech' ? 'selected' : ''}>Web Speech</option>
          <option value="VOICEVOX" ${provider === 'VOICEVOX' ? 'selected' : ''}>VOICEVOX</option>
          <option value="openai" ${provider === 'openai' ? 'selected' : ''}>OpenAI</option>
          <option value="novelai" ${provider === 'novelai' ? 'selected' : ''}>NovelAI</option>
          <option value="huggingface" ${provider === 'huggingface' ? 'selected' : ''}>Huggingface</option>
          <option value="vits" ${provider === 'vits' ? 'selected' : ''}>VITS</option>
          <option value="gptsovits" ${provider === 'gptsovits' ? 'selected' : ''}>GPT-SoVITS</option>
          <option value="fishspeech" ${provider === 'fishspeech' ? 'selected' : ''}>fish-speech</option>
        </select>
        ${providerFields}
        ${
          provider
            ? `
          <div class="char-config-check-row">
            <label class="sidebar-toggle-checkline">
              <input type="checkbox" />
              <span>TTS Read Only Quoted</span>
            </label>
          </div>
        `
            : ''
        }
      </div>
    </div>
  `;
}

function renderScriptsTab() {
  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <h2 class="char-config-title">Scripts</h2>
        <span class="char-config-label">Background HTML</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Regex Script</span>
        <div class="list-shell regex-list-container">
          <div class="empty-state regex-list-empty">No Scripts</div>
        </div>
        <div class="action-rail regex-list-actions">
          <button class="icon-btn regex-list-action-btn" aria-label="Add">＋</button>
          <button class="icon-btn regex-list-action-btn" aria-label="Export">⤓</button>
          <button class="icon-btn regex-list-action-btn" aria-label="Import">⤒</button>
        </div>
        <span class="char-config-label">Trigger Script</span>
        <div class="seg-tabs trigger-list-mode-row">
          <button class="seg-tab trigger-list-mode-btn ${sidebarTriggerMode === 'v1' ? 'active' : ''}" data-trigger-mode="v1">V1</button>
          <button class="seg-tab trigger-list-mode-btn ${sidebarTriggerMode === 'v2' ? 'active' : ''}" data-trigger-mode="v2">V2</button>
          <button class="seg-tab trigger-list-mode-btn ${sidebarTriggerMode === 'lua' ? 'active' : ''}" data-trigger-mode="lua">Lua</button>
        </div>
        ${
          sidebarTriggerMode === 'v1'
            ? `<span class="trigger-list-warning">${settingLabel('triggerV1Warning')}</span>`
            : ''
        }
        <div class="list-shell trigger-v1-list-container">
          ${
            sidebarTriggerMode === 'lua'
              ? `
            <textarea class="char-config-control control-field" rows="5"></textarea>
            <button class="item-btn">${settingLabel('helpBlock')}</button>
          `
              : `<div class="empty-state trigger-v1-list-empty">No Scripts</div>`
          }
        </div>
        ${
          sidebarTriggerMode !== 'lua'
            ? `<button class="icon-btn trigger-v1-list-add-btn" aria-label="Add Script">＋</button>`
            : ''
        }
        <span class="char-config-label">Char JS</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
      </div>
    </div>
  `;
}

function renderAdvancedTab() {
  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <h2 class="char-config-title">Advanced Settings</h2>
        <span class="char-config-label">Bias</span>
        <div class="panel-shell char-config-card">
          <table class="char-config-table-fixed char-config-table char-config-table-full">
            <tbody>
              <tr>
                <th class="char-config-table-head">Bias</th>
                <th class="char-config-table-head char-config-table-col-image">Value</th>
                <th class="char-config-table-head char-config-table-action-head">
                  <button class="icon-btn icon-btn--md char-config-icon-action char-config-icon-action--success" aria-label="Add Bias" title="Add Bias">＋</button>
                </th>
              </tr>
              <tr>
                <td class="char-config-empty-cell" colspan="3">No Bias</td>
              </tr>
            </tbody>
          </table>
        </div>
        <span class="char-config-label">Example Message</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Creator Notes</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">System Prompt</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Additional Text</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Default Variables</span>
        <textarea class="char-config-control control-field" rows="4"></textarea>
        <span class="char-config-label">Translator Note</span>
        <textarea class="char-config-control control-field" rows="3"></textarea>
        <span class="char-config-label">Creator</span>
        <input class="char-config-control control-field" type="text" />
        <span class="char-config-label">Char Version</span>
        <input class="char-config-control control-field" type="text" />
        <span class="char-config-label">Nickname</span>
        <input class="char-config-control control-field" type="text" />
        <span class="char-config-label">Depth Prompt</span>
        <div class="char-config-depth-row">
          <input class="char-config-control control-field char-config-depth-number" type="number" />
          <input class="char-config-control control-field char-config-depth-text" type="text" />
        </div>
        <span class="char-config-label">Alt Greet</span>
        <div class="panel-shell char-config-card">
          <table class="char-config-table-contained char-config-table-fixed char-config-table char-config-table-full">
            <tbody>
              <tr>
                <th class="char-config-table-head">Value</th>
                <th class="char-config-table-head char-config-table-action-head">
                  <button class="icon-btn icon-btn--md char-config-icon-action char-config-icon-action--success" aria-label="Add Greeting" title="Add Greeting">＋</button>
                </th>
              </tr>
              <tr>
                <td class="char-config-empty-cell" colspan="2">No Data</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="char-config-check-row">
          <label class="sidebar-toggle-checkline"><input type="checkbox" /><span>Low Level Access</span></label>
        </div>
        <div class="char-config-check-row">
          <label class="sidebar-toggle-checkline"><input type="checkbox" /><span>Hide Chat Icon</span></label>
        </div>
        <div class="char-config-check-row">
          <label class="sidebar-toggle-checkline"><input type="checkbox" /><span>Utility Bot</span></label>
        </div>
        <div class="char-config-check-row">
          <label class="sidebar-toggle-checkline"><input type="checkbox" /><span>Escape Output</span></label>
        </div>
        <button class="item-btn">HypaMemory V3 Modal</button>
        <button class="item-btn">Apply Module</button>
      </div>
    </div>
  `;
}

function renderGameStateTab() {
  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <h2 class="char-config-title">Game State</h2>
        <div class="panel-shell char-config-card">
          <span class="char-config-label-muted">${settingLabel('gameStateEditor')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderShareTab() {
  return `
    <div class="char-config-root">
      <div class="char-config-section">
        <button class="item-btn">Export Character</button>
        <button class="item-btn">Remove Character</button>
      </div>
    </div>
  `;
}

function renderSidebarContent({ resetScroll = false } = {}) {
  let html = '';
  if (selectedSidebarTab === 'chats') html = renderChatsTab();
  else if (selectedSidebarTab === 'basic') html = renderBasicsTab();
  else if (selectedSidebarTab === 'display') html = renderDisplayTab();
  else if (selectedSidebarTab === 'lorebook') html = renderLorebookTab();
  else if (selectedSidebarTab === 'voice') html = renderVoiceTab();
  else if (selectedSidebarTab === 'scripts') html = renderScriptsTab();
  else if (selectedSidebarTab === 'advanced') html = renderAdvancedTab();
  else if (selectedSidebarTab === 'gamestate') html = renderGameStateTab();
  else html = renderShareTab();

  const markup = typeof html === 'string' ? html.trim() : '';
  replaceMarkup(sidebarContent, markup);
  if (resetScroll && sidebarContent) sidebarContent.scrollTop = 0;
}

function librarySystemTree() {
  const tree = new Map();
  libraryBooks.forEach((book) => {
    const system = book.metadata?.system || 'Unknown';
    const edition = book.metadata?.edition || 'Standard';
    if (!tree.has(system)) tree.set(system, new Set());
    tree.get(system).add(edition);
  });
  return Array.from(tree.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function filteredLibraryBooks() {
  const q = librarySearchQuery.trim().toLowerCase();
  return libraryBooks.filter((book) => {
    const system = (book.metadata?.system || '').toLowerCase();
    const edition = (book.metadata?.edition || '').toLowerCase();
    const matchesSearch =
      !q ||
      book.name.toLowerCase().includes(q) ||
      system.includes(q) ||
      edition.includes(q);
    const matchesSystem =
      selectedSystemFilter === 'All' || (book.metadata?.system || 'Unknown') === selectedSystemFilter;
    const matchesEdition =
      selectedEditionFilter === 'All' || (book.metadata?.edition || 'Standard') === selectedEditionFilter;
    return matchesSearch && matchesSystem && matchesEdition;
  });
}

function renderLibrarySystemList() {
  const tree = librarySystemTree();
  const systemsHtml = tree
    .map(([system, editions]) => {
      const isSystemActive = selectedSystemFilter === system && selectedEditionFilter === 'All';
      const isExpanded = expandedSystems.has(system);
      const editionsHtml = Array.from(editions)
        .sort()
        .map((edition) => {
          const isEditionActive =
            selectedSystemFilter === system && selectedEditionFilter === edition;
          return `<button class="item-btn rag-edition-item ${isEditionActive ? 'is-active' : ''}" data-library-select data-library-system="${escapeHtml(system)}" data-library-edition="${escapeHtml(edition)}"><span>${escapeHtml(edition)}</span></button>`;
        })
        .join('');

      return `
        <div class="rag-tree-node">
          <div class="rag-system-row ${isSystemActive ? 'is-active' : ''}">
            <button class="icon-btn rag-tree-toggle" data-library-toggle="${escapeHtml(system)}" aria-label="Toggle ${escapeHtml(system)}">
              <span class="rag-tree-icon-wrap" style="transform:${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}">▶</span>
            </button>
            <button class="item-btn rag-system-name" data-library-select data-library-system="${escapeHtml(system)}" data-library-edition="All">
              <span>${escapeHtml(system)}</span>
            </button>
          </div>
          ${isExpanded ? `<div class="rag-edition-list">${editionsHtml}</div>` : ''}
        </div>
      `;
    })
    .join('');

  replaceMarkup(librarySystemList, `
    <button class="item-btn rag-system-item ${selectedSystemFilter === 'All' ? 'is-active' : ''}" data-library-select data-library-system="All" data-library-edition="All">
      <span>▦</span>
      <span>All Documents</span>
    </button>
    <div class="rag-sidebar-separator"></div>
    ${systemsHtml}
  `);
}

function renderLibraryContentArea() {
  if (!libraryContentArea || !libraryGridBtn || !libraryListBtn || !libraryToolbarInfo || !libraryStats) return;
  const filtered = filteredLibraryBooks();
  libraryContentArea.classList.toggle('is-grid', libraryViewMode === 'grid');
  libraryContentArea.classList.toggle('is-list', libraryViewMode === 'list');
  libraryGridBtn.classList.toggle('active', libraryViewMode === 'grid');
  libraryListBtn.classList.toggle('active', libraryViewMode === 'list');
  libraryToolbarInfo.textContent = `Showing ${filtered.length} rulebooks`;
  libraryStats.textContent = `${libraryBooks.length} Books`;

  if (!filtered.length) {
    replaceMarkup(libraryContentArea, `
      <div class="rag-empty-state empty-state">
        <div class="rag-empty-book-icon">${TAB_ICONS.book}</div>
        <p>${librarySearchQuery ? 'No rulebooks match your search.' : 'Your library is empty.'}</p>
        ${librarySearchQuery ? '' : '<button class="item-btn rag-add-doc-btn">Upload your first PDF</button>'}
      </div>
    `);
    return;
  }

  const markup = filtered
    .map((book) => {
      const system = book.metadata?.system || '';
      const edition = book.metadata?.edition || '';
      const isEditing = editingLibraryBookId === book.id;

      if (isEditing) {
        return `
          <div class="panel-shell ds-settings-card rag-book-card is-editing">
            <div class="rag-book-edit-form">
              <div class="rag-edit-field">
                <span class="rag-label">Name</span>
                <input class="control-field" type="text" data-library-edit-field="name" value="${escapeHtml(editingLibraryBookDraft.name)}" />
              </div>
              <div class="rag-edit-meta-grid">
                <div class="rag-edit-field">
                  <span class="rag-label">System</span>
                  <input class="control-field" type="text" data-library-edit-field="system" value="${escapeHtml(editingLibraryBookDraft.system)}" />
                </div>
                <div class="rag-edit-field">
                  <span class="rag-label">Edition</span>
                  <input class="control-field" type="text" data-library-edit-field="edition" value="${escapeHtml(editingLibraryBookDraft.edition)}" />
                </div>
              </div>
              <div class="rag-edit-actions">
                <button class="item-btn" data-library-action="save-edit" data-library-book-id="${book.id}">Save</button>
                <button class="item-btn" data-library-action="cancel-edit">Cancel</button>
              </div>
            </div>
          </div>
        `;
      }

      return `
        <div class="panel-shell ds-settings-card rag-book-card">
          <div class="rag-book-card-main">
            <div class="rag-book-icon">${TAB_ICONS.book}</div>
            <div class="rag-book-details">
              <span class="rag-book-name" title="${escapeHtml(book.name)}">${escapeHtml(book.name)}</span>
              <div class="rag-book-badges">
                ${system ? `<span class="rag-badge system">${escapeHtml(system)}</span>` : ''}
                ${edition ? `<span class="rag-badge edition">${escapeHtml(edition)}</span>` : ''}
                <span class="rag-badge chunks">${book.chunkCount ?? 0} chunks</span>
              </div>
            </div>
          </div>
          <div class="action-rail rag-book-actions">
            <button class="chrome-btn icon-btn rag-action-btn ${book.priority ? 'is-priority' : ''}" data-library-action="toggle-priority" data-library-book-id="${book.id}" aria-label="Toggle Priority" title="Toggle Priority">★</button>
            <button class="chrome-btn icon-btn rag-action-btn" data-library-action="edit" data-library-book-id="${book.id}" aria-label="Edit Rulebook" title="Edit Rulebook">✎</button>
            <button class="chrome-btn icon-btn rag-action-btn rag-delete-btn-card" data-library-action="delete" data-library-book-id="${book.id}" aria-label="Delete Rulebook" title="Delete Rulebook">🗑</button>
          </div>
        </div>
      `;
    })
    .join('');
  replaceMarkup(libraryContentArea, markup);
}

function renderLibraryView() {
  renderLibrarySystemList();
  renderLibraryContentArea();
}

function renderPlaygroundToolPanel(toolKey) {
  if (toolKey === 'chat') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Chat</h2>
        <p class="small-muted">Utility chat session surface from the original app playground.</p>
        <div class="playground-stack">
          <label class="playground-label">System Prompt</label>
          <textarea class="playground-control control-field" rows="4">You are assistant.</textarea>
          <label class="playground-label">Message</label>
          <textarea class="playground-control control-field" rows="5"></textarea>
          <button class="item-btn">Run</button>
        </div>
      </div>
    `;
  }

  if (toolKey === 'docs') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">CBS Docs Beta</h2>
        <input class="playground-control control-field" type="search" placeholder="Search documentation..." />
        <div class="playground-card-list">
          <article class="panel-shell playground-doc-card">
            <h3 class="playground-doc-title">example_function</h3>
            <p class="small-muted">Example function description from CBS docs.</p>
            <div class="playground-tag-row">
              <span class="playground-tag">alias_one</span>
              <span class="playground-tag">alias_two</span>
            </div>
          </article>
        </div>
      </div>
    `;
  }

  if (toolKey === 'embedding') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Embedding</h2>
        <div class="playground-stack">
          <label class="playground-label">Model</label>
          <select class="playground-control control-field"><option>MiniLM</option><option>OpenAI 3 Small</option><option>OpenAI 3 Large</option><option>Custom</option></select>
          <label class="playground-label">Query</label>
          <input class="playground-control control-field" type="text" />
          <label class="playground-label">Data</label>
          <input class="playground-control control-field" type="text" />
          <input class="playground-control control-field" type="text" />
          <button class="item-btn" aria-label="Add embedding input row" title="Add input row">+</button>
          <label class="playground-label">Result</label>
          <div class="playground-kv-row"><span>No result</span><span>-</span></div>
          <button class="item-btn active">RUN</button>
        </div>
      </div>
    `;
  }

  if (toolKey === 'tokenizer') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Tokenizer</h2>
        <div class="playground-stack">
          <label class="playground-label">Tokenizer</label>
          <select class="playground-control control-field"><option>tik</option><option>cl100k_base</option><option>llama</option></select>
          <label class="playground-label">Input</label>
          <textarea class="playground-control control-field" rows="5"></textarea>
          <label class="playground-label">Result</label>
          <textarea class="playground-control control-field" rows="5"></textarea>
          <span class="small-muted">0 tokens</span>
          <span class="small-muted">0 ms</span>
        </div>
      </div>
    `;
  }

  if (toolKey === 'syntax') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Syntax</h2>
        <div class="playground-stack">
          <label class="playground-label">Input</label>
          <textarea class="playground-control control-field" rows="6"></textarea>
          <label class="playground-label">Result</label>
          <textarea class="playground-control control-field" rows="6"></textarea>
        </div>
      </div>
    `;
  }

  if (toolKey === 'parser') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Full Parser</h2>
        <div class="playground-stack">
          <label class="playground-label">Input</label>
          <textarea class="playground-control control-field" rows="6"></textarea>
          <label class="playground-label">Output HTML</label>
          <textarea class="playground-control control-field" rows="6"></textarea>
        </div>
      </div>
    `;
  }

  if (toolKey === 'subtitles') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Subtitles</h2>
        <div class="playground-stack">
          <label class="playground-label">Mode</label>
          <select class="playground-control control-field"><option>LLM</option><option>Whisper</option><option>Whisper Local</option></select>
          <label class="playground-label">Target Language</label>
          <select class="playground-control control-field"><option>English</option><option>Korean</option><option>Japanese</option></select>
          <label class="playground-label">Prompt</label>
          <textarea class="playground-control control-field" rows="6"></textarea>
          <button class="item-btn">Run</button>
          <label class="playground-label">Output</label>
          <textarea class="playground-control control-field" rows="8"></textarea>
        </div>
      </div>
    `;
  }

  if (toolKey === 'imageTranslation') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Image Translation</h2>
        <div class="playground-stack">
          <label class="playground-label">Mode</label>
          <select class="playground-control control-field"><option>auto</option><option>manual</option></select>
          <label class="playground-label">Language</label>
          <select class="playground-control control-field"><option>English</option><option>Japanese</option><option>Korean</option></select>
          <label class="playground-label">Prompt</label>
          <textarea class="playground-control control-field" rows="5"></textarea>
          <div class="playground-image-canvas">Canvas Preview</div>
          <button class="item-btn">Translate</button>
          <label class="playground-label">Output</label>
          <textarea class="playground-control control-field" rows="8"></textarea>
        </div>
      </div>
    `;
  }

  if (toolKey === 'translator') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Translator</h2>
        <div class="playground-stack">
          <label class="playground-label">Source Language</label>
          <select class="playground-control control-field"><option>English</option><option>Japanese</option><option>Korean</option></select>
          <textarea class="playground-control control-field" rows="6"></textarea>
          <label class="playground-label">Translator Language</label>
          <select class="playground-control control-field"><option>English</option><option>Japanese</option><option>Korean</option></select>
          <textarea class="playground-control control-field" rows="6"></textarea>
          <label class="playground-check-row"><input type="checkbox" /> <span>Bulk</span></label>
          <label class="playground-check-row"><input type="checkbox" /> <span>Keep Context</span></label>
          <button class="item-btn">Translate</button>
          <button class="item-btn">Clear Cache</button>
        </div>
      </div>
    `;
  }

  if (toolKey === 'mcp') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">MCP</h2>
        <div class="playground-stack">
          <label class="playground-label">Metadatas</label>
          <textarea class="playground-control control-field" rows="6"></textarea>
          <label class="playground-label">Tools</label>
          <div class="panel-shell playground-doc-card">
            <h3 class="playground-doc-title">${settingLabel('toolName')}</h3>
            <p class="small-muted">${settingLabel('toolDescription')}</p>
            <pre class="playground-pre">{ "inputSchema": "..." }</pre>
            <textarea class="playground-control control-field" rows="3" placeholder="Input for this tool"></textarea>
            <button class="item-btn">Execute ${settingLabel('toolName')}</button>
          </div>
          <button class="item-btn">Refresh</button>
        </div>
      </div>
    `;
  }

  if (toolKey === 'inlayExplorer') {
    return `
      <div class="playground-panel">
        <h2 class="playground-panel-title">Inlay Asset Explorer</h2>
        <div class="playground-inline-actions">
          <span class="small-muted">Total 0 assets</span>
          <button class="item-btn">Select All</button>
        </div>
        <div class="playground-asset-grid">
          <article class="panel-shell playground-asset-card">
            <div class="playground-tag-row"><span class="playground-tag">image</span></div>
            <div class="playground-image-canvas">Preview</div>
            <p class="playground-doc-title">asset-name.png</p>
            <p class="small-muted">1024x1024 • 128 KB</p>
            <button class="item-btn">Delete</button>
          </article>
        </div>
      </div>
    `;
  }

  return `
    <div class="playground-panel">
      <h2 class="playground-panel-title">Playground</h2>
    </div>
  `;
}

function renderPlaygroundView() {
  if (!playgroundContent) return;

  if (selectedPlaygroundTool === 'menu') {
    const toolButtons = PLAYGROUND_TOOLS
      .map((tool) => `<button class="panel-shell playground-tool-card ${tool.wide ? 'playground-tool-card-wide' : ''}" data-playground-tool="${tool.key}">${escapeHtml(tool.label)}</button>`)
      .join('');
    replaceMarkup(playgroundContent, `
      <div class="playground-menu-root">
        <h2 class="playground-title">Playground</h2>
        <div class="playground-tool-grid">${toolButtons}</div>
      </div>
    `);
    return;
  }

  const tool = PLAYGROUND_TOOLS.find((item) => item.key === selectedPlaygroundTool);
  replaceMarkup(playgroundContent, `
    <div class="playground-detail-root">
      <div class="playground-detail-head">
        <button class="chrome-btn drawer-close-btn" data-playground-back aria-label="Back to Playground Menu">←</button>
        <h2>${escapeHtml(tool?.label ?? 'Playground')}</h2>
      </div>
      ${renderPlaygroundToolPanel(selectedPlaygroundTool)}
    </div>
  `);
}

function renderMessages(chatId) {
  const messages = threadByChatId[chatId] ?? [];
  const markup = messages
    .map(
      (msg) => `
        <article class="message ${msg.role}">
          <div>${escapeHtml(msg.content)}</div>
          <div class="meta">${msg.role.toUpperCase()} • ${escapeHtml(msg.time)}</div>
        </article>
      `,
    )
    .join('');
  replaceMarkup(messageList, markup);
  if (messageList) messageList.scrollTop = messageList.scrollHeight;
}

function renderSidebarProfile() {
  const character = characters.find((item) => item.id === selectedCharacterId);
  const chat = chats.find((item) => item.id === selectedChatId);
  if (sidebarProfileAvatar) {
    if (character) {
      replaceMarkup(
        sidebarProfileAvatar,
        `<img class="sidebar-profile-avatar-img" src="${escapeHtml(characterImageSrc(character))}" alt="" loading="lazy" />`,
      );
    } else {
      replaceMarkup(sidebarProfileAvatar, '?');
    }
  }
  if (sidebarProfileName) sidebarProfileName.textContent = character?.name || 'Unknown Character';
  if (sidebarProfileArchetype) sidebarProfileArchetype.textContent = character?.archetype || 'No archetype';
  if (sidebarProfileChat) sidebarProfileChat.textContent = chat ? `Active chat: ${chat.title}` : 'No active chat';
}

function renderChatRuntime() {
  const character = characters.find((c) => c.id === selectedCharacterId);
  const chat = chats.find((c) => c.id === selectedChatId);

  if (chatTitle) chatTitle.textContent = chat?.title ?? 'Chat';
  if (chatMeta) chatMeta.textContent = `${character?.name ?? 'Unknown'} • ${chat?.turns ?? 0} turns • ${chat?.updatedAt ?? '-'}`;
  renderMessages(selectedChatId);
  renderSidebarProfile();
}

function enterHomeView() {
  if (!topbarSubtitle) console.warn('[enterHomeView] missing topbarSubtitle');
  else topbarSubtitle.textContent = 'Character Library';
  if (!topSidebarBtn) console.warn('[enterHomeView] missing topSidebarBtn');
  else topSidebarBtn.classList.add('hidden');
  if (handleMissingTopLevelViews('enterHomeView', homeView)) return;
  setShellSearchMode('home');
  homeView.classList.remove('hidden');
  chatView.classList.add('hidden');
  libraryView.classList.add('hidden');
  playgroundView.classList.add('hidden');
  settingsView.classList.add('hidden');
  setWorkspaceNavActive('characters');
  closeAllDrawers();
  renderGlobalRecentChats();
  renderCharacterGrid();
}

function enterChatView({ workspaceNav = 'characters' } = {}) {
  if (!topbarSubtitle) console.warn('[enterChatView] missing topbarSubtitle');
  if (!topSidebarBtn) console.warn('[enterChatView] missing topSidebarBtn');
  if (!selectedCharacterId) {
    enterHomeView();
    return;
  }
  if (!selectedChatId) {
    ensureSelectedChatForCharacter();
    if (!selectedChatId) {
      enterHomeView();
      return;
    }
  }

  if (topbarSubtitle) topbarSubtitle.textContent = 'Chat Runtime';
  if (topSidebarBtn) topSidebarBtn.classList.remove('hidden');
  if (handleMissingTopLevelViews('enterChatView', chatView)) return;
  setShellSearchMode('hidden');
  homeView.classList.add('hidden');
  chatView.classList.remove('hidden');
  libraryView.classList.add('hidden');
  playgroundView.classList.add('hidden');
  settingsView.classList.add('hidden');
  setWorkspaceNavActive(workspaceNav);
  renderGlobalRecentChats();

  syncSidebarModeWithTab();
  ensureSidebarTabForMode();
  renderSidebarModeStrip();
  renderSidebarContent({ resetScroll: true });
  renderChatRuntime();
  applyChatDrawerState();
}

function enterLibraryView() {
  if (!topbarSubtitle) console.warn('[enterLibraryView] missing topbarSubtitle');
  else topbarSubtitle.textContent = 'Library';
  if (!topSidebarBtn) console.warn('[enterLibraryView] missing topSidebarBtn');
  else topSidebarBtn.classList.add('hidden');
  if (handleMissingTopLevelViews('enterLibraryView', libraryView)) return;
  setShellSearchMode('library');
  homeView.classList.add('hidden');
  chatView.classList.add('hidden');
  libraryView.classList.remove('hidden');
  playgroundView.classList.add('hidden');
  settingsView.classList.add('hidden');
  setWorkspaceNavActive('library');
  closeAllDrawers();
  renderLibraryView();
}

function enterPlaygroundView() {
  if (!topbarSubtitle) console.warn('[enterPlaygroundView] missing topbarSubtitle');
  else topbarSubtitle.textContent = 'Playground';
  if (!topSidebarBtn) console.warn('[enterPlaygroundView] missing topSidebarBtn');
  else topSidebarBtn.classList.add('hidden');
  if (handleMissingTopLevelViews('enterPlaygroundView', playgroundView)) return;
  setShellSearchMode('hidden');
  homeView.classList.add('hidden');
  chatView.classList.add('hidden');
  libraryView.classList.add('hidden');
  playgroundView.classList.remove('hidden');
  settingsView.classList.add('hidden');
  setWorkspaceNavActive('playground');
  closeAllDrawers();
  renderPlaygroundView();
}

function enterSettingsView() {
  if (!topbarSubtitle) console.warn('[enterSettingsView] missing topbarSubtitle');
  else topbarSubtitle.textContent = 'Settings';
  if (!topSidebarBtn) console.warn('[enterSettingsView] missing topSidebarBtn');
  else topSidebarBtn.classList.add('hidden');
  if (handleMissingTopLevelViews('enterSettingsView', settingsView)) return;
  setShellSearchMode('hidden');
  homeView.classList.add('hidden');
  chatView.classList.add('hidden');
  libraryView.classList.add('hidden');
  playgroundView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  setWorkspaceNavActive('settings');
  closeAllDrawers();
  renderSettingsView();
}

function sendMessage() {
  const text = composerInput.value.trim();
  if (!text || !selectedChatId) return;

  const thread = threadByChatId[selectedChatId] ?? [];
  thread.push({
    id: `${selectedChatId}-u-${Date.now()}`,
    role: 'user',
    content: text,
    time: 'now',
  });

  thread.push({
    id: `${selectedChatId}-a-${Date.now()}`,
    role: 'assistant',
    content: 'Acknowledged. Continuing with the same tone and context for this chat prototype.',
    time: 'now',
  });

  threadByChatId[selectedChatId] = thread;
  const chat = chats.find((item) => item.id === selectedChatId);
  if (chat) {
    chat.turns = Number(chat.turns || 0) + 1;
    chat.updatedAt = 'now';
    chat.preview = thread[thread.length - 1]?.content ?? chat.preview;
  }
  composerInput.value = '';
  renderChatRuntime();
  renderSidebarContent();
  renderGlobalRecentChats();
  renderCharacterGrid();
}

shellSearchInput?.addEventListener('input', () => {
  const config = SHELL_SEARCH_CONFIG[shellSearchMode];
  if (!config) return;
  config.onInput(shellSearchInput.value);
});

globalMenuBtn?.addEventListener('click', () => toggleDrawer(globalDrawer));
closeGlobalDrawerBtn?.addEventListener('click', () => closeDrawer(globalDrawer));

titleHomeBtn?.addEventListener('click', enterHomeView);

characterGrid?.addEventListener('click', (event) => {
  const card = event.target.closest('[data-character]');
  if (!card) return;
  const nextCharacterId = card.dataset.character;
  const didCharacterChange = nextCharacterId !== selectedCharacterId;
  selectedCharacterId = nextCharacterId;
  if (didCharacterChange) {
    resetSidebarCharacterSubpanels();
  }
  ensureSelectedChatForCharacter();
  enterChatView({ workspaceNav: 'characters' });
});

topSidebarBtn?.addEventListener('click', () => toggleDrawer(contextDrawer));
closeContextDrawerBtn?.addEventListener('click', () => closeDrawer(contextDrawer));

globalDrawer?.addEventListener('click', (event) => {
  const recentChatButton = event.target.closest('[data-global-chat-id]');
  if (recentChatButton) {
    const chat = chats.find((item) => item.id === recentChatButton.dataset.globalChatId);
    if (!chat) return;
    const didCharacterChange = selectedCharacterId !== chat.characterId;
    selectedCharacterId = chat.characterId;
    selectedChatId = chat.id;
    lastChatByCharacter[selectedCharacterId] = chat.id;
    selectedSidebarTab = 'chats';
    if (didCharacterChange) resetSidebarCharacterSubpanels();
    enterChatView({ workspaceNav: 'characters' });
    return;
  }

  const button = event.target.closest('[data-workspace-view]');
  if (!button) return;
  const view = button.dataset.workspaceView;
  if (view === 'characters') {
    enterHomeView();
  } else if (view === 'library') {
    enterLibraryView();
  } else if (view === 'playground') {
    enterPlaygroundView();
  } else if (view === 'settings') {
    enterSettingsView();
  }
});

playgroundContent?.addEventListener('click', (event) => {
  const backButton = event.target.closest('[data-playground-back]');
  if (backButton) {
    selectedPlaygroundTool = 'menu';
    renderPlaygroundView();
    return;
  }

  const toolButton = event.target.closest('[data-playground-tool]');
  if (!toolButton) return;
  selectedPlaygroundTool = toolButton.dataset.playgroundTool;
  renderPlaygroundView();
});

sidebarModeStrip?.addEventListener('click', (event) => {
  const modeButton = event.target.closest('[data-sidebar-group]');
  if (modeButton) {
    selectedSidebarMode = modeButton.dataset.sidebarGroup;
    ensureSidebarTabForMode();
    renderSidebarModeStrip();
    renderSidebarContent({ resetScroll: true });
    return;
  }

  const tabButton = event.target.closest('[data-sidebar-tab]');
  if (!tabButton) return;
  selectedSidebarTab = tabButton.dataset.sidebarTab;
  syncSidebarModeWithTab();
  renderSidebarModeStrip();
  renderSidebarContent({ resetScroll: true });
});

sidebarModeStrip?.addEventListener('keydown', (event) => {
  const tabButton = event.target.closest('[data-sidebar-tab]');
  if (!tabButton) return;

  const tabButtons = Array.from(sidebarModeStrip.querySelectorAll('[data-sidebar-tab]'));
  const currentIndex = tabButtons.indexOf(tabButton);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % tabButtons.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + tabButtons.length) % tabButtons.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = tabButtons.length - 1;
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    tabButton.click();
    return;
  } else {
    return;
  }

  event.preventDefault();
  tabButtons[nextIndex].focus();
  tabButtons[nextIndex].click();
});

sidebarContent?.addEventListener('click', (event) => {
  const displaySubmenuBtn = event.target.closest('[data-display-view-submenu]');
  if (displaySubmenuBtn) {
    sidebarDisplayViewSubmenu = Number(displaySubmenuBtn.dataset.displayViewSubmenu);
    renderSidebarContent();
    return;
  }

  const lorebookSubmenuBtn = event.target.closest('[data-lorebook-submenu]');
  if (lorebookSubmenuBtn) {
    sidebarLorebookSubmenu = Number(lorebookSubmenuBtn.dataset.lorebookSubmenu);
    renderSidebarContent();
    return;
  }

  const triggerModeBtn = event.target.closest('[data-trigger-mode]');
  if (triggerModeBtn) {
    sidebarTriggerMode = triggerModeBtn.dataset.triggerMode;
    renderSidebarContent();
    return;
  }

  if (event.target.closest('[data-chat-action]')) {
    return;
  }

  const button = event.target.closest('[data-chat-id]');
  if (!button) return;
  selectChat(button.dataset.chatId);
});

sidebarContent?.addEventListener('keydown', (event) => {
  const row = event.target.closest('[data-chat-id]');
  if (!row || event.target.closest('[data-chat-action]')) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  selectChat(row.dataset.chatId);
});

sidebarContent?.addEventListener('input', (event) => {
  if (event.target.id === 'sidebarChatSearch') {
    sidebarChatQuery = event.target.value;
    renderSidebarContent();
  }
});

sidebarContent?.addEventListener('change', (event) => {
  if (event.target.id === 'sidebarViewScreenMode') {
    sidebarViewScreenMode = event.target.value;
    renderSidebarContent();
    return;
  }

  if (event.target.id === 'sidebarVoiceProvider') {
    sidebarVoiceMode = event.target.value;
    renderSidebarContent();
  }
});

libraryGridBtn?.addEventListener('click', () => {
  libraryViewMode = 'grid';
  renderLibraryContentArea();
});

libraryListBtn?.addEventListener('click', () => {
  libraryViewMode = 'list';
  renderLibraryContentArea();
});

librarySystemList?.addEventListener('click', (event) => {
  const toggle = event.target.closest('[data-library-toggle]');
  if (toggle) {
    const system = toggle.dataset.libraryToggle;
    if (expandedSystems.has(system)) expandedSystems.delete(system);
    else expandedSystems.add(system);
    expandedSystems = new Set(expandedSystems);
    renderLibrarySystemList();
    return;
  }

  const select = event.target.closest('[data-library-select]');
  if (!select) return;
  selectedSystemFilter = select.dataset.librarySystem;
  selectedEditionFilter = select.dataset.libraryEdition;
  renderLibrarySystemList();
  renderLibraryContentArea();
});

libraryContentArea?.addEventListener('click', (event) => {
  const actionBtn = event.target.closest('[data-library-action]');
  if (!actionBtn) return;
  const action = actionBtn.dataset.libraryAction;
  const bookId = actionBtn.dataset.libraryBookId;
  const idx = libraryBooks.findIndex((book) => book.id === bookId);

  if (action === 'toggle-priority' && idx !== -1) {
    libraryBooks[idx].priority = libraryBooks[idx].priority ? 0 : 1;
    renderLibraryContentArea();
    return;
  }

  if (action === 'delete' && idx !== -1) {
    libraryBooks.splice(idx, 1);
    libraryBooks = [...libraryBooks];
    renderLibraryView();
    return;
  }

  if (action === 'edit' && idx !== -1) {
    const book = libraryBooks[idx];
    editingLibraryBookId = book.id;
    editingLibraryBookDraft = {
      name: book.name,
      system: book.metadata?.system || '',
      edition: book.metadata?.edition || '',
    };
    renderLibraryContentArea();
    return;
  }

  if (action === 'cancel-edit') {
    editingLibraryBookId = null;
    renderLibraryContentArea();
    return;
  }

  if (action === 'save-edit' && idx !== -1) {
    const updated = {
      ...libraryBooks[idx],
      name: editingLibraryBookDraft.name,
      metadata: {
        system: editingLibraryBookDraft.system || 'Unknown',
        edition: editingLibraryBookDraft.edition || 'Standard',
      },
    };
    libraryBooks[idx] = updated;
    libraryBooks = [...libraryBooks];
    editingLibraryBookId = null;
    renderLibraryView();
  }
});

libraryContentArea?.addEventListener('input', (event) => {
  const field = event.target.dataset.libraryEditField;
  if (!field) return;
  editingLibraryBookDraft = {
    ...editingLibraryBookDraft,
    [field]: event.target.value,
  };
});

settingsNavPanel?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-settings-menu-index]');
  if (!button) return;
  const nextSettingsMenuIndex = Number(button.dataset.settingsMenuIndex);
  if (!Number.isFinite(nextSettingsMenuIndex)) return;
  if (nextSettingsMenuIndex !== selectedSettingsMenuIndex) {
    resetSettingsSubtabs();
  }
  selectedSettingsMenuIndex = nextSettingsMenuIndex;
  renderSettingsView();
});

settingsNavPanel?.addEventListener('keydown', (event) => {
  const current = event.target.closest('[data-settings-menu-index]');
  if (!current) return;
  const navButtons = Array.from(
    settingsNavPanel.querySelectorAll('[data-settings-menu-index]'),
  );
  const currentIndex = navButtons.indexOf(current);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
    nextIndex = (currentIndex + 1) % navButtons.length;
  } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
    nextIndex = (currentIndex - 1 + navButtons.length) % navButtons.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = navButtons.length - 1;
  } else {
    return;
  }

  event.preventDefault();
  navButtons[nextIndex].focus();
  navButtons[nextIndex].click();
});

settingsContentPanel?.addEventListener('click', (event) => {
  const subtabButton = event.target.closest('[data-settings-subtab-key][data-settings-subtab-index]');
  if (!subtabButton) return;
  const subtabKey = subtabButton.dataset.settingsSubtabKey;
  const subtabIndex = Number(subtabButton.dataset.settingsSubtabIndex);
  if (!Number.isFinite(subtabIndex)) return;
  setSettingsSubtabValue(subtabKey, subtabIndex);
  renderSettingsContentPanel();
});

settingsContentPanel?.addEventListener('keydown', (event) => {
  const current = event.target.closest('[data-settings-subtab-key][data-settings-subtab-index]');
  if (!current) return;

  const tablist = current.closest('[role="tablist"]');
  if (!tablist) return;
  const tabs = Array.from(
    tablist.querySelectorAll('[data-settings-subtab-key][data-settings-subtab-index]'),
  );
  const currentIndex = tabs.indexOf(current);
  if (currentIndex === -1) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    nextIndex = (currentIndex + 1) % tabs.length;
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  } else if (event.key === 'Home') {
    nextIndex = 0;
  } else if (event.key === 'End') {
    nextIndex = tabs.length - 1;
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    current.click();
    return;
  } else {
    return;
  }

  event.preventDefault();
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
});

settingsContentPanel?.addEventListener('change', (event) => {
  const colorSchemeSelect = event.target.closest('[data-setting-color-scheme]');
  if (colorSchemeSelect) {
    applyColorScheme(colorSchemeSelect.value);
  }
});

window.addEventListener('resize', () => {
  if (!settingsView) return;
  if (settingsView.classList.contains('hidden')) return;
  if (selectedSettingsMenuIndex === 15) {
    renderSettingsContentPanel();
  }
});

scrim?.addEventListener('click', closeAllDrawers);

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const anyDrawerOpen =
    globalDrawer?.classList.contains('open') || contextDrawer?.classList.contains('open');
  if (!anyDrawerOpen) return;
  event.preventDefault();
  closeAllDrawers();
});

sendBtn?.addEventListener('click', sendMessage);
composerInput?.addEventListener('keydown', (event) => {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key !== 'Enter') return;
  if (event.shiftKey) return;
  event.preventDefault();
  sendMessage();
});

selectedColorSchemeName = readColorSchemePreference();
applyColorScheme(selectedColorSchemeName, { persist: false });
if (document.documentElement) {
  document.documentElement.style.setProperty(
    '--character-placeholder-image',
    `url("${DEFAULT_CHARACTER_IMAGE_SRC}")`,
  );
}
ensureSelectedChatForCharacter();
enterHomeView();
