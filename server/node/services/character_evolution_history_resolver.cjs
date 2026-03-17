function createCharacterEvolutionHistoryResolver(arg = {}) {
    const {
        normalizeCharacterEvolutionRangeRef,
        normalizeCharacterEvolutionState,
    } = arg;

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

    function deriveLastProcessedMessageIndexByChat(processedRanges) {
        const cursors = {};
        for (const entry of Array.isArray(processedRanges) ? processedRanges : []) {
            const range = normalizeRange(entry?.range);
            if (!range) {
                continue;
            }
            cursors[range.chatId] = Math.max(
                Number.isFinite(Number(cursors[range.chatId])) ? Number(cursors[range.chatId]) : -1,
                range.endMessageIndex
            );
        }
        return cursors;
    }

    function rebaseCurrentStateRetentionMetadata(state, currentVersion) {
        const normalizedState = typeof normalizeCharacterEvolutionState === 'function'
            ? normalizeCharacterEvolutionState(state)
            : (state && typeof state === 'object' ? state : {});
        const nextState = { ...normalizedState };
        for (const [key, value] of Object.entries(normalizedState)) {
            if (!Array.isArray(value)) {
                continue;
            }
            nextState[key] = value.map((item) => {
                if (!item || typeof item !== 'object') {
                    return item;
                }
                const nextItem = {
                    ...item,
                    unseenAcceptedHandoffs: 0,
                };
                if (currentVersion > 0) {
                    nextItem.lastSeenVersion = currentVersion;
                } else {
                    delete nextItem.lastSeenVersion;
                }
                return nextItem;
            });
        }
        return nextState;
    }

    function normalizeStoredCursorMap(cursorMap) {
        const normalized = {};
        if (!cursorMap || typeof cursorMap !== 'object') {
            return normalized;
        }
        for (const [chatId, endIndex] of Object.entries(cursorMap)) {
            if (!chatId || !Number.isFinite(Number(endIndex))) {
                continue;
            }
            normalized[chatId] = Math.max(-1, Math.floor(Number(endIndex)));
        }
        return normalized;
    }

    function reconcileEvolution(evolution, diskVersions) {
        const currentVersion = normalizeVersion(evolution?.currentStateVersion);
        const readableVersions = listReadableVersionMetas(evolution, diskVersions);
        const storedStateVersions = Array.isArray(evolution?.stateVersions) ? evolution.stateVersions : [];
        const storedProcessedRanges = Array.isArray(evolution?.processedRanges) ? evolution.processedRanges : [];
        const nextProcessedRanges = readableVersions
            .filter((entry) => normalizeRange(entry?.range))
            .map((entry) => ({
                version: entry.version,
                acceptedAt: normalizeAcceptedAt(entry.acceptedAt),
                range: normalizeRange(entry.range),
            }));
        const hasDiskBackedHistory = Array.isArray(diskVersions) && diskVersions.length > 0;
        const hasRemovedSnapshotMarkers = !hasDiskBackedHistory
            && (
                storedStateVersions.length > readableVersions.length
                || storedProcessedRanges.length > nextProcessedRanges.length
            );
        const preservedCursorMap = !hasRemovedSnapshotMarkers && nextProcessedRanges.length === 0
            ? normalizeStoredCursorMap(evolution?.lastProcessedMessageIndexByChat)
            : {};
        const preservedLastProcessedChatId = !hasRemovedSnapshotMarkers
            && nextProcessedRanges.length === 0
            && typeof evolution?.lastProcessedChatId === 'string'
            && evolution.lastProcessedChatId
            ? evolution.lastProcessedChatId
            : null;

        return {
            ...evolution,
            currentState: !hasDiskBackedHistory && currentVersion > 0
                ? rebaseCurrentStateRetentionMetadata(evolution?.currentState, currentVersion)
                : (typeof normalizeCharacterEvolutionState === 'function'
                    ? normalizeCharacterEvolutionState(evolution?.currentState)
                    : (evolution?.currentState ?? {})),
            stateVersions: readableVersions,
            processedRanges: nextProcessedRanges,
            lastProcessedChatId: nextProcessedRanges[nextProcessedRanges.length - 1]?.range?.chatId
                ?? preservedLastProcessedChatId,
            lastProcessedMessageIndexByChat: nextProcessedRanges.length > 0
                ? deriveLastProcessedMessageIndexByChat(nextProcessedRanges)
                : preservedCursorMap,
        };
    }

    return {
        buildSyntheticCurrentVersionPayload,
        listReadableVersionMetas,
        reconcileEvolution,
    };
}

module.exports = {
    createCharacterEvolutionHistoryResolver,
};
