const path = require('path');

const INDEX_VERSION = 1;

function createCharacterEvolutionSemanticRecallRepository(arg = {}) {
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);

    function getSemanticRecallDir(characterDir) {
        return path.join(characterDir, 'semantic-recall');
    }

    function getSemanticRecallIndexPath(characterDir, chatId) {
        return path.join(getSemanticRecallDir(characterDir), `${chatId}.v1.json`);
    }

    function getSemanticRecallMetaPath(characterDir) {
        return path.join(getSemanticRecallDir(characterDir), '.meta.v1.json');
    }

    async function readJson(filePath, fallback) {
        try {
            return JSON.parse(await fs.readFile(filePath, 'utf-8'));
        } catch {
            return fallback;
        }
    }

    async function ensureDirectory(characterDir) {
        await fs.mkdir(getSemanticRecallDir(characterDir), { recursive: true });
    }

    async function readIndex(characterDir, chatId) {
        const filePath = getSemanticRecallIndexPath(characterDir, chatId);
        const payload = await readJson(filePath, null);
        if (!payload || typeof payload !== 'object' || Number(payload.version) !== INDEX_VERSION) {
            return null;
        }
        return payload;
    }

    async function writeIndex(characterDir, chatId, payload) {
        await ensureDirectory(characterDir);
        const filePath = getSemanticRecallIndexPath(characterDir, chatId);
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
        return filePath;
    }

    async function readMeta(characterDir) {
        const payload = await readJson(getSemanticRecallMetaPath(characterDir), null);
        if (!payload || typeof payload !== 'object' || Number(payload.version) !== INDEX_VERSION) {
            return {
                version: INDEX_VERSION,
                dirtyChats: {},
            };
        }
        return {
            version: INDEX_VERSION,
            dirtyChats: payload.dirtyChats && typeof payload.dirtyChats === 'object'
                ? payload.dirtyChats
                : {},
        };
    }

    async function writeMeta(characterDir, payload) {
        await ensureDirectory(characterDir);
        await fs.writeFile(
            getSemanticRecallMetaPath(characterDir),
            JSON.stringify({
                version: INDEX_VERSION,
                dirtyChats: payload?.dirtyChats && typeof payload.dirtyChats === 'object'
                    ? payload.dirtyChats
                    : {},
            }, null, 2),
            'utf-8'
        );
    }

    async function markDirty(characterDir, chatId, reason = 'changed') {
        if (!chatId) return;
        const meta = await readMeta(characterDir);
        meta.dirtyChats[chatId] = {
            reason,
            markedAt: Date.now(),
        };
        await writeMeta(characterDir, meta);
    }

    async function markDirtyMany(characterDir, chatIds, reason = 'changed') {
        const uniqueChatIds = [...new Set((Array.isArray(chatIds) ? chatIds : []).filter((value) => typeof value === 'string' && value.trim()))];
        if (uniqueChatIds.length === 0) return;
        const meta = await readMeta(characterDir);
        const markedAt = Date.now();
        for (const chatId of uniqueChatIds) {
            meta.dirtyChats[chatId] = {
                reason,
                markedAt,
            };
        }
        await writeMeta(characterDir, meta);
    }

    async function clearDirty(characterDir, chatId) {
        if (!chatId) return;
        const meta = await readMeta(characterDir);
        if (!Object.prototype.hasOwnProperty.call(meta.dirtyChats, chatId)) {
            return;
        }
        delete meta.dirtyChats[chatId];
        await writeMeta(characterDir, meta);
    }

    function hasIndex(characterDir, chatId) {
        return existsSync(getSemanticRecallIndexPath(characterDir, chatId));
    }

    return {
        INDEX_VERSION,
        clearDirty,
        getSemanticRecallDir,
        getSemanticRecallIndexPath,
        getSemanticRecallMetaPath,
        hasIndex,
        markDirty,
        markDirtyMany,
        readIndex,
        readMeta,
        writeIndex,
        writeMeta,
    };
}

module.exports = {
    createCharacterEvolutionSemanticRecallRepository,
};
