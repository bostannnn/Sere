export type ServerExecutionEnvelope = {
    type?: string
    result?: unknown
    newCharEtag?: string
    error?: string
    message?: string
    details?: {
        status?: number
        body?: {
            error?: {
                message?: string
            }
            message?: string
        }
    }
    status?: number
}

export function normalizeServerEnvelope(raw: unknown): ServerExecutionEnvelope {
    if (typeof raw === 'object' && raw !== null) {
        return raw as ServerExecutionEnvelope
    }
    if (typeof raw === 'undefined') {
        return {}
    }
    return {
        result: raw
    }
}

export function stringifyUnknownResponse(raw: unknown): string {
    return typeof raw === 'string' ? raw : JSON.stringify(raw)
}

export function getServerStringSuccessResult(raw: unknown): {
    result: string
    newCharEtag?: string
} | null {
    const parsed = normalizeServerEnvelope(raw)
    if (parsed.type === 'success' && typeof parsed.result === 'string') {
        return {
            result: parsed.result,
            newCharEtag: parsed.newCharEtag,
        }
    }

    const nestedResult = (parsed.result && typeof parsed.result === 'object')
        ? parsed.result as ServerExecutionEnvelope
        : null
    if (nestedResult?.type === 'success' && typeof nestedResult.result === 'string') {
        return {
            result: nestedResult.result,
            newCharEtag: parsed.newCharEtag || nestedResult.newCharEtag,
        }
    }

    return null
}

export function getServerFailureMessage(raw: unknown, fallback = 'Server execution failed'): string {
    const parsed = normalizeServerEnvelope(raw)
    if (typeof parsed.message === 'string' && parsed.message) {
        return parsed.message
    }
    if (typeof parsed.result === 'string' && parsed.result) {
        return parsed.result
    }
    if (typeof parsed.error === 'string' && parsed.error) {
        return parsed.error
    }

    const nestedResult = (parsed.result && typeof parsed.result === 'object')
        ? parsed.result as ServerExecutionEnvelope
        : null
    if (nestedResult?.type === 'fail') {
        if (typeof nestedResult.message === 'string' && nestedResult.message) {
            return nestedResult.message
        }
        if (typeof nestedResult.result === 'string' && nestedResult.result) {
            return nestedResult.result
        }
        if (typeof nestedResult.error === 'string' && nestedResult.error) {
            return nestedResult.error
        }
    }

    return fallback
}

export function parseServerErrorPayload(parsed: unknown, statusFallback: number) {
    const errorPayload = normalizeServerEnvelope(parsed)
    const status = Number(errorPayload?.details?.status ?? errorPayload?.status ?? statusFallback)
    const upstreamBody = errorPayload?.details?.body
    const upstreamMessage =
        upstreamBody?.error?.message ||
        upstreamBody?.message ||
        errorPayload?.message ||
        errorPayload?.error ||
        ''

    return {
        status,
        code: String(errorPayload?.error || ''),
        message: String(upstreamMessage || 'Request failed'),
    }
}
