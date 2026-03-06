const { existsSync } = require('fs');
const fs = require('fs/promises');
const path = require('path');
const { LLMHttpError } = require('./errors.cjs');

const DEFAULT_SETTINGS_CACHE_TTL_MS = 1500;
const settingsCache = new Map();

function getSettingsCacheTtlMs() {
    const raw = Number(process.env.RISU_SETTINGS_CACHE_TTL_MS || DEFAULT_SETTINGS_CACHE_TTL_MS);
    if (!Number.isFinite(raw) || raw < 0) {
        return DEFAULT_SETTINGS_CACHE_TTL_MS;
    }
    return Math.floor(raw);
}

function normalizeSettings(parsed) {
    if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
        return parsed.data;
    }
    return parsed;
}

async function loadServerSettings(dataRoot) {
    const root = typeof dataRoot === 'string' ? dataRoot : '';
    if (!root) {
        throw new LLMHttpError(500, 'SETTINGS_PATH_INVALID', 'Server settings path is not initialized.');
    }

    const now = Date.now();
    const ttlMs = getSettingsCacheTtlMs();
    const cached = settingsCache.get(root);
    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    const settingsPath = path.join(root, 'settings.json');
    if (!existsSync(settingsPath)) {
        settingsCache.delete(root);
        throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
    }

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const normalized = normalizeSettings(JSON.parse(raw));
    settingsCache.set(root, {
        value: normalized,
        expiresAt: now + ttlMs,
    });
    return normalized;
}

function clearServerSettingsCache(dataRoot = '') {
    if (typeof dataRoot === 'string' && dataRoot) {
        settingsCache.delete(dataRoot);
        return;
    }
    settingsCache.clear();
}

module.exports = {
    loadServerSettings,
    clearServerSettingsCache,
};
