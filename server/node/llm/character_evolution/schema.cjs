const { clone, toTrimmedString } = require('./utils.cjs');
const { createCharacterEvolutionPromptProjectionPolicy } = require('./projection_policy.cjs');
const { createCharacterEvolutionRetentionPolicy } = require('./retention_policy.cjs');

const CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS = [
    'characterLikes',
    'characterDislikes',
    'characterHabits',
    'userFacts',
    'userLikes',
    'userDislikes',
    'keyMoments',
];

const DEFAULT_EXTRACTION_PROMPT = [
    'You update a character evolution state from the current processed roleplay transcript range.',
    '',
    'Return raw JSON only with keys proposedState and changes.',
    'Do not use markdown.',
    'Do not use code fences.',
    '',
    'proposedState:',
    '- must contain only sections that changed in this transcript range',
    '- omitted sections mean no change',
    '- for list sections, include only changed, new, corrected, archived, or explicitly cleared items; do not copy unchanged active items from Current state JSON',
    '- CRITICAL: do not re-emit unchanged items from Current state JSON. If an item\'s value, confidence, status, and note are all the same, omit it entirely.',
    '- for relationship, include dynamic when that section changes; include trustLevel when it materially changes or clarifies the shift',
    '- for lastInteractionEnded, include the full object when that section changes',
    '- must not add new keys or rename keys',
    '',
    'changes:',
    '- must be an array of objects with sectionKey, summary, and evidence',
    '- include only sections that actually changed in proposedState',
    '- every section listed in changes must also be present in proposedState',
    '- evidence must be an array of at least one non-empty string — NEVER an empty array',
    '- each evidence string must be a short transcript-supported quote or paraphrase with a message index reference like [42]',
    '- if you cannot provide evidence for a change, do not propose it',
    '',
    'Global rules:',
    '- Use only transcript-supported information.',
    '- Do not invent facts.',
    '- Do not use character card identity context as evidence for new changes.',
    '- If nothing changed, return proposedState as {} and changes as [].',
    '- Only update enabled and privacy-allowed sections.',
    '- Treat this as long-term memory extraction, not scene summarization.',
    '- lastInteractionEnded captures scene-level details; other sections capture durable knowledge.',
    '',
    'Confidence is your primary safety valve:',
    '- Use suspected for first-time mentions, single evidence points, or behavioral inference.',
    '- Use likely when stated clearly or supported by multiple signals in this range.',
    '- Use confirmed only for undeniable facts (names, ages, jobs) or preferences demonstrated across multiple separate ranges. A single explicit statement in one range is likely at most, never confirmed.',
    '- It is better to extract at suspected than to miss a real fact or preference entirely.',
    '- Items that are wrong or transient will be naturally pruned by the retention system.',
    '',
    'Extraction balance:',
    '- Extract concrete facts, stated preferences, and demonstrated behaviors — do not wait for repetition.',
    '- A single clear statement like "I used to do X" or "I like Y" is sufficient evidence at suspected or likely.',
    '- Behavioral evidence counts: if {{user}} repeatedly does something, or {{char}} consistently reacts a certain way, that is extractable.',
    '- Do not extract pure scene-mood (e.g., "felt happy in this moment") as a durable trait.',
    '- Do not extract things that are only true during an active scene and would not persist.',
    '- When in doubt between extracting at suspected vs. not extracting at all, prefer extracting.',
    '',
    'Deduplication:',
    '- Before proposing a new item for any list section, scan Current state JSON for items with overlapping meaning.',
    '- If a semantically similar item already exists, update that item instead of creating a new entry.',
    '- Consolidate related behavioral patterns into a single item rather than splitting into fine-grained entries.',
    '- When in doubt whether two items overlap, consolidate them into the broader one.',
    '',
    'Cross-section correction:',
    '- If you see an item in Current state JSON that is clearly in the wrong section (e.g., an intimate preference stored in characterHabits, or a fact stored in userRead), propose it as status: corrected in the wrong section and re-add it in the correct section.',
    '',
    'Coverage:',
    '- Every range may contain evidence for any section type. Do not focus only on the dominant topic.',
    '- Even if a range is mostly intimate or mostly banter, scan for userFacts, likes, dislikes, habits, and other factual categories.',
    '',
    'Schema rules:',
    '- relationship and lastInteractionEnded are objects',
    '- all other list sections are arrays of item objects',
    '- if you clear a section, include it explicitly with an empty object or empty array',
    '- Current state JSON is a compact active-only comparison view, not the full stored history',
    '- do not invent sourceChatId, sourceRange, updatedAt, lastSeenAt, or timesSeen for new items unless they are already present in Current state JSON',
    '',
    'Lifecycle meanings:',
    '- status: active = currently relevant and live',
    '- status: corrected = superseded by newer evidence — include the corrected item in proposedState with status: corrected',
    '- status: archived = no longer current — to remove an outdated item, include it in proposedState with status: archived',
    '- To archive or correct an existing item, you MUST include it in proposedState with the new status. Simply omitting it does nothing.',
    '- Do NOT re-emit an item with status: active unless you are changing its value, confidence, or note.',
    '',
    'Field discipline:',
    '- userFacts = neutral facts about {{user}}: work, hobbies, history, plans, locations, routines, skills, biographical details, cultural references they know',
    '- never put fantasies, desires, kinks, interpretations, opinions, or relationship judgments into userFacts',
    '- userRead = {{char}}\'s durable subjective interpretation of {{user}} only',
    '- userLikes and userDislikes = preferences demonstrated through statements or consistent behavior',
    '- characterLikes and characterDislikes = preferences shown through {{char}}\'s statements, reactions, or consistent behavior',
    '- characterIntimatePreferences and userIntimatePreferences = explicit sexual or erotic preferences only',
    '- do not move sexual material into userFacts, userLikes, or characterLikes',
    '- do not add broad intimate preference labels if the transcript only supports a narrower act',
    '- do not treat one performed intimate act as a durable preference by itself',
    '',
    'Section rules:',
    '- relationship: update on durable relationship shifts supported by repeated signals or a clear pivotal moment; emotional vulnerability, explicit trust declarations, or significant boundary changes count as pivotal even during an intimate scene; do not change for physical acts alone',
    '- activeThreads: keep only unresolved loops that should plausibly carry into the next chat; do not add resolved topics',
    '- runningJokes: add when a phrase, bit, or dynamic is explicitly called out as recurring, or when the same callback appears in two or more distinct moments; a single funny line is not a running joke unless the characters frame it as one',
    '- keyMoments: use this for important one-chat developments that matter but are not yet durable traits',
    '- lastInteractionEnded: use this for fresh scene residue, unresolved mood, and immediate carry-forward details',
    '',
    'For item objects, use:',
    '- value: string (concise, specific — avoid vague or overly broad descriptions)',
    '- confidence: suspected | likely | confirmed',
    '- note: brief evidence/context; for new items, include a note with transcript support',
    '- status: preserve existing status unless there is a clear reason to change it',
    '- prefer updating an existing matching item over creating a duplicate',
    '- corrected and archived items should not be treated as current truth',
].join('\n');

const BUILTIN_SECTION_DEFS = [
    { key: 'relationship', label: 'Relationship', instruction: 'Update on durable relationship shifts supported by repeated signals or a clear pivotal moment. Emotional vulnerability, explicit trust declarations, or significant boundary changes count as pivotal even during an intimate scene. Do not change for physical acts alone.', kind: 'object', includeInPrompt: true },
    { key: 'activeThreads', label: 'Active Threads', instruction: 'Track unresolved loops that should carry into the next chat: open questions, promises, tensions, plans. Do not add topics that were already resolved in this range.', kind: 'list', includeInPrompt: true },
    { key: 'runningJokes', label: 'Running Jokes', instruction: 'Add when a phrase, bit, or dynamic is explicitly called out as recurring by the characters, or when the same callback appears in two or more distinct moments. A single funny line is not a running joke unless the characters frame it as one.', kind: 'list', includeInPrompt: true },
    { key: 'characterLikes', label: 'Character Likes', instruction: 'Track things {{char}} demonstrably likes: stated preferences, things they reach for, activities they enjoy, media they reference positively. One clear statement or strong behavioral signal is enough at suspected confidence. Do not fabricate from identity context alone.', kind: 'list', includeInPrompt: true },
    { key: 'characterDislikes', label: 'Character Dislikes', instruction: 'Track things {{char}} demonstrably dislikes: stated aversions, things that irritate or repel them, topics they reject. One clear negative reaction or statement is enough at suspected confidence. Do not confuse moral opinions with personal dislikes unless clearly personal.', kind: 'list', includeInPrompt: true },
    { key: 'characterHabits', label: 'Character Habits & Boundaries', instruction: 'Track behavioral patterns, characteristic defaults, and non-intimate comfort boundaries shown through actions in the transcript. A habit shown twice or described as habitual is enough. Non-intimate boundaries (personal space rules, emotional triggers, social limits) belong here when explicitly stated or enforced. Do not add one-off situational actions. Do not mix in sexual preferences — those belong in characterIntimatePreferences.', kind: 'list', includeInPrompt: true },
    { key: 'userFacts', label: 'User Facts', instruction: 'Track concrete facts about {{user}}: job history, age, skills, hobbies, plans, locations, routines, biographical details, cultural knowledge, possessions. One clear mention is enough. No opinions, interpretations, emotions, or relationship judgments — just facts.', kind: 'list', includeInPrompt: true },
    { key: 'userRead', label: 'User Read', instruction: 'Track {{char}}\'s durable subjective interpretation of {{user}}. Add when clearly shown by {{char}}\'s words, stance, or repeated framing. Do not log momentary impressions that would not persist to the next chat.', kind: 'list', includeInPrompt: true },
    { key: 'userLikes', label: 'User Likes', instruction: 'Track non-intimate things {{user}} likes: stated preferences, hobbies they enjoy, media they reference positively, activities they gravitate toward. One clear statement or demonstration is enough at suspected confidence. Sexual material belongs in userIntimatePreferences.', kind: 'list', includeInPrompt: true },
    { key: 'userDislikes', label: 'User Dislikes', instruction: 'Track non-intimate things {{user}} dislikes: stated aversions, things they complain about or avoid. One clear statement or demonstration is enough at suspected confidence. Do not confuse existential angst or relationship tension with a personal dislike.', kind: 'list', includeInPrompt: true },
    { key: 'lastInteractionEnded', label: 'Last Interaction Ended', instruction: 'Describe how the current processed range ended and what should carry into the next one. Capture scene residue, unresolved mood, and immediate carry-forward details. Do not summarize the whole conversation.', kind: 'object', includeInPrompt: true },
    { key: 'keyMoments', label: 'Key Moments', instruction: 'Track important developments that materially changed trust, vulnerability, future trajectory, or mutual understanding. Do not log ordinary banter or routine moments unless they shifted something important.', kind: 'list', includeInPrompt: true },
    { key: 'characterIntimatePreferences', label: 'Character Intimate Preferences', instruction: 'Track explicit erotic preferences, desires, or requests shown in the transcript. Use specific descriptions rather than broad labels. Consolidate related acts into a single item rather than splitting into many fine-grained entries. Do not treat one performed act as a durable preference by itself — look for stated desire, repeated pattern, or clear enthusiasm.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
    { key: 'userIntimatePreferences', label: 'User Intimate Preferences', instruction: 'Track explicit erotic fantasies, desires, or requests from {{user}} shown in the transcript. Use specific descriptions rather than broad labels. Consolidate related acts into a single item rather than splitting into many fine-grained entries. Do not place sexual material in userFacts or userLikes. Do not treat one performed act as a durable preference by itself.', kind: 'list', enabled: false, includeInPrompt: false, sensitive: true },
];

// Legacy section instructions from previous versions.
// Used by the normalizer to detect stored builtins and clear them to '',
// so that code-default instructions are always used at runtime.
const LEGACY_SECTION_INSTRUCTIONS = [
    // v1 activeThreads
    'Keep only unresolved loops that should plausibly carry into the next chat. Add only clear open loops, tensions, promises, or unanswered questions. Do not add topics that were already substantially resolved in this scene.',
    // v1 runningJokes
    'Add only if the callback appears at least twice in separate moments or is explicitly framed as recurring. Do not add one-off phrasing, sleepy nicknames, or scene-specific banter.',
    // v1 characterLikes
    'Track persistent likes only if explicitly stated or strongly evidenced more than once in this chat. Do not preserve from identity context alone. Do not convert scene enthusiasm, temporary mood, or one conversation topic into a stable like.',
    // v1 characterDislikes
    'Track persistent dislikes only if explicitly stated or strongly evidenced in this chat. Do not preserve from identity context alone. Do not confuse moral opinions with stable dislikes unless clearly personal. Do not convert temporary irritation or one topic into a stable dislike.',
    // v1 characterHabits
    'Track only repeated behaviors or strongly characteristic defaults. Do not add habits from one scene, one mood, or one intimate moment.',
    // v1 characterBoundariesPreferences
    'Track non-intimate boundaries, comfort rules, and control preferences only. Do not mix in sexual preferences. Add only when explicitly stated, clearly enforced, or repeated. Do not infer boundaries from tone, hesitation, vibe, or one vulnerable reaction.',
    // v1 userFacts
    'Track neutral, explicit user facts only. No interpretations, fantasies, kinks, opinions, relationship judgments, or emotional reads. Work history, plans, locations, routines, and concrete life details belong here.',
    // v1 userRead
    "Track {{char}}'s durable subjective interpretation of {{user}} as short strings only. Not facts. Not objects. Add only if clearly shown by {{char}}'s words, stance, or repeated framing in this chat. Do not log momentary interpretations or scene-specific emotional readings.",
    // v1 userLikes
    'Track non-intimate user likes directly stated or strongly evidenced in this chat. Sexual fantasies, erotic requests, or kink preferences belong in userIntimatePreferences, not here. Do not derive a stable like from one conversation, one fantasy, or one supportive line.',
    // v1 userDislikes
    'Track non-intimate user dislikes directly stated or strongly evidenced in this chat. Do not turn existential distress or relationship tension into a dislike unless the user clearly frames it that way. Do not derive a stable dislike from one conversation or one scene.',
    // v1 lastInteractionEnded
    'Describe only how the current processed interaction range ended and what should carry into the next one. Use this for fresh scene residue, unresolved mood, and immediate carry-forward details that are too recent or too narrow for durable sections. Do not summarize the whole conversation here.',
    // v1 keyMoments
    'Use this for important one-chat developments that matter but are not yet durable traits. Only add moments that materially changed trust, vulnerability, future trajectory, or mutual understanding. Do not log ordinary banter or routine sex beats unless they changed something important.',
    // v1 characterIntimatePreferences
    "Track only explicit erotic preferences, desires, requests, or strongly evidenced repeated patterns from this chat. No identity-context carryover. No broad umbrella labels if the transcript supports only narrower acts. No 'would allow it' speculation. Do not treat one performed act as a durable preference by itself.",
    // v1 userIntimatePreferences
    'Track only explicit erotic fantasies, desires, or requests from this chat. Do not place sexual material in userFacts or userLikes. No broad umbrella labels if the transcript supports only narrower acts. Do not treat one performed act as a durable preference by itself.',
    // v2 relationship
    'Update only on durable relationship shifts supported by repeated signals or a clear pivotal moment. Do not change for one flirt, one argument, or one sex act alone.',
    // v2 runningJokes
    'Add when a callback appears at least twice in separate moments, or is explicitly framed as a recurring bit. Do not add one-off phrasing or scene-specific banter.',
    // v2 characterIntimatePreferences
    'Track explicit erotic preferences, desires, or requests shown in the transcript. Use specific descriptions rather than broad labels. Do not treat one performed act as a durable preference by itself — look for stated desire, repeated pattern, or clear enthusiasm.',
    // v2 userIntimatePreferences
    'Track explicit erotic fantasies, desires, or requests from {{user}} shown in the transcript. Use specific descriptions rather than broad labels. Do not place sexual material in userFacts or userLikes. Do not treat one performed act as a durable preference by itself.',
    // v2 characterBoundariesPreferences (section removed — merged into characterHabits)
    'Track non-intimate boundaries, comfort rules, and control preferences. Add when explicitly stated or clearly enforced. Do not mix in sexual preferences. Do not infer boundaries from tone alone.',
    // v2 characterHabits (before boundaries merge)
    'Track behavioral patterns and characteristic defaults shown through actions in the transcript. A habit shown twice or described as habitual is enough. Do not add one-off actions that are clearly situational.',
];

// All known builtin section instruction strings (current + legacy).
const _KNOWN_BUILTIN_INSTRUCTIONS = new Set([
    ...BUILTIN_SECTION_DEFS.map((s) => s.instruction),
    ...LEGACY_SECTION_INSTRUCTIONS,
]);

/**
 * Returns true if the extraction prompt is a known builtin (current or legacy).
 * Builtin prompts should not be stored — empty string means "use code default".
 */
function isBuiltinExtractionPrompt(prompt) {
    return typeof prompt === 'string' && prompt.startsWith(
        'You update a character evolution state from the current processed roleplay transcript range.'
    );
}

/**
 * Returns true if the section instruction is a known builtin (current or legacy).
 * Builtin instructions should not be stored — empty string means "use code default".
 */
function isBuiltinSectionInstruction(instruction) {
    return _KNOWN_BUILTIN_INSTRUCTIONS.has(instruction);
}

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
        userFacts: [],
        userRead: [],
        userLikes: [],
        userDislikes: [],
        lastInteractionEnded: {
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
        instruction: '',
        kind: section.kind,
        sensitive: section.sensitive === true,
    }));
}

function createDefaultCharacterEvolutionSemanticRecallSettings() {
    return {
        enabled: false,
        embeddingModel: 'MiniLM',
        minScore: 0.42,
        maxItems: 3,
        queryMessageWindow: 4,
        sections: {
            characterLikes: false,
            characterDislikes: false,
            characterHabits: false,
            userFacts: true,
            userLikes: false,
            userDislikes: false,
            keyMoments: false,
        },
        sectionLimits: {
            characterLikes: 0,
            characterDislikes: 0,
            characterHabits: 0,
            userFacts: 0,
            userLikes: 0,
            userDislikes: 0,
            keyMoments: 0,
        },
    };
}

function createDefaultCharacterEvolutionDefaults() {
    return {
        extractionProvider: 'openrouter',
        extractionModel: '',
        extractionMaxTokens: 2400,
        extractionPrompt: '',
        sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        privacy: clone({
            allowCharacterIntimatePreferences: false,
            allowUserIntimatePreferences: false,
        }),
        promptProjection: createCharacterEvolutionPromptProjectionPolicy(),
        retention: createCharacterEvolutionRetentionPolicy(),
        semanticRecall: createDefaultCharacterEvolutionSemanticRecallSettings(),
    };
}

module.exports = {
    BUILTIN_SECTION_DEFS,
    CHARACTER_EVOLUTION_SEMANTIC_RECALL_SECTION_KEYS,
    DEFAULT_EXTRACTION_PROMPT,
    MODEL_PREFIX_BY_PROVIDER,
    MODEL_PREFIXES,
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSemanticRecallSettings,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
    isBuiltinExtractionPrompt,
    isBuiltinSectionInstruction,
    normalizeCharacterEvolutionExtractionModel,
};
