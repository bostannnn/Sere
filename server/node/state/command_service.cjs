const path = require('path');

function createCommandService(arg = {}) {
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const dataDirs = arg.dataDirs || {};
    const readJsonWithEtag = typeof arg.readJsonWithEtag === 'function'
        ? arg.readJsonWithEtag
        : (async () => ({ json: {} }));
    const writeJsonWithEtag = typeof arg.writeJsonWithEtag === 'function'
        ? arg.writeJsonWithEtag
        : (async () => ({}));
    const ensureDir = typeof arg.ensureDir === 'function'
        ? arg.ensureDir
        : (async () => {});
    const isSafePathSegment = typeof arg.isSafePathSegment === 'function'
        ? arg.isSafePathSegment
        : (() => false);
    const resourceLocks = arg.resourceLocks;
    const eventJournal = arg.eventJournal;

    const mutationCache = new Map();
    const mutationCacheOrder = [];
    const mutationInFlight = new Map();
    const mutationCacheLimit = Number.isFinite(Number(arg.mutationCacheLimit))
        ? Math.max(10, Number(arg.mutationCacheLimit))
        : 1000;

    function cloneValue(value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return value;
        }
    }

    function conflict(index, code, message, details = {}) {
        return {
            index,
            code,
            message,
            details,
        };
    }

    function parseRevision(value) {
        const revision = Number(value);
        if (!Number.isFinite(revision) || revision < 0) return 0;
        return Math.floor(revision);
    }

    function parseBaseEventId(value) {
        if (!Number.isFinite(Number(value))) return null;
        const parsed = Number(value);
        if (parsed < 0) return null;
        return Math.floor(parsed);
    }

    function getSettingsPath() {
        return path.join(dataDirs.root || '', 'settings.json');
    }

    function getCharacterPath(charId) {
        return path.join(dataDirs.characters || '', charId, 'character.json');
    }

    function getCharacterDir(charId) {
        return path.join(dataDirs.characters || '', charId);
    }

    function getChatPath(charId, chatId) {
        return path.join(dataDirs.characters || '', charId, 'chats', `${chatId}.json`);
    }

    async function readEnvelope(filePath) {
        if (!existsSync(filePath)) return null;
        const { json } = await readJsonWithEtag(filePath);
        return json;
    }

    async function writeEnvelopeAtRevision(filePath, payload, revision) {
        const nextPayload = {
            ...(payload || {}),
            revision: parseRevision(revision),
        };
        await ensureDir(path.dirname(filePath));
        await writeJsonWithEtag(filePath, nextPayload);
    }

    function canonicalizeForFingerprint(value) {
        if (Array.isArray(value)) {
            return value.map(canonicalizeForFingerprint);
        }
        if (!value || typeof value !== 'object') {
            return value;
        }
        const keys = Object.keys(value).sort();
        const out = {};
        for (const key of keys) {
            out[key] = canonicalizeForFingerprint(value[key]);
        }
        return out;
    }

    function computeMutationFingerprint(requestBody) {
        try {
            return JSON.stringify(canonicalizeForFingerprint({
                baseEventId: requestBody?.baseEventId ?? null,
                commands: Array.isArray(requestBody?.commands) ? requestBody.commands : [],
            }));
        } catch {
            return '';
        }
    }

    function buildMutationIdReuseResponse(lastEventId) {
        return {
            ok: false,
            lastEventId,
            applied: [],
            conflicts: [
                conflict(
                    -1,
                    'CLIENT_MUTATION_ID_REUSED',
                    'clientMutationId was reused with a different request payload.',
                ),
            ],
        };
    }

    function getMutationCache(clientMutationId, requestFingerprint) {
        if (!clientMutationId) return null;
        if (!mutationCache.has(clientMutationId)) return null;
        const entry = mutationCache.get(clientMutationId);
        if (!entry || typeof entry !== 'object') return null;
        if ((entry.fingerprint || '') !== requestFingerprint) {
            return {
                status: 'mismatch',
                response: null,
            };
        }
        return {
            status: 'hit',
            response: cloneValue(entry.response),
        };
    }

    function putMutationCache(clientMutationId, requestFingerprint, result) {
        if (!clientMutationId) return;
        mutationCache.set(clientMutationId, {
            fingerprint: requestFingerprint,
            response: cloneValue(result),
        });
        const existingIndex = mutationCacheOrder.indexOf(clientMutationId);
        if (existingIndex >= 0) {
            mutationCacheOrder.splice(existingIndex, 1);
        }
        mutationCacheOrder.push(clientMutationId);
        while (mutationCacheOrder.length > mutationCacheLimit) {
            const oldest = mutationCacheOrder.shift();
            if (!oldest) continue;
            mutationCache.delete(oldest);
        }
    }

    function createWorkingState() {
        return {
            settingsLoaded: false,
            settings: {
                exists: false,
                data: {},
                baseRevision: 0,
                workingRevision: 0,
                touched: false,
            },
            characters: new Map(),
            chats: new Map(),
        };
    }

    async function loadSettingsState(state) {
        if (state.settingsLoaded) return state.settings;
        state.settingsLoaded = true;
        const settingsPath = getSettingsPath();
        if (!existsSync(settingsPath)) {
            state.settings = {
                exists: false,
                data: {},
                baseRevision: 0,
                workingRevision: 0,
                touched: false,
            };
            return state.settings;
        }
        const envelope = await readEnvelope(settingsPath);
        const settingsData = (envelope?.data && typeof envelope.data === 'object')
            ? envelope.data
            : (envelope || {});
        const revision = parseRevision(envelope?.revision);
        state.settings = {
            exists: true,
            data: cloneValue(settingsData) || {},
            baseRevision: revision,
            workingRevision: revision,
            touched: false,
        };
        return state.settings;
    }

    async function loadCharacterState(state, charId) {
        if (state.characters.has(charId)) {
            return state.characters.get(charId);
        }

        const charPath = getCharacterPath(charId);
        if (!existsSync(charPath)) {
            const missingState = {
                exists: false,
                deleted: false,
                touched: false,
                deleteDir: false,
                character: null,
                baseRevision: 0,
                workingRevision: 0,
            };
            state.characters.set(charId, missingState);
            return missingState;
        }

        const envelope = await readEnvelope(charPath);
        const characterData = (envelope?.character && typeof envelope.character === 'object')
            ? envelope.character
            : ((envelope?.data && typeof envelope.data === 'object') ? envelope.data : {});
        const revision = parseRevision(envelope?.revision);
        const charState = {
            exists: true,
            deleted: false,
            touched: false,
            deleteDir: false,
            character: cloneValue(characterData) || {},
            baseRevision: revision,
            workingRevision: revision,
        };
        state.characters.set(charId, charState);
        return charState;
    }

    function getChatMap(state, charId) {
        if (!state.chats.has(charId)) {
            state.chats.set(charId, new Map());
        }
        return state.chats.get(charId);
    }

    async function loadChatState(state, charId, chatId) {
        const chatMap = getChatMap(state, charId);
        if (chatMap.has(chatId)) {
            return chatMap.get(chatId);
        }

        const chatPath = getChatPath(charId, chatId);
        if (!existsSync(chatPath)) {
            const missingState = {
                exists: false,
                deleted: false,
                touched: false,
                chat: null,
                baseRevision: 0,
                workingRevision: 0,
            };
            chatMap.set(chatId, missingState);
            return missingState;
        }

        const envelope = await readEnvelope(chatPath);
        const chatData = (envelope?.chat && typeof envelope.chat === 'object')
            ? envelope.chat
            : ((envelope?.data && typeof envelope.data === 'object') ? envelope.data : {});
        const revision = parseRevision(envelope?.revision);
        const chatState = {
            exists: true,
            deleted: false,
            touched: false,
            chat: cloneValue(chatData) || {},
            baseRevision: revision,
            workingRevision: revision,
        };
        chatMap.set(chatId, chatState);
        return chatState;
    }

    async function appendCharacterOrder(state, charId) {
        const settings = await loadSettingsState(state);
        const currentOrder = Array.isArray(settings.data?.characterOrder)
            ? settings.data.characterOrder
            : [];
        if (currentOrder.includes(charId)) return;
        settings.data = {
            ...(settings.data || {}),
            characterOrder: [...currentOrder, charId],
        };
        settings.workingRevision += 1;
        settings.touched = true;
    }

    async function removeCharacterOrder(state, charId) {
        const settings = await loadSettingsState(state);
        const currentOrder = Array.isArray(settings.data?.characterOrder)
            ? settings.data.characterOrder
            : [];
        const nextOrder = currentOrder.filter((entry) => entry !== charId);
        if (nextOrder.length === currentOrder.length) return;
        settings.data = {
            ...(settings.data || {}),
            characterOrder: nextOrder,
        };
        settings.workingRevision += 1;
        settings.touched = true;
    }

    async function applySettingsReplace(command, index, state) {
        const settings = await loadSettingsState(state);
        const nextSettings = (command?.settings && typeof command.settings === 'object')
            ? cloneValue(command.settings)
            : {};
        settings.data = nextSettings || {};
        settings.workingRevision += 1;
        settings.touched = true;

        return {
            applied: {
                index,
                type: 'settings.replace',
                resource: { type: 'settings' },
                revision: settings.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'settings.replaced',
                resource: { type: 'settings' },
                revision: settings.workingRevision,
                delta: {},
            },
        };
    }

    async function applyCharacterCreate(command, index, state) {
        const character = (command?.character && typeof command.character === 'object')
            ? cloneValue(command.character)
            : null;
        if (!character) {
            return { conflict: conflict(index, 'INVALID_CHARACTER', 'character payload is required.') };
        }

        const charId = typeof command?.charId === 'string' ? command.charId : character.chaId;
        if (!isSafePathSegment(charId)) {
            return { conflict: conflict(index, 'INVALID_CHARACTER_ID', 'character id is required and must be safe.') };
        }

        const charState = await loadCharacterState(state, charId);
        if (charState.exists && !charState.deleted) {
            return { conflict: conflict(index, 'ALREADY_EXISTS', 'character already exists.', { charId }) };
        }

        character.chaId = charId;
        charState.exists = true;
        charState.deleted = false;
        charState.deleteDir = false;
        charState.touched = true;
        charState.character = character;
        charState.baseRevision = 0;
        charState.workingRevision = 1;

        const chatMap = new Map();
        state.chats.set(charId, chatMap);
        const chats = Array.isArray(command?.chats) ? command.chats : [];
        for (const chat of chats) {
            if (!chat || typeof chat !== 'object') continue;
            const chatId = typeof chat.id === 'string' ? chat.id : '';
            if (!isSafePathSegment(chatId)) continue;
            const chatPayload = cloneValue(chat);
            chatPayload.id = chatId;
            chatMap.set(chatId, {
                exists: true,
                deleted: false,
                touched: true,
                chat: chatPayload,
                baseRevision: 0,
                workingRevision: 1,
            });
        }

        await appendCharacterOrder(state, charId);

        return {
            applied: {
                index,
                type: 'character.create',
                resource: { type: 'character', charId },
                revision: charState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'character.created',
                resource: { type: 'character', charId },
                revision: charState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyCharacterReplace(command, index, state) {
        const character = (command?.character && typeof command.character === 'object')
            ? cloneValue(command.character)
            : null;
        if (!character) {
            return { conflict: conflict(index, 'INVALID_CHARACTER', 'character payload is required.') };
        }

        const charId = typeof command?.charId === 'string' ? command.charId : character.chaId;
        if (!isSafePathSegment(charId)) {
            return { conflict: conflict(index, 'INVALID_CHARACTER_ID', 'character id is required and must be safe.') };
        }

        const charState = await loadCharacterState(state, charId);
        if (!charState.exists || charState.deleted) {
            return { conflict: conflict(index, 'NOT_FOUND', 'character not found.', { charId }) };
        }

        character.chaId = charId;
        charState.character = character;
        charState.touched = true;
        charState.workingRevision += 1;

        return {
            applied: {
                index,
                type: 'character.replace',
                resource: { type: 'character', charId },
                revision: charState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'character.replaced',
                resource: { type: 'character', charId },
                revision: charState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyCharacterDelete(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        if (!isSafePathSegment(charId)) {
            return { conflict: conflict(index, 'INVALID_CHARACTER_ID', 'character id is required and must be safe.') };
        }

        const charState = await loadCharacterState(state, charId);
        if (!charState.exists || charState.deleted) {
            return { conflict: conflict(index, 'NOT_FOUND', 'character not found.', { charId }) };
        }

        charState.exists = false;
        charState.deleted = true;
        charState.deleteDir = true;
        charState.touched = true;
        charState.character = null;
        charState.baseRevision = 0;
        charState.workingRevision = 0;
        state.chats.set(charId, new Map());

        await removeCharacterOrder(state, charId);

        return {
            applied: {
                index,
                type: 'character.delete',
                resource: { type: 'character', charId },
                revision: 0,
                eventId: 0,
            },
            event: {
                kind: 'character.deleted',
                resource: { type: 'character', charId },
                revision: 0,
                delta: {},
            },
        };
    }

    async function assertCharacterExists(state, charId, index) {
        if (!isSafePathSegment(charId)) {
            return { conflict: conflict(index, 'INVALID_CHARACTER_ID', 'character id is required and must be safe.') };
        }
        const charState = await loadCharacterState(state, charId);
        if (!charState.exists || charState.deleted) {
            return { conflict: conflict(index, 'CHARACTER_NOT_FOUND', 'character not found.', { charId }) };
        }
        return { charState };
    }

    async function applyChatCreate(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        const charCheck = await assertCharacterExists(state, charId, index);
        if (charCheck?.conflict) return charCheck;

        const chat = (command?.chat && typeof command.chat === 'object')
            ? cloneValue(command.chat)
            : null;
        if (!chat) {
            return { conflict: conflict(index, 'INVALID_CHAT', 'chat payload is required.') };
        }

        const chatId = typeof command?.chatId === 'string' ? command.chatId : chat.id;
        if (!isSafePathSegment(chatId)) {
            return { conflict: conflict(index, 'INVALID_CHAT_ID', 'chat id is required and must be safe.') };
        }

        const chatState = await loadChatState(state, charId, chatId);
        if (chatState.exists && !chatState.deleted) {
            return { conflict: conflict(index, 'ALREADY_EXISTS', 'chat already exists.', { charId, chatId }) };
        }

        chat.id = chatId;
        chatState.exists = true;
        chatState.deleted = false;
        chatState.touched = true;
        chatState.chat = chat;
        chatState.baseRevision = 0;
        chatState.workingRevision = 1;

        return {
            applied: {
                index,
                type: 'chat.create',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'chat.created',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyChatReplace(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        const charCheck = await assertCharacterExists(state, charId, index);
        if (charCheck?.conflict) return charCheck;

        const chat = (command?.chat && typeof command.chat === 'object')
            ? cloneValue(command.chat)
            : null;
        if (!chat) {
            return { conflict: conflict(index, 'INVALID_CHAT', 'chat payload is required.') };
        }

        const chatId = typeof command?.chatId === 'string' ? command.chatId : chat.id;
        if (!isSafePathSegment(chatId)) {
            return { conflict: conflict(index, 'INVALID_CHAT_ID', 'chat id is required and must be safe.') };
        }

        const chatState = await loadChatState(state, charId, chatId);
        if (!chatState.exists || chatState.deleted) {
            return { conflict: conflict(index, 'NOT_FOUND', 'chat not found.', { charId, chatId }) };
        }

        chat.id = chatId;
        chatState.chat = chat;
        chatState.touched = true;
        chatState.workingRevision += 1;

        return {
            applied: {
                index,
                type: 'chat.replace',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'chat.replaced',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyChatDelete(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        const charCheck = await assertCharacterExists(state, charId, index);
        if (charCheck?.conflict) return charCheck;

        const chatId = typeof command?.chatId === 'string' ? command.chatId : '';
        if (!isSafePathSegment(chatId)) {
            return { conflict: conflict(index, 'INVALID_CHAT_ID', 'chat id is required and must be safe.') };
        }

        const chatState = await loadChatState(state, charId, chatId);
        if (!chatState.exists || chatState.deleted) {
            return { conflict: conflict(index, 'NOT_FOUND', 'chat not found.', { charId, chatId }) };
        }

        chatState.exists = false;
        chatState.deleted = true;
        chatState.touched = true;
        chatState.chat = null;
        chatState.baseRevision = 0;
        chatState.workingRevision = 0;

        return {
            applied: {
                index,
                type: 'chat.delete',
                resource: { type: 'chat', charId, chatId },
                revision: 0,
                eventId: 0,
            },
            event: {
                kind: 'chat.deleted',
                resource: { type: 'chat', charId, chatId },
                revision: 0,
                delta: {},
            },
        };
    }

    async function requireExistingChat(state, index, charId, chatId) {
        const charCheck = await assertCharacterExists(state, charId, index);
        if (charCheck?.conflict) return charCheck;

        if (!isSafePathSegment(chatId)) {
            return { conflict: conflict(index, 'INVALID_CHAT_ID', 'chat id is required and must be safe.') };
        }

        const chatState = await loadChatState(state, charId, chatId);
        if (!chatState.exists || chatState.deleted) {
            return { conflict: conflict(index, 'NOT_FOUND', 'chat not found.', { charId, chatId }) };
        }

        return { chatState };
    }

    async function applyChatMessageAppend(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        const chatId = typeof command?.chatId === 'string' ? command.chatId : '';
        const message = (command?.message && typeof command.message === 'object')
            ? cloneValue(command.message)
            : null;
        if (!message) {
            return { conflict: conflict(index, 'INVALID_MESSAGE', 'message payload is required.') };
        }

        const required = await requireExistingChat(state, index, charId, chatId);
        if (required?.conflict) return required;

        const chatState = required.chatState;
        const chat = (chatState.chat && typeof chatState.chat === 'object')
            ? cloneValue(chatState.chat)
            : {};
        const messages = Array.isArray(chat.message) ? [...chat.message] : [];
        messages.push(message);
        chat.message = messages;

        chatState.chat = chat;
        chatState.touched = true;
        chatState.workingRevision += 1;

        return {
            applied: {
                index,
                type: 'chat.message.append',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'chat.message.appended',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyChatMessageReplace(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        const chatId = typeof command?.chatId === 'string' ? command.chatId : '';
        const message = (command?.message && typeof command.message === 'object')
            ? cloneValue(command.message)
            : null;
        if (!message) {
            return { conflict: conflict(index, 'INVALID_MESSAGE', 'message payload is required.') };
        }

        const required = await requireExistingChat(state, index, charId, chatId);
        if (required?.conflict) return required;
        const chatState = required.chatState;
        const chat = (chatState.chat && typeof chatState.chat === 'object')
            ? cloneValue(chatState.chat)
            : {};
        const messages = Array.isArray(chat.message) ? [...chat.message] : [];

        const targetIndex = Number.isFinite(Number(command?.index)) ? Number(command.index) : -1;
        const targetMessageId = typeof command?.messageId === 'string' ? command.messageId : '';
        let replaceIndex = -1;
        if (targetIndex >= 0 && targetIndex < messages.length) {
            replaceIndex = targetIndex;
        } else if (targetMessageId) {
            replaceIndex = messages.findIndex((entry) => entry?.chatId === targetMessageId || entry?.id === targetMessageId);
        }
        if (replaceIndex < 0 || replaceIndex >= messages.length) {
            return { conflict: conflict(index, 'MESSAGE_NOT_FOUND', 'target message not found.', { charId, chatId }) };
        }

        messages[replaceIndex] = message;
        chat.message = messages;
        chatState.chat = chat;
        chatState.touched = true;
        chatState.workingRevision += 1;

        return {
            applied: {
                index,
                type: 'chat.message.replace',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'chat.message.replaced',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyChatMessagesReorder(command, index, state) {
        const charId = typeof command?.charId === 'string' ? command.charId : '';
        const chatId = typeof command?.chatId === 'string' ? command.chatId : '';
        const order = Array.isArray(command?.order) ? command.order : null;
        if (!order) {
            return { conflict: conflict(index, 'INVALID_ORDER', 'order array is required.') };
        }

        const required = await requireExistingChat(state, index, charId, chatId);
        if (required?.conflict) return required;
        const chatState = required.chatState;

        const chat = (chatState.chat && typeof chatState.chat === 'object')
            ? cloneValue(chatState.chat)
            : {};
        const messages = Array.isArray(chat.message) ? [...chat.message] : [];
        const byId = new Map();
        for (const entry of messages) {
            const id = typeof entry?.chatId === 'string'
                ? entry.chatId
                : (typeof entry?.id === 'string' ? entry.id : '');
            if (!id) continue;
            byId.set(id, entry);
        }

        const reordered = [];
        const used = new Set();
        for (const id of order) {
            if (typeof id !== 'string' || !byId.has(id) || used.has(id)) continue;
            reordered.push(byId.get(id));
            used.add(id);
        }
        for (const entry of messages) {
            const id = typeof entry?.chatId === 'string'
                ? entry.chatId
                : (typeof entry?.id === 'string' ? entry.id : '');
            if (id && used.has(id)) continue;
            reordered.push(entry);
        }

        chat.message = reordered;
        chatState.chat = chat;
        chatState.touched = true;
        chatState.workingRevision += 1;

        return {
            applied: {
                index,
                type: 'chat.messages.reorder',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'chat.messages.reordered',
                resource: { type: 'chat', charId, chatId },
                revision: chatState.workingRevision,
                delta: {},
            },
        };
    }

    async function applyCharacterOrderReplace(command, index, state) {
        const order = Array.isArray(command?.order) ? command.order : null;
        if (!order) {
            return { conflict: conflict(index, 'INVALID_ORDER', 'order array is required.') };
        }

        const settings = await loadSettingsState(state);
        settings.data = {
            ...(settings.data || {}),
            characterOrder: cloneValue(order),
        };
        settings.workingRevision += 1;
        settings.touched = true;

        return {
            applied: {
                index,
                type: 'character.order.replace',
                resource: { type: 'settings' },
                revision: settings.workingRevision,
                eventId: 0,
            },
            event: {
                kind: 'character.order.replaced',
                resource: { type: 'settings' },
                revision: settings.workingRevision,
                delta: {},
            },
        };
    }

    async function applySingleCommand(command, index, state) {
        const type = typeof command?.type === 'string' ? command.type : '';
        switch (type) {
            case 'settings.replace':
                return applySettingsReplace(command, index, state);
            case 'character.create':
                return applyCharacterCreate(command, index, state);
            case 'character.replace':
                return applyCharacterReplace(command, index, state);
            case 'character.delete':
                return applyCharacterDelete(command, index, state);
            case 'chat.create':
                return applyChatCreate(command, index, state);
            case 'chat.replace':
                return applyChatReplace(command, index, state);
            case 'chat.delete':
                return applyChatDelete(command, index, state);
            case 'chat.message.append':
                return applyChatMessageAppend(command, index, state);
            case 'chat.message.replace':
                return applyChatMessageReplace(command, index, state);
            case 'chat.messages.reorder':
                return applyChatMessagesReorder(command, index, state);
            case 'character.order.replace':
                return applyCharacterOrderReplace(command, index, state);
            default:
                return { conflict: conflict(index, 'UNKNOWN_COMMAND', `Unknown command type: ${type || '(empty)'}`) };
        }
    }

    async function commitState(state) {
        if (state.settings.touched) {
            await writeEnvelopeAtRevision(getSettingsPath(), {
                data: state.settings.data,
            }, state.settings.workingRevision);
        }

        const characterEntries = [...state.characters.entries()].sort((a, b) => a[0].localeCompare(b[0]));

        for (const [charId, charState] of characterEntries) {
            if (charState.deleteDir && !charState.exists) {
                await fs.rm(getCharacterDir(charId), { recursive: true, force: true });
                continue;
            }
            if (!charState.touched || !charState.exists) continue;
            await writeEnvelopeAtRevision(getCharacterPath(charId), {
                character: charState.character,
            }, charState.workingRevision);
        }

        for (const [charId, chatMap] of [...state.chats.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
            const charState = state.characters.get(charId);
            if (charState?.deleteDir && !charState.exists) {
                continue;
            }
            for (const [chatId, chatState] of [...chatMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
                if (!chatState.touched) continue;
                if (chatState.deleted && !chatState.exists) {
                    await fs.rm(getChatPath(charId, chatId), { force: true });
                    continue;
                }
                if (!chatState.exists) continue;
                await writeEnvelopeAtRevision(getChatPath(charId, chatId), {
                    chat: chatState.chat,
                }, chatState.workingRevision);
            }
        }
    }

    async function runCommandsLocked(requestBody) {
        const clientMutationId = typeof requestBody?.clientMutationId === 'string'
            ? requestBody.clientMutationId
            : '';
        const requestFingerprint = computeMutationFingerprint(requestBody);

        const cached = getMutationCache(clientMutationId, requestFingerprint);
        if (cached?.status === 'hit') {
            return cached.response;
        }
        if (cached?.status === 'mismatch') {
            return buildMutationIdReuseResponse(await eventJournal.readLastEventId());
        }

        const commands = Array.isArray(requestBody?.commands) ? requestBody.commands : [];
        const baseEventId = parseBaseEventId(requestBody?.baseEventId);

        const currentLastEventId = await eventJournal.readLastEventId();
        if (baseEventId !== null && baseEventId < currentLastEventId) {
            const result = {
                ok: false,
                lastEventId: currentLastEventId,
                applied: [],
                conflicts: [
                    conflict(-1, 'STALE_BASE_EVENT', 'baseEventId is older than server event cursor.', {
                        baseEventId,
                        currentLastEventId,
                    }),
                ],
            };
            putMutationCache(clientMutationId, requestFingerprint, result);
            return cloneValue(result);
        }

        const state = createWorkingState();
        const applied = [];
        const pendingEvents = [];

        for (let index = 0; index < commands.length; index += 1) {
            const command = commands[index];
            const result = await applySingleCommand(command, index, state);
            if (result?.conflict) {
                const response = {
                    ok: false,
                    lastEventId: await eventJournal.readLastEventId(),
                    applied: [],
                    conflicts: [result.conflict],
                };
                putMutationCache(clientMutationId, requestFingerprint, response);
                return cloneValue(response);
            }
            if (result?.applied) {
                applied.push(result.applied);
            }
            if (result?.event) {
                pendingEvents.push(result.event);
            }
        }

        await commitState(state);

        for (let i = 0; i < pendingEvents.length; i += 1) {
            const event = pendingEvents[i];
            const appended = await eventJournal.appendEvent({
                kind: event.kind,
                resource: event.resource,
                revision: event.revision,
                delta: event.delta,
                clientMutationId,
            });
            if (applied[i]) {
                applied[i].eventId = appended.id;
            }
        }

        const lastEventId = await eventJournal.readLastEventId();
        const response = {
            ok: true,
            lastEventId,
            applied,
            conflicts: [],
        };
        putMutationCache(clientMutationId, requestFingerprint, response);
        return cloneValue(response);
    }

    async function applyCommands(requestBody) {
        if (!resourceLocks) {
            throw new Error('command_service requires resourceLocks');
        }
        if (!eventJournal) {
            throw new Error('command_service requires eventJournal');
        }

        const clientMutationId = typeof requestBody?.clientMutationId === 'string'
            ? requestBody.clientMutationId
            : '';
        const requestFingerprint = computeMutationFingerprint(requestBody);

        const cached = getMutationCache(clientMutationId, requestFingerprint);
        if (cached?.status === 'hit') {
            return cached.response;
        }
        if (cached?.status === 'mismatch') {
            return buildMutationIdReuseResponse(await eventJournal.readLastEventId());
        }

        if (clientMutationId && mutationInFlight.has(clientMutationId)) {
            const inFlight = mutationInFlight.get(clientMutationId);
            if (inFlight.fingerprint !== requestFingerprint) {
                return buildMutationIdReuseResponse(await eventJournal.readLastEventId());
            }
            return cloneValue(await inFlight.runner);
        }

        const runner = resourceLocks.withKey('__state_batch__', () => runCommandsLocked(requestBody));
        if (clientMutationId) {
            mutationInFlight.set(clientMutationId, {
                fingerprint: requestFingerprint,
                runner,
            });
        }

        try {
            return cloneValue(await runner);
        } finally {
            if (clientMutationId) {
                mutationInFlight.delete(clientMutationId);
            }
        }
    }

    return {
        applyCommands,
    };
}

module.exports = {
    createCommandService,
};
