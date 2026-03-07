import { addFetchLog } from "../globalApi.svelte";
import { fetchWithServerAuth } from "../storage/serverAuth";

export interface OpenRouterModelEntry {
    id: string;
    name: string;
    price: number;
    context_length: number;
}

export interface OpenRouterModelsState {
    models: OpenRouterModelEntry[];
    status: number;
    source: 'upstream' | 'server' | 'cache' | 'memory';
    stale: boolean;
    updatedAt: string | null;
    error: string;
}

const CLIENT_MODELS_CACHE_TTL_MS = 60 * 1000;
let cachedState: OpenRouterModelsState | null = null;
let cachedAtMs = 0;

function extractErrorMessage(data: unknown, fallback: string): string {
    const payload = data as {
        message?: string;
        error?: string;
        details?: {
            message?: string;
        };
    } | null;
    if (typeof data === 'string' && data.trim()) {
        return data;
    }
    if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
    }
    if (typeof payload?.error === 'string' && payload.error.trim()) {
        return payload.error;
    }
    if (typeof payload?.details?.message === 'string' && payload.details.message.trim()) {
        return payload.details.message;
    }
    return fallback;
}

function makeState(partial: Partial<OpenRouterModelsState>): OpenRouterModelsState {
    return {
        models: partial.models ?? [],
        status: partial.status ?? 0,
        source: partial.source ?? 'server',
        stale: !!partial.stale,
        updatedAt: partial.updatedAt ?? null,
        error: partial.error ?? '',
    };
}

async function fetchOpenRouterModelsFromServer(forceRefresh = false): Promise<OpenRouterModelsState> {
    const url = `/data/openrouter/models${forceRefresh ? '?refresh=1' : ''}`;
    try {
        const response = await fetchWithServerAuth(url, { cache: 'no-store' });
        const body = await response.json().catch(() => null);
        const ok = response.ok && Array.isArray(body?.models);
        addFetchLog({
            body: null,
            headers: {},
            response: body ?? `HTTP ${response.status}`,
            success: ok,
            url,
            status: response.status,
        });
        if (!ok) {
            return makeState({
                status: response.status,
                source: 'server',
                stale: false,
                error: extractErrorMessage(body, `Failed to load models (HTTP ${response.status})`),
            });
        }

        return makeState({
            models: body.models as OpenRouterModelEntry[],
            status: response.status,
            source: body?.source === 'cache' ? 'cache' : (body?.source === 'upstream' ? 'upstream' : 'server'),
            stale: !!body?.stale,
            updatedAt: typeof body?.updatedAt === 'string' ? body.updatedAt : null,
            error: extractErrorMessage(body?.error, ''),
        });
    } catch (error) {
        const message = extractErrorMessage(error, 'Failed to load OpenRouter models from server endpoint.');
        addFetchLog({
            body: null,
            headers: {},
            response: message,
            success: false,
            url,
            status: 0,
        });
        return makeState({
            status: 0,
            source: 'server',
            stale: false,
            error: message,
        });
    }
}

export async function openRouterModelsWithState(arg: { forceRefresh?: boolean } = {}): Promise<OpenRouterModelsState> {
    const forceRefresh = !!arg.forceRefresh;
    if (!forceRefresh && cachedState && (Date.now() - cachedAtMs) < CLIENT_MODELS_CACHE_TTL_MS) {
        return makeState({
            ...cachedState,
            source: 'memory',
        });
    }

    const fetched = await fetchOpenRouterModelsFromServer(forceRefresh);

    if (fetched.models.length > 0) {
        cachedState = fetched;
        cachedAtMs = Date.now();
        return fetched;
    }

    if (cachedState && cachedState.models.length > 0) {
        return makeState({
            ...cachedState,
            source: 'cache',
            stale: true,
            error: fetched.error || cachedState.error,
            status: fetched.status || cachedState.status,
        });
    }

    return fetched;
}

export async function openRouterModels() {
    const state = await openRouterModelsWithState();
    return state.models;
}

export async function getFreeOpenRouterModel() {
    const models = await openRouterModels();
    const bestFreeModel = models.filter((model) => {
        return model.name.endsWith("Free");
    }).sort((a, b) => {
        return b.context_length - a.context_length;
    })[0];
    return bestFreeModel?.id ?? '';
}
