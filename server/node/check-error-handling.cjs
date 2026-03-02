/**
 * check-error-handling.cjs
 *
 * Contract enforcer for error handling discipline across all server route files.
 *
 * Rules checked:
 *   ERR-001  Every async route handler must be wrapped in try/catch.
 *   ERR-002  No empty or comment-only catch blocks.
 *   ERR-003  No raw res.send(error) / res.json(error) with caught exception objects.
 *   ERR-004  Warn on floating appendLLMAudit/appendMemoryTraceAudit calls.
 *   ERR-005  console.error / console.warn in catch blocks must include the error value.
 *   ERR-006  installGlobalErrorHandler must be called in server.cjs after all routes.
 *   ERR-007  No res.status(5xx).send(rawErrorObject) in catch blocks.
 *
 * Optional local suppressions:
 *   // checker-ignore ERR-001 until YYYY-MM-DD: reason
 * Expired suppressions fail the checker.
 *
 * Run:  node server/node/check-error-handling.cjs
 * Exit: 0 = all pass, 1 = violations found.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
    parseAst,
    collectNamedFunctions,
    collectRouteRegistrations,
    collectRouteHandlerEntries,
    parseCheckerSuppressions,
    isRuleSuppressed,
} = require('./checker_utils.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const failures = [];
const warnings = [];

function rule(name, condition, details, file) {
    if (condition) return;
    if (file && isRuleSuppressed(name, file.suppressions)) return;
    failures.push({ name, details });
}

function warn(name, details, file) {
    if (file && isRuleSuppressed(name, file.suppressions)) return;
    warnings.push({ name, details });
}

function readSrc(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

function collectCjsFiles(dir, options = {}) {
    if (!fs.existsSync(dir)) return [];
    const parseRoutes = options.parseRoutes === true;
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.cjs'))
        .map((f) => {
            const abs = path.join(dir, f);
            const src = readSrc(abs);
            const suppressions = parseCheckerSuppressions(src);
            const { ast, error } = parseRoutes ? parseAst(src, f) : { ast: null, error: null };
            const namedFunctions = ast ? collectNamedFunctions(ast, src) : new Map();
            const routes = ast ? collectRouteRegistrations(ast) : [];
            const file = { name: f, abs, src, suppressions, ast, astError: error, namedFunctions, routes };

            for (const bad of suppressions.invalid) {
                failures.push({
                    name: `ERR-SUPPRESS:${f}:${bad.line}`,
                    details: `${bad.reason}\n    ${bad.text}`,
                });
            }
            for (const expired of suppressions.expired) {
                failures.push({
                    name: `ERR-SUPPRESS:${f}:${expired.line}`,
                    details: `Expired suppression for ${expired.ruleCode} (expired ${expired.until}).\n    ${expired.text}`,
                });
            }
            if (parseRoutes && error) {
                failures.push({
                    name: `ERR-AST:${f}`,
                    details: `${error}\n    Falling back to regex async-handler detection for this file.`,
                });
            }
            return file;
        });
}

function findAllWithLines(src, re) {
    const results = [];
    const lines = src.split('\n');
    for (let ln = 0; ln < lines.length; ln++) {
        const line = lines[ln];
        const localRe = new RegExp(re.source, re.flags.replace('g', '') + 'g');
        let m;
        while ((m = localRe.exec(line)) !== null) {
            results.push({ line: ln + 1, match: m[0], fullLine: line.trim() });
        }
    }
    return results;
}

function extractCatchBody(src, catchOffset) {
    const start = src.indexOf('{', catchOffset);
    if (start === -1) return '';
    let depth = 1;
    let i = start + 1;
    while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') depth--;
        i++;
    }
    return src.slice(start + 1, i - 1);
}

function findCatchBodies(src) {
    const results = [];
    const catchRe = /\bcatch\s*\(([^)]*)\)/g;
    let m;
    while ((m = catchRe.exec(src)) !== null) {
        const body = extractCatchBody(src, m.index + m[0].length);
        results.push({ paramName: m[1].trim(), body, offset: m.index });
    }
    return results;
}

const SELF_HANDLING_HELPERS = [
    'handleLLMExecutePost',
    'sendLegacyRetired',
    'reverseProxyFunc',
];
const DELEGATES_IMMEDIATELY_RE = new RegExp(
    `^\\s*(?:return\\s+)?(?:await\\s+)?(?:${SELF_HANDLING_HELPERS.join('|')})\\s*\\(`
);

function asyncHandlersHaveTry(file) {
    if (file.ast) {
        for (const route of file.routes) {
            const handlerEntries = collectRouteHandlerEntries(route, file.namedFunctions, file.src);
            for (const handler of handlerEntries) {
                if (!handler.async) continue;
                const body = String(handler.source || '').trim();
                if (DELEGATES_IMMEDIATELY_RE.test(body)) continue;
                if (!/\btry\s*\{/.test(body)) return false;
            }
        }
        return true;
    }

    const handlerRe = /\bapp\.\w+\s*\([^,]+,\s*async\s*\(\s*req\s*,\s*res(?:\s*,\s*next)?\s*\)\s*=>\s*\{/g;
    let m;
    while ((m = handlerRe.exec(file.src)) !== null) {
        const openBrace = m.index + m[0].length - 1;
        const body = extractCatchBody(file.src, openBrace);
        if (DELEGATES_IMMEDIATELY_RE.test(body)) continue;
        if (!/\btry\s*\{/.test(body)) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const serverDir = __dirname;
const routesDir = path.join(serverDir, 'routes');

const SKIP = new Set([
    'check-server-routes.cjs',
    'check-api-surface.cjs',
    'check-server-deps.cjs',
    'check-error-handling.cjs',
    'check-server-contracts.cjs',
    'checker_utils.cjs',
]);

const serverFiles = collectCjsFiles(serverDir).filter((f) => !SKIP.has(f.name));
const routeFiles = collectCjsFiles(routesDir, { parseRoutes: true });
const allFiles = [...serverFiles, ...routeFiles];

// ---------------------------------------------------------------------------
// ERR-001 - Async route handlers have try/catch
// ---------------------------------------------------------------------------

for (const file of routeFiles) {
    rule(
        `ERR-001:${file.name}`,
        asyncHandlersHaveTry(file),
        `${file.name} has an async route handler without a try/catch block. ` +
        'All async handlers must wrap their body in try/catch to prevent unhandled rejections reaching Express.',
        file
    );
}

// ---------------------------------------------------------------------------
// ERR-002 - No empty or comment-only catch blocks
// ---------------------------------------------------------------------------

for (const file of allFiles) {
    const catches = findCatchBodies(file.src);
    for (const { paramName, body, offset } of catches) {
        const stripped = body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
        rule(
            `ERR-002:${file.name}:catch(${paramName})@offset${offset}`,
            stripped.length > 0,
            `${file.name} has an empty or comment-only catch(${paramName}) block at offset ${offset}. ` +
            'Every catch must respond to the client, call next(err), or log the error.',
            file
        );
    }
}

// ---------------------------------------------------------------------------
// ERR-003 - No res.send(error) / res.json(error) with raw exception objects
// ---------------------------------------------------------------------------

for (const file of allFiles) {
    const catches = findCatchBodies(file.src);
    for (const { paramName, body } of catches) {
        if (!paramName || paramName === '_') continue;
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(paramName)) continue;
        const rawSendRe = new RegExp(
            `res\\.(?:send|json)\\s*\\(\\s*${paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\)`,
            'g'
        );
        const hits = [...body.matchAll(rawSendRe)];
        rule(
            `ERR-003:${file.name}:raw-error-send(${paramName})`,
            hits.length === 0,
            `${file.name} sends the raw caught exception (${paramName}) as a response body via res.send/res.json. ` +
            `This leaks stack traces to the client. Extract error.message or use String(${paramName}) instead.`,
            file
        );
    }
}

// ---------------------------------------------------------------------------
// ERR-004 - Warn on floating (un-awaited, un-caught) audit append promises
// ---------------------------------------------------------------------------

for (const file of routeFiles) {
    const floatingAudit = findAllWithLines(
        file.src,
        /(?<!await\s)(?<!return\s)(?<!void\s)\bappend(?:LLMAudit|MemoryTraceAudit)\s*\(/
    );
    for (const hit of floatingAudit) {
        const hasAwait = /\bawait\b/.test(hit.fullLine);
        if (!hasAwait) {
            warn(
                `ERR-004:${file.name}:floating-audit:${hit.line}`,
                `${file.name} line ${hit.line}: appendLLMAudit/appendMemoryTraceAudit called without await. ` +
                `If this promise rejects it can become unhandled.\n    Line: ${hit.fullLine}`,
                file
            );
        }
    }
}

// ---------------------------------------------------------------------------
// ERR-005 - console.error/warn in catch blocks must include the error value
// ---------------------------------------------------------------------------

for (const file of allFiles) {
    const catches = findCatchBodies(file.src);
    for (const { paramName, body, offset } of catches) {
        if (!paramName || paramName === '_') continue;
        if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(paramName)) continue;
        const consoleRe = /\bconsole\.(error|warn)\s*\(/g;
        let m;
        while ((m = consoleRe.exec(body)) !== null) {
            const afterCall = body.slice(m.index + m[0].length, m.index + m[0].length + 200);
            const includesErrorRef = new RegExp(`\\b${paramName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(afterCall.split(')')[0]);
            rule(
                `ERR-005:${file.name}:console.${m[1]}@offset${offset}`,
                includesErrorRef,
                `${file.name}: console.${m[1]}() in catch(${paramName}) block at offset ${offset} ` +
                `does not appear to include the error variable (${paramName}). ` +
                `Log the actual error so failures are diagnosable: console.${m[1]}('[context]', ${paramName})`,
                file
            );
        }
    }
}

// ---------------------------------------------------------------------------
// ERR-006 - installGlobalErrorHandler called after registerServerRoutes in server.cjs
// ---------------------------------------------------------------------------

const serverRoot = serverFiles.find((f) => f.name === 'server.cjs');
if (serverRoot) {
    const registerPos = serverRoot.src.indexOf('registerServerRoutes(');
    const installPos = serverRoot.src.indexOf('installGlobalErrorHandler()');
    rule(
        'ERR-006:server.cjs:error-handler-after-routes',
        installPos !== -1 && registerPos !== -1 && installPos > registerPos,
        'server.cjs must call installGlobalErrorHandler() AFTER registerServerRoutes(). ' +
        'Express error middleware must be registered last.' +
        (installPos === -1 ? ' (installGlobalErrorHandler call not found)' : '') +
        (registerPos === -1 ? ' (registerServerRoutes call not found)' : ''),
        serverRoot
    );
}

// ---------------------------------------------------------------------------
// ERR-007 - No res.status(5xx).send(rawErrorObject)
// ---------------------------------------------------------------------------

for (const file of routeFiles) {
    const catches = findCatchBodies(file.src);
    for (const { paramName, body, offset } of catches) {
        if (!paramName) continue;
        const rawStatusSendRe = new RegExp(
            `res\\.status\\s*\\(\\s*5\\d\\d\\s*\\)\\.send\\s*\\(\\s*${paramName}\\s*\\)`,
            'g'
        );
        const hits = [...body.matchAll(rawStatusSendRe)];
        rule(
            `ERR-007:${file.name}:raw-status-send(${paramName})@offset${offset}`,
            hits.length === 0,
            `${file.name}: res.status(5xx).send(${paramName}) at offset ${offset} sends the raw exception. ` +
            `Use { error: String(${paramName}?.message || ${paramName}) } instead to avoid leaking stack traces.`,
            file
        );
    }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const totalChecked = allFiles.length;

if (warnings.length > 0) {
    console.warn(`\n⚠ check-error-handling: ${warnings.length} warning(s):\n`);
    for (const warning of warnings) {
        console.warn(`  [${warning.name}]`);
        console.warn(`    ${warning.details}`);
        console.warn('');
    }
}

if (failures.length === 0) {
    console.log(`✓ check-error-handling: all contracts pass (${totalChecked} files checked)`);
    process.exit(0);
}

console.error(`\n✗ check-error-handling: ${failures.length} violation(s) found:\n`);
for (const failure of failures) {
    console.error(`  [${failure.name}]`);
    console.error(`    ${failure.details}`);
    console.error('');
}
process.exit(1);
