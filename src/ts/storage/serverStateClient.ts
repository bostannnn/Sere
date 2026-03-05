import { fetchWithServerAuth } from "./serverAuth";

export type StateResource =
    | { type: 'settings' }
    | { type: 'character'; charId: string }
    | { type: 'chat'; charId: string; chatId: string };

export type StateEvent = {
    id: number;
    ts: number;
    kind: string;
    resource: StateResource;
    revision: number;
    delta: Record<string, unknown>;
    clientMutationId?: string;
};

export type StateSnapshot = {
    serverTime: number;
    lastEventId: number;
    settings: Record<string, unknown>;
    characters: Record<string, unknown>[];
    chatsByCharacter: Record<string, unknown[]>;
    revisions: {
        settings: number;
        characters: Record<string, number>;
        chats: Record<string, Record<string, number>>;
    };
};

export type StateCommand = {
    type: string;
    [key: string]: unknown;
};

export type StateCommandsRequest = {
    clientMutationId: string;
    baseEventId?: number;
    commands: StateCommand[];
};

export type StateCommandsResponse = {
    ok: boolean;
    lastEventId: number;
    applied: unknown[];
    conflicts: unknown[];
};

const stateClientLog = (..._args: unknown[]) => {};

let lastEventIdCursor = 0;
let applyingRemoteState = false;
let streamAbort: AbortController | null = null;
let streamStarted = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs = 700;
const pendingMutationIds = new Map<string, number>();
const pendingMutationTtlMs = 2 * 60 * 1000;
const pendingMutationMax = 1024;

function prunePendingMutationIds(force = false) {
    const now = Date.now();
    for (const [mutationId, createdAt] of pendingMutationIds) {
        if (force || (now - createdAt) >= pendingMutationTtlMs) {
            pendingMutationIds.delete(mutationId);
        }
    }
    while (pendingMutationIds.size > pendingMutationMax) {
        const oldest = pendingMutationIds.keys().next().value;
        if (!oldest) break;
        pendingMutationIds.delete(oldest);
    }
}

function markPendingMutation(mutationId: string) {
    if (!mutationId) return;
    pendingMutationIds.set(mutationId, Date.now());
    prunePendingMutationIds(false);
}

function clearPendingMutation(mutationId: string) {
    if (!mutationId) return;
    pendingMutationIds.delete(mutationId);
}

function parseNumericCursor(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

function updateCursor(next: unknown) {
    const parsed = parseNumericCursor(next);
    if (parsed > lastEventIdCursor) {
        lastEventIdCursor = parsed;
    }
    return lastEventIdCursor;
}

export function getServerStateLastEventId() {
    return lastEventIdCursor;
}

export function setServerStateLastEventId(next: number) {
    lastEventIdCursor = parseNumericCursor(next);
}

export function isApplyingServerSnapshot() {
    return applyingRemoteState;
}

export async function withApplyingServerSnapshot<T>(task: () => Promise<T>) {
    applyingRemoteState = true;
    try {
        return await task();
    } finally {
        applyingRemoteState = false;
    }
}

export function stopServerStateEventStream() {
    streamStarted = false;
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    if (streamAbort) {
        streamAbort.abort();
        streamAbort = null;
    }
    pendingMutationIds.clear();
}

export async function fetchServerStateSnapshot() {
    const response = await fetchWithServerAuth('/data/state/snapshot', {
        method: 'GET',
        headers: {
            'accept': 'application/json',
        },
        cache: 'no-store',
    });
    if (!response.ok) {
        throw new Error(`GET /data/state/snapshot failed (${response.status})`);
    }
    const payload = (await response.json()) as StateSnapshot;
    updateCursor(payload?.lastEventId);
    return payload;
}

export async function enqueueCommand(request: StateCommandsRequest) {
    const mutationId = typeof request.clientMutationId === 'string' ? request.clientMutationId : '';
    markPendingMutation(mutationId);

    const response = await fetchWithServerAuth('/data/state/commands', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'accept': 'application/json',
        },
        body: JSON.stringify({
            clientMutationId: mutationId,
            baseEventId: parseNumericCursor(request.baseEventId ?? lastEventIdCursor),
            commands: Array.isArray(request.commands) ? request.commands : [],
        }),
    }, {
        retryOn401: true,
        interactive: true,
    });

    let payload: StateCommandsResponse = {
        ok: false,
        lastEventId: getServerStateLastEventId(),
        applied: [],
        conflicts: [],
    };
    try {
        payload = (await response.json()) as StateCommandsResponse;
    } catch {
        // keep default payload shape
    }
    if (mutationId && (!response.ok || payload?.ok === false)) {
        clearPendingMutation(mutationId);
    }
    prunePendingMutationIds(false);

    updateCursor(payload?.lastEventId);

    if (response.status === 409) {
        return payload;
    }

    if (!response.ok) {
        throw new Error(`POST /data/state/commands failed (${response.status})`);
    }
    return payload;
}

async function consumeEventStream(
    signal: AbortSignal,
    callbacks: {
        onRemoteEvent?: (event: StateEvent) => Promise<void> | void;
        onGap?: (event: StateEvent, expectedNextId: number) => Promise<void> | void;
    },
) {
    const startSince = getServerStateLastEventId();
    const response = await fetchWithServerAuth(`/data/sync/events?since=${encodeURIComponent(String(startSince))}`, {
        method: 'GET',
        headers: {
            'accept': 'text/event-stream',
            'cache-control': 'no-cache',
        },
        signal,
        cache: 'no-store',
    }, {
        retryOn401: true,
        interactive: true,
    });

    if (!response.ok) {
        throw new Error(`GET /data/sync/events failed (${response.status})`);
    }

    const body = response.body;
    if (!body) {
        throw new Error('SSE response has no body.');
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';

    const flushEventFrame = async (frame: string) => {
        const lines = frame.split('\n');
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const rawLine of lines) {
            const line = rawLine.trimEnd();
            if (!line || line.startsWith(':')) continue;
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
                continue;
            }
            if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trimStart());
            }
        }

        if (eventName !== 'state-event') return;
        if (dataLines.length === 0) return;

        const payloadRaw = dataLines.join('\n');
        let event: StateEvent | null = null;
        try {
            event = JSON.parse(payloadRaw) as StateEvent;
        } catch {
            return;
        }
        if (!event) return;

        const eventId = parseNumericCursor(event.id);
        const expectedNextId = getServerStateLastEventId() + 1;
        if (eventId > expectedNextId && callbacks.onGap) {
            await callbacks.onGap(event, expectedNextId);
        }

        if (eventId > 0) {
            updateCursor(eventId);
        }

        const mutationId = typeof event.clientMutationId === 'string' ? event.clientMutationId : '';
        prunePendingMutationIds(false);
        if (mutationId && pendingMutationIds.has(mutationId)) {
            clearPendingMutation(mutationId);
            return;
        }

        if (callbacks.onRemoteEvent) {
            await callbacks.onRemoteEvent(event);
        }
    };

    while (!signal.aborted) {
        const readResult = await reader.read();
        if (readResult.done) {
            break;
        }
        buffered += decoder.decode(readResult.value, { stream: true });

        let separatorIndex = buffered.indexOf('\n\n');
        while (separatorIndex !== -1) {
            const frame = buffered.slice(0, separatorIndex);
            buffered = buffered.slice(separatorIndex + 2);
            await flushEventFrame(frame.replace(/\r/g, ''));
            separatorIndex = buffered.indexOf('\n\n');
        }
    }
}

export function startServerStateEventStream(callbacks: {
    onRemoteEvent?: (event: StateEvent) => Promise<void> | void;
    onGap?: (event: StateEvent, expectedNextId: number) => Promise<void> | void;
}) {
    if (streamStarted) return;
    streamStarted = true;

    const loop = async () => {
        if (!streamStarted) return;
        if (streamAbort) {
            streamAbort.abort();
        }
        streamAbort = new AbortController();

        try {
            await consumeEventStream(streamAbort.signal, callbacks);
            reconnectDelayMs = 700;
        } catch (error) {
            if (!streamStarted) return;
            stateClientLog('[ServerStateClient] event stream closed', error);
            reconnectDelayMs = Math.min(8000, Math.round(reconnectDelayMs * 1.8));
        }

        if (!streamStarted) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void loop();
        }, reconnectDelayMs);
    };

    void loop();
}

export function __debugPendingMutationCountForTests() {
    prunePendingMutationIds(false);
    return pendingMutationIds.size;
}

export function __debugResetServerStateClientForTests() {
    stopServerStateEventStream();
    lastEventIdCursor = 0;
    applyingRemoteState = false;
    reconnectDelayMs = 700;
    pendingMutationIds.clear();
}
