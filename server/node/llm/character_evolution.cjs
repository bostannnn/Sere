const { applyPromptVars } = require('./scripts.cjs');

const DEFAULT_EXTRACTION_PROMPT = [
    'You update a character evolution state after a completed roleplay chat.',
    '',
    'Return raw JSON only with keys proposedState and changes.',
    'Do not use markdown.',
    'Do not use code fences.',
    '',
    'proposedState:',
    '- must contain the full next state object',
    '- must use the exact keys and structure from Current state JSON',
    '- must preserve unchanged fields exactly as received',
    '- must not add new keys or rename keys',
    '',
    'changes:',
    '- must be an array of objects with sectionKey, summary, and evidence',
    '- include only sections that actually changed in proposedState',
    '- never list a section in changes if proposedState for that section is unchanged or empty',
    '- every changes entry must have at least one non-empty evidence string',
    '- evidence must be short transcript-supported quotes or paraphrases',
    '',
    'Global rules:',
    '- Use only transcript-supported information.',
    '- Do not invent facts.',
    '- Do not use character card identity context as evidence for new changes.',
    '- Prefer no change over weak inference.',
    '- If nothing changed, return the current state unchanged and return an empty changes array.',
    '- Only update enabled and privacy-allowed sections.',
    '- Keep changes small and durable; do not overreact to one-off lines.',
    '- Maximum 3 to 6 changed sections unless the transcript clearly supports more.',
    '- When preserving existing item objects, keep their existing fields intact.',
    '',
    'Schema rules:',
    '- relationship and lastChatEnded are objects',
    '- activeThreads, runningJokes, userRead, and keyMoments are arrays of strings',
    '- characterLikes, characterDislikes, characterHabits, characterBoundariesPreferences, userFacts, userLikes, userDislikes, characterIntimatePreferences, and userIntimatePreferences are arrays of item objects',
    '- userRead must be an array of strings, never objects',
    '- if userRead is listed in changes, proposedState.userRead must contain at least one new string',
    '',
    'Field discipline:',
    '- userFacts = neutral, explicit facts about {{user}} only',
    '- never put fantasies, desires, kinks, interpretations, opinions, or relationship judgments into userFacts',
    '- userRead = {{char}}\'s subjective interpretation of {{user}} only',
    '- userLikes and userDislikes = explicit or strongly evidenced preferences only',
    '- characterIntimatePreferences and userIntimatePreferences = explicit sexual or erotic preferences only',
    '- do not move sexual fantasies or erotic requests into userFacts',
    '- do not add broad intimate preference labels if the transcript only supports a narrower act',
    '- do not add \'will allow it\', \'probably likes\', or other speculative intimate entries',
    '',
    'For item objects, use:',
    '- value: string',
    '- confidence: suspected | likely | confirmed when applicable',
    '- note: brief evidence/context when applicable',
    '- status: preserve existing status unless there is a clear reason to change it',
].join('\n');

const BUILTIN_SECTION_DEFS = [
    { key: 'relationship', label: 'Relationship', instruction: 'Update only on durable relationship shifts supported by repeated signals or a clear pivotal moment. Do not change for one flirt, one argument, or one sex act alone.', kind: 'object', includeInPrompt: true },
    { key: 'activeThreads', label: 'Active Threads', instruction: 'Keep unresolved loops only. Add only clear open loops, tensions, promises, or unanswered questions. Do not add vague themes unless they are clearly left hanging.', kind: 'list', includeInPrompt: true },
    { key: 'runningJokes', label: 'Running Jokes', instruction: 'Add only jokes or callbacks that are repeated, explicitly revisited, or clearly framed as recurring. Do not turn one-off banter into a running joke.', kind: 'list', includeInPrompt: true },
    { key: 'characterLikes', label: 'Character Likes', instruction: 'Track persistent likes only if explicitly stated or strongly evidenced more than once in this chat. Do not preserve from identity context alone.', kind: 'list', includeInPrompt: true },
    { key: 'characterDislikes', label: 'Character Dislikes', instruction: 'Track persistent dislikes only if explicitly stated or strongly evidenced in this chat. Do not preserve from identity context alone. Do not confuse moral opinions with stable dislikes unless clearly personal.', kind: 'list', includeInPrompt: true },
    { key: 'characterHabits', label: 'Character Habits', instruction: 'Track repeated habits or clear behavioral patterns shown in this chat. Do not add habits from a single isolated action unless it is strongly characteristic.', kind: 'list', includeInPrompt: true },
    { key: 'characterBoundariesPreferences', label: 'Character Boundaries / Preferences', instruction: 'Track non-intimate boundaries, comfort rules, and control preferences only. Do not mix in sexual preferences. Add only when explicitly stated, enforced, or clearly demonstrated in this chat.', kind: 'list', includeInPrompt: true },
    { key: 'userFacts', label: 'User Facts', instruction: 'Track neutral, explicit user facts only. No interpretations, fantasies, kinks, opinions, relationship judgments, or emotional reads. Work history, plans, locations, routines, and concrete life details belong here.', kind: 'list', includeInPrompt: true },
    { key: 'userRead', label: 'User Read', instruction: 'Track {{char}}\'s durable subjective interpretation of {{user}} as short strings only. Not facts. Not objects. Add only if clearly shown by {{char}}\'s words, stance, or repeated framing in this chat.', kind: 'list', includeInPrompt: true },
    { key: 'userLikes', label: 'User Likes', instruction: 'Track non-intimate user likes directly stated or strongly evidenced in this chat. Sexual fantasies, erotic requests, or kink preferences belong in userIntimatePreferences, not here.', kind: 'list', includeInPrompt: true },
    { key: 'userDislikes', label: 'User Dislikes', instruction: 'Track non-intimate user dislikes directly stated or strongly evidenced in this chat. Do not turn existential distress or relationship tension into a dislike unless the user clearly frames it that way.', kind: 'list', includeInPrompt: true },
    { key: 'lastChatEnded', label: 'Last Chat Ended', instruction: 'Describe only how the chat actually ended and what should carry into the next one. Do not summarize the whole conversation here.', kind: 'object', includeInPrompt: true },
    { key: 'keyMoments', label: 'Key Moments', instruction: 'Only add moments that materially changed trust, vulnerability, future trajectory, or mutual understanding. Do not log ordinary banter or routine sex beats unless they changed something important.', kind: 'list', includeInPrompt: true },
    { key: 'characterIntimatePreferences', label: 'Character Intimate Preferences', instruction: 'Track only explicit erotic preferences, desires, requests, or strongly evidenced repeated patterns from this chat. No identity-context carryover. No broad umbrella labels if the transcript supports only narrower acts. No \'would allow it\' speculation.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
    { key: 'userIntimatePreferences', label: 'User Intimate Preferences', instruction: 'Track only explicit erotic fantasies, desires, requests, or strongly evidenced repeated patterns from this chat. Do not place sexual material in userFacts or userLikes. No broad umbrella labels if the transcript supports only narrower acts.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
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

const MODEL_PREFIX_BY_PROVIDER = {
    openai: 'openai/',
    anthropic: 'anthropic/',
    google: 'google/',
    deepseek: 'deepseek/',
};

const MODEL_PREFIXES = Object.values(MODEL_PREFIX_BY_PROVIDER);

function normalizeCharacterEvolutionExtractionModel(providerRaw, modelRaw) {
    const provider = toString(providerRaw).toLowerCase();
    const model = toString(modelRaw);
    if (!model || provider === 'openrouter') {
        return model;
    }
    const normalizedModel = model.toLowerCase();
    const matchedPrefix = MODEL_PREFIXES.find((prefix) => normalizedModel.startsWith(prefix));
    const prefix = MODEL_PREFIX_BY_PROVIDER[provider];
    if (prefix && matchedPrefix === prefix) {
        return model.slice(prefix.length);
    }
    if (matchedPrefix) {
        return '';
    }
    return model;
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
        extractionMaxTokens: 2400,
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
    const extractionMaxTokens = Number(value.extractionMaxTokens);
    const extractionProvider = toString(value.extractionProvider) || defaults.extractionProvider;
    return {
        extractionProvider,
        extractionModel: normalizeCharacterEvolutionExtractionModel(extractionProvider, value.extractionModel),
        extractionMaxTokens: Number.isFinite(extractionMaxTokens) && extractionMaxTokens > 0
            ? Math.max(64, Math.floor(extractionMaxTokens))
            : defaults.extractionMaxTokens,
        extractionPrompt: toString(value.extractionPrompt) || defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
    };
}

function normalizeCharacterEvolutionSettings(raw) {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === 'object') ? raw : {};
    const extractionMaxTokens = Number(value.extractionMaxTokens);
    const extractionProvider = toString(value.extractionProvider) || defaults.extractionProvider;
    return {
        enabled: value.enabled === true,
        useGlobalDefaults: value.useGlobalDefaults !== false,
        extractionProvider,
        extractionModel: normalizeCharacterEvolutionExtractionModel(extractionProvider, value.extractionModel),
        extractionMaxTokens: Number.isFinite(extractionMaxTokens) && extractionMaxTokens > 0
            ? Math.max(64, Math.floor(extractionMaxTokens))
            : defaults.extractionMaxTokens,
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
        extractionMaxTokens: defaults.extractionMaxTokens,
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

function sanitizeStateForEvolution(stateRaw, evolutionSettings, baseStateRaw = null) {
    const state = normalizeCharacterEvolutionState(stateRaw);
    const defaults = createDefaultCharacterEvolutionState();
    const baseState = normalizeCharacterEvolutionState(baseStateRaw);
    const privacy = normalizeCharacterEvolutionPrivacy(evolutionSettings?.privacy);
    const allowedKeys = new Set(
        normalizeCharacterEvolutionSectionConfigs(evolutionSettings?.sectionConfigs)
            .filter((section) => isEvolutionSectionAllowed(section, privacy))
            .map((section) => section.key)
    );

    for (const key of Object.keys(defaults)) {
        if (allowedKeys.has(key)) continue;
        state[key] = clone(baseState[key], defaults[key]);
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
            `  instruction: ${applyPromptVars(section.instruction, character, settings)}`,
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
        applyPromptVars(evolution.extractionPrompt, character, settings),
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
        proposedState: sanitizeStateForEvolution(
            payload.proposedState || evolutionSettings.currentState,
            evolutionSettings,
            evolutionSettings.currentState
        ),
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
