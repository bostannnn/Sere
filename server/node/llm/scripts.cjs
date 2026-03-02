function toStringOrEmpty(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function stripThoughtBlocks(text) {
    if (typeof text !== 'string') return '';
    return text
        .replace(/<Thoughts>[\s\S]*?<\/Thoughts>\s*/gi, '')
        .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
        .trim();
}

function applyPromptVars(prompt, character, settings) {
    if (typeof prompt !== 'string' || !prompt.trim()) return '';
    const charName = toStringOrEmpty(character?.name) || 'Character';
    const userName = toStringOrEmpty(settings?.username) || 'User';
    return prompt
        .replace(/\{\{\s*char\s*\}\}/gi, charName)
        .replace(/\{\{\s*user\s*\}\}/gi, userName);
}

function parsePromptAsMessages(prompt, character, settings, defaultRole = 'system') {
    const rendered = applyPromptVars(prompt, character, settings);
    if (!rendered) return [];

    const normalizedDefaultRole =
        defaultRole === 'user' || defaultRole === 'assistant' ? defaultRole : 'system';
    let text = rendered;
    if (!text.startsWith('@@')) {
        text = `@@${normalizedDefaultRole}\n${text}`;
    }

    const parts = text.split(/@@@?(user|assistant|system)\n/);
    const messages = [];
    for (let i = 1; i < parts.length; i += 2) {
        const role = parts[i];
        const content = (parts[i + 1] || '').trim();
        if (!content) continue;
        messages.push({ role, content });
    }

    if (messages.length === 0 && rendered.trim()) {
        messages.push({ role: normalizedDefaultRole, content: rendered.trim() });
    }
    return messages;
}

function parseChatMLMessages(prompt, character, settings) {
    const starter = '<|im_start|>';
    const separator = '<|im_sep|>';
    const ender = '<|im_end|>';

    const rendered = applyPromptVars(prompt, character, settings).trim();
    if (!rendered) return [];
    if (!rendered.startsWith(starter)) {
        return parsePromptAsMessages(rendered, character, settings, 'system');
    }

    const messages = [];
    const blocks = rendered
        .split(starter)
        .map((chunk) => chunk.trim())
        .filter(Boolean);
    for (let chunk of blocks) {
        let role = 'user';
        if (chunk.startsWith(`user${separator}`)) {
            role = 'user';
            chunk = chunk.slice(`user${separator}`.length);
        } else if (chunk.startsWith(`system${separator}`)) {
            role = 'system';
            chunk = chunk.slice(`system${separator}`.length);
        } else if (chunk.startsWith(`assistant${separator}`)) {
            role = 'assistant';
            chunk = chunk.slice(`assistant${separator}`.length);
        } else if (chunk.startsWith('user ') || chunk.startsWith('user\n')) {
            role = 'user';
            chunk = chunk.slice(5);
        } else if (chunk.startsWith('system ') || chunk.startsWith('system\n')) {
            role = 'system';
            chunk = chunk.slice(7);
        } else if (chunk.startsWith('assistant ') || chunk.startsWith('assistant\n')) {
            role = 'assistant';
            chunk = chunk.slice(10);
        }

        chunk = chunk.trim();
        if (chunk.endsWith(ender)) {
            chunk = chunk.slice(0, chunk.length - ender.length).trim();
        }
        chunk = chunk.replace(/<Thoughts>[\s\S]*?<\/Thoughts>/gms, '').trim();
        if (!chunk) continue;
        messages.push({
            role,
            content: chunk,
        });
    }

    if (messages.length > 0) return messages;
    return parsePromptAsMessages(rendered, character, settings, 'system');
}

function normalizeTemplateRole(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'assistant' || normalized === 'bot' || normalized === 'model' || normalized === 'char') {
        return 'assistant';
    }
    if (normalized === 'user' || normalized === 'human') {
        return 'user';
    }
    return 'system';
}

function resolveTemplateConditionals(text, arg = {}) {
    if (typeof text !== 'string' || !text) return '';
    const prefillSupported = arg.prefillSupported !== false;
    return text.replace(/\{\{#if\s+\{\{\s*prefill_supported\s*\}\}\s*\}\}([\s\S]*?)\{\{\/if\}\}/gi, (_, inner) => {
        return prefillSupported ? inner : '';
    });
}

function renderTemplateSlot(innerFormat, slot, character, settings) {
    const format = resolveTemplateConditionals(toStringOrEmpty(innerFormat), { prefillSupported: true });
    if (!format) return slot;
    const renderedFormat = applyPromptVars(format, character, settings);
    if (!renderedFormat) return slot;
    return renderedFormat.replaceAll('{{slot}}', slot);
}

function systemizeChatMessages(chats) {
    if (!Array.isArray(chats)) return [];
    const transformed = [];
    for (const original of chats) {
        if (!original || typeof original !== 'object') continue;
        const role = toStringOrEmpty(original.role);
        if (role !== 'user' && role !== 'assistant') {
            transformed.push({ ...original });
            continue;
        }

        const clone = { ...original };
        const attr = Array.isArray(original.attr) ? original.attr : [];
        const name = toStringOrEmpty(original.name);
        const baseContent = toStringOrEmpty(original.content);

        if (name && name.startsWith('example_')) {
            clone.content = `${name}: ${baseContent}`;
        } else if (!attr.includes('nameAdded')) {
            clone.content = `${role}: ${baseContent}`;
        } else {
            clone.content = baseContent;
        }

        clone.role = 'system';
        delete clone.memo;
        delete clone.name;
        transformed.push(clone);
    }
    return transformed;
}

module.exports = {
    toStringOrEmpty,
    stripThoughtBlocks,
    applyPromptVars,
    parsePromptAsMessages,
    parseChatMLMessages,
    normalizeTemplateRole,
    resolveTemplateConditionals,
    renderTemplateSlot,
    systemizeChatMessages,
};
