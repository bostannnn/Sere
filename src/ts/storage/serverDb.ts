import { getDatabase, setDatabase, type Database, type character, type groupChat, type Chat } from "./database.svelte";
import { isNodeServer } from "../platform";
import { fetchWithServerAuth } from "./serverAuth";

declare const safeStructuredClone: <T>(obj: T) => T;

type Envelope<T> = {
    version: number;
    updatedAt: number;
    data?: T;
    character?: T;
    chat?: T;
};

type EtagRef = { value: string | null };

const settingsEtag: EtagRef = { value: null };
const characterEtags = new Map<string, EtagRef>();
const chatEtags = new Map<string, Map<string, EtagRef>>();
const promptEtags = new Map<string, EtagRef>();
const themeEtags = new Map<string, EtagRef>();
const colorSchemeEtags = new Map<string, EtagRef>();
let lastSettingsJson = '';
let lastPromptTemplateJson = '';
let lastThemeId = '';
let lastColorSchemeJson = '';
let lastCharacterIdSnapshot = '';

function getCharEtagRef(id: string) {
    let ref = characterEtags.get(id);
    if (!ref) {
        ref = { value: null };
        characterEtags.set(id, ref);
    }
    return ref;
}

function getChatEtagRef(charId: string, chatId: string) {
    let charMap = chatEtags.get(charId);
    if (!charMap) {
        charMap = new Map<string, EtagRef>();
        chatEtags.set(charId, charMap);
    }
    let ref = charMap.get(chatId);
    if (!ref) {
        ref = { value: null };
        charMap.set(chatId, ref);
    }
    return ref;
}

function clearChatEtagRef(charId: string, chatId: string) {
    const charMap = chatEtags.get(charId);
    if (!charMap) return;
    charMap.delete(chatId);
    if (charMap.size === 0) {
        chatEtags.delete(charId);
    }
}

function getResourceEtagRef(map: Map<string, EtagRef>, id: string) {
    let ref = map.get(id);
    if (!ref) {
        ref = { value: null };
        map.set(id, ref);
    }
    return ref;
}

async function ensureEtag(url: string, etagRef: EtagRef) {
    if (etagRef.value) return;
    // Avoid eager GET preloads in server mode; we'll resolve ETag only if PUT returns 412.
    // This prevents noisy expected 404s for resources that may not exist yet.
    void url;
}

async function fetchJsonWithEtag<T>(url: string, etagRef?: EtagRef) {
    const res = await fetchWithServerAuth(url, { cache: 'no-store' });
    if (res.status === 404) {
        return { status: 404 } as const;
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`GET ${url} failed (${res.status})`);
    }
    const etag = res.headers.get('etag');
    if (etagRef && etag) etagRef.value = etag;
    const json = (await res.json()) as Envelope<T> | T;
    return { status: 200 as const, json };
}

async function putJsonWithEtag<T>(url: string, body: Envelope<T>, etagRef?: EtagRef, attempt = 0) {
    const ifMatch = etagRef?.value ?? '*';
    const res = await fetchWithServerAuth(url, {
        method: 'PUT',
        headers: {
            'content-type': 'application/json',
            'if-match': ifMatch,
        },
        body: JSON.stringify(body),
    });

    if (res.status === 412 && ifMatch === '*' && attempt < 1) {
        const current = await fetchJsonWithEtag<T>(url, etagRef);
        if (current.status === 200 && etagRef?.value) {
            return putJsonWithEtag(url, body, etagRef, attempt + 1);
        }
    }

    if ((res.status === 409 || res.status === 412) && ifMatch !== '*' && attempt < 1) {
        const current = await fetchJsonWithEtag<T>(url, etagRef);
        if (current.status === 200 && etagRef?.value) {
            return putJsonWithEtag(url, body, etagRef, attempt + 1);
        }
    }

    if (res.status === 409 || res.status === 412) {
        throw new Error(`ETAG_MISMATCH on ${url}`);
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`PUT ${url} failed (${res.status})`);
    }
    const etag = res.headers.get('etag');
    if (etagRef && etag) etagRef.value = etag;
    return (await res.json()) as Envelope<T> | T;
}

async function deleteJsonWithEtag(url: string, etagRef?: EtagRef) {
    if (etagRef && !etagRef.value) {
        const current = await fetchJsonWithEtag<unknown>(url, etagRef);
        if (current.status === 404) return;
    }
    const ifMatch = etagRef?.value;
    if (!ifMatch) return;
    const res = await fetchWithServerAuth(url, {
        method: 'DELETE',
        headers: {
            'if-match': ifMatch,
        },
    });
    if (res.status === 404 || res.status === 204) {
        return;
    }
    if (res.status === 409) {
        throw new Error(`ETAG_MISMATCH on ${url}`);
    }
    if (res.status === 412) {
        const current = await fetchJsonWithEtag<unknown>(url, etagRef);
        if (current.status === 404) return;
        if (!etagRef?.value) {
            throw new Error(`DELETE ${url} failed (412)`);
        }
        const retry = await fetchWithServerAuth(url, {
            method: 'DELETE',
            headers: {
                'if-match': etagRef.value,
            },
        });
        if (retry.status === 404 || retry.status === 204) return;
        if (retry.status === 409) {
            throw new Error(`ETAG_MISMATCH on ${url}`);
        }
        if (retry.status < 200 || retry.status >= 300) {
            throw new Error(`DELETE ${url} failed (${retry.status})`);
        }
        return;
    }
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`DELETE ${url} failed (${res.status})`);
    }
}

async function listServerChatIds(charId: string): Promise<string[]> {
    const res = await fetchWithServerAuth(`/data/characters/${charId}/chats`, { cache: 'no-store' });
    if (res.status === 404) return [];
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`GET /data/characters/${charId}/chats failed (${res.status})`);
    }
    const list = await res.json() as { id?: string }[];
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => (typeof item?.id === 'string' ? item.id : ''))
        .filter(Boolean);
}

async function listServerCharacterIds(): Promise<string[]> {
    const res = await fetchWithServerAuth('/data/characters', { cache: 'no-store' });
    if (res.status === 404) return [];
    if (res.status < 200 || res.status >= 300) {
        throw new Error(`GET /data/characters failed (${res.status})`);
    }
    const list = await res.json() as { id?: string }[];
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => (typeof item?.id === 'string' ? item.id : ''))
        .filter(Boolean);
}

function getCharacterIdSnapshot(characters: (character | groupChat)[] | undefined) {
    if (!characters || characters.length === 0) {
        return '';
    }
    return characters
        .map((item) => (typeof item?.chaId === 'string' ? item.chaId : ''))
        .filter(Boolean)
        .sort()
        .join('\u001f');
}

function stripCharacters(db: Database) {
    const snapshot = safeStructuredClone(db) as Database;
    delete snapshot.characters;
    return snapshot;
}

function getSettingsJson(db: Database) {
    return JSON.stringify(stripCharacters(db));
}

function normalizeCharacter(raw: character | groupChat, chats: Chat[]) {
    const next = safeStructuredClone(raw) as character | groupChat;
    next.chats = chats;
    if (!next.chatFolders) next.chatFolders = [];
    if (typeof next.chatPage !== 'number') next.chatPage = 0;
    if (next.chatPage >= chats.length) next.chatPage = Math.max(0, chats.length - 1);
    return next;
}

export async function loadServerDatabase() {
    if (!isNodeServer) {
        throw new Error('loadServerDatabase called outside node server');
    }

    const settingsRes = await fetchJsonWithEtag<Database>('/data/settings', settingsEtag);
    const settingsData = settingsRes.status === 200
        ? ((settingsRes.json as Envelope<Database>).data ?? (settingsRes.json as Partial<Database>))
        : {};

    const charsRes = await fetchWithServerAuth('/data/characters', { cache: 'no-store' });
    if (charsRes.status < 200 || charsRes.status >= 300) {
        throw new Error(`GET /data/characters failed (${charsRes.status})`);
    }
    const charsList = (await charsRes.json()) as { id: string }[];
    const characters: (character | groupChat)[] = [];

    for (const item of charsList) {
        const charId = item.id;
        const charEtag = getCharEtagRef(charId);
        const charRes = await fetchJsonWithEtag<character | groupChat>(`/data/characters/${charId}`, charEtag);
        if (charRes.status !== 200) continue;
        const charEnvelope = charRes.json as Envelope<character | groupChat>;
        const charData = (charEnvelope.character ?? charEnvelope.data ?? charEnvelope) as character | groupChat;

        const chatListRes = await fetchWithServerAuth(`/data/characters/${charId}/chats`, { cache: 'no-store' });
        const chatList = chatListRes.status >= 200 && chatListRes.status < 300
            ? ((await chatListRes.json()) as { id: string }[])
            : [];
        const chats: Chat[] = [];
        for (const chatItem of chatList) {
            const chatId = chatItem.id;
            const chatEtag = getChatEtagRef(charId, chatId);
            const chatRes = await fetchJsonWithEtag<Chat>(`/data/characters/${charId}/chats/${chatId}`, chatEtag);
            if (chatRes.status !== 200) continue;
            const chatEnvelope = chatRes.json as Envelope<Chat>;
            const chatData = (chatEnvelope.chat ?? chatEnvelope.data ?? chatEnvelope) as Chat;
            chats.push(chatData);
        }

        characters.push(normalizeCharacter(charData, chats));
    }

    const db = { characters } as Database;
    setDatabase(db);
    const merged = Object.assign(db, settingsData, { characters });
    setDatabase(merged);
    lastSettingsJson = getSettingsJson(merged);

    if (merged.promptTemplate && merged.promptTemplate.length > 0) {
        lastPromptTemplateJson = JSON.stringify(merged.promptTemplate);
    }

    if (merged.colorScheme) {
        lastColorSchemeJson = JSON.stringify(merged.colorScheme);
    }

    if (merged.theme) {
        lastThemeId = merged.theme;
    }

    lastCharacterIdSnapshot = getCharacterIdSnapshot(merged.characters);

    return merged;
}

export async function saveServerDatabase(db: Database, toSave: { character: string[]; chat: [string, string][] }) {
    if (!isNodeServer) return;

    const settingsJson = getSettingsJson(db);
    if (settingsJson !== lastSettingsJson) {
        const settingsPayload = JSON.parse(settingsJson);
        await putJsonWithEtag('/data/settings', {
            version: 1,
            updatedAt: Date.now(),
            data: settingsPayload,
        }, settingsEtag);
        lastSettingsJson = settingsJson;
    }

    if (db.promptTemplate && db.promptTemplate.length > 0) {
        const promptId = 'default';
        const promptJson = JSON.stringify(db.promptTemplate);
        if (promptJson !== lastPromptTemplateJson) {
            lastPromptTemplateJson = promptJson;
            const promptEtag = getResourceEtagRef(promptEtags, promptId);
            await ensureEtag(`/data/prompts/${promptId}`, promptEtag);
            await putJsonWithEtag(`/data/prompts/${promptId}`, {
                version: 1,
                updatedAt: Date.now(),
                data: {
                    id: promptId,
                    items: safeStructuredClone(db.promptTemplate),
                },
            }, promptEtag);
        }
    }

    if (db.colorScheme) {
        const schemeId = db.colorSchemeName || 'default';
        const schemeJson = JSON.stringify(db.colorScheme);
        if (schemeJson !== lastColorSchemeJson) {
            lastColorSchemeJson = schemeJson;
            const schemeEtag = getResourceEtagRef(colorSchemeEtags, schemeId);
            await ensureEtag(`/data/color_schemes/${schemeId}`, schemeEtag);
            await putJsonWithEtag(`/data/color_schemes/${schemeId}`, {
                version: 1,
                updatedAt: Date.now(),
                data: safeStructuredClone(db.colorScheme),
            }, schemeEtag);
        }
    }

    if (db.theme) {
        const themeId = db.theme;
        if (themeId !== lastThemeId) {
            lastThemeId = themeId;
            const themeEtag = getResourceEtagRef(themeEtags, themeId);
            await ensureEtag(`/data/themes/${themeId}`, themeEtag);
            await putJsonWithEtag(`/data/themes/${themeId}`, {
                version: 1,
                updatedAt: Date.now(),
                data: { id: themeId, name: themeId },
            }, themeEtag);
        }
    }

    const localCharacters = db.characters || [];
    const localCharacterIds = new Set<string>(
        localCharacters
            .map((char) => (typeof char?.chaId === 'string' ? char.chaId : ''))
            .filter(Boolean),
    );
    const localCharacterIdSnapshot = [...localCharacterIds].sort().join('\u001f');

    if (localCharacterIdSnapshot !== lastCharacterIdSnapshot) {
        const serverCharacterIds = await listServerCharacterIds();
        for (const serverCharId of serverCharacterIds) {
            if (localCharacterIds.has(serverCharId)) continue;
            const charEtag = getCharEtagRef(serverCharId);
            await deleteJsonWithEtag(`/data/characters/${serverCharId}`, charEtag);
            characterEtags.delete(serverCharId);
            chatEtags.delete(serverCharId);
        }
        lastCharacterIdSnapshot = localCharacterIdSnapshot;
    }

    const charsToSave = new Set(toSave.character || []);
    const chatsToSave = new Map<string, Set<string>>();
    for (const [charId, chatId] of toSave.chat || []) {
        if (!chatsToSave.has(charId)) chatsToSave.set(charId, new Set());
        chatsToSave.get(charId)!.add(chatId);
    }

    for (const char of localCharacters) {
        const charId = char.chaId;
        if (!charId) continue;
        const shouldSaveChar = charsToSave.has(charId);
        const localChats = (char.chats || []).filter((chat): chat is typeof chat & { id: string } => (
            typeof chat?.id === 'string' && chat.id.length > 0
        ));
        const localChatIds = new Set(localChats.map((chat) => chat.id));

        if (shouldSaveChar) {
            const charPayload = safeStructuredClone(char) as character | groupChat;
            charPayload.chats = [];
            const charEtag = getCharEtagRef(charId);
            await putJsonWithEtag(`/data/characters/${charId}`, {
                version: 1,
                updatedAt: Date.now(),
                character: charPayload,
            }, charEtag);

            const serverChatIds = await listServerChatIds(charId);
            const serverChatIdSet = new Set(serverChatIds);

            // Delete orphan chat files that were removed in UI.
            for (const serverChatId of serverChatIds) {
                if (localChatIds.has(serverChatId)) continue;
                const chatEtag = getChatEtagRef(charId, serverChatId);
                await deleteJsonWithEtag(`/data/characters/${charId}/chats/${serverChatId}`, chatEtag);
                clearChatEtagRef(charId, serverChatId);
            }

            // Ensure chat files exist for all local chats (e.g. newly created chats).
            for (const chat of localChats) {
                if (serverChatIdSet.has(chat.id)) continue;
                const chatEtag = getChatEtagRef(charId, chat.id);
                await putJsonWithEtag(`/data/characters/${charId}/chats/${chat.id}`, {
                    version: 1,
                    updatedAt: Date.now(),
                    chat: safeStructuredClone(chat),
                }, chatEtag);
            }
        }

        const chatIds = chatsToSave.get(charId);
        if (!chatIds || chatIds.size === 0) continue;
        for (const chat of char.chats || []) {
            if (!chat.id || !chatIds.has(chat.id)) continue;
            const chatEtag = getChatEtagRef(charId, chat.id);
            await putJsonWithEtag(`/data/characters/${charId}/chats/${chat.id}`, {
                version: 1,
                updatedAt: Date.now(),
                chat: safeStructuredClone(chat),
            }, chatEtag);
        }
    }
}

export function updateCharacterEtag(charId: string, etag: string) {
    const ref = getCharEtagRef(charId);
    ref.value = etag;
}

export async function exportServerStorage() {
    const db = getDatabase();
    const characterIds: string[] = [];
    const chatIds: [string, string][] = [];
    for (const char of db.characters || []) {
        if (!char?.chaId) continue;
        characterIds.push(char.chaId);
        for (const chat of char.chats || []) {
            if (!chat?.id) continue;
            chatIds.push([char.chaId, chat.id]);
        }
    }
    await saveServerDatabase(db, {
        character: characterIds,
        chat: chatIds,
    });
}
