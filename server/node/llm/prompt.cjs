const {
    toStringOrEmpty,
    stripThoughtBlocks,
    parsePromptAsMessages,
    parseChatMLMessages,
    normalizeTemplateRole,
    resolveTemplateConditionals,
    renderTemplateSlot,
    systemizeChatMessages,
} = require('./scripts.cjs');
const { buildServerLorebookMessages } = require('./lorebook.cjs');
const { extractTextFromMessageContent, estimateMessagesTokens } = require('./tokenizer.cjs');
const {
    getEffectiveCharacterEvolutionSettings,
    renderCharacterEvolutionStateForPrompt,
} = require('./character_evolution.cjs');

const TRACE_AUDIT_MAX_MESSAGE_COUNT = 64;
const TRACE_AUDIT_MAX_CONTENT_CHARS = 1200;

function safeJsonClone(value, fallback = null) {
    try {
        return value == null ? fallback : JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function extractLatestUserMessage(rawBody) {
    const explicitUserMessage = toStringOrEmpty(rawBody?.userMessage);
    if (explicitUserMessage) return explicitUserMessage;

    const candidates = [];
    if (Array.isArray(rawBody?.request?.requestBody?.messages)) {
        candidates.push(rawBody.request.requestBody.messages);
    }
    if (Array.isArray(rawBody?.request?.messages)) {
        candidates.push(rawBody.request.messages);
    }
    if (Array.isArray(rawBody?.request?.requestBody?.contents)) {
        candidates.push(rawBody.request.requestBody.contents);
    }

    for (const list of candidates) {
        for (let i = list.length - 1; i >= 0; i--) {
            const item = list[i];
            if (!item || typeof item !== 'object') continue;

            const role = String(item.role || '').toLowerCase();
            if (role === 'user' || role === 'human') {
                const openAIText = extractTextFromMessageContent(item.content);
                if (openAIText) return openAIText;
                if (Array.isArray(item.parts)) {
                    const partsText = item.parts
                        .map((part) => (part && typeof part === 'object' && typeof part.text === 'string') ? part.text.trim() : '')
                        .filter(Boolean)
                        .join('\n')
                        .trim();
                    if (partsText) return partsText;
                }
            }
        }
    }
    return '';
}

function resolveServerMainPrompt(character, settings) {
    const baseMainPrompt = toStringOrEmpty(settings?.mainPrompt);
    const override = toStringOrEmpty(character?.systemPrompt);
    let mainPrompt = override ? override.replaceAll('{{original}}', baseMainPrompt) : baseMainPrompt;

    const additionalPrompt = toStringOrEmpty(settings?.additionalPrompt);
    if (additionalPrompt && settings?.promptPreprocess === true) {
        mainPrompt = mainPrompt ? `${mainPrompt}\n${additionalPrompt}` : additionalPrompt;
    }
    return mainPrompt;
}

function resolveServerGlobalNote(character, settings) {
    const baseGlobalNote = toStringOrEmpty(settings?.globalNote);
    const override = toStringOrEmpty(character?.replaceGlobalNote);
    if (override) {
        return override.replaceAll('{{original}}', baseGlobalNote);
    }
    return baseGlobalNote;
}

function getDefaultAuthorNoteText(settings) {
    const template = Array.isArray(settings?.promptTemplate) ? settings.promptTemplate : [];
    for (const card of template) {
        if (!card || typeof card !== 'object') continue;
        if (card.type !== 'authornote') continue;
        const defaultText = toStringOrEmpty(card.defaultText);
        if (defaultText) return defaultText;
    }
    return '';
}

function resolveServerAuthorNote(chat, settings) {
    const chatNote = toStringOrEmpty(chat?.note);
    if (chatNote) return chatNote;
    return getDefaultAuthorNoteText(settings);
}

function applySystemPromptOverride(basePrompt, character) {
    const original = typeof basePrompt === 'string' ? basePrompt : '';
    const override = toStringOrEmpty(character?.systemPrompt);
    if (!override) return original;
    return override.replaceAll('{{original}}', original);
}

function applyGlobalNoteOverride(baseGlobalNote, character) {
    const original = typeof baseGlobalNote === 'string' ? baseGlobalNote : '';
    const override = toStringOrEmpty(character?.replaceGlobalNote);
    if (!override) return original;
    return override.replaceAll('{{original}}', original);
}

function buildServerDescriptionPrompt(character, settings) {
    const chunks = [];
    const desc = toStringOrEmpty(character?.desc);
    if (desc) {
        if (settings?.promptPreprocess === true) {
            const prefix = toStringOrEmpty(settings?.descriptionPrefix);
            chunks.push(`${prefix}${desc}`);
        } else {
            chunks.push(desc);
        }
    }

    const additionalText = toStringOrEmpty(character?.additionalText);
    if (additionalText) {
        chunks.push(additionalText);
    }

    const personality = toStringOrEmpty(character?.personality);
    if (personality) {
        chunks.push(`Description of {{char}}: ${personality}`);
    }

    const scenario = toStringOrEmpty(character?.scenario);
    if (scenario) {
        chunks.push(`Circumstances and context of the dialogue: ${scenario}`);
    }

    return chunks.join('\n\n').trim();
}

function resolveTemplateBlockTitle(card, fallback = 'Prompt Block') {
    const customName = toStringOrEmpty(card?.name);
    if (customName) return customName;
    return fallback;
}

function getTemplateCardFallbackTitle(cardType, cardType2 = '') {
    if (cardType === 'plain') {
        if (cardType2 === 'main') return 'Main Prompt';
        if (cardType2 === 'globalNote') return 'Global Note';
        return 'Plain Prompt';
    }
    if (cardType === 'jailbreak') return 'Jailbreak';
    if (cardType === 'cot') return 'Chain Of Thought';
    if (cardType === 'description') return 'Description';
    if (cardType === 'persona') return 'Persona';
    if (cardType === 'authornote') return 'Author Note';
    if (cardType === 'lorebook') return 'Lorebook';
    if (cardType === 'postEverything') return 'Post Everything';
    if (cardType === 'chat' || cardType === 'chatML' || cardType === 'chatml') return 'Chat History';
    if (cardType === 'memory') return 'HypaMemory';
    if (cardType === 'rulebookRag') return 'Rulebook RAG';
    if (cardType === 'gameState') return 'Game State';
    if (cardType === 'characterState') return 'Character State';
    return 'Prompt Block';
}

function pushPromptMessagesWithTitle(targetMessages, promptBlocks, newMessages, title, source = 'template') {
    if (!Array.isArray(targetMessages) || !Array.isArray(newMessages) || newMessages.length === 0) {
        return;
    }
    const start = targetMessages.length;
    for (const msg of newMessages) {
        targetMessages.push(msg);
    }
    if (!Array.isArray(promptBlocks)) return;
    for (let i = 0; i < newMessages.length; i++) {
        const msg = newMessages[i];
        promptBlocks.push({
            index: start + i,
            role: msg?.role || 'system',
            title,
            source,
        });
    }
}

function shiftPromptBlockIndices(promptBlocks, startIndex, delta) {
    if (!Array.isArray(promptBlocks)) return;
    const normalizedStart = Number.isInteger(Number(startIndex)) ? Number(startIndex) : 0;
    const normalizedDelta = Number.isInteger(Number(delta)) ? Number(delta) : 0;
    if (normalizedDelta === 0) return;
    for (const block of promptBlocks) {
        if (!block || typeof block !== 'object') continue;
        const idx = Number(block.index);
        if (!Number.isInteger(idx) || idx < normalizedStart) continue;
        block.index = idx + normalizedDelta;
    }
}

function normalizeTemplateChatRange(chats, rangeStart, rangeEnd) {
    const source = Array.isArray(chats) ? chats : [];
    let start = Number.isFinite(Number(rangeStart)) ? Number(rangeStart) : 0;
    let end = rangeEnd === 'end'
        ? source.length
        : (Number.isFinite(Number(rangeEnd)) ? Number(rangeEnd) : source.length);

    if (start === -1000) {
        start = 0;
        end = source.length;
    }
    if (start < 0) {
        start = source.length + start;
        if (start < 0) start = 0;
    }
    if (end < 0) {
        end = source.length + end;
        if (end < 0) end = 0;
    }
    if (start >= end) return [];
    return source.slice(start, end);
}

function convertStoredChatToOpenAIMessages(storedMessages, arg = {}) {
    const limit = Number.isFinite(Number(arg.limit)) ? Math.max(1, Number(arg.limit)) : 64;
    const stripThoughts = arg.stripThoughts !== false;
    const messages = [];
    const source = Array.isArray(storedMessages) ? storedMessages.slice(-limit) : [];

    const withMessageMeta = (base, item) => {
        const result = { ...base };
        const name = toStringOrEmpty(item?.name);
        if (name) result.name = name;
        if (Array.isArray(item?.attr) && item.attr.length > 0) {
            result.attr = item.attr.filter((v) => typeof v === 'string');
        }
        const memo = toStringOrEmpty(item?.memo);
        if (memo) result.memo = memo;
        return result;
    };

    for (const item of source) {
        if (!item || typeof item !== 'object') continue;
        const rawRole = String(item.role || '').toLowerCase();
        const content = typeof item.data === 'string'
            ? item.data
            : (typeof item.content === 'string' ? item.content : '');
        if (!content.trim()) continue;

        if (rawRole === 'user' || rawRole === 'human') {
            messages.push(withMessageMeta({ role: 'user', content }, item));
            continue;
        }
        if (rawRole === 'char' || rawRole === 'assistant' || rawRole === 'bot' || rawRole === 'model') {
            const assistantContent = stripThoughts ? stripThoughtBlocks(content) : content;
            if (!assistantContent.trim()) continue;
            messages.push(withMessageMeta({ role: 'assistant', content: assistantContent }, item));
            continue;
        }
        if (rawRole === 'system' || rawRole === 'developer') {
            messages.push(withMessageMeta({ role: 'system', content }, item));
        }
    }
    return messages;
}

async function buildMessagesFromPromptTemplate(character, chat, settings, arg = {}) {
    const template = Array.isArray(settings?.promptTemplate) ? settings.promptTemplate : [];
    if (template.length === 0) return null;

    const chats = convertStoredChatToOpenAIMessages(chat?.message, {
        limit: arg.historyLimit,
        stripThoughts: true,
    });
    const normalizedUserMessage = toStringOrEmpty(arg.userMessage);
    if (normalizedUserMessage) {
        const tail = chats[chats.length - 1];
        const isDuplicateTail =
            tail &&
            tail.role === 'user' &&
            typeof tail.content === 'string' &&
            tail.content.trim() === normalizedUserMessage;
        if (!isDuplicateTail) {
            chats.push({ role: 'user', content: normalizedUserMessage });
        }
    }

    const description = buildServerDescriptionPrompt(character, settings);
    const personaPrompt = toStringOrEmpty(settings?.personaPrompt);
    const authorNote = resolveServerAuthorNote(chat, settings);
    const lorebook = buildServerLorebookMessages(character, chat, chats);
    const evolutionSettings = getEffectiveCharacterEvolutionSettings(settings, character);
    const characterState = evolutionSettings.enabled
        ? renderCharacterEvolutionStateForPrompt(
            evolutionSettings.currentState,
            evolutionSettings.sectionConfigs,
            evolutionSettings.privacy
        )
        : '';
    const memoryBuilder = typeof arg.buildServerMemoryMessages === 'function'
        ? arg.buildServerMemoryMessages
        : async () => [];
    const memory = await memoryBuilder({
        character,
        chat,
        settings,
    });

    const unformatted = {
        chats,
        description: description ? [{ role: 'system', content: description }] : [],
        personaPrompt: personaPrompt ? [{ role: 'system', content: personaPrompt }] : [],
        lorebook,
        memory,
        characterState: characterState ? [{ role: 'system', content: characterState }] : [],
        postEverything: [],
        authorNote: authorNote ? [{ role: 'system', content: authorNote }] : [],
    };

    const messages = [];
    const promptBlocks = [];
    for (const card of template) {
        if (!card || typeof card !== 'object') continue;
        const cardType = toStringOrEmpty(card.type);
        const cardType2 = toStringOrEmpty(card.type2) || 'normal';
        const blockTitle = resolveTemplateBlockTitle(card, getTemplateCardFallbackTitle(cardType, cardType2));

        switch (cardType) {
            case 'plain':
            case 'jailbreak':
            case 'cot': {
                if (cardType === 'cot' && settings?.chainOfThought !== true) {
                    continue;
                }

                let content = resolveTemplateConditionals(toStringOrEmpty(card.text), { prefillSupported: true });
                if (cardType2 === 'main') {
                    content = applySystemPromptOverride(content, character);
                } else if (cardType2 === 'globalNote') {
                    content = applyGlobalNoteOverride(content, character);
                }

                const role = normalizeTemplateRole(card.role);
                const parsed = parsePromptAsMessages(content, character, settings, role);
                pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                break;
            }
            case 'description': {
                for (const item of unformatted.description) {
                    if (!item || typeof item !== 'object') continue;
                    const rendered = renderTemplateSlot(card.innerFormat, toStringOrEmpty(item.content), character, settings);
                    const parsed = parsePromptAsMessages(rendered, character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                break;
            }
            case 'persona': {
                for (const item of unformatted.personaPrompt) {
                    if (!item || typeof item !== 'object') continue;
                    const rendered = renderTemplateSlot(card.innerFormat, toStringOrEmpty(item.content), character, settings);
                    const parsed = parsePromptAsMessages(rendered, character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                break;
            }
            case 'authornote': {
                const source = unformatted.authorNote.length > 0
                    ? unformatted.authorNote
                    : [{ role: 'system', content: toStringOrEmpty(card.defaultText) }];
                for (const item of source) {
                    if (!item || typeof item !== 'object') continue;
                    const slot = toStringOrEmpty(item.content) || toStringOrEmpty(card.defaultText);
                    const rendered = renderTemplateSlot(card.innerFormat, slot, character, settings);
                    const parsed = parsePromptAsMessages(rendered, character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                break;
            }
            case 'lorebook': {
                const source = unformatted.lorebook.length > 0
                    ? unformatted.lorebook
                    : (toStringOrEmpty(card.text)
                        ? [{ role: normalizeTemplateRole(card.role), content: toStringOrEmpty(card.text) }]
                        : []);
                for (const item of source) {
                    if (!item || typeof item !== 'object') continue;
                    const parsed = parsePromptAsMessages(toStringOrEmpty(item.content), character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                break;
            }
            case 'postEverything': {
                const source = unformatted.postEverything.length > 0
                    ? unformatted.postEverything
                    : (toStringOrEmpty(card.text)
                        ? [{ role: normalizeTemplateRole(card.role), content: toStringOrEmpty(card.text) }]
                        : []);
                for (const item of source) {
                    if (!item || typeof item !== 'object') continue;
                    const parsed = parsePromptAsMessages(toStringOrEmpty(item.content), character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                const postEndInnerFormat = toStringOrEmpty(settings?.promptSettings?.postEndInnerFormat);
                if (postEndInnerFormat) {
                    const postEndMessages = parsePromptAsMessages(postEndInnerFormat, character, settings, 'system');
                    pushPromptMessagesWithTitle(messages, promptBlocks, postEndMessages, 'Post End', 'template');
                }
                break;
            }
            case 'chat': {
                let slice = normalizeTemplateChatRange(unformatted.chats, card.rangeStart, card.rangeEnd);
                if (settings?.promptSettings?.sendChatAsSystem === true && card.chatAsOriginalOnSystem !== true) {
                    slice = systemizeChatMessages(slice);
                }
                pushPromptMessagesWithTitle(messages, promptBlocks, slice, blockTitle, 'chat');
                break;
            }
            case 'chatml':
            case 'chatML': {
                const chatMLContent = resolveTemplateConditionals(toStringOrEmpty(card.text), { prefillSupported: true });
                const parsed = parseChatMLMessages(chatMLContent, character, settings);
                pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                break;
            }
            case 'memory': {
                const source = unformatted.memory.length > 0
                    ? unformatted.memory
                    : [];
                if (source.length === 0) {
                    promptBlocks.push({
                        role: 'system',
                        title: blockTitle,
                        source: 'template',
                        skipped: true,
                        reason: 'no_memory_data',
                    });
                    break;
                }
                for (const item of source) {
                    if (!item || typeof item !== 'object') continue;
                    const rendered = renderTemplateSlot(card.innerFormat, toStringOrEmpty(item.content), character, settings);
                    const parsed = parsePromptAsMessages(rendered, character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                break;
            }
            case 'characterState': {
                const source = unformatted.characterState.length > 0
                    ? unformatted.characterState
                    : [];
                if (source.length === 0) {
                    promptBlocks.push({
                        role: 'system',
                        title: blockTitle,
                        source: 'template',
                        skipped: true,
                        reason: 'no_character_evolution_state',
                    });
                    break;
                }
                for (const item of source) {
                    if (!item || typeof item !== 'object') continue;
                    const rendered = renderTemplateSlot(card.innerFormat, toStringOrEmpty(item.content), character, settings);
                    const parsed = parsePromptAsMessages(rendered, character, settings, normalizeTemplateRole(item.role));
                    pushPromptMessagesWithTitle(messages, promptBlocks, parsed, blockTitle, 'template');
                }
                break;
            }
            case 'rulebookRag':
            case 'gameState': {
                promptBlocks.push({
                    index: messages.length,
                    role: 'system',
                    title: blockTitle,
                    source: 'template-slot',
                    slot: cardType,
                    innerFormat: toStringOrEmpty(card.innerFormat),
                });
                break;
            }
            case 'cache':
            default:
                break;
        }
    }

    return {
        messages,
        promptBlocks,
    };
}

function injectDepthPrompt(messages, promptBlocks, character, settings) {
    if (!Array.isArray(messages) || !character || typeof character !== 'object') return;
    const depthPrompt = character.depth_prompt;
    if (!depthPrompt || typeof depthPrompt !== 'object') return;

    const prompt = toStringOrEmpty(depthPrompt.prompt);
    if (!prompt) return;

    const depthValue = Number(depthPrompt.depth);
    const depth = Number.isFinite(depthValue) ? Math.max(0, Math.floor(depthValue)) : 0;
    const depthMessages = parsePromptAsMessages(prompt, character, settings, 'system');
    if (depthMessages.length === 0) return;

    const insertIndex = Math.max(0, messages.length - depth);
    shiftPromptBlockIndices(promptBlocks, insertIndex, depthMessages.length);
    messages.splice(insertIndex, 0, ...depthMessages);
    if (Array.isArray(promptBlocks)) {
        for (let i = 0; i < depthMessages.length; i++) {
            const msg = depthMessages[i];
            promptBlocks.push({
                index: insertIndex + i,
                role: msg?.role || 'system',
                title: 'Depth Prompt',
                source: 'template',
            });
        }
    }
}

async function buildGeneratePromptMessages(arg = {}) {
    const character = arg.character || {};
    const chat = arg.chat || {};
    const settings = arg.settings || {};

    const assembledFromTemplate = await buildMessagesFromPromptTemplate(character, chat, settings, {
        historyLimit: arg.historyLimit,
        userMessage: arg.userMessage,
        buildServerMemoryMessages: arg.buildServerMemoryMessages,
    });
    let messages = Array.isArray(assembledFromTemplate?.messages) ? assembledFromTemplate.messages : null;
    const promptBlocks = Array.isArray(assembledFromTemplate?.promptBlocks) ? assembledFromTemplate.promptBlocks : [];

    if (!Array.isArray(messages) || messages.length === 0) {
        messages = [];
        const mainPrompt = resolveServerMainPrompt(character, settings);
        pushPromptMessagesWithTitle(
            messages,
            promptBlocks,
            parsePromptAsMessages(mainPrompt, character, settings, 'system'),
            'Main Prompt',
            'legacy'
        );

        pushPromptMessagesWithTitle(
            messages,
            promptBlocks,
            convertStoredChatToOpenAIMessages(chat.message, {
                limit: arg.historyLimit,
                stripThoughts: true,
            }),
            'Chat History',
            'legacy'
        );

        const globalNote = resolveServerGlobalNote(character, settings);
        pushPromptMessagesWithTitle(
            messages,
            promptBlocks,
            parsePromptAsMessages(globalNote, character, settings, 'system'),
            'Global Note',
            'legacy'
        );

        const authorNote = resolveServerAuthorNote(chat, settings);
        pushPromptMessagesWithTitle(
            messages,
            promptBlocks,
            parsePromptAsMessages(authorNote, character, settings, 'system'),
            'Author Note',
            'legacy'
        );

        const userMessage = toStringOrEmpty(arg.userMessage);
        if (userMessage) {
            const normalizedUserMessage = userMessage.trim();
            const tail = messages[messages.length - 1];
            const isDuplicateTail =
                tail &&
                tail.role === 'user' &&
                typeof tail.content === 'string' &&
                tail.content.trim() === normalizedUserMessage;
            if (!isDuplicateTail) {
                pushPromptMessagesWithTitle(
                    messages,
                    promptBlocks,
                    [{ role: 'user', content: normalizedUserMessage }],
                    'User Message',
                    'legacy'
                );
            }
        }
    }

    injectDepthPrompt(messages, promptBlocks, character, settings);

    return {
        messages,
        promptBlocks,
    };
}

function convertOpenAIMessagesToGoogleContents(messages) {
    const systemParts = [];
    const contents = [];

    for (const msg of messages) {
        if (!msg || typeof msg !== 'object') continue;
        if (typeof msg.content !== 'string' || !msg.content.trim()) continue;
        if (msg.role === 'system') {
            systemParts.push(msg.content);
            continue;
        }
        contents.push({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        });
    }

    const body = { contents };
    if (systemParts.length > 0) {
        body.systemInstruction = {
            parts: [{ text: systemParts.join('\n\n') }],
        };
    }
    return body;
}

function buildPlainTextPromptFromMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return '';
    }
    return messages
        .map((message) => {
            if (!message || typeof message !== 'object') return '';
            const role = toStringOrEmpty(message.role) || 'user';
            const content = extractTextFromMessageContent(message.content);
            if (!content) return '';
            return `${role}: ${content}`;
        })
        .filter(Boolean)
        .join('\n\n')
        .trim();
}

function normalizeNovelAIModelName(model) {
    const raw = toStringOrEmpty(model);
    if (!raw) return 'clio-v1';
    const normalized = raw.toLowerCase();
    if (normalized === 'novelai_kayra' || normalized === 'kayra' || normalized === 'kayra-v1') {
        return 'kayra-v1';
    }
    if (normalized === 'novelai' || normalized === 'novelai_clio' || normalized === 'clio' || normalized === 'clio-v1') {
        return 'clio-v1';
    }
    return raw;
}

function buildGenerateProviderRequest(provider, model, messages, maxTokens, streaming, baseRequestBody = {}) {
    const templateBody = safeJsonClone(
        (baseRequestBody && typeof baseRequestBody === 'object') ? baseRequestBody : {},
        {}
    );

    if (provider === 'google') {
        const googleBody = convertOpenAIMessagesToGoogleContents(messages);
        const requestBody = (templateBody && typeof templateBody === 'object') ? templateBody : {};
        requestBody.contents = googleBody.contents;
        if (googleBody.systemInstruction) {
            requestBody.systemInstruction = googleBody.systemInstruction;
        } else {
            delete requestBody.systemInstruction;
        }
        if (!requestBody.generation_config || typeof requestBody.generation_config !== 'object') {
            requestBody.generation_config = {};
        }
        if (Number.isFinite(Number(maxTokens))) {
            requestBody.generation_config.maxOutputTokens = Number(maxTokens);
        }
        return {
            model,
            messages,
            maxTokens,
            requestBody,
        };
    }

    if (provider === 'novelai') {
        const requestBody = (templateBody && typeof templateBody === 'object') ? templateBody : {};
        requestBody.model = normalizeNovelAIModelName(model || requestBody.model);
        requestBody.input = buildPlainTextPromptFromMessages(messages);
        requestBody.stream = false;
        return {
            model,
            messages,
            maxTokens,
            requestBody,
        };
    }

    if (provider === 'kobold') {
        const requestBody = (templateBody && typeof templateBody === 'object') ? templateBody : {};
        requestBody.prompt = buildPlainTextPromptFromMessages(messages);
        if (Number.isFinite(Number(maxTokens)) && !Number.isFinite(Number(requestBody.max_length))) {
            requestBody.max_length = Number(maxTokens);
        }
        requestBody.stream = false;
        return {
            model,
            messages,
            maxTokens,
            requestBody,
        };
    }

    const requestBody = (templateBody && typeof templateBody === 'object') ? templateBody : {};
    requestBody.model = model;
    requestBody.messages = messages;
    if (Number.isFinite(Number(maxTokens))) {
        const normalizedMaxTokens = Number(maxTokens);
        if (!Number.isFinite(Number(requestBody.max_tokens)) && !Number.isFinite(Number(requestBody.max_completion_tokens))) {
            requestBody.max_tokens = normalizedMaxTokens;
        }
    }
    requestBody.stream = !!streaming;

    if (provider === 'anthropic' && !requestBody.max_tokens) {
        requestBody.max_tokens = maxTokens || 1024;
    }

    return {
        model,
        messages,
        maxTokens,
        requestBody,
    };
}

function getNestedRequestCandidates(source) {
    const candidates = [];
    let current = source;
    let depth = 0;
    while (current && typeof current === 'object' && !Array.isArray(current) && depth < 4) {
        candidates.push(current);
        if (!current.request || typeof current.request !== 'object' || Array.isArray(current.request)) {
            break;
        }
        current = current.request;
        depth += 1;
    }
    return candidates;
}

function getPayloadMessagesForTrace(payload) {
    const requestCandidates = getNestedRequestCandidates(payload?.request);
    for (const request of requestCandidates) {
        if (Array.isArray(request?.requestBody?.messages)) {
            return request.requestBody.messages;
        }
        if (Array.isArray(request?.messages)) {
            return request.messages;
        }
    }
    return [];
}

function getPayloadPromptBlocksForTrace(payload) {
    if (Array.isArray(payload?.promptBlocks)) {
        return payload.promptBlocks;
    }
    const requestCandidates = getNestedRequestCandidates(payload?.request);
    for (const request of requestCandidates) {
        if (Array.isArray(request?.promptBlocks)) {
            return request.promptBlocks;
        }
    }
    return [];
}

function buildPromptTrace(payload) {
    const messages = getPayloadMessagesForTrace(payload);
    const blocks = getPayloadPromptBlocksForTrace(payload);

    const blocksByIndex = new Map();
    const mergedIntoFirstSystem = [];
    const skipped = [];
    for (const block of blocks) {
        if (!block || typeof block !== 'object') continue;
        const idx = Number(block.index);
        if (Number.isInteger(idx) && idx >= 0) {
            if (!blocksByIndex.has(idx)) blocksByIndex.set(idx, []);
            blocksByIndex.get(idx).push(block);
            continue;
        }
        if (block.mergedInto === 'first-system') {
            mergedIntoFirstSystem.push(block);
            continue;
        }
        if (block.skipped === true) {
            skipped.push(block);
        }
    }

    const traced = messages.map((message, index) => {
        const linked = blocksByIndex.get(index) || [];
        const head = linked[0] || {};
        const linkedTitles = Array.from(
            new Set(
                linked
                    .map((block) => toStringOrEmpty(block.title))
                    .filter(Boolean)
            )
        );
        const baseTitle = linkedTitles.length > 0 ? linkedTitles.join(' + ') : 'Prompt Message';
        const baseSource = toStringOrEmpty(head.source) || 'message';
        const role = toStringOrEmpty(message?.role) || 'system';
        const content = extractTextFromMessageContent(message?.content);

        if (index === 0 && mergedIntoFirstSystem.length > 0) {
            const mergedTitles = mergedIntoFirstSystem
                .map((block) => toStringOrEmpty(block.title))
                .filter(Boolean);
            return {
                index,
                role,
                title: mergedTitles.length > 0 ? `${baseTitle} + ${mergedTitles.join(' + ')}` : baseTitle,
                source: baseSource,
                content,
                mergedTitles,
            };
        }

        return {
            index,
            role,
            title: baseTitle,
            source: baseSource,
            content,
        };
    });

    for (const block of skipped) {
        traced.push({
            index: null,
            role: toStringOrEmpty(block.role) || 'system',
            title: toStringOrEmpty(block.title) || 'Prompt Block',
            source: toStringOrEmpty(block.source) || 'template',
            content: '',
            skipped: true,
            reason: toStringOrEmpty(block.reason) || 'skipped',
        });
    }
    return traced;
}

function truncatePromptMessagesForAudit(promptMessages) {
    if (!Array.isArray(promptMessages)) {
        return {
            promptMessages: [],
            omittedMessageCount: 0,
        };
    }

    const sliced = promptMessages.slice(0, TRACE_AUDIT_MAX_MESSAGE_COUNT).map((msg) => {
        if (!msg || typeof msg !== 'object') return msg;
        const content = toStringOrEmpty(msg.content);
        if (!content || content.length <= TRACE_AUDIT_MAX_CONTENT_CHARS) return msg;
        return {
            ...msg,
            content: `${content.slice(0, TRACE_AUDIT_MAX_CONTENT_CHARS)}\n...[truncated ${content.length - TRACE_AUDIT_MAX_CONTENT_CHARS} chars]`,
            contentTruncated: true,
            contentLength: content.length,
        };
    });

    const omittedMessageCount = Math.max(0, promptMessages.length - sliced.length);
    return {
        promptMessages: sliced,
        omittedMessageCount,
    };
}

function estimatePromptTokens(messages) {
    return estimateMessagesTokens(messages);
}

module.exports = {
    extractLatestUserMessage,
    resolveServerMainPrompt,
    resolveServerGlobalNote,
    resolveServerAuthorNote,
    convertStoredChatToOpenAIMessages,
    buildMessagesFromPromptTemplate,
    injectDepthPrompt,
    buildGeneratePromptMessages,
    buildGenerateProviderRequest,
    buildPromptTrace,
    truncatePromptMessagesForAudit,
    estimatePromptTokens,
};
