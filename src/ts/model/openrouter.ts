import { addFetchLog, globalFetch } from "../globalApi.svelte";
import { isNodeServer } from "../platform";
import { getDatabase } from "../storage/database.svelte";
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
    source: 'upstream' | 'server' | 'cache' | 'memory' | 'legacy-proxy';
    stale: boolean;
    updatedAt: string | null;
    error: string;
}

const CLIENT_MODELS_CACHE_TTL_MS = 60 * 1000;
let cachedState: OpenRouterModelsState | null = null;
let cachedAtMs = 0;

type OpenRouterRawModel = {
    id?: string;
    name?: string;
    pricing?: {
        prompt?: string | number;
        completion?: string | number;
    };
    context_length?: number | string;
};

function parseModelPrice(model: OpenRouterRawModel): number {
    const promptCost = Number(model?.pricing?.prompt);
    const completionCost = Number(model?.pricing?.completion);
    const candidate = ((promptCost * 3) + completionCost) / 4;
    if (!Number.isFinite(candidate) || candidate < 0) {
        return 0;
    }
    return candidate;
}

function mapOpenRouterModels(rawModels: OpenRouterRawModel[]): OpenRouterModelEntry[] {
    return rawModels
        .filter((model) => model && typeof model.id === 'string' && model.id.trim())
        .map((model) => {
            const price = parseModelPrice(model);
            const modelId = model.id.trim();
            const baseName = typeof model.name === 'string' && model.name.trim() ? model.name.trim() : modelId;
            return {
                id: modelId,
                name: price > 0 ? `${baseName} - $${(price * 1000).toFixed(5)}/1k` : `${baseName} - Free`,
                price,
                context_length: Number.isFinite(Number(model.context_length)) ? Number(model.context_length) : 0,
            };
        })
        .sort((a, b) => {
            if (a.price !== b.price) {
                return a.price - b.price;
            }
            return a.name.localeCompare(b.name);
        });
}

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
        source: partial.source ?? 'legacy-proxy',
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

async function fetchOpenRouterModelsViaProxy(): Promise<OpenRouterModelsState> {
    const db = getDatabase();
    const headers = {
        Authorization: `Bearer ${db.openrouterKey}`,
        'Content-Type': 'application/json',
    };
    const res = await globalFetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers,
    });

    if (!res.ok || !Array.isArray(res.data?.data)) {
        return makeState({
            status: res.status ?? 0,
            source: 'legacy-proxy',
            stale: false,
            error: extractErrorMessage(res.data, 'Failed to load OpenRouter models.'),
        });
    }

    return makeState({
        models: mapOpenRouterModels(res.data.data),
        status: res.status,
        source: 'upstream',
        stale: false,
    });
}

export async function openRouterModelsWithState(arg: { forceRefresh?: boolean } = {}): Promise<OpenRouterModelsState> {
    const forceRefresh = !!arg.forceRefresh;
    if (!forceRefresh && cachedState && (Date.now() - cachedAtMs) < CLIENT_MODELS_CACHE_TTL_MS) {
        return makeState({
            ...cachedState,
            source: 'memory',
        });
    }

    const fetched = isNodeServer
        ? await fetchOpenRouterModelsFromServer(forceRefresh)
        : await fetchOpenRouterModelsViaProxy();

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
