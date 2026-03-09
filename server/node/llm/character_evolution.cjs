const DEFAULT_EXTRACTION_PROMPT = [
    'You update a character evolution state after a completed roleplay chat.',
    'Return strict JSON only with keys proposedState and changes.',
    'proposedState must contain the full next state object.',
    'changes must be an array of objects with sectionKey, summary, and evidence.',
    'Use only transcript-supported information.',
    'Do not invent facts.',
    'If nothing changed, keep state unchanged and return an empty changes array.',
    'Only include sections that are enabled and privacy-allowed.',
].join('\n');

const BUILTIN_SECTION_DEFS = [
    { key: 'relationship', label: 'Relationship', instruction: 'Track trust and relationship dynamic shifts only when clearly supported.', kind: 'object', includeInPrompt: true },
    { key: 'activeThreads', label: 'Active Threads', instruction: 'Track unresolved ongoing topics, tensions, promises, and loops.', kind: 'list', includeInPrompt: true },
    { key: 'runningJokes', label: 'Running Jokes', instruction: 'Track recurring jokes or repeated bits that may carry into future chats.', kind: 'list', includeInPrompt: true },
    { key: 'characterLikes', label: 'Character Likes', instruction: 'Track persistent likes expressed or strongly evidenced in chat.', kind: 'list', includeInPrompt: true },
    { key: 'characterDislikes', label: 'Character Dislikes', instruction: 'Track persistent dislikes expressed or strongly evidenced in chat.', kind: 'list', includeInPrompt: true },
    { key: 'characterHabits', label: 'Character Habits', instruction: 'Track repeated habits, rituals, or behavioral patterns.', kind: 'list', includeInPrompt: true },
    { key: 'characterBoundariesPreferences', label: 'Character Boundaries / Preferences', instruction: 'Track non-intimate boundaries, preferences, and comfort rules.', kind: 'list', includeInPrompt: true },
    { key: 'userFacts', label: 'User Facts', instruction: 'Track explicit facts the user revealed about themselves.', kind: 'list', includeInPrompt: true },
    { key: 'userRead', label: 'User Read', instruction: 'Track the character\'s durable interpretation of the user, not fleeting mood reads.', kind: 'list', includeInPrompt: true },
    { key: 'userLikes', label: 'User Likes', instruction: 'Track user likes directly stated or strongly evidenced in chat.', kind: 'list', includeInPrompt: true },
    { key: 'userDislikes', label: 'User Dislikes', instruction: 'Track user dislikes directly stated or strongly evidenced in chat.', kind: 'list', includeInPrompt: true },
    { key: 'lastChatEnded', label: 'Last Chat Ended', instruction: 'Track the ending state and residue that should carry into the next chat.', kind: 'object', includeInPrompt: true },
    { key: 'keyMoments', label: 'Key Moments', instruction: 'Track pivotal moments only when they meaningfully shift the state.', kind: 'list', includeInPrompt: true },
    { key: 'characterIntimatePreferences', label: 'Character Intimate Preferences', instruction: 'Track intimate preferences only when privacy allows it and evidence is explicit.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
    { key: 'userIntimatePreferences', label: 'User Intimate Preferences', instruction: 'Track intimate user preferences only when privacy allows it and evidence is explicit.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
];

function clone(value, fallback = null) {
    try {
        return value === undefined ? fallback : JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function toString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function createDefaultCharacterEvolutionState() {
    return {
        relationship: {
            trustLevel: '',
            dynamic: '',
        },
        activeThreads: [],
        runningJokes: [],
        characterLikes: [],
        characterDislikes: [],
        characterHabits: [],
        characterBoundariesPreferences: [],
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastChatEnded: {
            state: '',
            residue: '',
        },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
    };
}

function createDefaultCharacterEvolutionSectionConfigs() {
    return BUILTIN_SECTION_DEFS.map((section) => ({
        key: section.key,
        label: section.label,
        enabled: section.enabled !== false,
        includeInPrompt: section.includeInPrompt !== false,
        instruction: section.instruction,
        kind: section.kind,
        sensitive: section.sensitive === true,
    }));
}

function createDefaultCharacterEvolutionDefaults() {
    return {
        extractionProvider: 'openrouter',
        extractionModel: '',
        extractionPrompt: DEFAULT_EXTRACTION_PROMPT,
        sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        privacy: {
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        },
    };
}

function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') {
        if (typeof raw === 'string' && raw.trim()) {
            return { value: raw.trim(), status: 'active' };
        }
        return null;
    }
    const value = toString(raw.value);
    if (!value) return null;
    return {
        value,
        confidence: raw.confidence === 'suspected' || raw.confidence === 'likely' || raw.confidence === 'confirmed'
            ? raw.confidence
            : undefined,
        note: toString(raw.note),
        status: raw.status === 'archived' || raw.status === 'corrected' || raw.status === 'active'
            ? raw.status
            : 'active',
        sourceChatId: toString(raw.sourceChatId) || undefined,
        updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : undefined,
    };
}

function normalizeStringList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => toString(item)).filter(Boolean);
}

function normalizeItemList(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => normalizeItem(item)).filter(Boolean);
}

function normalizeCharacterEvolutionState(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    const state = createDefaultCharacterEvolutionState();
    state.relationship = {
        trustLevel: toString(value.relationship?.trustLevel),
        dynamic: toString(value.relationship?.dynamic),
    };
    state.activeThreads = normalizeStringList(value.activeThreads);
    state.runningJokes = normalizeStringList(value.runningJokes);
    state.characterLikes = normalizeItemList(value.characterLikes);
    state.characterDislikes = normalizeItemList(value.characterDislikes);
    state.characterHabits = normalizeItemList(value.characterHabits);
    state.characterBoundariesPreferences = normalizeItemList(value.characterBoundariesPreferences);
    state.userFacts = normalizeItemList(value.userFacts);
    state.userRead = normalizeStringList(value.userRead);
    state.userLikes = normalizeItemList(value.userLikes);
    state.userDislikes = normalizeItemList(value.userDislikes);
    state.lastChatEnded = {
        state: toString(value.lastChatEnded?.state),
        residue: toString(value.lastChatEnded?.residue),
    };
    state.keyMoments = normalizeStringList(value.keyMoments);
    state.characterIntimatePreferences = normalizeItemList(value.characterIntimatePreferences);
    state.userIntimatePreferences = normalizeItemList(value.userIntimatePreferences);
    return state;
}

function normalizeCharacterEvolutionSectionConfigs(raw) {
    const defaults = createDefaultCharacterEvolutionSectionConfigs();
    const rawSections = Array.isArray(raw) ? raw : [];
    const rawMap = new Map();
    for (const section of rawSections) {
        if (!section || typeof section !== 'object') continue;
        const key = toString(section.key);
        if (!key) continue;
        rawMap.set(key, section);
    }
    return defaults.map((section) => {
        const override = rawMap.get(section.key) || {};
        return {
            ...section,
            label: toString(override.label) || section.label,
            enabled: override.enabled === undefined ? section.enabled : override.enabled === true,
            includeInPrompt: override.includeInPrompt === undefined ? section.includeInPrompt : override.includeInPrompt === true,
            instruction: toString(override.instruction) || section.instruction,
            sensitive: override.sensitive === undefined ? section.sensitive : override.sensitive === true,
        };
    });
}

function normalizeCharacterEvolutionPrivacy(raw) {
    const value = (raw && typeof raw === 'object') ? raw : {};
    return {
        allowCharacterIntimatePreferences: value.allowCharacterIntimatePreferences === true,
        allowUserIntimatePreferences: value.allowUserIntimatePreferences === true,
    };
}

function normalizeCharacterEvolutionDefaults(raw) {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === 'object') ? raw : {};
    return {
        extractionProvider: toString(value.extractionProvider) || defaults.extractionProvider,
        extractionModel: toString(value.extractionModel),
        extractionPrompt: toString(value.extractionPrompt) || defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
    };
}

function normalizeCharacterEvolutionSettings(raw) {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === 'object') ? raw : {};
    return {
        enabled: value.enabled === true,
        useGlobalDefaults: value.useGlobalDefaults !== false,
        extractionProvider: toString(value.extractionProvider) || defaults.extractionProvider,
        extractionModel: toString(value.extractionModel),
        extractionPrompt: toString(value.extractionPrompt) || defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
        currentStateVersion: Number.isFinite(Number(value.currentStateVersion)) ? Math.max(0, Math.floor(Number(value.currentStateVersion))) : 0,
        currentState: normalizeCharacterEvolutionState(value.currentState),
        pendingProposal: value.pendingProposal && typeof value.pendingProposal === 'object'
            ? {
                proposalId: toString(value.pendingProposal.proposalId),
                sourceChatId: toString(value.pendingProposal.sourceChatId),
                proposedState: normalizeCharacterEvolutionState(value.pendingProposal.proposedState),
                changes: Array.isArray(value.pendingProposal.changes)
                    ? value.pendingProposal.changes
                        .map((change) => {
                            if (!change || typeof change !== 'object') return null;
                            const sectionKey = toString(change.sectionKey);
                            if (!sectionKey) return null;
                            return {
                                sectionKey,
                                summary: toString(change.summary),
                                evidence: normalizeStringList(change.evidence),
                            };
                        })
                        .filter(Boolean)
                    : [],
                createdAt: Number.isFinite(Number(value.pendingProposal.createdAt)) ? Number(value.pendingProposal.createdAt) : 0,
            }
            : null,
        lastProcessedChatId: toString(value.lastProcessedChatId) || null,
        stateVersions: Array.isArray(value.stateVersions)
            ? value.stateVersions
                .map((entry) => {
                    if (!entry || typeof entry !== 'object') return null;
                    const version = Number(entry.version);
                    if (!Number.isFinite(version)) return null;
                    return {
                        version: Math.max(0, Math.floor(version)),
                        chatId: toString(entry.chatId) || null,
                        acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    };
                })
                .filter(Boolean)
            : [],
    };
}

function getEffectiveCharacterEvolutionSettings(settings, character) {
    const defaults = normalizeCharacterEvolutionDefaults(settings?.characterEvolutionDefaults);
    const evolution = normalizeCharacterEvolutionSettings(character?.characterEvolution);
    if (!evolution.useGlobalDefaults) {
        return evolution;
    }
    return {
        ...evolution,
        extractionProvider: defaults.extractionProvider,
        extractionModel: defaults.extractionModel,
        extractionPrompt: defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(defaults.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(defaults.privacy),
    };
}

function itemToLine(item) {
    const note = toString(item.note) ? ` (${toString(item.note)})` : '';
    const confidence = toString(item.confidence) ? ` [${toString(item.confidence)}]` : '';
    return `- ${toString(item.value)}${confidence}${note}`;
}

function renderCharacterEvolutionStateForPrompt(stateRaw, sectionConfigsRaw, privacyRaw) {
    const state = normalizeCharacterEvolutionState(stateRaw);
    const sectionConfigs = normalizeCharacterEvolutionSectionConfigs(sectionConfigsRaw);
    const privacy = normalizeCharacterEvolutionPrivacy(privacyRaw);
    const lines = [];

    const pushSection = (label, content) => {
        const filtered = (Array.isArray(content) ? content : []).map((value) => toString(value)).filter(Boolean);
        if (filtered.length === 0) return;
        lines.push(label);
        lines.push(...filtered);
        lines.push('');
    };

    for (const section of sectionConfigs) {
        if (!section.enabled || !section.includeInPrompt) continue;
        if (section.key === 'characterIntimatePreferences' && !privacy.allowCharacterIntimatePreferences) continue;
        if (section.key === 'userIntimatePreferences' && !privacy.allowUserIntimatePreferences) continue;

        switch (section.key) {
            case 'relationship':
                pushSection(section.label, [
                    state.relationship.trustLevel ? `Trust level: ${state.relationship.trustLevel}` : '',
                    state.relationship.dynamic ? `Dynamic: ${state.relationship.dynamic}` : '',
                ]);
                break;
            case 'activeThreads':
            case 'runningJokes':
            case 'keyMoments':
            case 'userRead':
                pushSection(section.label, state[section.key].map((item) => `- ${item}`));
                break;
            case 'lastChatEnded':
                pushSection(section.label, [
                    state.lastChatEnded.state ? `State: ${state.lastChatEnded.state}` : '',
                    state.lastChatEnded.residue ? `Residue: ${state.lastChatEnded.residue}` : '',
                ]);
                break;
            default:
                pushSection(section.label, state[section.key]
                    .filter((item) => item.status !== 'archived')
                    .map((item) => itemToLine(item)));
                break;
        }
    }

    if (lines.length === 0) return '';
    return ['<CharacterEvolutionState>', ...lines, '</CharacterEvolutionState>'].join('\n').trim();
}

function isEvolutionSectionAllowed(section, privacy) {
    if (!section || section.enabled !== true) return false;
    if (section.key === 'characterIntimatePreferences' && !privacy.allowCharacterIntimatePreferences) return false;
    if (section.key === 'userIntimatePreferences' && !privacy.allowUserIntimatePreferences) return false;
    return true;
}

function sanitizeStateForEvolution(stateRaw, evolutionSettings) {
    const state = normalizeCharacterEvolutionState(stateRaw);
    const defaults = createDefaultCharacterEvolutionState();
    const privacy = normalizeCharacterEvolutionPrivacy(evolutionSettings?.privacy);
    const allowedKeys = new Set(
        normalizeCharacterEvolutionSectionConfigs(evolutionSettings?.sectionConfigs)
            .filter((section) => isEvolutionSectionAllowed(section, privacy))
            .map((section) => section.key)
    );

    for (const key of Object.keys(defaults)) {
        if (allowedKeys.has(key)) continue;
        state[key] = clone(defaults[key], defaults[key]);
    }
    return state;
}

function chatMessageToTranscriptLine(message, characterName, userName) {
    if (!message || typeof message !== 'object' || message.disabled === true) return '';
    const role = toString(message.role).toLowerCase();
    const label = role === 'user'
        ? (userName || 'User')
        : (characterName || 'Character');
    const content = toString(message.data) || toString(message.content);
    if (!content) return '';
    return `${label}: ${content}`;
}

function buildCharacterEvolutionPromptMessages(arg = {}) {
    const settings = arg.settings || {};
    const character = arg.character || {};
    const chat = arg.chat || {};
    const evolution = getEffectiveCharacterEvolutionSettings(settings, character);
    const transcriptLines = Array.isArray(chat.message)
        ? chat.message.map((message) => chatMessageToTranscriptLine(message, toString(character.name), toString(settings.username))).filter(Boolean)
        : [];
    const sections = evolution.sectionConfigs
        .filter((section) => section.enabled)
        .filter((section) => section.key !== 'characterIntimatePreferences' || evolution.privacy.allowCharacterIntimatePreferences)
        .filter((section) => section.key !== 'userIntimatePreferences' || evolution.privacy.allowUserIntimatePreferences)
        .map((section) => [
            `- key: ${section.key}`,
            `  label: ${section.label}`,
            `  kind: ${section.kind}`,
            `  includeInPrompt: ${section.includeInPrompt ? 'true' : 'false'}`,
            `  instruction: ${section.instruction}`,
        ].join('\n'))
        .join('\n');

    const state = JSON.stringify(normalizeCharacterEvolutionState(evolution.currentState), null, 2);
    const identity = [
        `Name: ${toString(character.name)}`,
        'Description:',
        toString(character.desc) || '[empty]',
        '',
        'Personality:',
        toString(character.personality) || '[empty]',
    ].join('\n');

    const prompt = [
        evolution.extractionPrompt,
        '',
        'Enabled sections:',
        sections || '[none]',
        '',
        'Identity context:',
        identity,
        '',
        'Current state JSON:',
        state,
        '',
        'Chat transcript:',
        transcriptLines.join('\n') || '[empty]',
    ].join('\n');

    return [
        { role: 'system', content: 'You are a strict structured extraction engine. Return JSON only.' },
        { role: 'user', content: prompt },
    ];
}

function safeParseEvolutionJson(text) {
    const source = typeof text === 'string' ? text.trim() : '';
    if (!source) return null;
    const candidates = [
        source,
        source.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, ''),
    ];
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {}
    }
    const start = source.indexOf('{');
    const end = source.lastIndexOf('}');
    if (start >= 0 && end > start) {
        try {
            return JSON.parse(source.slice(start, end + 1));
        } catch {}
    }
    return null;
}

function normalizeCharacterEvolutionProposal(raw, evolutionSettings) {
    const payload = (raw && typeof raw === 'object') ? raw : {};
    const privacy = normalizeCharacterEvolutionPrivacy(evolutionSettings?.privacy);
    const allowedSections = new Set(
        normalizeCharacterEvolutionSectionConfigs(evolutionSettings?.sectionConfigs)
            .filter((section) => isEvolutionSectionAllowed(section, privacy))
            .map((section) => section.key)
    );
    return {
        proposedState: sanitizeStateForEvolution(payload.proposedState || evolutionSettings.currentState, evolutionSettings),
        changes: Array.isArray(payload.changes)
            ? payload.changes
                .map((change) => {
                    if (!change || typeof change !== 'object') return null;
                    const sectionKey = toString(change.sectionKey);
                    if (!sectionKey || !allowedSections.has(sectionKey)) return null;
                    return {
                        sectionKey,
                        summary: toString(change.summary),
                        evidence: normalizeStringList(change.evidence),
                    };
                })
                .filter(Boolean)
            : [],
    };
}

module.exports = {
    createDefaultCharacterEvolutionState,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionDefaults,
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionSettings,
    normalizeCharacterEvolutionState,
    normalizeCharacterEvolutionSectionConfigs,
    normalizeCharacterEvolutionPrivacy,
    getEffectiveCharacterEvolutionSettings,
    renderCharacterEvolutionStateForPrompt,
    buildCharacterEvolutionPromptMessages,
    safeParseEvolutionJson,
    normalizeCharacterEvolutionProposal,
    sanitizeStateForEvolution,
    clone,
};
