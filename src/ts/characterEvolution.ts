import type {
    CharacterEvolutionDefaults,
    CharacterEvolutionItem,
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSectionKey,
    CharacterEvolutionSettings,
    CharacterEvolutionState,
    Database,
    character,
    groupChat,
} from "./storage/database.types";

const DEFAULT_EXTRACTION_PROMPT = [
    "You update a character evolution state after a completed roleplay chat.",
    "Return strict JSON only with keys proposedState and changes.",
    "proposedState must contain the full next state object.",
    "changes must be an array of objects with sectionKey, summary, and evidence.",
    "Use only transcript-supported information.",
    "Do not invent facts.",
    "If nothing changed, keep state unchanged and return an empty changes array.",
    "Only include sections that are enabled and privacy-allowed.",
].join("\n");

const DEFAULT_PRIVACY: CharacterEvolutionPrivacySettings = {
    allowCharacterIntimatePreferences: false,
    allowUserIntimatePreferences: false,
};

const BUILTIN_SECTION_DEFS: Array<{
    key: CharacterEvolutionSectionKey,
    label: string,
    instruction: string,
    kind: CharacterEvolutionSectionConfig["kind"],
    enabled?: boolean,
    includeInPrompt?: boolean,
    sensitive?: boolean,
}> = [
    { key: "relationship", label: "Relationship", instruction: "Track trust and relationship dynamic shifts only when clearly supported.", kind: "object", includeInPrompt: true },
    { key: "activeThreads", label: "Active Threads", instruction: "Track unresolved ongoing topics, tensions, promises, and loops.", kind: "list", includeInPrompt: true },
    { key: "runningJokes", label: "Running Jokes", instruction: "Track recurring jokes or repeated bits that may carry into future chats.", kind: "list", includeInPrompt: true },
    { key: "characterLikes", label: "Character Likes", instruction: "Track persistent likes expressed or strongly evidenced in chat.", kind: "list", includeInPrompt: true },
    { key: "characterDislikes", label: "Character Dislikes", instruction: "Track persistent dislikes expressed or strongly evidenced in chat.", kind: "list", includeInPrompt: true },
    { key: "characterHabits", label: "Character Habits", instruction: "Track repeated habits, rituals, or behavioral patterns.", kind: "list", includeInPrompt: true },
    { key: "characterBoundariesPreferences", label: "Character Boundaries / Preferences", instruction: "Track non-intimate boundaries, preferences, and comfort rules.", kind: "list", includeInPrompt: true },
    { key: "userFacts", label: "User Facts", instruction: "Track explicit facts the user revealed about themselves.", kind: "list", includeInPrompt: true },
    { key: "userRead", label: "User Read", instruction: "Track the character's durable interpretation of the user, not fleeting mood reads.", kind: "list", includeInPrompt: true },
    { key: "userLikes", label: "User Likes", instruction: "Track user likes directly stated or strongly evidenced in chat.", kind: "list", includeInPrompt: true },
    { key: "userDislikes", label: "User Dislikes", instruction: "Track user dislikes directly stated or strongly evidenced in chat.", kind: "list", includeInPrompt: true },
    { key: "lastChatEnded", label: "Last Chat Ended", instruction: "Track the ending state and residue that should carry into the next chat.", kind: "object", includeInPrompt: true },
    { key: "keyMoments", label: "Key Moments", instruction: "Track pivotal moments only when they meaningfully shift the state.", kind: "list", includeInPrompt: true },
    { key: "characterIntimatePreferences", label: "Character Intimate Preferences", instruction: "Track intimate preferences only when privacy allows it and evidence is explicit.", kind: "list", enabled: false, includeInPrompt: false, sensitive: true },
    { key: "userIntimatePreferences", label: "User Intimate Preferences", instruction: "Track intimate user preferences only when privacy allows it and evidence is explicit.", kind: "list", enabled: false, includeInPrompt: false, sensitive: true },
];

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function jsonEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeItem(raw: unknown): CharacterEvolutionItem | null {
    if (!raw || typeof raw !== "object") {
        if (typeof raw === "string" && raw.trim()) {
            return { value: raw.trim(), status: "active" };
        }
        return null;
    }
    const item = raw as Record<string, unknown>;
    const value = typeof item.value === "string" ? item.value.trim() : "";
    if (!value) return null;
    return {
        value,
        confidence: item.confidence === "suspected" || item.confidence === "likely" || item.confidence === "confirmed"
            ? item.confidence
            : undefined,
        note: typeof item.note === "string" ? item.note.trim() : "",
        status: item.status === "archived" || item.status === "corrected" || item.status === "active"
            ? item.status
            : "active",
        sourceChatId: typeof item.sourceChatId === "string" ? item.sourceChatId : undefined,
        updatedAt: Number.isFinite(Number(item.updatedAt)) ? Number(item.updatedAt) : undefined,
    };
}

function normalizeStringList(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((value) => typeof value === "string" ? value.trim() : "")
        .filter(Boolean);
}

function normalizeItemList(raw: unknown): CharacterEvolutionItem[] {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => normalizeItem(item))
        .filter((item): item is CharacterEvolutionItem => !!item);
}

export function createDefaultCharacterEvolutionState(): CharacterEvolutionState {
    return {
        relationship: {
            trustLevel: "",
            dynamic: "",
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
            state: "",
            residue: "",
        },
        keyMoments: [],
        characterIntimatePreferences: [],
        userIntimatePreferences: [],
    };
}

export function createDefaultCharacterEvolutionSectionConfigs(): CharacterEvolutionSectionConfig[] {
    return BUILTIN_SECTION_DEFS.map((section) => ({
        key: section.key,
        label: section.label,
        enabled: section.enabled ?? true,
        includeInPrompt: section.includeInPrompt ?? true,
        instruction: section.instruction,
        kind: section.kind,
        sensitive: section.sensitive ?? false,
    }));
}

export function createDefaultCharacterEvolutionDefaults(): CharacterEvolutionDefaults {
    return {
        extractionProvider: "openrouter",
        extractionModel: "",
        extractionPrompt: DEFAULT_EXTRACTION_PROMPT,
        sectionConfigs: createDefaultCharacterEvolutionSectionConfigs(),
        privacy: clone(DEFAULT_PRIVACY),
    };
}

export function normalizeCharacterEvolutionPrivacy(raw: unknown): CharacterEvolutionPrivacySettings {
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
    return {
        allowCharacterIntimatePreferences: value.allowCharacterIntimatePreferences === true,
        allowUserIntimatePreferences: value.allowUserIntimatePreferences === true,
    };
}

export function normalizeCharacterEvolutionSectionConfigs(raw: unknown): CharacterEvolutionSectionConfig[] {
    const defaults = createDefaultCharacterEvolutionSectionConfigs();
    const rawSections = Array.isArray(raw) ? raw : [];
    const rawMap = new Map<string, Record<string, unknown>>();
    for (const section of rawSections) {
        if (!section || typeof section !== "object") continue;
        const sectionRecord = section as Record<string, unknown>;
        const key = typeof sectionRecord.key === "string" ? sectionRecord.key : "";
        if (!key) continue;
        rawMap.set(key, sectionRecord);
    }
    return defaults.map((section) => {
        const override = rawMap.get(section.key) ?? {};
        return {
            ...section,
            label: typeof override.label === "string" && override.label.trim() ? override.label.trim() : section.label,
            enabled: override.enabled === undefined ? section.enabled : override.enabled === true,
            includeInPrompt: override.includeInPrompt === undefined ? section.includeInPrompt : override.includeInPrompt === true,
            instruction: typeof override.instruction === "string" && override.instruction.trim()
                ? override.instruction.trim()
                : section.instruction,
            sensitive: override.sensitive === undefined ? section.sensitive : override.sensitive === true,
        };
    });
}

export function normalizeCharacterEvolutionState(raw: unknown): CharacterEvolutionState {
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
    const state = createDefaultCharacterEvolutionState();
    state.relationship = {
        trustLevel: typeof value.relationship === "object" && value.relationship && typeof (value.relationship as Record<string, unknown>).trustLevel === "string"
            ? ((value.relationship as Record<string, unknown>).trustLevel as string).trim()
            : "",
        dynamic: typeof value.relationship === "object" && value.relationship && typeof (value.relationship as Record<string, unknown>).dynamic === "string"
            ? ((value.relationship as Record<string, unknown>).dynamic as string).trim()
            : "",
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
        state: typeof value.lastChatEnded === "object" && value.lastChatEnded && typeof (value.lastChatEnded as Record<string, unknown>).state === "string"
            ? ((value.lastChatEnded as Record<string, unknown>).state as string).trim()
            : "",
        residue: typeof value.lastChatEnded === "object" && value.lastChatEnded && typeof (value.lastChatEnded as Record<string, unknown>).residue === "string"
            ? ((value.lastChatEnded as Record<string, unknown>).residue as string).trim()
            : "",
    };
    state.keyMoments = normalizeStringList(value.keyMoments);
    state.characterIntimatePreferences = normalizeItemList(value.characterIntimatePreferences);
    state.userIntimatePreferences = normalizeItemList(value.userIntimatePreferences);
    return state;
}

export function normalizeCharacterEvolutionDefaults(raw: unknown): CharacterEvolutionDefaults {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
    return {
        extractionProvider: typeof value.extractionProvider === "string" && value.extractionProvider.trim()
            ? value.extractionProvider.trim()
            : defaults.extractionProvider,
        extractionModel: typeof value.extractionModel === "string"
            ? value.extractionModel.trim()
            : defaults.extractionModel,
        extractionPrompt: typeof value.extractionPrompt === "string" && value.extractionPrompt.trim()
            ? value.extractionPrompt
            : defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
    };
}

export function normalizeCharacterEvolutionSettings(raw: unknown): CharacterEvolutionSettings {
    const defaults = createDefaultCharacterEvolutionDefaults();
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {};
    return {
        enabled: value.enabled === true,
        useGlobalDefaults: value.useGlobalDefaults !== false,
        extractionProvider: typeof value.extractionProvider === "string" && value.extractionProvider.trim()
            ? value.extractionProvider.trim()
            : defaults.extractionProvider,
        extractionModel: typeof value.extractionModel === "string"
            ? value.extractionModel.trim()
            : defaults.extractionModel,
        extractionPrompt: typeof value.extractionPrompt === "string" && value.extractionPrompt.trim()
            ? value.extractionPrompt
            : defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
        currentStateVersion: Number.isFinite(Number(value.currentStateVersion)) ? Math.max(0, Math.floor(Number(value.currentStateVersion))) : 0,
        currentState: normalizeCharacterEvolutionState(value.currentState),
        pendingProposal: value.pendingProposal && typeof value.pendingProposal === "object"
            ? {
                proposalId: typeof (value.pendingProposal as Record<string, unknown>).proposalId === "string" ? (value.pendingProposal as Record<string, unknown>).proposalId as string : "",
                sourceChatId: typeof (value.pendingProposal as Record<string, unknown>).sourceChatId === "string" ? (value.pendingProposal as Record<string, unknown>).sourceChatId as string : "",
                proposedState: normalizeCharacterEvolutionState((value.pendingProposal as Record<string, unknown>).proposedState),
                changes: Array.isArray((value.pendingProposal as Record<string, unknown>).changes)
                    ? ((value.pendingProposal as Record<string, unknown>).changes as Array<Record<string, unknown>>)
                        .map((change) => {
                            const sectionKey = typeof change.sectionKey === "string" ? change.sectionKey as CharacterEvolutionSectionKey : null;
                            if (!sectionKey) return null;
                            return {
                                sectionKey,
                                summary: typeof change.summary === "string" ? change.summary.trim() : "",
                                evidence: Array.isArray(change.evidence)
                                    ? change.evidence.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
                                    : [],
                            };
                        })
                        .filter((change) => !!change)
                    : [],
                createdAt: Number.isFinite(Number((value.pendingProposal as Record<string, unknown>).createdAt))
                    ? Number((value.pendingProposal as Record<string, unknown>).createdAt)
                    : 0,
            }
            : null,
        lastProcessedChatId: typeof value.lastProcessedChatId === "string" ? value.lastProcessedChatId : null,
        stateVersions: Array.isArray(value.stateVersions)
            ? value.stateVersions
                .map((entry) => {
                    if (!entry || typeof entry !== "object") return null;
                    const item = entry as Record<string, unknown>;
                    const version = Number(item.version);
                    if (!Number.isFinite(version)) return null;
                    return {
                        version: Math.max(0, Math.floor(version)),
                        chatId: typeof item.chatId === "string" ? item.chatId : null,
                        acceptedAt: Number.isFinite(Number(item.acceptedAt)) ? Number(item.acceptedAt) : 0,
                    };
                })
                .filter((entry): entry is NonNullable<CharacterEvolutionSettings["stateVersions"][number]> => !!entry)
            : [],
    };
}

export function ensureDatabaseEvolutionDefaults(db: Database): CharacterEvolutionDefaults {
    const normalized = normalizeCharacterEvolutionDefaults(db.characterEvolutionDefaults);
    if (!jsonEqual(db.characterEvolutionDefaults, normalized)) {
        db.characterEvolutionDefaults = normalized;
    }
    return normalized;
}

export function ensureCharacterEvolution(char: character | groupChat): CharacterEvolutionSettings {
    const normalized = normalizeCharacterEvolutionSettings(char.characterEvolution);
    if (!jsonEqual(char.characterEvolution, normalized)) {
        char.characterEvolution = normalized;
    }
    return normalized;
}

export function getEffectiveCharacterEvolutionSettings(db: Database, char: character | groupChat): CharacterEvolutionSettings {
    // Keep this accessor pure so it is safe to call from $derived.
    const defaults = normalizeCharacterEvolutionDefaults(db.characterEvolutionDefaults);
    const settings = normalizeCharacterEvolutionSettings(char.characterEvolution);
    if (!settings.useGlobalDefaults) {
        return settings;
    }
    return {
        ...settings,
        extractionProvider: defaults.extractionProvider,
        extractionModel: defaults.extractionModel,
        extractionPrompt: defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(defaults.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(defaults.privacy),
    };
}

function itemToLine(item: CharacterEvolutionItem): string {
    const note = item.note?.trim() ? ` (${item.note.trim()})` : "";
    const confidence = item.confidence ? ` [${item.confidence}]` : "";
    return `- ${item.value}${confidence}${note}`;
}

export function hasCharacterStateTemplateBlock(db: Database): boolean {
    return Array.isArray(db.promptTemplate) && db.promptTemplate.some((item) => item?.type === "characterState");
}

export function renderCharacterEvolutionStateForPrompt(stateRaw: CharacterEvolutionState, sectionConfigsRaw: CharacterEvolutionSectionConfig[], privacyRaw?: CharacterEvolutionPrivacySettings): string {
    const state = normalizeCharacterEvolutionState(stateRaw);
    const sectionConfigs = normalizeCharacterEvolutionSectionConfigs(sectionConfigsRaw);
    const privacy = normalizeCharacterEvolutionPrivacy(privacyRaw);
    const lines: string[] = [];

    const pushSection = (label: string, content: string[]) => {
        const filtered = content.map((value) => value.trim()).filter(Boolean);
        if (filtered.length === 0) return;
        lines.push(label);
        lines.push(...filtered);
        lines.push("");
    };

    for (const section of sectionConfigs) {
        if (!section.enabled || !section.includeInPrompt) continue;
        if (section.key === "characterIntimatePreferences" && !privacy.allowCharacterIntimatePreferences) continue;
        if (section.key === "userIntimatePreferences" && !privacy.allowUserIntimatePreferences) continue;

        switch (section.key) {
            case "relationship":
                pushSection(section.label, [
                    state.relationship.trustLevel ? `Trust level: ${state.relationship.trustLevel}` : "",
                    state.relationship.dynamic ? `Dynamic: ${state.relationship.dynamic}` : "",
                ]);
                break;
            case "activeThreads":
            case "runningJokes":
            case "keyMoments":
            case "userRead":
                pushSection(section.label, (state[section.key] as string[]).map((item) => `- ${item}`));
                break;
            case "lastChatEnded":
                pushSection(section.label, [
                    state.lastChatEnded.state ? `State: ${state.lastChatEnded.state}` : "",
                    state.lastChatEnded.residue ? `Residue: ${state.lastChatEnded.residue}` : "",
                ]);
                break;
            default:
                pushSection(section.label, (state[section.key] as CharacterEvolutionItem[])
                    .filter((item) => item.status !== "archived")
                    .map((item) => itemToLine(item)));
                break;
        }
    }

    if (lines.length === 0) {
        return "";
    }

    return ["<CharacterEvolutionState>", ...lines, "</CharacterEvolutionState>"].join("\n").trim();
}
