const { clone, toTrimmedString } = require('./utils.cjs');

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
    '- Treat this as long-term memory extraction, not scene summarization.',
    '- Prefer storing fresh scene details in lastChatEnded or keyMoments, not as durable traits.',
    '- Do not promote a detail to a durable section unless it is explicit, repeated, or clearly framed as stable.',
    '- A single scene, joke, flirt line, sex act, or emotional beat is usually not enough for a durable update.',
    '- If a detail is new but not yet durable, keep the current state unchanged and mention it only in lastChatEnded or keyMoments if relevant.',
    '- Prefer under-extraction over over-extraction.',
    '- Before updating a durable section, ask: would this still likely be true in the next chat?',
    '- If no, do not store it as a durable trait.',
    '- If maybe, prefer lastChatEnded or keyMoments.',
    '- If yes, and transcript evidence is strong, update the durable section.',
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
    '- do not treat one performed intimate act as a durable preference by itself',
    '- only add intimate preferences when the transcript shows explicit stated desire, repeated pattern, or clear future-oriented preference',
    '',
    'Section rules:',
    '- relationship: update only on durable relationship shifts supported by repeated signals or a clear pivotal moment; do not change for one flirt, one argument, or one sex act alone',
    '- activeThreads: keep only unresolved loops that should plausibly carry into the next chat; do not add topics that were already substantially resolved in this scene',
    '- runningJokes: add only if the callback appears at least twice in separate moments or is explicitly framed as recurring; do not add one-off phrasing, sleepy nicknames, or scene-specific banter',
    '- characterLikes and characterDislikes: do not convert scene enthusiasm, temporary mood, or one conversation topic into a stable like/dislike',
    '- characterHabits: track only repeated behaviors or strongly characteristic defaults; do not add habits from one scene, one mood, or one intimate moment',
    '- characterBoundariesPreferences: track only explicit rules, comfort limits, or repeatedly enforced preferences; do not infer boundaries from tone, hesitation, vibe, or one vulnerable reaction',
    '- userLikes and userDislikes: require direct statement or strong repeated evidence; do not derive stable preferences from one conversation, one fantasy, or one supportive line',
    '- userRead: add only durable subjective reads that {{char}} would likely still believe next chat; do not log momentary interpretations or scene-specific emotional readings',
    '- keyMoments: use this for important one-chat developments that matter but are not yet durable traits',
    '- lastChatEnded: use this for fresh scene residue, unresolved mood, and immediate carry-forward details that are too recent or too narrow for durable sections',
    '',
    'For item objects, use:',
    '- value: string',
    '- confidence: suspected | likely | confirmed when applicable',
    '- note: brief evidence/context when applicable',
    '- status: preserve existing status unless there is a clear reason to change it',
].join('\n');

const BUILTIN_SECTION_DEFS = [
    { key: 'relationship', label: 'Relationship', instruction: 'Update only on durable relationship shifts supported by repeated signals or a clear pivotal moment. Do not change for one flirt, one argument, or one sex act alone.', kind: 'object', includeInPrompt: true },
    { key: 'activeThreads', label: 'Active Threads', instruction: 'Keep only unresolved loops that should plausibly carry into the next chat. Add only clear open loops, tensions, promises, or unanswered questions. Do not add topics that were already substantially resolved in this scene.', kind: 'list', includeInPrompt: true },
    { key: 'runningJokes', label: 'Running Jokes', instruction: 'Add only if the callback appears at least twice in separate moments or is explicitly framed as recurring. Do not add one-off phrasing, sleepy nicknames, or scene-specific banter.', kind: 'list', includeInPrompt: true },
    { key: 'characterLikes', label: 'Character Likes', instruction: 'Track persistent likes only if explicitly stated or strongly evidenced more than once in this chat. Do not preserve from identity context alone. Do not convert scene enthusiasm, temporary mood, or one conversation topic into a stable like.', kind: 'list', includeInPrompt: true },
    { key: 'characterDislikes', label: 'Character Dislikes', instruction: 'Track persistent dislikes only if explicitly stated or strongly evidenced in this chat. Do not preserve from identity context alone. Do not confuse moral opinions with stable dislikes unless clearly personal. Do not convert temporary irritation or one topic into a stable dislike.', kind: 'list', includeInPrompt: true },
    { key: 'characterHabits', label: 'Character Habits', instruction: 'Track only repeated behaviors or strongly characteristic defaults. Do not add habits from one scene, one mood, or one intimate moment.', kind: 'list', includeInPrompt: true },
    { key: 'characterBoundariesPreferences', label: 'Character Boundaries / Preferences', instruction: 'Track non-intimate boundaries, comfort rules, and control preferences only. Do not mix in sexual preferences. Add only when explicitly stated, clearly enforced, or repeated. Do not infer boundaries from tone, hesitation, vibe, or one vulnerable reaction.', kind: 'list', includeInPrompt: true },
    { key: 'userFacts', label: 'User Facts', instruction: 'Track neutral, explicit user facts only. No interpretations, fantasies, kinks, opinions, relationship judgments, or emotional reads. Work history, plans, locations, routines, and concrete life details belong here.', kind: 'list', includeInPrompt: true },
    { key: 'userRead', label: 'User Read', instruction: 'Track {{char}}\'s durable subjective interpretation of {{user}} as short strings only. Not facts. Not objects. Add only if clearly shown by {{char}}\'s words, stance, or repeated framing in this chat. Do not log momentary interpretations or scene-specific emotional readings.', kind: 'list', includeInPrompt: true },
    { key: 'userLikes', label: 'User Likes', instruction: 'Track non-intimate user likes directly stated or strongly evidenced in this chat. Sexual fantasies, erotic requests, or kink preferences belong in userIntimatePreferences, not here. Do not derive a stable like from one conversation, one fantasy, or one supportive line.', kind: 'list', includeInPrompt: true },
    { key: 'userDislikes', label: 'User Dislikes', instruction: 'Track non-intimate user dislikes directly stated or strongly evidenced in this chat. Do not turn existential distress or relationship tension into a dislike unless the user clearly frames it that way. Do not derive a stable dislike from one conversation or one scene.', kind: 'list', includeInPrompt: true },
    { key: 'lastChatEnded', label: 'Last Chat Ended', instruction: 'Describe only how the chat actually ended and what should carry into the next one. Use this for fresh scene residue, unresolved mood, and immediate carry-forward details that are too recent or too narrow for durable sections. Do not summarize the whole conversation here.', kind: 'object', includeInPrompt: true },
    { key: 'keyMoments', label: 'Key Moments', instruction: 'Use this for important one-chat developments that matter but are not yet durable traits. Only add moments that materially changed trust, vulnerability, future trajectory, or mutual understanding. Do not log ordinary banter or routine sex beats unless they changed something important.', kind: 'list', includeInPrompt: true },
    { key: 'characterIntimatePreferences', label: 'Character Intimate Preferences', instruction: 'Track only explicit erotic preferences, desires, requests, or strongly evidenced repeated patterns from this chat. No identity-context carryover. No broad umbrella labels if the transcript supports only narrower acts. No \'would allow it\' speculation. Do not treat one performed act as a durable preference by itself.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
    { key: 'userIntimatePreferences', label: 'User Intimate Preferences', instruction: 'Track only explicit erotic fantasies, desires, requests, or strongly evidenced repeated patterns from this chat. Do not place sexual material in userFacts or userLikes. No broad umbrella labels if the transcript supports only narrower acts. Do not treat one performed act as a durable preference by itself.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
];

const MODEL_PREFIX_BY_PROVIDER = {
    openai: 'openai/',
    anthropic: 'anthropic/',
    google: 'google/',
    deepseek: 'deepseek/',
};

const MODEL_PREFIXES = Object.values(MODEL_PREFIX_BY_PROVIDER);

function normalizeCharacterEvolutionExtractionModel(providerRaw, modelRaw) {
    const provider = toTrimmedString(providerRaw).toLowerCase();
    const model = toTrimmedString(modelRaw);
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
        privacy: clone({
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        }),
    };
}

module.exports = {
    BUILTIN_SECTION_DEFS,
    DEFAULT_EXTRACTION_PROMPT,
    MODEL_PREFIX_BY_PROVIDER,
    MODEL_PREFIXES,
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
    normalizeCharacterEvolutionExtractionModel,
};
