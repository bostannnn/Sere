class LLMHttpError extends Error {
    constructor(status, code, message, details = null) {
        super(message);
        this.name = 'LLMHttpError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

function toErrorResponse(error, arg = {}) {
    const requestId = arg.requestId || '-';
    const endpoint = arg.endpoint || 'unknown';
    const durationMs = arg.durationMs ?? 0;

    if (error instanceof LLMHttpError) {
        return {
            status: error.status,
            code: error.code,
            payload: {
                error: error.code,
                message: error.message,
                details: error.details,
                requestId,
                endpoint,
                durationMs,
            },
        };
    }

    return {
        status: 500,
        code: 'INTERNAL_ERROR',
        payload: {
            error: 'INTERNAL_ERROR',
            message: String(error?.message || error || 'Unknown server error'),
            requestId,
            endpoint,
            durationMs,
        },
    };
}

module.exports = {
    LLMHttpError,
    toErrorResponse,
};
