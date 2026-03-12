import type {
    CharacterEvolutionDefaults,
    CharacterEvolutionItem,
    CharacterEvolutionPrivacySettings,
    CharacterEvolutionSectionConfig,
    CharacterEvolutionSettings,
    CharacterEvolutionState,
    Database,
    character,
    groupChat,
} from "../storage/database.types"
import {
    CHARACTER_EVOLUTION_MODEL_PREFIX_BY_PROVIDER,
    CHARACTER_EVOLUTION_MODEL_PREFIXES,
    CHARACTER_EVOLUTION_MODEL_SUGGESTIONS,
    CHARACTER_EVOLUTION_NATIVE_MODEL_SUGGESTIONS,
} from "./constants"
import {
    clone,
    createDefaultCharacterEvolutionDefaults,
    createDefaultCharacterEvolutionSectionConfigs,
    createDefaultCharacterEvolutionState,
} from "./schema"

function jsonEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
}

function normalizeItem(raw: unknown): CharacterEvolutionItem | null {
    if (!raw || typeof raw !== "object") {
        if (typeof raw === "string" && raw.trim()) {
            return { value: raw.trim(), status: "active" }
        }
        return null
    }
    const item = raw as Record<string, unknown>
    const value = typeof item.value === "string" ? item.value.trim() : ""
    if (!value) return null
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
    }
}

function normalizeStringList(raw: unknown): string[] {
    if (!Array.isArray(raw)) return []
    return raw
        .map((value) => typeof value === "string" ? value.trim() : "")
        .filter(Boolean)
}

function normalizeItemList(raw: unknown): CharacterEvolutionItem[] {
    if (!Array.isArray(raw)) return []
    return raw
        .map((item) => normalizeItem(item))
        .filter((item): item is CharacterEvolutionItem => !!item)
}

export function normalizeCharacterEvolutionExtractionModel(providerRaw: unknown, modelRaw: unknown): string {
    const provider = typeof providerRaw === "string" ? providerRaw.trim().toLowerCase() : ""
    const model = typeof modelRaw === "string" ? modelRaw.trim() : ""
    if (!model || provider === "openrouter") {
        return model
    }

    const normalizedModel = model.toLowerCase()
    const matchedPrefix = CHARACTER_EVOLUTION_MODEL_PREFIXES.find((prefix) => normalizedModel.startsWith(prefix))
    const prefix = CHARACTER_EVOLUTION_MODEL_PREFIX_BY_PROVIDER[
        provider as keyof typeof CHARACTER_EVOLUTION_MODEL_PREFIX_BY_PROVIDER
    ]
    if (prefix && matchedPrefix === prefix) {
        return model.slice(prefix.length)
    }
    if (matchedPrefix) {
        return ""
    }
    return model
}

export function getCharacterEvolutionModelSuggestions(providerRaw: string): readonly string[] {
    const provider = providerRaw.trim().toLowerCase()
    return CHARACTER_EVOLUTION_NATIVE_MODEL_SUGGESTIONS[
        provider as keyof typeof CHARACTER_EVOLUTION_NATIVE_MODEL_SUGGESTIONS
    ] ?? CHARACTER_EVOLUTION_MODEL_SUGGESTIONS
}

export function normalizeCharacterEvolutionPrivacy(raw: unknown): CharacterEvolutionPrivacySettings {
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    return {
        allowCharacterIntimatePreferences: value.allowCharacterIntimatePreferences === true,
        allowUserIntimatePreferences: value.allowUserIntimatePreferences === true,
    }
}

export function normalizeCharacterEvolutionSectionConfigs(raw: unknown): CharacterEvolutionSectionConfig[] {
    const defaults = createDefaultCharacterEvolutionSectionConfigs()
    const rawSections = Array.isArray(raw) ? raw : []
    const rawMap = new Map<string, Record<string, unknown>>()
    for (const section of rawSections) {
        if (!section || typeof section !== "object") continue
        const sectionRecord = section as Record<string, unknown>
        const key = typeof sectionRecord.key === "string" ? sectionRecord.key : ""
        if (!key) continue
        rawMap.set(key, sectionRecord)
    }
    return defaults.map((section) => {
        const override = rawMap.get(section.key) ?? {}
        return {
            ...section,
            label: typeof override.label === "string" && override.label.trim() ? override.label.trim() : section.label,
            enabled: override.enabled === undefined ? section.enabled : override.enabled === true,
            includeInPrompt: override.includeInPrompt === undefined ? section.includeInPrompt : override.includeInPrompt === true,
            instruction: typeof override.instruction === "string" && override.instruction.trim()
                ? override.instruction.trim()
                : section.instruction,
            sensitive: override.sensitive === undefined ? section.sensitive : override.sensitive === true,
        }
    })
}

export function normalizeCharacterEvolutionState(raw: unknown): CharacterEvolutionState {
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    const state = createDefaultCharacterEvolutionState()
    state.relationship = {
        trustLevel: typeof value.relationship === "object" && value.relationship && typeof (value.relationship as Record<string, unknown>).trustLevel === "string"
            ? ((value.relationship as Record<string, unknown>).trustLevel as string).trim()
            : "",
        dynamic: typeof value.relationship === "object" && value.relationship && typeof (value.relationship as Record<string, unknown>).dynamic === "string"
            ? ((value.relationship as Record<string, unknown>).dynamic as string).trim()
            : "",
    }
    state.activeThreads = normalizeStringList(value.activeThreads)
    state.runningJokes = normalizeStringList(value.runningJokes)
    state.characterLikes = normalizeItemList(value.characterLikes)
    state.characterDislikes = normalizeItemList(value.characterDislikes)
    state.characterHabits = normalizeItemList(value.characterHabits)
    state.characterBoundariesPreferences = normalizeItemList(value.characterBoundariesPreferences)
    state.userFacts = normalizeItemList(value.userFacts)
    state.userRead = normalizeStringList(value.userRead)
    state.userLikes = normalizeItemList(value.userLikes)
    state.userDislikes = normalizeItemList(value.userDislikes)
    state.lastChatEnded = {
        state: typeof value.lastChatEnded === "object" && value.lastChatEnded && typeof (value.lastChatEnded as Record<string, unknown>).state === "string"
            ? ((value.lastChatEnded as Record<string, unknown>).state as string).trim()
            : "",
        residue: typeof value.lastChatEnded === "object" && value.lastChatEnded && typeof (value.lastChatEnded as Record<string, unknown>).residue === "string"
            ? ((value.lastChatEnded as Record<string, unknown>).residue as string).trim()
            : "",
    }
    state.keyMoments = normalizeStringList(value.keyMoments)
    state.characterIntimatePreferences = normalizeItemList(value.characterIntimatePreferences)
    state.userIntimatePreferences = normalizeItemList(value.userIntimatePreferences)
    return state
}

export function normalizeCharacterEvolutionDefaults(raw: unknown): CharacterEvolutionDefaults {
    const defaults = createDefaultCharacterEvolutionDefaults()
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    const extractionMaxTokens = Number(value.extractionMaxTokens)
    const extractionProvider = typeof value.extractionProvider === "string" && value.extractionProvider.trim()
        ? value.extractionProvider.trim()
        : defaults.extractionProvider
    return {
        extractionProvider,
        extractionModel: normalizeCharacterEvolutionExtractionModel(extractionProvider, value.extractionModel),
        extractionMaxTokens: Number.isFinite(extractionMaxTokens) && extractionMaxTokens > 0
            ? Math.max(64, Math.floor(extractionMaxTokens))
            : defaults.extractionMaxTokens,
        extractionPrompt: typeof value.extractionPrompt === "string" && value.extractionPrompt.trim()
            ? value.extractionPrompt
            : defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
    }
}

export function normalizeCharacterEvolutionSettings(raw: unknown): CharacterEvolutionSettings {
    const defaults = createDefaultCharacterEvolutionDefaults()
    const value = (raw && typeof raw === "object") ? raw as Record<string, unknown> : {}
    const extractionMaxTokens = Number(value.extractionMaxTokens)
    const extractionProvider = typeof value.extractionProvider === "string" && value.extractionProvider.trim()
        ? value.extractionProvider.trim()
        : defaults.extractionProvider
    return {
        enabled: value.enabled === true,
        useGlobalDefaults: value.useGlobalDefaults !== false,
        extractionProvider,
        extractionModel: normalizeCharacterEvolutionExtractionModel(extractionProvider, value.extractionModel),
        extractionMaxTokens: Number.isFinite(extractionMaxTokens) && extractionMaxTokens > 0
            ? Math.max(64, Math.floor(extractionMaxTokens))
            : defaults.extractionMaxTokens,
        extractionPrompt: typeof value.extractionPrompt === "string" && value.extractionPrompt.trim()
            ? value.extractionPrompt
            : defaults.extractionPrompt,
        sectionConfigs: normalizeCharacterEvolutionSectionConfigs(value.sectionConfigs),
        privacy: normalizeCharacterEvolutionPrivacy(value.privacy),
        currentStateVersion: Number.isFinite(Number(value.currentStateVersion)) ? Math.max(0, Math.floor(Number(value.currentStateVersion))) : 0,
        currentState: normalizeCharacterEvolutionState(value.currentState),
        pendingProposal: value.pendingProposal && typeof value.pendingProposal === "object"
            ? {
                proposalId: typeof (value.pendingProposal as Record<string, unknown>).proposalId === "string"
                    ? (value.pendingProposal as Record<string, unknown>).proposalId as string
                    : "",
                sourceChatId: typeof (value.pendingProposal as Record<string, unknown>).sourceChatId === "string"
                    ? (value.pendingProposal as Record<string, unknown>).sourceChatId as string
                    : "",
                proposedState: normalizeCharacterEvolutionState((value.pendingProposal as Record<string, unknown>).proposedState),
                changes: Array.isArray((value.pendingProposal as Record<string, unknown>).changes)
                    ? ((value.pendingProposal as Record<string, unknown>).changes as unknown[])
                        .map((change) => {
                            if (!change || typeof change !== "object") return null
                            const entry = change as Record<string, unknown>
                            return {
                                sectionKey: typeof entry.sectionKey === "string" ? entry.sectionKey.trim() : "",
                                summary: typeof entry.summary === "string" ? entry.summary.trim() : "",
                                evidence: Array.isArray(entry.evidence)
                                    ? entry.evidence.map((item) => typeof item === "string" ? item.trim() : "").filter(Boolean)
                                    : [],
                            }
                        })
                        .filter((change): change is NonNullable<CharacterEvolutionSettings["pendingProposal"]>["changes"][number] => !!change && !!change.sectionKey)
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
                    if (!entry || typeof entry !== "object") return null
                    const item = entry as Record<string, unknown>
                    const version = Number(item.version)
                    if (!Number.isFinite(version)) return null
                    return {
                        version: Math.max(0, Math.floor(version)),
                        chatId: typeof item.chatId === "string" ? item.chatId : null,
                        acceptedAt: Number.isFinite(Number(item.acceptedAt)) ? Number(item.acceptedAt) : 0,
                    }
                })
                .filter((entry): entry is NonNullable<CharacterEvolutionSettings["stateVersions"][number]> => !!entry)
            : [],
    }
}

export function ensureDatabaseEvolutionDefaults(db: Database): CharacterEvolutionDefaults {
    const normalized = normalizeCharacterEvolutionDefaults(db.characterEvolutionDefaults)
    if (!jsonEqual(db.characterEvolutionDefaults, normalized)) {
        db.characterEvolutionDefaults = normalized
    }
    return normalized
}

export function ensureCharacterEvolution(char: character | groupChat): CharacterEvolutionSettings {
    const normalized = normalizeCharacterEvolutionSettings(char.characterEvolution)
    if (!jsonEqual(char.characterEvolution, normalized)) {
        char.characterEvolution = normalized
    }
    return normalized
}

export { clone }
