const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');

const LOGS_DIR_NAME = 'logs';
const LLM_LOG_FILE_NAME = 'llm-execution.jsonl';
const LLM_LOG_FILE_PREFIX = 'llm-execution';
const REDACTED = '[REDACTED]';
const TRUNCATED = '[TRUNCATED]';
const MAX_DEPTH = 8;
const MAX_OBJECT_KEYS = 200;
const MAX_ARRAY_ITEMS = 200;
const MAX_STRING_LENGTH = 100000;
const SENSITIVE_KEY_REGEX = /(authorization|api[-_]?key|x-api-key|token|secret|password|proxy_password|risu-auth|openrouterkey|proxykey|x-risu-tk)/i;
const NON_SENSITIVE_LOG_KEYS = new Set([
    'max_tokens',
    'maxtokens',
    'max_output_tokens',
    'maxoutputtokens',
    'max_completion_tokens',
    'thinking_tokens',
    'thinkingbudget',
]);
const DEFAULT_LOG_MODE = 'full';
const ALLOWED_LOG_MODES = new Set(['full', 'compact', 'metadata']);
let lastPruneAtMs = 0;

function isSensitiveLogKey(key) {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized) {
        return false;
    }
    if (NON_SENSITIVE_LOG_KEYS.has(normalized)) {
        return false;
    }
    return SENSITIVE_KEY_REGEX.test(normalized);
}

function parseBooleanEnv(name) {
    const value = String(process.env[name] || '').trim().toLowerCase();
    return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function getLogMode() {
    const raw = String(process.env.RISU_LLM_LOG_MODE || DEFAULT_LOG_MODE).trim().toLowerCase();
    if (ALLOWED_LOG_MODES.has(raw)) {
        return raw;
    }
    return DEFAULT_LOG_MODE;
}

function getLogRetentionDays() {
    const raw = Number(process.env.RISU_LLM_LOG_RETENTION_DAYS || 0);
    if (!Number.isFinite(raw) || raw <= 0) {
        return 0;
    }
    return Math.floor(raw);
}

function getLogFilePath(dataRoot, timestampMs = Date.now()) {
    if (!parseBooleanEnv('RISU_LLM_LOG_SPLIT_DAILY')) {
        return path.join(dataRoot, LOGS_DIR_NAME, LLM_LOG_FILE_NAME);
    }
    const dt = new Date(timestampMs);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return path.join(dataRoot, LOGS_DIR_NAME, `${LLM_LOG_FILE_PREFIX}-${yyyy}-${mm}-${dd}.jsonl`);
}

function compactEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return entry;
    }
    const out = { ...entry };
    const req = out.request;
    const res = out.response;
    const err = out.error;
    out.request = {
        hasData: !!req,
        requestBodyKeys: req?.request?.requestBody && typeof req.request.requestBody === 'object'
            ? Object.keys(req.request.requestBody).slice(0, 40)
            : (Array.isArray(req?.request?.requestBodyKeys) ? req.request.requestBodyKeys.slice(0, 40) : []),
        model: req?.request?.model || req?.model || '',
        messageCount: Array.isArray(req?.request?.messages)
            ? req.request.messages.length
            : (
                Array.isArray(req?.request?.requestBody?.messages)
                    ? req.request.requestBody.messages.length
                    : (Number.isFinite(Number(req?.request?.messagesCount)) ? Number(req.request.messagesCount) : 0)
            ),
        maxTokens: req?.request?.maxTokens ?? req?.maxTokens ?? null,
        estimatedPromptTokens: req?.request?.estimatedPromptTokens ?? null,
        promptChars: req?.request?.promptChars ?? null,
        toolsCount: req?.request?.toolsCount ?? null,
    };
    out.response = {
        hasData: !!res,
        type: res?.type || '',
        model: res?.model || '',
        resultLength: typeof res?.result === 'string' ? res.result.length : 0,
        hasNewCharEtag: !!res?.newCharEtag,
    };
    out.error = err ? {
        code: err?.error || err?.code || '',
        message: err?.message || '',
    } : null;
    return out;
}

function metadataEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return entry;
    }
    const out = { ...entry };
    delete out.request;
    delete out.response;
    delete out.error;
    return out;
}

async function listLogFiles(dataRoot) {
    const logsDir = path.join(dataRoot, LOGS_DIR_NAME);
    if (!existsSync(logsDir)) {
        return [];
    }
    const files = await fs.readdir(logsDir, { withFileTypes: true });
    return files
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((name) =>
            name === LLM_LOG_FILE_NAME ||
            /^llm-execution-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name)
        )
        .sort()
        .map((name) => path.join(logsDir, name));
}

async function pruneOldLogsIfNeeded(dataRoot, nowMs = Date.now()) {
    const retentionDays = getLogRetentionDays();
    if (retentionDays <= 0) {
        return;
    }
    if (nowMs - lastPruneAtMs < 60 * 60 * 1000) {
        return;
    }
    lastPruneAtMs = nowMs;
    const cutoffMs = nowMs - (retentionDays * 24 * 60 * 60 * 1000);
    const files = await listLogFiles(dataRoot);
    for (const filePath of files) {
        try {
            const stat = await fs.stat(filePath);
            if (stat.mtimeMs < cutoffMs) {
                await fs.unlink(filePath);
            }
        } catch {
            // Ignore single-file pruning failures.
        }
    }
}

function sanitizeValue(value, depth = 0) {
    if (value === null || value === undefined) {
        return value;
    }
    if (depth >= MAX_DEPTH) {
        return TRUNCATED;
    }
    if (typeof value === 'string') {
        if (value.length > MAX_STRING_LENGTH) {
            return `${value.slice(0, MAX_STRING_LENGTH)}...${TRUNCATED}`;
        }
        return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'bigint') {
        return value.toString();
    }
    if (Array.isArray(value)) {
        const list = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1));
        if (value.length > MAX_ARRAY_ITEMS) {
            list.push(TRUNCATED);
        }
        return list;
    }
    if (typeof value === 'object') {
        const out = {};
        const entries = Object.entries(value);
        const limit = Math.min(entries.length, MAX_OBJECT_KEYS);
        for (let i = 0; i < limit; i++) {
            const [key, entryValue] = entries[i];
            if (isSensitiveLogKey(key)) {
                out[key] = REDACTED;
                continue;
            }
            out[key] = sanitizeValue(entryValue, depth + 1);
        }
        if (entries.length > MAX_OBJECT_KEYS) {
            out.__truncated__ = true;
        }
        return out;
    }
    return String(value);
}

async function appendExecutionLog(dataRoot, entry) {
    if (!dataRoot) {
        return;
    }
    const nowMs = Date.now();
    const logMode = getLogMode();
    const filePath = getLogFilePath(dataRoot, nowMs);
    const logsDir = path.dirname(filePath);
    await fs.mkdir(logsDir, { recursive: true });
    let payload = {
        timestamp: new Date().toISOString(),
        ...sanitizeValue(entry),
    };
    if (logMode === 'compact') {
        payload = compactEntry(payload);
    } else if (logMode === 'metadata') {
        payload = metadataEntry(payload);
    }
    await fs.appendFile(filePath, `${JSON.stringify(payload)}\n`, 'utf-8');
    await pruneOldLogsIfNeeded(dataRoot, nowMs);
}

function parseLine(line) {
    try {
        return JSON.parse(line);
    } catch {
        return null;
    }
}

function matchesFilter(entry, filters) {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    if (filters.requestId && String(entry.requestId) !== filters.requestId) {
        return false;
    }
    if (filters.chatId && String(entry.chatId || '') !== filters.chatId) {
        return false;
    }
    if (filters.endpoint && String(entry.endpoint || '') !== filters.endpoint) {
        return false;
    }
    if (filters.provider && String(entry.provider || '') !== filters.provider) {
        return false;
    }
    if (Number.isFinite(filters.status) && Number(entry.status) !== filters.status) {
        return false;
    }
    if (Number.isFinite(filters.sinceMs)) {
        const ts = Date.parse(entry.timestamp || '');
        if (!Number.isFinite(ts) || ts < filters.sinceMs) {
            return false;
        }
    }
    return true;
}

async function collectMatchingEntriesFromFileEnd(filePath, filters, limit, out) {
    if (out.length >= limit) return;
    const handle = await fs.open(filePath, 'r');
    try {
        const stat = await handle.stat();
        let offset = stat.size;
        let remainder = '';
        const chunkSize = 64 * 1024;

        while (offset > 0 && out.length < limit) {
            const readSize = Math.min(chunkSize, offset);
            offset -= readSize;
            const buffer = Buffer.allocUnsafe(readSize);
            await handle.read(buffer, 0, readSize, offset);
            const text = buffer.toString('utf-8') + remainder;
            const lines = text.split('\n');
            remainder = lines.shift() || '';

            for (let i = lines.length - 1; i >= 0; i--) {
                const entry = parseLine(lines[i]);
                if (!entry) continue;
                if (!matchesFilter(entry, filters)) continue;
                out.push(entry);
                if (out.length >= limit) {
                    return;
                }
            }
        }

        if (remainder && out.length < limit) {
            const entry = parseLine(remainder);
            if (entry && matchesFilter(entry, filters)) {
                out.push(entry);
            }
        }
    } finally {
        await handle.close();
    }
}

async function readExecutionLogs(dataRoot, query = {}) {
    const filePaths = await listLogFiles(dataRoot);
    if (filePaths.length === 0) {
        return [];
    }
    const limit = Math.max(1, Math.min(500, Number(query.limit) || 100));
    const filters = {
        requestId: typeof query.requestId === 'string' ? query.requestId.trim() : '',
        chatId: typeof query.chatId === 'string' ? query.chatId.trim() : '',
        endpoint: typeof query.endpoint === 'string' ? query.endpoint.trim() : '',
        provider: typeof query.provider === 'string' ? query.provider.trim().toLowerCase() : '',
        status: Number.isFinite(Number(query.status)) ? Number(query.status) : null,
        sinceMs: Number.isFinite(Number(query.since)) ? Number(query.since) : null,
    };

    const result = [];
    for (let fileIdx = filePaths.length - 1; fileIdx >= 0; fileIdx--) {
        const filePath = filePaths[fileIdx];
        await collectMatchingEntriesFromFileEnd(filePath, filters, limit, result);
        if (result.length >= limit) {
            return result;
        }
    }
    return result;
}

module.exports = {
    appendExecutionLog,
    readExecutionLogs,
    getLogFilePath,
};
