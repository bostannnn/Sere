import { language } from "src/lang";
import { alertInput } from "../alert";
import { isNodeServer } from "../platform";

type PasswordStatusValue = 'unset' | 'correct' | 'incorrect';

type PasswordStatusPayload = {
    status?: PasswordStatusValue;
    retryAfterMs?: number;
};

const AUTH_TOKEN_STORAGE_KEY = 'risuauth';
const AUTH_CLIENT_ID_STORAGE_KEY = 'risu_auth_client_id';

let authTokenCache: string | null = null;
let authTokenChecked = false;
let authResolveInFlight: Promise<string | null> | null = null;

function getSessionStorageSafe() {
    try {
        return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    } catch {
        return null;
    }
}

function getLocalStorageSafe() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;
    }
}

function createClientId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `risu-${crypto.randomUUID()}`;
    }
    return `risu-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readStoredAuthClientId() {
    const session = getSessionStorageSafe();
    const local = getLocalStorageSafe();
    let value = (local?.getItem(AUTH_CLIENT_ID_STORAGE_KEY) ?? session?.getItem(AUTH_CLIENT_ID_STORAGE_KEY) ?? '').trim();
    if (!value) {
        value = createClientId();
    }
    local?.setItem(AUTH_CLIENT_ID_STORAGE_KEY, value);
    session?.setItem(AUTH_CLIENT_ID_STORAGE_KEY, value);
    return value;
}

export function getServerAuthClientId() {
    return readStoredAuthClientId();
}

function readStoredAuthToken() {
    const session = getSessionStorageSafe();
    const local = getLocalStorageSafe();
    let token: string | null = null;
    token = session?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
    if (token) return token;
    if (!local) return null;
    const legacyToken = local.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (legacyToken && session) {
        session.setItem(AUTH_TOKEN_STORAGE_KEY, legacyToken);
        local.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
    return legacyToken;
}

function writeStoredAuthToken(token: string | null) {
    const session = getSessionStorageSafe();
    const local = getLocalStorageSafe();
    if (session) {
        if (token) {
            session.setItem(AUTH_TOKEN_STORAGE_KEY, token);
        } else {
            session.removeItem(AUTH_TOKEN_STORAGE_KEY);
        }
    }
    if (local) {
        // Remove legacy persistent storage to reduce token exposure.
        local.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
}

function retryAfterMessage(retryAfterMs?: number) {
    if (!retryAfterMs || retryAfterMs <= 0) return '';
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    return `\nToo many failed attempts. Try again in ${seconds}s.`;
}

async function readPasswordStatus(input: string, options: { countFailure?: boolean } = {}) {
    try {
        const headers: Record<string, string> = { 'risu-auth': input ?? '' };
        const clientId = getServerAuthClientId();
        if (clientId) {
            headers['x-risu-client-id'] = clientId;
        }
        if (options.countFailure) {
            headers['x-risu-auth-attempt'] = '1';
        }
        const response = await fetch('/data/auth/password/status', {
            headers,
        });
        if (!response.ok) return null;
        return (await response.json()) as PasswordStatusPayload;
    } catch {
        return null;
    }
}

async function digestPassword(input: string) {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
        const encoded = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const clientId = getServerAuthClientId();
    if (clientId) {
        headers['x-risu-client-id'] = clientId;
    }
    const cachedToken = getCachedServerAuthToken();
    if (cachedToken) {
        headers['risu-auth'] = cachedToken;
    }
    const response = await fetch('/data/auth/crypto', {
        method: 'POST',
        headers,
        body: JSON.stringify({ data: input }),
    });
    if (!response.ok) {
        throw new Error(`Password hashing failed (${response.status})`);
    }
    return await response.text();
}

async function promptAndDigest(prompt: string) {
    const raw = await alertInput(prompt);
    if (!raw) return null;
    return await digestPassword(raw);
}

export function getCachedServerAuthToken() {
    if (authTokenCache === null) {
        authTokenCache = readStoredAuthToken();
    }
    return authTokenCache;
}

export function setCachedServerAuthToken(token: string | null, checked = true) {
    authTokenCache = token;
    authTokenChecked = checked;
    writeStoredAuthToken(token);
}

export function clearCachedServerAuthToken(clearStorage = false) {
    authTokenCache = null;
    authTokenChecked = false;
    if (clearStorage) {
        writeStoredAuthToken(null);
    }
}

export async function getServerPasswordStatus() {
    const currentToken = getCachedServerAuthToken() ?? '';
    const payload = await readPasswordStatus(currentToken);
    return payload?.status ?? null;
}

async function resolveServerAuthTokenInner(interactive: boolean) {
    if (!isNodeServer) {
        return getCachedServerAuthToken();
    }

    const cached = getCachedServerAuthToken() ?? '';
    const statusPayload = await readPasswordStatus(cached);

    // Auth endpoint unavailable in this environment, skip bootstrap.
    if (!statusPayload?.status) {
        authTokenChecked = true;
        return getCachedServerAuthToken();
    }

    if (statusPayload.status === 'correct') {
        authTokenChecked = true;
        return getCachedServerAuthToken();
    }

    if (statusPayload.status === 'unset') {
        if (!interactive) return getCachedServerAuthToken();
        const digested = await promptAndDigest(language.setNodePassword);
        if (!digested) return getCachedServerAuthToken();
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        const clientId = getServerAuthClientId();
        if (clientId) {
            headers['x-risu-client-id'] = clientId;
        }
        const setResponse = await fetch('/data/auth/password', {
            method: 'POST',
            headers,
            body: JSON.stringify({ password: digested }),
        });
        if (!setResponse.ok) {
            throw new Error(`Failed to set server password (${setResponse.status})`);
        }
        setCachedServerAuthToken(digested, true);
        return digested;
    }

    if (!interactive) return getCachedServerAuthToken();

    // status === incorrect
    let nextStatus = statusPayload;
    while (true) {
        const inputPrompt = `${language.inputNodePassword}${retryAfterMessage(nextStatus.retryAfterMs)}`;
        const digested = await promptAndDigest(inputPrompt);
        if (!digested) return getCachedServerAuthToken();
        nextStatus = (await readPasswordStatus(digested, { countFailure: true })) || { status: 'incorrect' };
        if (nextStatus.status === 'correct') {
            setCachedServerAuthToken(digested, true);
            return digested;
        }
    }
}

export async function resolveServerAuthToken(arg: { interactive?: boolean } = {}) {
    const interactive = arg.interactive ?? true;
    if (authTokenChecked && getCachedServerAuthToken()) {
        return getCachedServerAuthToken();
    }
    if (!interactive && authTokenChecked) {
        return getCachedServerAuthToken();
    }
    if (authResolveInFlight) return await authResolveInFlight;
    authResolveInFlight = resolveServerAuthTokenInner(interactive);
    try {
        return await authResolveInFlight;
    } finally {
        authResolveInFlight = null;
    }
}

async function promptForNewPasswordDigest() {
    const first = await alertInput('Enter new server password');
    if (!first) return null;
    const second = await alertInput('Confirm new server password');
    if (!second) return null;
    if (first !== second) {
        throw new Error('Passwords do not match.');
    }
    return await digestPassword(first);
}

async function promptForCurrentPasswordDigest() {
    const raw = await alertInput('Enter current server password');
    if (!raw) return null;
    return await digestPassword(raw);
}

export async function upsertServerPasswordInteractive() {
    if (!isNodeServer) {
        throw new Error('Server password is only available in Node server mode.');
    }

    const currentToken = getCachedServerAuthToken() ?? '';
    const currentStatus = await readPasswordStatus(currentToken);
    if (!currentStatus?.status) {
        throw new Error('Server password endpoint is unavailable.');
    }

    if (currentStatus.status === 'unset') {
        const nextPasswordDigest = await promptForNewPasswordDigest();
        if (!nextPasswordDigest) return { changed: false as const, mode: currentStatus.status };
        const headers: Record<string, string> = { 'content-type': 'application/json' };
        const clientId = getServerAuthClientId();
        if (clientId) {
            headers['x-risu-client-id'] = clientId;
        }
        const setResponse = await fetch('/data/auth/password', {
            method: 'POST',
            headers,
            body: JSON.stringify({ password: nextPasswordDigest }),
        });
        if (!setResponse.ok) {
            throw new Error(`Failed to set server password (${setResponse.status})`);
        }
        setCachedServerAuthToken(nextPasswordDigest, true);
        return { changed: true as const, mode: 'set' as const };
    }

    let authToken: string | null = currentToken;
    if (!authToken || currentStatus.status !== 'correct') {
        authToken = await resolveServerAuthToken({ interactive: true });
    }
    if (!authToken) {
        throw new Error('Server password authentication is required.');
    }

    const currentPasswordDigest = await promptForCurrentPasswordDigest();
    if (!currentPasswordDigest) return { changed: false as const, mode: currentStatus.status };

    const nextPasswordDigest = await promptForNewPasswordDigest();
    if (!nextPasswordDigest) return { changed: false as const, mode: currentStatus.status };

    const clientId = getServerAuthClientId();
    const changeHeaders: Record<string, string> = {
        'content-type': 'application/json',
        'risu-auth': authToken,
    };
    if (clientId) {
        changeHeaders['x-risu-client-id'] = clientId;
    }
    let changeResponse = await fetch('/data/auth/password/change', {
        method: 'POST',
        headers: changeHeaders,
        body: JSON.stringify({ currentPassword: currentPasswordDigest, password: nextPasswordDigest }),
    });

    if (changeResponse.status === 401) {
        clearCachedServerAuthToken(true);
        const refreshedAuth = await resolveServerAuthToken({ interactive: true });
        if (!refreshedAuth) {
            throw new Error('Server password authentication is required.');
        }
        const retryHeaders: Record<string, string> = {
            'content-type': 'application/json',
            'risu-auth': refreshedAuth,
        };
        if (clientId) {
            retryHeaders['x-risu-client-id'] = clientId;
        }
        changeResponse = await fetch('/data/auth/password/change', {
            method: 'POST',
            headers: retryHeaders,
            body: JSON.stringify({ currentPassword: currentPasswordDigest, password: nextPasswordDigest }),
        });
    }

    if (changeResponse.status === 403) {
        throw new Error('Current server password is incorrect.');
    }

    if (changeResponse.status === 429) {
        let retryAfterMs = 0;
        try {
            const payload = await changeResponse.json() as { retryAfterMs?: number };
            retryAfterMs = Number(payload?.retryAfterMs || 0);
        } catch {
            retryAfterMs = 0;
        }
        const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
        throw new Error(`Too many failed attempts. Try again in ${seconds}s.`);
    }

    if (!changeResponse.ok) {
        throw new Error(`Failed to change server password (${changeResponse.status})`);
    }

    setCachedServerAuthToken(nextPasswordDigest, true);
    return { changed: true as const, mode: 'change' as const };
}

export async function fetchWithServerAuth(
    input: RequestInfo | URL,
    init: RequestInit = {},
    options: { interactive?: boolean; retryOn401?: boolean } = {}
) {
    const interactive = options.interactive ?? true;
    const retryOn401 = options.retryOn401 ?? true;

    const requestWithToken = async () => {
        const token = interactive
            ? await resolveServerAuthToken({ interactive: true })
            : getCachedServerAuthToken();
        const headers = new Headers(init.headers ?? undefined);
        const clientId = getServerAuthClientId();
        if (clientId && !headers.has('x-risu-client-id')) {
            headers.set('x-risu-client-id', clientId);
        }
        if (token) {
            headers.set('risu-auth', token);
        }
        return await fetch(input, { ...init, headers });
    };

    let response = await requestWithToken();
    if (retryOn401 && response.status === 401 && isNodeServer) {
        clearCachedServerAuthToken(true);
        response = await requestWithToken();
    }
    return response;
}
