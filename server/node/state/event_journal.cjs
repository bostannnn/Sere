const path = require('path');

function createEventJournal(arg = {}) {
    const fs = arg.fs;
    const existsSync = typeof arg.existsSync === 'function'
        ? arg.existsSync
        : (() => false);
    const dataDirs = arg.dataDirs || {};

    const metaPath = path.join(dataDirs.logs || '', 'state-events.meta.json');
    const logPath = path.join(dataDirs.logs || '', 'state-events.ndjson');

    async function ensureInitialized() {
        if (!dataDirs.logs) {
            throw new Error('event_journal requires dataDirs.logs');
        }
        if (!existsSync(dataDirs.logs)) {
            await fs.mkdir(dataDirs.logs, { recursive: true });
        }
        if (!existsSync(metaPath)) {
            const initialMeta = {
                nextEventId: 1,
                updatedAt: Date.now(),
            };
            await fs.writeFile(metaPath, `${JSON.stringify(initialMeta, null, 2)}\n`, 'utf-8');
        }
        if (!existsSync(logPath)) {
            await fs.writeFile(logPath, '', 'utf-8');
        }
    }

    async function readMeta() {
        await ensureInitialized();
        const raw = await fs.readFile(metaPath, 'utf-8');
        let parsed = {};
        try {
            parsed = JSON.parse(raw);
        } catch {
            parsed = {};
        }
        const nextEventId = Number.isFinite(Number(parsed?.nextEventId))
            ? Math.max(1, Number(parsed.nextEventId))
            : 1;
        return {
            nextEventId,
            updatedAt: Number.isFinite(Number(parsed?.updatedAt)) ? Number(parsed.updatedAt) : Date.now(),
        };
    }

    async function readLastEventIdFromLog() {
        await ensureInitialized();
        const raw = await fs.readFile(logPath, 'utf-8');
        if (!raw.trim()) return 0;
        const lines = raw.trimEnd().split('\n');
        for (let i = lines.length - 1; i >= 0; i -= 1) {
            const line = lines[i].trim();
            if (!line) continue;
            try {
                const parsed = JSON.parse(line);
                const id = Number(parsed?.id);
                if (Number.isFinite(id) && id > 0) {
                    return Math.floor(id);
                }
            } catch {
                // Ignore malformed tail lines.
            }
        }
        return 0;
    }

    async function reconcileMetaWithLog() {
        const [meta, lastLogEventId] = await Promise.all([
            readMeta(),
            readLastEventIdFromLog(),
        ]);
        const reconciledNextEventId = Math.max(1, meta.nextEventId, lastLogEventId + 1);
        if (reconciledNextEventId !== meta.nextEventId) {
            return writeMeta({
                nextEventId: reconciledNextEventId,
            });
        }
        return meta;
    }

    async function writeMeta(meta) {
        const payload = {
            nextEventId: Number.isFinite(Number(meta?.nextEventId)) ? Math.max(1, Number(meta.nextEventId)) : 1,
            updatedAt: Date.now(),
        };
        await fs.writeFile(metaPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
        return payload;
    }

    async function readLastEventId() {
        const meta = await reconcileMetaWithLog();
        return Math.max(0, meta.nextEventId - 1);
    }

    async function appendEvent(event) {
        const meta = await reconcileMetaWithLog();
        const eventId = meta.nextEventId;
        const payload = {
            id: eventId,
            ts: Date.now(),
            kind: typeof event?.kind === 'string' ? event.kind : 'unknown',
            resource: event?.resource && typeof event.resource === 'object' ? event.resource : {},
            revision: Number.isFinite(Number(event?.revision)) ? Number(event.revision) : 0,
            delta: event?.delta && typeof event.delta === 'object' ? event.delta : {},
            clientMutationId: typeof event?.clientMutationId === 'string' ? event.clientMutationId : '',
        };
        await fs.appendFile(logPath, `${JSON.stringify(payload)}\n`, 'utf-8');
        await writeMeta({
            nextEventId: eventId + 1,
        });
        return payload;
    }

    async function readEventsSince(sinceEventId, limit = 500) {
        await ensureInitialized();
        const since = Number.isFinite(Number(sinceEventId)) ? Number(sinceEventId) : 0;
        const max = Number.isFinite(Number(limit)) ? Math.min(Math.max(1, Number(limit)), 5000) : 500;
        const raw = await fs.readFile(logPath, 'utf-8');
        if (!raw.trim()) return [];
        const lines = raw.split('\n');
        const events = [];
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                if (!Number.isFinite(Number(parsed?.id))) continue;
                if (Number(parsed.id) <= since) continue;
                events.push(parsed);
            } catch {
                // Keep journal tolerant to one malformed line.
            }
            if (events.length >= max) break;
        }
        return events;
    }

    return {
        ensureInitialized,
        appendEvent,
        readEventsSince,
        readLastEventId,
        readLastEventIdFromLog,
    };
}

module.exports = {
    createEventJournal,
};
