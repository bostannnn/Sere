import type { StateCommand, StateCommandsResponse } from "./serverStateClient";

export type ServerSaveConflict = {
    index?: number;
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
};

export type ServerSaveFailureResult = {
    status: number;
    lastEventId: number;
    conflicts: ServerSaveConflict[];
    commands: StateCommand[];
    baseEventId: number;
    attempt: number;
};

export type ServerSaveFailureError = Error & {
    status?: number;
    result?: ServerSaveFailureResult;
};

function formatResourceIdentifiers(command: Record<string, unknown>) {
    const parts: string[] = [];
    if (typeof command.charId === 'string' && command.charId) {
        parts.push(`charId=${command.charId}`);
    }
    if (typeof command.chatId === 'string' && command.chatId) {
        parts.push(`chatId=${command.chatId}`);
    }
    return parts.length > 0 ? ` (${parts.join(', ')})` : '';
}

export function summarizeStateCommand(command: unknown) {
    if (!command || typeof command !== 'object') {
        return 'unknown command';
    }
    const commandRecord = command as Record<string, unknown>;
    const type = typeof commandRecord.type === 'string' && commandRecord.type
        ? commandRecord.type
        : 'unknown command';
    return `${type}${formatResourceIdentifiers(commandRecord)}`;
}

export function summarizeStateCommandBatch(commands: unknown[], limit = 2) {
    const summaries = commands.map((entry) => summarizeStateCommand(entry)).filter((entry) => entry.length > 0);
    if (summaries.length === 0) {
        return 'unknown command batch';
    }
    if (summaries.length <= limit) {
        return summaries.join(' + ');
    }
    return `${summaries.slice(0, limit).join(' + ')} + ${summaries.length - limit} more`;
}

function toConflictList(conflicts: unknown[]) {
    return conflicts
        .filter((entry): entry is ServerSaveConflict => !!entry && typeof entry === 'object')
        .map((entry) => ({
            index: typeof entry.index === 'number' ? entry.index : undefined,
            code: typeof entry.code === 'string' ? entry.code : undefined,
            message: typeof entry.message === 'string' ? entry.message : undefined,
            details: entry.details && typeof entry.details === 'object'
                ? entry.details as Record<string, unknown>
                : undefined,
        }));
}

export function createServerSaveConflictError(args: {
    response: StateCommandsResponse;
    commands: StateCommand[];
    baseEventId: number;
    attempt: number;
}) {
    const { response, commands, baseEventId, attempt } = args;
    const conflicts = toConflictList(Array.isArray(response.conflicts) ? response.conflicts : []);
    const summary = summarizeStateCommandBatch(commands);
    const primaryConflict = conflicts[0];
    const code = primaryConflict?.code || 'UNKNOWN_CONFLICT';
    const message = `POST /data/state/commands conflicted while saving ${summary} (${code})`;
    const error = new Error(message) as ServerSaveFailureError;
    error.name = 'ServerSaveConflictError';
    error.status = 409;
    error.result = {
        status: 409,
        lastEventId: Number(response?.lastEventId ?? 0),
        conflicts,
        commands: Array.isArray(commands) ? commands : [],
        baseEventId,
        attempt,
    };
    return error;
}

function getPrimaryConflict(error: unknown) {
    const result = (error as ServerSaveFailureError | undefined)?.result;
    const conflicts = Array.isArray(result?.conflicts) ? result.conflicts : [];
    return conflicts[0];
}

function getConflictCommand(error: unknown, conflict: ServerSaveConflict | undefined) {
    const result = (error as ServerSaveFailureError | undefined)?.result;
    const commands = Array.isArray(result?.commands) ? result.commands : [];
    if (typeof conflict?.index === 'number' && conflict.index >= 0 && conflict.index < commands.length) {
        return commands[conflict.index];
    }
    return null;
}

function getErrorStatus(error: unknown) {
    const status = (error as ServerSaveFailureError | undefined)?.status;
    if (typeof status === 'number' && Number.isFinite(status)) {
        return status;
    }
    const message = `${(error as Error | undefined)?.message ?? error ?? ''}`;
    const match = message.match(/\((\d{3})\)/);
    if (!match) {
        return null;
    }
    return parseInt(match[1]);
}

export function formatServerSaveFailureMessage(error: unknown) {
    const status = getErrorStatus(error);
    if (status === 429) {
        return 'Live save blocked by authentication rate-limit. Recent changes may be lost.';
    }
    if (status === 401 || status === 403) {
        return 'Live save requires re-authentication. Recent changes may be lost.';
    }
    if (status !== 409) {
        return 'Live save failed. Recent changes may be lost after refresh.';
    }

    const result = (error as ServerSaveFailureError | undefined)?.result;
    const conflicts = Array.isArray(result?.conflicts) ? result.conflicts : [];
    if (conflicts.length === 0) {
        return 'Live save conflicted with newer server state. Recent changes may be lost after refresh.';
    }

    const primaryConflict = getPrimaryConflict(error);
    const specificCommand = getConflictCommand(error, primaryConflict);
    const targetSummary = specificCommand
        ? summarizeStateCommand(specificCommand)
        : summarizeStateCommandBatch(Array.isArray(result?.commands) ? result.commands : []);
    const conflictCode = primaryConflict?.code || 'UNKNOWN_CONFLICT';

    if (conflictCode === 'STALE_BASE_EVENT') {
        const currentLastEventId = Number(primaryConflict?.details?.currentLastEventId ?? result?.lastEventId ?? 0);
        const baseEventId = Number(primaryConflict?.details?.baseEventId ?? result?.baseEventId ?? 0);
        return `Live save conflict while saving ${targetSummary}. Server state advanced from event ${baseEventId} to ${currentLastEventId}. Recent changes may be lost after refresh.`;
    }

    return `Live save conflict while saving ${targetSummary} (${conflictCode}). Recent changes may be lost after refresh.`;
}

export function getServerSaveFailureLogDetails(error: unknown) {
    const result = (error as ServerSaveFailureError | undefined)?.result;
    return {
        status: getErrorStatus(error),
        name: (error as Error | undefined)?.name ?? 'UnknownError',
        message: (error as Error | undefined)?.message ?? String(error),
        baseEventId: result?.baseEventId ?? null,
        lastEventId: result?.lastEventId ?? null,
        conflicts: result?.conflicts ?? [],
        commands: Array.isArray(result?.commands)
            ? result.commands.map((entry) => summarizeStateCommand(entry))
            : [],
        attempt: result?.attempt ?? null,
    };
}
