const path = require('path');

function createSnapshotService(arg = {}) {
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const dataDirs = arg.dataDirs || {};
    const readJsonWithEtag = typeof arg.readJsonWithEtag === 'function'
        ? arg.readJsonWithEtag
        : (async () => ({ json: {} }));
    const eventJournal = arg.eventJournal;

    async function readSettings() {
        const settingsPath = path.join(dataDirs.root || '', 'settings.json');
        if (!existsSync(settingsPath)) {
            return {
                settings: {},
                revision: 0,
            };
        }
        const { json } = await readJsonWithEtag(settingsPath);
        const settings = (json && typeof json === 'object' && json.data && typeof json.data === 'object')
            ? json.data
            : (json || {});
        return {
            settings,
            revision: Number.isFinite(Number(json?.revision)) ? Number(json.revision) : 0,
        };
    }

    async function listCharacterIds() {
        const characterRoot = dataDirs.characters;
        if (!characterRoot || !existsSync(characterRoot)) return [];
        const entries = await fs.readdir(characterRoot, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .filter((value) => typeof value === 'string' && value.length > 0);
    }

    async function readCharacter(charId) {
        const charPath = path.join(dataDirs.characters || '', charId, 'character.json');
        if (!existsSync(charPath)) return null;
        const { json } = await readJsonWithEtag(charPath);
        const character = (json?.character && typeof json.character === 'object')
            ? json.character
            : ((json?.data && typeof json.data === 'object') ? json.data : json);
        return {
            character,
            revision: Number.isFinite(Number(json?.revision)) ? Number(json.revision) : 0,
        };
    }

    async function readChatsForCharacter(charId) {
        const chatsDir = path.join(dataDirs.characters || '', charId, 'chats');
        if (!existsSync(chatsDir)) {
            return [];
        }
        const entries = await fs.readdir(chatsDir, { withFileTypes: true });
        const chats = [];
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
            const chatId = entry.name.replace(/\.json$/, '');
            const chatPath = path.join(chatsDir, entry.name);
            if (!existsSync(chatPath)) continue;
            const { json } = await readJsonWithEtag(chatPath);
            const chat = (json?.chat && typeof json.chat === 'object')
                ? json.chat
                : ((json?.data && typeof json.data === 'object') ? json.data : json);
            const revision = Number.isFinite(Number(json?.revision)) ? Number(json.revision) : 0;
            chats.push({
                id: chatId,
                chat,
                revision,
            });
        }
        chats.sort((a, b) => String(a.id).localeCompare(String(b.id)));
        return chats;
    }

    async function buildSnapshot() {
        const { settings, revision: settingsRevision } = await readSettings();
        const charIds = await listCharacterIds();
        const sortedCharIds = [...charIds].sort((a, b) => String(a).localeCompare(String(b)));
        const configuredOrder = Array.isArray(settings?.characterOrder)
            ? settings.characterOrder.filter((entry) => typeof entry === 'string' && entry.length > 0)
            : [];
        const seen = new Set();
        const orderedCharIds = [];
        for (const id of configuredOrder) {
            if (!sortedCharIds.includes(id) || seen.has(id)) continue;
            seen.add(id);
            orderedCharIds.push(id);
        }
        for (const id of sortedCharIds) {
            if (seen.has(id)) continue;
            seen.add(id);
            orderedCharIds.push(id);
        }
        const characters = [];
        const chatsByCharacter = {};
        const revisions = {
            settings: settingsRevision,
            characters: {},
            chats: {},
        };

        for (const charId of orderedCharIds) {
            const charResult = await readCharacter(charId);
            if (!charResult) continue;
            characters.push(charResult.character);
            revisions.characters[charId] = charResult.revision;
            chatsByCharacter[charId] = [];
            revisions.chats[charId] = {};
            const chatRows = await readChatsForCharacter(charId);
            for (const row of chatRows) {
                chatsByCharacter[charId].push(row.chat);
                revisions.chats[charId][row.id] = row.revision;
            }
        }

        const lastEventId = eventJournal
            ? await eventJournal.readLastEventId()
            : 0;

        return {
            serverTime: Date.now(),
            lastEventId,
            settings,
            characters,
            chatsByCharacter,
            revisions,
        };
    }

    return {
        buildSnapshot,
    };
}

module.exports = {
    createSnapshotService,
};
