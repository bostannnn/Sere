function createCharacterEvolutionHistoryResolver(arg = {}) {
    const { normalizeCharacterEvolutionRangeRef } = arg;

    function normalizeRange(value) {
        return typeof normalizeCharacterEvolutionRangeRef === 'function'
            ? normalizeCharacterEvolutionRangeRef(value)
            : null;
    }

    function normalizeVersion(value) {
        const version = Number(value);
        if (!Number.isFinite(version) || version < 0) {
            return 0;
        }
        return Math.floor(version);
    }

    function normalizeAcceptedAt(value) {
        return Number.isFinite(Number(value)) ? Number(value) : 0;
    }

    function findStoredVersionMeta(evolution, version) {
        if (!Array.isArray(evolution?.stateVersions)) {
            return null;
        }
        return evolution.stateVersions.find((entry) => normalizeVersion(entry?.version) === version) ?? null;
    }

    function findProcessedRange(evolution, version) {
        if (!Array.isArray(evolution?.processedRanges)) {
            return null;
        }
        return evolution.processedRanges.find((entry) => normalizeVersion(entry?.version) === version) ?? null;
    }

    function buildVersionMeta(version, preferred, fallback) {
        const normalizedVersion = normalizeVersion(version);
        const preferredRange = normalizeRange(preferred?.range);
        const fallbackRange = normalizeRange(fallback?.range);
        const chatId = typeof preferred?.chatId === 'string' && preferred.chatId
            ? preferred.chatId
            : (typeof fallback?.chatId === 'string' && fallback.chatId ? fallback.chatId : null);
        const acceptedAt = normalizeAcceptedAt(preferred?.acceptedAt || fallback?.acceptedAt);
        return {
            version: normalizedVersion,
            chatId,
            acceptedAt,
            ...(preferredRange ? { range: preferredRange } : (fallbackRange ? { range: fallbackRange } : {})),
        };
    }

    function buildSyntheticCurrentVersionMeta(evolution) {
        const version = normalizeVersion(evolution?.currentStateVersion);
        if (version <= 0) {
            return null;
        }
        const storedMeta = findStoredVersionMeta(evolution, version);
        const processedRange = findProcessedRange(evolution, version);
        return buildVersionMeta(version, {
            ...storedMeta,
            ...(typeof evolution?.lastProcessedChatId === 'string' && evolution.lastProcessedChatId
                ? { chatId: storedMeta?.chatId ?? evolution.lastProcessedChatId }
                : {}),
        }, processedRange);
    }

    function listReadableVersionMetas(evolution, diskVersions) {
        const byVersion = new Map();
        for (const diskEntry of Array.isArray(diskVersions) ? diskVersions : []) {
            const version = normalizeVersion(diskEntry?.version);
            if (version <= 0) {
                continue;
            }
            byVersion.set(version, buildVersionMeta(
                version,
                findStoredVersionMeta(evolution, version),
                diskEntry,
            ));
        }

        const syntheticCurrent = buildSyntheticCurrentVersionMeta(evolution);
        if (syntheticCurrent && !byVersion.has(syntheticCurrent.version)) {
            byVersion.set(syntheticCurrent.version, syntheticCurrent);
        }

        return [...byVersion.values()].sort((left, right) => left.version - right.version);
    }

    function buildSyntheticCurrentVersionPayload(evolution, version) {
        const normalizedVersion = normalizeVersion(version);
        const currentVersion = normalizeVersion(evolution?.currentStateVersion);
        if (normalizedVersion <= 0 || normalizedVersion !== currentVersion) {
            return null;
        }

        const meta = buildSyntheticCurrentVersionMeta(evolution);
        if (!meta) {
            return null;
        }

        return {
            ...meta,
            state: evolution?.currentState ?? {},
            ...(Array.isArray(evolution?.sectionConfigs) ? { sectionConfigs: evolution.sectionConfigs } : {}),
            ...(evolution?.privacy && typeof evolution.privacy === 'object' ? { privacy: evolution.privacy } : {}),
        };
    }

    return {
        buildSyntheticCurrentVersionPayload,
        listReadableVersionMetas,
    };
}

module.exports = {
    createCharacterEvolutionHistoryResolver,
};
