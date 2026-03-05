function createResourceLocks(arg = {}) {
    void arg;
    const queues = new Map();

    function normalizeKey(key) {
        if (typeof key !== 'string' || key.trim().length === 0) {
            return '__global__';
        }
        return key.trim();
    }

    async function withKey(key, task) {
        const normalized = normalizeKey(key);
        const previous = queues.get(normalized) || Promise.resolve();
        const next = previous
            .then(() => task(), () => task())
            .finally(() => {
                if (queues.get(normalized) === next) {
                    queues.delete(normalized);
                }
            });
        queues.set(normalized, next);
        return next;
    }

    async function withKeys(keys, task) {
        const normalizedKeys = [...new Set((Array.isArray(keys) ? keys : []).map((key) => normalizeKey(key)))].sort();
        if (normalizedKeys.length === 0) {
            return withKey('__global__', task);
        }
        let cursor = task;
        for (let i = normalizedKeys.length - 1; i >= 0; i -= 1) {
            const key = normalizedKeys[i];
            const previousCursor = cursor;
            cursor = () => withKey(key, previousCursor);
        }
        return cursor();
    }

    return {
        withKey,
        withKeys,
    };
}

module.exports = {
    createResourceLocks,
};
