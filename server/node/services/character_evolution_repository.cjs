const {
    normalizeCharacterEvolutionDefaults,
    normalizeCharacterEvolutionSettings,
} = require('../llm/character_evolution.cjs');

function createCharacterEvolutionRepository(arg = {}) {
    const {
        fs,
        dataDirs,
        existsSync,
        LLMHttpError,
        safeResolve,
        applyStateCommands,
        readStateLastEventId,
    } = arg;

    async function readJsonFile(filePath) {
        const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'));
        return raw?.character || raw?.chat || raw?.data || raw || {};
    }

    async function loadCharacterAndSettings(characterId) {
        const settingsPath = safeResolve(dataDirs.root, 'settings.json');
        const charDir = safeResolve(dataDirs.characters, characterId);
        const charPath = safeResolve(charDir, 'character.json');
        if (!existsSync(settingsPath)) {
            throw new LLMHttpError(404, 'SETTINGS_NOT_FOUND', 'Server settings are not initialized.');
        }
        if (!existsSync(charPath)) {
            throw new LLMHttpError(404, 'CHARACTER_NOT_FOUND', `Character not found: ${characterId}`);
        }
        const settingsRaw = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
        const settings = settingsRaw?.data || settingsRaw || {};
        const character = await readJsonFile(charPath);
        return {
            settings: {
                ...settings,
                characterEvolutionDefaults: normalizeCharacterEvolutionDefaults(settings.characterEvolutionDefaults),
            },
            character: {
                ...character,
                characterEvolution: normalizeCharacterEvolutionSettings(character.characterEvolution),
            },
            charDir,
            charPath,
        };
    }

    async function loadChat(characterId, chatId) {
        const chatPath = safeResolve(dataDirs.characters, `${characterId}/chats/${chatId}.json`);
        if (!existsSync(chatPath)) {
            throw new LLMHttpError(404, 'CHAT_NOT_FOUND', `Chat not found: ${chatId}`);
        }
        return {
            chat: await readJsonFile(chatPath),
            chatPath,
        };
    }

    async function replaceCharacterWithRetry(characterId, nextCharacter, source) {
        if (typeof applyStateCommands !== 'function') {
            throw new LLMHttpError(500, 'STATE_COMMANDS_UNAVAILABLE', 'Internal state command service is unavailable.');
        }
        const baseEventId = await readStateLastEventId();
        try {
            await applyStateCommands([
                {
                    type: 'character.replace',
                    charId: characterId,
                    character: nextCharacter,
                },
            ], source, { baseEventId });
            return;
        } catch (error) {
            const conflicts = Array.isArray(error?.result?.conflicts) ? error.result.conflicts : [];
            const isStale = conflicts.some((entry) => entry?.code === 'STALE_BASE_EVENT');
            if (isStale) {
                throw new LLMHttpError(409, 'EVOLUTION_STATE_CONFLICT', 'Character evolution changed while processing. Refresh and retry.');
            }
            throw error;
        }
    }

    return {
        loadCharacterAndSettings,
        loadChat,
        replaceCharacterWithRetry,
    };
}

module.exports = {
    createCharacterEvolutionRepository,
};
