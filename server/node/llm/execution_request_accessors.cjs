function isObjectRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function listExecutionRequestCandidates(input, options = {}) {
    if (!isObjectRecord(input)) {
        return [];
    }

    const includeNestedRequests = options.includeNestedRequests !== false;
    const preferInnermost = options.preferInnermost === true;
    const maxNestedRequests = Number.isInteger(Number(options.maxNestedRequests))
        ? Math.max(0, Number(options.maxNestedRequests))
        : 3;
    const candidates = [];
    let current = input;
    let depth = 0;

    while (isObjectRecord(current)) {
        candidates.push(current);
        if (!includeNestedRequests || !isObjectRecord(current.request) || depth >= maxNestedRequests) {
            break;
        }
        current = current.request;
        depth += 1;
    }

    return preferInnermost ? candidates.slice().reverse() : candidates;
}

function readExecutionRequest(input) {
    const candidates = listExecutionRequestCandidates(input, { maxNestedRequests: 4 });
    return candidates.length > 0 ? candidates[candidates.length - 1] : {};
}

function readExecutionRequestBody(input, options = {}) {
    const candidates = listExecutionRequestCandidates(input, options);
    for (const candidate of candidates) {
        if (isObjectRecord(candidate.requestBody)) {
            return candidate.requestBody;
        }
    }
    return {};
}

function readExecutionMessagesAtLevel(input) {
    if (!isObjectRecord(input)) {
        return undefined;
    }
    if (Array.isArray(input?.requestBody?.messages)) {
        return input.requestBody.messages;
    }
    if (Array.isArray(input?.messages)) {
        return input.messages;
    }
    return undefined;
}

function readExecutionMessages(input, options = {}) {
    const candidates = listExecutionRequestCandidates(input, options);
    for (const candidate of candidates) {
        const messages = readExecutionMessagesAtLevel(candidate);
        if (Array.isArray(messages)) {
            return messages;
        }
    }
    return [];
}

function readExecutionContents(input, options = {}) {
    const candidates = listExecutionRequestCandidates(input, options);
    for (const candidate of candidates) {
        if (Array.isArray(candidate?.requestBody?.contents)) {
            return candidate.requestBody.contents;
        }
        if (Array.isArray(candidate?.contents)) {
            return candidate.contents;
        }
    }
    return [];
}

function readExecutionPrompt(input, options = {}) {
    const candidates = listExecutionRequestCandidates(input, options);
    for (const candidate of candidates) {
        if (typeof candidate?.requestBody?.prompt === 'string') {
            return candidate.requestBody.prompt;
        }
        if (typeof candidate?.prompt === 'string') {
            return candidate.prompt;
        }
    }
    return '';
}

function readExecutionModel(input, options = {}) {
    const candidates = listExecutionRequestCandidates(input, options);
    for (const candidate of candidates) {
        if (typeof candidate?.model === 'string' && candidate.model !== '') {
            return candidate.model;
        }
        if (typeof candidate?.requestBody?.model === 'string' && candidate.requestBody.model !== '') {
            return candidate.requestBody.model;
        }
    }
    return '';
}

function readExecutionPromptBlocks(input, options = {}) {
    const candidates = listExecutionRequestCandidates(input, options);
    for (const candidate of candidates) {
        if (Array.isArray(candidate?.promptBlocks)) {
            return candidate.promptBlocks;
        }
    }
    return [];
}

module.exports = {
    listExecutionRequestCandidates,
    readExecutionRequest,
    readExecutionRequestBody,
    readExecutionMessagesAtLevel,
    readExecutionMessages,
    readExecutionContents,
    readExecutionPrompt,
    readExecutionModel,
    readExecutionPromptBlocks,
};
