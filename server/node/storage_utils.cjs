const path = require('path');
const nodeCrypto = require('crypto');

function safeResolve(baseDir, relPath) {
    const resolved = path.resolve(baseDir, relPath);
    if (!resolved.startsWith(path.resolve(baseDir) + path.sep)) {
        throw new Error('Invalid path');
    }
    return resolved;
}

function computeEtag(buf) {
    const hash = nodeCrypto.createHash('sha256');
    hash.update(buf);
    return `"${hash.digest('hex')}"`;
}

function requireIfMatch(req, res) {
    const ifMatch = req.headers['if-match'];
    if (!ifMatch) {
        res.status(412).send({
            error: 'PRECONDITION_REQUIRED',
            message: 'If-Match is required for this operation.',
        });
        return null;
    }
    return ifMatch;
}

function isIfMatchAny(ifMatch) {
    return ifMatch === '*';
}

module.exports = {
    safeResolve,
    computeEtag,
    requireIfMatch,
    isIfMatchAny,
};
