/**
 * check-server-routes.cjs
 *
 * Contract enforcer for server route files.
 *
 * Rules checked:
 *   ROUTE-001  Every /data/* route handler calls requirePasswordAuth (or relies on the
 *              global middleware in installDataApiMiddleware) - exceptions: paths listed
 *              in publicAuthPaths defined in server_data_helpers.cjs, and OPTIONS
 *              preflight requests (CORS handshake, sent before auth headers exist).
 *   ROUTE-002  No route registers directly on app outside of a registerXxx factory function.
 *   ROUTE-003  risu-auth header must never be forwarded upstream (must be in blockedForwardRequestHeaders).
 *   ROUTE-004  Every async route handler that does I/O wraps errors - either calls next(error)
 *              or sends a response in catch. Silent swallows are forbidden.
 *   ROUTE-005  Mutable resource writes (PUT/PATCH/DELETE) on /data/* use requireIfMatch.
 *              Exception: legacy storage routes use hex-path validation instead of ETag
 *              (grandfathered - documented below).
 *   ROUTE-006  No raw res.send(string) on error paths - error responses must be objects with
 *              an `error` key (enforced by shape check on res.status(4xx/5xx).send(...) calls).
 *   ROUTE-007  No hardcoded port numbers in route files (e.g. localhost:3000).
 *   ROUTE-008  Every route file exports only a single register* function - no side effects at
 *              module level (no top-level app.get / app.post outside a function).
 *   ROUTE-009  integration_routes.cjs must not forward risu-* headers upstream.
 *   ROUTE-010  proxy_routes.cjs must strip risu-auth from forwarded headers.
 *
 * Optional local suppressions:
 *   // checker-ignore ROUTE-004 until YYYY-MM-DD: reason
 * Expired suppressions fail the checker.
 *
 * Run:  node server/node/check-server-routes.cjs
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

function rule(name, condition, details, file) {
    if (condition) return;
    if (file && isRuleSuppressed(name, file.suppressions)) return;
    failures.push({ name, details });
}

function readFile(filePath) {
    return fs.readFileSync(filePath, 'utf-8');
}

function fallbackFindRouteRegistrations(src) {
    const re = /\bapp\.(get|post|put|patch|delete|all|options)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const results = [];
    let m;
    while ((m = re.exec(src)) !== null) {
        results.push({
            method: m[1].toUpperCase(),
            routePath: m[2],
            offset: m.index,
            line: 0,
            insideFunction: true,
            handlers: [],
        });
    }
    return results;
}

function routeFiles(dir) {
    return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.cjs'))
        .map((f) => {
            const abs = path.join(dir, f);
            const src = readFile(abs);
            const suppressions = parseCheckerSuppressions(src);
            const { ast, error } = parseAst(src, f);
            const namedFunctions = ast ? collectNamedFunctions(ast, src) : new Map();
            const routes = ast ? collectRouteRegistrations(ast) : fallbackFindRouteRegistrations(src);
            const file = { name: f, abs, src, ast, astError: error, namedFunctions, routes, suppressions };
            for (const bad of suppressions.invalid) {
                failures.push({
                    name: `ROUTE-SUPPRESS:${f}:${bad.line}`,
                    details: `${bad.reason}\n    ${bad.text}`,
                });
            }
            for (const expired of suppressions.expired) {
                failures.push({
                    name: `ROUTE-SUPPRESS:${f}:${expired.line}`,
                    details: `Expired suppression for ${expired.ruleCode} (expired ${expired.until}).\n    ${expired.text}`,
                });
            }
            if (error) {
                failures.push({
                    name: `ROUTE-AST:${f}`,
                    details: `${error}\n    Falling back to regex route detection for this file.`,
                });
            }
            return file;
        });
}

function hasTopLevelRouteRegistration(file) {
    if (file.ast) {
        return file.routes.some((route) => !route.insideFunction);
    }
    const src = file.src;
    const firstFunction = src.search(/\bfunction\s+\w/);
    const firstArrow = src.search(/^const\s+\w+\s*=\s*(?:async\s*)?\(/m);
    const firstDef = Math.min(
        firstFunction === -1 ? Number.POSITIVE_INFINITY : firstFunction,
        firstArrow === -1 ? Number.POSITIVE_INFINITY : firstArrow,
    );
    const re = /\bapp\.(get|post|put|patch|delete|all|options)\s*\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        if (m.index < firstDef) return true;
    }
    return false;
}

function hasSilentCatch(src) {
    const catchRe = /catch\s*\([^)]*\)\s*\{/g;
    let m;
    while ((m = catchRe.exec(src)) !== null) {
        const start = m.index + m[0].length;
        let depth = 1;
        let i = start;
        while (i < src.length && depth > 0) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            i++;
        }
        const catchBody = src.slice(start, i - 1).trim();
        if (catchBody === '' || /^\/\/[^\n]*$/.test(catchBody)) return true;
        const hasResponse = /\bres\.(status|send|json|end|sendFile|sendStatus)\b/.test(catchBody)
            || /\bnext\s*\(/.test(catchBody)
            || /\bconsole\.(error|warn|log)\b/.test(catchBody)
            || /\bsendJson\b/.test(catchBody)
            || /\bsendSSE\b/.test(catchBody)
            || /\bsendProgress\b/.test(catchBody);
        if (!hasResponse) return true;
    }
    return false;
}

function routeHandlersContainToken(file, route, tokenName) {
    const tokenRe = new RegExp(`\\b${tokenName}\\s*\\(`);
    const handlerEntries = collectRouteHandlerEntries(route, file.namedFunctions, file.src);
    if (handlerEntries.some((entry) => tokenRe.test(entry.source))) {
        return true;
    }

    const currentIndex = file.routes.findIndex((r) => r.offset === route.offset);
    const nextRoute = currentIndex >= 0 ? file.routes[currentIndex + 1] : null;
    const inlineSegment = file.src.slice(route.offset, nextRoute ? nextRoute.offset : file.src.length);
    return tokenRe.test(inlineSegment);
}

function mutableRouteUsesIfMatch(file, route) {
    if (ETAG_EXEMPT_FILES.has(file.name)) return true;
    if (!['PUT', 'PATCH', 'DELETE'].includes(route.method)) return true;
    if (typeof route.routePath !== 'string' || !route.routePath.startsWith('/data/')) return true;
    return routeHandlersContainToken(file, route, 'requireIfMatch');
}

// ---------------------------------------------------------------------------
// ROUTE-001 calibration constants
// ---------------------------------------------------------------------------

const PUBLIC_AUTH_PATHS = new Set([
    '/data/auth/crypto',
    '/data/auth/password',
    '/data/auth/password/status',
    '/data/oauth/callback',
]);

const EXPLICIT_AUTH_FILES = new Set([
    'rag_routes.cjs',
    'proxy_routes.cjs',
]);

const ETAG_EXEMPT_FILES = new Set([
    'legacy_routes.cjs',
    'rag_routes.cjs',
]);

function checkExplicitAuthCoverage(file) {
    if (!EXPLICIT_AUTH_FILES.has(file.name)) return;

    const dataRoutes = file.routes.filter((route) =>
        typeof route.routePath === 'string'
        && route.routePath.startsWith('/data/')
        && !PUBLIC_AUTH_PATHS.has(route.routePath)
        && route.method !== 'OPTIONS'
    );

    for (const route of dataRoutes) {
        rule(
            `ROUTE-001:${file.name}:${route.method} ${route.routePath}`,
            routeHandlersContainToken(file, route, 'requirePasswordAuth'),
            `Route ${route.method} ${route.routePath} in ${file.name} does not call requirePasswordAuth ` +
            '(checked inline handlers and named handler references).',
            file
        );
    }
}

// ---------------------------------------------------------------------------
// Main checks
// ---------------------------------------------------------------------------

const routesDir = path.join(__dirname, 'routes');
const files = routeFiles(routesDir);

for (const file of files) {
    rule(
        `ROUTE-002:${file.name}`,
        !hasTopLevelRouteRegistration(file),
        `${file.name} registers routes at module top level (outside a function). ` +
        'All registrations must be inside a register*() factory.',
        file
    );

    rule(
        `ROUTE-004:${file.name}`,
        !hasSilentCatch(file.src),
        `${file.name} contains a catch block that neither sends a response nor calls next(err) nor logs. ` +
        'Silent swallows are forbidden.',
        file
    );

    const mutableDataRoutes = file.routes.filter((route) =>
        ['PUT', 'PATCH', 'DELETE'].includes(route.method)
        && typeof route.routePath === 'string'
        && route.routePath.startsWith('/data/')
    );
    for (const route of mutableDataRoutes) {
        rule(
            `ROUTE-005:${file.name}:${route.method} ${route.routePath}`,
            mutableRouteUsesIfMatch(file, route),
            `${file.name} route ${route.method} ${route.routePath} does not use requireIfMatch. ` +
            'Mutable /data routes must use ETag concurrency control.',
            file
        );
    }

    rule(
        `ROUTE-007:${file.name}`,
        !/localhost\s*:\s*\d+/.test(file.src),
        `${file.name} contains a hardcoded localhost:PORT URL. Use env-provided config instead.`,
        file
    );

    const exportedFunctions = [...file.src.matchAll(/module\.exports\s*=\s*\{([^}]+)\}/g)]
        .flatMap((m) => m[1].split(',').map((s) => s.trim()).filter(Boolean));
    rule(
        `ROUTE-008:${file.name}`,
        exportedFunctions.length === 1 && /^register[A-Z]/.test(exportedFunctions[0]),
        `${file.name} should export exactly one register*() function. Got: [${exportedFunctions.join(', ')}]`,
        file
    );

    checkExplicitAuthCoverage(file);
}

const proxyFile = files.find((f) => f.name === 'proxy_routes.cjs');
if (proxyFile) {
    rule(
        'ROUTE-003:proxy_routes.cjs:risu-auth-blocked',
        /blockedForwardRequestHeaders[^;]*risu-auth/.test(proxyFile.src.replace(/\s+/g, ' ')),
        'proxy_routes.cjs must include "risu-auth" in blockedForwardRequestHeaders to prevent token leakage to upstream.',
        proxyFile
    );

    const blockedSetMatch = proxyFile.src.match(/new Set\s*\(\s*\[([\s\S]*?)\]\s*\)/);
    if (blockedSetMatch) {
        rule(
            'ROUTE-010:proxy_routes.cjs:risu-auth-in-set',
            blockedSetMatch[1].includes("'risu-auth'") || blockedSetMatch[1].includes('"risu-auth"'),
            'proxy_routes.cjs blockedForwardRequestHeaders Set must explicitly list "risu-auth".',
            proxyFile
        );
    }
}

const integrationFile = files.find((f) => f.name === 'integration_routes.cjs');
if (integrationFile) {
    rule(
        'ROUTE-009:integration_routes.cjs:risu-headers-stripped',
        /normalizedKey\.startsWith\s*\(\s*['"]risu-['"]\s*\)/.test(integrationFile.src),
        'integration_routes.cjs must strip risu-* headers before forwarding to upstream ' +
        '(normalizedKey.startsWith("risu-") check).',
        integrationFile
    );
}

for (const file of files) {
    const badSend = /res\.status\s*\(\s*[45]\d\d\s*\)\s*\.send\s*\(\s*['"`][^'"`]+['"`]\s*\)/.test(file.src);
    rule(
        `ROUTE-006:${file.name}`,
        !badSend,
        `${file.name} sends a plain string as an error response body. ` +
        "Error responses must be objects: { error: 'CODE', message: '...' }.",
        file
    );
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (failures.length === 0) {
    console.log(`✓ check-server-routes: all contracts pass (${files.length} route files checked)`);
    process.exit(0);
}

console.error(`\n✗ check-server-routes: ${failures.length} violation(s) found:\n`);
for (const failure of failures) {
    console.error(`  [${failure.name}]`);
    console.error(`    ${failure.details}`);
    console.error('');
}
process.exit(1);
