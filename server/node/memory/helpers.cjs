function createMemoryHelpers(arg = {}) {
    const toStringOrEmpty = typeof arg.toStringOrEmpty === 'function'
        ? arg.toStringOrEmpty
        : ((value) => (typeof value === 'string' ? value.trim() : ''));
    const stripThoughtBlocks = typeof arg.stripThoughtBlocks === 'function'
        ? arg.stripThoughtBlocks
        : ((value) => toStringOrEmpty(value));
    const resolveMemorySettings = typeof arg.resolveMemorySettings === 'function'
        ? arg.resolveMemorySettings
        : (() => ({}));
    const resolveGenerateModelSelection = typeof arg.resolveGenerateModelSelection === 'function'
        ? arg.resolveGenerateModelSelection
        : (() => ({ provider: '', model: '' }));
    const normalizeProvider = typeof arg.normalizeProvider === 'function'
        ? arg.normalizeProvider
        : (() => 'unknown');
    const executeInternalLLMTextCompletion = typeof arg.executeInternalLLMTextCompletion === 'function'
        ? arg.executeInternalLLMTextCompletion
        : (async () => '');
    const cleanSummaryOutput = typeof arg.cleanSummaryOutput === 'function'
        ? arg.cleanSummaryOutput
        : ((value) => toStringOrEmpty(value));
    const LLMHttpError = arg.LLMHttpError;

    const DEFAULT_SUMMARIZATION_PROMPT = "[Summarize the ongoing role story, It must also remove redundancy and unnecessary text and content from the output.]";

    function resolveSummaryOutputUserName(settings, chat) {
        const personas = Array.isArray(settings?.personas) ? settings.personas : [];
        const boundPersonaId = toStringOrEmpty(chat?.bindedPersona);
        if (boundPersonaId) {
            const persona = personas.find((item) => item && typeof item === 'object' && toStringOrEmpty(item.id) === boundPersonaId);
            const personaName = toStringOrEmpty(persona?.name);
            if (personaName) return personaName;
        }
        return toStringOrEmpty(settings?.username) || 'User';
    }

    function replaceSummaryOutputVars(text, settings, character, chat) {
        const source = toStringOrEmpty(text);
        if (!source) return '';
        const charName = toStringOrEmpty(character?.nickname) || toStringOrEmpty(character?.name) || 'Character';
        const userName = resolveSummaryOutputUserName(settings, chat);
        return source
            .replace(/<(?:char|bot)>/gi, charName)
            .replace(/<user>/gi, userName)
            .replace(/\{\{\s*char\s*\}\}/gi, charName)
            .replace(/\{\{\s*user\s*\}\}/gi, userName);
    }

    function resolveMemorySummaryProviderModel(settings, character = null) {
        const memorySettings = resolveMemorySettings(settings, character);
        const selectedModel = toStringOrEmpty(memorySettings.summarizationModel) || 'subModel';
        if (selectedModel === 'subModel') {
            const selected = resolveGenerateModelSelection({ mode: 'memory' }, settings);
            return {
                selectedModel,
                provider: toStringOrEmpty(selected.provider),
                model: toStringOrEmpty(selected.model),
            };
        }
        return {
            selectedModel,
            provider: normalizeProvider('', selectedModel),
            model: selectedModel,
        };
    }

    function sanitizeMemorySummarizationContent(content) {
        const raw = toStringOrEmpty(content);
        if (!raw) return '';
        const dataUrlRegex = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
        const inlayRegex = /\{\{inlay::[^}]+\}\}/g;
        return raw
            .replace(inlayRegex, '[Image]')
            .replace(dataUrlRegex, '[Image]')
            .trim();
    }

    function convertStoredMessageForMemorySummary(message) {
        if (!message || typeof message !== 'object') return null;
        if (message.disabled === true) return null;
        const roleRaw = toStringOrEmpty(message.role).toLowerCase();
        const role = roleRaw === 'user'
            ? 'user'
            : ((roleRaw === 'assistant' || roleRaw === 'char') ? 'assistant' : null);
        if (!role) return null;
        const rawContent = toStringOrEmpty(message.data);
        const sanitizedSource = role === 'assistant'
            ? stripThoughtBlocks(rawContent)
            : rawContent;
        const content = sanitizeMemorySummarizationContent(sanitizedSource);
        if (!content) return null;
        return {
            role,
            content,
            memo: toStringOrEmpty(message.chatId),
            name: toStringOrEmpty(message.name),
        };
    }

    function buildMemorySummarizationPromptMessages(sourceMessages, promptTemplate) {
        const cleaned = (Array.isArray(sourceMessages) ? sourceMessages : [])
            .filter((msg) => msg && typeof msg === 'object')
            .map((msg) => `${msg.role}: ${toStringOrEmpty(msg.content)}`.trim())
            .filter(Boolean);
        const strMessages = cleaned.join('\n');
        if (!strMessages) return null;

        const template = toStringOrEmpty(promptTemplate).trim() || DEFAULT_SUMMARIZATION_PROMPT;
        if (template.includes('{{slot}}')) {
            // Template embeds the chat content via {{slot}} — use the combined result
            // as a single user message to avoid duplicating strMessages in both messages.
            const prompt = template.replaceAll('{{slot}}', strMessages);
            return [{ role: 'user', content: prompt }];
        }

        return [
            { role: 'user', content: strMessages },
            { role: 'system', content: template },
        ];
    }

    function normalizeMemoryDataForEdit(rawData) {
        const raw = (rawData && typeof rawData === 'object' && !Array.isArray(rawData)) ? rawData : {};
        const summaries = Array.isArray(raw.summaries) ? raw.summaries : [];
        const categories = Array.isArray(raw.categories)
            ? raw.categories.filter((c) => c && typeof c === 'object' && typeof c.id === 'string' && typeof c.name === 'string')
            : [];
        const normalizedCategories = categories.some((c) => c.id === '')
            ? categories
            : [{ id: '', name: 'Unclassified' }, ...categories];
        return {
            ...raw,
            summaries: summaries
                .filter((s) => s && typeof s === 'object')
                .map((s) => ({
                    text: toStringOrEmpty(s.text),
                    chatMemos: Array.isArray(s.chatMemos)
                        ? s.chatMemos.map((v) => toStringOrEmpty(v)).filter(Boolean)
                        : [],
                    isImportant: s.isImportant === true,
                    categoryId: toStringOrEmpty(s.categoryId) || undefined,
                    tags: Array.isArray(s.tags) ? s.tags.map((v) => toStringOrEmpty(v)).filter(Boolean) : [],
                    ...(Array.isArray(s.embedding) ? { embedding: s.embedding } : {}),
                })),
            categories: normalizedCategories,
            lastSelectedSummaries: Array.isArray(raw.lastSelectedSummaries) ? raw.lastSelectedSummaries : [],
        };
    }

    function persistChatDataToRaw(chatRaw, chatData) {
        if (chatRaw.chat && typeof chatRaw.chat === 'object') {
            chatRaw.chat = chatData;
            return chatRaw;
        }
        if (chatRaw.data && typeof chatRaw.data === 'object') {
            chatRaw.data = chatData;
            return chatRaw;
        }
        return {
            ...chatRaw,
            chat: chatData,
        };
    }

    async function executeMemorySummaryFromMessages(payload = {}) {
        const settings = payload.settings || {};
        const characterId = toStringOrEmpty(payload.characterId);
        const chatId = toStringOrEmpty(payload.chatId);
        const promptMessages = Array.isArray(payload.promptMessages) ? payload.promptMessages : [];

        if (promptMessages.length === 0) return '';
        const memorySettings = resolveMemorySettings(settings, payload.character || null);
        const selectedModel = toStringOrEmpty(memorySettings.summarizationModel) || 'subModel';

        let provider = '';
        let model = '';
        if (selectedModel === 'subModel') {
            const selected = resolveGenerateModelSelection({ mode: 'memory' }, settings);
            provider = toStringOrEmpty(selected.provider);
            model = toStringOrEmpty(selected.model);
        } else {
            provider = normalizeProvider('', selectedModel);
            model = selectedModel;
        }

        if (!provider || provider === 'unknown' || !model) {
            throw new LLMHttpError(400, 'MEMORY_MODEL_UNAVAILABLE', 'Unable to resolve summarization model/provider.');
        }
        if (payload.meta && typeof payload.meta === 'object') {
            payload.meta.provider = provider;
            payload.meta.model = model;
        }

        const result = await executeInternalLLMTextCompletion({
            provider,
            model,
            mode: 'memory',
            characterId,
            chatId,
            maxTokens: 2000,
            messages: promptMessages,
        });

        return replaceSummaryOutputVars(
            cleanSummaryOutput(result),
            settings,
            payload.character,
            payload.chat
        );
    }

    return {
        resolveMemorySummaryProviderModel,
        sanitizeMemorySummarizationContent,
        convertStoredMessageForMemorySummary,
        buildMemorySummarizationPromptMessages,
        normalizeMemoryDataForEdit,
        persistChatDataToRaw,
        executeMemorySummaryFromMessages,
    };
}

module.exports = {
    createMemoryHelpers,
};
