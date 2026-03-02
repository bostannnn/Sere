const {
    toStringOrEmpty,
    normalizeTemplateRole,
} = require('./scripts.cjs');

function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseLoreKeys(raw) {
    if (typeof raw !== 'string') return [];
    return raw
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
}

function extractLoreRole(entry) {
    const rawExt = toStringOrEmpty(entry?.extentions);
    if (!rawExt) return 'system';
    const match = rawExt.match(/@role\s*=\s*(system|assistant|user|bot|model|char|human)/i);
    if (!match) return 'system';
    return normalizeTemplateRole(match[1]);
}

function loreKeyMatches(corpus, key, arg = {}) {
    if (!corpus || !key) return false;
    const useRegex = arg.useRegex === true;
    const fullWordMatching = arg.fullWordMatching === true;
    if (useRegex) {
        try {
            if (key.startsWith('/') && key.lastIndexOf('/') > 0) {
                const lastSlash = key.lastIndexOf('/');
                const pattern = key.slice(1, lastSlash);
                const flags = key.slice(lastSlash + 1);
                return new RegExp(pattern, flags).test(corpus);
            }
            return new RegExp(key, 'i').test(corpus);
        } catch {
            return false;
        }
    }
    if (fullWordMatching) {
        return new RegExp(`\\b${escapeRegex(key)}\\b`, 'i').test(corpus);
    }
    return corpus.includes(key.toLowerCase());
}

function buildServerLorebookMessages(character, chat, chats) {
    const entries = []
        .concat(Array.isArray(character?.globalLore) ? character.globalLore : [])
        .concat(Array.isArray(chat?.localLore) ? chat.localLore : []);
    if (entries.length === 0) return [];

    const corpus = (Array.isArray(chats) ? chats : [])
        .map((m) => (typeof m?.content === 'string' ? m.content : ''))
        .filter(Boolean)
        .join('\n')
        .toLowerCase();
    const fullWordMatching = character?.loreSettings?.fullWordMatching === true;
    const activated = [];
    for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        if (toStringOrEmpty(entry.mode).toLowerCase() === 'folder') continue;
        const content = toStringOrEmpty(entry.content);
        if (!content) continue;
        const alwaysActive = entry.alwaysActive === true;
        const keys = parseLoreKeys(toStringOrEmpty(entry.key)).concat(parseLoreKeys(toStringOrEmpty(entry.secondkey)));
        let matched = alwaysActive;
        if (!matched && keys.length > 0 && corpus) {
            matched = keys.some((key) =>
                loreKeyMatches(corpus, key, {
                    useRegex: entry.useRegex === true,
                    fullWordMatching,
                })
            );
        }
        if (!matched) continue;
        activated.push({
            order: Number.isFinite(Number(entry.insertorder)) ? Number(entry.insertorder) : 100,
            role: extractLoreRole(entry),
            content,
        });
    }

    activated.sort((a, b) => a.order - b.order);
    return activated.map((item) => ({
        role: item.role,
        content: item.content,
    }));
}

module.exports = {
    buildServerLorebookMessages,
};
