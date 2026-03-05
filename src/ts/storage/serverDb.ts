import { v4 as uuidv4 } from 'uuid';
import { getDatabase, setDatabase, type Database, type character, type groupChat, type Chat } from "./database.svelte";
import { isNodeServer } from "../platform";
import {
    enqueueCommand,
    fetchServerStateSnapshot,
    getServerStateLastEventId,
    setServerStateLastEventId,
    startServerStateEventStream,
    withApplyingServerSnapshot,
    type StateSnapshot,
    type StateCommand,
} from "./serverStateClient";

declare const safeStructuredClone: <T>(obj: T) => T;

const serverDbLog = (..._args: unknown[]) => {};

type SaveSelection = {
    character: string[];
    chat: [string, string][];
};

type BaselineState = {
    initialized: boolean;
    settingsHash: string;
    characterOrderSignature: string;
    characterHashes: Map<string, string>;
    chatHashes: Map<string, Map<string, string>>;
};

const baseline: BaselineState = {
    initialized: false,
    settingsHash: '',
    characterOrderSignature: '',
    characterHashes: new Map(),
    chatHashes: new Map(),
};

let realtimeSyncStarted = false;
let refreshInFlight = false;
let refreshQueued = false;
let refreshRetryTimer: ReturnType<typeof setTimeout> | null = null;

function stableHash(value: unknown) {
    return JSON.stringify(value ?? null);
}

function stripCharacters(db: Database) {
    const snapshot = safeStructuredClone(db) as Database;
    delete snapshot.characters;
    return snapshot;
}

function normalizeCharacter(raw: character | groupChat, chats: Chat[]) {
    const next = safeStructuredClone(raw) as character | groupChat;
    next.chats = chats;
    if (!next.chatFolders) next.chatFolders = [];
    if (typeof next.chatPage !== 'number') next.chatPage = 0;
    if (next.chatPage >= chats.length) next.chatPage = Math.max(0, chats.length - 1);
    return next;
}

function normalizeCharacterList(characters: unknown, chatsByCharacter: Record<string, unknown[]>) {
    if (!Array.isArray(characters)) return [] as (character | groupChat)[];
    const normalized: (character | groupChat)[] = [];

    for (const raw of characters) {
        if (!raw || typeof raw !== 'object') continue;
        const char = raw as character | groupChat;
        const charId = typeof char?.chaId === 'string' ? char.chaId : '';
        if (!charId) continue;
        const chatRows = Array.isArray(chatsByCharacter?.[charId]) ? chatsByCharacter[charId] : [];
        const chats = chatRows.filter((entry) => entry && typeof entry === 'object') as Chat[];
        normalized.push(normalizeCharacter(char, chats));
    }

    return normalized;
}

function characterWithoutChats(char: character | groupChat) {
    const next = safeStructuredClone(char) as character | groupChat;
    next.chats = [];
    return next;
}

function getCharacterOrderSignature(characters: (character | groupChat)[]) {
    return characters
        .map((entry) => (typeof entry?.chaId === 'string' ? entry.chaId : ''))
        .filter(Boolean)
        .join('\u001f');
}

function resetBaseline() {
    baseline.initialized = false;
    baseline.settingsHash = '';
    baseline.characterOrderSignature = '';
    baseline.characterHashes = new Map();
    baseline.chatHashes = new Map();
}

function setBaselineFromDatabase(db: Database) {
    const settings = stripCharacters(db);
    const characterHashes = new Map<string, string>();
    const chatHashes = new Map<string, Map<string, string>>();

    for (const char of db.characters || []) {
        const charId = typeof char?.chaId === 'string' ? char.chaId : '';
        if (!charId) continue;
        characterHashes.set(charId, stableHash(characterWithoutChats(char)));
        const chatsForChar = new Map<string, string>();
        for (const chat of char.chats || []) {
            const chatId = typeof chat?.id === 'string' ? chat.id : '';
            if (!chatId) continue;
            chatsForChar.set(chatId, stableHash(chat));
        }
        chatHashes.set(charId, chatsForChar);
    }

    baseline.initialized = true;
    baseline.settingsHash = stableHash(settings);
    baseline.characterOrderSignature = getCharacterOrderSignature(db.characters || []);
    baseline.characterHashes = characterHashes;
    baseline.chatHashes = chatHashes;
}

async function applySnapshotToDatabase(snapshot: StateSnapshot) {
    const settings = snapshot?.settings && typeof snapshot.settings === 'object'
        ? snapshot.settings
        : {};
    const chatsByCharacter = snapshot?.chatsByCharacter && typeof snapshot.chatsByCharacter === 'object'
        ? (snapshot.chatsByCharacter as Record<string, unknown[]>)
        : {};

    const characters = normalizeCharacterList(snapshot?.characters, chatsByCharacter);
    const db = { characters } as Database;
    setDatabase(db);
    const merged = Object.assign(db, settings, { characters });
    setDatabase(merged);
    setBaselineFromDatabase(merged);
    setServerStateLastEventId(Number(snapshot?.lastEventId || 0));
    return merged;
}

function buildCommands(db: Database, _selection: SaveSelection): StateCommand[] {
    const commands: StateCommand[] = [];
    const nextSettings = stripCharacters(db);
    const nextSettingsHash = stableHash(nextSettings);

    if (nextSettingsHash !== baseline.settingsHash) {
        commands.push({
            type: 'settings.replace',
            settings: nextSettings,
        });
    }

    const localChars = (db.characters || []).filter((entry): entry is character | groupChat => (
        !!entry && typeof entry === 'object' && typeof entry.chaId === 'string' && entry.chaId.length > 0
    ));
    const localCharIds = new Set(localChars.map((entry) => entry.chaId));

    for (const char of localChars) {
        const charId = char.chaId;
        const nextCharPayload = characterWithoutChats(char);
        const nextCharHash = stableHash(nextCharPayload);
        const currentCharHash = baseline.characterHashes.get(charId);

        if (!currentCharHash) {
            commands.push({
                type: 'character.create',
                charId,
                character: nextCharPayload,
            });
        } else if (currentCharHash !== nextCharHash) {
            commands.push({
                type: 'character.replace',
                charId,
                character: nextCharPayload,
            });
        }

        const serverChats = baseline.chatHashes.get(charId) || new Map<string, string>();
        const localChats = (char.chats || []).filter((chat): chat is Chat => (
            !!chat && typeof chat === 'object' && typeof chat.id === 'string' && chat.id.length > 0
        ));
        const localChatIds = new Set(localChats.map((chat) => chat.id));

        for (const chat of localChats) {
            const chatId = chat.id;
            const nextChatHash = stableHash(chat);
            const currentChatHash = serverChats.get(chatId);

            if (!currentChatHash) {
                commands.push({
                    type: 'chat.create',
                    charId,
                    chatId,
                    chat: safeStructuredClone(chat),
                });
            } else if (currentChatHash !== nextChatHash) {
                commands.push({
                    type: 'chat.replace',
                    charId,
                    chatId,
                    chat: safeStructuredClone(chat),
                });
            }
        }

        for (const serverChatId of serverChats.keys()) {
            if (localChatIds.has(serverChatId)) continue;
            commands.push({
                type: 'chat.delete',
                charId,
                chatId: serverChatId,
            });
        }
    }

    for (const serverCharId of baseline.characterHashes.keys()) {
        if (localCharIds.has(serverCharId)) continue;
        commands.push({
            type: 'character.delete',
            charId: serverCharId,
        });
    }

    const nextOrderSignature = getCharacterOrderSignature(localChars);
    if (nextOrderSignature !== baseline.characterOrderSignature) {
        commands.push({
            type: 'character.order.replace',
            order: localChars.map((entry) => entry.chaId),
        });
    }

    return commands;
}

function hasLocalUnflushedChanges() {
    if (!baseline.initialized) return false;
    try {
        const db = getDatabase();
        const pending = buildCommands(db, {
            character: [],
            chat: [],
        });
        return pending.length > 0;
    } catch {
        return false;
    }
}

function scheduleRefreshRetry() {
    if (refreshRetryTimer) return;
    refreshRetryTimer = setTimeout(() => {
        refreshRetryTimer = null;
        void refreshFromServerSnapshot();
    }, 220);
}

async function refreshFromServerSnapshot() {
    if (!isNodeServer) return;

    if (hasLocalUnflushedChanges()) {
        refreshQueued = true;
        scheduleRefreshRetry();
        return;
    }

    if (refreshInFlight) {
        refreshQueued = true;
        return;
    }

    refreshInFlight = true;
    try {
        do {
            refreshQueued = false;
            await withApplyingServerSnapshot(async () => {
                const snapshot = await fetchServerStateSnapshot();
                await applySnapshotToDatabase(snapshot);
            });
        } while (refreshQueued);
    } catch (error) {
        serverDbLog('[ServerDB] Failed to refresh snapshot', error);
    } finally {
        refreshInFlight = false;
    }
}

export async function loadServerDatabase() {
    if (!isNodeServer) {
        throw new Error('loadServerDatabase called outside node server');
    }

    const snapshot = await fetchServerStateSnapshot();
    return await applySnapshotToDatabase(snapshot);
}

export async function saveServerDatabase(db: Database, toSave: SaveSelection) {
    if (!isNodeServer) return;

    if (!baseline.initialized) {
        await loadServerDatabase();
    }

    const commands = buildCommands(db, toSave);
    if (commands.length === 0) {
        return;
    }

    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const mutationId = uuidv4();
        const response = await enqueueCommand({
            clientMutationId: mutationId,
            baseEventId: getServerStateLastEventId(),
            commands,
        });

        if (response.ok) {
            setBaselineFromDatabase(db);
            setServerStateLastEventId(response.lastEventId);
            if (refreshQueued && !refreshInFlight) {
                refreshQueued = false;
                void refreshFromServerSnapshot();
            }
            return;
        }

        const staleBase = Array.isArray(response.conflicts)
            ? response.conflicts.some((entry) => (
                !!entry
                && typeof entry === 'object'
                && (entry as { code?: unknown }).code === 'STALE_BASE_EVENT'
            ))
            : false;

        if (!staleBase || attempt >= maxRetries) {
            lastError = new Error(`POST /data/state/commands rejected with conflicts: ${JSON.stringify(response.conflicts || [])}`);
            break;
        }

        await refreshFromServerSnapshot();
    }

    if (lastError) {
        throw lastError;
    }
}

export function startServerRealtimeSync() {
    if (!isNodeServer || realtimeSyncStarted) return;
    realtimeSyncStarted = true;

    startServerStateEventStream({
        onRemoteEvent: async () => {
            await refreshFromServerSnapshot();
        },
        onGap: async () => {
            await refreshFromServerSnapshot();
        },
    });
}

export function resetServerBaseline() {
    resetBaseline();
}

export function updateCharacterEtag(_charId: string, _etag: string) {
    // Legacy no-op in server-authoritative mode.
}

export async function exportServerStorage() {
    const db = getDatabase();
    await saveServerDatabase(db, {
        character: [],
        chat: [],
    });
}
