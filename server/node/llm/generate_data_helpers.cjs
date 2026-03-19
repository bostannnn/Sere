function createGenerateDataHelpers(arg = {}) {
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const path = arg.path;
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const dataDirs = arg.dataDirs || {};
    const LLMHttpError = arg.LLMHttpError;
    const applyStateCommands = typeof arg.applyStateCommands === 'function'
        ? arg.applyStateCommands
        : null;
    const readStateLastEventId = typeof arg.readStateLastEventId === 'function'
        ? arg.readStateLastEventId
        : (async () => 0);
    const setMemoryData = typeof arg.setMemoryData === 'function'
        ? arg.setMemoryData
        : (() => {});
    const safeJsonClone = typeof arg.safeJsonClone === 'function'
        ? arg.safeJsonClone
        : ((value, fallback) => value === undefined ? fallback : value);

    async function readJsonFileWithRetry(filePath, retries = 3) {
        let lastError = null;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            try {
                const raw = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(raw);
            } catch (error) {
                lastError = error;
                const message = String(error?.message || '');
                const likelyTransientParseError =
                    error instanceof SyntaxError
                    && (
                        message.includes('Unexpected end of JSON input')
                        || message.includes('Unexpected token')
                    );
                if (!likelyTransientParseError || attempt >= retries) {
                    throw error;
                }
                await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
            }
        }
        throw lastError;
    }

    function isStaleBaseConflict(error) {
        const conflicts = Array.isArray(error?.result?.conflicts) ? error.result.conflicts : [];
        return conflicts.some((entry) => entry && typeof entry === 'object' && entry.code === 'STALE_BASE_EVENT');
    }

    function toStoredChatObject(chatRaw) {
        return chatRaw?.chat || chatRaw?.data || chatRaw || {};
    }

    function getMessageText(message) {
        if (!message || typeof message !== 'object') return '';
        return toStringOrEmpty(message.data) || toStringOrEmpty(message.content);
    }

    function isEquivalentTailUserMessage(chat, userMessage) {
        const normalizedUserMessage = toStringOrEmpty(userMessage);
        if (!normalizedUserMessage) return false;
        const messages = Array.isArray(chat?.message) ? chat.message : [];
        if (messages.length === 0) return false;
        const tail = messages[messages.length - 1];
        const role = toStringOrEmpty(tail?.role).toLowerCase();
        if (role !== 'user' && role !== 'human') return false;
        return getMessageText(tail) === normalizedUserMessage;
    }

    function buildStoredUserMessage(userMessage) {
        return {
            role: 'user',
            data: toStringOrEmpty(userMessage),
            time: Date.now(),
        };
    }

    function isJsonEquivalent(left, right) {
        try {
            return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
        } catch {
            return false;
        }
    }

    async function appendUserMessageWithRetry({
        characterId,
        chatId,
        chatPath,
        userMessage,
        source,
    }) {
        const resolvedChatPath = toStringOrEmpty(chatPath) || path.join(dataDirs.characters, characterId, 'chats', `${chatId}.json`);
        if (!existsSync(resolvedChatPath)) {
            throw new LLMHttpError(
                404,
                'CHAT_NOT_FOUND',
                `Chat not found: ${chatId}`
            );
        }
        const normalizedUserMessage = toStringOrEmpty(userMessage);
        if (!normalizedUserMessage) {
            return {
                appended: false,
                chat: null,
            };
        }
        if (typeof applyStateCommands !== 'function') {
            throw new LLMHttpError(
                500,
                'STATE_COMMANDS_UNAVAILABLE',
                'Internal state command service is unavailable for server-side user message persistence.'
            );
        }
        const messagePayload = buildStoredUserMessage(normalizedUserMessage);
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            try {
                await applyStateCommands([
                    {
                        type: 'chat.message.append',
                        charId: characterId,
                        chatId,
                        message: messagePayload,
                    },
                ], source, { baseEventId });
                const latestRaw = await readJsonFileWithRetry(resolvedChatPath);
                return {
                    appended: true,
                    chat: toStoredChatObject(latestRaw),
                };
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
                const latestRaw = await readJsonFileWithRetry(resolvedChatPath);
                const latestChat = toStoredChatObject(latestRaw);
                if (isEquivalentTailUserMessage(latestChat, normalizedUserMessage)) {
                    return {
                        appended: false,
                        chat: latestChat,
                    };
                }
            }
        }
        return {
            appended: false,
            chat: null,
        };
    }

    async function persistMemoryDataWithRetry({
        characterId,
        chatId,
        chatPath,
        memoryData,
        source,
    }) {
        if (!existsSync(chatPath) || typeof applyStateCommands !== 'function') {
            return;
        }
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const baseEventId = await readStateLastEventId();
            const latestRaw = await readJsonFileWithRetry(chatPath);
            const latestChat = toStoredChatObject(latestRaw);
            const nextChat = (latestChat && typeof latestChat === 'object') ? { ...latestChat } : {};
            nextChat.id = toStringOrEmpty(nextChat.id) || chatId;
            setMemoryData(nextChat, safeJsonClone(memoryData, memoryData));
            try {
                await applyStateCommands([
                    {
                        type: 'chat.replace',
                        charId: characterId,
                        chatId,
                        chat: nextChat,
                    },
                ], source, { baseEventId });
                return;
            } catch (error) {
                if (!isStaleBaseConflict(error) || attempt >= 1) {
                    throw error;
                }
            }
        }
    }

    return {
        readJsonFileWithRetry,
        isEquivalentTailUserMessage,
        buildStoredUserMessage,
        isJsonEquivalent,
        appendUserMessageWithRetry,
        persistMemoryDataWithRetry,
    };
}

module.exports = {
    createGenerateDataHelpers,
};
