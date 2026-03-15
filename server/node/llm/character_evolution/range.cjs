const { toTrimmedString } = require('./utils.cjs');

function toInteger(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return null;
    }
    return Math.floor(parsed);
}

function normalizeCharacterEvolutionRangeRef(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const chatId = toTrimmedString(raw.chatId);
    const startMessageIndex = toInteger(raw.startMessageIndex);
    const endMessageIndex = toInteger(raw.endMessageIndex);
    if (!chatId || startMessageIndex === null || endMessageIndex === null) {
        return null;
    }
    if (startMessageIndex < 0 || endMessageIndex < startMessageIndex) {
        return null;
    }

    return {
        chatId,
        startMessageIndex,
        endMessageIndex,
    };
}

function getCharacterEvolutionProcessedRanges(evolution) {
    const explicitRanges = Array.isArray(evolution?.processedRanges)
        ? evolution.processedRanges
        : [];
    if (explicitRanges.length > 0) {
        return explicitRanges
            .map((entry) => {
                if (!entry || typeof entry !== 'object') return null;
                const range = normalizeCharacterEvolutionRangeRef(entry.range);
                const version = toInteger(entry.version);
                if (!range || version === null || version < 0) return null;
                return {
                    version,
                    acceptedAt: Number.isFinite(Number(entry.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    range,
                };
            })
            .filter(Boolean);
    }

    return Array.isArray(evolution?.stateVersions)
        ? evolution.stateVersions
            .map((entry) => {
                const range = normalizeCharacterEvolutionRangeRef(entry?.range);
                const version = toInteger(entry?.version);
                if (!range || version === null || version < 0) return null;
                return {
                    version,
                    acceptedAt: Number.isFinite(Number(entry?.acceptedAt)) ? Number(entry.acceptedAt) : 0,
                    range,
                };
            })
            .filter(Boolean)
        : [];
}

function getLastProcessedMessageIndexForChat(evolution, chatId) {
    const normalizedChatId = toTrimmedString(chatId);
    if (!normalizedChatId) {
        return -1;
    }

    let derivedCursor = -1;
    for (const entry of getCharacterEvolutionProcessedRanges(evolution)) {
        if (entry.range.chatId !== normalizedChatId) {
            continue;
        }
        derivedCursor = Math.max(derivedCursor, entry.range.endMessageIndex);
    }
    if (derivedCursor >= 0) {
        return derivedCursor;
    }

    const explicitCursor = evolution?.lastProcessedMessageIndexByChat?.[normalizedChatId];
    if (Number.isFinite(Number(explicitCursor))) {
        return Math.max(-1, Math.floor(Number(explicitCursor)));
    }

    return -1;
}

function rangesOverlap(left, right) {
    if (!left || !right) {
        return false;
    }
    if (left.chatId !== right.chatId) {
        return false;
    }
    return left.startMessageIndex <= right.endMessageIndex
        && right.startMessageIndex <= left.endMessageIndex;
}

function isRangeFullyCoveredByProcessedRanges(processedRanges, targetRange) {
    const range = normalizeCharacterEvolutionRangeRef(targetRange);
    if (!range) {
        return false;
    }

    const normalizedRanges = Array.isArray(processedRanges)
        ? processedRanges
            .map((entry) => normalizeCharacterEvolutionRangeRef(entry?.range))
            .filter(Boolean)
            .filter((entry) => entry.chatId === range.chatId)
            .sort((left, right) => {
                if (left.startMessageIndex !== right.startMessageIndex) {
                    return left.startMessageIndex - right.startMessageIndex;
                }
                return left.endMessageIndex - right.endMessageIndex;
            })
        : [];

    let coveredUntil = range.startMessageIndex - 1;
    for (const entry of normalizedRanges) {
        if (entry.endMessageIndex < range.startMessageIndex) {
            continue;
        }
        if (entry.startMessageIndex > range.endMessageIndex) {
            break;
        }

        const effectiveStart = Math.max(entry.startMessageIndex, range.startMessageIndex);
        const effectiveEnd = Math.min(entry.endMessageIndex, range.endMessageIndex);
        if (effectiveStart > coveredUntil + 1) {
            return false;
        }
        coveredUntil = Math.max(coveredUntil, effectiveEnd);
        if (coveredUntil >= range.endMessageIndex) {
            return true;
        }
    }

    return coveredUntil >= range.endMessageIndex;
}

function getChatLastMessageIndex(chat) {
    return Array.isArray(chat?.message) ? chat.message.length - 1 : -1;
}

module.exports = {
    getCharacterEvolutionProcessedRanges,
    getChatLastMessageIndex,
    getLastProcessedMessageIndexForChat,
    isRangeFullyCoveredByProcessedRanges,
    normalizeCharacterEvolutionRangeRef,
    rangesOverlap,
};
