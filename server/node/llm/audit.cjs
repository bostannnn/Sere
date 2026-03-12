const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');

const LOGS_DIR_NAME = 'logs';
const LLM_LOG_DIR_NAME = 'llm-execution';
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
let lastFileTimestampMs = -1;
let sameTimestampSequence = 0;

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

function formatUtcDateParts(timestampMs) {
    const dt = new Date(timestampMs);
    return {
        yyyy: dt.getUTCFullYear(),
        mm: String(dt.getUTCMonth() + 1).padStart(2, '0'),
        dd: String(dt.getUTCDate()).padStart(2, '0'),
        hh: String(dt.getUTCHours()).padStart(2, '0'),
        min: String(dt.getUTCMinutes()).padStart(2, '0'),
        ss: String(dt.getUTCSeconds()).padStart(2, '0'),
        ms: String(dt.getUTCMilliseconds()).padStart(3, '0'),
    };
}

function toSafeSlug(value, fallback = 'unknown') {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function buildSourceSlug(entry) {
    if (!entry || typeof entry !== 'object') {
        return 'audit';
    }
    const endpoint = toSafeSlug(entry.endpoint || entry.path || 'audit', 'audit');
    const mode = toSafeSlug(entry.mode || '', '');
    if (!mode) {
        return endpoint;
    }
    return `${endpoint}-${mode}`;
}

function buildRequestSlug(entry) {
    if (!entry || typeof entry !== 'object') {
        return 'no-request-id';
    }
    return toSafeSlug(entry.requestId || entry.provider || entry.method || 'no-request-id', 'no-request-id');
}

function getEntryLogsRoot(dataRoot) {
    return path.join(dataRoot, LOGS_DIR_NAME, LLM_LOG_DIR_NAME);
}

function getLogFilePath(dataRoot, timestampMs = Date.now(), entry = {}) {
    const { yyyy, mm, dd, hh, min, ss, ms } = formatUtcDateParts(timestampMs);
    const dayDir = `${yyyy}-${mm}-${dd}`;
    const fileName = `${yyyy}-${mm}-${dd}T${hh}-${min}-${ss}.${ms}Z__${buildSourceSlug(entry)}__${buildRequestSlug(entry)}.json`;
    return path.join(getEntryLogsRoot(dataRoot), dayDir, fileName);
}

function nextFileSequence(timestampMs) {
    if (timestampMs === lastFileTimestampMs) {
        sameTimestampSequence += 1;
    } else {
        lastFileTimestampMs = timestampMs;
        sameTimestampSequence = 0;
    }
    return sameTimestampSequence;
}

function getUniqueLogFilePath(dataRoot, timestampMs = Date.now(), entry = {}) {
    const basePath = getLogFilePath(dataRoot, timestampMs, entry);
    const sequence = nextFileSequence(timestampMs);
    if (sequence === 0) {
        return basePath;
    }
    const ext = path.extname(basePath);
    const baseWithoutExt = basePath.slice(0, ext ? -ext.length : undefined);
    return `${baseWithoutExt}__${String(sequence).padStart(4, '0')}${ext}`;
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

async function listEntryLogDayDirs(dataRoot) {
    const logsRoot = getEntryLogsRoot(dataRoot);
    if (!existsSync(logsRoot)) {
        return [];
    }
    return (await fs.readdir(logsRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .reverse();
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
    const logsRoot = getEntryLogsRoot(dataRoot);
    const dayDirs = await listEntryLogDayDirs(dataRoot);
    for (const dayDir of dayDirs) {
        const dirPath = path.join(logsRoot, dayDir);
        let dayFiles = [];
        try {
            dayFiles = await fs.readdir(dirPath, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const dayFile of dayFiles) {
            if (!dayFile.isFile() || !dayFile.name.endsWith('.json')) continue;
            const filePath = path.join(dirPath, dayFile.name);
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
    if (!existsSync(logsRoot)) {
        return;
    }
    const remainingDayDirs = await fs.readdir(logsRoot, { withFileTypes: true });
    for (const dayDir of remainingDayDirs) {
        if (!dayDir.isDirectory()) continue;
        const dirPath = path.join(logsRoot, dayDir.name);
        try {
            const remaining = await fs.readdir(dirPath);
            if (remaining.length === 0) {
                await fs.rmdir(dirPath);
            }
        } catch {
            // Ignore empty-dir cleanup failures.
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
    let payload = {
        timestamp: new Date().toISOString(),
        ...sanitizeValue(entry),
    };
    if (logMode === 'compact') {
        payload = compactEntry(payload);
    } else if (logMode === 'metadata') {
        payload = metadataEntry(payload);
    }
    const filePath = getUniqueLogFilePath(dataRoot, nowMs, payload);
    const logsDir = path.dirname(filePath);
    await fs.mkdir(logsDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(payload), 'utf-8');
    await pruneOldLogsIfNeeded(dataRoot, nowMs);
    return filePath;
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

async function collectMatchingEntriesFromEntryStore(dataRoot, filters, limit, out) {
    const logsRoot = getEntryLogsRoot(dataRoot);
    const dayDirs = await listEntryLogDayDirs(dataRoot);
    for (const dayDir of dayDirs) {
        if (out.length >= limit) {
            return;
        }
        const dirPath = path.join(logsRoot, dayDir);
        let dayFiles;
        try {
            dayFiles = (await fs.readdir(dirPath, { withFileTypes: true }))
                .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
                .map((entry) => entry.name)
                .sort()
                .reverse();
        } catch {
            continue;
        }
        for (const fileName of dayFiles) {
            if (out.length >= limit) {
                return;
            }
            const filePath = path.join(dirPath, fileName);
            try {
                const raw = await fs.readFile(filePath, 'utf-8');
                const entry = parseLine(raw);
                if (!entry || !matchesFilter(entry, filters)) {
                    continue;
                }
                out.push(entry);
            } catch {
                // Ignore single-file read failures.
            }
        }
    }
}

async function readExecutionLogs(dataRoot, query = {}) {
    const entryDayDirs = await listEntryLogDayDirs(dataRoot);
    if (entryDayDirs.length === 0) {
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
    await collectMatchingEntriesFromEntryStore(dataRoot, filters, limit, result);
    return result;
}

module.exports = {
    appendExecutionLog,
    readExecutionLogs,
    getLogFilePath,
};
