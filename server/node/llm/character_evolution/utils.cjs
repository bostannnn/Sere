function clone(value, fallback = null) {
    try {
        return value === undefined ? fallback : JSON.parse(JSON.stringify(value));
    } catch {
        return fallback;
    }
}

function toTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

module.exports = {
    clone,
    toTrimmedString,
};
