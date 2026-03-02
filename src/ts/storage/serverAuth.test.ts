import { beforeEach, describe, expect, it, vi } from 'vitest';

const { alertInputMock } = vi.hoisted(() => ({
    alertInputMock: vi.fn(),
}));

vi.mock('src/lang', () => ({
    language: {
        setNodePassword: 'Set password',
        inputNodePassword: 'Input password',
    },
}));

vi.mock('src/ts/alert', () => ({
    alertInput: alertInputMock,
}));

describe('serverAuth', () => {
    async function digestHex(input: string) {
        const encoded = new TextEncoder().encode(input);
        const digest = await crypto.subtle.digest('SHA-256', encoded);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
        (globalThis as typeof globalThis & { __NODE__?: boolean }).__NODE__ = true;
    });

    it('bootstraps and stores auth token when password is unset', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'unset' }), { status: 200 }))
            .mockResolvedValueOnce(new Response('ok', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        alertInputMock.mockResolvedValueOnce('plain-password');

        const mod = await import('./serverAuth');
        const token = await mod.resolveServerAuthToken({ interactive: true });
        const expectedDigest = await digestHex('plain-password');

        expect(token).toBe(expectedDigest);
        expect(sessionStorage.getItem('risuauth')).toBe(expectedDigest);
        expect(localStorage.getItem('risuauth')).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0][0]).toBe('/data/auth/password/status');
        expect(fetchMock.mock.calls[1][0]).toBe('/data/auth/password');
    });

    it('changes password using current auth token and updates cache', async () => {
        sessionStorage.setItem('risuauth', 'old-digest');
        const fetchMock = vi.fn()
            // current status in upsertServerPasswordInteractive()
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'correct' }), { status: 200 }))
            // password change post
            .mockResolvedValueOnce(new Response('ok', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        alertInputMock
            .mockResolvedValueOnce('current-password')
            .mockResolvedValueOnce('next-password')
            .mockResolvedValueOnce('next-password');

        const mod = await import('./serverAuth');
        const result = await mod.upsertServerPasswordInteractive();
        const currentDigest = await digestHex('current-password');
        const nextDigest = await digestHex('next-password');

        expect(result).toEqual({ changed: true, mode: 'change' });
        expect(sessionStorage.getItem('risuauth')).toBe(nextDigest);
        expect(localStorage.getItem('risuauth')).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(2);
        const changeCall = fetchMock.mock.calls[1];
        expect(changeCall[0]).toBe('/data/auth/password/change');
        const headers = new Headers((changeCall[1] as RequestInit).headers);
        expect(headers.get('risu-auth')).toBe('old-digest');
        expect(JSON.parse((changeCall[1] as RequestInit).body as string)).toEqual({
            currentPassword: currentDigest,
            password: nextDigest,
        });
    });

    it('migrates legacy localStorage auth token into sessionStorage', async () => {
        localStorage.setItem('risuauth', 'legacy-token');
        const mod = await import('./serverAuth');

        expect(mod.getCachedServerAuthToken()).toBe('legacy-token');
        expect(sessionStorage.getItem('risuauth')).toBe('legacy-token');
        expect(localStorage.getItem('risuauth')).toBeNull();
    });

    it('retries incorrect password flow and shows retryAfter hint in prompt', async () => {
        const fetchMock = vi.fn()
            // initial status check from resolveServerAuthTokenInner
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'incorrect', retryAfterMs: 3000 }), { status: 200 }))
            // status for first digest: still incorrect
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'incorrect', retryAfterMs: 2000 }), { status: 200 }))
            // status for second digest: success
            .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'correct' }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);
        alertInputMock
            .mockResolvedValueOnce('first-try')
            .mockResolvedValueOnce('second-try');

        const mod = await import('./serverAuth');
        const token = await mod.resolveServerAuthToken({ interactive: true });
        const secondDigest = await digestHex('second-try');

        expect(token).toBe(secondDigest);
        expect(sessionStorage.getItem('risuauth')).toBe(secondDigest);
        expect(alertInputMock).toHaveBeenCalledTimes(2);
        const firstPrompt = String(alertInputMock.mock.calls[0]?.[0] ?? '');
        const secondPrompt = String(alertInputMock.mock.calls[1]?.[0] ?? '');
        expect(firstPrompt).toContain('Too many failed attempts. Try again in');
        expect(secondPrompt).toContain('Too many failed attempts. Try again in');

        expect(fetchMock).toHaveBeenCalledTimes(3);
        const initialStatusHeaders = new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit)?.headers);
        const firstRetryStatusHeaders = new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit)?.headers);
        const secondRetryStatusHeaders = new Headers((fetchMock.mock.calls[2]?.[1] as RequestInit)?.headers);
        expect(initialStatusHeaders.get('x-risu-auth-attempt')).toBeNull();
        expect(firstRetryStatusHeaders.get('x-risu-auth-attempt')).toBe('1');
        expect(secondRetryStatusHeaders.get('x-risu-auth-attempt')).toBe('1');
    });
});
